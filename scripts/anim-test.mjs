// Headless gate for the arena's animation and asset layers (matrix #14-#19).
//
//   node scripts/anim-test.mjs                 everything it can do offline
//   node scripts/anim-test.mjs --skip-assets   skip the GLB build (it is slow)
//   node scripts/anim-test.mjs --skip-browser  skip the Playwright budget run
//   node scripts/anim-test.mjs --port 5304     dev server port for the browser
//
// Six things are proved here, and they fail for six different reasons:
//
//   A  POSE DETERMINISM      the same core state and the same clock produce
//                            bit-identical transforms, twice in a row and in
//                            two independently constructed animators. This is
//                            what lets a host and a guest animate the same
//                            match the same way from different data paths.
//   B  STATE MACHINE         every state is reachable and exitable, no
//                            transition has a zero crossfade, and an illegal
//                            request is ROUTED rather than dropped or forced.
//   C  FOOT PHASE            the stride phase is continuous across an abrupt
//                            speed change, and the eight-way blend really does
//                            produce eight different gaits.
//   D  CELEBRATION CHOICE    derived from facts every peer already agrees on,
//                            so four tabs watching one goal show one reaction.
//   E  CAMERA                the shake envelope is bounded and decays to
//                            exactly zero; the goal cutaway fits in the arena's
//                            goal window and replays real recorded state.
//   F  ASSET PIPELINE        the GLB exists, carries KHR_draco_mesh_compression
//                            AND KHR_texture_basisu, its images are KTX2, and
//                            the scene is under the triangle budget. Run for
//                            real, by invoking the build script, not asserted
//                            against a checked-in artefact.
//
// and, with Playwright, one more that cannot be faked offline: renderer.info's
// own draw call and triangle counts on /arena.html, desktop and mobile.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONSTANTS } from '../packages/core/src/index.js';
import {
  ANCHORS, AnimClock, AnimStateMachine, CELEBRATION_IDS, CameraShake, DIVE_IDS,
  GoalReplay, JITTER_MAX, KICK_IDS, PlayerAnimator, REPLAY_DELAY, REPLAY_LENGTH,
  SHAKE_CUTOFF, SHAKE_MAX, STATES, TRANSITIONS, blendParams, blendWeights,
  canTransition, celebrationHash, createPose, describePose, diveIdOf, graph,
  poseDelta, posesEqual, route, selectCelebration, selectDejection, selectKick,
  solveTwoBoneIK, strideRate, successors, transitionTime, writeGait,
} from '../packages/client/src/arena/anim/index.js';
import { GOAL_WINDOW_SECONDS } from '../packages/client/src/arena/anim/camera.js';
import { createIKResult, lateralReach, SHIN_LEN, THIGH_LEN } from '../packages/client/src/arena/anim/rig.js';
import { PARTS, PART_KEYS } from '../packages/client/src/arena/anim/rig.js';
import {
  BUDGETS, QUALITY, buildStadiumSpec, detectTier, qualityFor,
} from '../packages/client/src/arena/assets/index.js';
import { toMetres } from '../packages/client/src/arena/units.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const skipAssets = argv.includes('--skip-assets');
const skipBrowser = argv.includes('--skip-browser');
const port = Number(argv[argv.indexOf('--port') + 1]) || Number(process.env.ARENA_PORT) || 5304;

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
const eq = (name, got, want) => check(name, got === want, `got ${got}, want ${want}`);
const near = (name, got, want, tol) =>
  check(name, Math.abs(got - want) <= tol, `got ${got}, want ${want} +/- ${tol}`);
const section = (t) => console.log(`\n--- ${t}`);

// ------------------------------------------------------------- fixtures ----

const SLOTS = [
  { index: 0, team: 0, role: 'keeper', name: 'K0' },
  { index: 1, team: 0, role: 'field', name: 'R1' },
  { index: 2, team: 1, role: 'keeper', name: 'K1' },
  { index: 3, team: 1, role: 'field', name: 'B1' },
];

/** A core player record, in exactly the shape readState() hands out. */
function corePlayer(over = {}) {
  return {
    index: 0, team: 0, role: 0,
    x: 0, z: 0, vx: 0, vz: 0,
    kickArm: 0, kickCooldown: 0, charge: 0, chargeRelease: 0, clearCharge: 0,
    tackleActive: 0, tackleRecovery: 0, tackleCooldown: 0,
    diveActive: 0, diveLock: 0, diveDir: 0, touchCooldown: 0,
    ...over,
  };
}
const CORE_BALL = { x: 40, z: 120, vx: 2, vz: -3, curve: 0, holder: -1 };

/** Drive an animator through a scripted sequence and return the final pose. */
function run(animator, frames, dt = 1 / 60) {
  let pose = createPose();
  for (const p of frames) {
    animator.advance(dt, p.player, p.ctx || { ball: CORE_BALL });
    pose = animator.evaluate(pose);
  }
  return pose;
}

function scriptedFrames(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = i / 60;
    out.push({
      player: corePlayer({
        x: Math.sin(t * 1.3) * 90,
        z: Math.cos(t * 0.9) * 140,
        vx: Math.cos(t * 1.3) * 3,
        vz: -Math.sin(t * 0.9) * 4,
        charge: i > 90 && i < 130 ? (i - 90) : 0,
        kickCooldown: i === 130 ? 8 : 0,
        touchCooldown: i === 130 ? 6 : 0,
      }),
      ctx: { ball: CORE_BALL },
    });
  }
  return out;
}

// ===================================================== A. pose determinism

section('A. pose determinism (#14 — same core state => identical transforms)');

