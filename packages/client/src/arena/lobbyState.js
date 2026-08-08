// Lobby reducers for the arena (feature matrix #13). Pure: no DOM, no network,
// no timers, so scripts/arena-test.mjs drives every decision the host makes.
//
// The general lobby machinery is not reinvented — autoTeam, readyOf and setReady
// come from src/mp/lobbyState.js, which the shipping lobby already uses. What is
// new here is the one rule that lobby never had: the ROLE.
//
//   * a keeperless mode (1v1, 2v2, 3v3) has no keeper slot at all; a pick that
//     asks for one is refused, and switching into such a mode demotes everyone
//   * a keepered mode (4v4) has exactly ONE keeper per team. Claiming a taken
//     slot is refused rather than silently reassigning the incumbent, because
//     ADR-0001 says the keeper is chosen once and then left alone
//   * an unclaimed keeper slot is not an error here: buildRoster() gives it to a
//     bot at start, so a room can always kick off
//
// Every reducer returns a NEW array. The host applies them and then broadcasts
// the result; a guest never mutates its own copy.

import { autoTeam, readyOf, setReady as setReadyBase } from '../mp/lobbyState.js';
import { sanitizeName } from '../mp/protocol.js';
import { modeOf } from './roster.js';
import { DEFAULT_SETTINGS } from './matchRules.js';

/** Roster id of the host's own seat. */
export const HOST_ID = 'host';

export { readyOf };

/** A fresh lobby holding only the host. */
export function createLobby(hostName, settings = {}) {
  return {
    settings: { ...DEFAULT_SETTINGS, ...settings },
    players: [{
      id: HOST_ID,
      name: sanitizeName(hostName),
      team: 0,
      role: 'field',
      isHost: true,
      ready: true,
    }],
  };
}

/** Seat a newly arrived guest on the thinner side, as a field player. */
export function addPlayer(players, { id, name }) {
  if (players.some((p) => p.id === id)) return players;
  return [...players, {
    id,
    name: sanitizeName(name),
    team: autoTeam(players),
    role: 'field',
    isHost: false,
    ready: false,
  }];
}

export function removePlayer(players, id) {
  return players.filter((p) => p.id !== id);
}

export const setReady = setReadyBase;

/**
 * Apply one team/role pick. Returns { players, ok, reason } — the host answers
 * a refused pick by simply rebroadcasting the unchanged lobby, so a guest that
 * asked for something impossible sees its UI snap back.
 */
export function applyPick(players, id, pick, settings) {
  const mode = modeOf(settings.mode);
  const me = players.find((p) => p.id === id);
  if (!me) return { players, ok: false, reason: 'no-such-player' };

  const team = pick.team === 1 ? 1 : 0;
  const wantsKeeper = pick.role === 'keeper';

  if (wantsKeeper && !mode.keepers) {
    return { players, ok: false, reason: 'mode-has-no-keeper' };
  }
  const others = players.filter((p) => p.id !== id);
  if (others.filter((p) => p.team === team).length >= mode.perTeam) {
    return { players, ok: false, reason: 'team-full' };
  }
  if (wantsKeeper && others.some((p) => p.team === team && p.role === 'keeper')) {
    return { players, ok: false, reason: 'keeper-taken' };
  }

  return {
    ok: true,
    reason: null,
    players: players.map((p) => (p.id === id
      ? { ...p, team, role: wantsKeeper ? 'keeper' : 'field' }
      : p)),
  };
}

/**
 * Re-settle the lobby after a settings change. Switching to a keeperless mode
 * demotes every keeper; shrinking the mode can leave a side over capacity, which
 * is reported by lobbyIssues() rather than fixed by evicting someone.
 */
export function applySettings(players, settings, patch) {
  const next = { ...settings, ...patch };
  modeOf(next.mode); // throws on nonsense before anything is committed
  const mode = modeOf(next.mode);
  let out = players;
  if (!mode.keepers) {
    out = players.map((p) => (p.role === 'keeper' ? { ...p, role: 'field' } : p));
  } else {
    // a mode change can never leave two keepers on one side
    const seen = [false, false];
    out = players.map((p) => {
      if (p.role !== 'keeper') return p;
      if (seen[p.team]) return { ...p, role: 'field' };
      seen[p.team] = true;
      return p;
    });
  }
  return { players: out, settings: next };
}

/** The humans buildRoster() should seat, in lobby order (host first). */
export function humansFor(players) {
  return players.map((p) => ({ id: p.id, name: p.name, team: p.team, role: p.role }));
}

/**
 * Why the start button is disabled, as a list of Turkish reasons. Empty means
 * the host may press it.
 */
export function lobbyIssues(players, settings) {
  const mode = modeOf(settings.mode);
  const issues = [];
  for (const team of [0, 1]) {
    const n = players.filter((p) => p.team === team).length;
    if (n > mode.perTeam) {
      issues.push(`${team === 0 ? 'Kırmızı' : 'Mavi'} takımda ${n} oyuncu var, ${mode.id} en fazla ${mode.perTeam} alır`);
    }
    if (mode.keepers) {
      const keepers = players.filter((p) => p.team === team && p.role === 'keeper').length;
      if (keepers > 1) issues.push(`${team === 0 ? 'Kırmızı' : 'Mavi'} takımda ${keepers} kaleci var`);
    }
  }
  if (players.some((p) => !readyOf(p))) issues.push('Bazı oyuncular hazır değil');
  if (!players.length) issues.push('Lobide kimse yok');
  return issues;
}

export function canStart(players, settings) {
  return lobbyIssues(players, settings).length === 0;
}
