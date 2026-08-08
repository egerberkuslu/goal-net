// Wire format for @goalnet/social. THIS FILE IS A TRUST BOUNDARY.
//
// Modelled on packages/net/src/protocol.js line for line, because the rule
// there is the rule here: everything arriving from a DataChannel goes through
// `decodeSocial`, nothing downstream assumes anything the decoder did not
// check, and every rejection carries a stable `code` the caller can bucket.
//
// A third magic joins the two the arena already demuxes:
//
//   0x474e4e31 "GNN1"   @goalnet/net    — hello, input, snapshot
//   0x474e414a "GNAJ"   arena lobby JSON
//   0x474e5343 "GNSC"   this file       — chat, emote, spectate
//
// Fixed-size, whole Int32 words, explicit little-endian, so a big-endian host
// produces the same bytes. No JSON, no strings: a quick-chat message is a kind
// and an id into a table both ends compile in, which means the wire cannot
// carry an insult even if a client is rewritten to try.
//
// Common header (3 words, 12 bytes)
//   0  MAGIC 0x474e5343 "GNSC"
//   1  (SOCIAL_VERSION << 16) | type
//   2  seq                     uint32, monotone per sender
//
// CHAT      (peer <-> host)                       6 words / 24 B
//   3  kind                    0 = phrase, 1 = emote
//   4  id                      index into QUICK_PHRASES / EMOTES
//   5  from                    roster slot of the speaker, -1 when unset
//
// `from` is stamped by the HOST on rebroadcast and is ignored on the way in: a
// peer cannot put words in someone else's mouth, because the host overwrites
// the field with the slot it handed that peer itself. The receiver needs it
// because mute is receiver-local and has to key on somebody.
//
// SPECTATE  (peer -> host)                        4 words / 16 B
//   3  flags                   bit0 = want spectate, clear = leave spectating
//
// SPECTATE_ACK (host -> peer)                     5 words / 20 B
//   3  granted                 0 or 1
//   4  reason                  SPECTATE_REASON code, 0 when granted

import { CHAT_KIND, isKnownMessage } from './quickChat.js';

export const SOCIAL_MAGIC = 0x474e5343; // "GNSC"
export const SOCIAL_VERSION = 1;

export const SOC_CHAT = 1;
export const SOC_SPECTATE = 2;
export const SOC_SPECTATE_ACK = 3;

export const SOCIAL_HEADER_WORDS = 3;
export const CHAT_BYTES = (SOCIAL_HEADER_WORDS + 3) * 4;
/** Widest roster slot a `from` field may name. The arena caps at 12. */
export const MAX_CHAT_SLOT = 32;
export const SPECTATE_BYTES = (SOCIAL_HEADER_WORDS + 1) * 4;
export const SPECTATE_ACK_BYTES = (SOCIAL_HEADER_WORDS + 2) * 4;
/** Nothing here is ever chunked, so the ceiling is generous on purpose. */
export const MAX_SOCIAL_BYTES = 64;

/** Refusal codes carried by SPECTATE_ACK. 0 means "granted". */
export const SPECTATE_REASON = Object.freeze({
  OK: 0,
  CAP: 1, // the room is at its spectator cap
  BUDGET: 2, // admitting one more would blow the uplink budget
  CLOSED: 3, // the host is not accepting spectators
  ALREADY: 4, // this peer is already seated
});

export class SocialProtocolError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SocialProtocolError';
    this.code = code;
  }
}