{
  const a = new PlayerAnimator(SLOTS[1], { toMetres });
  const frames = scriptedFrames(180);
  const poseA = run(a, frames);

  // 1. evaluate is pure: calling it again changes nothing
  const again = a.evaluate(createPose());
  check('evaluate() is pure — twice in a row is bit-identical',
    posesEqual(poseA, again), describePose(poseA).slice(0, 60));

  // 2. two animators, built separately, fed the identical sequence
  const b = new PlayerAnimator(SLOTS[1], { toMetres });
  const poseB = run(b, frames);
  check('two animators, one input sequence => identical transforms',
    posesEqual(poseA, poseB), `max delta ${poseDelta(poseA, poseB)}`);

  // 3. a snapshot round-trip reproduces the frame exactly
  const snap = a.snapshot();
  a.advance(1 / 60, corePlayer({ x: 999, z: -999 }), { ball: CORE_BALL });
  a.evaluate(createPose());
  a.restore(snap);
  check('restore(snapshot()) reproduces the pose exactly',
    posesEqual(a.evaluate(createPose()), poseA));

  // 4. and the poses are not trivially all zero. Thirteen of the fifteen joints
  //    have to be doing something, or a passing determinism test is only
  //    proving that zero equals zero.
  let nonZero = 0;
  const movedJoints = new Set();
  for (let i = 0; i < poseA.length; i++) {
    if (poseA[i] !== 0) { nonZero++; movedJoints.add(Math.floor(i / 6)); }
  }
  check('the pose is actually posed, not a bind-pose stub', movedJoints.size >= 13,
    `${movedJoints.size}/15 joints moved, ${nonZero} non-zero channels`);

  // 5. nothing NaN ever reaches a transform
  check('no channel is NaN or infinite', poseA.every(Number.isFinite));
}

{
  // The keeper path has its own branches; prove determinism through all of them.
  const frames = [];
  for (let i = 0; i < 240; i++) {
    frames.push({
      player: corePlayer({
        index: 0, role: 1,
        x: Math.sin(i / 40) * 60, z: -380,
        diveActive: i >= 60 && i < 74 ? 74 - i : 0,
        diveLock: i >= 74 && i < 134 ? 134 - i : 0,
        clearCharge: i >= 180 && i < 220 ? i - 180 : 0,
      }),
      ctx: {
        ball: { ...CORE_BALL, holder: i >= 140 && i < 226 ? 0 : -1 },
        inBox: true,
      },
    });
  }
  const k1 = new PlayerAnimator(SLOTS[0], { toMetres });
  const k2 = new PlayerAnimator(SLOTS[0], { toMetres });
  const p1 = run(k1, frames);
  const p2 = run(k2, frames);
  check('keeper path is deterministic through dive, lock, catch and clear',
    posesEqual(p1, p2), `visited ${new Set(k1.machine.history).size} states`);
  const visited = new Set(k1.machine.history);
  check('the keeper script really exercised the dive and the catch',
    visited.has('keeperDive') && visited.has('keeperCatch') && visited.has('keeperGetUp'),
    [...visited].join(' -> '));
}

// ================================================ B. state machine legality

section('B. state machine (#16 — transitions clean, no illegal jumps)');

{
  const g = graph();
  eq('every state in STATES has a row in the graph',
    STATES.filter((s) => g[s]).length, STATES.length);

  // no zero-length crossfade anywhere: a zero would be a pop by definition
  let zero = null;
  for (const from of STATES) {
    for (const [to, seconds] of Object.entries(g[from])) {
      if (!(seconds > 0)) zero = `${from}->${to}`;
    }
  }
  check('no transition has a zero crossfade (no pose popping)', zero === null,
    zero || `${STATES.length} states checked`);

  // every state exitable
  const stuck = STATES.filter((s) => successors(s).length === 0);
  check('every state has at least one way out', stuck.length === 0, stuck.join(', '));

  // every state reachable from idle, by search rather than by assertion
  const unreachable = STATES.filter((s) => route('idle', s) === null);
  check('every state is reachable from idle', unreachable.length === 0,
    unreachable.join(', ') || `${STATES.length}/${STATES.length}`);

  // and every state can get back to idle
  const oneWay = STATES.filter((s) => route(s, 'idle') === null);
  check('every state can return to idle', oneWay.length === 0, oneWay.join(', '));

  // the specific jumps that must NOT be legal in one hop
  const illegal = [
    ['keeperDive', 'keeperShuffle'],   // get up first
    ['keeperGetUp', 'keeperDive'],     // cannot dive off the floor
    ['kick', 'windup'],                // cannot re-wind mid-swing
    ['slide', 'kick'],                 // cannot shoot out of a slide
    ['stumble', 'slide'],              // cannot tackle while stumbling
    ['keeperThrow', 'keeperCatch'],    // the ball has left the hands
  ];
  for (const [from, to] of illegal) {
    check(`illegal in one hop: ${from} -> ${to}`, !canTransition(from, to));
  }

  // an illegal REQUEST must be routed, never dropped and never forced
  const m = new AnimStateMachine('keeperDive');
  m.request('keeperShuffle');
  check('an illegal request routes rather than jumping',
    m.to !== 'keeperShuffle' && canTransition('keeperDive', m.to),
    `keeperDive -> ${m.to} (goal keeperShuffle)`);
  let guard = 0;
  while (m.to !== 'keeperShuffle' && guard++ < 50) m.update(0.5);
  eq('and it arrives at the requested state', m.to, 'keeperShuffle');
  check('every hop it took was legal', m.history.every((s, i) =>
    i === 0 || canTransition(m.history[i - 1], s)), m.history.join(' -> '));

  // a goal interrupts from anywhere, in one hop, from every state
  const noInterrupt = STATES.filter((s) =>
    s !== 'celebrate' && !canTransition(s, 'celebrate'));
  check('a goal can interrupt every state in one hop', noInterrupt.length === 0,
    noInterrupt.join(', '));

  // the crossfade must not restart from zero and snap when interrupted midway
  const n = new AnimStateMachine('locomotion');
  n.request('windup');
  n.update(transitionTime('locomotion', 'windup') * 0.4);
  const midBlend = n.blend;
  n.request('celebrate');
  check('interrupting a crossfade lengthens the next one rather than snapping',
    n.duration > transitionTime('windup', 'celebrate'),
    `${n.duration.toFixed(3)}s vs base ${transitionTime('windup', 'celebrate')}s, interrupted at ${midBlend.toFixed(2)}`);
}

