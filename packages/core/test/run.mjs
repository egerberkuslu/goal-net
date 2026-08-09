// Headless gate for @goalnet/core: fixed-point identities, determinism
// (same process, fresh process, and across a serialize/deserialize seam),
// physics conformance against the LOCKED constants, and constantsHash
// behaviour.
//
//   node test/run.mjs                 PASS/FAIL lines, non-zero exit on failure
//   node test/run.mjs --dump-trace    JSON tick/checksum trace on stdout
//
// The trace mode is what Phase 2's NumPy port will diff against, and it is
// also what the fresh-process determinism check re-runs.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';

import {
  createWorld,
  step,
  checksum,
  serialize,
  deserialize,
  readState,
  place,
  setCurve,
  quantiseInput,
  playerOffset,
  controlAdvice,
  chargePower,
  inPenaltyArea,
  keeperEmpowered,
  pitchOf,
  worldSettings,
  BTN,
  BALL_BASE,
  FIELD,
  CONSTANTS,
  constantsHash,
  hashConstants,
  fnv1aString,
  toHex32,
  fx,
  CORE_VERSION,
  STATE_VERSION,
  HDR_BALL_HOLDER,
  HDR_BALL_HOLD_TICKS,
  HDR_GRIEF_TEAM,
  HDR_GRIEF_TICKS,
  HDR_PITCH,
  HDR_SETTINGS_HASH,
  HDR_DURATION_TICKS,
  HDR_SCORE_LIMIT,
  HDR_RULE_FLAGS,
  HDR_MATCH_STATE,
  DEFAULT_SETTINGS,
  PITCH_PRESETS,
  PITCH_PRESET_LIST,
  PITCH_KUCUK,
  PITCH_ORTA,
  PITCH_BUYUK,
  MERCY_GOAL_DIFF,
  MATCH_RUNNING,

  MATCH_FINISHED,
  RULE_GOLDEN_GOAL,
  RULE_MERCY,
  RULE_KEEPERS,
  SETTINGS_WORDS,
  SettingsError,
  normaliseSettings,
  isCanonicalSettings,
  serializeSettings,
  settingsHash,
  settingsHashInt,
  settingsFlags,
  sameSettings,
  assertSameSettings,
  encodeSettings,
  decodeSettings,
  durationTicks,
  pitchCodeOf,
  pitchPreset,
} from '../src/index.js';
import {
  straightRun,
  zigzagRun,
  turnRun,
  tackleGrid,
  TEN_METRES,
} from './tuning.mjs';

const SELF = fileURLToPath(import.meta.url);
const FX_ONE = fx.FX_ONE;

// -------------------------------------------------------------- scenario

// Deterministic input script. Integer PRNG only — the simulation itself never
// sees a random number, this just writes a repeatable button sequence.
function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= (s << 13) >>> 0;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= (s << 5) >>> 0;
    s >>>= 0;
    return s;
  };
}

const CARD = 65536; // 1.0
const DIAG = 46341; // 1/sqrt(2)
const DIRS = [
  [0, 0],
  [CARD, 0],
  [-CARD, 0],
  [0, CARD],
  [0, -CARD],
  [DIAG, DIAG],
  [DIAG, -DIAG],
  [-DIAG, DIAG],
  [-DIAG, -DIAG],
];

const SCENARIO = {
  name: 'phase12-3000',
  seed: 0x5eed1234,
  ticks: 3000,
  playerCount: 4,
  // players 0 and 1 are the fixed keepers of teams 0 and 1 (ADR-0001); the
  // determinism chain has to cover the keeper branches, not just the outfield
  roles: [1, 1, 0, 0],
};

/**
 * Wander script: for ~1 tick in 4 a player ignores the ball and walks a random
 * direction instead. Precomputed up front so the sequence never depends on how
 * the match unfolds — the noise is scripted, the chase is closed loop, and the
 * pair together produce a run full of contacts, kicks and goals.
 */
function wanderScript(scn) {
  const rng = makeRng(scn.seed);
  const script = [];
  const dir = new Array(scn.playerCount).fill(-1);
  const hold = new Array(scn.playerCount).fill(0);
  for (let t = 0; t < scn.ticks; t++) {
    const frame = [];
    for (let p = 0; p < scn.playerCount; p++) {
      if (hold[p] <= 0) {
        dir[p] = rng() % 4 === 0 ? rng() % DIRS.length : -1;
        hold[p] = 5 + (rng() % 25);
      }
      hold[p]--;
      frame.push(dir[p]);
    }
    script.push(frame);
  }
  return script;
}

const REACH = CONSTANTS.PLAYER_RADIUS + CONSTANTS.BALL_RADIUS;

/** Eight-way steering toward the ball, integers only. Returns a DIRS index. */
function dirTowardBall(buf, p) {
  const o = playerOffset(p);
  const dx = buf[BALL_BASE] - buf[o + FIELD.P_X];
  const dz = buf[BALL_BASE + 1] - buf[o + FIELD.P_Z];
  const adx = dx < 0 ? -dx : dx;
  const adz = dz < 0 ? -dz : dz;
  if (adx === 0 && adz === 0) return 0;
  if (adx > 2 * adz) return dx > 0 ? 1 : 2;
  if (adz > 2 * adx) return dz > 0 ? 3 : 4;
  return dx > 0 ? (dz > 0 ? 5 : 6) : dz > 0 ? 7 : 8;
}

/**
 * Every button, on a fixed schedule, so the determinism chain walks the charge
 * accumulator, the close-control touch, the slide windows and all four keeper
 * powers rather than only the Phase 1.1 kick path.
 *
 * Kick and touch are gated on proximity and pressed in short bursts: the core
 * arms the kick on the rising edge, so a permanently held button would fire once
 * per approach and the run would barely touch the impulse path at all.
 */
function wantsButtons(buf, p, t) {
  const o = playerOffset(p);
  const dx = buf[BALL_BASE] - buf[o + FIELD.P_X];
  const dz = buf[BALL_BASE + 1] - buf[o + FIELD.P_Z];
  const gap = fx.fxHypot(dx, dz) - REACH;
  const near = gap < CONSTANTS.KICK_RANGE * 3;
  const reachable = gap < CONSTANTS.KICK_RANGE;
  let b = 0;
  if (near && t % 10 <= 1) b |= BTN.KICK;
  if (near && (t + p * 3) % 7 <= 1) b |= BTN.TOUCH;
  // hold the shot button for 20 ticks out of every 50, offset per player, and
  // let go the moment the ball is genuinely reachable, so releases land at many
  // points on the charge curve AND actually connect
  if (!reachable && (t + p * 23) % 50 < 20) b |= BTN.CHARGE;
  if ((t + p * 31) % 271 === 0) b |= BTN.CANCEL;
  if ((t + p * 5) % 173 === 0) b |= BTN.TACKLE;
  if (p < 2) {
    // the keepers: grab whenever they legally can, and periodically dive,
    // hand-throw and boot it clear
    b |= BTN.CATCH;
    if ((t + p * 11) % 61 === 0) b |= BTN.DIVE;
    if ((t + p * 17) % 97 < 15) b |= BTN.CLEAR;
    if ((t + p * 29) % 211 === 0) b |= BTN.THROW;
  }
  return b;
}

/** Decode a recorded input code (dirIndex | buttons << 4) back into an input. */
function decodeInput(code) {
  const d = DIRS[code & 15];
  return { moveXFx: d[0], moveZFx: d[1], buttons: code >>> 4 };
}

/**
 * Run the scenario, collecting the per-tick checksum chain and the input codes
 * that produced it. The codes are what Phase 2's NumPy port replays; it never
 * has to reimplement the steering above.
 */
function runTrace(scn = SCENARIO, wander = wanderScript(scn), onTick = null) {
  const world = createWorld({ playerCount: scn.playerCount, roles: scn.roles });
  const chain = [checksum(world)]; // tick 0, before any step
  const codes = [];
  const tally = {
    goal: 0,
    kick: 0,
    shot: 0,
    touch: 0,
    tackle: 0,
    'keeper-catch': 0,
    'keeper-release': 0,
    'keeper-save': 0,
    'keeper-whiff': 0,
    'grief-void': 0,
  };
  for (let t = 0; t < scn.ticks; t++) {
    const frame = [];
    const inputs = [];
    for (let p = 0; p < scn.playerCount; p++) {
      const d = wander[t][p] >= 0 ? wander[t][p] : dirTowardBall(world.buf, p);
      const code = d | (wantsButtons(world.buf, p, t) << 4);
      frame.push(code);
      inputs.push(decodeInput(code));
    }
    codes.push(frame);
    for (const e of step(world, inputs)) {
      if (tally[e.type] != null) tally[e.type]++;
    }
    chain.push(checksum(world));
    if (onTick) onTick(world, t);
  }
  return { world, chain, codes, tally, goals: tally.goal, kicks: tally.kick };
}

/** Replay a recorded code stream with no policy in the loop at all. */
function replayCodes(scn, codes) {
  const world = createWorld({ playerCount: scn.playerCount, roles: scn.roles });
  const chain = [checksum(world)];
  for (let t = 0; t < codes.length; t++) {
    step(world, codes[t].map(decodeInput));
    chain.push(checksum(world));
  }
  return { world, chain };
}

function chainDigest(chain) {
  return toHex32(fnv1aString(chain.join('')));
}

// ------------------------------------------------------- match-rule scenarios

/**
 * Put the ball over `team`'s target line, from outside every player's reach and
 * clear of the posts, so the next step() has to award a goal. Used to drive the
 * scoreline deterministically without waiting for the wander script to oblige.
 */
function forceGoal(world, team) {
  const buf = world.buf;
  buf[HDR_BALL_HOLDER] = -1;
  buf[HDR_BALL_HOLD_TICKS] = 0;
  buf[HDR_GRIEF_TEAM] = -1;
  buf[HDR_GRIEF_TICKS] = 0;
  const P = pitchOf(world);
  const beyond = P.halfZ / FX_ONE + 20; // 10 past the goal line, 20 clear of any player
  place(world, 'ball', 0, team === 0 ? beyond : -beyond, 0, 0);
}

/** Score `n` goals for `team`, one step at a time. Returns every event seen. */
function driveGoals(world, team, n) {
  const events = [];
  for (let k = 0; k < n; k++) {
    forceGoal(world, team);
    for (const e of step(world, [])) events.push(e);
  }
  return events;
}

/** A world with nothing but two still players, for rule checks in isolation. */
function ruleWorld(settings) {
  return createWorld({ playerCount: 2, settings });
}

/**
 * The Phase 1.7a determinism scenarios: the same wander/chase script as the
 * Phase 1.2 chain, on a non-default pitch, with the scoreline forced at fixed
 * ticks so the run walks the golden-goal period, a match ending and the frozen
 * world that follows.
 */
const RULES_SCENARIOS = [
  {
    name: 'golden-goal-kucuk',
    seed: 0x5eed1234,
    ticks: 1200,
    playerCount: 4,
    roles: [1, 1, 0, 0],
    settings: {
      durationSeconds: 10, // 600 ticks
      scoreLimit: 0,
      pitch: 'kucuk',
      goldenGoal: true,
      mercyRule: true,
      keepers: true,
    },
    // 2-2 by tick 460, level at full time -> golden goal, settled at tick 700
    script: [[100, 0], [220, 1], [340, 0], [460, 1], [700, 0]],
  },
  {
    name: 'mercy-buyuk',
    seed: 0x0dd1e,
    ticks: 900,
    playerCount: 4,
    roles: [0, 0, 0, 0],
    settings: {
      durationSeconds: 0, // untimed: only the mercy rule can stop this one
      scoreLimit: 0,
      pitch: 'buyuk',
      goldenGoal: false,
      mercyRule: true,
      keepers: false,
    },
    script: [[80, 0], [160, 0], [240, 0], [320, 0]],
  },
];

function rulesTrace(scn) {
  const wander = wanderScript(scn);
  const world = createWorld({
    playerCount: scn.playerCount,
    roles: scn.roles,
    settings: scn.settings,
  });
  const chain = [checksum(world)];
  const tally = { goal: 0, 'golden-goal': 0, 'match-end': 0 };
  let end = null;
  for (let t = 0; t < scn.ticks; t++) {
    if (world.buf[HDR_MATCH_STATE] !== MATCH_FINISHED) {
      for (const [at, team] of scn.script) if (at === t) forceGoal(world, team);
    }
    const inputs = [];
    for (let p = 0; p < scn.playerCount; p++) {
      const d = wander[t][p] >= 0 ? wander[t][p] : dirTowardBall(world.buf, p);
      inputs.push(decodeInput(d | (wantsButtons(world.buf, p, t) << 4)));
    }
    for (const e of step(world, inputs)) {
      if (tally[e.type] != null) tally[e.type]++;
      if (e.type === 'match-end') end = e;
    }
    chain.push(checksum(world));
  }
  return { world, chain, tally, end };
}

