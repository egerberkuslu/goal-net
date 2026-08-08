// PeerJS transport for the P2P match: one host (authoritative) and N guests,
// signalling through the free PeerJS cloud broker, data over WebRTC DataChannels.
// This layer only moves validated protocol messages; it holds no game state.
import Peer from 'peerjs';
import { MSG, validate, normalizeCode, randomCode, sanitizeName, CODE_LEN } from './protocol.js';

/** Host peer ids are `goalnet-<CODE>` so a 6-char code is enough to find a room. */
export const PEER_PREFIX = 'goalnet-';

/** How many room codes we try before giving up when the id is already taken. */
const MAX_HOST_TRIES = 3;
/** Grace period that lets a final message flush before we close a connection. */
const FLUSH_MS = 150;
/** A connect() that never opens within this budget counts as "room not found". */
const JOIN_TIMEOUT_MS = 12000;

/**
 * Stable error codes surfaced through `onError(err)`. The UI maps these to
 * Turkish messages; `err.cause` keeps the original PeerJS error when there is one.
 */
export const NET_ERR = Object.freeze({
  ROOM_NOT_FOUND: 'room-not-found',   // peer-unavailable: "Oda bulunamadı"
  INVALID_CODE: 'invalid-code',       // code is not 6 alphanumerics
  ID_TAKEN: 'id-taken',               // every generated room code was in use
  BROWSER: 'browser-unsupported',     // WebRTC missing
  NETWORK: 'network',                 // broker unreachable / socket error
  CONNECTION: 'connection',           // a single DataConnection failed
  INVALID_MESSAGE: 'invalid-message', // we tried to send something malformed
  PEER: 'peer',                       // anything else PeerJS reported
});

/** PeerJS error type (plus our own synthetic ones) -> our error code. */
const ERR_MAP = {
  'peer-unavailable': NET_ERR.ROOM_NOT_FOUND,
  'invalid-code': NET_ERR.INVALID_CODE,
  'invalid-message': NET_ERR.INVALID_MESSAGE,
  'unavailable-id': NET_ERR.ID_TAKEN,
  'browser-incompatible': NET_ERR.BROWSER,
  'network': NET_ERR.NETWORK,
  'server-error': NET_ERR.NETWORK,
  'socket-error': NET_ERR.NETWORK,
  'socket-closed': NET_ERR.NETWORK,
  'ssl-unavailable': NET_ERR.NETWORK,
  'webrtc': NET_ERR.CONNECTION,
  'disconnected': NET_ERR.NETWORK,
};

const noop = () => {};

/**
 * WebRTC transport shared by host and guest.
 *
 * Host: `host()` -> `onOpen(code)` -> `onPeerJoin(id)` per guest -> `onMessage(id, msg)`.
 * Guest: `join(code, name)` -> `onPeerJoin(hostId)` on success, `onError(err)` on failure.
 * Every inbound payload passes through `validate()`; anything malformed is dropped
 * silently and only shows up in `stats.dropped`.
 */
export class PeerNet {
  /**
   * @param {{onOpen?:(code:string)=>void, onPeerJoin?:(id:string)=>void,
   *          onPeerLeave?:(id:string)=>void, onMessage?:(id:string, msg:object)=>void,
   *          onBinary?:(id:string, data:ArrayBuffer)=>void,
   *          onError?:(err:{code:string,message:string,cause?:unknown})=>void,
   *          onClosed?:(reason:string)=>void}} [callbacks] all optional
   */
  constructor(callbacks = {}) {
    const cb = callbacks || {};
    this.cb = {
      onOpen: cb.onOpen || noop,
      onPeerJoin: cb.onPeerJoin || noop,
      onPeerLeave: cb.onPeerLeave || noop,
      onMessage: cb.onMessage || noop,
      // Binary frames bypass the JSON validator on purpose: they belong to a
      // self-validating binary protocol (@goalnet/net decodes and rejects its
      // own wire format). Nothing is delivered here unless a caller opts in.
      onBinary: cb.onBinary || noop,
      onError: cb.onError || noop,
      onClosed: cb.onClosed || noop,
    };

    /** @type {import('peerjs').Peer|null} */
    this.peer = null;
    /** True once host() was called. */
    this.isHost = false;
    /** Room code (host only), uppercase, CODE_LEN chars. */
    this.code = null;
    /** Host peer id we are connected to (guest only). */
    this.hostId = null;
    /** Local display name captured by join(); the upper layer sends `hello`. */
    this.name = '';
    /** @type {Map<string, import('peerjs').DataConnection>} live connections by peer id */
    this.conns = new Map();
    /** @type {Set<string>} in-memory blocklist (host only, cleared on close) */
    this.banned = new Set();
    /** Counters for debugging and for proving the validator is doing work. */
    this.stats = { sent: 0, received: 0, dropped: 0, rejected: 0, invalidOut: 0 };

    this._leftReported = new Set();
    this._timers = new Map();
    this._hostTries = 0;
    this._destroyed = false;
  }

  // ------------------------------------------------------------------- host