{
  // No state may be entered that the animator can never ask for. Drive a long
  // random-but-deterministic script and check the states it visits are legal.
  const a = new PlayerAnimator(SLOTS[1], { toMetres });
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 3000; i++) {
    a.advance(1 / 60, corePlayer({
      x: rnd() * 200 - 100, z: rnd() * 300 - 150,
      vx: rnd() * 8 - 4, vz: rnd() * 8 - 4,
      charge: rnd() < 0.1 ? (rnd() * CONSTANTS.CHARGE_MAX_TICKS) | 0 : 0,
      kickCooldown: rnd() < 0.03 ? 8 : 0,
      tackleActive: rnd() < 0.02 ? 6 : 0,
      tackleRecovery: rnd() < 0.02 ? 12 : 0,
      touchCooldown: rnd() < 0.05 ? 6 : 0,
    }), { ball: CORE_BALL, goal: rnd() < 0.004 ? { team: 0, tick: i, score: [1, 0] } : null });
    a.evaluate(createPose());
  }
  const legal = a.machine.history.every((s, i) =>
    i === 0 || canTransition(a.machine.history[i - 1], s));
  check('3000 randomised frames produce only legal transitions', legal,
    `${a.machine.history.length} recent hops, ${a.machine.reroutes} reroutes`);
}

// ================================================== C. locomotion and feet

section('C. locomotion (#14 — 8-way blend, foot phase continuity)');

{
  eq('the blend space has 8 directions', ANCHORS.length, 8);
  eq('crossed with 3 speed tiers', ANCHORS[0].length, 3);

  // every anchor must be distinct: "TEK KLİP KOŞU KABUL EDİLMEZ"
  const fingerprints = new Set();
  for (const dir of ANCHORS) {
    for (const anchor of dir) {
      fingerprints.add([
        anchor.stride, anchor.lift, anchor.hipYaw, anchor.hipRoll,
        anchor.torso, anchor.armSwing, anchor.armFlare, anchor.cross,
      ].map((v) => v.toFixed(5)).join(','));
    }
  }
  eq('all 24 anchors are distinct parameter sets', fingerprints.size, 24);

  // blend weights: partition of unity, and only two anchors ever active
  let worstSum = 0;
  let mostActive = 0;
  for (let i = 0; i < 720; i++) {
    const w = blendWeights((i / 720) * Math.PI * 2);
    const sum = w.reduce((a, b) => a + b, 0);
    worstSum = Math.max(worstSum, Math.abs(sum - 1));
    mostActive = Math.max(mostActive, w.filter((v) => v > 1e-9).length);
  }
  check('blend weights always sum to 1', worstSum < 1e-12, `worst error ${worstSum}`);
  check('at most two anchors are ever active at once', mostActive <= 2, `${mostActive}`);

  // running forward and strafing right must not be the same pose
  const fwd = writeGait(createPose(), blendParams(0, 4.5), 0.25, 0);
  const right = writeGait(createPose(), blendParams(Math.PI / 2, 4.5), 0.25, Math.PI / 2);
  const back = writeGait(createPose(), blendParams(Math.PI, 4.5), 0.25, Math.PI);
  check('forward run and right strafe are different poses',
    poseDelta(fwd, right) > 0.25, `delta ${poseDelta(fwd, right).toFixed(3)}`);
  check('forward run and backpedal are different poses',
    poseDelta(fwd, back) > 0.25, `delta ${poseDelta(fwd, back).toFixed(3)}`);
  check('right strafe and backpedal are different poses',
    poseDelta(right, back) > 0.2, `delta ${poseDelta(right, back).toFixed(3)}`);

  // the blend is continuous in direction: no kink at an anchor boundary
  let worstStep = 0;
  let prev = null;
  for (let i = 0; i <= 720; i++) {
    const angle = (i / 720) * Math.PI * 2;
    const pose = writeGait(createPose(), blendParams(angle, 4.5), 0.25, angle);
    if (prev) worstStep = Math.max(worstStep, poseDelta(prev, pose));
    prev = pose;
  }
  check('sweeping the travel direction never jumps the pose', worstStep < 0.08,
    `worst 0.5-degree step ${worstStep.toFixed(4)} rad`);
}

{
  // FOOT PHASE CONTINUITY: slam the speed between frames and demand the phase
  // moves by no more than one frame's worth at the higher of the two rates.
  const dt = 1 / 60;
  const clock = new AnimClock(0);
  const speeds = [0, 6, 0.2, 5.5, 1, 0, 4.8, 2.4, 0];
  let worst = 0;
  let worstAt = '';
  for (const speed of speeds) {
    for (let i = 0; i < 12; i++) {
      const before = clock.phase;
      clock.advance(dt, speed);
      let step = clock.phase - before;
      if (step < 0) step += 1;              // wrapped past 1.0, not a jump
      const bound = strideRate(Math.max(speed, 6)) * dt * (1 + 1e-9);
      if (step > worst) { worst = step; worstAt = `at ${speed} m/s`; }
      if (step > bound) {
        check('foot phase never jumps', false, `${step} > ${bound} ${worstAt}`);
      }
    }
  }
  const bound = strideRate(6) * dt * (1 + 1e-9);
  check('foot phase is continuous across abrupt speed changes', worst <= bound,
    `worst step ${worst.toFixed(6)} turns, bound ${bound.toFixed(6)} ${worstAt}`);

  // the stride rate itself must be continuous and monotonic in speed
  let mono = true;
  let jump = 0;
  for (let s = 0; s < 12; s += 0.01) {
    const a = strideRate(s);
    const b = strideRate(s + 0.01);
    if (b < a - 1e-12) mono = false;
    jump = Math.max(jump, b - a);
  }
  check('stride rate is monotonic in speed', mono);
  check('stride rate has no step discontinuity', jump < 0.02, `worst ${jump.toFixed(5)}`);
}