function rulesChains() {
  const out = {};
  for (const scn of RULES_SCENARIOS) {
    const r = rulesTrace(scn);
    out[scn.name] = {
      digest: chainDigest(r.chain),
      tally: r.tally,
      end: r.end ? { reason: r.end.reason, winner: r.end.winner, tick: r.end.tick } : null,
      score: [r.world.buf[5], r.world.buf[6]],
    };
  }
  return out;
}

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

// ------------------------------------------------------------ trace mode

if (process.argv.includes('--dump-trace')) {
  const { world, chain, codes, tally, goals, kicks } = runTrace();
  process.stdout.write(
    JSON.stringify({
      core: CORE_VERSION,
      constantsHash,
      scenario: SCENARIO,
      // input encoding: code = dirIndex | (buttons << 4); DIRS is the
      // fixed-point direction table below, index 0 = no movement, and the
      // button bits are the BTN table exported by the core
      dirs: DIRS,
      tally,
      goals,
      kicks,
      chainDigest: chainDigest(chain),
      rules: rulesChains(),
      final: readState(world),
      inputs: codes,
      ticks: chain.map((c, i) => ({ t: i, c })),
    }),
  );
  process.exit(0);
}

// ------------------------------------------------------------- harness

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`PASS  ${name}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function near(a, b, tol) {
  return Math.abs(a - b) <= tol;
}
function section(title) {
  console.log(`\n--- ${title}`);
}

// ------------------------------------------------- 1. fixed-point identities

section('fixed-point');

{
  // round trip through the float boundary
  let worst = 0;
  for (const v of [0, 1, -1, 0.1, -0.1, 2.4, 1234.5678, -32767.5, 32767.4]) {
    const r = fx.fxToNumber(fx.fxFromNumber(v));
    worst = Math.max(worst, Math.abs(r - v));
  }
  check(
    'fxFromNumber/fxToNumber round-trips inside half an LSB',
    worst <= 0.5 / 65536 + 1e-12,
    `worst ${worst}`,
  );
}

check(
  'fxFromNumber saturates instead of wrapping',
  fx.fxFromNumber(1e9) === fx.FX_MAX && fx.fxFromNumber(-1e9) === fx.FX_MIN,
);
check(
  'fxAdd/fxSub saturate at the rails',
  fx.fxAdd(fx.FX_MAX, FX_ONE) === fx.FX_MAX &&
    fx.fxSub(fx.FX_MIN, FX_ONE) === fx.FX_MIN,
);

{
  const rng = makeRng(0xa11ce);
  const rnd = () => (rng() % 200000000) - 100000000;
  let addAssoc = true;
  let addComm = true;
  for (let i = 0; i < 20000; i++) {
    const a = rnd();
    const b = rnd();
    const c = rnd();
    // inside the rails integer addition is exact, so it must associate
    if (fx.fxAdd(fx.fxAdd(a, b), c) !== fx.fxAdd(a, fx.fxAdd(b, c)))
      addAssoc = false;
    if (fx.fxAdd(a, b) !== fx.fxAdd(b, a)) addComm = false;
  }
  check('fxAdd is associative when nothing saturates', addAssoc);
  check('fxAdd is commutative', addComm);
}

{
  // exact 64-bit reference: multiplication truncates the magnitude
  const refMul = (a, b) => {
    const p = BigInt(a) * BigInt(b);
    const neg = p < 0n;
    const m = (neg ? -p : p) >> 16n;
    const q = neg ? -m : m;
    if (q > 2147483647n) return fx.FX_MAX;
    if (q < -2147483648n) return fx.FX_MIN;
    return Number(q);
  };
  const rng = makeRng(0xbeef01);
  const rnd = () => (rng() % 4000000000) - 2000000000;
  let bad = null;
  const probes = [
    [FX_ONE, FX_ONE],
    [FX_ONE, 0],
    [fx.FX_MAX, fx.FX_MAX],
    [fx.FX_MIN, fx.FX_MIN],
    [fx.FX_MIN, FX_ONE],
    [-1, 65535],
    [65535, -1],
  ];
  for (let i = 0; i < 30000; i++) probes.push([rnd(), rnd()]);
  for (const [a, b] of probes) {
    if (fx.fxMul(a, b) !== refMul(a, b)) {
      bad = [a, b, fx.fxMul(a, b), refMul(a, b)];
      break;
    }
  }
  check('fxMul matches an exact 64-bit reference', bad === null, String(bad));

  let comm = true;
  let sign = true;
  const rng2 = makeRng(0xc0ffee);
  for (let i = 0; i < 20000; i++) {
    const a = (rng2() % 200000000) - 100000000;
    const b = (rng2() % 200000000) - 100000000;
    if (fx.fxMul(a, b) !== fx.fxMul(b, a)) comm = false;
    // sign symmetry is only claimed where nothing saturates: the rails are
    // asymmetric by one LSB (FX_MIN = -FX_MAX - 1) by definition
    const sa = (rng2() % 16777216) - 8388608;
    const sb = (rng2() % 16777216) - 8388608;
    if (fx.fxMul(sa, -sb) !== -fx.fxMul(sa, sb)) sign = false;
  }
  check('fxMul is commutative', comm);
  check('fxMul is sign-symmetric (truncation toward zero)', sign);
  check(
    'fxMul identity and annihilator',
    fx.fxMul(12345678, FX_ONE) === 12345678 && fx.fxMul(12345678, 0) === 0,
  );
}

{
  const refDiv = (a, b) => {
    const q = (BigInt(a) << 16n) / BigInt(b);
    if (q > 2147483647n) return fx.FX_MAX;
    if (q < -2147483648n) return fx.FX_MIN;
    return Number(q);
  };
  const rng = makeRng(0xd15ea5e);
  const rnd = () => (rng() % 4000000000) - 2000000000;
  let bad = null;
  const probes = [
    [FX_ONE, FX_ONE],
    [FX_ONE, 3 * FX_ONE],
    [-FX_ONE, 3 * FX_ONE],
    [fx.FX_MAX, 1],
    [fx.FX_MIN, 1],
    [1, fx.FX_MAX],
  ];
  for (let i = 0; i < 30000; i++) {
    const b = rnd();
    if (b !== 0) probes.push([rnd(), b]);
  }
  for (const [a, b] of probes) {
    if (fx.fxDiv(a, b) !== refDiv(a, b)) {
      bad = [a, b, fx.fxDiv(a, b), refDiv(a, b)];
      break;
    }
  }
  check('fxDiv matches an exact 64-bit reference', bad === null, String(bad));
  check(
    'fxDiv by the smallest positive value saturates',
    fx.fxDiv(FX_ONE, 1) === fx.FX_MAX && fx.fxDiv(-FX_ONE, 1) === fx.FX_MIN,
  );
  check(
    'fxDiv by a huge divisor collapses toward zero',
    fx.fxDiv(FX_ONE, fx.FX_MAX) === 2 && fx.fxDiv(1, fx.FX_MAX) === 0,
  );
  check(
    'fxDiv by zero saturates with the numerator sign',
    fx.fxDiv(FX_ONE, 0) === fx.FX_MAX &&
      fx.fxDiv(-FX_ONE, 0) === fx.FX_MIN &&
      fx.fxDiv(0, 0) === 0,
  );
}

{
  // isqrt must be the exact integer floor of the square root
  const rng = makeRng(0x5017);
  let bad = null;
  const probes = [0, 1, 2, 3, 4, 8, 9, 15, 16, 1 << 20, 2 ** 47, 2 ** 52];
  for (let i = 0; i < 5000; i++) probes.push(rng() * (rng() % 4096));
  for (const v of probes) {
    const r = fx.isqrtInt(v);
    const bv = BigInt(Math.floor(v));
    if (BigInt(r) * BigInt(r) > bv || BigInt(r + 1) * BigInt(r + 1) <= bv) {
      bad = [v, r];
      break;
    }
  }
  check('isqrtInt is the exact integer floor of sqrt', bad === null, String(bad));
}

{
  check(
    'fxSqrt is exact on perfect squares',
    fx.fxSqrt(fx.fxFromNumber(4)) === fx.fxFromNumber(2) &&
      fx.fxSqrt(fx.fxFromNumber(2.25)) === fx.fxFromNumber(1.5) &&
      fx.fxSqrt(0) === 0,
  );
  let worst = 0;
  const rng = makeRng(0x59717);
  for (let i = 0; i < 20000; i++) {
    const raw = rng() % 2147483647;
    const got = fx.fxToNumber(fx.fxSqrt(raw));
    const want = Math.sqrt(fx.fxToNumber(raw));
    worst = Math.max(worst, Math.abs(got - want));
  }
  check(
    'fxSqrt stays inside one LSB of the true root',
    worst <= 1 / 65536,
    `worst ${worst}`,
  );
  check('fxSqrt clamps negatives to zero', fx.fxSqrt(-FX_ONE) === 0);
}

{
  check(
    'fxHypot nails the 3-4-5 triangle',
    fx.fxHypot(fx.fxFromNumber(3), fx.fxFromNumber(4)) === fx.fxFromNumber(5),
  );
  let worst = 0;
  const rng = makeRng(0x4ff0);
  for (let i = 0; i < 20000; i++) {
    const x = (rng() % 40000000) - 20000000;
    const y = (rng() % 40000000) - 20000000;
    const got = fx.fxToNumber(fx.fxHypot(x, y));
    const want = Math.hypot(fx.fxToNumber(x), fx.fxToNumber(y));
    worst = Math.max(worst, Math.abs(got - want));
  }
  check(
    'fxHypot stays inside one LSB over the pitch domain',
    worst <= 1 / 65536,
    `worst ${worst}`,
  );
  check(
    'fxHypot degrades instead of overflowing at extreme inputs',
    fx.fxHypot(fx.FX_MAX, fx.FX_MAX) === fx.FX_MAX,
  );
}

{
  const out = [0, 0];
  fx.fxSinCos(0, out);
  check(
    'fxSinCos(0) is (1, 0)',
    near(fx.fxToNumber(out[0]), 1, 2e-3) && near(fx.fxToNumber(out[1]), 0, 2e-3),
  );
  let worstSin = 0;
  let worstUnit = 0;
  for (let deg = -720; deg <= 720; deg += 1) {
    const rad = (deg * Math.PI) / 180;
    fx.fxSinCos(fx.fxFromNumber(rad), out);
    const c = fx.fxToNumber(out[0]);
    const s = fx.fxToNumber(out[1]);
    worstSin = Math.max(
      worstSin,
      Math.abs(s - Math.sin(rad)),
      Math.abs(c - Math.cos(rad)),
    );
    worstUnit = Math.max(worstUnit, Math.abs(c * c + s * s - 1));
  }
  check(
    'CORDIC sin/cos stay within 2e-3 over four full turns',
    worstSin < 2e-3,
    `worst ${worstSin}`,
  );
  check(
    'CORDIC preserves sin^2 + cos^2 = 1',
    worstUnit < 2e-3,
    `worst ${worstUnit}`,
  );
}

// -------------------------------------------------------- 2. determinism

section('determinism');

const runA = runTrace();
const runB = runTrace();
{
  const d = firstDiff(runA.chain, runB.chain);
  check(
    `two ${SCENARIO.ticks}-tick runs in one process agree tick for tick`,
    d === -1,
    d >= 0 ? `first divergence at tick ${d}` : '',
  );
  check(
    // A rough "did anything happen" proxy. The real coverage guarantee is the
    // branch tally below, which requires every Phase 1.2 mechanic to fire. The
    // threshold was 50 on the 400-unit pitch; widening it to the shipping
    // game's 514 (ADR-0009) means the same chase script spends more of its
    // 3000 ticks running and less of it kicking, and lands at 29.
    'the scenario actually exercises the sim (kicks and goals happen)',
    runA.kicks > 25 && runA.goals > 0 && runA.chain.length === SCENARIO.ticks + 1,
    `kicks=${runA.kicks} goals=${runA.goals}`,
  );
  {
    // a determinism chain that never enters a branch proves nothing about it
    const t = runA.tally;
    const cold = Object.entries(t).filter(
      ([k, v]) => v === 0 && k !== 'grief-void',
    );
    check(
      'the chain walks every Phase 1.2 mechanic at least once',
      cold.length === 0,
      `${JSON.stringify(t)}`,
    );
  }
  const replay = replayCodes(SCENARIO, runA.codes);
  const rd = firstDiff(runA.chain, replay.chain);
  check(
    'replaying the recorded input codes alone reproduces the chain',
    rd === -1,
    rd >= 0 ? `first divergence at tick ${rd}` : '',
  );
}

// Fresh interpreter: if any module-level mutable state leaked into the sim,
// a cold process would drift from a warm one. Kept at file scope because the
// match-rule section re-uses the same child run.
const child = JSON.parse(
  execFileSync(process.execPath, [SELF, '--dump-trace'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
);

{
  const childChain = child.ticks.map((e) => e.c);
  const d = firstDiff(runA.chain, childChain);
  check(
    'a fresh child process reproduces the same checksum chain',
    d === -1,
    d >= 0 ? `first divergence at tick ${d}` : '',
  );
  check(
    'the child agrees on constantsHash and the chain digest',
    child.constantsHash === constantsHash &&
      child.chainDigest === chainDigest(runA.chain),
    `${child.constantsHash} / ${child.chainDigest}`,
  );
}

{
  // serialize -> deserialize -> continue must rejoin the uninterrupted chain
  const codes = runA.codes;
  const cut = 1234;
  const world = createWorld({
    playerCount: SCENARIO.playerCount,
    roles: SCENARIO.roles,
  });
  const chain = [checksum(world)];
  let resumed = world;
  for (let t = 0; t < codes.length; t++) {
    if (t === cut) {
      const snap = serialize(resumed);
      resumed = deserialize(snap);
    }
    step(resumed, codes[t].map(decodeInput));
    chain.push(checksum(resumed));
  }
  const d = firstDiff(runA.chain, chain);
  check(
    `serialize/deserialize at tick ${cut} rejoins the uninterrupted chain`,
    d === -1,
    d >= 0 ? `first divergence at tick ${d}` : '',
  );

  const snap = serialize(runA.world);
  const clone = deserialize(snap);
  check(
    'a snapshot round-trips to an identical checksum',
    checksum(clone) === checksum(runA.world),
  );

  let rejected = false;
  const tampered = serialize(runA.world);
  tampered[2] ^= 0x1; // constantsHash slot
  try {
    deserialize(tampered);
  } catch {
    rejected = true;
  }
  check('deserialize rejects a foreign constantsHash', rejected);
}

check(
  'the simulation module graph loads with no DOM present',
  typeof globalThis.document === 'undefined' &&
    typeof globalThis.window === 'undefined',
);

{
  // Static audit of packages/core/src: the matrix row is "core builds DOM-free",
  // and the determinism row dies the moment anything reads a clock or a random
  // number. Cheaper to forbid the identifiers than to debug the desync later.
  const dir = new URL('../src/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  const banned = [
    /\bMath\.random\b/,
    /\bDate\b/,
    /\bperformance\b/,
    /\bdocument\b/,
    /\bwindow\b/,
    /\bnavigator\b/,
    /\brequestAnimationFrame\b/,
    /\bsetTimeout\b/,
    /\bMath\.(sin|cos|tan|atan2?|asin|acos|exp|log|pow|hypot|cbrt|sqrt|fround)\b/,
  ];
  const hits = [];
  const foreignImports = [];
  for (const f of files) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    // strip comments so prose about Math.sin does not trip the audit
    // strip block and line comments so prose about Math.sin does not trip the
    // audit (no core source puts `//` inside a string literal)
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const re of banned) if (re.test(code)) hits.push(`${f}: ${re}`);
    for (const m of code.matchAll(/from\s+'([^']+)'/g)) {
      if (!m[1].startsWith('./')) foreignImports.push(`${f}: ${m[1]}`);
    }
  }
  check(
    'core sources reference no clock, no RNG, no DOM and no Math transcendentals',
    hits.length === 0,
    hits.join(', '),
  );
  check(
    'core imports nothing outside packages/core',
    foreignImports.length === 0,
    foreignImports.join(', '),
  );
  check('core is a handful of files, all ESM', files.length >= 4, files.join(' '));
}

