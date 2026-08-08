// The replay container. THIS FILE IS THE TRUST BOUNDARY for replay bytes.
//
// brain/20-tech-spec/replay-format.md: a replay is input-only. There is no
// recorded ball trajectory, no recorded score, nothing a viewer could disagree
// with — playback is the core running the same quantised inputs from the same
// starting state, and determinism (ADR-0003) does the rest. So the container
// carries exactly two things: enough header to rebuild the world, and the
// per-tick input stream.
//
// Refusal, not "best effort"
//   A replay whose constantsHash does not match the running build was produced
//   by a different physics table; a replay whose settingsHash does not match
//   the settings it is being played under is a different room (ADR-0005). Both
//   are refused here with a ReplayError carrying a stable `code`. Playing them
//   anyway would draw a match that never happened, which is strictly worse than
//   showing the user "this replay belongs to an older build".
//
// ------------------------------------------------------------------- layout
//
// Little-endian throughout, read through a DataView with an explicit flag, so a
// big-endian host produces and consumes the same bytes.
//
// HEADER, 64 bytes
//    0  u32  MAGIC 0x474e5231 "GNR1"
//    4  u32  FORMAT_VERSION
//    8  i32  constantsHashInt      the physics table this was recorded on
//   12  i32  settingsHashInt       the room it was recorded in
//   16  i32 x6  encodeSettings()   duration, scoreLimit, pitch, flags, hash, 0
//   40  i32  startTick             tick of the first recorded input
//   44  i32  tickRate              60; recorded so a future rate is not silent
//   48  i32  playerCount
//   52  i32  tickCount             number of recorded ticks
//   56  i32  keyframeInterval      0 = no keyframe section
//   60  i32  chainDigest           fnv1a over the per-tick checksum chain
//
// ROSTER, playerCount bytes (padded to 4)
//   one byte per slot: bit0 team (0/1), bit1 role (0 field, 1 keeper).
//   Bits 2..7 are reserved and MUST be zero — a future field cannot be
//   mistaken for a keeper.
//
// SECTIONS, TLV, repeated until the trailer
//   u32 kind, u32 byteLength, payload padded to 4 bytes
//     1 INPUTS      per-player delta+RLE stream (see encodeInputs)
//     2 MARKS       event marks for the highlight pass
//     3 KEYFRAMES   serialize() snapshots, the seek index
//     4 CHECKSUMS   the full per-tick chain (optional, 4 B/tick)
//   An unknown kind is skipped, not guessed at: the sections that matter are
//   validated by presence, so a v2 writer can add one without breaking v1.
//
// TRAILER, 8 bytes
//   u32 END_MAGIC 0x474e5245 "GNRE"
//   u32 fnv1a over every preceding byte, including END_MAGIC
//   A truncated file fails the length arithmetic or this digest. It never
//   half-loads.
//
// ------------------------------------------------------- why input deltas
//
// An input is two Q16.16 axes plus a 9-bit button mask: 10 bytes raw. Nearly
// every tick repeats the previous one (a human holds a key for 20 ticks; a bot
// recomputes its target every 4-12 ticks and steers smoothly in between), so
// the stream is run-length coded per player and the axes are stored as zigzag
// varint deltas. A held direction costs ~4 bytes per CHANGE instead of 10 bytes
// per TICK; smooth bot steering costs ~6.

import {
  FIELD,
  constantsHash as buildConstantsHash,
  constantsHashInt as buildConstantsHashInt,
  encodeSettings,
  decodeSettings,
  fnv1aInts,
  normaliseSettings,
  playerOffset,
  sameSettings,
  settingsHash as settingsHashOf,
  settingsHashInt,
  stateLength,
  toHex32,
  TICK_RATE,
} from '../../core/src/index.js';

export const REPLAY_MAGIC = 0x474e5231; // "GNR1"
export const REPLAY_END_MAGIC = 0x474e5245; // "GNRE"
export const FORMAT_VERSION = 1;

export const HEADER_BYTES = 64;
export const TRAILER_BYTES = 8;

