// OpenSkill rating (feature matrix #33). Dependency-free, pure, clockless.
//
// MODEL — Plackett-Luce (Weng & Lin 2011, the "full ranking" Bayesian
// approximation OpenSkill implements as its default).
//
// Why Plackett-Luce and not Bradley-Terry full pairing:
//   * for the 2-team case they behave almost identically, but PL is defined
//     over an arbitrary number of ordered teams, so a future 3-way tournament
//     round or a free-for-all mode is the SAME code path instead of a second
//     model to keep in sync
//   * PL costs O(teams^2 + players) per match, and the arena caps at 12
//     players in at most 2 teams, so the quadratic term is 4
//   * BT full pairing double-counts every opponent pair when teams tie, which
//     is exactly the case a football match hits most often (a draw)
//
// Everything here is PURE. No Date, no performance, no Math.random: `now` is a
// millisecond number the caller supplies, and the same inputs always produce
// byte-identical outputs. That is what lets the test drive years of simulated
// inactivity in a loop.
//
// The update, for teams q = 1..k with ranks r_q (lower is better):
//
//   mu_q      = sum of member mu            sigma_q^2 = sum of member sigma^2
//   c         = sqrt( sum_q (sigma_q^2 + beta^2) )
//   sumQ[s]   = sum over teams t with r_t >= r_s of exp(mu_t / c)
//   A[s]      = how many teams share rank r_s   (tie divisor)
//
//   omega_q = (sigma_q^2 / c)   * SUM over s with r_s <= r_q of
//                                  ( [q == s] - exp(mu_q/c)/sumQ[s] ) / A[s]
//   delta_q = (sigma_q^2 / c^2) * SUM over s with r_s <= r_q of
//                                  ( p * (1 - p) ) / A[s]        with p as above
//   delta_q *= sqrt(sigma_q^2) / c                        (gamma, the PL damper)
//
//   mu_i'    = mu_i + (sigma_i^2 / sigma_q^2) * omega_q
//   sigma_i' = sigma_i * sqrt(max(1 - (sigma_i^2 / sigma_q^2) * delta_q, kappa))
//
// PLACEMENT. A player's first `placementGames` matches run the update on an
// INFLATED sigma: sigmaEff = sigma * boost, boost sliding linearly from
// placementSigmaBoost down to 1. Because omega scales with sigma_q^2, this is
// a principled "move faster while we know less" rather than a bolted-on
// multiplier, and the stored sigma is deflated by the same boost afterwards so
// sigma keeps meaning "settled uncertainty" throughout. The shrink factor is
// therefore never inflated, only the mu step.
//
// DECAY. Variance grows linearly with idle time past a grace period:
// sigma^2 += decayPerRootDay^2 * idleDays, clamped at the default sigma. Linear
// in variance means applying it in two halves equals applying it once, so a
// client that decays on every launch agrees with one that decays yearly.

export const RATING_DEFAULTS = Object.freeze({
  /** Prior skill mean. The whole scale is anchored here. */
  mu: 25,
  /** Prior standard deviation, and the ceiling decay may push sigma back to. */
  sigma: 25 / 3,
  /** Performance noise per player. OpenSkill's sigma/2. */
  beta: 25 / 6,
  /** Additive dynamics per match, so a settled rating never freezes solid. */
  tau: 25 / 300,
  /** Floor on the sigma shrink factor; stops sqrt of a negative. */
  kappa: 0.0001,
  /** Matches treated as placement. */
  placementGames: 8,
  /** Sigma multiplier at game 0, sliding to 1.0 at `placementGames`. */
  placementSigmaBoost: 1.5,
  /** Idle days tolerated before decay starts. */
  decayGraceDays: 7,
  /** sigma^2 gained per idle day past the grace period, as a std per sqrt-day. */
  decayPerRootDay: 0.35,
  /** Conservative-estimate z. display = mu - z*sigma. */
  displayZ: 3,
  /** display = round(ordinal * scale + offset), clamped to [0, displayMax]. */
  displayScale: 40,
  displayOffset: 1000,
  displayMax: 4000,
});

const DAY_MS = 86400000;

function opts(options) {
  return options ? { ...RATING_DEFAULTS, ...options } : RATING_DEFAULTS;
}

/** A brand new player. `now` seeds the decay clock; it is never read from Date. */
export function createRating(options = {}) {
  const o = opts(options);
  const now = Number.isFinite(options.now) ? options.now : 0;
  return {
    mu: o.mu,
    sigma: o.sigma,
    games: 0,
    lastPlayedAt: now,
    decayedAt: now,
  };
}