// ------------------------------------------------- 3. physics conformance

section('physics conformance');

{
  // terminal speed = accel * damping / (1 - damping)
  const a = CONSTANTS.PLAYER_ACCEL / FX_ONE;
  const d = CONSTANTS.PLAYER_DAMPING / FX_ONE;
  const expected = (a * d) / (1 - d);

  const world = createWorld({ playerCount: 1 });
  place(world, 0, 0, -400);
  place(world, 'ball', 150, 380);
  const input = [{ moveXFx: 0, moveZFx: FX_ONE, kick: false }];
  for (let t = 0; t < 300; t++) step(world, input);
  const p = readState(world).players[0];
  const speed = Math.hypot(p.vx, p.vz);
  check(
    'player terminal speed matches accel*damping/(1-damping)',
    near(speed, expected, 0.002),
    `got ${speed.toFixed(5)} want ${expected.toFixed(5)}`,
  );
  check(
    'player terminal speed matches the locked 2.4 units/tick',
    near(speed, 2.4, 0.01),
    `got ${speed.toFixed(5)}`,
  );
}

{
  // kick ADDS an impulse; it never assigns a velocity
  const bd = CONSTANTS.BALL_DAMPING / FX_ONE;
  const imp = CONSTANTS.KICK_IMPULSE / FX_ONE;
  const shoot = (ballVz) => {
    const w = createWorld({ playerCount: 1 });
    place(w, 0, 0, 0);
    place(w, 'ball', 0, 27, 0, ballVz);
    const ev = step(w, [{ moveXFx: 0, moveZFx: 0, kick: true }]);
    return { vz: readState(w).ball.vz, kicked: ev.some((e) => e.type === 'kick') };
  };
  const rest = shoot(0);
  const moving = shoot(-3);
  check('a kick in range fires', rest.kicked && moving.kicked);
  check(
    'kick on a resting ball adds exactly the impulse',
    near(rest.vz / bd, imp, 2e-4),
    `${(rest.vz / bd).toFixed(5)} vs ${imp}`,
  );
  check(
    'kick on a moving ball adds to the existing velocity (never sets it)',
    near(moving.vz / bd, -3 + imp, 2e-4) && Math.abs(moving.vz - rest.vz) > 1,
    `${(moving.vz / bd).toFixed(5)} vs ${-3 + imp}`,
  );

  const far = (() => {
    const w = createWorld({ playerCount: 1 });
    place(w, 0, 0, 0);
    place(w, 'ball', 0, 40, 0, 0);
    const ev = step(w, [{ moveXFx: 0, moveZFx: 0, kick: true }]);
    return ev.some((e) => e.type === 'kick');
  })();
  check('a kick out of range does nothing', far === false);
  check(
    'kick reach stays under the locked 25-unit cap',
    CONSTANTS.KICK_RANGE < 25 * FX_ONE,
  );
  check(
    'kick rate cap sits inside the locked 4-12 kick/s band',
    60 / CONSTANTS.KICK_COOLDOWN_TICKS >= 4 &&
      60 / CONSTANTS.KICK_COOLDOWN_TICKS <= 12,
    `${(60 / CONSTANTS.KICK_COOLDOWN_TICKS).toFixed(2)} kick/s`,
  );
}

check(
  'ball damping is above player damping (dribbling depends on it)',
  CONSTANTS.BALL_DAMPING > CONSTANTS.PLAYER_DAMPING,
  `${CONSTANTS.BALL_DAMPING} vs ${CONSTANTS.PLAYER_DAMPING}`,
);

{
  // circle-wall: outgoing normal speed = bCoef * incoming, then damping
  const e = (CONSTANTS.BALL_BCOEF / FX_ONE) * (CONSTANTS.WALL_BCOEF / FX_ONE);
  const bd = CONSTANTS.BALL_DAMPING / FX_ONE;
  const w = createWorld({ playerCount: 2 });
  // Derived, not hardcoded: this test sat on a literal 189 that meant "one
  // tick short of the touchline" only while the pitch was 400 units wide.
  const wallX = CONSTANTS.PITCH_HALF_X / FX_ONE;
  const ballR = CONSTANTS.BALL_RADIUS / FX_ONE;
  place(w, 0, -150, -200);
  place(w, 1, 150, 200);
  place(w, 'ball', wallX - ballR - 1, 0, 10, 0);
  step(w, [null, null]);
  const b = readState(w).ball;
  check(
    'wall bounce returns bCoef * incoming speed',
    near(b.vx, -10 * e * bd, 2e-3) && near(b.x, wallX - ballR, 1e-3),
    `vx ${b.vx.toFixed(4)} want ${(-10 * e * bd).toFixed(4)}, `
    + `x ${b.x} want ${wallX - ballR}`,
  );
}

{
  // circle-circle: separation speed = bCoef * approach speed
  const e = (CONSTANTS.PLAYER_BCOEF / FX_ONE) ** 2;
  const pd = CONSTANTS.PLAYER_DAMPING / FX_ONE;
  const w = createWorld({ playerCount: 2 });
  place(w, 0, -14, 0, 2, 0);
  place(w, 1, 14, 0, -2, 0);
  place(w, 'ball', 150, 300);
  step(w, [null, null]);
  const [a, b] = readState(w).players;
  const separation = b.vx - a.vx;
  check(
    'head-on disc collision separates at bCoef * approach speed',
    near(separation, 4 * e * pd, 3e-3),
    `${separation.toFixed(5)} want ${(4 * e * pd).toFixed(5)}`,
  );
  check(
    'the collision pushes the overlap out',
    Math.abs(b.x - a.x) >= 30 - 1e-3,
    `gap ${(b.x - a.x).toFixed(4)}`,
  );
}

{
  // goals: ball driven down the middle of the mouth scores and resets
  const w = createWorld({ playerCount: 2 });
  place(w, 0, -150, -300);
  place(w, 1, 150, 300);
  place(w, 'ball', 0, 300, 0, 12);
  let goal = null;
  for (let t = 0; t < 200 && !goal; t++) {
    for (const e of step(w, [null, null])) if (e.type === 'goal') goal = e;
  }
  const s = readState(w);
  check('a shot through the mouth scores for the attacking side', goal?.team === 0);
  check('the score advances', s.score[0] === 1 && s.score[1] === 0);
  check('kickoff resets the ball to the centre spot', s.ball.x === 0 && s.ball.z === 0);
  check('the conceding side takes the restart', s.kickoffTeam === 1);
}

{
  // nothing may leak out of the arena over a long, contact-heavy run
  const scn = { ...SCENARIO, ticks: 1500, seed: 0x1234abcd };
  let worstX = 0;
  let worstZ = 0;
  runTrace(scn, wanderScript(scn), (w) => {
    const s = readState(w);
    worstX = Math.max(worstX, Math.abs(s.ball.x));
    worstZ = Math.max(worstZ, Math.abs(s.ball.z));
    for (const p of s.players) {
      worstX = Math.max(worstX, Math.abs(p.x));
      worstZ = Math.max(worstZ, Math.abs(p.z));
    }
  });
  // The z bound carries 11 units of slack for the goal mouth, where a ball is
  // legally past the line. Both are read off the pitch so widening it does not
  // turn this into a failure about nothing.
  const limitX = CONSTANTS.PITCH_HALF_X / FX_ONE;
  const limitZ = CONSTANTS.PITCH_HALF_Z / FX_ONE + 11;
  check(
    'nothing tunnels out of the arena over 1500 contact-heavy ticks',
    worstX <= limitX && worstZ <= limitZ,
    `|x|max ${worstX.toFixed(2)} |z|max ${worstZ.toFixed(2)} `
    + `(limits ${limitX} / ${limitZ})`,
  );
}

{
  const q = quantiseInput({ moveX: 1, moveZ: 1, kick: true });
  const len = Math.hypot(q.mx / FX_ONE, q.mz / FX_ONE);
  check(
    'diagonal input is clamped to unit length before it reaches the sim',
    near(len, 1, 1e-3),
    `len ${len}`,
  );
  check(
    'quantised input is integral',
    Number.isInteger(q.mx) && Number.isInteger(q.mz) && q.kick === 1,
  );
}

// ------------------------------------------- 4. gameplay core (rows 7-11)

section('dribbling — pure physics, no magnet (row #7)');

{
  // A resting player next to a resting ball must not move it, ever. If there
  // were an attraction term anywhere this is where it would show up.
  const w = createWorld({ playerCount: 1 });
  place(w, 0, 0, 0);
  place(w, 'ball', 0, 26);
  const before = readState(w).ball;
  for (let t = 0; t < 120; t++) step(w, [null]);
  const after = readState(w).ball;
  check(
    'a still player never attracts the ball (no magnet)',
    after.x === before.x && after.z === before.z,
    `${before.z} -> ${after.z}`,
  );
}

