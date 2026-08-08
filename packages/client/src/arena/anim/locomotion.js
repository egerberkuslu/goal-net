// #14 — eight-way locomotion blend space plus the procedural layers.
//
// animation-standard.md is explicit about two things: a blend space over eight
// directions crossed with speed, and NO single looping run clip. Both are met
// here, but not by crossfading canned clips — there are none to crossfade, and
// there will not be until somebody with Blender works the Mixamo queue.
//
// What replaces them is a parametric blend space. Each of the 8 x 3 anchors is
// a set of GAIT PARAMETERS (stride length, foot lift, hip yaw and roll, torso
// pitch, arm swing, whether the feet may cross), not a pose. A travel direction
// and a speed pick a weighted mix of those parameters, and the mixed parameters
// drive a foot trajectory that the two-bone IK in rig.js then solves.
//
// Blending the PARAMETERS rather than the POSES is what keeps the feet on the
// ground. Averaging a forward-run pose with a side-shuffle pose gives you a
// character wading through the turf at half depth; averaging their stride
// lengths and then re-solving the IK gives you a diagonal step with both feet
// planted. That is the whole argument for doing it this way.
//
// LAYERS, each additive on top of the base gait and each independently testable
//
//   lean   filtered acceleration in the player's own frame tips the hips and
//          spine into the turn or the sprint start
//   aim    the chest and head twist toward the ball, chest clamped tighter than
//          the head so the look reads as the head leading the shoulders
//   feet   phase-locked footfalls with ground snapping: stance feet are pinned
//          to y = 0 and slide backwards under the hips at travel speed, swing
//          feet arc over. No raycasts — the arena floor is a plane at y = 0 and
//          pretending otherwise would cost ten raycasts a frame for nothing
//   tap    a decaying impulse fired by a core ball contact, so the touch is
//          visibly synchronised with the simulation rather than near it
//   breath a slow chest and head oscillation that never stops, so an idle
//          player is never a statue

import {
  CH_PY, CH_PZ, CH_RX, CH_RY, CH_RZ, ch,
} from './pose.js';
import {
  HIP_HEIGHT, SHIN_LEN, THIGH_LEN, createIKResult, solveTwoBoneIK,
} from './rig.js';
import { gaitBlend } from './clock.js';

/** The eight compass anchors, in the player's own frame. 0 = straight ahead. */
export const ANCHOR_DIRS = Object.freeze([
  0,                 // N   forward
  Math.PI * 0.25,    // NE  forward-right
  Math.PI * 0.5,     // E   right
  Math.PI * 0.75,    // SE  back-right
  Math.PI,           // S   backward
  Math.PI * 1.25,    // SW  back-left
  Math.PI * 1.5,     // W   left
  Math.PI * 1.75,    // NW  forward-left
]);
export const ANCHOR_NAMES = Object.freeze(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);

/** The three speed rows of the blend space. */
export const SPEED_TIERS = Object.freeze(['idle', 'walk', 'run']);

/**
 * Direction character. These are the numbers that make a backpedal look like a
 * backpedal and a strafe look like a strafe rather than like a run played at an
 * angle, which is exactly the failure mode a single clip has.
 *
 *   stride     metres the ankle travels per step at full speed
 *   lift       metres the swing foot clears the ground
 *   hipYaw     radians the pelvis turns toward the travel direction
 *   hipRoll    radians of lateral pelvis tilt (a shuffle rolls, a run does not)
 *   torso      radians of forward pitch
 *   armSwing   scale on the counter-swing of the arms
 *   armFlare   radians the arms are held out from the body for balance
 *   cross      0 = the feet may never cross the centre line (a side-step),
 *              1 = free crossover (a run)
 *   asym       phase skew between the two feet; a drop-step is not symmetric
 */