{
  // The two-bone IK must land the ankle on the target, or "foot placement"
  // means nothing. Sweep the reachable volume.
  const ik = createIKResult();
  let worst = 0;
  let tested = 0;
  for (let x = -0.5; x <= 0.5; x += 0.05) {
    for (let y = -0.83; y <= -0.2; y += 0.035) {
      for (let z = -0.5; z <= 0.5; z += 0.05) {
        const target = [x, y, z];
        const d = Math.hypot(x, y, z);
        if (d > THIGH_LEN + SHIN_LEN - 0.01 || d < 0.05) continue;
        // A rotation about X cannot change an x coordinate, so the rig's
        // sideways reach is capped independently of its total reach. Targets
        // outside that band are clamped by design; see rig.js lateralReach.
        if (Math.abs(x) > lateralReach(d) - 1e-6) continue;
        tested++;
        solveTwoBoneIK(target, THIGH_LEN, SHIN_LEN, ik);
        // Forward kinematics through the REAL hierarchy: the knee is a child of
        // the thigh, so its rotation composes with the thigh's rather than
        // adding to it. Getting this wrong in the test is what hid the bug in
        // the solver, so it is written out in full here.
        //   ankle = Rx(a) . Rz(c) . [ (0,-l1,0) + Rx(k) . (0,-l2,0) ]
        const { thighX: a, thighZ: c, kneeX: k } = ik;
        // Rx(k) . (0,-l2,0)
        const s = [0, -SHIN_LEN * Math.cos(k), -SHIN_LEN * Math.sin(k)];
        // + (0,-l1,0)
        const v = [s[0], s[1] - THIGH_LEN, s[2]];
        // Rz(c)
        const cc = Math.cos(c);
        const sc = Math.sin(c);
        const w = [v[0] * cc - v[1] * sc, v[0] * sc + v[1] * cc, v[2]];
        // Rx(a)
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const ankle = [w[0], w[1] * ca - w[2] * sa, w[1] * sa + w[2] * ca];
        worst = Math.max(worst, Math.hypot(
          ankle[0] - x, ankle[1] - y, ankle[2] - z,
        ));
      }
    }
  }
  check('two-bone IK puts the ankle on its target', worst < 1e-9,
    `worst error ${worst.toExponential(2)} m over ${tested} targets`);
  check('the IK sweep covered a real volume, not three points', tested > 5000,
    `${tested} reachable targets`);

  // and a target outside the sideways band is clamped, not silently wrong by
  // an unbounded amount
  const wide = [lateralReach(0.64) + 0.2, -0.4, 0];
  solveTwoBoneIK(wide, THIGH_LEN, SHIN_LEN, ik);
  check('a target beyond the sideways reach clamps to the widest splay',
    Math.abs(ik.thighZ) <= Math.PI / 2 + 1e-9 && Number.isFinite(ik.thighZ),
    `splay ${(ik.thighZ * 180 / Math.PI).toFixed(1)} degrees`);

  // and it must not explode outside the reachable volume
  solveTwoBoneIK([0, -5, 0], THIGH_LEN, SHIN_LEN, ik);
  check('an out-of-reach target straightens the leg instead of producing NaN',
    Number.isFinite(ik.thighX) && Number.isFinite(ik.kneeX) && ik.kneeX < 0.05,
    `knee ${ik.kneeX.toFixed(4)}`);
  solveTwoBoneIK([0, 0, 0], THIGH_LEN, SHIN_LEN, ik);
  check('a degenerate target is handled', Number.isFinite(ik.thighX));
}

// ============================================= D. celebrations and kicks

section('D. kick variants and celebrations (#16)');

{
  eq('five kick variants', KICK_IDS.length, 5);
  eq('an uncharged kick is the flat pass', selectKick({ charge01: 0, curve: 0 }), 'pass');
  eq('a full charge with no curve is the drive', selectKick({ charge01: 1, curve: 0 }), 'driven');
  eq('a charged kick with curve is the bender', selectKick({ charge01: 1, curve: 0.5 }), 'curler');
  eq('a light charge is the chip', selectKick({ charge01: 0.3, curve: 0 }), 'chip');
  eq('a keeper clearance is its own swing',
    selectKick({ charge01: 0.9, curve: 0.9, clearing: true }), 'clear');
  check('selection is pure', selectKick({ charge01: 0.8, curve: 0.02 })
    === selectKick({ charge01: 0.8, curve: 0.02 }));
  // every variant must be reachable from some real core state
  const reached = new Set();
  for (let c = 0; c <= 1.0001; c += 0.05) {
    for (const curve of [-0.6, -0.2, 0, 0.05, 0.3, 0.9]) {
      reached.add(selectKick({ charge01: c, curve }));
      reached.add(selectKick({ charge01: c, curve, clearing: true }));
    }
  }
  eq('every kick variant is reachable from real core numbers', reached.size, 5);
}

