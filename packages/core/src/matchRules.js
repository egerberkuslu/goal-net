// Match settings and the rules that read them: pitch presets (matrix #28),
// golden goal (#26), mercy rule (#27) and the host-canonical settings object
// the net layer broadcasts (#29).
//
// Nothing here is a physics constant. The LOCKED table in constants.js is the
// build's identity (constantsHash); a MatchSettings object is what one match
// happened to be played under. The two are deliberately separate hashes:
//
//   constantsHash  "are we the same build?"   mismatch = incompatible code
//   settingsHash   "are we the same match?"   mismatch = same code, other room
//
// A snapshot carries both, so a client that joined a big-pitch room can never
// silently apply a small-pitch snapshot: the geometry the sim reads comes from
// the state header, and the header is verified before it is trusted.
//
// Everything below is pure and integer-only: no clock, no randomness, and no
// float arithmetic anywhere that a simulated value can reach.

import { fnv1aString, toHex32 } from './checksum.js';
import { CONSTANTS } from './constants.js';

const C = CONSTANTS;

// ------------------------------------------------------------ pitch presets

// Preset codes are 1-based on purpose: a zeroed state word is then an INVALID
// preset rather than a valid small pitch, so a buffer nobody initialised is
// refused instead of being mis-scaled.
export const PITCH_KUCUK = 1;
export const PITCH_ORTA = 2;
export const PITCH_BUYUK = 3;

/**
 * Exact integer rescale of a Q16.16 raw value. Throws rather than rounding: a
 * preset that cannot be expressed exactly would make one preset's geometry
 * depend on rounding direction, which is the kind of thing that desyncs a port.
 */
function scaleRaw(v, num, den) {
  const p = v * num;
  if (p % den !== 0) {
    throw new Error(`matchRules: ${v} * ${num} / ${den} is not an exact integer`);
  }
  return p / den;
}

/**
 * One arena. Every length is Q16.16 raw, and every length is the SAME multiple
 * of the medium preset, so the ratios a player can feel (goal mouth vs pitch
 * width, penalty area vs half, kickoff spot vs goal line) are identical on all
 * three. What differs is only the absolute size — and it differs the same way
 * for both teams, so no preset hands anyone an advantage.
 *
 * Player and ball radii, the kick reach and every timing stay LOCKED. A small
 * pitch therefore feels tighter because the players are relatively larger, not
 * because anything about them changed.
 */
function makePreset(code, id, label, num, den) {
  const halfX = scaleRaw(C.PITCH_HALF_X, num, den);
  const halfZ = scaleRaw(C.PITCH_HALF_Z, num, den);
  const preset = {
    code,
    id,
    label,
    scaleNum: num,
    scaleDen: den,
    halfX,
    halfZ,
    goalHalfX: scaleRaw(C.GOAL_HALF_X, num, den),
    penaltyHalfX: scaleRaw(C.PENALTY_HALF_X, num, den),
    penaltyDepth: scaleRaw(C.PENALTY_DEPTH, num, den),
    spawnZ: scaleRaw(C.SPAWN_Z, num, den),
    spawnXStep: scaleRaw(C.SPAWN_X_STEP, num, den),
    // Where a keeper holds its line when it is not committed: 5% of the half
    // length off its own goal line, the same share the renderer already uses.
    keeperGuardZ: scaleRaw(halfZ, 19, 20),
  };
  // A kickoff spot is the centre spot on every preset; there is no offset to
  // scale, and the tests assert it rather than trusting this comment.
  return Object.freeze(preset);
}

/** Indexed by preset code; slot 0 is deliberately empty. */
export const PITCH_PRESETS = Object.freeze([
  null,
  makePreset(PITCH_KUCUK, 'kucuk', 'Kucuk', 3, 4), // 150 x 315, goal mouth 82.5
  makePreset(PITCH_ORTA, 'orta', 'Orta', 1, 1), //    200 x 420, goal mouth 110
  makePreset(PITCH_BUYUK, 'buyuk', 'Buyuk', 5, 4), // 250 x 525, goal mouth 137.5
]);

/** The medium preset. It is bit-for-bit the Phase 1.2 geometry. */
export const DEFAULT_PITCH = PITCH_PRESETS[PITCH_ORTA];