  /**
   * Open a room. Picks a random code, claims `goalnet-<CODE>` on the broker and
   * retries with a fresh code when that id is taken (up to 3 attempts total).
   * Fires `onOpen(code)` once the broker accepted us.
   * @returns {void}
   */
  host() {
    this.isHost = true;
    this._hostTries = 0;
    this._openHost();
  }

  /** @private claim one candidate room code */
  _openHost() {
    this._hostTries++;
    const code = randomCode();
    this.code = code;

    const peer = new Peer(PEER_PREFIX + code);
    this.peer = peer;

    peer.on('open', () => {
      if (this._destroyed) return;
      this.cb.onOpen(code);
    });
    peer.on('connection', (conn) => this._acceptConnection(conn));
    peer.on('disconnected', () => this._reconnect(peer));
    peer.on('close', () => { if (!this._destroyed) this.cb.onClosed('peer-closed'); });
    peer.on('error', (err) => {
      if (err?.type === 'unavailable-id' && this._hostTries < MAX_HOST_TRIES) {
        try { peer.destroy(); } catch { /* already gone */ }
        this._openHost(); // fresh code, fresh Peer
        return;
      }
      this._emitError(err);
    });
  }

  /** @private wire an incoming guest connection, or bounce a banned one */
  _acceptConnection(conn) {
    const id = conn.peer;
    if (this.banned.has(id)) {
      this.stats.rejected++;
      try { conn.close(); } catch { /* nothing to close */ }
      return;
    }
    this._leftReported.delete(id); // a fresh session for this id
    this.conns.set(id, conn);
    this._wire(conn);
  }

  // ------------------------------------------------------------------ guest

  /**
   * Join a room. Connects to `goalnet-<CODE>` with a reliable DataChannel.
   * Per the contract this does NOT send `hello`; the upper layer does that after
   * `onPeerJoin(hostId)`. A missing room surfaces as `onError({code:'room-not-found'})`.
   * @param {string} code room code, any case, punctuation tolerated
   * @param {string} [name] local display name, stored as `this.name` for the caller
   * @returns {void}
   */
  join(code, name = '') {
    this.isHost = false;
    this.name = sanitizeName(name);

    const norm = normalizeCode(code);
    if (norm.length !== CODE_LEN) {
      this._emitError({ type: 'invalid-code', message: `bad room code: ${String(code)}` });
      return;
    }
    this.code = norm;
    const hostId = PEER_PREFIX + norm;
    this.hostId = hostId;

    const peer = new Peer();
    this.peer = peer;

    peer.on('open', () => {
      if (this._destroyed) return;
      const conn = peer.connect(hostId, { reliable: true, metadata: { name: this.name } });
      if (!conn) {
        this._emitError({ type: 'peer-unavailable', message: 'connect() returned nothing' });
        return;
      }
      this.conns.set(hostId, conn);
      this._wire(conn);
      // PeerJS only reports peer-unavailable after the broker answers; if the
      // channel simply never opens we still have to tell the UI something.
      this._timers.set(hostId, setTimeout(() => {
        if (!conn.open && !this._destroyed) {
          this._emitError({ type: 'peer-unavailable', message: 'join timed out' });
          this._dropPeer(hostId);
        }
      }, JOIN_TIMEOUT_MS));
    });
    peer.on('disconnected', () => this._reconnect(peer));
    peer.on('close', () => { if (!this._destroyed) this.cb.onClosed('peer-closed'); });
    peer.on('error', (err) => this._emitError(err));
  }

  // --------------------------------------------------------------- messaging

  /**
   * Send one message to one peer. The message is validated first, so a bug in
   * the calling layer can never put a malformed frame on the wire.
   * @param {string} id target peer id
   * @param {object} msg protocol message
   * @returns {boolean} true when it was handed to an open DataConnection
   */
  send(id, msg) {
    const clean = validate(msg);
    if (!clean) {
      this.stats.invalidOut++;
      this._emitError({ type: 'invalid-message', message: `refusing to send ${msg?.t}` });
      return false;
    }
    const conn = this.conns.get(id);
    if (!conn || !conn.open) return false;
    try {
      conn.send(clean);
      this.stats.sent++;
      return true;
    } catch (err) {
      this._emitError(err);
      return false;
    }
  }

  /**
   * Send one message to every open connection (host side). Closed or half-open
   * connections are skipped rather than throwing.
   * @param {object} msg protocol message
   * @returns {number} how many peers received it
   */
  broadcast(msg) {
    const clean = validate(msg);
    if (!clean) {
      this.stats.invalidOut++;
      this._emitError({ type: 'invalid-message', message: `refusing to broadcast ${msg?.t}` });
      return 0;
    }
    let n = 0;
    for (const conn of this.conns.values()) {
      if (!conn.open) continue;
      try {
        conn.send(clean);
        this.stats.sent++;
        n++;
      } catch { /* peer vanished mid-broadcast; 'close' will clean it up */ }
    }
    return n;
  }

  /**
   * Send one binary frame to one peer, untouched. The JSON validator does not
   * apply: binary belongs to a protocol that validates itself on arrival.
   * @param {string} id target peer id
   * @param {ArrayBuffer|ArrayBufferView} data
   * @returns {boolean} true when it was handed to an open DataConnection
   */
  sendRaw(id, data) {
    const conn = this.conns.get(id);
    if (!conn || !conn.open) return false;
    try {
      conn.send(data);
      this.stats.sent++;
      return true;
    } catch (err) {
      this._emitError(err);
      return false;
    }
  }

