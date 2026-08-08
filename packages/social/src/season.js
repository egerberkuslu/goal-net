// Seasons (feature matrix #34): soft reset, finishing badges, stored records.
//
// SOFT RESET FORMULA. A season close is not a wipe — a player who ground to
// Elmas should still start above a player who never left Bronz, they should
// just have to prove it again. Three lines do that:
//
//   mu'     = MU0 + (mu - MU0) * compression                 compression = 0.5
//   sigma'  = min(SIGMA0, sqrt(sigma^2 + sigmaKick^2))       sigmaKick   = 3
//   games'  = min(games, carryGames)                         carryGames  = 4
//
//   * the mu line is a strictly increasing affine map, so the ORDER of the
//     ladder survives exactly while the SPREAD around the prior mean halves.
//     Nobody overtakes anybody by sitting out a reset
//   * the sigma line hands back uncertainty in variance space (the same units
//     decay works in), so the opening matches of a season move fast again
//   * clipping games back below `placementGames` re-opens the placement window
//     without pretending the player is new
//
// BADGES are the finishing tier, minted once, immutable, and keyed by season so
// a profile can show "S1 Elmas, S2 Usta". Nothing here is cosmetic-only by
// accident: badges never feed back into mu, sigma or matchmaking.
//
// Persistence is INJECTED. `createSocialStore({ load, save })` knows the shape
// of the blob and nothing about where it lives, so localStorage, a file and a
// server row are the same three lines of glue.

import {
  RATING_DEFAULTS,
  createRating,
  displayRating,
  normaliseRating,
  tierOf,
} from './rating.js';

export const SEASON_DEFAULTS = Object.freeze({
  /** How far mu is pulled toward the prior mean. 1 = no reset, 0 = full wipe. */
  compression: 0.5,
  /** Uncertainty handed back at the reset, in sigma units. */
  sigmaKick: 3,
  /** Games carried into the new season; the rest of placement is redone. */
  carryGames: 4,
  /** Matches a player must have finished to be ranked in the season record. */
  placedGames: 8,
  /** Nominal season length, for UI only. Nothing here reads a clock. */
  seasonDays: 75,
});

function opts(options) {
  return options ? { ...SEASON_DEFAULTS, ...options } : SEASON_DEFAULTS;
}

/**
 * One player's soft reset. Pure, order-preserving, idempotent only in the sense
 * that applying it twice compresses twice — call it once per season close.
 */
export function softReset(rating, options = {}) {
  const s = opts(options);
  const r = { ...RATING_DEFAULTS, ...options };
  const now = Number.isFinite(options.now) ? options.now : rating.lastPlayedAt;
  const mu = r.mu + (rating.mu - r.mu) * s.compression;
  const sigma = Math.min(r.sigma, Math.sqrt(rating.sigma * rating.sigma + s.sigmaKick * s.sigmaKick));
  return {
    mu,
    sigma,
    games: Math.min(rating.games, s.carryGames),
    lastPlayedAt: now,
    decayedAt: now,
  };
}

/** The badge a finishing rating earns. Cosmetic, permanent, never fed back. */
export function seasonBadge(seasonId, id, rating, now, options = {}) {
  const s = opts(options);
  const display = displayRating(rating, options);
  const tier = tierOf(display);
  return Object.freeze({
    id: `s${seasonId}-${tier.id}`,
    seasonId,
    playerId: id,
    tier: tier.id,
    tierName: tier.name,
    display,
    games: rating.games,
    placed: rating.games >= s.placedGames,
    at: now,
  });
}

/**
 * Close a season.
 *
 *   ratings  { [playerId]: rating }
 *   returns  { record, ratings, badges }
 *
 * `record` is the frozen leaderboard, `ratings` is the soft-reset map to carry
 * forward, `badges` is { [playerId]: badge }. Ranking is by display descending
 * with the player id as the tie-break, so two runs over the same data produce
 * the same table.
 */
