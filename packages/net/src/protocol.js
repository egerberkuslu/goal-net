// Wire format for @goalnet/net. THIS FILE IS THE TRUST BOUNDARY.
//
// Everything that arrives from a DataChannel goes through `decodeMessage`, and
// nothing downstream is allowed to assume anything the decoder did not check.
// A malformed, oversized, stale or foreign-build message must fail here with a
// named code, never reach the simulation, and never throw something the caller
// cannot classify.
//
// Layout rules
//   * every message is a whole number of Int32 words, read through a DataView
//     with an explicit little-endian flag, so a big-endian host produces and
//     consumes the same bytes as a little-endian one
//   * word 2 always carries constantsHashInt; a peer running a different
//     physics table is refused instead of being allowed to desync quietly
//   * messages stay under MAX_MESSAGE_BYTES; a payload that does not fit is
//     chunked (see encodeSnapshotMessages)
//
// Common header (5 words, 20 bytes)
//   0  MAGIC 0x474e4e31 "GNN1"
//   1  (PROTOCOL_VERSION << 16) | type
//   2  constantsHashInt
//   3  seq                     uint32, monotone per sender per stream
//   4  tick                    int32
//
// HELLO   (peer -> host, lobby channel: ordered + reliable)   7 words / 28 B
//   5  playerId
//   6  flags                   bit0 = wantFull
//
// INPUT   (peer -> host, game channel: unordered + unreliable) 10 words / 40 B
//   5  playerId                must match the slot the host handed out
//   6  moveXFx                 Q16.16, |v| <= FX_ONE
//   7  moveZFx                 Q16.16, |v| <= FX_ONE
//   8  kick                    0 or 1
//   9  ackTick                 newest authoritative tick applied, -1 for none
//      header.seq  = input sequence number
//      header.tick = the tick the sender predicted this input onto
//
// SNAPSHOT (host -> peer, game channel)         (12 + playerCount) words + payload
//   5  baseTick                -1 = full, otherwise the tick this delta rides on
//   6  checksum                fnv1a over the WHOLE reconstructed state, int32
//   7  playerCount
//   8  chunkIndex
//   9  chunkCount
//  10  payloadWords            words carried by THIS chunk
//  11  totalPayloadWords       words across every chunk of this seq
//  12..12+playerCount-1        ackedInputSeq per player slot (uint32)
//   then payloadWords Int32s
//
// Full payload  = the core state buffer verbatim (stateLength(playerCount)).
// Delta payload = run-length over changed words:
//   [runCount, (start, length, value * length) * runCount]
// Runs are what the layout wants: a moving player dirties x, z, vx, vz as four
// consecutive words, so one 2-word run header covers four values. An idle world
// collapses to a single run holding the tick.

import {
  constantsHashInt,
  stateLength,
  fnv1aInts,
  toHex32,
  fx,
} from '../../core/src/index.js';

const FX_ONE = fx.FX_ONE;

export const NET_MAGIC = 0x474e4e31; // "GNN1"
export const PROTOCOL_VERSION = 1;

export const MSG_HELLO = 1;
export const MSG_INPUT = 2;
export const MSG_SNAPSHOT = 3;

/**
 * Ceiling for a single DataChannel message. The spec says "~16 KB"; 16000 keeps
 * a margin under the 16384 that SCTP implementations actually start fragmenting
 * at, so we never depend on the browser's own fragmentation.
 */
export const MAX_MESSAGE_BYTES = 16000;

/** Cap on the playerCount a message may claim. The core itself caps at 12. */
export const MAX_PROTOCOL_PLAYERS = 32;

// Core owns nine buttons (kick, charge, cancel, tackle, catch, throw, clear,
// dive, touch). The wire accepts that bitmask with headroom to 16 bits, so a
// tenth button does not need a protocol version bump.
export const BUTTON_MASK = 0xffff;