{
  eq('five celebrations', CELEBRATION_IDS.length, 5);
  const seed = { playerIndex: 3, tick: 4211, scoreRed: 2, scoreBlue: 1, team: 0 };
  eq('celebration selection is deterministic',
    selectCelebration(seed), selectCelebration({ ...seed }));
  check('the hash is a stable 32-bit integer',
    Number.isInteger(celebrationHash(seed)) && celebrationHash(seed) >= 0);
  // different players on the same goal get different reactions, but each player
  // gets the SAME one on every peer
  const perPlayer = [0, 1, 2, 3, 4, 5].map((i) => selectCelebration({ ...seed, playerIndex: i }));
  check('players do not all play the same celebration',
    new Set(perPlayer).size >= 2, perPlayer.join(', '));
  // the whole set must be reachable, or two of them are dead code
  const all = new Set();
  for (let t = 0; t < 400; t++) {
    for (let p = 0; p < 8; p++) {
      all.add(selectCelebration({ playerIndex: p, tick: t * 7, scoreRed: t % 5, scoreBlue: t % 3, team: t % 2 }));
    }
  }
  eq('every celebration is reachable', all.size, 5);
  const dejections = new Set();
  for (let t = 0; t < 400; t++) dejections.add(selectDejection({ ...seed, tick: t }));
  eq('both dejections are reachable', dejections.size, 2);

  // and the two sides of a goal must never mix
  const a = new PlayerAnimator(SLOTS[1], { toMetres });   // team 0
  const b = new PlayerAnimator(SLOTS[3], { toMetres });   // team 1
  const goal = { team: 0, tick: 900, score: [1, 0] };
  a.advance(1 / 60, corePlayer(), { ball: CORE_BALL, goal });
  b.advance(1 / 60, corePlayer(), { ball: CORE_BALL, goal });
  eq('the scoring side celebrates', a.machine.goal, 'celebrate');
  eq('the conceding side does not', b.machine.goal, 'dejected');
}

{
  eq('four keeper dives', DIVE_IDS.length, 4);
  const ids = [0, 1, 2, 3].map(diveIdOf);
  eq('all four core dive directions map to distinct dives', new Set(ids).size, 4);
  check('an out-of-range dive direction is clamped, not crashed',
    DIVE_IDS.includes(diveIdOf(97)), diveIdOf(97));
}

// ================================================================ E. camera

section('E. camera (#17 — bounded shake, goal replay)');

{
  const shake = new CameraShake();
  // the envelope is bounded however hard, and however often, it is hit
  for (let i = 0; i < 200; i++) shake.kick(50);
  check('shake amplitude is clamped to SHAKE_MAX', shake.amp <= SHAKE_MAX,
    `${shake.amp} <= ${SHAKE_MAX}`);
  let peak = 0;
  let t = 0;
  let prev = shake.amp;
  let monotonic = true;
  while (t < 1.5) {
    const o = shake.update(1 / 60);
    t += 1 / 60;
    peak = Math.max(peak, Math.abs(o.x), Math.abs(o.y), Math.abs(o.z));
    if (shake.amp > prev + 1e-12) monotonic = false;
    prev = shake.amp;
  }
  check('the offset never exceeds SHAKE_MAX * the jitter bound',
    peak <= SHAKE_MAX * JITTER_MAX + 1e-9, `peak ${peak.toFixed(4)} m`);
  check('amplitude never increases without a kick', monotonic);
  eq('the shake reaches exactly zero within 1.5 s', shake.amp, 0);
  check('and the offset is exactly zero too',
    shake.offset.x === 0 && shake.offset.y === 0 && shake.offset.z === 0);

  // a decay bound, stated as the criterion rather than as an implementation
  const s2 = new CameraShake();
  s2.kick(SHAKE_MAX);
  for (let i = 0; i < 60; i++) s2.update(1 / 60);
  check('after 1 s the shake is under 1% of its peak',
    s2.amp < SHAKE_MAX * 0.01, `${s2.amp.toFixed(6)} m`);
  check('a zero or garbage strength is ignored',
    new CameraShake().kick(NaN) === 0 && new CameraShake().kick(-3) <= SHAKE_MAX);
  void SHAKE_CUTOFF;
}

{
  // the cutaway has to fit inside the window arena/match.js gives it
  const total = REPLAY_DELAY + REPLAY_LENGTH;
  check('the goal cutaway fits inside the arena goal window',
    total < GOAL_WINDOW_SECONDS, `${total.toFixed(2)}s < ${GOAL_WINDOW_SECONDS}s`);

  // and it replays REAL recorded state, not a frozen frame
  const replay = new GoalReplay(4);
  const dt = 1 / 60;
  for (let i = 0; i < 240; i++) {
    replay.record(dt, {
      ball: { x: i * 2, z: -i * 3, vx: 2, vz: -3, curve: 0, holder: -1 },
      players: SLOTS.map((s, j) => corePlayer({ index: j, x: i + j * 10, z: -i })),
    });
  }
  replay.arm({ x: 0, z: -400 });
  let frames = 0;
  let firstBallX = null;
  let lastBallX = null;
  for (let i = 0; i < 400; i++) {
    replay.record(dt, {
      ball: { x: 480, z: -720, vx: 0, vz: 0, curve: 0, holder: -1 },
      players: SLOTS.map((s, j) => corePlayer({ index: j, x: 240 + j * 10, z: -240 })),
    });
    const out = replay.update(dt);
    if (out) {
      frames++;
      if (firstBallX === null) firstBallX = out.ball.x;
      lastBallX = out.ball.x;
    }
  }
  check('the cutaway actually plays frames', frames > 30, `${frames} frames`);
  check('and they are different frames, not one held still',
    firstBallX !== null && Math.abs(lastBallX - firstBallX) > 1,
    `ball x ${firstBallX?.toFixed(1)} -> ${lastBallX?.toFixed(1)}`);
  check('the cutaway ends by itself', !replay.showing);

  // a goal in the first seconds of a match has nothing to replay: drop it
  const early = new GoalReplay(4);
  early.record(dt, { ball: CORE_BALL, players: [] });
  early.arm({ x: 0, z: 0 });
  for (let i = 0; i < 60; i++) { early.record(dt, { ball: CORE_BALL, players: [] }); early.update(dt); }
  check('a goal with no recording behind it does not freeze the camera',
    !early.showing);
}