function asDataView(data) {
  if (data instanceof ArrayBuffer) return new DataView(data);
  if (ArrayBuffer.isView(data)) {
    return new DataView(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new SocialProtocolError('not-binary', 'message is neither ArrayBuffer nor ArrayBufferView');
}

function writeHeader(view, type, seq) {
  view.setInt32(0, SOCIAL_MAGIC, true);
  view.setInt32(4, ((SOCIAL_VERSION << 16) | type) | 0, true);
  view.setUint32(8, seq >>> 0, true);
}

function requireInt(v, name) {
  if (!Number.isInteger(v)) {
    throw new SocialProtocolError('encode-range', `${name} must be an integer, got ${v}`);
  }
  return v | 0;
}

/**
 * True when `data` starts with the social magic. Cheap enough to call on every
 * inbound frame, and the arena's own frameKind() stays untouched.
 */
export function isSocialFrame(data) {
  try {
    const view = asDataView(data);
    return view.byteLength >= 4 && view.getInt32(0, true) === SOCIAL_MAGIC;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ encoders

export function encodeChat({ kind, id, from = -1, seq = 0 }) {
  requireInt(kind, 'kind');
  requireInt(id, 'id');
  requireInt(from, 'from');
  if (!isKnownMessage(kind, id)) {
    throw new SocialProtocolError('encode-range', `no such message ${kind}:${id}`);
  }
  if (from < -1 || from >= MAX_CHAT_SLOT) {
    throw new SocialProtocolError('encode-range', `from slot ${from} out of range`);
  }
  const buf = new ArrayBuffer(CHAT_BYTES);
  const view = new DataView(buf);
  writeHeader(view, SOC_CHAT, seq);
  view.setInt32(12, kind, true);
  view.setInt32(16, id, true);
  view.setInt32(20, from, true);
  return buf;
}

export function encodeSpectate({ want = true, seq = 0 } = {}) {
  const buf = new ArrayBuffer(SPECTATE_BYTES);
  const view = new DataView(buf);
  writeHeader(view, SOC_SPECTATE, seq);
  view.setInt32(12, want ? 1 : 0, true);
  return buf;
}

export function encodeSpectateAck({ granted, reason = SPECTATE_REASON.OK, seq = 0 }) {
  requireInt(reason, 'reason');
  if (!Object.values(SPECTATE_REASON).includes(reason)) {
    throw new SocialProtocolError('encode-range', `unknown spectate reason ${reason}`);
  }
  const buf = new ArrayBuffer(SPECTATE_ACK_BYTES);
  const view = new DataView(buf);
  writeHeader(view, SOC_SPECTATE_ACK, seq);
  view.setInt32(12, granted ? 1 : 0, true);
  view.setInt32(16, reason, true);
  return buf;
}

// ------------------------------------------------------------------- decoder

/**
 * Validate and decode one inbound social message.
 *
 * Throws SocialProtocolError with one of:
 *   not-binary, alignment, too-short, oversize, magic, version, type, length,
 *   chat-range, spectate-range
 */
export function decodeSocial(data, { maxMessageBytes = MAX_SOCIAL_BYTES } = {}) {
  const view = asDataView(data);
  const bytes = view.byteLength;

  if (bytes > maxMessageBytes) {
    throw new SocialProtocolError('oversize', `${bytes} bytes exceeds the ${maxMessageBytes} ceiling`);
  }
  if (bytes % 4 !== 0) {
    throw new SocialProtocolError('alignment', `${bytes} bytes is not a whole number of Int32 words`);
  }
  if (bytes < SOCIAL_HEADER_WORDS * 4) {
    throw new SocialProtocolError('too-short', `${bytes} bytes cannot hold a header`);
  }
  if (view.getInt32(0, true) !== SOCIAL_MAGIC) {
    throw new SocialProtocolError('magic', 'bad magic');
  }

  const typeVer = view.getInt32(4, true);
  const version = (typeVer >> 16) & 0xffff;
  const type = typeVer & 0xffff;
  if (version !== SOCIAL_VERSION) {
    throw new SocialProtocolError('version', `social version ${version} != ${SOCIAL_VERSION}`);
  }
  const seq = view.getUint32(8, true);

  if (type === SOC_CHAT) {
    if (bytes !== CHAT_BYTES) {
      throw new SocialProtocolError('length', `chat must be ${CHAT_BYTES} bytes, got ${bytes}`);
    }
    const kind = view.getInt32(12, true);
    const id = view.getInt32(16, true);
    if (kind !== CHAT_KIND.PHRASE && kind !== CHAT_KIND.EMOTE) {
      throw new SocialProtocolError('chat-range', `kind ${kind} is neither phrase nor emote`);
    }
    // The id is checked against the SAME table the renderer reads, so a peer
    // cannot name a phrase that does not exist and make the UI print undefined.
    if (!isKnownMessage(kind, id)) {
      throw new SocialProtocolError('chat-range', `no such message ${kind}:${id}`);
    }
    const from = view.getInt32(20, true);
    if (from < -1 || from >= MAX_CHAT_SLOT) {
      throw new SocialProtocolError('chat-range', `from slot ${from} out of range`);
    }
    return { type, seq, kind, id, from };
  }

  if (type === SOC_SPECTATE) {
    if (bytes !== SPECTATE_BYTES) {
      throw new SocialProtocolError('length', `spectate must be ${SPECTATE_BYTES} bytes, got ${bytes}`);
    }
    const flags = view.getInt32(12, true);
    if (flags < 0 || flags > 1) {
      throw new SocialProtocolError('spectate-range', `flags ${flags} outside 0..1`);
    }
    return { type, seq, want: flags === 1 };
  }

  if (type === SOC_SPECTATE_ACK) {
    if (bytes !== SPECTATE_ACK_BYTES) {
      throw new SocialProtocolError('length', `spectate ack must be ${SPECTATE_ACK_BYTES} bytes, got ${bytes}`);
    }
    const granted = view.getInt32(12, true);
    const reason = view.getInt32(16, true);
    if (granted < 0 || granted > 1) {
      throw new SocialProtocolError('spectate-range', `granted ${granted} outside 0..1`);
    }
    if (!Object.values(SPECTATE_REASON).includes(reason)) {
      throw new SocialProtocolError('spectate-range', `unknown reason ${reason}`);
    }
    return { type, seq, granted: granted === 1, reason };
  }

  throw new SocialProtocolError('type', `unknown message type ${type}`);
}