export const HEADER_WORDS = 5;
export const HELLO_WORDS = HEADER_WORDS + 2;
export const INPUT_WORDS = HEADER_WORDS + 5;
export const SNAPSHOT_FIXED_WORDS = HEADER_WORDS + 7;

export const HELLO_BYTES = HELLO_WORDS * 4;
export const INPUT_BYTES = INPUT_WORDS * 4;

/** Bytes of snapshot framing before the payload, for a given player count. */
export function snapshotHeaderBytes(playerCount) {
  return (SNAPSHOT_FIXED_WORDS + playerCount) * 4;
}

/** Payload words a single chunk can carry at the given message ceiling. */
export function snapshotChunkCapacity(playerCount, maxMessageBytes = MAX_MESSAGE_BYTES) {
  const cap = Math.floor((maxMessageBytes - snapshotHeaderBytes(playerCount)) / 4);
  if (cap < 1) {
    throw new ProtocolError(
      'message-ceiling',
      `maxMessageBytes ${maxMessageBytes} cannot hold a snapshot header for ${playerCount} players`,
    );
  }
  return cap;
}

/** Every rejection carries a stable `code` so callers can bucket it. */
export class ProtocolError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProtocolError';
    this.code = code;
  }
}

// ------------------------------------------------------------------ helpers