// ================================================ F. assets and the budget

section('F. assets (#18 — procedural stadium, GLB with Draco + KTX2)');

{
  const spec = buildStadiumSpec();
  check('the stadium builds', spec.meshes.shell.triangleCount > 0);

  // Winding. Every pitch marking lies flat on the ground and is drawn with a
  // single-sided unlit material, so a triangle wound the wrong way is not a
  // dim triangle — it is an absent one. The touchlines, both goal lines and all
  // four penalty areas were invisible for exactly this reason while the centre
  // circle, built by a different helper, drew fine. Nothing else caught it.
  {
    const m = spec.meshes.lines;
    let downward = 0;
    for (let i = 0; i < m.index.length; i += 3) {
      const p = [0, 1, 2].map((k) => {
        const v = m.index[i + k] * 3;
        return [m.position[v], m.position[v + 1], m.position[v + 2]];
      });
      const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2];
      const vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2];
      if (uz * vx - ux * vz <= 0) downward++;   // the Y component of u x v
    }
    check('every pitch marking triangle faces upward', downward === 0,
      `${downward} of ${m.triangleCount} wound the wrong way`);
    check('the markings include the touchlines and both penalty areas',
      m.triangleCount >= 40, `${m.triangleCount} triangles`);
  }

  // Hoardings must face the middle of the pitch. Double-sided material means a
  // reversed board still draws — with its artwork mirrored, which is how it
  // showed up: "ARENA" rendered as "ANERA" behind one goal and not the other.
  {
    const m = spec.meshes.boards;
    let outward = 0;
    for (let i = 0; i < m.index.length; i += 3) {
      const p = [0, 1, 2].map((k) => {
        const v = m.index[i + k] * 3;
        return [m.position[v], m.position[v + 1], m.position[v + 2]];
      });
      const u = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
      const v = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
      const n = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
      // the vector from the triangle back toward the centre of the pitch
      const cx = -(p[0][0] + p[1][0] + p[2][0]) / 3;
      const cz = -(p[0][2] + p[1][2] + p[2][2]) / 3;
      if (n[0] * cx + n[2] * cz <= 0) outward++;
    }
    check('every hoarding faces the middle of the pitch', outward === 0,
      `${outward} of ${m.triangleCount} face outward`);
  }
  check('the whole static set is one merged mesh per material',
    Object.keys(spec.meshes).length === 6, Object.keys(spec.meshes).join(', '));
  eq('six static draw calls', spec.stats.drawCalls, 6);
  check('the stadium is under the scene triangle budget on its own',
    spec.stats.triangles.total < BUDGETS.desktop.triangles * 0.5,
    `${spec.stats.triangles.total} triangles`);

  // the mobile row must be materially cheaper than the desktop one
  const mob = buildStadiumSpec({ detail: QUALITY.mobile.stadium });
  const low = buildStadiumSpec({ detail: QUALITY.low.stadium });
  check('the mobile tier is cheaper than desktop',
    mob.stats.triangles.total < spec.stats.triangles.total,
    `${mob.stats.triangles.total} < ${spec.stats.triangles.total}`);
  check('the low tier is cheaper still',
    low.stats.triangles.total < mob.stats.triangles.total,
    `${low.stats.triangles.total} < ${mob.stats.triangles.total}`);
  check('every tier is under the triangle budget',
    [spec, mob, low].every((s) => s.stats.triangles.total < BUDGETS.desktop.triangles));

  // the whole scene, counted rather than hoped for
  const PLAYERS = 8;
  const playerTris = (() => {
    // limb geometry is a 7-segment cylinder; the rest are trivial
    const per = { limb: 7 * 4, body: 8 * 4, head: 10 * 7 * 2, boot: 12 };
    let total = 0;
    for (const key of PART_KEYS) {
      total += per[key] * PARTS.filter((p) => p.part === key).length;
    }
    return total * PLAYERS;
  })();
  const sceneTris = spec.stats.triangles.total + playerTris + 4;
  check('stadium + 8 players fits the desktop budget',
    sceneTris < BUDGETS.desktop.triangles,
    `${sceneTris} (stadium ${spec.stats.triangles.total}, players ~${playerTris})`);

  // draw calls, counted the same way
  const staticCalls = 2 + spec.stats.drawCalls;   // turf + apron + the six
  const playerCalls = PART_KEYS.length + 1 + PLAYERS; // parts + rings + tags
  const ballCall = 1;
  const total = staticCalls + playerCalls + ballCall;
  check('the counted draw calls fit the mobile budget', total < BUDGETS.mobile.drawCalls,
    `${total} < ${BUDGETS.mobile.drawCalls} (static ${staticCalls}, players ${playerCalls})`);
  eq('the whole pitch of characters is four draw calls', PART_KEYS.length, 4);
}