{
  // After a full kick the ball must keep leaving; a ball that stops running
  // away is a ball that has been stuck to a foot.
  const w = createWorld({ playerCount: 1 });
  place(w, 0, 0, 0);
  place(w, 'ball', 0, 26);
  step(w, [{ moveXFx: 0, moveZFx: FX_ONE, kick: true }]);
  let prev = -1;
  let monotone = true;
  for (let t = 0; t < 40; t++) {
    step(w, [{ moveXFx: 0, moveZFx: FX_ONE }]);
    const s = readState(w);
    const gap = Math.hypot(s.ball.x - s.players[0].x, s.ball.z - s.players[0].z);
    if (gap < prev) monotone = false;
    prev = gap;
  }
  check(
    'a kicked ball keeps running away from the kicker (no sticking)',
    monotone && prev > 60,
    `final gap ${prev.toFixed(1)}`,
  );
}

const dribbleStraight = straightRun();
const dribbleZigzag = zigzagRun();
const dribbleTurn = turnRun();

check(
  'a competent dribbler covers 10 m in 5-8 controlled touches',
  dribbleStraight.touches >= 5 &&
    dribbleStraight.touches <= 8 &&
    dribbleStraight.travelled >= TEN_METRES / FX_ONE,
  `${dribbleStraight.touches} touches over ${dribbleStraight.travelled.toFixed(1)} units`,
);
check(
  'the 10 m run keeps the ball in the target band (playerR+ballR +/- 7)',
  Math.abs(dribbleStraight.meanGap - 25) <= 7,
  `mean gap ${dribbleStraight.meanGap.toFixed(2)}`,
);
check(
  'the 10 m run loses the ball zero times',
  dribbleStraight.turnovers === 0 && dribbleStraight.maxGap < 3 * 25,
  `turnovers ${dribbleStraight.turnovers} max gap ${dribbleStraight.maxGap.toFixed(1)}`,
);
check(
  'a zigzag keeps close control and spends corrective touches',
  dribbleZigzag.turnovers === 0 &&
    dribbleZigzag.taps > 0 &&
    dribbleZigzag.controlRatio > 0.4,
  `taps ${dribbleZigzag.taps} control ${(dribbleZigzag.controlRatio * 100).toFixed(0)}% turnovers ${dribbleZigzag.turnovers}`,
);
check(
  'a 180 turn keeps the ball and costs control ticks, not possession',
  dribbleTurn.turnovers === 0 &&
    dribbleTurn.taps > 0 &&
    dribbleTurn.controlTicks > 0,
  `taps ${dribbleTurn.taps} control ticks ${dribbleTurn.controlTicks}/${dribbleTurn.ticks} turnovers ${dribbleTurn.turnovers}`,
);

{
  const w = createWorld({ playerCount: 1 });
  place(w, 0, 0, 0);
  place(w, 'ball', 0, 27, 0, 0);
  const still = controlAdvice(w, 0, 0, FX_ONE);
  place(w, 'ball', 0, 27, 0, 5);
  const fleeing = controlAdvice(w, 0, 0, FX_ONE);
  check(
    'controlAdvice answers the CMU question and mutates nothing',
    still.keep === true &&
      fleeing.keep === false &&
      readState(w).ball.vz === 5 &&
      controlAdvice(w, 0, 0, FX_ONE, 4).gapNext > fleeing.gapNext,
    `still ${still.gapNext} fleeing ${fleeing.gapNext}`,
  );
}

{
  // the corrective touch is small by construction, and spamming it loses the
  // ball rather than gluing it on
  const w = createWorld({ playerCount: 1 });
  place(w, 0, 0, 0);
  place(w, 'ball', 0, 26);
  let contactTicks = 0;
  let sum = 0;
  for (let t = 0; t < 180; t++) {
    step(w, [{ moveXFx: 0, moveZFx: FX_ONE, touch: true }]);
    const s = readState(w);
    const gap = Math.hypot(s.ball.x - s.players[0].x, s.ball.z - s.players[0].z);
    sum += gap;
    if (gap <= 25.01) contactTicks++;
  }
  const mean = sum / 180;
  check(
    'spamming the close-control button pushes the ball to arm\'s length, never onto the foot',
    contactTicks < 18 && mean > 27,
    `contact ${contactTicks}/180 ticks, mean gap ${mean.toFixed(2)}`,
  );
  check(
    'the corrective touch is an order of magnitude below a kick',
    CONSTANTS.TOUCH_IMPULSE * 10 < CONSTANTS.KICK_IMPULSE,
    `${CONSTANTS.TOUCH_IMPULSE} vs ${CONSTANTS.KICK_IMPULSE}`,
  );
}

section('shot charge (row #8)');

{
  const span = CONSTANTS.CHARGE_MAX_TICKS - CONSTANTS.CHARGE_MIN_TICKS;
  let worst = 0;
  let monotone = true;
  let prev = -1;
  for (let t = 0; t <= 70; t++) {
    const got = chargePower(t) / FX_ONE;
    const u = Math.min(1, Math.max(0, (t - CONSTANTS.CHARGE_MIN_TICKS) / span));
    const want = 0.3 + 0.7 * Math.pow(u, 1.5);
    worst = Math.max(worst, Math.abs(got - want));
    if (got < prev) monotone = false;
    prev = got;
  }
  check(
    'the charge curve is 0.3 + 0.7*t^1.5 to within 1e-3',
    worst < 1e-3,
    `worst ${worst}`,
  );
  check('the charge curve never goes backwards', monotone);
  check(
    'a tap is exactly 0.3x and a full hold exactly 1.0x',
    chargePower(0) === CONSTANTS.CHARGE_BASE &&
      chargePower(CONSTANTS.CHARGE_MIN_TICKS) === CONSTANTS.CHARGE_BASE &&
      chargePower(CONSTANTS.CHARGE_MAX_TICKS) === FX_ONE &&
      chargePower(600) === FX_ONE,
    `${chargePower(0)} / ${chargePower(CONSTANTS.CHARGE_MAX_TICKS)}`,
  );
  check(
    'the hold window is the designed 100-800 ms',
    CONSTANTS.CHARGE_MIN_TICKS === 6 && CONSTANTS.CHARGE_MAX_TICKS === 48,
  );
  check(
    'the release buffer sits in the designed 4-6 tick band',
    CONSTANTS.CHARGE_BUFFER_TICKS >= 4 && CONSTANTS.CHARGE_BUFFER_TICKS <= 6,
    String(CONSTANTS.CHARGE_BUFFER_TICKS),
  );
}

/** Hold the shot button for `hold` ticks next to the ball, then let go. */
function chargeShot(hold, ballVz = 0, gap = 27) {
  const w = createWorld({ playerCount: 1 });
  place(w, 0, 0, 0);
  place(w, 'ball', 0, 200); // parked out of the way while the button is held
  let peakCharge = 0;
  for (let t = 0; t < hold; t++) {
    step(w, [{ moveXFx: 0, moveZFx: 0, charge: true }]);
    peakCharge = Math.max(peakCharge, readState(w).players[0].charge);
  }
  place(w, 'ball', 0, gap, 0, ballVz); // and there it is, on the release tick
  const ev = step(w, [{ moveXFx: 0, moveZFx: 0 }]);
  const shot = ev.find((e) => e.type === 'shot');
  return { world: w, shot, peakCharge, ball: readState(w).ball };
}

{
  const bd = CONSTANTS.BALL_DAMPING / FX_ONE;
  const imp = CONSTANTS.KICK_IMPULSE / FX_ONE;
  const rows = [1, 6, 12, 24, 36, 48].map((h) => ({ h, r: chargeShot(h) }));
  let ok = true;
  const detail = [];
  for (const { h, r } of rows) {
    if (!r.shot) {
      ok = false;
      detail.push(`${h}: no shot`);
      continue;
    }
    const want = (chargePower(h) / FX_ONE) * imp;
    const got = r.ball.vz / bd;
    detail.push(`${h}t ${got.toFixed(3)}`);
    if (Math.abs(got - want) > 2e-3) ok = false;
  }
  check(
    'a released charge adds exactly power x KICK_IMPULSE',
    ok,
    detail.join(' '),
  );
  check(
    'the charge counter lives in core state and climbs while held',
    rows[5].r.peakCharge === CONSTANTS.CHARGE_MAX_TICKS &&
      rows[1].r.peakCharge === 6,
    `${rows[1].r.peakCharge} / ${rows[5].r.peakCharge}`,
  );

  const moving = chargeShot(48, -3);
  const resting = chargeShot(48, 0);
  check(
    'a charged shot ADDS to the ball velocity, it never sets it',
    Math.abs(moving.ball.vz / bd - (-3 + imp)) < 2e-3 &&
      Math.abs(moving.ball.vz - resting.ball.vz) > 1,
    `${(moving.ball.vz / bd).toFixed(4)} vs ${(-3 + imp).toFixed(4)}`,
  );
}

{
  // buffered release: let go while the ball is out of reach and let it arrive
  // let go while the ball is nowhere near, then let it arrive `delay` ticks later
  const arrive = (delay) => {
    const w = createWorld({ playerCount: 1 });
    place(w, 0, 0, 0);
    place(w, 'ball', 0, 200);
    for (let t = 0; t < 10; t++) step(w, [{ charge: true }]);
    step(w, [{}]); // the release itself, with nothing in range
    for (let t = 0; t < delay; t++) step(w, [{}]);
    place(w, 'ball', 0, 27);
    let fired = false;
    for (let t = 0; t < 10; t++) {
      for (const e of step(w, [{}])) if (e.type === 'shot') fired = true;
    }
    return fired;
  };
  check(
    'a release buffered a few ticks early still connects',
    arrive(0) && arrive(2),
  );
  check(
    'the buffer expires instead of waiting forever',
    arrive(CONSTANTS.CHARGE_BUFFER_TICKS + 2) === false,
  );
}

{
  const w = createWorld({ playerCount: 1 });
  place(w, 0, 0, 0);
  place(w, 'ball', 0, 27);
  for (let t = 0; t < 30; t++) step(w, [{ charge: true }]);
  const mid = readState(w).players[0].charge;
  const ev = step(w, [{ charge: true, chargeCancel: true }]);
  const after = readState(w);
  let fired = false;
  for (let t = 0; t < 10; t++) {
    for (const e of step(w, [{}])) if (e.type === 'shot') fired = true;
  }
  check(
    'the cancel input drops the charge without firing anything',
    mid === 30 &&
      after.players[0].charge === 0 &&
      after.ball.vz === 0 &&
      !fired &&
      ev.some((e) => e.type === 'charge-cancel'),
    `charge ${mid} -> ${after.players[0].charge}, ball vz ${after.ball.vz}`,
  );
}

section('curve (row #9)');

/** Fire the ball down +z with a preset curve and report the lateral drift. */
function curveFlight(curve, ticks = 60) {
  const w = createWorld({ playerCount: 1 });
  place(w, 0, 0, -350);
  place(w, 'ball', 0, 0, 0, 8);
  setCurve(w, curve);
  for (let t = 0; t < ticks; t++) step(w, [null]);
  return readState(w);
}

{
  const straight = curveFlight(0);
  const left = curveFlight(1);
  const right = curveFlight(-1);
  check(
    'zero curve flies straight',
    Math.abs(straight.ball.x) < 1e-3,
    `x ${straight.ball.x}`,
  );
  check(
    'a positive curve bends one way and a negative curve the other',
    left.ball.x < -5 && right.ball.x > 5 && Math.abs(left.ball.x + right.ball.x) < 1e-3,
    `left ${left.ball.x.toFixed(2)} right ${right.ball.x.toFixed(2)}`,
  );
  // the curve term is a rotation of the velocity, not a boost: the ball ends up
  // somewhere else, but it is not travelling faster for free
  const sp = (s) => Math.hypot(s.ball.vx, s.ball.vz);
  check(
    'curve rotates the velocity instead of adding energy to it',
    Math.abs(sp(left) / sp(straight) - 1) < 0.05 && left.ball.curve !== 0,
    `speed ${sp(left).toFixed(4)} vs ${sp(straight).toFixed(4)}`,
  );
}

{
  const w = createWorld({ playerCount: 1 });
  place(w, 0, 0, -350);
  place(w, 'ball', 0, 0, 0, 8);
  setCurve(w, 1);
  const d = CONSTANTS.CURVE_DAMPING / FX_ONE;
  for (let t = 0; t < 40; t++) step(w, [null]);
  const got = readState(w).ball.curve;
  check(
    'curve damps out on its own',
    Math.abs(got - Math.pow(d, 40)) < 5e-3 && got < 0.4,
    `${got.toFixed(4)} want ~${Math.pow(d, 40).toFixed(4)}`,
  );
}

