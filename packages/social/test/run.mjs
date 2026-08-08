// Headless gate for @goalnet/social. No DOM, no sockets, no real clock: every
// claim is driven by a synthetic millisecond loop and a seeded generator, so a
// run on a laptop and a run in CI produce the same numbers to the last digit.
//
//   node test/run.mjs   PASS/FAIL lines, measured tables, non-zero exit on fail
//
// The load-bearing claims, in order:
//   1. a consistently stronger team's mu separates, and sigma shrinks with games
//   2. a placement match moves a rating further than the same match does once
//      the player is settled
//   3. sigma grows with simulated time away, and is capped at the prior
//   4. a season close compresses the spread by exactly the documented factor,
//      preserves the order, and hands out the tier the player finished in
//   5. host cost for spectators is FLAT past the baseline cap: 16 spectators
//      cost the same encoding work as 3, and a spectator cannot inject input
//   6. the name filter catches homoglyph and leet variants while passing a
//      corpus of legitimate Turkish words
//   7. quick chat refuses on cooldown, gags a burst, and mutes locally

import {
  createHostSession,
  encodeInput,
  encodeDeltaWords,
  encodeSnapshotMessages,
  stateChecksumInt,
} from '../../net/src/index.js';

import {
  ALLOWLIST,
  BLOCKLIST_LONG,
  BLOCKLIST_SHORT,
  CHAT_KIND,
  EMOTES,
  QUICK_PHRASES,
  RATING_DEFAULTS,
  SEASON_DEFAULTS,
  SOCIAL_VERSION_STRING,
  SPECTATE_REASON,
  SocialProtocolError,
  applyDecay,
  blockedTerm,
  canChangeTag,
  closeSeason,
  createChatGuard,
  createMuteList,
  createRating,
  createSocialStore,
  createSpectatorDesk,
  decodeSocial,
  displayRating,
  encodeChat,
  encodeSpectate,
  encodeSpectateAck,
  formatDisplayName,
  isAllowedName,
  isAllowedTag,
  isSocialFrame,
  memoryStore,
  normaliseName,
  ordinal,
  placementBoost,
  rate,
  rateMatch,
  softReset,
  tierOf,
} from '../src/index.js';

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`PASS  ${name}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
const section = (t) => console.log(`\n--- ${t}`);
const round = (v, n = 3) => Number(v.toFixed(n));
const DAY = 86400000;

/** mulberry32: 32 bits of state, no dependencies, identical everywhere. */
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
function stdev(xs) {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))));
}

// ===================================================================== rating

section('#33 rating — OpenSkill Plackett-Luce');

{
  const r = createRating({ now: 0 });
  check('a new rating starts at the prior',
    r.mu === RATING_DEFAULTS.mu && r.sigma === RATING_DEFAULTS.sigma && r.games === 0,
    JSON.stringify(r));
  check('the prior displays at the offset', displayRating(r) === RATING_DEFAULTS.displayOffset,
    `${displayRating(r)}`);
  check('ordinal is the conservative estimate mu - 3 sigma',
    round(ordinal(r)) === round(RATING_DEFAULTS.mu - 3 * RATING_DEFAULTS.sigma));
}

{
  // a 1v1 the first player wins: the winner gains exactly what the loser drops,
  // because a two-team Plackett-Luce update is antisymmetric at equal sigma
  const a = createRating();
  const b = createRating();
  const [[a1], [b1]] = rate([[a], [b]], { ranks: [0, 1], now: 0 });
  check('a win raises mu and a loss lowers it', a1.mu > a.mu && b1.mu < b.mu,
    `${round(a1.mu)} / ${round(b1.mu)}`);
  check('equal ratings move symmetrically', round(a1.mu - a.mu, 9) === round(b.mu - b1.mu, 9),
    `${round(a1.mu - a.mu, 6)} vs ${round(b.mu - b1.mu, 6)}`);
  check('a played match shrinks sigma', a1.sigma < a.sigma && b1.sigma < b.sigma,
    `${round(a1.sigma)} / ${round(b1.sigma)}`);
  check('the inputs were not mutated', a.mu === RATING_DEFAULTS.mu && a.games === 0);

  const [[d0], [d1]] = rate([[createRating()], [createRating()]], { ranks: [0, 0], now: 0 });
  check('a draw between equals leaves mu alone', round(d0.mu, 9) === round(d1.mu, 9)
    && round(d0.mu, 6) === RATING_DEFAULTS.mu, `${round(d0.mu, 6)}`);
  check('a draw still shrinks sigma', d0.sigma < RATING_DEFAULTS.sigma, `${round(d0.sigma)}`);
}

// Convergence: 4v4, the red side latently stronger, outcomes drawn from a
// seeded logistic on the latent gap. Nothing about the true skills reaches the
// rater; it only ever sees win/lose/draw.
const conv = (() => {
  const rng = makeRng(0x5eed);
  const latent = { red: [1.0, 0.9, 1.1, 1.0], blue: [-1.0, -0.9, -1.1, -1.0] };
  let red = latent.red.map(() => createRating({ now: 0 }));
  let blue = latent.blue.map(() => createRating({ now: 0 }));
  const trail = [];
  const MATCHES = 80;
  for (let m = 0; m < MATCHES; m++) {
    const gap = mean(latent.red) - mean(latent.blue);
    const pRed = 1 / (1 + Math.exp(-gap));
    const roll = rng();
    const scores = roll < pRed * 0.9 ? [2, 1] : roll < pRed * 0.9 + 0.08 ? [1, 1] : [1, 2];
    const out = rateMatch({
      red, blue, scoreRed: scores[0], scoreBlue: scores[1], now: m * 600000,
    });
    red = out.red;
    blue = out.blue;
    if (m === 4 || m === 19 || m === 79) {
      trail.push({ m: m + 1, red: mean(red.map((r) => r.mu)), blue: mean(blue.map((r) => r.mu)), sigma: mean(red.map((r) => r.sigma)) });
    }
  }
  return { red, blue, trail };
})();

// The same 80 matches in a 1v1, as the control: one result per player instead
// of one shared between four.
const solo = (() => {
  const rng = makeRng(0xa11ce);
  let a = createRating({ now: 0 });
  let b = createRating({ now: 0 });
  for (let m = 0; m < 80; m++) {
    const win = rng() < 0.75;
    const [[a1], [b1]] = rate([[a], [b]], { ranks: win ? [0, 1] : [1, 0], now: m * 600000 });
    a = a1;
    b = b1;
  }
  return { a, b, sigma: a.sigma, gap: a.mu - b.mu };
})();

{
  const muRed = mean(conv.red.map((r) => r.mu));
  const muBlue = mean(conv.blue.map((r) => r.mu));
  const sigRed = mean(conv.red.map((r) => r.sigma));
  check('the stronger side separates in mu', muRed - muBlue > 4,
    `gap ${round(muRed - muBlue, 2)}`);
  // 4v4 shares one result between four players, so per-player information is a
  // quarter of what a 1v1 delivers and sigma settles correspondingly slower.
  // Both are asserted, because only comparing them shows the model is behaving.
  check('sigma shrank below the prior after 80 team games',
    sigRed < RATING_DEFAULTS.sigma * 0.75, `${round(sigRed, 3)}`);
  check('a 1v1 run of the same length settles much further', solo.sigma < sigRed * 0.6,
    `1v1 ${round(solo.sigma, 3)} vs 4v4 ${round(sigRed, 3)}`);
  check('every rating counted its games', conv.red.every((r) => r.games === 80));
  check('the display gap is visible to a player',
    displayRating(conv.red[0]) - displayRating(conv.blue[0]) > 300,
    `${displayRating(conv.red[0])} vs ${displayRating(conv.blue[0])}`);
  // The gap widens fast while sigma is large and then holds: it is a posterior
  // mean, not a running total, so an upset walks it back and it must not drift.
  check('separation opens early and then holds',
    conv.trail[0].red - conv.trail[0].blue < conv.trail[1].red - conv.trail[1].blue
    && conv.trail[2].red - conv.trail[2].blue > 8,
    conv.trail.map((t) => `${t.m}:${round(t.red - t.blue, 2)}`).join(' '));
  check('sigma is monotone non-increasing across the run',
    conv.trail[0].sigma > conv.trail[1].sigma && conv.trail[1].sigma > conv.trail[2].sigma,
    conv.trail.map((t) => `${t.m}:${round(t.sigma, 3)}`).join(' '));
}

// Placement: the SAME match, once against a fresh player and once against the
// same player after the placement window has closed at the same sigma.
const placement = (() => {
  const opponent = () => ({ mu: 30, sigma: 3, games: 50, lastPlayedAt: 0, decayedAt: 0 });
  const fresh = { mu: 25, sigma: 6, games: 0, lastPlayedAt: 0, decayedAt: 0 };
  const settled = { ...fresh, games: RATING_DEFAULTS.placementGames };
  const [[f1]] = rate([[fresh], [opponent()]], { ranks: [0, 1], now: 0 });
  const [[s1]] = rate([[settled], [opponent()]], { ranks: [0, 1], now: 0 });
  return { fresh, settled, f1, s1, dFresh: f1.mu - fresh.mu, dSettled: s1.mu - settled.mu };
})();

{
  check('a placement win moves mu further than a settled win',
    placement.dFresh > placement.dSettled * 1.4,
    `${round(placement.dFresh, 3)} vs ${round(placement.dSettled, 3)}`);
  check('placement boost slides from the configured peak down to 1',
    round(placementBoost(0), 6) === RATING_DEFAULTS.placementSigmaBoost
    && placementBoost(RATING_DEFAULTS.placementGames) === 1
    && placementBoost(RATING_DEFAULTS.placementGames - 1) > 1,
    `${round(placementBoost(0), 3)} / ${round(placementBoost(4), 3)} / ${placementBoost(8)}`);
  check('the boost never leaks into stored sigma',
    placement.f1.sigma <= placement.fresh.sigma,
    `${round(placement.f1.sigma, 4)} <= ${placement.fresh.sigma}`);
}

// Decay
{
  const settled = { mu: 30, sigma: 2.5, games: 40, lastPlayedAt: 0, decayedAt: 0 };
  const inGrace = applyDecay(settled, 5 * DAY, {});
  const after30 = applyDecay(settled, 30 * DAY, {});
  const after200 = applyDecay(settled, 200 * DAY, {});
  const after2000 = applyDecay(settled, 2000 * DAY, {});
  check('inside the grace window nothing decays', inGrace.sigma === settled.sigma);
  check('sigma grows with time away',
    after30.sigma > settled.sigma && after200.sigma > after30.sigma,
    `${round(after30.sigma, 3)} then ${round(after200.sigma, 3)}`);
  check('decay is capped at the prior sigma',
    after2000.sigma === RATING_DEFAULTS.sigma, `${round(after2000.sigma, 4)}`);
  check('decay never touches mu', after200.mu === settled.mu);
  check('decay lowers the conservative display', displayRating(after200) < displayRating(settled),
    `${displayRating(after200)} < ${displayRating(settled)}`);

  // Variance is linear in time, so two steps covering the same idle days as one
  // land in the same place. The second call is offset by the grace window,
  // which each call subtracts once.
  const half = applyDecay(settled, 100 * DAY, {});
  const twoSteps = applyDecay(half, (200 + RATING_DEFAULTS.decayGraceDays) * DAY, {});
  check('decay applied in two steps equals one step over the same idle days',
    Math.abs(twoSteps.sigma - after200.sigma) < 1e-9,
    `${round(twoSteps.sigma, 6)} vs ${round(after200.sigma, 6)}`);

  // and a decayed player moves faster again on their return
  const returning = applyDecay(settled, 400 * DAY, {});
  const opp = { mu: 30, sigma: 2.5, games: 40, lastPlayedAt: 0, decayedAt: 0 };
  const [[cold]] = rate([[{ ...returning, decayedAt: 400 * DAY, lastPlayedAt: 0 }], [opp]], { ranks: [0, 1], now: 400 * DAY });
  const [[warm]] = rate([[{ ...settled, lastPlayedAt: 400 * DAY, decayedAt: 400 * DAY }], [opp]], { ranks: [0, 1], now: 400 * DAY });
  check('a returning player moves faster than one who never left',
    cold.mu - returning.mu > warm.mu - settled.mu,
    `${round(cold.mu - returning.mu, 3)} vs ${round(warm.mu - settled.mu, 3)}`);
}

// Tiers and purity
{
  const names = [0, 899, 900, 1399, 1400, 1899, 2400, 4000].map((d) => tierOf(d).id);
  check('the tier table is ordered and total',
    names[0] === 'demir' && names[2] === 'bronz' && names[4] === 'altin' && names[7] === 'efsane',
    names.join(','));
  const a = createRating();
  const b = createRating();
  const one = rate([[a], [b]], { ranks: [0, 1], now: 0 });
  const two = rate([[a], [b]], { ranks: [0, 1], now: 0 });
  check('rate() is pure: same input, identical output',
    JSON.stringify(one) === JSON.stringify(two));
  const byScore = rate([[a], [b]], { scores: [3, 1], now: 0 });
  check('scores and ranks are the same call', JSON.stringify(byScore) === JSON.stringify(one));
  const tie = rate([[a], [b]], { scores: [2, 2], now: 0 });
  check('an equal scoreline is a tie', round(tie[0][0].mu, 9) === round(tie[1][0].mu, 9));

  let threw = null;
  try { rate([[a]], { now: 0 }); } catch (e) { threw = e; }
  check('rate() refuses a single team', threw instanceof RangeError);
}

// ===================================================================== season

section('#34 season — soft reset and badges');

const seasonRun = (() => {
  const rng = makeRng(9001);
  const ratings = {};
  for (let i = 0; i < 24; i++) {
    const skill = (rng() - 0.5) * 18;
    ratings[`p${String(i).padStart(2, '0')}`] = {
      mu: RATING_DEFAULTS.mu + skill,
      sigma: 2 + rng() * 2,
      games: i < 4 ? 3 : 12 + Math.floor(rng() * 40),
      lastPlayedAt: 0,
      decayedAt: 0,
    };
  }
  const before = Object.values(ratings).map((r) => r.mu);
  const out = closeSeason({ seasonId: 1, ratings, now: 90 * DAY });
  const after = Object.keys(ratings).map((id) => out.ratings[id].mu);
  return { ratings, before, after, out };
})();

{
  const { before, after, out, ratings } = seasonRun;
  const ratio = stdev(after) / stdev(before);
  check('the soft reset compresses the spread by the documented factor',
    Math.abs(ratio - SEASON_DEFAULTS.compression) < 1e-9,
    `sd ${round(stdev(before), 3)} -> ${round(stdev(after), 3)} (x${round(ratio, 4)})`);
  check('the reset preserves the ladder order',
    Object.keys(ratings).every((id) => Object.keys(ratings).every((jd) => (
      ratings[id].mu <= ratings[jd].mu ? out.ratings[id].mu <= out.ratings[jd].mu + 1e-12 : true
    ))));
  check('the reset hands uncertainty back without exceeding the prior',
    Object.keys(ratings).every((id) => out.ratings[id].sigma > ratings[id].sigma
      && out.ratings[id].sigma <= RATING_DEFAULTS.sigma));
  check('the reset re-opens the placement window',
    Object.keys(ratings).every((id) => out.ratings[id].games <= SEASON_DEFAULTS.carryGames));

  const top = out.record.entries[0];
  check('the record is ranked by display, best first',
    out.record.entries.every((e, i) => i === 0 || out.record.entries[i - 1].display >= e.display));
  check('the finishing badge is the finishing tier',
    out.badges[top.id].tier === tierOf(top.display).id
    && out.badges[top.id].seasonId === 1,
    `${top.id} ${top.display} ${out.badges[top.id].tier}`);
  check('unplaced players are recorded but unranked',
    out.record.entries.filter((e) => !e.placed).every((e) => e.rank === 0)
    && out.record.entries.filter((e) => e.placed).every((e) => e.rank > 0));
  check('badges are cosmetic: they carry no mu or sigma back',
    Object.values(out.badges).every((b) => b.mu === undefined && b.sigma === undefined));

  // manual arithmetic against the documented formula
  const probe = { mu: 41, sigma: 2, games: 60, lastPlayedAt: 0, decayedAt: 0 };
  const reset = softReset(probe, {});
  const wantMu = RATING_DEFAULTS.mu + (41 - RATING_DEFAULTS.mu) * SEASON_DEFAULTS.compression;
  const wantSigma = Math.min(RATING_DEFAULTS.sigma, Math.sqrt(4 + SEASON_DEFAULTS.sigmaKick ** 2));
  check('softReset matches the formula in the header',
    round(reset.mu, 9) === round(wantMu, 9) && round(reset.sigma, 9) === round(wantSigma, 9),
    `${round(reset.mu, 4)} / ${round(reset.sigma, 4)}`);
}

{
  const backing = memoryStore();
  const store = createSocialStore({ ...backing, now: 0 });
  const r = store.rating('ege');
  check('the store mints a rating on first sight', r.mu === RATING_DEFAULTS.mu);
  store.putRating('ege', { ...r, mu: 38, sigma: 2, games: 30 });
  store.putRating('rakip', { mu: 20, sigma: 2, games: 30, lastPlayedAt: 0, decayedAt: 0 });
  const record = store.closeSeason(90 * DAY);
  check('closing a season advances the season id', store.seasonId === 2);
  check('closing a season files the record', store.seasons().length === 1 && record.seasonId === 1);
  check('closing a season mints one badge per player',
    store.badgesOf('ege').length === 1 && store.badgesOf('rakip').length === 1,
    store.badgesOf('ege').map((b) => b.id).join(','));

  const reloaded = createSocialStore({ ...backing, now: 90 * DAY });
  check('the store round-trips through injected load/save',
    reloaded.seasonId === 2 && reloaded.badgesOf('ege').length === 1
    && Math.abs(reloaded.rating('ege').mu - store.rating('ege').mu) < 1e-9);
  check('the persisted blob is plain JSON',
    JSON.parse(JSON.stringify(backing.peek())).version === 1);

  const hostile = createSocialStore({ load: () => ({ version: 99, ratings: 'nope' }), save: () => {} , now: 0 });
  check('a foreign or corrupt blob is discarded, not trusted',
    hostile.seasonId === 1 && Object.keys(hostile.state().ratings).length === 0);
  const throwing = createSocialStore({ load: () => { throw new Error('quota'); }, save: () => { throw new Error('quota'); }, now: 0 });
  throwing.putRating('x', createRating());
  check('a storage that throws does not take the match down', throwing.rating('x').mu === RATING_DEFAULTS.mu);
}

// ================================================================== spectator

section('#35 spectator mode — bounded host cost');

/**
 * Drive a real 8-player host session for `seconds` of simulated time with
 * `count` spectators seated, encoding real payloads with @goalnet/net, and
 * report what the host actually spent.
 */
function runGallery(count, { seconds = 20, deskOptions = {} } = {}) {
  const host = createHostSession({
    playerCount: 8,
    hostPlayerId: 0,
    snapshotHz: 20,
    botSlots: [1, 2, 3, 4, 5, 6, 7],
    // deterministic motion so the deltas are the size a live match produces
    botPolicy: ({ tick, playerIndex }) => ({
      moveX: Math.cos((tick + playerIndex * 37) / 24),
      moveZ: Math.sin((tick + playerIndex * 53) / 31),
      kick: (tick + playerIndex) % 47 === 0,
    }),
  });
  const desk = createSpectatorDesk(deskOptions);
  const admitted = [];
  for (let i = 0; i < count; i++) {
    const res = desk.admit(`spec${i}`, 0);
    if (res.ok) admitted.push(`spec${i}`);
  }

  const history = new Map();
  const ackSeqs = new Uint32Array(8);
  let seq = 0;
  let naivePayloads = 0;
  let maxGroups = 0;

  for (let ms = 0; ms <= seconds * 1000; ms += 16) {
    host.update(ms);
    const p = desk.plan(ms, { tick: host.tick });
    if (!p.due || p.groups.length === 0) continue;
    const state = host.snapshot();
    const checksum = stateChecksumInt(state);
    history.set(host.tick, state);
    seq = (seq + 1) >>> 0;
    maxGroups = Math.max(maxGroups, p.groups.length);
    naivePayloads += admitted.length; // what one-baseline-per-spectator would cost

    for (const g of p.groups) {
      const base = g.kind === 'delta' ? history.get(g.baseTick) : null;
      const payload = base ? encodeDeltaWords(base, state) : state;
      const buffers = encodeSnapshotMessages({
        seq,
        tick: host.tick,
        baseTick: base ? g.baseTick : -1,
        checksum,
        playerCount: 8,
        ackSeqs,
        payload,
      });
      const bytes = buffers.reduce((a, b) => a + b.byteLength, 0);
      desk.noteSent(bytes, g.ids.length, ms);
      for (const id of g.ids) desk.noteAck(id, host.tick);
    }
    // keep the history bounded the way the host does
    for (const t of history.keys()) if (t < host.tick - 300) history.delete(t);
  }

  return {
    host,
    desk,
    admitted: admitted.length,
    naivePayloads,
    maxGroups,
    budget: desk.budget(seconds * 1000),
  };
}

const g4 = runGallery(4);
const g16 = runGallery(16, { deskOptions: { maxSpectators: 16, maxUplinkBytesPerSec: 512000 } });

{
  check('four spectators are seated', g4.admitted === 4);
  check('encoding work per broadcast is capped at maxBaselines + 1',
    g4.maxGroups <= g4.desk.options.maxBaselines + 1 && g16.maxGroups <= g16.desk.options.maxBaselines + 1,
    `4 spectators: ${g4.maxGroups} groups, 16 spectators: ${g16.maxGroups}`);
  check('encoding work does NOT grow with the gallery',
    g16.desk.stats.payloadsEncoded === g4.desk.stats.payloadsEncoded,
    `${g4.desk.stats.payloadsEncoded} vs ${g16.desk.stats.payloadsEncoded} payloads`);
  check('the naive one-baseline-per-spectator design would have cost far more',
    g16.naivePayloads > g16.desk.stats.payloadsEncoded * 4,
    `${g16.naivePayloads} vs ${g16.desk.stats.payloadsEncoded}`);
  check('four spectators stay inside the uplink budget',
    !g4.budget.overBudget && g4.budget.measuredBytesPerSec <= g4.desk.options.maxUplinkBytesPerSec,
    `${Math.round(g4.budget.measuredBytesPerSec)} B/s of ${g4.desk.options.maxUplinkBytesPerSec}`);
  check('spectators are served below the player snapshot rate',
    g4.desk.options.snapshotHz < g4.host.snapshotHz,
    `${g4.desk.options.snapshotHz} Hz vs ${g4.host.snapshotHz} Hz`);
}

{
  const desk = createSpectatorDesk({ maxSpectators: 4 });
  for (let i = 0; i < 4; i++) desk.admit(`s${i}`, 0);
  const over = desk.admit('s4', 0);
  check('the hard cap refuses with an explicit reason',
    !over.ok && over.reason === SPECTATE_REASON.CAP, JSON.stringify(over));
  check('a repeat request is refused as ALREADY',
    desk.admit('s0', 0).reason === SPECTATE_REASON.ALREADY);
  desk.release('s0');
  check('releasing a seat frees the cap', desk.admit('s4', 0).ok === true);
  check('a freed baseline is promoted, never left idle',
    desk.ids().filter((id) => desk.seat(id).private).length === desk.options.maxBaselines,
    desk.ids().map((id) => `${id}:${desk.seat(id).private}`).join(' '));

  const tight = createSpectatorDesk({ maxSpectators: 32, maxUplinkBytesPerSec: 2000, assumedPayloadBytes: 700 });
  const first = tight.admit('a', 0);
  check('the budget refuses before the uplink is oversold',
    !first.ok && first.reason === SPECTATE_REASON.BUDGET, JSON.stringify(first));

  const shut = createSpectatorDesk({ open: false });
  check('a closed room refuses with CLOSED', shut.admit('x', 0).reason === SPECTATE_REASON.CLOSED);
}

{
  // A spectator has no seat in the world, so the host does not even know it as
  // a peer: the input it forges is refused by the same code path a stranger's
  // input is, and the desk's own answer is unconditional.
  const { host, desk } = g4;
  const forged = encodeInput({ playerId: 3, seq: 999, tick: host.tick, moveXFx: 1000, kick: 1 });
  const res = host.receive('spec0', forged, 1000);
  check('a spectator cannot inject input into the host session',
    res.accepted === false && res.bucket === 'unknownPeer', JSON.stringify(res));
  const deskRes = desk.receiveInput('spec0');
  check('the desk refuses spectator input unconditionally',
    deskRes.accepted === false && deskRes.bucket === 'spectatorInput');
  check('spectators never hold input authority', desk.hasInputAuthority('spec0') === false);
  check('refused spectator input is counted', desk.stats.rejectedInputs >= 1);
  check('a spectator ack cannot forge a baseline for someone else',
    desk.noteAck('nobody', 10) === false);
}

// ====================================================================== names

section('#36 clan tag and name filter');

const MUST_BLOCK = [
  ['sik', 'plain'],
  ['SİK', 'turkish caps'],
  ['s.i.k', 'punctuation split'],
  ['s i k', 'space split'],
  ['siiik', 'repeat padding'],
  ['S1K', 'leet digit'],
  ['5!K', 'leet symbols'],
  ['ѕік', 'cyrillic homoglyphs'],
  ['ＳＩＫ', 'fullwidth'],
  ['sík', 'diacritic'],
  ['amk', 'abbreviation'],
  ['4MK', 'leet abbreviation'],
  ['a.m.k', 'split abbreviation'],
  ['orospu', 'plain long'],
  ['0r0spu', 'leet long'],
  ['oro$pu', 'symbol long'],
  ['0R0SPU cocuk', 'long inside a phrase'],
  ['yarrak', 'double letter'],
  ['fuck', 'english'],
  ['fu(k', 'symbol english'],
  ['f u c k', 'spaced english'],
  ['sh1t', 'leet english'],
  ['n4zi', 'leet nazi'],
  ['xXnazixX', 'nazi inside decoration'],
  ['nazixnazik', 'uncovered hit beside an allowlisted word'],
  ['piç', 'turkish diacritic'],
  ['göt', 'turkish o-umlaut'],
];

const MUST_PASS = [
  'sikayet', 'şikayet', 'Şikayetçi', 'sikke', 'psikoloji', 'eksik', 'kesik',
  'ışık', 'Aşık', 'klasik', 'müzik', 'fizik',
  'Kasımpaşa', 'Çanakkale', 'Çankaya', 'Diyarbakır', 'Şanlıurfa',
  'Beşiktaş', 'Fenerbahçe', 'Galatasaray', 'Trabzonspor', 'Göztepe',
  'götürmek', 'gotik', 'Mehmet', 'memleket', 'ocak', 'koçum', 'hoca',
  'amca', 'takım', 'kamera', 'nazik', 'Nazilli', 'rapor', 'analiz',
  'asistan', 'Dickens', 'Scunthorpe', 'grapes', 'aqua', 'Nigeria',
  'Ege', 'Berk', 'Kaleci Ali', 'Osman', 'Zeynep',
];

{
  const missed = MUST_BLOCK.filter(([n]) => isAllowedName(n).ok);
  check(`the filter catches all ${MUST_BLOCK.length} evasion variants`, missed.length === 0,
    missed.map(([n, why]) => `${n} (${why})`).join(', '));

  const falsePositives = MUST_PASS.filter((n) => !isAllowedName(n).ok);
  check(`the filter passes all ${MUST_PASS.length} legitimate names`, falsePositives.length === 0,
    falsePositives.map((n) => `${n} -> ${isAllowedName(n).term}`).join(', '));

  check('normalisation folds homoglyphs, leet and repeats to one form',
    normaliseName('ѕііік') === 'sik' && normaliseName('S1K') === 'sik'
    && normaliseName('Ｓ.Ｉ.Ｋ') === 'sik' && normaliseName('şikayet') === 'sikayet',
    [normaliseName('ѕііік'), normaliseName('S1K'), normaliseName('Ｓ.Ｉ.Ｋ')].join(' '));
  check('short terms are token-matched, long terms substring-matched',
    BLOCKLIST_SHORT.every((t) => t.length <= 3) && BLOCKLIST_LONG.every((t) => t.length > 3),
    `${BLOCKLIST_SHORT.length} short / ${BLOCKLIST_LONG.length} long`);
  check('an allowlisted span forgives a hit inside it, not beside it',
    blockedTerm('nazik') === null && blockedTerm('nazixnazik') === 'nazi');
  check('markup can never survive a name', isAllowedName('<b>Ege</b>').display === 'bEge/b');
  check('an over-long name is refused rather than silently cut',
    isAllowedName('a'.repeat(40)).reason === 'too-long');
  check('an empty or unprintable name is refused',
    isAllowedName('').reason === 'empty' && isAllowedName('   ').reason === 'empty'
    && isAllowedName('..').reason === 'no-letters');
}

{
  check('a 3-5 character tag is accepted and uppercased',
    isAllowedTag('gnt').tag === 'GNT' && isAllowedTag('ege32').tag === 'EGE32'
    && isAllowedTag('kadıköy'.slice(0, 5)).ok === true);
  check('Turkish uppercasing keeps the dot', isAllowedTag('ist').tag === 'İST',
    isAllowedTag('ist').tag);
  check('a tag outside 3-5 characters is refused',
    isAllowedTag('gn').reason === 'too-short' && isAllowedTag('abcdef').reason === 'too-long');
  check('a tag with punctuation is refused', isAllowedTag('a-b').reason === 'charset');
  check('a tag runs through the same filter as a name',
    isAllowedTag('SIK').reason === 'blocked' && isAllowedTag('4MK').reason === 'blocked',
    `${isAllowedTag('SIK').reason} / ${isAllowedTag('4MK').reason}`);
  check('formatDisplayName prefixes the tag',
    formatDisplayName({ tag: 'gnt', name: 'Ege' }) === '[GNT] Ege'
    && formatDisplayName({ name: 'Ege' }) === 'Ege'
    && formatDisplayName({ tag: 'sik', name: 'Ege' }) === 'Ege');
  check('the tag change cooldown is a pure function of now',
    canChangeTag(null, 0).ok === true
    && canChangeTag(0, 1000).ok === false
    && canChangeTag(0, 8 * DAY).ok === true
    && canChangeTag(0, 1000).waitMs === 7 * DAY - 1000);
}

// ================================================================= quick chat

section('#37 quick chat, emotes and mute');

{
  const guard = createChatGuard();
  check('a first message is accepted', guard.check('a', { kind: 0, id: 0 }, 0).ok === true);
  const soon = guard.check('a', { kind: 0, id: 1 }, 1000);
  check('a second message inside the cooldown is refused',
    !soon.ok && soon.reason === 'cooldown' && soon.retryInMs === 1500, JSON.stringify(soon));
  check('the same message after the cooldown is accepted',
    guard.check('a', { kind: 0, id: 1 }, 2600).ok === true);
  check('the cooldown is per player, not per room',
    guard.check('b', { kind: 0, id: 0 }, 2600).ok === true);
  check('an unknown phrase id is refused',
    guard.check('a', { kind: 0, id: 999 }, 99999).reason === 'unknown-message'
    && guard.check('a', { kind: 7, id: 0 }, 99999).reason === 'unknown-message');

  const rep = createChatGuard({ cooldownMs: 100, repeatLimit: 3 });
  const seq = [0, 200, 400, 600].map((t) => rep.check('a', { kind: 0, id: 4 }, t));
  check('repeating one phrase is refused after the limit',
    seq[0].ok && seq[1].ok && seq[2].ok && !seq[3].ok && seq[3].reason === 'repeat',
    seq.map((r) => r.reason || 'ok').join(','));
  check('a different phrase clears the repeat counter',
    rep.check('a', { kind: 0, id: 5 }, 800).ok === true
    && rep.check('a', { kind: 0, id: 4 }, 1000).ok === true);

  const burst = createChatGuard({ cooldownMs: 100, burstWindowMs: 5000, burstLimit: 4, gagMs: 10000, repeatLimit: 99 });
  const rolls = [];
  for (let i = 0; i < 6; i++) rolls.push(burst.check('spammer', { kind: 1, id: i % EMOTES.length }, i * 200));
  check('a burst past the limit gags the sender',
    rolls.slice(0, 4).every((r) => r.ok) && rolls[4].reason === 'burst' && rolls[5].reason === 'gagged',
    rolls.map((r) => r.reason || 'ok').join(','));
  check('the gag is time-boxed and clears on its own',
    burst.isGagged('spammer', 5000) === true
    && burst.isGagged('spammer', 999999) === false
    && burst.check('spammer', { kind: 1, id: 0 }, 999999).ok === true);
  check('an innocent player is untouched by someone else\'s gag',
    burst.check('innocent', { kind: 1, id: 0 }, 1000).ok === true);
  check('the guard is deterministic under a replayed clock', (() => {
    const a = createChatGuard();
    const b = createChatGuard();
    const ts = [0, 900, 2600, 2700, 5300];
    return ts.every((t, i) => JSON.stringify(a.check('x', { kind: 0, id: i % 3 }, t))
      === JSON.stringify(b.check('x', { kind: 0, id: i % 3 }, t)));
  })());
  check('forgetting a player drops their history', guard.forget('a') === true && guard.inspect('a') === null);
}

{
  const backing = [];
  const mine = createMuteList({ load: () => backing.slice(), save: (v) => { backing.length = 0; backing.push(...v); } });
  const theirs = createMuteList();
  mine.mute('troll');
  check('a muted sender is filtered out for me', mine.filter('troll', 0, 0) === null);
  check('the same sender is still audible for everyone else',
    theirs.filter('troll', 0, 0).text === QUICK_PHRASES[0]);
  check('the mute list persists through injected save/load',
    backing.includes('troll') && createMuteList({ load: () => backing.slice() }).isMuted('troll'));
  check('unmute is symmetric', mine.unmute('troll') === true && mine.filter('troll', 0, 0) !== null);
  check('toggle flips and reports the new state',
    mine.toggle('troll') === true && mine.isMuted('troll') === true
    && mine.toggle('troll') === false && mine.isMuted('troll') === false);
  check('an emote renders with its glyph and label',
    theirs.filter('x', CHAT_KIND.EMOTE, 4).text === `${EMOTES[4].glyph} ${EMOTES[4].label}`);
  check('an unknown message renders as nothing at all',
    theirs.filter('x', CHAT_KIND.PHRASE, 999) === null);
}

// ======================================================================= wire

section('wire — "GNSC" validation');

{
  const buf = encodeChat({ kind: CHAT_KIND.PHRASE, id: 3, seq: 7 });
  const msg = decodeSocial(buf);
  check('a chat frame round-trips',
    msg.kind === CHAT_KIND.PHRASE && msg.id === 3 && msg.seq === 7 && buf.byteLength === 20,
    `${buf.byteLength} B`);
  check('a social frame is recognised without touching the arena demux',
    isSocialFrame(buf) === true && isSocialFrame(new ArrayBuffer(4)) === false);
  const spec = decodeSocial(encodeSpectate({ want: true, seq: 1 }));
  check('a spectate request round-trips', spec.want === true);
  const ack = decodeSocial(encodeSpectateAck({ granted: false, reason: SPECTATE_REASON.CAP }));
  check('a spectate refusal carries its reason',
    ack.granted === false && ack.reason === SPECTATE_REASON.CAP);

  const codeOf = (fn) => {
    try { fn(); return 'no-throw'; } catch (e) {
      return e instanceof SocialProtocolError ? e.code : `wrong-error:${e.name}`;
    }
  };
  check('a non-binary payload is refused', codeOf(() => decodeSocial('hello')) === 'not-binary');
  check('a misaligned payload is refused', codeOf(() => decodeSocial(new ArrayBuffer(7))) === 'alignment');
  check('a truncated payload is refused', codeOf(() => decodeSocial(new ArrayBuffer(8))) === 'too-short');
  check('an oversized payload is refused', codeOf(() => decodeSocial(new ArrayBuffer(128))) === 'oversize');
  check('a foreign magic is refused', codeOf(() => decodeSocial(new ArrayBuffer(20))) === 'magic');
  check('an unknown phrase id cannot be encoded',
    codeOf(() => encodeChat({ kind: 0, id: 999 })) === 'encode-range');

  // hand-built hostile frames
  const hostile = (words) => {
    const b = new ArrayBuffer(words.length * 4);
    const v = new DataView(b);
    words.forEach((w, i) => v.setInt32(i * 4, w, true));
    return b;
  };
  check('a future protocol version is refused',
    codeOf(() => decodeSocial(hostile([0x474e5343, (2 << 16) | 1, 0, 0, 0]))) === 'version');
  check('an unknown type is refused',
    codeOf(() => decodeSocial(hostile([0x474e5343, (1 << 16) | 9, 0, 0, 0]))) === 'type');
  check('a chat frame of the wrong length is refused',
    codeOf(() => decodeSocial(hostile([0x474e5343, (1 << 16) | 1, 0, 0]))) === 'length');
  check('an out-of-table phrase id is refused at the boundary',
    codeOf(() => decodeSocial(hostile([0x474e5343, (1 << 16) | 1, 0, 0, QUICK_PHRASES.length]))) === 'chat-range');
  check('a negative emote id is refused',
    codeOf(() => decodeSocial(hostile([0x474e5343, (1 << 16) | 1, 0, 1, -1]))) === 'chat-range');
  check('a nonsense spectate flag is refused',
    codeOf(() => decodeSocial(hostile([0x474e5343, (1 << 16) | 2, 0, 42]))) === 'spectate-range');
  check('every phrase and emote in the table decodes',
    QUICK_PHRASES.every((_, i) => decodeSocial(encodeChat({ kind: 0, id: i })).id === i)
    && EMOTES.every((_, i) => decodeSocial(encodeChat({ kind: 1, id: i })).id === i));
}

// ==================================================================== tables

console.log('\n      measured — rating');
const rows = [
  ['convergence gap after 80 matches (mu)', round(mean(conv.red.map((r) => r.mu)) - mean(conv.blue.map((r) => r.mu)), 2)],
  ['winner mean mu / sigma', `${round(mean(conv.red.map((r) => r.mu)), 2)} / ${round(mean(conv.red.map((r) => r.sigma)), 3)}`],
  ['loser mean mu / sigma', `${round(mean(conv.blue.map((r) => r.mu)), 2)} / ${round(mean(conv.blue.map((r) => r.sigma)), 3)}`],
  ['1v1 control after 80 matches (gap / sigma)', `${round(solo.gap, 2)} / ${round(solo.sigma, 3)}`],
  ['display: winner / loser', `${displayRating(conv.red[0])} / ${displayRating(conv.blue[0])}`],
  ['tier: winner / loser', `${tierOf(displayRating(conv.red[0])).name} / ${tierOf(displayRating(conv.blue[0])).name}`],
  ['placement dmu vs settled dmu', `${round(placement.dFresh, 3)} vs ${round(placement.dSettled, 3)} (x${round(placement.dFresh / placement.dSettled, 2)})`],
  ['sigma after 30 / 200 / 2000 idle days', [30, 200, 2000].map((d) => round(applyDecay({ mu: 30, sigma: 2.5, games: 40, lastPlayedAt: 0, decayedAt: 0 }, d * DAY, {}).sigma, 3)).join(' / ')],
  ['season spread sd before / after', `${round(stdev(seasonRun.before), 3)} / ${round(stdev(seasonRun.after), 3)}`],
];
for (const [k, v] of rows) console.log(`      ${String(k).padEnd(40)} ${v}`);

console.log('\n      measured — spectator gallery (8-player match, 20 s of simulated time)');
const specRows = [
  ['spectators', `${g4.admitted}`, `${g16.admitted}`],
  ['payloads encoded per broadcast (max)', `${g4.maxGroups}`, `${g16.maxGroups}`],
  ['payloads encoded (total)', `${g4.desk.stats.payloadsEncoded}`, `${g16.desk.stats.payloadsEncoded}`],
  ['naive per-spectator design would encode', `${g4.naivePayloads}`, `${g16.naivePayloads}`],
  ['mean payload bytes', `${Math.round(g4.budget.meanPayloadBytes)}`, `${Math.round(g16.budget.meanPayloadBytes)}`],
  ['measured uplink B/s', `${Math.round(g4.budget.measuredBytesPerSec)}`, `${Math.round(g16.budget.measuredBytesPerSec)}`],
  ['budget ceiling B/s', `${g4.desk.options.maxUplinkBytesPerSec}`, `${g16.desk.options.maxUplinkBytesPerSec}`],
];
console.log(`      ${''.padEnd(40)} ${'4 spec'.padStart(8)} ${'16 spec'.padStart(9)}`);
for (const [k, a, b] of specRows) console.log(`      ${k.padEnd(40)} ${a.padStart(8)} ${b.padStart(9)}`);

console.log('\n      measured — name filter corpus');
console.log(`      ${'evasion variants blocked'.padEnd(40)} ${MUST_BLOCK.filter(([n]) => !isAllowedName(n).ok).length}/${MUST_BLOCK.length}`);
console.log(`      ${'legitimate names passed'.padEnd(40)} ${MUST_PASS.filter((n) => isAllowedName(n).ok).length}/${MUST_PASS.length}`);
console.log(`      ${'blocklist terms (short / long)'.padEnd(40)} ${BLOCKLIST_SHORT.length} / ${BLOCKLIST_LONG.length}`);
console.log(`      ${'allowlist entries'.padEnd(40)} ${ALLOWLIST.length}`);

console.log(
  `\nsocial ${SOCIAL_VERSION_STRING} · ${QUICK_PHRASES.length} phrases · ${EMOTES.length} emotes · `
  + `Plackett-Luce mu=${RATING_DEFAULTS.mu} sigma=${round(RATING_DEFAULTS.sigma, 3)} `
  + `beta=${round(RATING_DEFAULTS.beta, 3)} tau=${round(RATING_DEFAULTS.tau, 4)}`,
);
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