const DIR_PROFILE = Object.freeze({
  N:  { stride: 1.00, lift: 1.00, hipYaw:  0.00, hipRoll: 0.00, torso: 1.00, armSwing: 1.00, armFlare: 0.00, cross: 1.00, asym:  0.00 },
  NE: { stride: 0.88, lift: 0.92, hipYaw:  0.22, hipRoll: 0.05, torso: 0.85, armSwing: 0.85, armFlare: 0.10, cross: 0.65, asym:  0.05 },
  E:  { stride: 0.58, lift: 0.62, hipYaw:  0.10, hipRoll: 0.16, torso: 0.35, armSwing: 0.35, armFlare: 0.34, cross: 0.00, asym:  0.00 },
  SE: { stride: 0.66, lift: 0.70, hipYaw: -0.16, hipRoll: 0.11, torso: 0.05, armSwing: 0.50, armFlare: 0.26, cross: 0.25, asym: -0.08 },
  S:  { stride: 0.72, lift: 0.80, hipYaw:  0.00, hipRoll: 0.00, torso: -0.45, armSwing: 0.65, armFlare: 0.18, cross: 0.40, asym:  0.00 },
  SW: { stride: 0.66, lift: 0.70, hipYaw:  0.16, hipRoll: -0.11, torso: 0.05, armSwing: 0.50, armFlare: 0.26, cross: 0.25, asym:  0.08 },
  W:  { stride: 0.58, lift: 0.62, hipYaw: -0.10, hipRoll: -0.16, torso: 0.35, armSwing: 0.35, armFlare: 0.34, cross: 0.00, asym:  0.00 },
  NW: { stride: 0.88, lift: 0.92, hipYaw: -0.22, hipRoll: -0.05, torso: 0.85, armSwing: 0.85, armFlare: 0.10, cross: 0.65, asym: -0.05 },
});

/** Speed character, multiplied onto the direction profile. */
const TIER_PROFILE = Object.freeze({
  idle: { stride: 0.06, lift: 0.10, torso: 0.02, armSwing: 0.10, crouch: 0.010, bob: 0.004 },
  walk: { stride: 0.46, lift: 0.55, torso: 0.06, armSwing: 0.55, crouch: 0.022, bob: 0.020 },
  run:  { stride: 1.00, lift: 1.00, torso: 0.19, armSwing: 1.00, crouch: 0.052, bob: 0.046 },
});

/** Base magnitudes the profiles scale. Metres and radians. */
const STRIDE_M = 0.86;
const LIFT_M = 0.20;

const PARAM_KEYS = Object.freeze([
  'stride', 'lift', 'hipYaw', 'hipRoll', 'torso', 'armSwing', 'armFlare',
  'cross', 'asym', 'crouch', 'bob',
]);

/**
 * The materialised 8 x 3 anchor grid. Exported so the test can assert there
 * really are 24 distinct anchors and that no two of them are the same numbers —
 * "TEK KLİP KOŞU KABUL EDİLMEZ", checked rather than promised.
 */
export const ANCHORS = Object.freeze(ANCHOR_NAMES.map((dirName, d) => Object.freeze(
  SPEED_TIERS.map((tierName) => {
    const dir = DIR_PROFILE[dirName];
    const tier = TIER_PROFILE[tierName];
    return Object.freeze({
      dir: dirName,
      dirIndex: d,
      tier: tierName,
      stride: dir.stride * tier.stride * STRIDE_M,
      lift: dir.lift * tier.lift * LIFT_M,
      hipYaw: dir.hipYaw * (0.35 + tier.stride * 0.65),
      hipRoll: dir.hipRoll * (0.3 + tier.stride * 0.7),
      torso: dir.torso * tier.torso,
      armSwing: dir.armSwing * tier.armSwing,
      armFlare: dir.armFlare * (0.5 + tier.stride * 0.5),
      cross: dir.cross,
      asym: dir.asym,
      crouch: tier.crouch,
      bob: tier.bob,
    });
  }),
)));

/**
 * Angular blend weights over the eight anchors.
 *
 * Only the two anchors that bracket the travel direction get any weight, and
 * they are weighted by a smoothstep of the angular gap rather than linearly, so
 * the derivative is continuous as the direction sweeps past an anchor. A linear
 * weight has a kink at every anchor, and a kink at 45-degree intervals is
 * visible as a tiny hitch when a player circles the ball.
 *
 * @param {number} dirAngle travel direction in the player's own frame, radians
 * @param {Float64Array} [out] length-8 scratch
 */
