// Wire protocol for the P2P match (v1, plain JSON over a PeerJS DataConnection).
// Field names follow docs/multiplayer-interfaces.md. Everything that arrives from
// a remote peer is untrusted: validate() is the single choke point that turns raw
// input into a sanitized copy, or null. Never forward the original object.

/** Message type constants. */
export const MSG = Object.freeze({
  HELLO: 'hello',   // guest -> host: {name}
  TEAM: 'team',     // guest -> host: {team}
  INPUT: 'input',   // guest -> host: {seq, x, z, kick}
  LOBBY: 'lobby',   // host -> guest: {you, players, settings}
  START: 'start',   // host -> guest: {settings}
  SNAP: 'snap',     // host -> guest: 20 Hz world state
  KICKED: 'kicked', // host -> guest: {reason}
  END: 'end',       // host -> guest: {score}
});

/** Match states carried by a snap. */
export const STATES = Object.freeze(['kickoff', 'play', 'goal', 'end']);
/** Reasons a guest can be disconnected by the host. */
export const KICK_REASONS = Object.freeze(['kick', 'ban']);

/** Allowed settings values (the contract fixes these sets). */
export const SETTING_VALUES = Object.freeze({
  matchTime: Object.freeze([60, 180, 300]),
  goalLimit: Object.freeze([3, 5, 10, 0]),
  goalScale: Object.freeze([0.8, 1, 1.3]),
});

export const CODE_LEN = 6;
export const MAX_NAME = 20;
export const MAX_ID = 64;      // peer ids are ~36 chars; leave headroom
export const MAX_PLAYERS = 16;
export const MAX_EVENTS = 32;
export const MAX_EVENT_KEYS = 8;
export const DEFAULT_NAME = 'Oyuncu'; // user-facing fallback (UI is Turkish)

/** Room-code alphabet without look-alikes (no 0/O/1/I). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ---------------------------------------------------------------- primitives

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => isNum(v) && Number.isInteger(v);
const isBool = (v) => typeof v === 'boolean';
const isStr = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Thrown internally by the per-type validators; never escapes validate(). */
class Reject extends Error {}
const need = (cond) => { if (!cond) throw new Reject(); };

const num = (v) => { need(isNum(v)); return v; };
const optNum = (v, dflt = 0) => (v === undefined ? dflt : num(v));
const teamOf = (v) => { need(v === 0 || v === 1); return v; };
const idOf = (v) => { need(isStr(v, MAX_ID)); return v; };
const oneOf = (v, allowed) => { need(allowed.includes(v)); return v; };

// ------------------------------------------------------------------ helpers

/**
 * Clean a display name: strip control characters, collapse whitespace, cap length.
 * Always returns a non-empty string (falls back to DEFAULT_NAME).
 * @param {unknown} name raw name from a peer or an input field
 * @returns {string} 1..MAX_NAME characters
 */
export function sanitizeName(name) {
  if (typeof name !== 'string') return DEFAULT_NAME;
  const clean = name
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.slice(0, MAX_NAME).trim() || DEFAULT_NAME;
}

/**
 * Normalize a room code: uppercase, drop everything that is not A-Z/0-9, cap at 6.
 * @param {unknown} code raw code (user typed, possibly with spaces or dashes)
 * @returns {string} 0..CODE_LEN characters; check the length before using it
 */
export function normalizeCode(code) {
  if (typeof code !== 'string') return '';
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);
}

/**
 * @param {unknown} code candidate room code
 * @returns {boolean} true when it is exactly 6 uppercase alphanumerics
 */
export function isValidCode(code) {
  return typeof code === 'string' && /^[A-Z0-9]{6}$/.test(code);
}

/**
 * Generate a room code from an unambiguous alphabet (no 0/O/1/I).
 * @returns {string} CODE_LEN characters
 */
export function randomCode() {
  const n = CODE_ALPHABET.length;
  let out = '';
  const bytes = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint32Array(CODE_LEN))
    : null;
  for (let i = 0; i < CODE_LEN; i++) {
    const r = bytes ? bytes[i] / 2 ** 32 : Math.random();
    out += CODE_ALPHABET[Math.min(n - 1, Math.floor(r * n))];
  }
  return out;
}

// --------------------------------------------------------------- sub-shapes

/** Match settings; every field must be one of the contract's allowed values. */
function settingsOf(s) {
  need(isObj(s));
  need(isBool(s.keepers));
  return {
    matchTime: oneOf(s.matchTime, SETTING_VALUES.matchTime),
    goalLimit: oneOf(s.goalLimit, SETTING_VALUES.goalLimit),
    goalScale: oneOf(s.goalScale, SETTING_VALUES.goalScale),
    keepers: s.keepers,
  };
}

/** Lobby roster entry. */
function lobbyPlayer(p) {
  need(isObj(p) && isBool(p.isHost));
  return { id: idOf(p.id), name: sanitizeName(p.name), team: teamOf(p.team), isHost: p.isHost };
}