/** Coerce anything stored on disk back into a rating, filling in what is missing. */
export function normaliseRating(raw, options = {}) {
  const o = opts(options);
  const now = Number.isFinite(options.now) ? options.now : 0;
  if (!raw || typeof raw !== 'object') return createRating({ ...options, now });
  const mu = Number.isFinite(raw.mu) ? raw.mu : o.mu;
  const sigma = Number.isFinite(raw.sigma) && raw.sigma > 0 ? Math.min(raw.sigma, o.sigma) : o.sigma;
  const games = Number.isInteger(raw.games) && raw.games >= 0 ? raw.games : 0;
  const lastPlayedAt = Number.isFinite(raw.lastPlayedAt) ? raw.lastPlayedAt : now;
  const decayedAt = Number.isFinite(raw.decayedAt) ? raw.decayedAt : lastPlayedAt;
  return { mu, sigma, games, lastPlayedAt, decayedAt };
}

/** Sigma multiplier this player's next update runs at. 1.0 once placed. */
export function placementBoost(games, options = {}) {
  const o = opts(options);
  if (!(o.placementGames > 0) || games >= o.placementGames) return 1;
  const left = (o.placementGames - games) / o.placementGames;
  return 1 + (o.placementSigmaBoost - 1) * left;
}

/** True while the player is still inside their placement window. */
export function isPlacement(rating, options = {}) {
  return rating.games < opts(options).placementGames;
}

/**
 * Grow sigma for time spent away. Pure: `now` is an argument, and the result
 * carries `decayedAt` so repeated application is additive rather than
 * compounding.
 */
export function applyDecay(rating, now, options = {}) {
  const o = opts(options);
  const from = Number.isFinite(rating.decayedAt) ? rating.decayedAt : rating.lastPlayedAt;
  const idleDays = (now - from) / DAY_MS - o.decayGraceDays;
  if (!(idleDays > 0)) return rating;
  const grown = Math.sqrt(rating.sigma * rating.sigma + o.decayPerRootDay * o.decayPerRootDay * idleDays);
  return { ...rating, sigma: Math.min(o.sigma, grown), decayedAt: now };
}

/** Conservative skill estimate: mu minus z sigmas. */
export function ordinal(rating, options = {}) {
  const o = opts(options);
  return rating.mu - o.displayZ * rating.sigma;
}

/** The number a player is shown. Clamped, integral, monotone in `ordinal`. */
export function displayRating(rating, options = {}) {
  const o = opts(options);
  const raw = Math.round(ordinal(rating, options) * o.displayScale + o.displayOffset);
  return Math.max(0, Math.min(o.displayMax, raw));
}

/** Ranked bands. `min` is inclusive; the last tier has no ceiling. */
export const TIERS = Object.freeze([
  Object.freeze({ id: 'demir', name: 'Demir', min: 0 }),
  Object.freeze({ id: 'bronz', name: 'Bronz', min: 900 }),
  Object.freeze({ id: 'gumus', name: 'Gümüş', min: 1150 }),
  Object.freeze({ id: 'altin', name: 'Altın', min: 1400 }),
  Object.freeze({ id: 'platin', name: 'Platin', min: 1650 }),
  Object.freeze({ id: 'elmas', name: 'Elmas', min: 1900 }),
  Object.freeze({ id: 'usta', name: 'Usta', min: 2150 }),
  Object.freeze({ id: 'efsane', name: 'Efsane', min: 2400 }),
]);

/** Tier for a display number. Always returns a tier; never null. */
export function tierOf(display) {
  let found = TIERS[0];
  for (const t of TIERS) if (display >= t.min) found = t;
  return found;
}

/** Tier straight from a rating. */
export function tierOfRating(rating, options = {}) {
  return tierOf(displayRating(rating, options));
}

// ------------------------------------------------------------------ the update

function ranksFrom(teams, options) {
  if (Array.isArray(options.ranks)) {
    if (options.ranks.length !== teams.length) {
      throw new RangeError(`ranks has ${options.ranks.length} entries for ${teams.length} teams`);
    }
    for (const r of options.ranks) {
      if (!Number.isFinite(r)) throw new RangeError(`rank ${r} is not finite`);
    }
    return options.ranks.slice();
  }
  if (Array.isArray(options.scores)) {
    if (options.scores.length !== teams.length) {
      throw new RangeError(`scores has ${options.scores.length} entries for ${teams.length} teams`);
    }
    // higher score = better = lower rank, ties share a rank
    const sorted = [...new Set(options.scores)].sort((a, b) => b - a);
    return options.scores.map((s) => sorted.indexOf(s));
  }
  return teams.map((_, i) => i);
}

