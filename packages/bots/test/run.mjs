// Headless gate for @goalnet/bots.
//
//   node packages/bots/test/run.mjs
//
// PASS/FAIL lines, a measured behaviour table, non-zero exit on failure. No
// DOM, no timers, no onnxruntime, no network: the ONNX path runs against a fake
// runtime that is nonetheless a real matrix multiply, so the whole decode chain
// is exercised.
//
// The load-bearing claims, in order of how much they would hurt if false
//
//   1. a scripted policy and an ONNX policy are interchangeable — the same
//      harness, the same host hook, the same action objects (section I)
//   2. the observation is a pure function of the pitch, and the same situation
//      seen from the other end produces the same vector (section B)
//   3. difficulty is a measurable thing and not a vibe (section F)
//   4. a scripted bot actually plays football: it touches the ball and it
//      scores (section G)

import { readFileSync } from 'node:fs';

import { createWorld, place, step, CONSTANTS } from '../../core/src/index.js';
import { createHostSession } from '../../net/src/index.js';

import {
  ACTION_VERSION,
  BOTS_VERSION,
  BUTTONS,
  CONTINUOUS_SIZE,
  DISCRETE_ACTIONS,
  DISCRETE_SIZE,
  OBS,
  OBSERVATION_SPEC,
  OBSERVATION_VERSION,
  OBS_SIZE,
  PITCH,
  PITCH_DIAG,
  actionsEqual,
  argmax,
  assertPolicy,
  checkBounds,
  createOnnxPolicy,
  createScriptedPolicy,
  decodeContinuous,
  decodeDiscrete,
  egoToWorld,
  encodeContinuous,
  encodeDiscrete,
  makeBotPolicy,
  neutralAction,
  observe,
  toCoreInput,
  TIERS,
} from '../src/index.js';