{
  // a ground pass is a ground pass: no spin, and no aftertouch window either
  const w = createWorld({ playerCount: 1 });
  place(w, 0, 0, 0);
  place(w, 'ball', 0, 27);
  setCurve(w, 1);
  step(w, [{ moveXFx: 0, moveZFx: FX_ONE, kick: true }]);
  const s = readState(w);
  for (let t = 0; t < 10; t++) step(w, [{ moveXFx: FX_ONE, moveZFx: 0 }]);
  const later = readState(w);
  check(
    'a ground pass carries curve 0 and opens no aftertouch window',
    s.ball.curve === 0 && s.aftertouch.owner === -1 && later.ball.curve === 0,
    `curve ${s.ball.curve} owner ${s.aftertouch.owner} later ${later.ball.curve}`,
  );
}

{
  // aftertouch: sideways input inside the window bends the shot, outside it does
  // nothing at all
  const shootThenSteer = (mx, waitTicks) => {
    const w = createWorld({ playerCount: 1 });
    place(w, 0, 0, -350);
    place(w, 'ball', 0, -323);
    for (let t = 0; t < 48; t++) step(w, [{ charge: true }]);
    const ev = step(w, [{}]);
    if (!ev.some((e) => e.type === 'shot')) return null;
    for (let t = 0; t < waitTicks; t++) step(w, [{}]);
    for (let t = 0; t < 20; t++) step(w, [{ moveXFx: mx, moveZFx: 0 }]);
    for (let t = 0; t < 40; t++) step(w, [null]);
    return readState(w);
  };
  const bentLeft = shootThenSteer(-FX_ONE, 0);
  const bentRight = shootThenSteer(FX_ONE, 0);
  const tooLate = shootThenSteer(FX_ONE, CONSTANTS.AFTERTOUCH_TICKS + 2);
  check(
    'aftertouch inside the window bends the shot both ways',
    bentLeft &&
      bentRight &&
      bentLeft.ball.x < -5 &&
      bentRight.ball.x > 5 &&
      Math.abs(bentLeft.ball.x + bentRight.ball.x) < 1e-3,
    `left ${bentLeft?.ball.x.toFixed(2)} right ${bentRight?.ball.x.toFixed(2)}`,
  );
  check(
    'input after the window closes does nothing to the ball',
    tooLate && Math.abs(tooLate.ball.x) < 1e-3,
    `x ${tooLate?.ball.x}`,
  );
  check(
    'the aftertouch window is short',
    CONSTANTS.AFTERTOUCH_TICKS > 0 && CONSTANTS.AFTERTOUCH_TICKS <= 30,
    String(CONSTANTS.AFTERTOUCH_TICKS),
  );
}

section('slide tackle (row #10)');

{
  const w = createWorld({ players: [{ team: 0 }, { team: 1 }] });
  place(w, 0, 0, -100);
  place(w, 1, 0, 100);
  place(w, 'ball', 150, 300);
  const windows = [];
  for (let t = 0; t < 80; t++) {
    step(w, [{ moveXFx: 0, moveZFx: FX_ONE, tackle: true }, null]);
    const p = readState(w).players[0];
    windows.push([p.tackleActive, p.tackleRecovery]);
  }
  const activeTicks = windows.filter((x) => x[0] > 0).length + 1;
  const recovTicks = windows.filter((x) => x[1] > 0).length;
  check(
    'the active window is X ticks and recovery is 2X',
    activeTicks === CONSTANTS.TACKLE_ACTIVE_TICKS &&
      recovTicks === CONSTANTS.TACKLE_RECOVERY_TICKS &&
      CONSTANTS.TACKLE_RECOVERY_TICKS === 2 * CONSTANTS.TACKLE_ACTIVE_TICKS,
    `active ${activeTicks} recovery ${recovTicks}`,
  );
  check(
    'holding the button does not chain slides (spam is taxed)',
    windows.filter((x) => x[0] === CONSTANTS.TACKLE_ACTIVE_TICKS).length <= 1,
  );
}

{
  // movement lock: input during recovery must not accelerate anyone
  const w = createWorld({ players: [{ team: 0 }, { team: 1 }] });
  place(w, 0, 0, -100);
  place(w, 1, 0, 100);
  place(w, 'ball', 150, 300);
  step(w, [{ moveXFx: 0, moveZFx: FX_ONE, tackle: true }, null]);
  for (let t = 0; t < CONSTANTS.TACKLE_ACTIVE_TICKS; t++) step(w, [{}, null]);
  const speeds = [];
  for (let t = 0; t < 10; t++) {
    step(w, [{ moveXFx: 0, moveZFx: FX_ONE }, null]);
    const p = readState(w).players[0];
    speeds.push(Math.hypot(p.vx, p.vz));
  }
  let decaying = true;
  for (let i = 1; i < speeds.length; i++) if (speeds[i] >= speeds[i - 1]) decaying = false;
  check(
    'recovery locks movement: input during it produces no acceleration',
    decaying && readState(w).players[0].tackleRecovery > 0,
    speeds.map((s) => s.toFixed(3)).join(' '),
  );
}

{
  // the same geometry, once against a team-mate and once against an opponent
  const trial = (team) => {
    const w = createWorld({ players: [{ team: 0 }, { team }] });
    place(w, 0, 0, -100);
    place(w, 1, 0, -60); // 40 apart: inside the widened box, outside the bodies
    place(w, 'ball', 150, 300);
    const ev = step(w, [{ moveXFx: 0, moveZFx: FX_ONE, tackle: true }, null]);
    const s = readState(w);
    return {
      hit: ev.some((e) => e.type === 'tackle' && e.victim === 1),
      victimSpeed: Math.hypot(s.players[1].vx, s.players[1].vz),
    };
  };
  const mate = trial(0);
  const foe = trial(1);
  check(
    'a slide has NO effect on a team-mate',
    mate.hit === false && mate.victimSpeed === 0,
    `hit ${mate.hit} speed ${mate.victimSpeed}`,
  );
  check(
    'the same slide shoves an opponent',
    foe.hit === true && foe.victimSpeed > 1,
    `hit ${foe.hit} speed ${foe.victimSpeed.toFixed(3)}`,
  );
}

{
  const w = createWorld({ players: [{ team: 0 }, { team: 1 }] });
  place(w, 0, 0, -100);
  place(w, 1, 0, 200);
  place(w, 'ball', 0, -65, 0, 6);
  const ev = step(w, [{ moveXFx: 0, moveZFx: FX_ONE, tackle: true }, null]);
  const won = ev.find((e) => e.type === 'tackle' && e.won);
  const s = readState(w);
  check(
    'reaching the ball is a clean win that kills its pace',
    !!won && Math.abs(s.ball.vz) < 6,
    `ball vz ${s.ball.vz.toFixed(3)}`,
  );
}

const tackle = tackleGrid();
check(
  'measured tackle success sits in the designed 40-55% band',
  tackle.rate >= 0.4 && tackle.rate <= 0.55,
  `${tackle.won}/${tackle.trials} = ${(tackle.rate * 100).toFixed(1)}%`,
);

section('keeper (row #11)');

const GK_Z = -390; // deep inside team 0's box
function keeperWorld() {
  const w = createWorld({
    players: [{ team: 0, role: 'keeper' }, { team: 1 }],
  });
  place(w, 0, 0, GK_Z);
  place(w, 1, 150, 300);
  place(w, 'ball', 0, GK_Z + 26);
  return w;
}

{
  const w = keeperWorld();
  check(
    'the role is set at match start and readable from state',
    readState(w).players[0].role === 1 && readState(w).players[1].role === 0,
  );
  // a goal calls resetKickoff; the role must survive it
  const w2 = createWorld({
    players: [{ team: 0, role: 'keeper' }, { team: 1, role: 'keeper' }],
  });
  place(w2, 'ball', 0, 415, 0, 12);
  let scored = false;
  for (let t = 0; t < 60 && !scored; t++) {
    for (const e of step(w2, [null, null])) if (e.type === 'goal') scored = true;
  }
  check(
    'the role survives a goal and the kickoff reset (ADR-0001)',
    scored &&
      readState(w2).players[0].role === 1 &&
      readState(w2).players[1].role === 1,
  );
  check(
    'the penalty area is a per-team box in front of its own goal',
    inPenaltyArea(0, fx.fxFromNumber(-400), 0) &&
      !inPenaltyArea(0, fx.fxFromNumber(-400), 1) &&
      !inPenaltyArea(0, fx.fxFromNumber(-200), 0) &&
      !inPenaltyArea(fx.fxFromNumber(190), fx.fxFromNumber(-400), 0),
  );
  check(
    'keeper powers are gated on standing in its own box',
    keeperEmpowered(w, 0) === true,
  );
}

{
  // outside the box the keeper is an ordinary field player
  const w = keeperWorld();
  place(w, 0, 0, -100);
  place(w, 'ball', 0, -74);
  const ev = step(w, [{ catchBall: true }, null]);
  check(
    'a keeper outside its box cannot catch',
    !ev.some((e) => e.type === 'keeper-catch') &&
      readState(w).ball.holder === -1 &&
      keeperEmpowered(w, 0) === false,
  );
}

{
  const w = keeperWorld();
  const ev = step(w, [{ catchBall: true }, null]);
  const s = readState(w);
  check(
    'a keeper in its box catches on contact and pins the ball',
    ev.some((e) => e.type === 'keeper-catch') &&
      s.ball.holder === 0 &&
      s.ball.holdTicks === CONSTANTS.CATCH_HOLD_TICKS,
    `holder ${s.ball.holder} ticks ${s.ball.holdTicks}`,
  );
  check(
    'the hold counter sits in the designed 180-240 tick band',
    CONSTANTS.CATCH_HOLD_TICKS >= 180 && CONSTANTS.CATCH_HOLD_TICKS <= 240,
    String(CONSTANTS.CATCH_HOLD_TICKS),
  );

  // the ball rides with him, and the counter runs down to a forced release
  let held = 0;
  let release = null;
  for (let t = 0; t < 400 && !release; t++) {
    for (const e of step(w, [{ catchBall: true, moveXFx: 0, moveZFx: FX_ONE }, null])) {
      if (e.type === 'keeper-release') release = e;
    }
    if (readState(w).ball.holder === 0) held++;
  }
  const after = readState(w);
  check(
    'the hold expires into a forced release at the designed count',
    release &&
      release.kind === 'forced' &&
      held >= CONSTANTS.CATCH_HOLD_TICKS - 2 &&
      held <= CONSTANTS.CATCH_HOLD_TICKS + 2,
    `${release?.kind} after ${held} ticks`,
  );
  check(
    'the released ball is out of his hands and moving',
    after.ball.holder === -1 && Math.abs(after.ball.vz) > 0,
    `holder ${after.ball.holder} vz ${after.ball.vz}`,
  );
}

{
  // two distinct releases: the hand throw is straight and medium, the foot
  // clearance is chargeable and long
  const release = (mode, chargeTicks) => {
    const w = keeperWorld();
    step(w, [{ catchBall: true }, null]);
    for (let t = 0; t < chargeTicks; t++) {
      step(w, [{ catchBall: true, clearBall: mode === 'clear' }, null]);
    }
    const ev = step(w, [
      { throwBall: mode === 'throw', moveXFx: 0, moveZFx: FX_ONE },
      null,
    ]);
    const s = readState(w);
    return {
      kind: ev.find((e) => e.type === 'keeper-release')?.kind,
      speed: Math.hypot(s.ball.vx, s.ball.vz),
      curve: s.ball.curve,
      aftertouch: s.aftertouch.owner,
    };
  };
  const thrown = release('throw', 0);
  const short = release('clear', 1);
  const long = release('clear', CONSTANTS.CLEAR_MAX_TICKS);
  check(
    'the hand throw is a straight medium release with no spin',
    thrown.kind === 'throw' &&
      thrown.curve === 0 &&
      thrown.aftertouch === -1 &&
      Math.abs(thrown.speed - CONSTANTS.THROW_IMPULSE / FX_ONE) < 0.2,
    `${thrown.kind} speed ${thrown.speed.toFixed(2)}`,
  );
  check(
    'the foot clearance is a separate, chargeable, longer release',
    short.kind === 'clear' &&
      long.kind === 'clear' &&
      long.speed > short.speed &&
      long.speed > thrown.speed * 2,
    `short ${short.speed.toFixed(2)} long ${long.speed.toFixed(2)} throw ${thrown.speed.toFixed(2)}`,
  );
  check(
    'only the foot clearance opens an aftertouch window',
    long.aftertouch === 0 && thrown.aftertouch === -1,
  );
}