export const SECTION_INPUTS = 1;
export const SECTION_MARKS = 2;
export const SECTION_KEYFRAMES = 3;
export const SECTION_CHECKSUMS = 4;

/** Raw bytes one tick of one player's input would cost with no encoding. */
export const RAW_INPUT_BYTES = 10; // moveXFx + moveZFx + buttons(u16)

/** Default keyframe cadence: 600 ticks = 10 s, straight out of replay-format.md. */
export const DEFAULT_KEYFRAME_INTERVAL = 600;

/**
 * Event marks. The kind is one byte on the wire and the meaning of v0/v1 is
 * fixed per kind, so a reader never has to guess.
 *
 *   GOAL      player = scorer or -1,  v0 = scoring team
 *   SAVE      player = keeper,        v0 = ball speed x100 at the save
 *   CATCH     player = keeper,        v0 = ball speed x100
 *   WOODWORK  player = last toucher,  v0 = ball speed x100, v1 = distance to
 *                                     the goal centre in units
 *   SHOT      player = striker,       v0 = power x100, v1 = distance to the
 *                                     opponent goal centre in units
 *   MATCH_END player = -1,            v0 = end reason code
 */
export const MARK = Object.freeze({
  GOAL: 1,
  SAVE: 2,
  CATCH: 3,
  WOODWORK: 4,
  SHOT: 5,
  MATCH_END: 6,
});

export const MARK_NAMES = Object.freeze({
  1: 'goal',
  2: 'save',
  3: 'catch',
  4: 'woodwork',
  5: 'shot',
  6: 'match-end',
});

/** Every refusal carries a stable `code` so a caller can bucket it. */
export class ReplayError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReplayError';
    this.code = code;
  }
}

// ------------------------------------------------------------------ varints

/** Growable little byte sink. One array, doubled; no per-write allocation. */
export function createWriter(initial = 1024) {
  let buf = new Uint8Array(initial);
  let len = 0;
  function need(extra) {
    if (len + extra <= buf.length) return;
    let next = buf.length * 2;
    while (next < len + extra) next *= 2;
    const grown = new Uint8Array(next);
    grown.set(buf.subarray(0, len));
    buf = grown;
  }
  return {
    get length() {
      return len;
    },
    u8(v) {
      need(1);
      buf[len++] = v & 0xff;
    },
    u32(v) {
      need(4);
      buf[len++] = v & 0xff;
      buf[len++] = (v >>> 8) & 0xff;
      buf[len++] = (v >>> 16) & 0xff;
      buf[len++] = (v >>> 24) & 0xff;
    },
    i32(v) {
      this.u32(v | 0);
    },
    /** LEB128, unsigned. Values above 2^32-1 are not representable on purpose. */
    varint(v) {
      let x = v >>> 0;
      need(5);
      while (x >= 0x80) {
        buf[len++] = (x & 0x7f) | 0x80;
        x >>>= 7;
      }
      buf[len++] = x;
    },
    /** Zigzag then LEB128, so small negative deltas stay one byte. */
    svarint(v) {
      this.varint(((v << 1) ^ (v >> 31)) >>> 0);
    },
    bytes(src) {
      need(src.length);
      buf.set(src, len);
      len += src.length;
    },
    pad4() {
      while (len % 4 !== 0) this.u8(0);
    },
    take() {
      return buf.subarray(0, len);
    },
  };
}

/** Reader over a byte range. Every read is bounds-checked; nothing wraps. */
export function createReader(bytes, start = 0, end = bytes.length) {
  let p = start;
  function need(n, what) {
    if (p + n > end) {
      throw new ReplayError('truncated', `replay ends inside ${what}`);
    }
  }
  return {
    get offset() {
      return p;
    },
    get remaining() {
      return end - p;
    },
    u8(what = 'a byte') {
      need(1, what);
      return bytes[p++];
    },
    u32(what = 'a word') {
      need(4, what);
      const v =
        (bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24)) >>> 0;
      p += 4;
      return v;
    },
    i32(what = 'a word') {
      return this.u32(what) | 0;
    },
    varint(what = 'a varint') {
      let shift = 0;
      let out = 0;
      for (;;) {
        need(1, what);
        const b = bytes[p++];
        out += (b & 0x7f) * 2 ** shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
        if (shift > 28) throw new ReplayError('bad-varint', `varint in ${what} is too long`);
      }
      return out >>> 0;
    },
    svarint(what = 'a varint') {
      const u = this.varint(what);
      return (u >>> 1) ^ -(u & 1);
    },
    skip(n, what = 'a section') {
      need(n, what);
      p += n;
    },
    align4(what = 'padding') {
      while (p % 4 !== 0) this.u8(what);
    },
  };
}