  /**
   * Binary broadcast (host side). Closed connections are skipped.
   * @param {ArrayBuffer|ArrayBufferView} data
   * @returns {number} how many peers received it
   */
  broadcastRaw(data) {
    let n = 0;
    for (const conn of this.conns.values()) {
      if (!conn.open) continue;
      try {
        conn.send(data);
        this.stats.sent++;
        n++;
      } catch { /* peer vanished mid-broadcast; 'close' will clean it up */ }
    }
    return n;
  }

  // ------------------------------------------------------------- moderation

  /**
   * Remove a guest from the room. Sends `{t:'kicked', reason:'kick'}` and closes
   * shortly after so the message has time to flush.
   * @param {string} id peer id to remove
   * @returns {void}
   */
  kick(id) {
    this._disconnect(id, 'kick');
  }

  /**
   * Remove a guest and block that peer id for the lifetime of this PeerNet.
   * Later connection attempts from the same id are closed on arrival.
   * @param {string} id peer id to block
   * @returns {void}
   */
  ban(id) {
    this.banned.add(id);
    this._disconnect(id, 'ban');
  }

  /** @private shared kick/ban path */
  _disconnect(id, reason) {
    const conn = this.conns.get(id);
    if (!conn) return;
    if (conn.open) {
      try { conn.send({ t: MSG.KICKED, reason }); this.stats.sent++; } catch { /* already gone */ }
    }
    const timer = setTimeout(() => {
      try { conn.close(); } catch { /* already closed */ }
      this._dropPeer(id);
    }, FLUSH_MS);
    this._timers.set(`${id}:close`, timer);
  }

  // ---------------------------------------------------------------- teardown

  /**
   * Close every connection and destroy the underlying Peer. Idempotent.
   * @param {string} [reason='local'] reported through `onClosed`
   * @returns {void}
   */
  close(reason = 'local') {
    if (this._destroyed) return;
    this._destroyed = true;
    for (const timer of this._timers.values()) clearTimeout(timer);
    this._timers.clear();
    for (const conn of this.conns.values()) {
      try { conn.close(); } catch { /* already closed */ }
    }
    this.conns.clear();
    if (this.peer) {
      try { this.peer.destroy(); } catch { /* already destroyed */ }
    }
    this.peer = null;
    this.cb.onClosed(reason);
  }

  /** @returns {string[]} peer ids with an open DataConnection */
  peers() {
    return [...this.conns.entries()].filter(([, c]) => c.open).map(([id]) => id);
  }

  // ----------------------------------------------------------------- private

  /** @private attach the open/data/close/error handlers of one DataConnection */
  _wire(conn) {
    const id = conn.peer;
    conn.on('open', () => {
      if (this._destroyed) return;
      const timer = this._timers.get(id);
      if (timer) { clearTimeout(timer); this._timers.delete(id); }
      this.cb.onPeerJoin(id);
    });
    conn.on('data', (raw) => this._handleData(id, raw));
    conn.on('close', () => this._dropPeer(id));
    conn.on('error', (err) => {
      this._emitError(err, NET_ERR.CONNECTION);
      this._dropPeer(id);
    });
  }

  /** @private parse, validate and dispatch one inbound payload */
  _handleData(id, raw) {
    // Binary never went through the JSON validator, and before onBinary existed
    // it was dropped as malformed. Handing it to a subscriber is therefore
    // strictly additive: a caller that does not listen still sees nothing.
    if (raw instanceof ArrayBuffer || ArrayBuffer.isView(raw)) {
      this.stats.received++;
      this.cb.onBinary(id, raw);
      return;
    }
    let parsed = raw;
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
    }
    const msg = validate(parsed);
    if (!msg) {
      this.stats.dropped++; // malformed or hostile: drop without answering
      return;
    }
    this.stats.received++;
    this.cb.onMessage(id, msg);
  }

  /** @private report a peer as gone exactly once, whatever path got us here */
  _dropPeer(id) {
    const timer = this._timers.get(id);
    if (timer) { clearTimeout(timer); this._timers.delete(id); }
    this.conns.delete(id);
    if (this._leftReported.has(id)) return;
    this._leftReported.add(id);
    if (!this._destroyed) this.cb.onPeerLeave(id);
  }

  /** @private the broker dropped us but the DataChannels may still be alive */
  _reconnect(peer) {
    if (this._destroyed || peer.destroyed) return;
    try { peer.reconnect(); } catch (err) { this._emitError(err, NET_ERR.NETWORK); }
  }

  /** @private normalize any PeerJS error into `{code, type, message, cause}` */
  _emitError(err, fallback = NET_ERR.PEER) {
    const type = err?.type;
    const code = ERR_MAP[type] || fallback;
    this.cb.onError({
      code,
      type: type || 'unknown',
      message: err?.message || String(err ?? 'unknown error'),
      cause: err,
    });
  }
}