import {
  buildObservationScript,
  digestActions,
  playMatch,
  runObservationScript,
} from './harness.mjs';
import { createFakeRuntime } from './fakeRuntime.mjs';
import { FIXTURE_PATH, FIXTURE_CONFIG } from './make-fixture.mjs';

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`PASS  ${name}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function section(title) {
  console.log(`\n--- ${title}`);
}

// ============================================================ A  spec table

section('A  observation spec');

check('OBS_SIZE matches the spec length', OBS_SIZE === OBSERVATION_SPEC.length, `${OBS_SIZE} vs ${OBSERVATION_SPEC.length}`);
check('spec is 100 features', OBS_SIZE === 100, `got ${OBS_SIZE}`);
check(
  'spec indices are contiguous from 0',
  OBSERVATION_SPEC.every((f, i) => f.index === i),
);
check(
  'spec names are unique',
  new Set(OBSERVATION_SPEC.map((f) => f.name)).size === OBS_SIZE,
);
check(
  'every feature declares a sane range',
  OBSERVATION_SPEC.every((f) => Number.isFinite(f.lo) && Number.isFinite(f.hi) && f.lo < f.hi && f.desc.length > 0),
);
check(
  'OBS name map covers the whole spec',
  OBSERVATION_SPEC.every((f) => OBS[f.name] === f.index),
);

// ===================================================== B  observation itself

section('B  observation');

function scenarioWorld(teams = [0, 1]) {
  const w = createWorld({ teams });
  place(w, 'ball', 40, -120, 1.5, -2.5);
  place(w, 0, -60, -240, 0.8, 1.2);
  place(w, 1, 90, 30, -1.1, 0.4);
  return w;
}

const wA = scenarioWorld();
const obs1 = observe(wA, 0);
const obs2 = observe(wA, 0);
check(
  'same world observed twice gives an identical vector',
  obs1.length === OBS_SIZE && obs1.every((v, i) => v === obs2[i]),
);

// A fresh observer with its own scratch must agree with the reused one.
const reuseOut = new Float32Array(OBS_SIZE);
observe(wA, 0, { out: reuseOut });
check('a caller-supplied output buffer gives the same vector', reuseOut.every((v, i) => v === obs1[i]));

// The mirror: the same football rotated 180 degrees, with the teams swapped.
// Slot 0 of the mirrored world is a team 1 player in the position slot 0 of the
// original occupied, negated. Its attack-frame view must be identical.
const wB = createWorld({ teams: [1, 0] });
place(wB, 'ball', -40, 120, -1.5, 2.5);
place(wB, 0, 60, 240, -0.8, -1.2);
place(wB, 1, -90, -30, 1.1, -0.4);
const obsMirror = observe(wB, 0);
let mirrorWorst = 0;
let mirrorWorstName = '';
for (const f of OBSERVATION_SPEC) {
  const d = Math.abs(obs1[f.index] - obsMirror[f.index]);
  if (d > mirrorWorst) {
    mirrorWorst = d;
    mirrorWorstName = f.name;
  }
}
check(
  'the mirrored pitch produces the mirrored (i.e. identical attack-frame) vector',
  mirrorWorst === 0,
  `worst mismatch ${mirrorWorst} at ${mirrorWorstName}`,
);

// And the un-rotated truth is genuinely different, so the test above is not
// passing by accident on a symmetric position.
const obsOtherEnd = observe(wA, 1);
check(
  'the opponent sees a different vector than we do',
  OBSERVATION_SPEC.some((f) => obs1[f.index] !== obsOtherEnd[f.index]),
);

check('vector length is independent of the roster', observe(createWorld({ playerCount: 12 }), 5).length === OBS_SIZE);
check(
  'a 1v1 leaves every unused entity slot flagged absent',
  obs1[OBS.mate0_present] === 0 && obs1[OBS.opp0_present] === 1 && obs1[OBS.opp1_present] === 0,
);

// Bounds over a long, violent rollout: bots on the pitch, ball at speed, bodies
// against the walls. Nothing may leave its declared range.
{
  const w = createWorld({ teams: [0, 1, 0, 1, 0, 1] });
  const pol = [0, 1, 2, 3, 4, 5].map((i) =>
    createScriptedPolicy({ difficulty: i % 2 ? 'zor' : 'orta', seed: 100 + i }),
  );
  const stats = playMatch({
    policies: Object.fromEntries(pol.map((p, i) => [i, p])),
    roles: { 4: 'keeper', 5: 'keeper' },
    teams: [0, 1, 0, 1, 0, 1],
    ticks: 1200,
    seed: 9,
  });
  let violations = 0;
  const world = stats.world;
  place(world, 'ball', PITCH.HALF_X, PITCH.HALF_Z, 40, -40); // deliberately out of band
  for (let i = 0; i < 6; i++) {
    violations += checkBounds(observe(world, i)).length;
  }
  const w2 = createWorld({ teams: [0, 1] });
  for (let t = 0; t < 400; t++) {
    step(w2, [
      { moveX: Math.sin(t) > 0 ? 1 : -1, moveZ: 1, kick: t % 7 === 0 },
      { moveX: -1, moveZ: -1, kick: t % 5 === 0 },
    ]);
    violations += checkBounds(observe(w2, 0)).length + checkBounds(observe(w2, 1)).length;
  }
  check('every feature stays inside its declared range', violations === 0, `${violations} violations`);
  check('a bot match produces contacts to bound-check against', stats.contacts > 0);
}

// =========================================================== C  action space

section('C  action space');

check('discrete table is 18 entries', DISCRETE_SIZE === 18 && DISCRETE_ACTIONS.length === 18);
check('continuous head is 2 axes + one logit per button', CONTINUOUS_SIZE === 2 + BUTTONS.length);
check(
  'discrete table indices match their position',
  DISCRETE_ACTIONS.every((a, i) => a.index === i),
);
check(
  'discrete movement vectors are unit length or zero',
  DISCRETE_ACTIONS.every((a) => {
    const l = Math.sqrt(a.moveX * a.moveX + a.moveZ * a.moveZ);
    return l === 0 || Math.abs(l - 1) < 1e-9;
  }),
);

let discreteRoundTrips = 0;
for (let i = 0; i < DISCRETE_SIZE; i++) {
  if (encodeDiscrete(decodeDiscrete(i)) === i) discreteRoundTrips++;
}
check('every discrete action round-trips', discreteRoundTrips === DISCRETE_SIZE, `${discreteRoundTrips}/${DISCRETE_SIZE}`);

let continuousRoundTrips = 0;
for (let i = 0; i < DISCRETE_SIZE; i++) {
  const a = decodeDiscrete(i);
  const vec = encodeContinuous(a);
  const back = decodeContinuous(vec);
  // 1e-6: the head is a Float32Array, the table is float64, and the diagonals
  // differ in the last bits of the float32 mantissa.
  if (actionsEqual(a, back, 1e-6)) continuousRoundTrips++;
}
check('every action survives the continuous head', continuousRoundTrips === DISCRETE_SIZE, `${continuousRoundTrips}/${DISCRETE_SIZE}`);
check(
  'the continuous round trip is exact in float64',
  DISCRETE_ACTIONS.every((_, i) => {
    const a = decodeDiscrete(i);
    return actionsEqual(a, decodeContinuous(encodeContinuous(a, new Float64Array(CONTINUOUS_SIZE))));
  }),
);

check(
  'argmax breaks ties at the lowest index',
  argmax([1, 1, 1]) === 0 && argmax([0, 5, 5]) === 1,
);

// One-hot logits must select the action they name.
let oneHotOk = 0;
for (let i = 0; i < DISCRETE_SIZE; i++) {
  const logits = new Float32Array(DISCRETE_SIZE).fill(-1);
  logits[i] = 1;
  if (argmax(logits) === i) oneHotOk++;
}
check('a one-hot discrete head selects its own action', oneHotOk === DISCRETE_SIZE);

// The frame rotation is an involution and it is a rotation, not a mirror.
{
  const a = decodeDiscrete(2); // forward-right
  const world1 = egoToWorld(a, 1, neutralAction());
  const worldM1 = egoToWorld(a, -1, neutralAction());
  const back = egoToWorld(worldM1, -1, neutralAction());
  check('egoToWorld is the identity for team 0', actionsEqual(a, world1));
  check('egoToWorld is its own inverse', actionsEqual(a, back));
  check(
    'team 1 rotates BOTH axes (a rotation, not a z mirror)',
    worldM1.moveX === -a.moveX && worldM1.moveZ === -a.moveZ,
  );
}

check(
  'toCoreInput emits exactly what the core reads',
  (() => {
    const inp = toCoreInput({ moveX: 0.5, moveZ: -0.5, kick: true, charge: true });
    return inp.moveX === 0.5 && inp.moveZ === -0.5 && inp.kick === true && inp.charge === true;
  })(),
);
check(
  'toCoreInput clamps an over-long movement vector to the unit disc',
  (() => {
    const inp = toCoreInput({ moveX: 1, moveZ: 1 });
    const l = Math.sqrt(inp.moveX * inp.moveX + inp.moveZ * inp.moveZ);
    return Math.abs(l - 1) < 1e-9;
  })(),
);

// ========================================================= D  policy contract

section('D  policy contract');

const scriptedZor = createScriptedPolicy({ difficulty: 'zor', seed: 11 });
const onnxSync = createOnnxPolicy({
  difficulty: 'zor',
  head: 'discrete',
  runtime: createFakeRuntime({ head: 'discrete', seed: 0x5eed }),
  modelBytes: new Uint8Array([0]),
  seed: 11,
});

for (const p of [scriptedZor, onnxSync]) {
  let ok = true;
  let why = '';
  try {
    assertPolicy(p);
  } catch (err) {
    ok = false;
    why = err.message;
  }
  check(`${p.id} satisfies the BotPolicy interface`, ok, why);
}
check('english difficulty aliases resolve', createScriptedPolicy({ difficulty: 'hard' }).difficulty === 'zor');
check(
  'an unknown difficulty is rejected',
  (() => {
    try {
      createScriptedPolicy({ difficulty: 'impossible' });
      return false;
    } catch {
      return true;
    }
  })(),
);
check(
  'a policy without a runtime or a fallback is rejected',
  (() => {
    try {
      createOnnxPolicy({ difficulty: 'orta' });
      return false;
    } catch {
      return true;
    }
  })(),
);

// =========================================================== E  scripted bot

section('E  scripted determinism');

const script = buildObservationScript({ ticks: 240, seed: 7 });

{
  const p = createScriptedPolicy({ difficulty: 'orta', seed: 1234 });
  const a = digestActions(runObservationScript(p, script, { seed: 99 }));
  const b = digestActions(runObservationScript(p, script, { seed: 99 }));
  check('the same policy replayed from the same seed is identical', a === b);

  const c = digestActions(runObservationScript(p, script, { seed: 4321 }));
  check('a different seed produces a different run', a !== c);

  const fresh = createScriptedPolicy({ difficulty: 'orta', seed: 5555 });
  const d = digestActions(runObservationScript(fresh, script, { seed: 99 }));
  check('a freshly built policy reset to the same seed matches', a === d);
}

{
  const streams = {};
  for (const d of ['kolay', 'orta', 'zor']) {
    streams[d] = digestActions(
      runObservationScript(createScriptedPolicy({ difficulty: d, seed: 77 }), script, { seed: 77 }),
    );
  }
  check('kolay and orta play differently', streams.kolay !== streams.orta);
  check('orta and zor play differently', streams.orta !== streams.zor);
  check('kolay and zor play differently', streams.kolay !== streams.zor);
}

check(
  'a policy never calls Math.random',
  (() => {
    const real = Math.random;
    Math.random = () => {
      throw new Error('Math.random called inside a policy');
    };
    try {
      runObservationScript(createScriptedPolicy({ difficulty: 'kolay', seed: 3 }), script.slice(0, 60), { seed: 3 });
      runObservationScript(onnxSync, script.slice(0, 60), { seed: 3 });
      return true;
    } catch {
      return false;
    } finally {
      Math.random = real;
    }
  })(),
);

// ======================================================== F  difficulty tiers

section('F  difficulty is measurable');

/** Response latency: ticks from a step change in the pitch to a changed action. */
function measureLatency(difficulty) {
  const before = createWorld({ teams: [0, 1] });
  place(before, 0, 0, -200);
  place(before, 1, 0, 200);
  place(before, 'ball', 0, 0);
  const after = createWorld({ teams: [0, 1] });
  place(after, 0, 0, -200);
  place(after, 1, 0, 200);
  place(after, 'ball', 170, 0);

  const obsBefore = observe(before, 0);
  const obsAfter = observe(after, 0);
  const CHANGE_AT = 24; // a common multiple of every decision cadence
  const seq = [];
  for (let t = 0; t < CHANGE_AT + 90; t++) seq.push(t < CHANGE_AT ? obsBefore : obsAfter);

  // Noise off: this measures reaction and decision cadence, not aim.
  const p = createScriptedPolicy({
    difficulty,
    seed: 1,
    tier: { aimNoise: 0, moveJitter: 0 },
  });
  const actions = runObservationScript(p, seq, { seed: 1 });
  const baseline = actions[CHANGE_AT - 1];
  for (let t = CHANGE_AT; t < actions.length; t++) {
    if (!actionsEqual(baseline, actions[t])) return t - CHANGE_AT;
  }
  return Infinity;
}

const latency = {
  kolay: measureLatency('kolay'),
  orta: measureLatency('orta'),
  zor: measureLatency('zor'),
};
check(
  'response latency is strictly ordered kolay > orta > zor',
  latency.kolay > latency.orta && latency.orta > latency.zor,
  `${latency.kolay} / ${latency.orta} / ${latency.zor} ticks`,
);

/** Aim spread: how much the movement wanders while the pitch stands still. */
function measureAimSpread(difficulty) {
  const w = createWorld({ teams: [0, 1] });
  place(w, 0, 0, -260);
  place(w, 1, 0, 260);
  place(w, 'ball', 0, 0);
  const obs = observe(w, 0);
  const seq = new Array(900).fill(obs);
  const actions = runObservationScript(createScriptedPolicy({ difficulty, seed: 21 }), seq, { seed: 21 });
  let sum = 0;
  for (const a of actions) sum += a.moveX;
  const mean = sum / actions.length;
  let dev = 0;
  for (const a of actions) dev += Math.abs(a.moveX - mean);
  return dev / actions.length;
}

const spread = {
  kolay: measureAimSpread('kolay'),
  orta: measureAimSpread('orta'),
  zor: measureAimSpread('zor'),
};
check(
  'aim spread is strictly ordered kolay > orta > zor',
  spread.kolay > spread.orta && spread.orta > spread.zor,
  `${spread.kolay.toFixed(4)} / ${spread.orta.toFixed(4)} / ${spread.zor.toFixed(4)}`,
);

check(
  'the easy tier carries the 150-250 ms observation delay the spec asks for',
  TIERS.kolay.reactionTicks * (1000 / CONSTANTS.TICK_RATE) >= 150 &&
    TIERS.kolay.reactionTicks * (1000 / CONSTANTS.TICK_RATE) <= 250,
  `${((TIERS.kolay.reactionTicks * 1000) / CONSTANTS.TICK_RATE).toFixed(0)} ms`,
);

/** Head to head: zor against kolay over several seeds. */
const H2H_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const h2h = { zor: 0, kolay: 0 };
for (const seed of H2H_SEEDS) {
  const s = playMatch({
    policies: {
      0: createScriptedPolicy({ difficulty: 'zor', seed }),
      1: createScriptedPolicy({ difficulty: 'kolay', seed: seed + 100 }),
    },
    teams: [0, 1],
    ticks: 1800,
    seed,
  });
  h2h.zor += s.goals[0];
  h2h.kolay += s.goals[1];
}
check(
  'zor beats kolay head to head',
  h2h.zor > h2h.kolay,
  `${h2h.zor} - ${h2h.kolay} over ${H2H_SEEDS.length} matches`,
);

// ===================================================== G  the bot plays ball

section('G  the scripted bot actually plays');

const PLAY_SEEDS = [1, 2, 3, 4, 5, 6];
const play = { goals: 0, contacts: 0, kicks: 0, perSeed: [] };
for (const seed of PLAY_SEEDS) {
  const s = playMatch({
    policies: {
      0: createScriptedPolicy({ difficulty: 'zor', seed }),
      1: createScriptedPolicy({ difficulty: 'zor', seed: seed + 100 }),
    },
    teams: [0, 1],
    ticks: 1800, // 30 s at 60 Hz
    seed,
  });
  play.goals += s.goals[0] + s.goals[1];
  play.contacts += s.contacts;
  play.kicks += s.kicks;
  play.perSeed.push(s);
}
check(
  'the ball is contacted in every 30 s match',
  play.perSeed.every((s) => s.contacts >= 4),
  play.perSeed.map((s) => s.contacts).join('/'),
);
check(
  'at least 60 contacts across the seeds',
  play.contacts >= 60,
  `${play.contacts} contacts, ${play.kicks} kicks`,
);
check('at least one goal is scored across the seeds', play.goals >= 1, `${play.goals} goals`);
check(
  'the ball reaches a real speed (something got struck, not nudged)',
  play.perSeed.every((s) => s.maxBallSpeed > PITCH.KICK_IMPULSE * 0.8),
  play.perSeed.map((s) => s.maxBallSpeed.toFixed(1)).join('/'),
);

// A keeper on the line has to make scoring harder than an empty net.
const KEEPER_SEEDS = [1, 2, 3, 4];
let openGoals = 0;
let keptGoals = 0;
for (const seed of KEEPER_SEEDS) {
  const open = playMatch({
    policies: {
      0: createScriptedPolicy({ difficulty: 'zor', seed }),
      1: createScriptedPolicy({ difficulty: 'kolay', seed: seed + 40 }),
    },
    teams: [0, 1],
    ticks: 1800,
    seed,
  });
  const kept = playMatch({
    policies: {
      0: createScriptedPolicy({ difficulty: 'zor', seed }),
      1: createScriptedPolicy({ difficulty: 'kolay', seed: seed + 40 }),
      2: createScriptedPolicy({ difficulty: 'zor', seed: seed + 80, role: 'keeper' }),
    },
    roles: { 2: 'keeper' },
    teams: [0, 1, 1],
    ticks: 1800,
    seed,
  });
  openGoals += open.goals[0];
  keptGoals += kept.goals[0];
}
check(
  'a keeper on the line concedes fewer goals than an empty net',
  keptGoals < openGoals,
  `${keptGoals} conceded with a keeper vs ${openGoals} without`,
);

// ============================================================== H  onnx path

section('H  the ONNX path');

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
check(
  'the fixture was recorded against this observation and action version',
  fixture.observationVersion === OBSERVATION_VERSION &&
    fixture.actionVersion === ACTION_VERSION &&
    fixture.obsSize === OBS_SIZE,
);

const fixtureScript = buildObservationScript({
  ticks: FIXTURE_CONFIG.scriptTicks,
  seed: FIXTURE_CONFIG.scriptSeed,
});

function replayOnnx(head, runtimeOpts = {}) {
  const policy = createOnnxPolicy({
    difficulty: FIXTURE_CONFIG.difficulty,
    head,
    runtime: createFakeRuntime({ head, seed: FIXTURE_CONFIG.modelSeed, ...runtimeOpts }),
    modelBytes: new Uint8Array([0]),
    decisionEvery: FIXTURE_CONFIG.decisionEvery,
    seed: FIXTURE_CONFIG.policySeed,
  });
  return {
    policy,
    actions: runObservationScript(policy, fixtureScript, {
      seed: FIXTURE_CONFIG.policySeed,
      attackSign: FIXTURE_CONFIG.attackSign,
      team: 1,
    }),
  };
}

function matchesFixture(actions, recorded) {
  if (actions.length !== recorded.length) return `length ${actions.length} vs ${recorded.length}`;
  for (let i = 0; i < actions.length; i++) {
    const [mx, mz, k] = recorded[i];
    const a = actions[i];
    if (Math.abs(a.moveX - mx) > 1e-6 || Math.abs(a.moveZ - mz) > 1e-6 || (a.kick ? 1 : 0) !== k) {
      return `tick ${i}: ${a.moveX},${a.moveZ},${a.kick ? 1 : 0} vs ${mx},${mz},${k}`;
    }
  }
  return '';
}

const discreteRun = replayOnnx('discrete');
check(
  'the discrete ONNX head reproduces the recorded fixture',
  matchesFixture(discreteRun.actions, fixture.discrete) === '',
  matchesFixture(discreteRun.actions, fixture.discrete),
);
const continuousRun = replayOnnx('continuous');
check(
  'the continuous ONNX head reproduces the recorded fixture',
  matchesFixture(continuousRun.actions, fixture.continuous) === '',
  matchesFixture(continuousRun.actions, fixture.continuous),
);
check(
  'the ONNX policy replays identically twice',
  digestActions(replayOnnx('discrete').actions) === digestActions(discreteRun.actions),
);
check(
  'inference runs at the configured rate, not once per tick',
  discreteRun.policy.stats.inferences === Math.ceil(fixtureScript.length / FIXTURE_CONFIG.decisionEvery),
  `${discreteRun.policy.stats.inferences} inferences over ${fixtureScript.length} ticks`,
);

// The worker path: run() answers nothing, the policy holds, offerOutput
// installs. Same fixture, so an async runtime is not a different bot.
{
  const runtime = createFakeRuntime({ head: 'discrete', seed: FIXTURE_CONFIG.modelSeed, async: true });
  const policy = createOnnxPolicy({
    difficulty: FIXTURE_CONFIG.difficulty,
    head: 'discrete',
    runtime,
    modelBytes: new Uint8Array([0]),
    decisionEvery: FIXTURE_CONFIG.decisionEvery,
    seed: FIXTURE_CONFIG.policySeed,
  });
  policy.reset(FIXTURE_CONFIG.policySeed);
  const actions = [];
  for (let t = 0; t < fixtureScript.length; t++) {
    const a = policy.act(fixtureScript[t], {
      tick: t,
      playerIndex: 0,
      team: 1,
      attackSign: FIXTURE_CONFIG.attackSign,
      role: 'field',
    });
    actions.push({ moveX: a.moveX, moveZ: a.moveZ, kick: !!a.kick });
    runtime.flush(policy); // the worker answers before the next tick
  }
  // Answers arrive one tick late, so the stream is the fixture shifted by one.
  let aligned = 0;
  for (let i = 1; i < actions.length; i++) {
    const [mx, mz, k] = fixture.discrete[i - 1];
    if (Math.abs(actions[i].moveX - mx) < 1e-6 && Math.abs(actions[i].moveZ - mz) < 1e-6 && (actions[i].kick ? 1 : 0) === k) {
      aligned++;
    }
  }
  check(
    'the worker path produces the same decisions, one tick later',
    aligned === actions.length - 1,
    `${aligned}/${actions.length - 1} ticks aligned`,
  );
  check('the async path was actually async', policy.stats.asyncPending > 0);
  check('nothing stayed pending at the end', runtime.pendingCount() === 0);
}

// A late answer must be dropped, not acted on.
{
  const runtime = createFakeRuntime({ head: 'discrete', seed: 1, async: true });
  const policy = createOnnxPolicy({
    difficulty: 'orta',
    head: 'discrete',
    runtime,
    modelBytes: new Uint8Array([0]),
    decisionEvery: 1,
    seed: 1,
  });
  const ctx = { tick: 0, playerIndex: 0, team: 0, attackSign: 1, role: 'field' };
  policy.act(fixtureScript[0], ctx); // request 1 issued
  policy.act(fixtureScript[1], ctx); // request 2 issued, 1 now stale
  const before = policy.stats.droppedLate;
  policy.offerOutput({ action: { data: new Float32Array(DISCRETE_SIZE) } }, 1);
  check('a late inference answer is dropped', policy.stats.droppedLate === before + 1);
}

// Failure falls back rather than stopping the match.
{
  const broken = {
    createSession() {
      throw new Error('model failed to load');
    },
  };
  const policy = createOnnxPolicy({
    difficulty: 'orta',
    head: 'discrete',
    runtime: broken,
    fallback: createScriptedPolicy({ difficulty: 'orta', seed: 5 }),
    seed: 5,
  });
  const actions = runObservationScript(policy, script.slice(0, 120), { seed: 5 });
  const scripted = runObservationScript(createScriptedPolicy({ difficulty: 'orta', seed: 5 }), script.slice(0, 120), { seed: 5 });
  check('a model that fails to load is reported, not thrown', policy.ready === false && !!policy.error);
  check('the fallback carries the match', policy.stats.fallbackTicks === 120);
  check('the fallback plays exactly like the scripted policy it wraps', digestActions(actions) === digestActions(scripted));
}

// ======================================================= I  interchangeable

section('I  the two policies are interchangeable');

const families = [
  {
    label: 'scripted',
    make: (seed) => createScriptedPolicy({ difficulty: 'zor', seed }),
  },
  {
    label: 'onnx',
    make: (seed) =>
      createOnnxPolicy({
        difficulty: 'zor',
        head: 'discrete',
        runtime: createFakeRuntime({ head: 'discrete', seed: 0x5eed }),
        modelBytes: new Uint8Array([0]),
        seed,
      }),
  },
];

for (const family of families) {
  // 1. the same harness
  const s = playMatch({
    policies: { 0: family.make(3), 1: family.make(4) },
    teams: [0, 1],
    ticks: 600,
    seed: 3,
  });
  check(`${family.label}: runs through the shared match harness`, s.ticks === 600 && Number.isFinite(s.contacts));

  // 2. the same reset-and-replay determinism
  const a = digestActions(runObservationScript(family.make(8), script.slice(0, 150), { seed: 8 }));
  const b = digestActions(runObservationScript(family.make(8), script.slice(0, 150), { seed: 8 }));
  check(`${family.label}: replays identically from a seed`, a === b);

  // 3. the same host hook, wired exactly as production would
  const host = createHostSession({
    playerCount: 4,
    hostPlayerId: 0,
    snapshotHz: 20,
    botSlots: [2, 3],
    botPolicy: makeBotPolicy({
      policies: { 2: family.make(21), 3: family.make(22) },
      roles: { 3: 'keeper' },
      seed: 21,
    }),
  });
  for (let ms = 0; ms <= 1000; ms += 16) host.update(ms);
  check(
    `${family.label}: drives bot slots through createHostSession`,
    host.stats.botCalls > 0 && host.tick > 30,
    `${host.stats.botCalls} bot calls over ${host.tick} ticks`,
  );
}

// One policy instance may not secretly drive two slots.
{
  const shared = createScriptedPolicy({ difficulty: 'orta', seed: 1 });
  const hostBot = makeBotPolicy({ policy: shared, seed: 1 });
  const w = createWorld({ teams: [0, 1, 0, 1] });
  hostBot({ world: w, tick: 0, playerIndex: 2 });
  let rejected = false;
  try {
    hostBot({ world: w, tick: 0, playerIndex: 3 });
  } catch {
    rejected = true;
  }
  check('sharing one policy instance across two slots is rejected', rejected);

  const factoryBot = makeBotPolicy({
    policy: (i) => createScriptedPolicy({ difficulty: 'orta', seed: 1 + i }),
    seed: 1,
  });
  factoryBot({ world: w, tick: 0, playerIndex: 2 });
  factoryBot({ world: w, tick: 0, playerIndex: 3 });
  check('a factory fills every bot slot with its own instance', factoryBot.runners.size === 2);
}

// Different brains in different slots of one match: the point of the exercise.
{
  const mixed = playMatch({
    policies: {
      0: createScriptedPolicy({ difficulty: 'zor', seed: 1 }),
      1: createOnnxPolicy({
        difficulty: 'zor',
        head: 'continuous',
        runtime: createFakeRuntime({ head: 'continuous', seed: 3 }),
        modelBytes: new Uint8Array([0]),
        seed: 2,
      }),
    },
    teams: [0, 1],
    ticks: 900,
    seed: 1,
  });
  check(
    'a scripted bot and an ONNX bot share one pitch',
    mixed.contacts > 0,
    `${mixed.contacts} contacts, ${mixed.goals.join('-')}`,
  );
}

// ==================================================================== report

console.log('\n--- measured');
const rows = [
  ['observation features', OBS_SIZE, `v${OBSERVATION_VERSION}`],
  ['discrete actions', DISCRETE_SIZE, `continuous head ${CONTINUOUS_SIZE}`],
  ['response latency kolay/orta/zor', `${latency.kolay}/${latency.orta}/${latency.zor}`, 'ticks to react to a moved ball'],
  [
    'aim spread kolay/orta/zor',
    `${spread.kolay.toFixed(3)}/${spread.orta.toFixed(3)}/${spread.zor.toFixed(3)}`,
    'mean |moveX| deviation, static pitch',
  ],
  ['zor vs kolay', `${h2h.zor}-${h2h.kolay}`, `${H2H_SEEDS.length} matches of 30 s`],
  ['zor vs zor', `${play.goals} goals`, `${play.contacts} contacts, ${play.kicks} kicks over ${PLAY_SEEDS.length} matches`],
  ['keeper effect', `${keptGoals} vs ${openGoals}`, 'goals conceded with / without a keeper'],
  ['onnx inferences', discreteRun.policy.stats.inferences, `${FIXTURE_CONFIG.decisionEvery}-tick cadence = ${(60 / FIXTURE_CONFIG.decisionEvery).toFixed(0)} Hz`],
];
for (const [name, value, note] of rows) {
  console.log(`      ${String(name).padEnd(34)} ${String(value).padStart(12)}   ${note}`);
}

console.log(
  `\nbots ${BOTS_VERSION} · observation v${OBSERVATION_VERSION} (${OBS_SIZE} features) · ` +
    `action v${ACTION_VERSION} (${DISCRETE_SIZE} discrete / ${CONTINUOUS_SIZE} continuous) · ` +
    `pitch ${2 * PITCH.HALF_X}x${2 * PITCH.HALF_Z}, diagonal ${PITCH_DIAG.toFixed(1)}`,
);
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