function asDataView(data) {
  if (data instanceof ArrayBuffer) return new DataView(data);
  if (ArrayBuffer.isView(data)) {
    return new DataView(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new ProtocolError('not-binary', 'message is neither ArrayBuffer nor ArrayBufferView');
}

function writeHeader(view, type, seq, tick) {
  view.setInt32(0, NET_MAGIC, true);
  view.setInt32(4, ((PROTOCOL_VERSION << 16) | type) | 0, true);
  view.setInt32(8, constantsHashInt, true);
  view.setUint32(12, seq >>> 0, true);
  view.setInt32(16, tick | 0, true);
}

function requireInt(v, name) {
  if (!Number.isInteger(v)) {
    throw new ProtocolError('encode-range', `${name} must be an integer, got ${v}`);
  }
  return v | 0;
}

/** Int32 digest of a whole state buffer. Same walk on both ends of the wire. */
export function stateChecksumInt(state) {
  return fnv1aInts(state) | 0;
}

/** Hex form of a checksum int, for logs and mismatch reports. */
export function checksumHex(int32) {
  return toHex32(int32 >>> 0);
}

// ------------------------------------------------------------------ encoders

export function encodeHello({ playerId, seq = 0, tick = -1, wantFull = true }) {
  requireInt(playerId, 'playerId');
  if (playerId < 0 || playerId >= MAX_PROTOCOL_PLAYERS) {
    throw new ProtocolError('encode-range', `playerId ${playerId} out of range`);
  }
  const buf = new ArrayBuffer(HELLO_BYTES);
  const view = new DataView(buf);
  writeHeader(view, MSG_HELLO, seq, tick);
  view.setInt32(20, playerId | 0, true);
  view.setInt32(24, wantFull ? 1 : 0, true);
  return buf;
}

// The kick word carries the whole button bitmask (core BTN.*). Bit 0 is the
// kick bit, so a peer that only knows about kicking still speaks the same
// wire format — the field simply widened under it.
export function encodeInput({
  playerId,
  seq,
  tick,
  moveXFx = 0,
  moveZFx = 0,
  kick = 0,
  buttons,
  ackTick = -1,
}) {
  requireInt(playerId, 'playerId');
  requireInt(tick, 'tick');
  requireInt(moveXFx, 'moveXFx');
  requireInt(moveZFx, 'moveZFx');
  if (playerId < 0 || playerId >= MAX_PROTOCOL_PLAYERS) {
    throw new ProtocolError('encode-range', `playerId ${playerId} out of range`);
  }
  if (moveXFx > FX_ONE || moveXFx < -FX_ONE || moveZFx > FX_ONE || moveZFx < -FX_ONE) {
    throw new ProtocolError('encode-range', 'move axis outside [-1, 1]');
  }
  const buf = new ArrayBuffer(INPUT_BYTES);
  const view = new DataView(buf);
  writeHeader(view, MSG_INPUT, seq, tick);
  view.setInt32(20, playerId | 0, true);
  view.setInt32(24, moveXFx | 0, true);
  view.setInt32(28, moveZFx | 0, true);
  const bits = buttons === undefined ? (kick ? 1 : 0) : (buttons | 0);
  if (bits < 0 || bits > BUTTON_MASK) {
    throw new ProtocolError('encode-range', `buttons ${bits} outside the mask`);
  }
  view.setInt32(32, bits, true);
  view.setInt32(36, ackTick | 0, true);
  return buf;
}

/**
 * Frame one snapshot, splitting into chunks when the payload does not fit.
 * Returns an array of ArrayBuffers, all sharing the same `seq`.
 */
export function encodeSnapshotMessages({
  seq,
  tick,
  baseTick,
  checksum,
  playerCount,
  ackSeqs,
  payload,
  maxMessageBytes = MAX_MESSAGE_BYTES,
}) {
  requireInt(tick, 'tick');
  requireInt(baseTick, 'baseTick');
  requireInt(playerCount, 'playerCount');
  if (playerCount < 1 || playerCount > MAX_PROTOCOL_PLAYERS) {
    throw new ProtocolError('encode-range', `playerCount ${playerCount} out of range`);
  }
  const words = payload instanceof Int32Array ? payload : Int32Array.from(payload);
  const capacity = snapshotChunkCapacity(playerCount, maxMessageBytes);
  const chunkCount = Math.max(1, Math.ceil(words.length / capacity));
  const headerWords = SNAPSHOT_FIXED_WORDS + playerCount;
  const out = [];

  for (let c = 0; c < chunkCount; c++) {
    const start = c * capacity;
    const len = Math.min(capacity, words.length - start);
    const buf = new ArrayBuffer((headerWords + len) * 4);
    const view = new DataView(buf);
    writeHeader(view, MSG_SNAPSHOT, seq, tick);
    view.setInt32(20, baseTick | 0, true);
    view.setInt32(24, checksum | 0, true);
    view.setInt32(28, playerCount | 0, true);
    view.setInt32(32, c, true);
    view.setInt32(36, chunkCount, true);
    view.setInt32(40, len, true);
    view.setInt32(44, words.length, true);
    for (let p = 0; p < playerCount; p++) {
      const a = ackSeqs && ackSeqs[p] != null ? ackSeqs[p] : 0;
      view.setUint32(48 + p * 4, a >>> 0, true);
    }
    const base = headerWords * 4;
    for (let j = 0; j < len; j++) {
      view.setInt32(base + j * 4, words[start + j] | 0, true);
    }
    out.push(buf);
  }
  return out;
}

// -------------------------------------------------------------------- delta

/**
 * Run-length encode the words of `next` that differ from `base`.
 *
 * A run is only broken by more than two identical words: closing a run costs a
 * 2-word header, so swallowing a 1 or 2 word island is never worse.
 */
export function encodeDeltaWords(base, next) {
  if (base.length !== next.length) {
    throw new ProtocolError('delta-length', 'delta base and target differ in length');
  }
  const out = [0];
  let runs = 0;
  const n = next.length;
  let i = 0;
  while (i < n) {
    if (next[i] === base[i]) {
      i++;
      continue;
    }
    const start = i;
    let end = i + 1;
    while (end < n) {
      if (next[end] !== base[end]) {
        end++;
        continue;
      }
      let k = end;
      while (k < n && next[k] === base[k]) k++;
      if (k - end > 2 || k === n) break;
      end = k;
    }
    out.push(start, end - start);
    for (let j = start; j < end; j++) out.push(next[j] | 0);
    runs++;
    i = end;
  }
  out[0] = runs;
  return Int32Array.from(out);
}

/** Rebuild a state from a base and a run-length delta. Validates every run. */
export function applyDeltaWords(base, runs) {
  if (runs.length < 1) {
    throw new ProtocolError('delta-truncated', 'delta payload carries no run count');
  }
  const runCount = runs[0];
  if (runCount < 0 || runCount > base.length) {
    throw new ProtocolError('delta-range', `implausible run count ${runCount}`);
  }
  const out = Int32Array.from(base);
  let p = 1;
  for (let r = 0; r < runCount; r++) {
    if (p + 2 > runs.length) {
      throw new ProtocolError('delta-truncated', 'delta ends inside a run header');
    }
    const start = runs[p++];
    const len = runs[p++];
    if (start < 0 || len <= 0 || start + len > out.length) {
      throw new ProtocolError('delta-range', `run ${start}+${len} escapes the state buffer`);
    }
    if (p + len > runs.length) {
      throw new ProtocolError('delta-truncated', 'delta ends inside a run body');
    }
    for (let j = 0; j < len; j++) out[start + j] = runs[p++] | 0;
  }
  if (p !== runs.length) {
    throw new ProtocolError('delta-trailing', `${runs.length - p} trailing words after the last run`);
  }
  return out;
}

// ------------------------------------------------------------------ decoder

/**
 * Validate and decode one inbound message.
 *
 * Throws ProtocolError with one of:
 *   not-binary, alignment, too-short, oversize, magic, version, type,
 *   constants-hash, length, input-range, snapshot-range, chunk-range
 */
export function decodeMessage(data, { maxMessageBytes = MAX_MESSAGE_BYTES } = {}) {
  const view = asDataView(data);
  const bytes = view.byteLength;

  if (bytes > maxMessageBytes) {
    throw new ProtocolError('oversize', `${bytes} bytes exceeds the ${maxMessageBytes} ceiling`);
  }
  if (bytes % 4 !== 0) {
    throw new ProtocolError('alignment', `${bytes} bytes is not a whole number of Int32 words`);
  }
  if (bytes < HEADER_WORDS * 4) {
    throw new ProtocolError('too-short', `${bytes} bytes cannot hold a header`);
  }
  if (view.getInt32(0, true) !== NET_MAGIC) {
    throw new ProtocolError('magic', 'bad magic');
  }

  const typeVer = view.getInt32(4, true);
  const version = (typeVer >> 16) & 0xffff;
  const type = typeVer & 0xffff;
  if (version !== PROTOCOL_VERSION) {
    throw new ProtocolError('version', `protocol version ${version} != ${PROTOCOL_VERSION}`);
  }
  if (view.getInt32(8, true) !== constantsHashInt) {
    throw new ProtocolError(
      'constants-hash',
      'constantsHash mismatch — the sender runs a different physics build',
    );
  }

  const seq = view.getUint32(12, true);
  const tick = view.getInt32(16, true);

  if (type === MSG_HELLO) {
    if (bytes !== HELLO_BYTES) {
      throw new ProtocolError('length', `hello must be ${HELLO_BYTES} bytes, got ${bytes}`);
    }
    const playerId = view.getInt32(20, true);
    if (playerId < 0 || playerId >= MAX_PROTOCOL_PLAYERS) {
      throw new ProtocolError('input-range', `playerId ${playerId} out of range`);
    }
    return { type, seq, tick, playerId, wantFull: (view.getInt32(24, true) & 1) === 1 };
  }

  if (type === MSG_INPUT) {
    if (bytes !== INPUT_BYTES) {
      throw new ProtocolError('length', `input must be ${INPUT_BYTES} bytes, got ${bytes}`);
    }
    const playerId = view.getInt32(20, true);
    const moveXFx = view.getInt32(24, true);
    const moveZFx = view.getInt32(28, true);
    const kick = view.getInt32(32, true);
    const ackTick = view.getInt32(36, true);
    if (playerId < 0 || playerId >= MAX_PROTOCOL_PLAYERS) {
      throw new ProtocolError('input-range', `playerId ${playerId} out of range`);
    }
    if (moveXFx > FX_ONE || moveXFx < -FX_ONE || moveZFx > FX_ONE || moveZFx < -FX_ONE) {
      throw new ProtocolError(
        'input-range',
        `move axis (${moveXFx}, ${moveZFx}) outside [-${FX_ONE}, ${FX_ONE}]`,
      );
    }
    if (kick < 0 || kick > BUTTON_MASK) {
      throw new ProtocolError('input-range', `buttons ${kick} outside the mask`);
    }
    if (tick < 0) {
      throw new ProtocolError('input-range', `input tick ${tick} is negative`);
    }
    if (ackTick < -1) {
      throw new ProtocolError('input-range', `ackTick ${ackTick} is below -1`);
    }
    // `kick` stays in the payload for callers that only care about bit 0;
    // `buttons` is the same word, unmasked.
    return {
      type, seq, tick, playerId, moveXFx, moveZFx,
      kick: kick & 1, buttons: kick, ackTick,
    };
  }

  if (type === MSG_SNAPSHOT) {
    if (bytes < SNAPSHOT_FIXED_WORDS * 4) {
      throw new ProtocolError('length', 'snapshot shorter than its fixed header');
    }
    const baseTick = view.getInt32(20, true);
    const checksum = view.getInt32(24, true);
    const playerCount = view.getInt32(28, true);
    const chunkIndex = view.getInt32(32, true);
    const chunkCount = view.getInt32(36, true);
    const payloadWords = view.getInt32(40, true);
    const totalPayloadWords = view.getInt32(44, true);

    if (playerCount < 1 || playerCount > MAX_PROTOCOL_PLAYERS) {
      throw new ProtocolError('snapshot-range', `playerCount ${playerCount} out of range`);
    }
    if (tick < 0) {
      throw new ProtocolError('snapshot-range', `snapshot tick ${tick} is negative`);
    }
    if (baseTick < -1 || baseTick >= tick + 1) {
      throw new ProtocolError('snapshot-range', `baseTick ${baseTick} not behind tick ${tick}`);
    }
    if (chunkCount < 1 || chunkIndex < 0 || chunkIndex >= chunkCount) {
      throw new ProtocolError('chunk-range', `chunk ${chunkIndex}/${chunkCount} is impossible`);
    }
    if (payloadWords < 0 || totalPayloadWords < 0 || payloadWords > totalPayloadWords) {
      throw new ProtocolError('chunk-range', 'chunk claims more words than the whole payload');
    }
    const headerWords = SNAPSHOT_FIXED_WORDS + playerCount;
    if (bytes !== (headerWords + payloadWords) * 4) {
      throw new ProtocolError(
        'length',
        `snapshot says ${payloadWords} payload words but carries ${bytes / 4 - headerWords}`,
      );
    }
    if (baseTick === -1 && totalPayloadWords !== stateLength(playerCount)) {
      throw new ProtocolError(
        'snapshot-range',
        `full snapshot must carry ${stateLength(playerCount)} words, claims ${totalPayloadWords}`,
      );
    }

    const ackSeqs = new Uint32Array(playerCount);
    for (let p = 0; p < playerCount; p++) ackSeqs[p] = view.getUint32(48 + p * 4, true);

    const payload = new Int32Array(payloadWords);
    const base = headerWords * 4;
    for (let j = 0; j < payloadWords; j++) payload[j] = view.getInt32(base + j * 4, true);

    return {
      type,
      seq,
      tick,
      baseTick,
      checksum,
      playerCount,
      chunkIndex,
      chunkCount,
      payloadWords,
      totalPayloadWords,
      ackSeqs,
      payload,
    };
  }

  throw new ProtocolError('type', `unknown message type ${type}`);
}