{
  // four-way dive: a save when the ball is in reach, a grounded lock when not
  const dive = (mx, ballX) => {
    const w = keeperWorld();
    place(w, 'ball', ballX, GK_Z);
    let save = null;
    let whiff = null;
    let start = null;
    for (let t = 0; t < 90; t++) {
      const inp = t === 0 ? { dive: true, moveXFx: mx, moveZFx: 0 } : {};
      for (const e of step(w, [inp, null])) {
        if (e.type === 'keeper-save') save = e;
        if (e.type === 'keeper-whiff') whiff = e;
        if (e.type === 'dive-start') start = e;
      }
      if (t === 3 && (save || whiff)) break;
    }
    return { save, whiff, start, state: readState(w) };
  };
  const right = dive(FX_ONE, 45);
  const wrong = dive(-FX_ONE, 45);
  check(
    'a dive into the ball is a save that kills the shot',
    !!right.save && right.start.dir === 1 && !right.whiff,
    `dir ${right.start?.dir}`,
  );
  check(
    'a dive the wrong way whiffs and grounds the keeper for ~60 ticks',
    !!wrong.whiff && !wrong.save && wrong.start.dir === 0,
    `whiff ${!!wrong.whiff}`,
  );
  check(
    'the whiff lock is the designed length',
    CONSTANTS.DIVE_WHIFF_LOCK_TICKS === 60,
    String(CONSTANTS.DIVE_WHIFF_LOCK_TICKS),
  );

  // the four directions really are four
  const dirs = new Set();
  for (const [mx, mz] of [[-FX_ONE, 0], [FX_ONE, 0], [0, -FX_ONE], [0, FX_ONE]]) {
    const w = keeperWorld();
    place(w, 'ball', 300, 300);
    for (const e of step(w, [{ dive: true, moveXFx: mx, moveZFx: mz }, null])) {
      if (e.type === 'dive-start') dirs.add(e.dir);
    }
  }
  check('the dive resolves to exactly four directions', dirs.size === 4, [...dirs].join(','));
}

{
  // grounded means grounded: input during the lock must not accelerate him
  const w = keeperWorld();
  place(w, 'ball', 300, 300);
  step(w, [{ dive: true, moveXFx: -FX_ONE, moveZFx: 0 }, null]);
  for (let t = 0; t < CONSTANTS.DIVE_ACTIVE_TICKS; t++) step(w, [{}, null]);
  const locked = readState(w).players[0].diveLock;
  const speeds = [];
  for (let t = 0; t < 12; t++) {
    step(w, [{ moveXFx: FX_ONE, moveZFx: 0 }, null]);
    const p = readState(w).players[0];
    speeds.push(Math.hypot(p.vx, p.vz));
  }
  let decaying = true;
  for (let i = 1; i < speeds.length; i++) if (speeds[i] >= speeds[i - 1]) decaying = false;
  check(
    'the whiff lock takes his legs away for its full length',
    locked >= CONSTANTS.DIVE_WHIFF_LOCK_TICKS - 1 && decaying,
    `lock ${locked}`,
  );
}

{
  // grief lock: a keeper cannot throw his own hold into his own net
  const w = keeperWorld();
  step(w, [{ catchBall: true }, null]);
  const grief = readState(w).griefLock;
  let voided = null;
  let goal = null;
  // throw it straight backwards, at his own goal
  step(w, [{ throwBall: true, moveXFx: 0, moveZFx: -FX_ONE }, null]);
  const lock = readState(w).griefLock;
  for (let t = 0; t < 120 && !voided && !goal; t++) {
    for (const e of step(w, [{}, null])) {
      if (e.type === 'grief-void') voided = e;
      if (e.type === 'goal') goal = e;
    }
  }
  const s = readState(w);
  check(
    'releasing a hold arms the own-goal grief lock',
    grief.team === -1 && lock.team === 0 && lock.ticks > 0,
    `${JSON.stringify(lock)}`,
  );
  check(
    'a held ball released into its own goal is NOT a goal',
    !!voided && !goal && s.score[0] === 0 && s.score[1] === 0,
    `voided ${!!voided} goal ${!!goal} score ${s.score}`,
  );
  check(
    'the void puts the ball back in his hands so he takes it again',
    s.ball.holder === 0 && s.ball.holdTicks === CONSTANTS.CATCH_HOLD_TICKS,
    `holder ${s.ball.holder} ticks ${s.ball.holdTicks}`,
  );
  check(
    'the grief lock is the designed length',
    CONSTANTS.GRIEF_LOCK_TICKS === 180,
    String(CONSTANTS.GRIEF_LOCK_TICKS),
  );
}

{
  // an ordinary own goal, with no hold anywhere near it, still counts
  const w = keeperWorld();
  place(w, 0, 150, -200);
  place(w, 'ball', 0, -400, 0, -6);
  let goal = null;
  for (let t = 0; t < 60 && !goal; t++) {
    for (const e of step(w, [{}, null])) if (e.type === 'goal') goal = e;
  }
  check(
    'an own goal that did not come out of a hold still counts',
    goal && goal.team === 1 && readState(w).score[1] === 1,
    `${JSON.stringify(goal)}`,
  );
}

// ------------------------------------- 5. match rules (rows #26, #27, #28, #29)

section('pitch presets (row #28)');

const U = (raw) => raw / FX_ONE;

{
  check(
    'there are exactly three presets, coded 1..3',
    PITCH_PRESET_LIST.length === 3 &&
      PITCH_PRESET_LIST.map((p) => p.code).join(',') === '1,2,3' &&
      PITCH_PRESET_LIST.map((p) => p.id).join(',') === 'kucuk,orta,buyuk',
    PITCH_PRESET_LIST.map((p) => `${p.code}:${p.id}`).join(' '),
  );
  check(
    'preset code 0 is not a preset, so an uninitialised state cannot pass for one',
    PITCH_PRESETS[0] === null && pitchCodeOf(0) === 0 && pitchCodeOf(4) === 0,
  );
  check(
    'pitchPreset resolves ids, aliases and codes, and throws on anything else',
    pitchPreset('small') === PITCH_PRESETS[PITCH_KUCUK] &&
      pitchPreset(PITCH_BUYUK) === PITCH_PRESETS[PITCH_BUYUK] &&
      (() => {
        try {
          pitchPreset('__proto__');
          return false;
        } catch (err) {
          return err instanceof SettingsError && err.code === 'bad-pitch';
        }
      })(),
  );
  const orta = PITCH_PRESETS[PITCH_ORTA];
  check(
    'the medium preset is bit-for-bit the LOCKED Phase 1.2 geometry',
    orta.halfX === CONSTANTS.PITCH_HALF_X &&
      orta.halfZ === CONSTANTS.PITCH_HALF_Z &&
      orta.goalHalfX === CONSTANTS.GOAL_HALF_X &&
      orta.penaltyHalfX === CONSTANTS.PENALTY_HALF_X &&
      orta.penaltyDepth === CONSTANTS.PENALTY_DEPTH &&
      orta.spawnZ === CONSTANTS.SPAWN_Z &&
      orta.spawnXStep === CONSTANTS.SPAWN_X_STEP,
  );
  check(
    'the preset table is not in the physics table, so constantsHash is untouched',
    // ADR-0009 widened the pitch and the goal and retuned TACKLE_REACH, so the
    // physics table changed on purpose and this hash moved with it. That is
    // exactly what the hash is for: an accidental edit shows up here.
    CONSTANTS.PITCH_PRESET === undefined && constantsHash === '6c3972cb',
    constantsHash,
  );
}

{
  // every length is the same multiple of the medium preset, checked by exact
  // cross-multiplication so no float ever decides whether a ratio holds
  const base = PITCH_PRESETS[PITCH_ORTA];
  const fields = [
    'halfX',
    'halfZ',
    'goalHalfX',
    'penaltyHalfX',
    'penaltyDepth',
    'spawnZ',
    'spawnXStep',
    'keeperGuardZ',
  ];
  const bad = [];
  for (const p of PITCH_PRESET_LIST) {
    // p[f] / base[f] must be exactly p.scaleNum / p.scaleDen, for every length
    for (const f of fields) {
      if (p[f] * p.scaleDen !== base[f] * p.scaleNum) bad.push(`${p.id}.${f}`);
    }
  }
  check(
    'every preset is one uniform scale of the medium one — no shape changes',
    bad.length === 0,
    bad.join(' '),
  );
  check(
    'the three presets really are different sizes',
    PITCH_PRESETS[PITCH_KUCUK].halfZ < base.halfZ &&
      base.halfZ < PITCH_PRESETS[PITCH_BUYUK].halfZ,
    PITCH_PRESET_LIST.map((p) => `${p.id} ${U(p.halfX) * 2}x${U(p.halfZ) * 2}`).join(', '),
  );
}

{
  // Coherence, preset by preset. These are the inversions that a naive scale
  // would produce at the small end: a goal wider than its penalty area, a
  // penalty area deeper than the half, a spawn row outside the walls.
  const bad = [];
  for (const p of PITCH_PRESET_LIST) {
    const note = (why) => bad.push(`${p.id}: ${why}`);
    if (!(p.goalHalfX > 0 && p.goalHalfX < p.penaltyHalfX)) note('goal not inside the box');
    if (!(p.penaltyHalfX < p.halfX)) note('box wider than the pitch');
    if (!(p.goalHalfX > CONSTANTS.POST_RADIUS + CONSTANTS.BALL_RADIUS)) {
      note('goal mouth too narrow for the ball to pass the posts');
    }
    if (!(p.penaltyDepth > 0 && p.halfZ - p.penaltyDepth > 0)) note('box crosses the halfway line');
    if (!(p.spawnZ > 0 && p.spawnZ < p.halfZ - CONSTANTS.PLAYER_RADIUS)) {
      note('kickoff row outside the pitch');
    }
    if (!(p.keeperGuardZ < p.halfZ && p.keeperGuardZ > p.halfZ - p.penaltyDepth)) {
      note('keeper guard line outside its own box');
    }
    if (p.spawnXStep % 2 !== 0) note('spawn step is odd, so the row cannot be centred');
    // widest legal team is MAX_PLAYERS/2; its outermost player must fit
    const widest = ((CONSTANTS.MAX_PLAYERS / 2 - 1) * p.spawnXStep) / 2;
    if (!(widest < p.halfX - CONSTANTS.PLAYER_RADIUS)) note('a full team does not fit on the row');
    if (!(p.halfX < p.halfZ)) note('the long axis is no longer z');
  }
  check('every preset is a coherent arena, smallest included', bad.length === 0, bad.join('; '));
}

{
  // kickoff is the centre spot on every preset, and the two sides mirror
  const bad = [];
  for (const p of PITCH_PRESET_LIST) {
    const w = createWorld({ playerCount: 12, settings: { pitch: p.id } });
    const s = readState(w);
    if (s.ball.x !== 0 || s.ball.z !== 0) bad.push(`${p.id}: ball off the centre spot`);
    let sum = 0;
    let mirrored = true;
    for (const pl of s.players) {
      sum += pl.x;
      const want = pl.team === 0 ? -U(p.spawnZ) : U(p.spawnZ);
      if (pl.z !== want) mirrored = false;
      if (Math.abs(pl.x) > U(p.halfX) - U(CONSTANTS.PLAYER_RADIUS)) {
        bad.push(`${p.id}: player outside the wall`);
      }
      if (pl.team === 0 ? pl.z >= 0 : pl.z <= 0) bad.push(`${p.id}: player in the wrong half`);
    }
    if (sum !== 0) bad.push(`${p.id}: spawn row not centred (${sum})`);
    if (!mirrored) bad.push(`${p.id}: spawn rows not mirrored`);
    if (pitchOf(w) !== p) bad.push(`${p.id}: world reads a different preset`);
  }
  check('a 12-player kickoff is centred and legal on every preset', bad.length === 0, bad.join('; '));
}

{
  // the SAME relative shot scores on every preset: 40% of the way to the post,
  // 10 units past the goal line in that preset's own units
  const scored = [];
  for (const p of PITCH_PRESET_LIST) {
    for (const team of [0, 1]) {
      const w = createWorld({ playerCount: 2, settings: { pitch: p.id, scoreLimit: 0 } });
      const x = (U(p.goalHalfX) * 2) / 5;
      const z = (U(p.halfZ) + U(CONSTANTS.BALL_RADIUS) + 10) * (team === 0 ? 1 : -1);
      place(w, 'ball', x, z, 0, 0);
      const goal = step(w, []).find((e) => e.type === 'goal');
      scored.push(goal && goal.team === team);
    }
  }
  check(
    'the same relative shot is a goal on all three presets, both ends',
    scored.length === 6 && scored.every(Boolean),
    scored.join(','),
  );
}

{
  // a shot at the same relative x but OUTSIDE the mouth must miss everywhere
  const missed = [];
  for (const p of PITCH_PRESET_LIST) {
    const w = createWorld({ playerCount: 2, settings: { pitch: p.id, scoreLimit: 0 } });
    place(w, 'ball', U(p.goalHalfX) + 12, U(p.halfZ) + 30, 0, 0);
    missed.push(!step(w, []).some((e) => e.type === 'goal'));
  }
  check('a shot wide of the post is no goal on any preset', missed.every(Boolean), missed.join(','));
}