/** Ordered list for menus. Ids are ASCII; `label` is what a human reads. */
export const PITCH_PRESET_LIST = Object.freeze([
  PITCH_PRESETS[PITCH_KUCUK],
  PITCH_PRESETS[PITCH_ORTA],
  PITCH_PRESETS[PITCH_BUYUK],
]);

// Alias table built on a null-prototype object so a hostile `__proto__`,
// `constructor` or `toString` from the wire looks up as "unknown", not as an
// inherited function.
const PITCH_ALIASES = (() => {
  const m = Object.create(null);
  const add = (k, code) => {
    m[String(k).toLowerCase()] = code;
  };
  add('kucuk', PITCH_KUCUK);
  add('small', PITCH_KUCUK);
  add('s', PITCH_KUCUK);
  add('orta', PITCH_ORTA);
  add('medium', PITCH_ORTA);
  add('m', PITCH_ORTA);
  add('buyuk', PITCH_BUYUK);
  add('large', PITCH_BUYUK);
  add('big', PITCH_BUYUK);
  add('l', PITCH_BUYUK);
  return m;
})();

/** Preset code for an id, alias or code. 0 when the value is not a preset. */
export function pitchCodeOf(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= PITCH_KUCUK && value <= PITCH_BUYUK
      ? value
      : 0;
  }
  if (typeof value !== 'string') return 0;
  const hit = PITCH_ALIASES[value.toLowerCase()];
  return hit === undefined ? 0 : hit;
}

/** Frozen preset for an id, alias or code. Throws on anything unknown. */
export function pitchPreset(value) {
  const code = pitchCodeOf(value);
  if (code === 0) throw new SettingsError('bad-pitch', `unknown pitch preset ${String(value)}`);
  return PITCH_PRESETS[code];
}

// ---------------------------------------------------------------- settings

/** Goal difference at which the mercy rule stops a match. */
export const MERCY_GOAL_DIFF = 4;

/** Accepted ranges. Anything outside is garbage from the wire, not a choice. */
export const MIN_DURATION_SECONDS = 0; // 0 = untimed, the match runs on score alone
export const MAX_DURATION_SECONDS = 3600;
export const MIN_SCORE_LIMIT = 0; // 0 = no score limit
export const MAX_SCORE_LIMIT = 99;

/**
 * The canonical room settings. Six fields, all primitives, all serialisable in
 * six Int32 words. This object is the ONLY thing the host has to broadcast for
 * a client to build an identical world.
 */
export const DEFAULT_SETTINGS = Object.freeze({
  durationSeconds: 180,
  scoreLimit: 3,
  pitch: 'orta',
  goldenGoal: false,
  mercyRule: true,
  keepers: true,
});

const SETTING_KEYS = Object.freeze([
  'durationSeconds',
  'goldenGoal',
  'keepers',
  'mercyRule',
  'pitch',
  'scoreLimit',
]); // already sorted: this is the hash order

/** Every refusal carries a stable `code` so the net layer can bucket it. */
export class SettingsError extends Error {
  constructor(code, message, issues = []) {
    super(message);
    this.name = 'SettingsError';
    this.code = code;
    this.issues = issues;
  }
}

function readOwn(raw, key) {
  return Object.prototype.hasOwnProperty.call(raw, key) ? raw[key] : undefined;
}

function coerceInt(v, lo, hi) {
  if (typeof v === 'boolean') return null; // true is not "1 second"
  if (typeof v !== 'number' || !Number.isInteger(v)) return null;
  if (v < lo || v > hi) return null;
  return v;
}

function coerceBool(v) {
  if (v === true || v === false) return v;
  if (v === 1) return true;
  if (v === 0) return false;
  return null;
}

/**
 * normaliseSettings(raw, { strict })
 *
 * Pure. Takes anything at all — undefined, a string, an array, a hostile object
 * with a poisoned prototype, a number where a boolean belongs — and returns a
 * frozen, canonical MatchSettings.
 *
 *   lenient (default)  every unusable field falls back to its default, and the
 *                      caller gets a valid object it can simulate with. This is
 *                      what a host does with a lobby request.
 *   strict             the same checks, but the first thing that had to be
 *                      changed throws SettingsError with the full issue list.
 *                      This is what a client does with what the host sent: a
 *                      settings word it does not understand must be a loud
 *                      refusal, never a quiet local reinterpretation.
 */