{
  // Device tiers must actually discriminate.
  eq('a four-core phone is the low tier',
    detectTier({ cores: 4, coarse: true, width: 390, dpr: 3 }), 'low');
  eq('an eight-core phone is the mobile tier',
    detectTier({ cores: 8, memory: 4, coarse: true, width: 412, dpr: 2.6 }), 'mobile');
  eq('a sixteen-core desktop is the high tier',
    detectTier({ cores: 16, memory: 16, coarse: false, width: 2560, dpr: 1, maxTexture: 16384 }), 'high');
  eq('a four-core laptop is the desktop tier',
    detectTier({ cores: 4, memory: 8, coarse: false, width: 1440, dpr: 2 }), 'desktop');
  eq('an explicit tier wins', detectTier({ force: 'mobile', cores: 32 }), 'mobile');
  const m = qualityFor('mobile');
  const d = qualityFor('desktop');
  eq('mobile textures are 1K', m.textureSize, 1024);
  eq('desktop textures are 2K', d.textureSize, 2048);
  // The numbers themselves are a tuning decision that moves; what must hold is
  // that a phone is held to a phone's budget and a desktop is not held to the
  // phone's. Asserting the literals just meant the ceiling could not be raised
  // without the test objecting to the raise.
  check('a phone is held to a phone budget',
    m.budget.drawCalls <= 60 && m.budget.triangles <= 200000,
    `${m.budget.drawCalls} calls / ${m.budget.triangles} tris`);
  check('a desktop is given more than a phone',
    d.budget.drawCalls > m.budget.drawCalls * 4
    && d.budget.triangles > m.budget.triangles * 4,
    `${d.budget.drawCalls} calls / ${d.budget.triangles} tris`);
}

if (!skipAssets) {
  section('F2. asset pipeline, run for real');
  const outDir = join(root, 'dist-assets');
  const glb = join(outDir, 'stadium.glb');
  const reportPath = join(outDir, 'stadium-report.json');
  let built = true;
  try {
    // Build it here rather than trusting an artefact somebody committed: a
    // checked-in GLB proves the pipeline ran once, not that it still works.
    execFileSync('node', [join(root, 'tools', 'build-assets.mjs'), '--json'], {
      cwd: root, stdio: 'pipe', timeout: 300000,
    });
  } catch (err) {
    built = false;
    check('the asset build script runs', false, String(err.message).slice(0, 200));
  }
  if (built) {
    check('the asset build script runs', true);
    check('it produced a GLB', existsSync(glb));
    const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : {};

    // Verify the container itself rather than the script's own claims.
    const buf = readFileSync(glb);
    eq('the output is a GLB', buf.subarray(0, 4).toString('ascii'), 'glTF');
    const jsonLength = buf.readUInt32LE(12);
    const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));
    const used = json.extensionsUsed || [];
    check('the GLB is Draco-compressed',
      used.includes('KHR_draco_mesh_compression'), used.join(', '));
    check('the GLB carries KTX2 textures',
      used.includes('KHR_texture_basisu'), used.join(', '));
    const images = (json.images || []).map((i) => i.mimeType);
    check('every image in the GLB is KTX2',
      images.length > 0 && images.every((m) => m === 'image/ktx2'), images.join(', '));
    check('every mesh primitive is Draco-encoded',
      (json.meshes || []).every((mesh) => (mesh.primitives || []).every(
        (p) => p.extensions && p.extensions.KHR_draco_mesh_compression)),
      `${json.meshes?.length || 0} meshes`);
    check('the compressed GLB is smaller than the raw one',
      report.sizes && report.sizes.final < report.sizes.raw,
      report.sizes ? `${(report.sizes.raw / 1024).toFixed(1)} KB -> ${(report.sizes.final / 1024).toFixed(1)} KB` : 'no report');
    check('the reported triangle count is under budget',
      report.triangles && report.triangles.total < BUDGETS.desktop.triangles,
      `${report.triangles?.total} triangles`);
    check('the repeated pieces are shared meshes, not duplicated geometry',
      (json.nodes?.length || 0) > (json.meshes?.length || 0) * 10,
      `${json.nodes?.length} nodes over ${json.meshes?.length} meshes`);
  }
} else {
  console.log('\n--- F2. asset pipeline: SKIPPED (--skip-assets)');
}

// ==================================================== G. the browser budget

async function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core', '@playwright/test']) {
    try {
      const mod = await import(name);
      if (mod.chromium) return mod;
    } catch { /* next */ }
  }
  return null;
}

/**
 * Playwright's own chromium first, then whatever Chrome the machine has, then
 * any older cached playwright build. Same policy as scripts/arena-2tab.mjs: a
 * version-pinned 170 MB download that has not been fetched is not a reason for
 * a measurement to be unavailable.
 *
 * SwiftShader is forced on so the run does not depend on a GPU being reachable
 * from the shell. That makes the FRAME RATE meaningless — it is a software
 * rasteriser — but draw calls and triangle counts come from renderer.info,
 * which counts what was submitted and does not care who rasterised it. Those
 * are the two numbers row #19 actually names.
 */
/** Hardware GL if the machine will give it to us, software if it will not. */
const GL_ARGS = {
  hardware: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization', '--enable-zero-copy'],
  software: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
};