/**
 * rate(teams, options)
 *
 *   teams    array of arrays of ratings, one inner array per team
 *   options  { now, ranks | scores, ...RATING_DEFAULTS overrides }
 *
 * Returns a NEW array of arrays; no input object is mutated. `ranks` is lower
 * is better and ties are legal (a draw is [0, 0]). `scores` is the friendlier
 * form for a football match: rate([red, blue], { scores: [2, 1] }).
 */
export function rate(teams, options = {}) {
  const o = opts(options);
  const now = Number.isFinite(options.now) ? options.now : 0;

  if (!Array.isArray(teams) || teams.length < 2) {
    throw new RangeError('rate() needs at least two teams');
  }
  for (const t of teams) {
    if (!Array.isArray(t) || t.length === 0) throw new RangeError('every team needs at least one player');
    for (const p of t) {
      if (!p || !Number.isFinite(p.mu) || !(p.sigma > 0)) {
        throw new RangeError('every player needs a finite mu and a positive sigma');
      }
    }
  }
  const ranks = ranksFrom(teams, options);

  // 1. decay for time away, then the per-match dynamics bump, then placement
  //    inflation. `eff` is what the model sees; `boost` is how we get back.
  const prepared = teams.map((team) => team.map((p) => {
    const decayed = applyDecay(p, now, options);
    const sigmaTau = Math.min(o.sigma, Math.sqrt(decayed.sigma * decayed.sigma + o.tau * o.tau));
    const boost = placementBoost(decayed.games, options);
    return { src: p, decayed, sigmaTau, boost, sigmaEff: sigmaTau * boost };
  }));

  const teamMu = prepared.map((t) => t.reduce((a, p) => a + p.decayed.mu, 0));
  const teamVar = prepared.map((t) => t.reduce((a, p) => a + p.sigmaEff * p.sigmaEff, 0));

  const k = teams.length;
  let cSq = 0;
  for (let q = 0; q < k; q++) cSq += teamVar[q] + o.beta * o.beta;
  const c = Math.sqrt(cSq);

  const expMu = teamMu.map((m) => Math.exp(m / c));

  // sumQ[s] = sum of exp(mu_t/c) over teams t that finished at or behind s
  const sumQ = new Array(k).fill(0);
  for (let s = 0; s < k; s++) {
    let acc = 0;
    for (let t = 0; t < k; t++) if (ranks[t] >= ranks[s]) acc += expMu[t];
    sumQ[s] = acc;
  }
  // A[s] = teams sharing rank s
  const tieCount = new Array(k).fill(0);
  for (let s = 0; s < k; s++) {
    let n = 0;
    for (let t = 0; t < k; t++) if (ranks[t] === ranks[s]) n++;
    tieCount[s] = n;
  }

  const out = [];
  for (let q = 0; q < k; q++) {
    let omega = 0;
    let delta = 0;
    for (let s = 0; s < k; s++) {
      if (ranks[s] > ranks[q]) continue;
      const p = expMu[q] / sumQ[s];
      delta += (p * (1 - p)) / tieCount[s];
      omega += ((q === s ? 1 : 0) - p) / tieCount[s];
    }
    omega *= teamVar[q] / c;
    delta *= teamVar[q] / cSq;
    delta *= Math.sqrt(teamVar[q]) / c; // gamma

    const team = [];
    for (const p of prepared[q]) {
      const share = (p.sigmaEff * p.sigmaEff) / teamVar[q];
      const mu = p.decayed.mu + share * omega;
      const shrink = Math.sqrt(Math.max(1 - share * delta, o.kappa));
      // deflate by the same boost the update was inflated with, so `sigma`
      // always means settled uncertainty and can only fall on a played match
      const sigma = Math.min(o.sigma, (p.sigmaEff * shrink) / p.boost);
      team.push({
        mu,
        sigma,
        games: p.decayed.games + 1,
        lastPlayedAt: now,
        decayedAt: now,
      });
    }
    out.push(team);
  }
  return out;
}

/**
 * The common case: one football match, two teams, a scoreline. Returns
 * { red, blue } arrays in the order they were handed in.
 */
export function rateMatch({ red, blue, scoreRed, scoreBlue, now = 0, options = {} }) {
  const [a, b] = rate([red, blue], { ...options, now, scores: [scoreRed, scoreBlue] });
  return { red: a, blue: b };
}