export function normaliseSettings(raw, options = {}) {
  const strict = options.strict === true;
  const issues = [];
  const out = { ...DEFAULT_SETTINGS };

  if (raw === undefined || raw === null) {
    if (strict) throw new SettingsError('not-an-object', 'settings missing', ['settings: missing']);
    return Object.freeze(out);
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    if (strict) {
      throw new SettingsError('not-an-object', 'settings is not an object', [
        `settings: ${typeof raw}`,
      ]);
    }
    return Object.freeze(out);
  }

  for (const key of Object.keys(raw)) {
    if (!SETTING_KEYS.includes(key)) issues.push(`${key}: unknown setting`);
  }

  const dur = readOwn(raw, 'durationSeconds');
  if (dur !== undefined) {
    const v = coerceInt(dur, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS);
    if (v === null) issues.push(`durationSeconds: ${describe(dur)}`);
    else out.durationSeconds = v;
  }

  const lim = readOwn(raw, 'scoreLimit');
  if (lim !== undefined) {
    const v = coerceInt(lim, MIN_SCORE_LIMIT, MAX_SCORE_LIMIT);
    if (v === null) issues.push(`scoreLimit: ${describe(lim)}`);
    else out.scoreLimit = v;
  }

  const pitch = readOwn(raw, 'pitch');
  if (pitch !== undefined) {
    const code = pitchCodeOf(pitch);
    if (code === 0) issues.push(`pitch: ${describe(pitch)}`);
    else out.pitch = PITCH_PRESETS[code].id;
  }

  for (const key of ['goldenGoal', 'mercyRule', 'keepers']) {
    const v = readOwn(raw, key);
    if (v === undefined) continue;
    const b = coerceBool(v);
    if (b === null) issues.push(`${key}: ${describe(v)}`);
    else out[key] = b;
  }

  if (strict && issues.length > 0) {
    throw new SettingsError('invalid', `rejected ${issues.length} setting(s)`, issues);
  }
  return Object.freeze(out);
}

/** Short, safe rendering of a rejected value for an error message. */
function describe(v) {
  const t = typeof v;
  if (v === null) return 'null';
  if (t === 'string') return `string ${JSON.stringify(v.slice(0, 24))}`;
  if (t === 'number' || t === 'boolean') return `${t} ${String(v)}`;
  if (Array.isArray(v)) return `array[${v.length}]`;
  return t;
}