async function launchChromium(playwright, gl = 'hardware') {
  const args = [
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    ...(GL_ARGS[gl] || GL_ARGS.software),
  ];
  const cached = [];
  try {
    const base = join(process.env.HOME || '', '.cache', 'ms-playwright');
    for (const dir of existsSync(base) ? readdirSync(base) : []) {
      const m = /^chromium-(\d+)$/.exec(dir);
      if (!m) continue;
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const p = join(base, dir, sub);
        if (existsSync(p)) cached.push({ rev: Number(m[1]), path: p });
      }
    }
    cached.sort((a, b) => b.rev - a.rev);
  } catch { /* no cache, no matter */ }

  const attempts = [
    { args },
    { args, channel: 'chrome' },
    ...cached.map((c) => ({ args, executablePath: c.path })),
    { args, executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' },
  ];
  let last = null;
  for (const opts of attempts) {
    try {
      const browser = await playwright.chromium.launch(opts);
      console.log(`     browser: ${opts.channel || opts.executablePath || 'bundled chromium'}`);
      return browser;
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

function startServer() {
  const child = spawn(
    process.execPath,
    [join(root, 'node_modules/vite/bin/vite.js'), '--port', String(port), '--strictPort'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('vite did not start')), 40000);
    const onData = (d) => {
      if (/Local:|ready in/.test(String(d))) { clearTimeout(timer); res(child); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => { clearTimeout(timer); rej(new Error(`vite exited ${code}`)); });
  });
}

/** Drive one viewport through a bot match and read renderer.info back. */
async function measure(browser, { name, width, height, tier, dpr }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    isMobile: !!tier && tier !== 'desktop',
    hasTouch: !!tier && tier !== 'desktop',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  // ?auto=solo&autostart=1 is the arena's own path into a bot match, the same
  // one scripts/arena-2tab.mjs uses. Going through it rather than synthesising
  // clicks means this measures the real lobby -> roster -> view sequence.
  const url = `http://localhost:${port}/arena.html`
    + `?net=local&auto=solo&autostart=1&mode=4v4k&tier=${tier}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const ok = await page.waitForFunction(() => {
    const b = window.__arena?.budget?.();
    return !!b && b.calls > 0;
  }, null, { timeout: 25000 }).then(() => true).catch(() => false);
  if (!ok) {
    await context.close();
    return { name, error: 'the match never started', errors };
  }
  // Let it settle, then sample the budget and the frame rate over 3 seconds.
  await page.waitForTimeout(1200);
  const result = await page.evaluate(async () => {
    const samples = [];
    let frames = 0;
    const t0 = performance.now();
    await new Promise((res) => {
      const tick = () => {
        frames++;
        const b = window.__arena.budget();
        if (b) samples.push(b);
        if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
        else res();
      };
      requestAnimationFrame(tick);
    });
    const t1 = performance.now();
    const peak = samples.reduce((acc, s) => ({
      calls: Math.max(acc.calls, s.calls),
      triangles: Math.max(acc.triangles, s.triangles),
    }), { calls: 0, triangles: 0 });
    const last = samples[samples.length - 1] || {};
    // Which rasteriser actually ran, straight from the driver. Without this the
    // frame rate is a number with no units: 14 FPS on SwiftShader and 14 FPS on
    // a GPU mean opposite things.
    let renderer = 'unknown';
    try {
      const gl = document.createElement('canvas').getContext('webgl2')
        || document.createElement('canvas').getContext('webgl');
      const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
      if (gl && dbg) renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
      else if (gl) renderer = gl.getParameter(gl.RENDERER);
    } catch { /* leave it unknown */ }
    return {
      fps: frames / ((t1 - t0) / 1000),
      frames,
      calls: peak.calls,
      triangles: peak.triangles,
      tier: last.tier,
      budget: last.budget,
      staticCalls: last.staticCalls,
      playerCalls: last.playerCalls,
      renderer,
    };
  });
  await context.close();
  return { name, ...result, errors };
}

if (skipBrowser) {
  console.log('\n--- G. browser budget: SKIPPED (--skip-browser)');
} else {
  section('G. render budget in a real browser (#19)');
  const playwright = await loadPlaywright();
  if (!playwright) {
    console.log('SKIP playwright is not installed in this checkout');
    console.log('     npm i -D playwright && npx playwright install chromium');
  } else {
    let server = null;
    let browser = null;
    try {
      server = await startServer();
      // Hardware GL if this machine will give it up, software if not. The
      // draw-call and triangle assertions are identical either way; only the
      // frame rate depends on which one ran, and it is labelled accordingly.
      const glMode = process.env.ANIM_TEST_GL || 'hardware';
      try {
        browser = await launchChromium(playwright, glMode);
      } catch {
        browser = await launchChromium(playwright, 'software');
      }
      const runs = [
        { name: 'desktop', width: 1600, height: 900, tier: 'desktop', dpr: 1 },
        { name: 'mobile', width: 390, height: 844, tier: 'mobile', dpr: 2 },
      ];
      for (const cfg of runs) {
        const r = await measure(browser, cfg);
        if (r.error) {
          check(`${cfg.name}: the arena renders`, false, `${r.error} ${r.errors.join('; ').slice(0, 160)}`);
          continue;
        }
        const budget = BUDGETS[cfg.tier];
        const software = /swiftshader|llvmpipe|software/i.test(r.renderer || '');
        console.log(`     ${cfg.name}: ${r.calls} draw calls, ${r.triangles} triangles, `
          + `${r.fps.toFixed(1)} FPS over ${r.frames} frames (tier ${r.tier})`);
        console.log(`     ${cfg.name}: GL "${String(r.renderer).slice(0, 90)}"`);
        check(`${cfg.name}: draw calls under ${budget.drawCalls}`,
          r.calls < budget.drawCalls, `${r.calls}`);
        check(`${cfg.name}: triangles under ${budget.triangles}`,
          r.triangles < budget.triangles, `${r.triangles}`);
        check(`${cfg.name}: no page errors`, r.errors.length === 0,
          r.errors.join('; ').slice(0, 200));
        // The 60 FPS criterion is asserted only on real hardware. Failing it on
        // a CPU rasteriser would say nothing at all about the mid-range GPU the
        // criterion is about, so on software it is reported and moved past.
        if (software) {
          console.log(`     ${cfg.name}: FPS reported only — software rasteriser`);
        } else {
          check(`${cfg.name}: holds 60 FPS on real hardware`, r.fps >= 58,
            `${r.fps.toFixed(1)} FPS`);
        }
      }
    } catch (err) {
      check('the browser budget run completes', false, String(err.message).slice(0, 200));
    } finally {
      await browser?.close();
      server?.kill('SIGTERM');
    }
  }
}

// ------------------------------------------------------------------ result --

console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
