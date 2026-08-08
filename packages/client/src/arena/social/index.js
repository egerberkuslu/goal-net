// Arena wiring for @goalnet/social.
//
// One object, `attachSocial`, owns everything the arena needs from the social
// package, so main.js gains exactly two lines: a construction and a
// `handleFrame` call in the frame demux. Nothing in src/arena/ is rewritten.
//
// The routing, in full:
//
//   guest -> host   SOC_CHAT     the phrase or emote the player picked
//   host  -> all    SOC_CHAT     the same message, with `from` stamped by the
//                                host to the slot IT handed that peer
//   guest -> host   SOC_SPECTATE a request for a seat in the gallery
//   host  -> guest  SOC_SPECTATE_ACK  granted, or a refusal code
//
// The host is the only place the chat guard runs, because a guest that trusts
// its own cooldown is a guest that can be patched not to. The mute list is the
// mirror image: it runs ONLY on the receiver, is never transmitted, and the
// host is never told who is muted.
//
// Clock injection: `now()` is an option so a headless driver can step it.

import {
  CHAT_KIND,
  EMOTES,
  QUICK_PHRASES,
  SOC_CHAT,
  SOC_SPECTATE,
  SOC_SPECTATE_ACK,
  SPECTATE_REASON,
  SocialProtocolError,
  createChatGuard,
  createMuteList,
  createSpectatorDesk,
  decodeSocial,
  encodeChat,
  encodeSpectate,
  encodeSpectateAck,
  isSocialFrame,
  renderMessage,
} from '../../../../social/src/index.js';

import { ArenaSocialUI } from './chatUI.js';
import { createProfile } from './profile.js';

const SPECTATE_TEXT = Object.freeze({
  [SPECTATE_REASON.CAP]: 'İzleyici kontenjanı dolu.',
  [SPECTATE_REASON.BUDGET]: 'Host bağlantısı daha fazla izleyici kaldırmıyor.',
  [SPECTATE_REASON.CLOSED]: 'Bu oda izleyici almıyor.',
  [SPECTATE_REASON.ALREADY]: 'Zaten izleyicisin.',
});

/**
 * attachSocial(options)
 *
 *   transport   the arena transport (sendRaw / broadcastRaw / peers)
 *   isHost()    true while this tab is the host
 *   selfId()    this tab's roster id
 *   mount       DOM node for the chat surfaces; pass null to stay headless
 *   now()       milliseconds; injected so a driver can replay a clock
 *
 * Returns an object main.js keeps in a `let` and calls `handleFrame` on.
 */