export function blendWeights(dirAngle, out = new Float64Array(8)) {
  out.fill(0);
  const step = Math.PI * 2 / 8;
  let a = dirAngle % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  const slot = a / step;
  const lo = Math.floor(slot) % 8;
  const hi = (lo + 1) % 8;
  const f = slot - Math.floor(slot);
  const s = f * f * (3 - 2 * f); // smoothstep
  out[lo] = 1 - s;
  out[hi] = s;
  return out;
}

const _params = Object.create(null);
for (const k of PARAM_KEYS) _params[k] = 0;
const _w = new Float64Array(8);

/**
 * Blend the anchor grid down to one parameter set.
 * @param {number} dirAngle travel direction in the player's own frame
 * @param {number} speed ground speed, metres per second
 * @param {object} [out] scratch parameter object
 */
export function blendParams(dirAngle, speed, out = _params) {
  const g = gaitBlend(speed);                 // 0 idle .. 1 run
  // Two speed rows at a time: idle->walk over the first half, walk->run over
  // the second, so the row blend is continuous and never mixes idle with run.
  const row = g * 2;
  const rLo = row < 1 ? 0 : 1;
  const rHi = rLo + 1;
  const rf = row - rLo;
  blendWeights(dirAngle, _w);
  for (const k of PARAM_KEYS) out[k] = 0;
  for (let d = 0; d < 8; d++) {
    const w = _w[d];
    if (w === 0) continue;
    const lo = ANCHORS[d][rLo];
    const hi = ANCHORS[d][rHi];
    for (const k of PARAM_KEYS) out[k] += w * (lo[k] + (hi[k] - lo[k]) * rf);
  }
  return out;
}

// ------------------------------------------------------------- base gait ----

const _ik = createIKResult();
const _target = [0, 0, 0];

/**
 * Where one ankle should be, in the hips' local space, at a given foot phase.
 *
 * Stance runs over [0, 0.5): the foot is PINNED to the ground and travels
 * backwards under the hips, which is what makes the character look like it is
 * pushing the world past rather than skating over it. Swing runs over [0.5, 1):
 * the foot lifts on a sine arc and is carried forward again.
 *
 * @param {number} footPhase [0,1)
 * @param {object} p blended parameters
 * @param {number} side -1 left, +1 right
 * @param {number} dirX unit travel direction, x component, player frame
 * @param {number} dirZ unit travel direction, z component, player frame
 * @param {number[]} out [x, y, z]
 */
export function footTarget(footPhase, p, side, dirX, dirZ, out = _target) {
  const half = p.stride * 0.5;
  let along;
  let lift;
  if (footPhase < 0.5) {
    // stance: linear from +half (heel strike) to -half (toe off)
    const u = footPhase / 0.5;
    along = half - p.stride * u;
    lift = 0;                       // ground snap, exactly y = 0
  } else {
    // swing: eased forward, arcing over the ground
    const u = (footPhase - 0.5) / 0.5;
    const e = u * u * (3 - 2 * u);  // smoothstep, so toe-off and heel-strike
    along = -half + p.stride * e;   // both have zero horizontal acceleration
    lift = Math.sin(u * Math.PI) * p.lift;
  }
  // Lateral stance width, plus the no-crossing rule that turns a diagonal into
  // a side-step: `cross` 0 forbids the ankle from passing the centre line.
  let x = side * 0.115 + dirX * along;
  const minGap = 0.055 * (1 - p.cross);
  if (side < 0) x = Math.min(x, -minGap);
  else x = Math.max(x, minGap);

  out[0] = x;
  out[1] = -(HIP_HEIGHT - p.crouch) + lift;
  out[2] = dirZ * along;
  return out;
}

/**
 * Write the base gait into `out`.
 *
 * @param {Float64Array} out pose to write (overwrites the joints it owns)
 * @param {object} p blended parameters from blendParams()
 * @param {number} phase stride phase in turns, from the AnimClock
 * @param {number} dirAngle travel direction in the player's own frame
 */