{
  // the walls the sim actually enforces move with the preset
  const bad = [];
  for (const p of PITCH_PRESET_LIST) {
    const w = createWorld({ playerCount: 2, settings: { pitch: p.id } });
    place(w, 'ball', U(p.halfX) - 1, 0, 8, 0);
    for (let t = 0; t < 4; t++) step(w, []);
    const b = readState(w).ball;
    if (b.x > U(p.halfX) - U(CONSTANTS.BALL_RADIUS) + 1e-4) bad.push(`${p.id}: ball left the pitch`);
    if (b.vx >= 0) bad.push(`${p.id}: ball did not bounce back`);
  }
  check('side walls sit at the preset half width on every preset', bad.length === 0, bad.join('; '));
}

{
  const small = PITCH_PRESETS[PITCH_KUCUK];
  const big = PITCH_PRESETS[PITCH_BUYUK];
  check(
    'the penalty-area predicate follows the preset it is given',
    inPenaltyArea(0, -small.halfZ, 0, small) &&
      !inPenaltyArea(0, -small.halfZ, 0, big) &&
      inPenaltyArea(0, -big.halfZ, 0, big),
    'a point on the small goal line is not in the big box',
  );
}

section('golden goal (row #26)');

const LEVEL = { durationSeconds: 1, scoreLimit: 0, mercyRule: false, keepers: false };

{
  // 60 ticks of clock; nobody scores; the rule is off
  const w = ruleWorld({ ...LEVEL, goldenGoal: false });
  let end = null;
  for (let t = 0; t < 60; t++) for (const e of step(w, [])) if (e.type === 'match-end') end = e;
  const s = readState(w);
  check(
    'golden goal OFF: a level match ends drawn at full time',
    end !== null && end.reason === 'full-time' && end.winner === -1 && s.match.over,
    JSON.stringify(end),
  );
  check(
    'the clock ends the match on exactly the last tick of the duration',
    end !== null && end.tick === 59 && s.tick === 60,
    end ? `tick ${end.tick}` : 'no end',
  );
}

{
  const w = ruleWorld({ ...LEVEL, goldenGoal: true });
  const seen = [];
  for (let t = 0; t < 60; t++) for (const e of step(w, [])) seen.push(e.type);
  const s = readState(w);
  check(
    'golden goal ON: a level match does not end at full time, it goes golden',
    seen.includes('golden-goal') && !seen.includes('match-end') && !s.match.over,
    `${seen.join(',')} phase=${s.match.phase}`,
  );
  check('the golden-goal phase is visible in the state', s.match.phase === 'golden-goal');

  // the clock keeps running and the match keeps simulating
  for (let t = 0; t < 30; t++) step(w, []);
  check(
    'play continues past full time while the tie is unbroken',
    readState(w).tick === 90 && !readState(w).match.over,
  );

  const events = driveGoals(w, 1, 1);
  const end = events.find((e) => e.type === 'match-end');
  const after = readState(w);
  check(
    'the first golden goal ends the match immediately, to the scorer',
    end != null && end.reason === 'golden-goal' && end.winner === 1 && after.match.over,
    JSON.stringify(end),
  );
  check(
    'the golden goal is the only goal on the board',
    after.score[0] === 0 && after.score[1] === 1,
    after.score.join('-'),
  );
}

{
  // leading at full time is a normal full-time win even with golden goal on
  const w = ruleWorld({ ...LEVEL, goldenGoal: true, durationSeconds: 2 });
  driveGoals(w, 0, 1);
  let end = null;
  const seen = [];
  while (readState(w).tick < 120) {
    for (const e of step(w, [])) {
      seen.push(e.type);
      if (e.type === 'match-end') end = e;
    }
  }
  check(
    'golden goal ON but a side is leading: full time still ends the match',
    end != null && end.reason === 'full-time' && end.winner === 0 && !seen.includes('golden-goal'),
    JSON.stringify(end),
  );
}

{
  // a goal on the very last tick that levels the scores must still open the
  // golden-goal period — the full-time test has to run after the goal, not
  // instead of it
  const w = ruleWorld({ ...LEVEL, goldenGoal: true, durationSeconds: 1 });
  driveGoals(w, 0, 1);
  while (readState(w).tick < 59) step(w, []);
  forceGoal(w, 1);
  const seen = step(w, []).map((e) => e.type);
  check(
    'a levelling goal on the final tick opens the golden-goal period',
    seen.includes('goal') && seen.includes('golden-goal') && !seen.includes('match-end'),
    seen.join(','),
  );
}

{
  // finished means finished: the world freezes
  const w = ruleWorld({ durationSeconds: 1, scoreLimit: 0, goldenGoal: false, mercyRule: false, keepers: false });
  while (!readState(w).match.over) step(w, []);
  const frozen = checksum(w);
  const before = readState(w);
  const events = driveGoals(w, 0, 3);
  const after = readState(w);
  check(
    'a finished match ignores further play: no goals, no events',
    events.length === 0 && after.score.join() === before.score.join(),
    `${events.length} events, ${after.score.join('-')}`,
  );
  check(
    'a finished match still advances its clock, so the net layer keeps ticking',
    after.tick === before.tick + 3,
    `${before.tick} -> ${after.tick}`,
  );
  check(
    'a finished match freezes everything except the clock',
    frozen !== checksum(w) && after.ball.vx === 0 && after.players[0].x === before.players[0].x,
  );
}

section('mercy rule (row #27)');

const MERCY_BASE = { durationSeconds: 0, scoreLimit: 0, goldenGoal: false, keepers: false };

{
  const w = ruleWorld({ ...MERCY_BASE, mercyRule: true });
  const atThree = driveGoals(w, 0, MERCY_GOAL_DIFF - 1);
  check(
    `mercy ON: a ${MERCY_GOAL_DIFF - 1}-goal gap does not stop the match`,
    !atThree.some((e) => e.type === 'match-end') && !readState(w).match.over,
    readState(w).score.join('-'),
  );
  const fourth = driveGoals(w, 0, 1);
  const end = fourth.find((e) => e.type === 'match-end');
  check(
    `mercy ON: the match ends the moment the gap reaches ${MERCY_GOAL_DIFF}`,
    end != null && end.reason === 'mercy' && end.winner === 0,
    JSON.stringify(end),
  );
  check(
    'mercy ends on the goal that reaches the gap, not a tick later',
    readState(w).score.join('-') === `${MERCY_GOAL_DIFF}-0`,
    readState(w).score.join('-'),
  );
}

{
  // the gap, not the total: 3-0 then a reply then three more is still a 4 gap
  const w = ruleWorld({ ...MERCY_BASE, mercyRule: true });
  driveGoals(w, 0, 3);
  driveGoals(w, 1, 1);
  const mid = readState(w);
  driveGoals(w, 0, 1);
  const stillOn = !readState(w).match.over;
  const end = driveGoals(w, 0, 1).find((e) => e.type === 'match-end');
  check(
    'mercy reads the GAP, not the score: 3-1 and 4-1 keep playing, 5-1 does not',
    mid.score.join('-') === '3-1' && stillOn && end != null && end.reason === 'mercy',
    JSON.stringify(end),
  );
}

{
  const w = ruleWorld({ ...MERCY_BASE, mercyRule: true });
  const end = driveGoals(w, 1, MERCY_GOAL_DIFF).find((e) => e.type === 'match-end');
  check(
    'mercy fires the same way for either team',
    end != null && end.reason === 'mercy' && end.winner === 1,
    JSON.stringify(end),
  );
}

{
  const w = ruleWorld({ ...MERCY_BASE, mercyRule: false });
  const events = driveGoals(w, 0, MERCY_GOAL_DIFF + 2);
  const s = readState(w);
  check(
    'mercy OFF: a six-goal rout never ends the match',
    !events.some((e) => e.type === 'match-end') && !s.match.over && s.score[0] === 6,
    `${s.score.join('-')} phase=${s.match.phase}`,
  );
}

{
  // the two goal-triggered rules are independent of each other
  const w = ruleWorld({ durationSeconds: 0, scoreLimit: 2, goldenGoal: false, mercyRule: false, keepers: false });
  const end = driveGoals(w, 0, 2).find((e) => e.type === 'match-end');
  check(
    'the score limit still ends a match with mercy switched off',
    end != null && end.reason === 'score-limit' && end.winner === 0,
    JSON.stringify(end),
  );
  const w2 = ruleWorld({ ...MERCY_BASE, mercyRule: true, scoreLimit: 9 });
  const end2 = driveGoals(w2, 0, MERCY_GOAL_DIFF).find((e) => e.type === 'match-end');
  check(
    'mercy beats a score limit it reaches first',
    end2 != null && end2.reason === 'mercy',
    JSON.stringify(end2),
  );
}

section('room settings (row #29)');

{
  check(
    'the defaults are canonical and normalisation is idempotent',
    isCanonicalSettings(DEFAULT_SETTINGS) &&
      settingsHash(normaliseSettings(normaliseSettings(DEFAULT_SETTINGS))) ===
        settingsHash(DEFAULT_SETTINGS),
    serializeSettings(DEFAULT_SETTINGS),
  );
  check(
    'normaliseSettings returns a frozen object callers cannot corrupt',
    Object.isFrozen(normaliseSettings({})),
  );
}

{
  // garbage of every shape must produce the defaults, never a throw
  const junk = [
    undefined,
    null,
    0,
    42,
    'orta',
    true,
    [],
    [1, 2, 3],
    () => {},
    new Map(),
    JSON.parse('{"__proto__":{"pitch":"buyuk"}}'),
  ];
  const bad = [];
  for (const j of junk) {
    let out;
    try {
      out = normaliseSettings(j);
    } catch (err) {
      bad.push(`threw on ${typeof j}: ${err.message}`);
      continue;
    }
    if (settingsHash(out) !== settingsHash(DEFAULT_SETTINGS)) bad.push(`${String(j)} -> ${serializeSettings(out)}`);
  }
  check('hostile or absent input normalises to the defaults without throwing', bad.length === 0, bad.join('; '));
  check(
    'a poisoned prototype cannot smuggle a setting through',
    normaliseSettings(JSON.parse('{"__proto__":{"pitch":"buyuk"}}')).pitch === 'orta' &&
      ({}).pitch === undefined,
  );
}

{
  const hostile = [
    ['durationSeconds', [-1, 1e9, 1.5, NaN, Infinity, -Infinity, '180', true, null, {}]],
    ['scoreLimit', [-1, 100, 2.5, NaN, Infinity, '3', false, null, []]],
    ['pitch', ['huge', '', '__proto__', 'constructor', 'toString', 0, 4, -1, 1.5, null, {}, true]],
    ['goldenGoal', ['yes', 2, -1, '', null, {}, NaN]],
    ['mercyRule', ['true', 2, null, [], NaN]],
    ['keepers', ['off', 7, null, {}, NaN]],
  ];
  const leaked = [];
  const notStrict = [];
  for (const [key, values] of hostile) {
    for (const v of values) {
      const out = normaliseSettings({ [key]: v });
      if (out[key] !== DEFAULT_SETTINGS[key]) leaked.push(`${key}=${String(v)} -> ${String(out[key])}`);
      let threw = false;
      try {
        normaliseSettings({ [key]: v }, { strict: true });
      } catch (err) {
        threw = err instanceof SettingsError && err.issues.length > 0;
      }
      if (!threw) notStrict.push(`${key}=${String(v)}`);
    }
  }
  check('every out-of-range or wrong-typed field falls back to its default', leaked.length === 0, leaked.join('; '));
  check('strict mode refuses the same values loudly, with an issue list', notStrict.length === 0, notStrict.join('; '));
}

{
  const accepted = normaliseSettings({
    durationSeconds: 0,
    scoreLimit: 0,
    pitch: 'LARGE',
    goldenGoal: 1,
    mercyRule: 0,
    keepers: false,
  });
  check(
    'the legal edges of every range are accepted, aliases and 0/1 included',
    accepted.durationSeconds === 0 &&
      accepted.scoreLimit === 0 &&
      accepted.pitch === 'buyuk' &&
      accepted.goldenGoal === true &&
      accepted.mercyRule === false &&
      accepted.keepers === false,
    serializeSettings(accepted),
  );
  check(
    'the far edges of the ranges are accepted too',
    normaliseSettings({ durationSeconds: 3600, scoreLimit: 99 }).durationSeconds === 3600 &&
      normaliseSettings({ scoreLimit: 99 }).scoreLimit === 99,
  );
  check(
    'unknown keys are ignored in lenient mode and refused in strict mode',
    normaliseSettings({ cheat: true, pitch: 'kucuk' }).pitch === 'kucuk' &&
      !isCanonicalSettings({ cheat: true }),
  );
}