/** Snapshot player entry; optional kinematics default to 0, role to 'field'. */
function snapPlayer(p) {
  need(isObj(p));
  if (p.role !== undefined) need(isStr(p.role, 16));
  return {
    id: idOf(p.id),
    x: num(p.x),
    z: num(p.z),
    vx: optNum(p.vx),
    vz: optNum(p.vz),
    facing: optNum(p.facing),
    down: optNum(p.down),
    charge: optNum(p.charge),
    kickAnim: optNum(p.kickAnim),
    headerAnim: optNum(p.headerAnim),
    dive: optNum(p.dive),
    diveRecover: optNum(p.diveRecover),
    diveYaw: optNum(p.diveYaw),
    team: teamOf(p.team),
    role: p.role === undefined ? 'field' : p.role,
  };
}

/** Ball state: position, linear velocity, angular velocity. */
function ballOf(b) {
  need(isObj(b));
  return {
    x: num(b.x), y: num(b.y), z: num(b.z),
    vx: num(b.vx), vy: num(b.vy), vz: num(b.vz),
    wx: num(b.wx), wy: num(b.wy), wz: num(b.wz),
  };
}

/** [red, blue] as non-negative integers. */
function scoreOf(s) {
  need(Array.isArray(s) && s.length === 2);
  const pair = s.map((v) => { need(isInt(v) && v >= 0 && v < 1e6); return v; });
  return [pair[0], pair[1]];
}

/**
 * Events are open-ended ({type, ...}), so only scalar extras survive and the
 * payload is capped in key count, key length and string length.
 */
function eventOf(e) {
  need(isObj(e) && isStr(e.type, 24));
  const out = { type: e.type };
  let kept = 0;
  for (const k of Object.keys(e)) {
    if (k === 'type' || k.length > 16) continue;
    if (kept >= MAX_EVENT_KEYS) break;
    const v = e[k];
    if (isNum(v) || isBool(v) || (typeof v === 'string' && v.length <= 32)) {
      out[k] = v;
      kept++;
    }
  }
  return out;
}

/** Validate a bounded array, mapping each entry through `fn`. */
function listOf(arr, max, fn, optional = false) {
  if (arr === undefined && optional) return [];
  need(Array.isArray(arr) && arr.length <= max);
  return arr.map(fn);
}

// -------------------------------------------------------------- per-type map

const VALIDATORS = {
  [MSG.HELLO]: (m) => {
    need(typeof m.name === 'string');
    return { t: MSG.HELLO, name: sanitizeName(m.name) };
  },

  [MSG.TEAM]: (m) => ({ t: MSG.TEAM, team: teamOf(m.team) }),

  [MSG.INPUT]: (m) => {
    need(isInt(m.seq) && m.seq >= 0 && m.seq <= Number.MAX_SAFE_INTEGER);
    need(isBool(m.kick));
    return {
      t: MSG.INPUT,
      seq: m.seq,
      x: clamp(num(m.x), -1, 1),
      z: clamp(num(m.z), -1, 1),
      kick: m.kick,
    };
  },

  [MSG.LOBBY]: (m) => ({
    t: MSG.LOBBY,
    you: idOf(m.you),
    players: listOf(m.players, MAX_PLAYERS, lobbyPlayer),
    settings: settingsOf(m.settings),
  }),

  [MSG.START]: (m) => ({ t: MSG.START, settings: settingsOf(m.settings) }),

  [MSG.SNAP]: (m) => {
    need(isInt(m.tick) && m.tick >= 0);
    return {
      t: MSG.SNAP,
      tick: m.tick,
      state: oneOf(m.state, STATES),
      timeLeft: Math.max(0, num(m.timeLeft)),
      score: scoreOf(m.score),
      ball: ballOf(m.ball),
      players: listOf(m.players, MAX_PLAYERS, snapPlayer),
      events: listOf(m.events, MAX_EVENTS, eventOf, true),
    };
  },

  [MSG.KICKED]: (m) => ({ t: MSG.KICKED, reason: oneOf(m.reason, KICK_REASONS) }),

  [MSG.END]: (m) => ({ t: MSG.END, score: scoreOf(m.score) }),
};

/**
 * Validate an inbound (or outbound) protocol message. This is the security
 * boundary against malicious peers: unknown types, missing or mistyped fields,
 * NaN/Infinity numbers, over-long strings and over-sized arrays all reject,
 * and unknown extra fields are stripped.
 * @param {unknown} msg raw, already JSON-parsed value
 * @returns {object|null} sanitized copy, or null when the message is malformed
 */
export function validate(msg) {
  if (!isObj(msg) || typeof msg.t !== 'string') return null;
  const fn = VALIDATORS[msg.t];
  if (!fn) return null;
  try {
    return fn(msg);
  } catch {
    return null; // Reject (or any unexpected throw) means "not well-formed"
  }
}

/**
 * Shape and validate a snapshot payload. Building the raw parts from the world
 * (makeSnap) belongs to the game layer; this only guarantees the wire shape.
 * @param {{tick:number, state:string, timeLeft:number, score:number[],
 *          ball:object, players:object[], events?:object[]}} parts
 * @returns {object|null} a valid `snap` message, or null when parts are malformed
 */
export function packSnap(parts) {
  if (!isObj(parts)) return null;
  return validate({
    t: MSG.SNAP,
    tick: parts.tick,
    state: parts.state,
    timeLeft: parts.timeLeft,
    score: parts.score,
    ball: parts.ball,
    players: parts.players,
    events: parts.events,
  });
}