export function writeGait(out, p, phase, dirAngle) {
  const dirX = Math.sin(dirAngle);
  const dirZ = Math.cos(dirAngle);

  // hips: bob at twice the stride rate (one dip per footfall), yaw and roll
  const bob = -Math.abs(Math.sin(phase * Math.PI * 2)) * p.bob;
  out[ch('hips', CH_PY)] += bob - p.crouch;
  out[ch('hips', CH_RY)] += p.hipYaw;
  out[ch('hips', CH_RZ)] += p.hipRoll * Math.sin(phase * Math.PI * 2);
  out[ch('hips', CH_RX)] += p.torso * 0.35;
  out[ch('spine', CH_RX)] += p.torso * 0.4;
  out[ch('chest', CH_RX)] += p.torso * 0.25;
  // counter-rotation: the shoulders lead the hips by half a beat, always
  out[ch('chest', CH_RY)] += -p.hipYaw * 0.6 + Math.sin(phase * Math.PI * 2) * p.armSwing * 0.10;

  // legs, through the analytic IK so the stance foot is on the ground
  for (const [jointT, jointK, jointF, side, skew] of [
    ['thighL', 'kneeL', 'footL', -1, 0],
    ['thighR', 'kneeR', 'footR', 1, p.asym],
  ]) {
    const footPhase = (phase + (side > 0 ? 0.5 : 0) + skew + 1) % 1;
    footTarget(footPhase, p, side, dirX, dirZ, _target);
    // the target is relative to the HIP SOCKET, not the pelvis centre
    _target[0] -= side * 0.11;
    solveTwoBoneIK(_target, THIGH_LEN, SHIN_LEN, _ik);
    out[ch(jointT, CH_RX)] += _ik.thighX;
    out[ch(jointT, CH_RZ)] += _ik.thighZ;
    out[ch(jointK, CH_RX)] += _ik.kneeX;
    // keep the boot flat on the ground through stance, roll it through swing
    const flat = -(_ik.thighX + _ik.kneeX);
    const roll = footPhase < 0.5
      ? Math.sin(footPhase / 0.5 * Math.PI) * 0.18   // heel strike -> toe off
      : -0.25;                                       // toes up while swinging
    out[ch(jointF, CH_RX)] += flat + roll;
  }

  // arms counter-swing the legs and flare out for balance in a shuffle
  const swing = p.armSwing * 0.85;
  out[ch('shoulderL', CH_RX)] += Math.sin((phase + 0.5) * Math.PI * 2) * swing;
  out[ch('shoulderR', CH_RX)] += Math.sin(phase * Math.PI * 2) * swing;
  out[ch('shoulderL', CH_RZ)] += 0.14 + p.armFlare;
  out[ch('shoulderR', CH_RZ)] += -0.14 - p.armFlare;
  // elbows are never straight while moving; they carry a little of the swing
  const bend = -0.20 - p.armSwing * 0.55;
  out[ch('elbowL', CH_RX)] += bend - Math.sin((phase + 0.5) * Math.PI * 2) * swing * 0.3;
  out[ch('elbowR', CH_RX)] += bend - Math.sin(phase * Math.PI * 2) * swing * 0.3;
  return out;
}

// ----------------------------------------------------------------- layers ---

/** Peak lean, radians, so a hard turn never folds the player in half. */
export const MAX_LEAN = 0.30;
/** Acceleration, m/s^2, that produces MAX_LEAN. */
const LEAN_REFERENCE = 9;

/**
 * Layer: lean into acceleration. Forward acceleration pitches the body ahead of
 * the feet; lateral acceleration rolls it into the turn, the way a skater
 * banks. Both are clamped, and both come off the CLOCK's filtered acceleration
 * rather than a raw frame difference, because the core's velocity is quantised
 * and a raw derivative buzzes.
 */