/** True when `raw` survives normalisation untouched. */
export function isCanonicalSettings(raw) {
  try {
    normaliseSettings(raw, { strict: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Canonical serialisation: keys sorted, `name=value` joined by `;`, booleans as
 * 0/1 and the pitch as its ASCII id. Sorted so field order in an object literal
 * can never change the hash.
 */
export function serializeSettings(raw) {
  const s = normaliseSettings(raw);
  let out = '';
  for (const k of SETTING_KEYS) {
    const v = s[k];
    out += `${k}=${v === true ? 1 : v === false ? 0 : v};`;
  }
  return out;
}

/** Stable 32-bit hex digest. Changes if and only if a setting changes. */
export function settingsHash(raw) {
  return toHex32(fnv1aString(serializeSettings(raw)));
}

/** Low 32 bits of settingsHash as a signed int, for the state header. */
export function settingsHashInt(raw) {
  return parseInt(settingsHash(raw), 16) | 0;
}

/** Do two settings objects describe the same match? */
export function sameSettings(a, b) {
  return settingsHash(a) === settingsHash(b);
}

/**
 * Throw unless `actual` is the same match as `expected`. This is the client's
 * verification call: a settings mismatch has to stop the join, because the two
 * sides would otherwise simulate different arenas from the same inputs.
 */
export function assertSameSettings(expected, actual) {
  const e = settingsHash(expected);
  const a = settingsHash(actual);
  if (e !== a) {
    throw new SettingsError(
      'settings-mismatch',
      `settings ${a} does not match the host's ${e}`,
      [serializeSettings(actual), serializeSettings(expected)],
    );
  }
  return true;
}

// ------------------------------------------------------------------ wire

export const SETTINGS_WORDS = 6;

export const RULE_GOLDEN_GOAL = 1;
export const RULE_MERCY = 2;
export const RULE_KEEPERS = 4;
const RULE_MASK = 7;

/** Rule flags as one int, the form the state header and the wire both use. */
export function settingsFlags(raw) {
  const s = normaliseSettings(raw);
  return (
    (s.goldenGoal ? RULE_GOLDEN_GOAL : 0) |
    (s.mercyRule ? RULE_MERCY : 0) |
    (s.keepers ? RULE_KEEPERS : 0)
  );
}

/**
 * Six Int32 words the host broadcasts. Word 4 is the hash of the other five, so
 * a truncated or tampered settings message is caught by decodeSettings instead
 * of quietly producing a different room.
 *
 *   0 durationSeconds   1 scoreLimit   2 pitch code
 *   3 rule flags        4 settingsHash 5 reserved (0)
 */
export function encodeSettings(raw) {
  const s = normaliseSettings(raw);
  const w = new Int32Array(SETTINGS_WORDS);
  w[0] = s.durationSeconds;
  w[1] = s.scoreLimit;
  w[2] = pitchCodeOf(s.pitch);
  w[3] = settingsFlags(s);
  w[4] = settingsHashInt(s);
  w[5] = 0;
  return w;
}

/** Inverse of encodeSettings. Refuses anything that does not check out. */
export function decodeSettings(words) {
  if (!words || typeof words.length !== 'number' || words.length < SETTINGS_WORDS) {
    throw new SettingsError('short-settings', 'settings payload is too short');
  }
  const code = words[2] | 0;
  if (code < PITCH_KUCUK || code > PITCH_BUYUK) {
    throw new SettingsError('bad-pitch', `pitch code ${code} out of range`);
  }
  const flags = words[3] | 0;
  if ((flags & ~RULE_MASK) !== 0) {
    throw new SettingsError('bad-flags', `rule flags ${flags} carry unknown bits`);
  }
  const settings = normaliseSettings(
    {
      durationSeconds: words[0] | 0,
      scoreLimit: words[1] | 0,
      pitch: PITCH_PRESETS[code].id,
      goldenGoal: (flags & RULE_GOLDEN_GOAL) !== 0,
      mercyRule: (flags & RULE_MERCY) !== 0,
      keepers: (flags & RULE_KEEPERS) !== 0,
    },
    { strict: true },
  );
  if ((words[4] | 0) !== settingsHashInt(settings)) {
    throw new SettingsError('settings-hash', 'settings hash word does not match its payload');
  }
  return settings;
}

/** Rebuild a settings object from already-unpacked header values. */
export function settingsFrom({ durationTicks, scoreLimit, pitchCode, flags }) {
  if (durationTicks % C.TICK_RATE !== 0) {
    throw new SettingsError(
      'bad-duration',
      `duration ${durationTicks} ticks is not a whole number of seconds`,
    );
  }
  if (pitchCode < PITCH_KUCUK || pitchCode > PITCH_BUYUK) {
    throw new SettingsError('bad-pitch', `pitch code ${pitchCode} out of range`);
  }
  if ((flags & ~RULE_MASK) !== 0) {
    throw new SettingsError('bad-flags', `rule flags ${flags} carry unknown bits`);
  }
  return normaliseSettings(
    {
      durationSeconds: durationTicks / C.TICK_RATE,
      scoreLimit,
      pitch: PITCH_PRESETS[pitchCode].id,
      goldenGoal: (flags & RULE_GOLDEN_GOAL) !== 0,
      mercyRule: (flags & RULE_MERCY) !== 0,
      keepers: (flags & RULE_KEEPERS) !== 0,
    },
    { strict: true },
  );
}

/** Match length in 60 Hz ticks. 0 means "no clock". */
export function durationTicks(raw) {
  return normaliseSettings(raw).durationSeconds * C.TICK_RATE;
}

// ------------------------------------------------------------ match phases

export const MATCH_RUNNING = 0;
export const MATCH_GOLDEN_GOAL = 1;
export const MATCH_FINISHED = 2;

export const END_NONE = 0;
export const END_FULL_TIME = 1;
export const END_SCORE_LIMIT = 2;
export const END_MERCY = 3;
export const END_GOLDEN_GOAL = 4;

const END_NAMES = Object.freeze([
  'none',
  'full-time',
  'score-limit',
  'mercy',
  'golden-goal',
]);
const PHASE_NAMES = Object.freeze(['running', 'golden-goal', 'finished']);

export function endReasonName(code) {
  return END_NAMES[code] || 'none';
}

export function matchPhaseName(code) {
  return PHASE_NAMES[code] || 'running';
}

/** Leader for a score pair, or -1 when it is level. */
export function leaderOf(score0, score1) {
  if (score0 > score1) return 0;
  if (score1 > score0) return 1;
  return -1;
}
