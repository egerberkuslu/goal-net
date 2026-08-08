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
  quantiseInput,
  playerOffset,
  BALL_BASE,
  FIELD,
  CONSTANTS,
  constantsHash,
  hashConstants,
  fnv1aString,
  toHex32,
  fx,
  CORE_VERSION,
} from '../src/index.js';

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
  name: 'phase1-3000',
  seed: 0x5eed1234,
  ticks: 3000,
  playerCount: 4,
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
 * Press kick once the ball is nearly in reach, but only in short bursts: the
 * core arms on the rising edge of the button, so a permanently held kick would
 * fire exactly once per approach and the run would barely touch the impulse
 * path at all.
 */
function wantsKick(buf, p, t) {
  if (t % 10 > 1) return false;
  const o = playerOffset(p);
  const dx = buf[BALL_BASE] - buf[o + FIELD.P_X];
  const dz = buf[BALL_BASE + 1] - buf[o + FIELD.P_Z];
  return fx.fxHypot(dx, dz) - REACH < CONSTANTS.KICK_RANGE * 3;
}

/** Decode a recorded input code (dirIndex + 9 if kick) back into an input. */
function decodeInput(code) {
  const kick = code >= 9;
  const d = DIRS[code % 9];
  return { moveXFx: d[0], moveZFx: d[1], kick };
}

/**
 * Run the scenario, collecting the per-tick checksum chain and the input codes
 * that produced it. The codes are what Phase 2's NumPy port replays; it never
 * has to reimplement the steering above.
 */
function runTrace(scn = SCENARIO, wander = wanderScript(scn), onTick = null) {
  const world = createWorld({ playerCount: scn.playerCount });
  const chain = [checksum(world)]; // tick 0, before any step
  const codes = [];
  let goals = 0;
  let kicks = 0;
  for (let t = 0; t < scn.ticks; t++) {
    const frame = [];
    const inputs = [];
    for (let p = 0; p < scn.playerCount; p++) {
      const d = wander[t][p] >= 0 ? wander[t][p] : dirTowardBall(world.buf, p);
      const code = d + (wantsKick(world.buf, p, t) ? 9 : 0);
      frame.push(code);
      inputs.push(decodeInput(code));
    }
    codes.push(frame);
    for (const e of step(world, inputs)) {
      if (e.type === 'goal') goals++;
      else if (e.type === 'kick') kicks++;
    }
    chain.push(checksum(world));
    if (onTick) onTick(world, t);
  }
  return { world, chain, codes, goals, kicks };
}

/** Replay a recorded code stream with no policy in the loop at all. */
function replayCodes(scn, codes) {
  const world = createWorld({ playerCount: scn.playerCount });
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

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

// ------------------------------------------------------------ trace mode

if (process.argv.includes('--dump-trace')) {
  const { world, chain, codes, goals, kicks } = runTrace();
  process.stdout.write(
    JSON.stringify({
      core: CORE_VERSION,
      constantsHash,
      scenario: SCENARIO,
      // input encoding: code = dirIndex + (kick ? 9 : 0); DIRS is the
      // fixed-point direction table below, index 0 = no movement
      dirs: DIRS,
      goals,
      kicks,
      chainDigest: chainDigest(chain),
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
    'the scenario actually exercises the sim (kicks and goals happen)',
    runA.kicks > 50 && runA.goals > 0 && runA.chain.length === SCENARIO.ticks + 1,
    `kicks=${runA.kicks} goals=${runA.goals}`,
  );
  const replay = replayCodes(SCENARIO, runA.codes);
  const rd = firstDiff(runA.chain, replay.chain);
  check(
    'replaying the recorded input codes alone reproduces the chain',
    rd === -1,
    rd >= 0 ? `first divergence at tick ${rd}` : '',
  );
}

{
  // Fresh interpreter: if any module-level mutable state leaked into the sim,
  // a cold process would drift from a warm one.
  const raw = execFileSync(process.execPath, [SELF, '--dump-trace'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const child = JSON.parse(raw);
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
  const world = createWorld({ playerCount: SCENARIO.playerCount });
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
  place(w, 0, -150, -200);
  place(w, 1, 150, 200);
  place(w, 'ball', 189, 0, 10, 0);
  step(w, [null, null]);
  const b = readState(w).ball;
  check(
    'wall bounce returns bCoef * incoming speed',
    near(b.vx, -10 * e * bd, 2e-3) && near(b.x, 190, 1e-3),
    `vx ${b.vx.toFixed(4)} want ${(-10 * e * bd).toFixed(4)}, x ${b.x}`,
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
  check(
    'nothing tunnels out of the arena over 1500 contact-heavy ticks',
    worstX <= 200 && worstZ <= 431,
    `|x|max ${worstX.toFixed(2)} |z|max ${worstZ.toFixed(2)}`,
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

// ----------------------------------------------------- 4. constantsHash

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