// ------------------------------------------------------------------ hashing

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** fnv1a over raw bytes, as an unsigned 32-bit int. */
export function fnv1aBytes(bytes, start = 0, end = bytes.length, seed = FNV_OFFSET) {
  let h = seed >>> 0;
  for (let i = start; i < end; i++) {
    h ^= bytes[i];
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}

/**
 * Rolling digest of a per-tick checksum chain. Folding the chain into one word
 * costs 4 bytes instead of 4 bytes per tick and still catches any divergence:
 * a single differing tick changes the digest.
 */
export function chainDigestOf(checksums, count = checksums.length) {
  return fnv1aInts(checksums.subarray ? checksums.subarray(0, count) : checksums.slice(0, count)) | 0;
}

// ------------------------------------------------------------------ roster

function encodeRosterByte(slot) {
  const team = slot && slot.team ? 1 : 0;
  const role = slot && (slot.role === 1 || slot.role === true || slot.role === 'keeper') ? 1 : 0;
  return team | (role << 1);
}

function decodeRosterByte(b, i) {
  if ((b & ~3) !== 0) {
    throw new ReplayError('roster', `roster byte for slot ${i} carries unknown bits (${b})`);
  }
  return { team: b & 1, role: (b >> 1) & 1 };
}

// ------------------------------------------------------------- input stream

/**
 * One player's inputs -> delta+RLE bytes.
 *
 *   record := u8 ctrl, [varint runLength], [svarint dmx][svarint dmz][varint buttons]
 *   ctrl bit0 = mx changed, bit1 = mz changed, bit2 = buttons changed,
 *        bit3 = a run varint follows (absent means this value covers one tick)
 *
 * The record holds a value and the number of ticks it covers. A record is only
 * emitted when something changed, so ctrl is never 0 after the first, and the
 * decoder can assert exactly tickCount ticks were produced. Bit 3 is what makes
 * the two input styles cost the right thing: a bot that steers every tick pays
 * no run byte at all, and a human holding a key pays one for forty ticks.
 */
export function encodePlayerStream(w, mx, mz, buttons, tickCount, stride, slot) {
  let prevX = 0;
  let prevZ = 0;
  let prevB = 0;
  let t = 0;
  while (t < tickCount) {
    const i = t * stride + slot;
    const cx = mx[i];
    const cz = mz[i];
    const cb = buttons[i];
    let run = 1;
    while (t + run < tickCount) {
      const j = (t + run) * stride + slot;
      if (mx[j] !== cx || mz[j] !== cz || buttons[j] !== cb) break;
      run++;
    }
    let ctrl = 0;
    if (cx !== prevX) ctrl |= 1;
    if (cz !== prevZ) ctrl |= 2;
    if (cb !== prevB) ctrl |= 4;
    if (run > 1) ctrl |= 8;
    w.u8(ctrl);
    if (run > 1) w.varint(run);
    if (ctrl & 1) w.svarint(cx - prevX);
    if (ctrl & 2) w.svarint(cz - prevZ);
    if (ctrl & 4) w.varint(cb);
    prevX = cx;
    prevZ = cz;
    prevB = cb;
    t += run;
  }
}

function decodePlayerStream(r, mx, mz, buttons, tickCount, stride, slot, end) {
  let prevX = 0;
  let prevZ = 0;
  let prevB = 0;
  let t = 0;
  while (t < tickCount) {
    if (r.offset >= end) {
      throw new ReplayError('truncated', `input stream for slot ${slot} ends after ${t}/${tickCount} ticks`);
    }
    const ctrl = r.u8('an input control byte');
    if ((ctrl & ~15) !== 0) {
      throw new ReplayError('bad-ctrl', `input control byte ${ctrl} for slot ${slot} has unknown bits`);
    }
    const run = ctrl & 8 ? r.varint('an input run') : 1;
    if (run < 2 && ctrl & 8) {
      throw new ReplayError('bad-run', `input run length ${run} for slot ${slot} should not be spelled out`);
    }
    if (t + run > tickCount) {
      throw new ReplayError(
        'bad-run',
        `input run for slot ${slot} overruns the recorded ${tickCount} ticks`,
      );
    }
    if (ctrl & 1) prevX += r.svarint('an axis delta');
    if (ctrl & 2) prevZ += r.svarint('an axis delta');
    if (ctrl & 4) prevB = r.varint('a button mask');
    if (prevX < -65536 || prevX > 65536 || prevZ < -65536 || prevZ > 65536) {
      throw new ReplayError('bad-axis', `slot ${slot} axis outside +/-1 at tick ${t}`);
    }
    if (prevB > 0xffff) {
      throw new ReplayError('bad-buttons', `slot ${slot} button mask ${prevB} is out of range`);
    }
    for (let k = 0; k < run; k++) {
      const i = (t + k) * stride + slot;
      mx[i] = prevX;
      mz[i] = prevZ;
      buttons[i] = prevB;
    }
    t += run;
  }
}

// ------------------------------------------------------------------ encode

/**
 * container -> Uint8Array.
 *
 * The container is the plain object a recorder produces; see recorder.js for
 * the field-by-field description. Everything written here is derived from it,
 * so encode(decode(bytes)) is byte-identical.
 */
export function encode(container) {
  const {
    settings,
    startTick = 0,
    tickRate = TICK_RATE,
    playerCount,
    tickCount,
    roster,
    inputs,
    marks = [],
    keyframes = [],
    keyframeInterval = 0,
    checksums = null,
    chainDigest = 0,
    constantsHash = buildConstantsHash,
  } = container;

  if (!Array.isArray(roster) || roster.length !== playerCount) {
    throw new ReplayError('roster', 'roster length does not match playerCount');
  }
  const canon = normaliseSettings(settings);
  const w = createWriter(4096 + tickCount * 4);

  const settingWords = encodeSettings(canon);
  w.u32(REPLAY_MAGIC);
  w.u32(FORMAT_VERSION);
  w.i32(parseInt(constantsHash, 16) | 0);
  w.i32(settingsHashInt(canon));
  for (let i = 0; i < settingWords.length; i++) w.i32(settingWords[i]);
  w.i32(startTick);
  w.i32(tickRate);
  w.i32(playerCount);
  w.i32(tickCount);
  w.i32(keyframes.length ? keyframeInterval : 0);
  w.i32(chainDigest | 0);
  for (let i = 0; i < playerCount; i++) w.u8(encodeRosterByte(roster[i]));
  w.pad4();

  // --- inputs
  const inner = createWriter(1024 + tickCount * playerCount * 4);
  for (let slot = 0; slot < playerCount; slot++) {
    const sub = createWriter(256 + tickCount * 3);
    encodePlayerStream(sub, inputs.mx, inputs.mz, inputs.buttons, tickCount, playerCount, slot);
    const bytes = sub.take();
    inner.varint(bytes.length);
    inner.bytes(bytes);
  }
  writeSection(w, SECTION_INPUTS, inner.take());

  // --- marks
  if (marks.length) {
    const m = createWriter(16 + marks.length * 8);
    m.varint(marks.length);
    let prevTick = startTick;
    for (const mark of marks) {
      if (mark.tick < prevTick) {
        throw new ReplayError('marks', 'marks must be written in tick order');
      }
      m.varint(mark.tick - prevTick);
      m.u8(mark.kind);
      m.u8((mark.player == null ? -1 : mark.player) + 1);
      m.svarint(mark.v0 | 0);
      m.svarint(mark.v1 | 0);
      prevTick = mark.tick;
    }
    writeSection(w, SECTION_MARKS, m.take());
  }

  // --- keyframes
  if (keyframes.length) {
    const words = stateLength(playerCount);
    const k = createWriter(16 + keyframes.length * (words * 4 + 8));
    k.varint(keyframes.length);
    for (const kf of keyframes) {
      if (kf.state.length !== words) {
        throw new ReplayError('keyframe', `keyframe at tick ${kf.tick} has the wrong state length`);
      }
      k.varint(kf.tick - startTick);
      for (let i = 0; i < words; i++) k.i32(kf.state[i]);
    }
    writeSection(w, SECTION_KEYFRAMES, k.take());
  }

  // --- full checksum chain (opt-in; 4 bytes per tick)
  if (checksums) {
    const c = createWriter(8 + tickCount * 4);
    c.varint(tickCount);
    for (let i = 0; i < tickCount; i++) c.i32(checksums[i]);
    writeSection(w, SECTION_CHECKSUMS, c.take());
  }

  w.u32(REPLAY_END_MAGIC);
  const body = w.take();
  const digest = fnv1aBytes(body, 0, body.length);
  w.u32(digest);
  return Uint8Array.from(w.take());
}

function writeSection(w, kind, payload) {
  w.u32(kind);
  w.u32(payload.length);
  w.bytes(payload);
  w.pad4();
}

// ------------------------------------------------------------------ decode

/**
 * bytes -> container, or a ReplayError.
 *
 * `expect.constantsHash` and `expect.settings` default to the RUNNING build and
 * to whatever the replay itself claims. Pass `expect.settings` to assert the
 * replay belongs to the room you are about to play it in; pass
 * `expect.allowForeignBuild` only in a tool that is inspecting bytes rather
 * than simulating them.
 */
export function decode(input, expect = {}) {
  const bytes = asBytes(input);
  if (bytes.length < HEADER_BYTES + TRAILER_BYTES) {
    throw new ReplayError('short', `replay is ${bytes.length} bytes, shorter than an empty container`);
  }
  if (bytes.length % 4 !== 0) {
    throw new ReplayError('short', `replay length ${bytes.length} is not a whole number of words`);
  }
  const head = createReader(bytes, 0, HEADER_BYTES);
  if (head.u32('the magic') !== REPLAY_MAGIC) {
    throw new ReplayError('bad-magic', 'not a replay: magic word is not GNR1');
  }
  const version = head.u32('the format version');
  if (version !== FORMAT_VERSION) {
    throw new ReplayError(
      'bad-version',
      `replay format version ${version} != ${FORMAT_VERSION} — this build cannot read it`,
    );
  }

  // Integrity before interpretation: a corrupt file must not get as far as
  // allocating buffers off a length word it damaged.
  const endReader = createReader(bytes, bytes.length - TRAILER_BYTES, bytes.length);
  if (endReader.u32('the end magic') !== REPLAY_END_MAGIC) {
    throw new ReplayError('corrupt', 'replay is truncated or damaged: end marker missing');
  }
  const claimed = endReader.u32('the trailer digest');
  const actual = fnv1aBytes(bytes, 0, bytes.length - 4);
  if (claimed !== actual) {
    throw new ReplayError(
      'corrupt',
      `replay digest ${toHex32(claimed)} != ${toHex32(actual)}: the bytes were damaged in transit`,
    );
  }

  const constantsHashInt = head.i32('the constants hash');
  const settingsHashWord = head.i32('the settings hash');
  const settingWords = new Int32Array(6);
  for (let i = 0; i < 6; i++) settingWords[i] = head.i32('the settings words');
  const startTick = head.i32('the start tick');
  const tickRate = head.i32('the tick rate');
  const playerCount = head.i32('the player count');
  const tickCount = head.i32('the tick count');
  const keyframeInterval = head.i32('the keyframe interval');
  const chainDigest = head.i32('the chain digest');

  const expectedConst =
    expect.constantsHash === undefined ? buildConstantsHashInt : parseInt(expect.constantsHash, 16) | 0;
  if (!expect.allowForeignBuild && constantsHashInt !== expectedConst) {
    throw new ReplayError(
      'constants-hash',
      `this replay was recorded on physics build ${toHex32(constantsHashInt >>> 0)}, this build is ${toHex32(
        expectedConst >>> 0,
      )} — refusing to play it`,
    );
  }

  let settings;
  try {
    settings = decodeSettings(settingWords);
  } catch (err) {
    // matchRules already names the fault (bad-pitch, bad-flags, settings-hash,
    // ...); keeping its code means a caller buckets a replay exactly the way it
    // buckets the same fault arriving over the wire
    throw new ReplayError(err.code || 'settings', `replay settings are not valid: ${err.message}`);
  }
  if (settingsHashWord !== settingsHashInt(settings)) {
    throw new ReplayError(
      'settings-hash',
      'replay settings hash does not match its own settings words',
    );
  }
  if (expect.settings !== undefined && !sameSettings(expect.settings, settings)) {
    throw new ReplayError(
      'settings-hash',
      `this replay was recorded in a different room (${settingsHashOf(settings)} vs ${settingsHashOf(
        expect.settings,
      )}) — refusing to play it`,
    );
  }
  if (tickRate !== TICK_RATE) {
    throw new ReplayError('tick-rate', `replay runs at ${tickRate} Hz, this build runs at ${TICK_RATE}`);
  }
  if (playerCount < 1 || playerCount > 32) {
    throw new ReplayError('player-count', `replay claims ${playerCount} players`);
  }
  if (tickCount < 0 || tickCount > 60 * 60 * 60 * 4) {
    throw new ReplayError('tick-count', `replay claims ${tickCount} ticks`);
  }

  const rosterReader = createReader(bytes, HEADER_BYTES, bytes.length - TRAILER_BYTES);
  const roster = [];
  for (let i = 0; i < playerCount; i++) {
    roster.push(decodeRosterByte(rosterReader.u8('the roster'), i));
  }
  rosterReader.align4('the roster padding');

  const body = createReader(bytes, rosterReader.offset, bytes.length - TRAILER_BYTES);
  const stride = playerCount;
  const total = tickCount * stride;
  const inputs = {
    mx: new Int32Array(total),
    mz: new Int32Array(total),
    buttons: new Int32Array(total),
  };
  let sawInputs = false;
  const marks = [];
  const keyframes = [];
  let checksums = null;

  while (body.remaining > 0) {
    if (body.remaining < 8) {
      throw new ReplayError('truncated', 'replay ends inside a section header');
    }
    const kind = body.u32('a section kind');
    const len = body.u32('a section length');
    const start = body.offset;
    const padded = len + ((4 - (len % 4)) % 4);
    if (body.remaining < padded) {
      throw new ReplayError('truncated', `section ${kind} claims ${len} bytes but the file ends first`);
    }
    const end = start + len;
    const sec = createReader(bytes, start, end);
    if (kind === SECTION_INPUTS) {
      for (let slot = 0; slot < playerCount; slot++) {
        const subLen = sec.varint('an input stream length');
        const subEnd = sec.offset + subLen;
        if (subEnd > end) {
          throw new ReplayError('truncated', `input stream for slot ${slot} runs past its section`);
        }
        const sub = createReader(bytes, sec.offset, subEnd);
        decodePlayerStream(sub, inputs.mx, inputs.mz, inputs.buttons, tickCount, stride, slot, subEnd);
        if (sub.remaining !== 0) {
          throw new ReplayError('bad-run', `input stream for slot ${slot} has ${sub.remaining} trailing bytes`);
        }
        sec.skip(subLen, 'an input stream');
      }
      sawInputs = true;
    } else if (kind === SECTION_MARKS) {
      const count = sec.varint('the mark count');
      let tick = startTick;
      for (let i = 0; i < count; i++) {
        tick += sec.varint('a mark tick');
        const markKind = sec.u8('a mark kind');
        if (!MARK_NAMES[markKind]) {
          throw new ReplayError('marks', `mark ${i} has unknown kind ${markKind}`);
        }
        const player = sec.u8('a mark player') - 1;
        const v0 = sec.svarint('a mark value');
        const v1 = sec.svarint('a mark value');
        if (player < -1 || player >= playerCount) {
          throw new ReplayError('marks', `mark ${i} names player ${player}`);
        }
        if (tick < startTick || tick > startTick + tickCount) {
          throw new ReplayError('marks', `mark ${i} sits at tick ${tick}, outside the recording`);
        }
        marks.push({ tick, kind: markKind, player, v0, v1 });
      }
    } else if (kind === SECTION_KEYFRAMES) {
      const count = sec.varint('the keyframe count');
      const words = stateLength(playerCount);
      for (let i = 0; i < count; i++) {
        const tick = startTick + sec.varint('a keyframe tick');
        const state = new Int32Array(words);
        for (let j = 0; j < words; j++) state[j] = sec.i32('a keyframe word');
        if (tick < startTick || tick > startTick + tickCount) {
          throw new ReplayError('keyframe', `keyframe ${i} sits at tick ${tick}, outside the recording`);
        }
        // The header roster and the snapshot roster are two copies of the same
        // fact. If they disagree, one of them was edited: a swapped team byte
        // would otherwise be silently ignored (playback starts from the
        // snapshot) and the viewer would read the wrong name on the scorer.
        for (let slot = 0; slot < playerCount; slot++) {
          const o = playerOffset(slot);
          if (state[o + FIELD.P_TEAM] !== roster[slot].team || state[o + FIELD.P_ROLE] !== roster[slot].role) {
            throw new ReplayError(
              'roster',
              `roster slot ${slot} disagrees with the keyframe at tick ${tick}`,
            );
          }
        }
        keyframes.push({ tick, state });
      }
    } else if (kind === SECTION_CHECKSUMS) {
      const count = sec.varint('the checksum count');
      if (count !== tickCount) {
        throw new ReplayError('checksums', `checksum section holds ${count} entries for ${tickCount} ticks`);
      }
      checksums = new Int32Array(count);
      for (let i = 0; i < count; i++) checksums[i] = sec.i32('a checksum');
    }
    body.skip(padded, 'a section');
  }

  if (!sawInputs && tickCount > 0) {
    throw new ReplayError('truncated', 'replay carries no input section');
  }

  return {
    version,
    constantsHash: toHex32(constantsHashInt >>> 0),
    settingsHash: settingsHashOf(settings),
    settings,
    startTick,
    tickRate,
    playerCount,
    tickCount,
    roster,
    inputs,
    marks,
    keyframes,
    keyframeInterval,
    checksums,
    chainDigest,
  };
}

function asBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new ReplayError('not-binary', 'replay is neither a Uint8Array nor an ArrayBuffer');
}

