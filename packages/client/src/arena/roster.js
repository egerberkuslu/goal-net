// Modes and roster construction (feature matrix #12), as pure functions.
//
// A roster is the bridge between what the lobby shows and what the core is
// built from. `createWorld({ players: [{ team, role }] })` is positional: slot i
// of that array is player index i forever, which is also the index the netcode
// hands to a peer and the index a bot policy is keyed on. So the roster is
// built ONCE, on the host, and shipped verbatim to every guest.
//
// Rules this module enforces, from 10-design/modes-rules.md and ADR-0001:
//
//   * 1v1 / 2v2 / 3v3 have NO keeper. Every slot is a field player.
//   * 4v4 has EXACTLY ONE keeper per team. Not zero, not two.
//   * The keeper is chosen in the lobby and fixed for the match. There is no
//     mid-match swap anywhere in this file, because there is no such thing.
//   * A keeper slot nobody claimed goes to a bot, deterministically (the
//     lowest free slot on that team), so a match can always start.
//
// Slots alternate teams (0, 1, 0, 1, ...) so the core's kickoff spread deals
// both sides the same lateral pattern whatever the mode.

/** The modes the lobby offers. `perTeam` counts the keeper when there is one. */
export const MODES = Object.freeze({
  '1v1': Object.freeze({ id: '1v1', perTeam: 1, keepers: false, label: '1v1' }),
  '2v2': Object.freeze({ id: '2v2', perTeam: 2, keepers: false, label: '2v2' }),
  '3v3': Object.freeze({ id: '3v3', perTeam: 3, keepers: false, label: '3v3 (kalecisiz)' }),
  '4v4': Object.freeze({ id: '4v4', perTeam: 4, keepers: true, label: '4v4 (kaleci)' }),
});

export const MODE_IDS = Object.freeze(Object.keys(MODES));

export const DIFFICULTIES = Object.freeze(['kolay', 'orta', 'zor']);

/** @returns {object} the mode record, or throws on an unknown id. */
export function modeOf(id) {
  const m = MODES[id];
  if (!m) throw new RangeError(`unknown mode ${JSON.stringify(id)}`);
  return m;
}

/** How many humans a mode can seat. */
export const humanCapacity = (id) => modeOf(id).perTeam * 2;

/**
 * buildRoster({ mode, humans, difficulty, seed })
 *
 *   mode        one of MODE_IDS
 *   humans      [{ id, name, team, role }] in lobby order; `role` is honoured
 *               only when the mode has keepers
 *   difficulty  'kolay' | 'orta' | 'zor' for every bot slot
 *
 * Returns
 *   { mode, difficulty, seed, keepersPerTeam,
 *     slots:   [{ index, team, role, kind, id, name, difficulty }],
 *     players: [{ team, role }]          // exactly what createWorld() wants
 *     botSlots:[index...] }              // exactly what createHostSession() wants
 *
 * Throws (rather than quietly repairing) when the lobby handed over something
 * the mode forbids: two keepers on a side, a keeper in a keeperless mode, more
 * humans than seats, or two humans in the same slot.
 */
export function buildRoster(options = {}) {
  const mode = modeOf(options.mode);
  const difficulty = normaliseDifficulty(options.difficulty);
  const seed = options.seed == null ? 1337 : options.seed >>> 0;
  const humans = Array.isArray(options.humans) ? options.humans : [];

  if (humans.length > mode.perTeam * 2) {
    throw new RangeError(`mode ${mode.id} seats ${mode.perTeam * 2} humans, got ${humans.length}`);
  }

  // ---- 1. sort the humans onto their teams, in lobby order
  const perTeam = [[], []];
  const seenIds = new Set();
  for (const h of humans) {
    const team = h && h.team ? 1 : 0;
    if (!h || typeof h.id !== 'string' || !h.id) throw new TypeError('every human needs a string id');
    if (seenIds.has(h.id)) throw new RangeError(`duplicate human id ${h.id}`);
    seenIds.add(h.id);
    const wantsKeeper = h.role === 'keeper';
    if (wantsKeeper && !mode.keepers) {
      throw new RangeError(`mode ${mode.id} has no keeper slot, ${h.id} asked for one`);
    }
    perTeam[team].push({ id: h.id, name: typeof h.name === 'string' ? h.name : '', keeper: wantsKeeper });
  }
  for (const team of [0, 1]) {
    if (perTeam[team].length > mode.perTeam) {
      throw new RangeError(`team ${team} has ${perTeam[team].length} humans, mode ${mode.id} seats ${mode.perTeam}`);
    }
    const keepers = perTeam[team].filter((h) => h.keeper).length;
    if (keepers > 1) throw new RangeError(`team ${team} claimed ${keepers} keepers; exactly one is allowed`);
  }

  // ---- 2. deal slots, alternating teams so both sides spread the same way
  const total = mode.perTeam * 2;
  const cursor = [0, 0];
  const slots = [];
  for (let index = 0; index < total; index++) {
    const team = index % 2;
    const human = perTeam[team][cursor[team]++] || null;
    slots.push({
      index,
      team,
      role: 'field',
      kind: human ? 'human' : 'bot',
      id: human ? human.id : `bot${index}`,
      name: human ? human.name : botName(index, difficulty),
      difficulty: human ? null : difficulty,
      wantsKeeper: human ? human.keeper : false,
    });
  }

  // ---- 3. place the keepers. A claimed slot keeps its claim; an unclaimed
  //         team falls back to its lowest slot, which is a bot when the team is
  //         short-handed and a human otherwise (ADR-0001: lowest playerId).
  if (mode.keepers) {
    for (const team of [0, 1]) {
      const mine = slots.filter((s) => s.team === team);
      const claimed = mine.find((s) => s.wantsKeeper);
      const chosen = claimed || mine.find((s) => s.kind === 'bot') || mine[0];
      chosen.role = 'keeper';
    }
  }
  for (const s of slots) delete s.wantsKeeper;

  const keepersPerTeam = [0, 1].map((t) => slots.filter((s) => s.team === t && s.role === 'keeper').length);
  const expected = mode.keepers ? 1 : 0;
  for (const team of [0, 1]) {
    if (keepersPerTeam[team] !== expected) {
      throw new RangeError(`team ${team} ended with ${keepersPerTeam[team]} keepers, expected ${expected}`);
    }
  }

  return {
    mode: mode.id,
    difficulty,
    seed,
    keepersPerTeam,
    slots,
    players: slots.map((s) => ({ team: s.team, role: s.role })),
    botSlots: slots.filter((s) => s.kind === 'bot').map((s) => s.index),
  };
}

/** Which slot a given lobby id ended up in, or -1. */
export function slotOf(roster, id) {
  const hit = roster.slots.find((s) => s.id === id);
  return hit ? hit.index : -1;
}

/** Turkish difficulty names, with the English aliases the bots package accepts. */
export function normaliseDifficulty(d) {
  const key = String(d == null ? 'orta' : d).toLowerCase();
  const alias = { easy: 'kolay', medium: 'orta', hard: 'zor' };
  const hit = alias[key] || key;
  if (!DIFFICULTIES.includes(hit)) {
    throw new RangeError(`unknown difficulty ${JSON.stringify(d)}`);
  }
  return hit;
}

function botName(index, difficulty) {
  const tag = { kolay: 'K', orta: 'O', zor: 'Z' }[difficulty];
  return `Bot ${tag}${index}`;
}
