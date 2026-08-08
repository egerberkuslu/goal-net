// The arena's lobby wire format, and the frame tag that separates it from the
// match wire format.
//
// Two protocols share one DataConnection:
//
//   0x474e4e31 "GNN1"   @goalnet/net — hello, input, snapshot. Self-validating:
//                       packages/net/src/protocol.js is the trust boundary and
//                       nothing here second-guesses it.
//   0x474e414a "GNAJ"   this file — lobby JSON (roster, settings, start, end).
//
// Both ride the same reliable ordered channel. netcode-p2p.md asks for a split
// (unreliable game / reliable lobby); PeerJS gives one DataConnection per peer,
// and the net layer recovers ordering from its own `seq` word, so a reliable
// channel is strictly safer than the spec's minimum. Splitting the channels is a
// transport change, not a protocol change, and nothing above this line would
// have to move.
//
// Everything arriving from a peer is untrusted. `decodeLobby` is the single
// choke point: it returns a sanitized copy or null, and the caller never sees
// the original object.

import { sanitizeName } from '../mp/protocol.js';
import { MODE_IDS, DIFFICULTIES } from './roster.js';

/** "GNAJ" — arena lobby JSON. Distinct from @goalnet/net's "GNN1". */
export const ARENA_MAGIC = 0x474e414a;
/** "GNN1", repeated here so the demux never has to import the net package. */
export const NET_FRAME_MAGIC = 0x474e4e31;

export const AMSG = Object.freeze({
  HELLO: 'a-hello', // guest -> host: { name }
  PICK: 'a-pick', // guest -> host: { team, role }
  READY: 'a-ready', // guest -> host: { ready }
  LOBBY: 'a-lobby', // host -> guest: { you, code, players, settings }
  START: 'a-start', // host -> guest: { slots, settings, seed }
  END: 'a-end', // host -> guest: { score, reason, winner }
});

export const MAX_NAME = 20;
export const MAX_ID = 64;
export const MAX_SLOTS = 12; // the core caps at CONSTANTS.MAX_PLAYERS
export const MAX_LOBBY = 16;

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isBool = (v) => typeof v === 'boolean';
const isInt = (v) => Number.isInteger(v);

class Reject extends Error {}
const need = (c) => { if (!c) throw new Reject(); };
const idOf = (v) => { need(typeof v === 'string' && v.length > 0 && v.length <= MAX_ID); return v; };
const teamOf = (v) => { need(v === 0 || v === 1); return v; };
const roleOf = (v) => { need(v === 'field' || v === 'keeper'); return v; };
const oneOf = (v, allowed) => { need(allowed.includes(v)); return v; };

/** Room settings. Every field is drawn from a closed set; the host is canonical. */
export const SETTING_VALUES = Object.freeze({
  matchSeconds: Object.freeze([60, 180, 300]),
  goalLimit: Object.freeze([3, 5, 10, 0]),
});

function settingsOf(s) {
  need(isObj(s));
  return {
    mode: oneOf(s.mode, MODE_IDS),
    difficulty: oneOf(s.difficulty, DIFFICULTIES),
    matchSeconds: oneOf(s.matchSeconds, SETTING_VALUES.matchSeconds),
    goalLimit: oneOf(s.goalLimit, SETTING_VALUES.goalLimit),
    goldenGoal: (need(isBool(s.goldenGoal)), s.goldenGoal),
    mercyGap: (need(isInt(s.mercyGap) && s.mercyGap >= 0 && s.mercyGap <= 20), s.mercyGap),
  };
}

function lobbyPlayerOf(p) {
  need(isObj(p) && isBool(p.isHost));
  return {
    id: idOf(p.id),
    name: sanitizeName(p.name),
    team: teamOf(p.team),
    role: roleOf(p.role === undefined ? 'field' : p.role),
    isHost: p.isHost,
    ready: p.ready === true,
  };
}

function slotOf(s) {
  need(isObj(s));
  need(isInt(s.index) && s.index >= 0 && s.index < MAX_SLOTS);
  return {
    index: s.index,
    team: teamOf(s.team),
    role: roleOf(s.role),
    kind: oneOf(s.kind, ['human', 'bot']),
    id: idOf(s.id),
    name: sanitizeName(s.name),
  };
}