export function layerLean(out, accelF, accelR, weight = 1) {
  if (weight === 0) return out;
  const clamp = (v) => Math.max(-MAX_LEAN, Math.min(MAX_LEAN, v / LEAN_REFERENCE * MAX_LEAN));
  const pitch = clamp(accelF) * weight;
  const roll = clamp(-accelR) * weight;
  out[ch('hips', CH_RX)] += pitch * 0.45;
  out[ch('spine', CH_RX)] += pitch * 0.35;
  out[ch('chest', CH_RX)] += pitch * 0.20;
  out[ch('hips', CH_RZ)] += roll * 0.5;
  out[ch('spine', CH_RZ)] += roll * 0.3;
  out[ch('chest', CH_RZ)] += roll * 0.2;
  return out;
}

/** How far the chest and the head may twist off the facing, radians. */
export const MAX_CHEST_TWIST = 0.55;
export const MAX_HEAD_TWIST = 0.95;

/**
 * Layer: aim the upper body at the ball.
 *
 * The chest is clamped tighter than the head so that at wide angles the head
 * runs out ahead of the shoulders — that split is the entire read of "looking
 * at something while running somewhere else". A single bone aim looks like a
 * doll being turned.
 *
 * @param {number} yaw bearing to the ball relative to the player's facing
 * @param {number} pitch elevation to the ball (mostly zero; the core is 2D)
 */
export function layerAim(out, yaw, pitch = 0, weight = 1) {
  if (weight === 0) return out;
  const clampTo = (v, m) => Math.max(-m, Math.min(m, v));
  const chest = clampTo(yaw * 0.45, MAX_CHEST_TWIST) * weight;
  const head = clampTo(yaw, MAX_HEAD_TWIST) * weight - chest;
  out[ch('chest', CH_RY)] += chest;
  out[ch('head', CH_RY)] += head;
  out[ch('head', CH_RX)] += clampTo(-pitch, 0.5) * weight;
  return out;
}

/** Layer: breathing and idle micro-motion. Never switched off. */
export function layerBreath(out, breathPhase, amount = 1) {
  const a = Math.sin(breathPhase * Math.PI * 2);
  const b = Math.sin(breathPhase * Math.PI * 2 * 1.618 + 0.7);
  out[ch('chest', CH_RX)] += a * 0.020 * amount;
  out[ch('chest', CH_PY)] += a * 0.006 * amount;
  out[ch('head', CH_RX)] += b * 0.014 * amount;
  out[ch('head', CH_RY)] += b * 0.020 * amount;
  out[ch('shoulderL', CH_RZ)] += a * 0.018 * amount;
  out[ch('shoulderR', CH_RZ)] += -a * 0.018 * amount;
  return out;
}

/** Seconds a contact tap takes to die away. */
export const TAP_DURATION = 0.24;

/**
 * Layer: the contact "tap".
 *
 * animation-standard.md: "Core temas olayı → additive tap (dokunuş senkronu)".
 * A core ball contact fires this, and it decays to nothing in TAP_DURATION, so
 * the visible flick sits ON the tick the simulation touched the ball rather
 * than a lazy quarter second after it.
 *
 * @param {number} t seconds since the contact, 0 at the moment of contact
 * @param {number} side -1 left foot, +1 right foot
 * @param {number} strength 0..1
 */
export function layerTap(out, t, side, strength = 1) {
  if (!(t >= 0) || t >= TAP_DURATION || strength <= 0) return out;
  const u = t / TAP_DURATION;
  // one half-cycle with an exponential envelope: a snap, then nothing
  const env = Math.sin(u * Math.PI) * Math.exp(-3.2 * u) * strength;
  const thigh = side < 0 ? 'thighL' : 'thighR';
  const knee = side < 0 ? 'kneeL' : 'kneeR';
  const foot = side < 0 ? 'footL' : 'footR';
  out[ch(thigh, CH_RX)] += -env * 0.55;
  out[ch(knee, CH_RX)] += -env * 0.42;
  out[ch(foot, CH_RX)] += env * 0.30;
  out[ch('hips', CH_RY)] += side * env * 0.10;
  out[ch('chest', CH_RY)] += -side * env * 0.16;
  out[ch('chest', CH_RX)] += env * 0.09;
  return out;
}

/** Vertical distance from the pose's own hip height back to the ground. */
export function hipDrop(p) {
  return HIP_HEIGHT - p.crouch;
}