/**
 * The one input a player needs from a container: the input triple for a tick.
 * Returns the pre-quantised shape the core takes, reusing `out` so playback
 * allocates nothing per tick.
 */
export function inputsAt(container, tick, out) {
  const i = tick - container.startTick;
  if (i < 0 || i >= container.tickCount) return null;
  const n = container.playerCount;
  const dst = out || new Array(n);
  for (let slot = 0; slot < n; slot++) {
    const j = i * n + slot;
    let entry = dst[slot];
    if (!entry) {
      entry = { moveXFx: 0, moveZFx: 0, buttons: 0 };
      dst[slot] = entry;
    }
    entry.moveXFx = container.inputs.mx[j];
    entry.moveZFx = container.inputs.mz[j];
    entry.buttons = container.inputs.buttons[j];
  }
  return dst;
}

/** Bytes the same recording would cost with no encoding at all. */
export function rawInputBytes(container) {
  return container.tickCount * container.playerCount * RAW_INPUT_BYTES;
}

/** Per-section byte sizes of an encoded container, for reporting. */
export function measure(container) {
  const bytes = encode(container);
  const withoutKeyframes = container.keyframes && container.keyframes.length
    ? encode({ ...container, keyframes: [] }).length
    : bytes.length;
  return {
    total: bytes.length,
    header: HEADER_BYTES + container.playerCount + ((4 - (container.playerCount % 4)) % 4),
    keyframes: bytes.length - withoutKeyframes,
    withoutKeyframes,
    raw: rawInputBytes(container),
    bytesPerTick: container.tickCount ? bytes.length / container.tickCount : 0,
  };
}
