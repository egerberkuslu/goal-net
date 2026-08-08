// One transport interface, two backends.
//
//   'peer'   the shipping path: PeerJS over WebRTC through the public broker,
//            i.e. src/mp/peer.js exactly as the live game uses it. Rooms are
//            `goalnet-<CODE>`, so an arena room and a classic room share the
//            same code space and the same 6-character code the player types.
//
//   'local'  two tabs of the SAME browser talking over a BroadcastChannel. No
//            broker, no ICE, no internet. This is what scripts/arena-2tab.mjs
//            drives, because a proof that needs a third party's server to pass
//            is not a proof of this codebase.
//
// Both carry raw ArrayBuffers and nothing else: the arena's lobby JSON is framed
// (protocol.js) and the match frames come straight out of @goalnet/net. The
// interface is deliberately the smaller of the two backends' capabilities:
//
//   host()                        -> onOpen(code)
//   join(code, name)              -> onPeerJoin(hostId) | onError(err)
//   sendRaw(id, buf) / broadcastRaw(buf)
//   peers() / close()
//   callbacks: onOpen, onPeerJoin, onPeerLeave, onFrame(id, buf), onError, onClosed

import { PeerNet, PEER_PREFIX } from '../mp/peer.js';
import { normalizeCode, randomCode, sanitizeName, CODE_LEN } from '../mp/protocol.js';

const noop = () => {};

/**
 * createTransport({ backend, ...callbacks })
 * @param {{backend?:'peer'|'local'}} options
 */
export function createTransport(options = {}) {
  const backend = options.backend === 'local' ? 'local' : 'peer';
  return backend === 'local' ? new LocalTransport(options) : new PeerTransport(options);
}

class BaseTransport {
  constructor(cb = {}) {
    this.cb = {
      onOpen: cb.onOpen || noop,
      onPeerJoin: cb.onPeerJoin || noop,
      onPeerLeave: cb.onPeerLeave || noop,
      onFrame: cb.onFrame || noop,
      onError: cb.onError || noop,
      onClosed: cb.onClosed || noop,
    };
    this.isHost = false;
    this.code = null;
    this.hostId = null;
    this.selfId = null;
  }
}

// --------------------------------------------------------------- PeerJS path

class PeerTransport extends BaseTransport {
  constructor(options = {}) {
    super(options);
    this.backend = 'peer';
    this.net = new PeerNet({
      onOpen: (code) => {
        this.code = code;
        this.selfId = PEER_PREFIX + code;
        this.cb.onOpen(code);
      },
      onPeerJoin: (id) => {
        if (!this.isHost) this.hostId = id;
        this.cb.onPeerJoin(id);
      },
      onPeerLeave: (id) => this.cb.onPeerLeave(id),
      // Lobby JSON travels as a framed binary blob like everything else, so the
      // legacy JSON path is simply unused here; anything that arrives on it is
      // a message from the classic protocol and is not ours.
      onMessage: () => {},
      onBinary: (id, data) => this.cb.onFrame(id, data),
      onError: (err) => this.cb.onError(err),
      onClosed: (reason) => this.cb.onClosed(reason),
    });
  }

  host() {
    this.isHost = true;
    this.net.host();
  }

  join(code, name = '') {
    this.isHost = false;
    this.code = normalizeCode(code);
    this.hostId = PEER_PREFIX + this.code;
    this.net.join(code, name);
  }

  sendRaw(id, buffer) { return this.net.sendRaw(id, buffer); }
  broadcastRaw(buffer) { return this.net.broadcastRaw(buffer); }
  peers() { return this.net.peers(); }
  close(reason = 'local') { this.net.close(reason); }
}

// --------------------------------------------------- same-browser loopback

/**
 * BroadcastChannel loopback. Every participant picks a random id; the host owns
 * the room name. The handshake is three messages and no timers:
 *
 *   guest -> * : { k:'join', from }
 *   host  -> * : { k:'accept', from:hostId, to:guestId }
 *   either-> * : { k:'data',  from, to, buf }
 *
 * `to` is checked on arrival, so a third tab in the same room never sees frames
 * that were not addressed to it.
 */
class LocalTransport extends BaseTransport {
  constructor(options = {}) {
    super(options);
    this.backend = 'local';
    this.conns = new Set();
    this.chan = null;
    this.joinTimer = null;
    this.joinTimeoutMs = options.joinTimeoutMs ?? 8000;
  }

  _open(code) {
    if (typeof BroadcastChannel !== 'function') {
      this.cb.onError({ code: 'browser-unsupported', message: 'BroadcastChannel is missing' });
      return false;
    }
    this.code = code;
    this.chan = new BroadcastChannel(`goalnet-arena-${code}`);
    this.chan.onmessage = (e) => this._onMessage(e.data);
    return true;
  }

  host() {
    this.isHost = true;
    const code = randomCode();
    this.selfId = `host-${code}`;
    this.hostId = this.selfId;
    if (!this._open(code)) return;
    this.cb.onOpen(code);
  }

  join(code, name = '') {
    this.isHost = false;
    const norm = normalizeCode(code);
    if (norm.length !== CODE_LEN) {
      this.cb.onError({ code: 'invalid-code', message: `bad room code: ${String(code)}` });
      return;
    }
    this.selfId = `guest-${randomCode()}`;
    this.name = sanitizeName(name);
    if (!this._open(norm)) return;
    this.chan.postMessage({ k: 'join', from: this.selfId });
    this.joinTimer = setTimeout(() => {
      if (!this.hostId) {
        this.cb.onError({ code: 'room-not-found', message: 'join timed out' });
      }
    }, this.joinTimeoutMs);
  }

  _onMessage(m) {
    if (!m || typeof m !== 'object' || typeof m.from !== 'string') return;
    if (m.from === this.selfId) return; // BroadcastChannel does not echo, but be sure
    if (m.k === 'join') {
      if (!this.isHost) return;
      this.conns.add(m.from);
      this.chan.postMessage({ k: 'accept', from: this.selfId, to: m.from });
      this.cb.onPeerJoin(m.from);
      return;
    }
    if (m.k === 'accept') {
      if (this.isHost || m.to !== this.selfId) return;
      if (this.joinTimer) { clearTimeout(this.joinTimer); this.joinTimer = null; }
      this.hostId = m.from;
      this.conns.add(m.from);
      this.cb.onPeerJoin(m.from);
      return;
    }
    if (m.k === 'bye') {
      if (!this.conns.delete(m.from)) return;
      this.cb.onPeerLeave(m.from);
      return;
    }
    if (m.k !== 'data' || m.to !== this.selfId) return;
    this.cb.onFrame(m.from, m.buf);
  }

  sendRaw(id, buffer) {
    if (!this.chan || !this.conns.has(id)) return false;
    // structured clone copies the buffer, which is what a real DataChannel does
    this.chan.postMessage({ k: 'data', from: this.selfId, to: id, buf: buffer });
    return true;
  }

  broadcastRaw(buffer) {
    let n = 0;
    for (const id of this.conns) if (this.sendRaw(id, buffer)) n++;
    return n;
  }

  peers() { return [...this.conns]; }

  close(reason = 'local') {
    if (this.joinTimer) { clearTimeout(this.joinTimer); this.joinTimer = null; }
    if (this.chan) {
      try { this.chan.postMessage({ k: 'bye', from: this.selfId }); } catch { /* closing */ }
      try { this.chan.close(); } catch { /* already closed */ }
    }
    this.chan = null;
    this.conns.clear();
    this.cb.onClosed(reason);
  }
}