export function closeSeason({ seasonId, ratings, now = 0, options = {} }) {
  if (!Number.isInteger(seasonId) || seasonId < 0) {
    throw new RangeError(`seasonId ${seasonId} must be a non-negative integer`);
  }
  if (!ratings || typeof ratings !== 'object') throw new TypeError('ratings must be an object map');
  const s = opts(options);

  const ids = Object.keys(ratings).sort();
  const rows = ids.map((id) => {
    const r = normaliseRating(ratings[id], { ...options, now });
    const display = displayRating(r, options);
    const tier = tierOf(display);
    return {
      id,
      mu: r.mu,
      sigma: r.sigma,
      games: r.games,
      display,
      tier: tier.id,
      tierName: tier.name,
      placed: r.games >= s.placedGames,
      rank: 0,
    };
  });
  rows.sort((a, b) => (b.display - a.display) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let rank = 0;
  for (const row of rows) {
    // unplaced players appear in the record but never take a ladder position
    row.rank = row.placed ? ++rank : 0;
  }

  const badges = {};
  const next = {};
  for (const id of ids) {
    const r = normaliseRating(ratings[id], { ...options, now });
    badges[id] = seasonBadge(seasonId, id, r, now, options);
    next[id] = softReset(r, { ...options, now });
  }

  return {
    record: {
      seasonId,
      closedAt: now,
      compression: s.compression,
      sigmaKick: s.sigmaKick,
      entries: rows,
    },
    ratings: next,
    badges,
  };
}

// ------------------------------------------------------------- persistence

export const STORE_VERSION = 1;

function emptyState(now) {
  return {
    version: STORE_VERSION,
    seasonId: 1,
    seasonStartedAt: now,
    ratings: {},
    badges: {},
    seasons: [],
  };
}

/**
 * createSocialStore({ load, save, now })
 *
 *   load()      => the previously saved plain object, or null/undefined
 *   save(state) => persist a plain object. Called after every mutation.
 *
 * Both are injected, both are synchronous, and neither is called with anything
 * that is not JSON-serialisable. A corrupt or foreign blob is discarded rather
 * than trusted: this is a trust boundary too, just a much smaller one than the
 * wire.
 */
export function createSocialStore({ load, save, now = 0, options = {} } = {}) {
  const read = typeof load === 'function' ? load : () => null;
  const write = typeof save === 'function' ? save : () => {};

  let state;
  try {
    const raw = read();
    state = raw && typeof raw === 'object' && raw.version === STORE_VERSION
      ? {
        version: STORE_VERSION,
        seasonId: Number.isInteger(raw.seasonId) && raw.seasonId > 0 ? raw.seasonId : 1,
        seasonStartedAt: Number.isFinite(raw.seasonStartedAt) ? raw.seasonStartedAt : now,
        ratings: raw.ratings && typeof raw.ratings === 'object' ? { ...raw.ratings } : {},
        badges: raw.badges && typeof raw.badges === 'object' ? { ...raw.badges } : {},
        seasons: Array.isArray(raw.seasons) ? raw.seasons.slice() : [],
      }
      : emptyState(now);
  } catch {
    state = emptyState(now);
  }

  function flush() {
    try {
      write(state);
    } catch {
      // a full quota or a locked-down storage must not take the match down
    }
  }

  return {
    get seasonId() { return state.seasonId; },
    state() { return state; },

    /** Rating for a player, created (and stored) on first sight. */
    rating(id, at = now) {
      const stored = state.ratings[id];
      if (stored) return normaliseRating(stored, { ...options, now: at });
      const fresh = createRating({ ...options, now: at });
      state.ratings[id] = fresh;
      flush();
      return fresh;
    },

    putRating(id, rating) {
      state.ratings[id] = { ...rating };
      flush();
      return state.ratings[id];
    },

    putRatings(map) {
      for (const [id, r] of Object.entries(map)) state.ratings[id] = { ...r };
      flush();
    },

    badgesOf(id) {
      const list = state.badges[id];
      return Array.isArray(list) ? list.slice() : [];
    },

    addBadge(id, badge) {
      const list = Array.isArray(state.badges[id]) ? state.badges[id].slice() : [];
      if (!list.some((b) => b.id === badge.id && b.seasonId === badge.seasonId)) list.push(badge);
      state.badges[id] = list;
      flush();
      return list;
    },

    seasons() { return state.seasons.slice(); },

    /**
     * Close the live season, mint badges, soft-reset every rating and open the
     * next one. Returns the frozen record.
     */
    closeSeason(at = now) {
      const { record, ratings, badges } = closeSeason({
        seasonId: state.seasonId,
        ratings: state.ratings,
        now: at,
        options,
      });
      state.seasons.push(record);
      state.ratings = ratings;
      for (const [id, badge] of Object.entries(badges)) {
        const list = Array.isArray(state.badges[id]) ? state.badges[id].slice() : [];
        if (!list.some((b) => b.id === badge.id && b.seasonId === badge.seasonId)) list.push(badge);
        state.badges[id] = list;
      }
      state.seasonId += 1;
      state.seasonStartedAt = at;
      flush();
      return record;
    },
  };
}

/** In-memory load/save pair. The tests run on this; so does a guest session. */
export function memoryStore(seed = null) {
  let blob = seed ? JSON.parse(JSON.stringify(seed)) : null;
  return {
    load: () => (blob ? JSON.parse(JSON.stringify(blob)) : null),
    save: (state) => { blob = JSON.parse(JSON.stringify(state)); },
    peek: () => blob,
  };
}

/**
 * localStorage (or any Web Storage lookalike) load/save pair. Nothing here
 * imports `window`; the storage object is handed in, so node can drive it.
 */
export function webStorageStore(storage, key = 'goalnet.social.v1') {
  return {
    load: () => {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    },
    save: (state) => { storage.setItem(key, JSON.stringify(state)); },
  };
}