function listOf(arr, max, fn) {
  need(Array.isArray(arr) && arr.length <= max);
  return arr.map(fn);
}

const VALIDATORS = {
  [AMSG.HELLO]: (m) => ({ t: AMSG.HELLO, name: sanitizeName(m.name) }),

  [AMSG.PICK]: (m) => ({
    t: AMSG.PICK,
    team: teamOf(m.team),
    role: roleOf(m.role === undefined ? 'field' : m.role),
  }),

  [AMSG.READY]: (m) => { need(isBool(m.ready)); return { t: AMSG.READY, ready: m.ready }; },

  [AMSG.LOBBY]: (m) => ({
    t: AMSG.LOBBY,
    you: idOf(m.you),
    code: (need(typeof m.code === 'string' && m.code.length <= 12), m.code),
    players: listOf(m.players, MAX_LOBBY, lobbyPlayerOf),
    settings: settingsOf(m.settings),
  }),

  [AMSG.START]: (m) => {
    need(isInt(m.seed) && m.seed >= 0);
    return {
      t: AMSG.START,
      seed: m.seed,
      settings: settingsOf(m.settings),
      slots: listOf(m.slots, MAX_SLOTS, slotOf),
    };
  },

  [AMSG.END]: (m) => {
    need(Array.isArray(m.score) && m.score.length === 2);
    need(m.score.every((v) => isInt(v) && v >= 0 && v < 1e6));
    need(m.winner === -1 || m.winner === 0 || m.winner === 1);
    return {
      t: AMSG.END,
      score: [m.score[0], m.score[1]],
      winner: m.winner,
      reason: oneOf(m.reason, ['goal-limit', 'mercy', 'time', 'golden']),
    };
  },
};

/**
 * Validate one already-parsed lobby message.
 * @returns {object|null} sanitized copy, or null when it is not well formed
 */
export function validateLobby(msg) {
  if (!isObj(msg) || typeof msg.t !== 'string') return null;
  const fn = VALIDATORS[msg.t];
  if (!fn) return null;
  try {
    return fn(msg);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ framing

const encoder = typeof TextEncoder === 'undefined' ? null : new TextEncoder();
const decoder = typeof TextDecoder === 'undefined' ? null : new TextDecoder();

/**
 * Frame a lobby message: 4-byte little-endian magic then UTF-8 JSON. The
 * message is validated on the way OUT too, so a bug up here can never put a
 * malformed frame on the wire.
 * @returns {ArrayBuffer|null}
 */
export function encodeLobby(msg) {
  const clean = validateLobby(msg);
  if (!clean) return null;
  const json = encoder.encode(JSON.stringify(clean));
  const buf = new ArrayBuffer(4 + json.byteLength);
  new DataView(buf).setInt32(0, ARENA_MAGIC, true);
  new Uint8Array(buf, 4).set(json);
  return buf;
}

/**
 * Which protocol a frame belongs to: 'lobby', 'net' or 'unknown'.
 * @param {ArrayBuffer|ArrayBufferView} data
 */
export function frameKind(data) {
  const view = asView(data);
  if (!view || view.byteLength < 4) return 'unknown';
  const magic = view.getInt32(0, true);
  if (magic === ARENA_MAGIC) return 'lobby';
  if (magic === NET_FRAME_MAGIC) return 'net';
  return 'unknown';
}

/** Decode and validate a lobby frame. Returns null for anything suspect. */
export function decodeLobby(data) {
  const view = asView(data);
  if (!view || view.byteLength < 5) return null;
  if (view.getInt32(0, true) !== ARENA_MAGIC) return null;
  let parsed;
  try {
    const bytes = new Uint8Array(view.buffer, view.byteOffset + 4, view.byteLength - 4);
    parsed = JSON.parse(decoder.decode(bytes));
  } catch {
    return null;
  }
  return validateLobby(parsed);
}

function asView(data) {
  if (data instanceof ArrayBuffer) return new DataView(data);
  if (ArrayBuffer.isView(data)) return new DataView(data.buffer, data.byteOffset, data.byteLength);
  return null;
}