{
  // settingsHash moves for a change and only for a change
  const base = normaliseSettings({});
  const variants = {
    durationSeconds: { durationSeconds: 181 },
    scoreLimit: { scoreLimit: 4 },
    pitch: { pitch: 'kucuk' },
    goldenGoal: { goldenGoal: true },
    mercyRule: { mercyRule: false },
    keepers: { keepers: false },
  };
  const hashes = new Map([['base', settingsHash(base)]]);
  for (const [k, v] of Object.entries(variants)) hashes.set(k, settingsHash({ ...base, ...v }));
  check(
    'settingsHash changes when any one of the six settings changes',
    new Set(hashes.values()).size === hashes.size,
    [...hashes].map(([k, h]) => `${k}:${h}`).join(' '),
  );
  const reordered = {
    keepers: base.keepers,
    pitch: base.pitch,
    scoreLimit: base.scoreLimit,
    mercyRule: base.mercyRule,
    durationSeconds: base.durationSeconds,
    goldenGoal: base.goldenGoal,
  };
  check(
    'settingsHash ignores key order and unknown extras',
    settingsHash(reordered) === settingsHash(base) &&
      settingsHash({ ...base, nonsense: 1 }) === settingsHash(base),
  );
  check(
    'settingsHash is a stable 32-bit hex digest and sameSettings agrees with it',
    /^[0-9a-f]{8}$/.test(settingsHash(base)) &&
      sameSettings(base, reordered) &&
      !sameSettings(base, { ...base, pitch: 'buyuk' }),
    settingsHash(base),
  );
  check(
    'assertSameSettings passes on a match and throws on a mismatch',
    (() => {
      assertSameSettings(base, reordered);
      try {
        assertSameSettings(base, { ...base, goldenGoal: true });
        return false;
      } catch (err) {
        return err instanceof SettingsError && err.code === 'settings-mismatch';
      }
    })(),
  );
}

{
  // the wire form the net layer broadcasts
  const s = normaliseSettings({ durationSeconds: 300, scoreLimit: 5, pitch: 'buyuk', goldenGoal: true, mercyRule: false, keepers: false });
  const words = encodeSettings(s);
  check(
    'encodeSettings is six Int32 words and decodeSettings is its exact inverse',
    words.length === SETTINGS_WORDS && sameSettings(decodeSettings(words), s),
    Array.from(words).join(','),
  );
  const refusals = [];
  const expectThrow = (label, fn) => {
    try {
      fn();
      refusals.push(label);
    } catch (err) {
      if (!(err instanceof SettingsError)) refusals.push(`${label}: wrong error type`);
    }
  };
  expectThrow('short payload', () => decodeSettings(words.slice(0, 3)));
  expectThrow('no payload', () => decodeSettings(null));
  expectThrow('pitch code 0', () => {
    const w = Int32Array.from(words);
    w[2] = 0;
    decodeSettings(w);
  });
  expectThrow('pitch code 9', () => {
    const w = Int32Array.from(words);
    w[2] = 9;
    decodeSettings(w);
  });
  expectThrow('unknown rule bit', () => {
    const w = Int32Array.from(words);
    w[3] |= 8;
    decodeSettings(w);
  });
  expectThrow('duration out of range', () => {
    const w = Int32Array.from(words);
    w[0] = 999999;
    decodeSettings(w);
  });
  expectThrow('tampered hash word', () => {
    const w = Int32Array.from(words);
    w[4] ^= 1;
    decodeSettings(w);
  });
  expectThrow('tampered payload, stale hash', () => {
    const w = Int32Array.from(words);
    w[1] = 7;
    decodeSettings(w);
  });
  check('decodeSettings refuses every malformed settings payload', refusals.length === 0, refusals.join('; '));
}

{
  const s = { durationSeconds: 90, scoreLimit: 7, pitch: 'kucuk', goldenGoal: true, mercyRule: false, keepers: true };
  const w = createWorld({ playerCount: 4, roles: [1, 1, 0, 0], settings: s });
  const buf = w.buf;
  check(
    'createWorld writes the settings into the state header',
    buf[HDR_PITCH] === PITCH_KUCUK &&
      buf[HDR_DURATION_TICKS] === durationTicks(s) &&
      buf[HDR_SCORE_LIMIT] === 7 &&
      buf[HDR_RULE_FLAGS] === settingsFlags(s) &&
      buf[HDR_SETTINGS_HASH] === settingsHashInt(s) &&
      buf[HDR_MATCH_STATE] === MATCH_RUNNING,
    `${buf[HDR_PITCH]} ${buf[HDR_DURATION_TICKS]} ${buf[HDR_RULE_FLAGS]}`,
  );
  check(
    'worldSettings reads back exactly what went in',
    sameSettings(worldSettings(w), s) && readState(w).pitch === 'kucuk',
    serializeSettings(worldSettings(w)),
  );
  check(
    'rule flags are the documented bits',
    (buf[HDR_RULE_FLAGS] & RULE_GOLDEN_GOAL) !== 0 &&
      (buf[HDR_RULE_FLAGS] & RULE_MERCY) === 0 &&
      (buf[HDR_RULE_FLAGS] & RULE_KEEPERS) !== 0,
  );
  check(
    'createWorld accepts a raw lobby object and clamps it on the way in',
    createWorld({ playerCount: 2, settings: { pitch: 'nonsense', scoreLimit: -5 } }).buf[HDR_PITCH] ===
      PITCH_ORTA,
  );
}

{
  const withGk = createWorld({ playerCount: 4, roles: [1, 1, 0, 0], settings: { keepers: true } });
  const without = createWorld({ playerCount: 4, roles: [1, 1, 0, 0], settings: { keepers: false } });
  check(
    'keepers OFF strips every keeper role at match start (ADR-0001 still holds)',
    readState(withGk).players.filter((p) => p.role === 1).length === 2 &&
      readState(without).players.every((p) => p.role === 0) &&
      !keeperEmpowered(without, 0),
  );
}

section('settings and snapshots');

{
  const small = { pitch: 'kucuk', scoreLimit: 0 };
  const big = { pitch: 'buyuk', scoreLimit: 0 };
  const w = createWorld({ playerCount: 4, settings: big });
  for (let t = 0; t < 30; t++) step(w, []);
  const snap = serialize(w);

  check(
    'a snapshot round-trips when the caller expects the settings it was made under',
    checksum(deserialize(snap, { settings: big })) === checksum(w),
  );
  let refused = null;
  try {
    deserialize(snap, { settings: small });
  } catch (err) {
    refused = err;
  }
  check(
    'a big-pitch snapshot is REFUSED by a small-pitch client, not rescaled',
    refused instanceof SettingsError && refused.code === 'settings-mismatch',
    refused ? refused.message : 'accepted',
  );

  const others = [
    ['duration', { ...big, durationSeconds: 60 }],
    ['score limit', { ...big, scoreLimit: 5 }],
    ['golden goal', { ...big, goldenGoal: true }],
    ['mercy', { ...big, mercyRule: false }],
    ['keepers', { ...big, keepers: false }],
  ];
  const accepted = [];
  for (const [label, s] of others) {
    try {
      deserialize(snap, { settings: s });
      accepted.push(label);
    } catch {
      /* expected */
    }
  }
  check(
    'every other settings difference is refused just as loudly',
    accepted.length === 0,
    accepted.join(', '),
  );
}

{
  const w = createWorld({ playerCount: 2, settings: { pitch: 'kucuk' } });
  const tamper = (mutate) => {
    const snap = serialize(w);
    mutate(snap);
    try {
      deserialize(snap);
      return false;
    } catch {
      return true;
    }
  };
  check(
    'a tampered settings word is caught by the header hash, with no expectation passed',
    tamper((s) => {
      s[HDR_PITCH] = PITCH_BUYUK;
    }) &&
      tamper((s) => {
        s[HDR_SCORE_LIMIT] = 9;
      }) &&
      tamper((s) => {
        s[HDR_RULE_FLAGS] ^= RULE_MERCY;
      }) &&
      tamper((s) => {
        s[HDR_DURATION_TICKS] += 1;
      }),
  );
  check(
    'an impossible pitch code or match state is refused outright',
    tamper((s) => {
      s[HDR_PITCH] = 0;
    }) &&
      tamper((s) => {
        s[HDR_MATCH_STATE] = 7;
      }),
  );
  check(
    'a Phase 1.2 (v2) snapshot is refused rather than read on the wrong header',
    STATE_VERSION === 3 &&
      tamper((s) => {
        s[1] = 2;
      }),
  );
}

section('determinism with the new rules');

{
  const first = RULES_SCENARIOS.map(rulesTrace);
  const second = RULES_SCENARIOS.map(rulesTrace);
  const bad = [];
  for (let i = 0; i < first.length; i++) {
    const d = firstDiff(first[i].chain, second[i].chain);
    if (d !== -1) bad.push(`${RULES_SCENARIOS[i].name} diverges at tick ${d}`);
  }
  check('two rules runs in one process agree tick for tick', bad.length === 0, bad.join('; '));

  const golden = first[0];
  check(
    'the golden-goal scenario really walks the rule: goals, a golden period, an ending',
    golden.tally.goal === 5 &&
      golden.tally['golden-goal'] === 1 &&
      golden.tally['match-end'] === 1 &&
      golden.end.reason === 'golden-goal',
    JSON.stringify(golden.tally) + JSON.stringify(golden.end),
  );
  const mercy = first[1];
  check(
    'the mercy scenario ends on the fourth unanswered goal, on the big pitch',
    mercy.tally.goal === 4 && mercy.end && mercy.end.reason === 'mercy' && mercy.end.winner === 0,
    JSON.stringify(mercy.tally) + JSON.stringify(mercy.end),
  );
  check(
    'both rules scenarios end well before their last tick, so the freeze is exercised',
    golden.end.tick < RULES_SCENARIOS[0].ticks - 100 &&
      mercy.end.tick < RULES_SCENARIOS[1].ticks - 100,
    `${golden.end.tick} / ${mercy.end.tick}`,
  );

  const childRules = child.rules;
  const mismatched = [];
  for (const scn of RULES_SCENARIOS) {
    const mine = chainDigest(first[RULES_SCENARIOS.indexOf(scn)].chain);
    if (!childRules[scn.name] || childRules[scn.name].digest !== mine) {
      mismatched.push(scn.name);
    }
  }
  check(
    'a fresh child process reproduces both rules chains',
    mismatched.length === 0,
    mismatched.join(', '),
  );
}

{
  // a snapshot taken in the middle of a golden-goal period resumes into the
  // same chain, settings and all
  const scn = RULES_SCENARIOS[0];
  const reference = rulesTrace(scn);
  const wander = wanderScript(scn);
  const settings = normaliseSettings(scn.settings);
  let w = createWorld({ playerCount: scn.playerCount, roles: scn.roles, settings });
  const chain = [checksum(w)];
  for (let t = 0; t < scn.ticks; t++) {
    if (t === 650) w = deserialize(serialize(w), { settings }); // inside the golden period
    if (w.buf[HDR_MATCH_STATE] !== MATCH_FINISHED) {
      for (const [at, team] of scn.script) if (at === t) forceGoal(w, team);
    }
    const inputs = [];
    for (let p = 0; p < scn.playerCount; p++) {
      const d = wander[t][p] >= 0 ? wander[t][p] : dirTowardBall(w.buf, p);
      inputs.push(decodeInput(d | (wantsButtons(w.buf, p, t) << 4)));
    }
    step(w, inputs);
    chain.push(checksum(w));
  }
  const d = firstDiff(reference.chain, chain);
  check(
    'a serialize/deserialize seam inside the golden-goal period rejoins the chain',
    d === -1,
    d >= 0 ? `first divergence at tick ${d}` : '',
  );
}

// ----------------------------------------------------- 6. constantsHash

section('constantsHash');

check(
  'constantsHash is a stable 32-bit hex digest',
  /^[0-9a-f]{8}$/.test(constantsHash) && hashConstants() === constantsHash,
  constantsHash,
);
check(
  'constantsHash ignores declaration order',
  hashConstants(
    Object.fromEntries(Object.entries(CONSTANTS).slice().reverse()),
  ) === constantsHash,
);
{
  const mutated = { ...CONSTANTS, BALL_DAMPING: CONSTANTS.BALL_DAMPING + 1 };
  check(
    'changing one constant changes constantsHash',
    hashConstants(mutated) !== constantsHash,
    `${hashConstants(mutated)} vs ${constantsHash}`,
  );
  const same = { ...CONSTANTS };
  check('an untouched copy hashes identically', hashConstants(same) === constantsHash);
}

// ------------------------------------------------------------------ done

console.log(
  `\ncore ${CORE_VERSION} · constantsHash ${constantsHash} · chain ${chainDigest(
    runA.chain,
  )}`,
);
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