export function attachSocial(options = {}) {
  const {
    transport = null,
    isHost = () => false,
    selfId = () => 'host',
    mount = typeof document !== 'undefined' ? document.body : null,
    now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    storage,
    spectatorOptions,
    chatOptions,
  } = options;

  const profile = createProfile({ storage, now: () => Date.now() });
  const guard = createChatGuard(chatOptions);
  const mutes = createMuteList(profile.muteStorage);
  const desk = createSpectatorDesk(spectatorOptions);

  // roster slot <-> stable player id, so a compact wire word survives as a
  // mute key that outlives the match
  let slotOfId = new Map();
  let idOfSlot = new Map();
  let names = new Map();
  let spectating = false;
  let seq = 0;

  const ui = mount
    ? new ArenaSocialUI({
      phrases: QUICK_PHRASES,
      emotes: EMOTES,
      onSend: (kind, id) => send(kind, id),
      onMute: (id) => mutes.toggle(id),
      isMuted: (id) => mutes.isMuted(id),
      canSend: () => !!transport,
    }).mount(mount)
    : null;

  const stats = {
    sent: 0,
    received: 0,
    refused: 0,
    muted: 0,
    rejected: { decode: 0, unknownPeer: 0, guard: 0 },
  };

  function nameOf(id) {
    return names.get(id) || (id === selfId() ? profile.display() : 'Oyuncu');
  }

  function deliver(fromId, kind, id, own = false) {
    if (!own && mutes.isMuted(fromId)) {
      stats.muted++;
      return null;
    }
    const text = renderMessage(kind, id);
    if (!text) return null;
    stats.received++;
    const payload = { fromId, kind, id, text, who: nameOf(fromId), own };
    ui?.push(payload);
    // headless callers (and the test) get the same object the UI paints
    options.onMessage?.(payload);
    return payload;
  }

  function broadcast(buffer) {
    if (!transport) return 0;
    return transport.broadcastRaw(buffer);
  }

  /** Send one phrase or emote. Host and guest take different paths on purpose. */
  function send(kind, id) {
    if (!transport) return { ok: false, reason: 'not-connected' };
    const me = selfId();
    if (isHost()) {
      const verdict = guard.check(me, { kind, id }, now());
      if (!verdict.ok) {
        stats.refused++;
        return verdict;
      }
      const slot = slotOfId.has(me) ? slotOfId.get(me) : -1;
      seq = (seq + 1) >>> 0;
      broadcast(encodeChat({ kind, id, from: slot, seq }));
      deliver(me, kind, id, true);
      stats.sent++;
      return verdict;
    }
    // A guest sends and lets the host decide. The local guard still runs, but
    // only as a courtesy that keeps the wire quiet; the host's copy is the one
    // that counts.
    const local = guard.check(me, { kind, id }, now());
    if (!local.ok) {
      stats.refused++;
      return local;
    }
    seq = (seq + 1) >>> 0;
    const host = transport.hostId;
    if (host) transport.sendRaw(host, encodeChat({ kind, id, from: -1, seq }));
    stats.sent++;
    return local;
  }

  /** Ask the host for a spectator seat (guest only). */
  function requestSpectate(want = true) {
    if (!transport || isHost() || !transport.hostId) return false;
    seq = (seq + 1) >>> 0;
    return transport.sendRaw(transport.hostId, encodeSpectate({ want, seq }));
  }

  /**
   * handleFrame(peerId, data) -> boolean
   *
   * Returns true when the frame was ours and has been fully handled, so the
   * arena's own demux can keep its `if (kind !== 'lobby') return;` untouched.
   */
  function handleFrame(peerId, data) {
    if (!isSocialFrame(data)) return false;

    let msg;
    try {
      msg = decodeSocial(data);
    } catch (err) {
      // A malformed social frame is dropped exactly like a malformed net frame:
      // counted, named, and never allowed to reach the UI.
      stats.rejected.decode++;
      if (!(err instanceof SocialProtocolError)) throw err;
      return true;
    }

    if (msg.type === SOC_CHAT) {
      if (isHost()) {
        const verdict = guard.check(peerId, msg, now());
        if (!verdict.ok) {
          stats.rejected.guard++;
          return true;
        }
        // the host stamps `from` itself; whatever the peer claimed is discarded
        const slot = slotOfId.has(peerId) ? slotOfId.get(peerId) : -1;
        seq = (seq + 1) >>> 0;
        broadcast(encodeChat({ kind: msg.kind, id: msg.id, from: slot, seq }));
        deliver(peerId, msg.kind, msg.id);
        return true;
      }
      const fromId = idOfSlot.has(msg.from) ? idOfSlot.get(msg.from) : `slot${msg.from}`;
      deliver(fromId, msg.kind, msg.id, fromId === selfId());
      return true;
    }

    if (msg.type === SOC_SPECTATE) {
      if (!isHost()) return true; // a guest has no gallery to seat anyone in
      const res = msg.want ? desk.admit(peerId, now()) : { ok: !desk.release(peerId), reason: SPECTATE_REASON.OK };
      seq = (seq + 1) >>> 0;
      transport?.sendRaw(peerId, encodeSpectateAck({ granted: res.ok, reason: res.reason, seq }));
      return true;
    }

    if (msg.type === SOC_SPECTATE_ACK) {
      spectating = msg.granted;
      if (!msg.granted && ui) ui.warn({ reason: 'spectate', retryInMs: 0 });
      options.onSpectateAck?.({
        granted: msg.granted,
        reason: msg.reason,
        text: msg.granted ? 'İzleyici olarak bağlandın.' : (SPECTATE_TEXT[msg.reason] || 'İzleyici olamadın.'),
      });
      return true;
    }

    return true;
  }

  return {
    profile,
    guard,
    mutes,
    desk,
    stats,
    ui,
    handleFrame,
    send,
    sendPhrase: (id) => send(CHAT_KIND.PHRASE, id),
    sendEmote: (id) => send(CHAT_KIND.EMOTE, id),
    requestSpectate,
    isSpectating: () => spectating,

    /**
     * Tell the wiring who is in which slot. Called once per lobby broadcast and
     * once at match start; everything else derives from it.
     */
    setRoster(entries = []) {
      slotOfId = new Map();
      idOfSlot = new Map();
      names = new Map();
      entries.forEach((e, i) => {
        const slot = Number.isInteger(e.slot) ? e.slot : i;
        slotOfId.set(e.id, slot);
        idOfSlot.set(slot, e.id);
        if (e.name) names.set(e.id, e.name);
      });
      return entries.length;
    },

    /** Forget a peer that left: their chat history and their seat both go. */
    peerLeft(peerId) {
      guard.forget(peerId);
      desk.release(peerId);
    },

    /** Host-side spectator accounting, for the diag line. */
    spectatorBudget: (at) => desk.budget(at ?? now()),

    dispose() {
      ui?.dispose();
    },
  };
}

export { createProfile } from './profile.js';
export { ArenaSocialUI } from './chatUI.js';
