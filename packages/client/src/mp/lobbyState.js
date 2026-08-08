// Pure lobby reducers: roster building, ready gating, reconnect bookkeeping and
// chat rate limiting. No DOM, no network, no timers — every function takes the
// state it needs and returns a value, so scripts/mp-test.mjs can drive all of
// the host's decision logic under node.

import { sanitizeName } from './protocol.js';

/** How long a dropped guest may reclaim its slot (ms). */
export const RECONNECT_MS = 60000;
/** Shortest gap between two chat lines from the same peer (ms). */
export const CHAT_MIN_GAP_MS = 700;
/** Chat lines one peer may send inside CHAT_WINDOW_MS. */
export const CHAT_BURST = 5;
export const CHAT_WINDOW_MS = 5000;

/** Roster id of the host's own slot. */
export const HOST_ID = 'host';

/** @param {unknown} id @returns {boolean} true for locally spawned bot slots */
export const isBotId = (id) => typeof id === 'string' && id.startsWith('bot');

/** Case/whitespace-insensitive key used to recognise a returning player. */
export const nameKey = (name) => sanitizeName(name).toLocaleLowerCase('tr');

/** @returns {object[]} lobby entries that actually take the pitch */
export const fieldPlayers = (players) => players.filter((p) => !p.spectator);

/** @returns {object[]} lobby entries that only watch */
export const spectators = (players) => players.filter((p) => p.spectator);

/**
 * Which team a joining player lands on: whichever side is thinner, red on a tie.
 * @param {object[]} players current lobby entries
 * @returns {0|1}
 */
export function autoTeam(players) {
  const onPitch = fieldPlayers(players);
  const reds = onPitch.filter((p) => p.team === 0).length;
  const blues = onPitch.filter((p) => p.team === 1).length;
  return blues < reds ? 1 : 0;
}

/**
 * Only human guests have to press "Hazır": the host starts the match, bots have
 * no opinion and spectators never take the pitch.
 * @param {object} p lobby entry
 * @returns {boolean}
 */
export function readyOf(p) {
  if (!p) return false;
  if (p.isHost || p.id === HOST_ID || isBotId(p.id) || p.spectator) return true;
  return p.ready === true;
}

/** @returns {boolean} true when every guest that needs to be ready is ready */
export const allReady = (players) => players.every(readyOf);

/**
 * Start gate: at least two players on the pitch and no guest still deciding.
 * @param {object[]} players lobby entries
 * @returns {boolean}
 */
export function canStart(players) {
  if (!Array.isArray(players)) return false;
  return fieldPlayers(players).length >= 2 && allReady(players);
}

/**
 * Flip one player's ready flag. Returns a new array; entries that cannot be
 * "not ready" (host, bots, spectators) are left alone.
 * @param {object[]} players lobby entries
 * @param {string} id roster id
 * @param {boolean} ready
 * @returns {object[]} new array
 */
export function setReady(players, id, ready) {
  return players.map((p) => (p.id === id && !p.isHost && !isBotId(p.id) && !p.spectator
    ? { ...p, ready: ready === true }
    : p));
}

/**
 * Everyone becomes "not ready" again, e.g. after returning from a match.
 * Host, bots and spectators are ready by definition, so their flag is moot.
 */
export const clearReady = (players) =>
  players.map((p) => (p.ready ? { ...p, ready: false } : p));

/**
 * Build the match roster from the lobby: field players in lobby order, then the
 * two keepers when the settings ask for them. Spectators are left out; a dropped
 * but still reclaimable player keeps its pitch slot so a reconnect walks
 * straight back into it.
 * @param {object[]} players lobby entries
 * @param {{keepers?:boolean}} settings match settings
 * @returns {{id:string, team:0|1, role:string, name:string}[]}
 */
export function rosterFromPlayers(players, settings = {}) {
  const roster = fieldPlayers(players).map((p) => ({
    id: p.id, team: p.team, role: 'field', name: p.name ?? '',
  }));
  if (settings.keepers) {
    roster.push(
      { id: 'kr', team: 0, role: 'keeper', name: '' },
      { id: 'kb', team: 1, role: 'keeper', name: '' },
    );
  }
  return roster;
}

// ------------------------------------------------------- reconnect bookkeeping

/**
 * Remember a guest that just dropped so the same person (same display name) can
 * reclaim the slot within RECONNECT_MS. Mutates and returns the map.
 * @param {Map<string, object>} departed
 * @param {{id:string, name:string, team:0|1, spectator?:boolean}} entry
 * @param {number} now epoch ms
 * @returns {Map<string, object>}
 */
export function rememberDeparted(departed, entry, now) {
  if (!entry || isBotId(entry.id)) return departed;
  departed.set(nameKey(entry.name), {
    id: entry.id, name: entry.name, team: entry.team,
    spectator: entry.spectator === true, at: now,
  });
  return departed;
}

/** Drop every remembered slot older than RECONNECT_MS. */
export function pruneDeparted(departed, now) {
  for (const [key, rec] of departed) {
    if (now - rec.at > RECONNECT_MS) departed.delete(key);
  }
  return departed;
}

/**
 * Claim a remembered slot for a returning name. Expired records are dropped and
 * treated as absent, so a late reconnect simply joins as a new player.
 * @param {Map<string, object>} departed
 * @param {string} name display name the returning peer said hello with
 * @param {number} now epoch ms
 * @returns {object|null} the remembered slot, already removed from the map
 */
export function takeDeparted(departed, name, now) {
  pruneDeparted(departed, now);
  const key = nameKey(name);
  const rec = departed.get(key);
  if (!rec) return null;
  departed.delete(key);
  return rec;
}

/** Forget a slot outright (kick/ban): it must never be auto-restored. */
export function forgetDeparted(departed, name) {
  departed.delete(nameKey(name));
  return departed;
}

// ------------------------------------------------------------ chat throttling

/**
 * Token-bucket-ish guard so one peer cannot flood the room. Mutates `buckets`.
 * @param {Map<string, {last:number, stamps:number[]}>} buckets per-peer state
 * @param {string} id peer/roster id
 * @param {number} now epoch ms
 * @returns {boolean} true when this line may be relayed
 */
export function chatAllowed(buckets, id, now) {
  const b = buckets.get(id) ?? { last: -Infinity, stamps: [] };
  if (now - b.last < CHAT_MIN_GAP_MS) return false;
  const stamps = b.stamps.filter((t) => now - t < CHAT_WINDOW_MS);
  if (stamps.length >= CHAT_BURST) {
    buckets.set(id, { last: b.last, stamps });
    return false;
  }
  stamps.push(now);
  buckets.set(id, { last: now, stamps });
  return true;
}
