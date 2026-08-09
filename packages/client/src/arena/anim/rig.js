// The rig: bind pose, bone lengths, and the detached Object3D hierarchy that
// turns a pose vector into world matrices.
//
// There is no skinned mesh here and there is no glTF skeleton: the parts are
// rigid and each is placed by its bone's world matrix. Blender IS available now
// and tools/blender/make-parts.py authors the four unit parts this rig places
// (anim/parts.js loads them), but they are still rigid pieces on purpose —
// skinning ten characters would cost the instancing that makes row #19 fit.
// What there IS, is a real hierarchy: hips carry the spine, the spine carries
// the chest, the thigh carries the shin carries the foot. Rotating the chest
// therefore takes the head and both arms with it, which is the whole point of a
// rig and the reason the aim layer can be one number.
//
// The hierarchy is NOT added to the scene. It exists purely so three.js can do
// the matrix composition for us; the resulting world matrices are then poured
// into a handful of InstancedMeshes (see instancedBody.js), so ten players cost
// seven draw calls instead of a hundred and fifty. That trade is what makes the
// mobile draw-call budget in rendering-optimization.md reachable at all.
//
// All lengths are metres in a 1.0-scale character (1.75 m tall). arena/view.js
// scales the whole thing onto the core's real player radius.

import * as THREE from 'three';
import { CHANNELS_PER_JOINT, CH_PX, CH_PY, CH_PZ, CH_RX, CH_RY, CH_RZ, JOINTS } from './pose.js';

/** Bone lengths. The IK solver is written against these two and nothing else. */
export const THIGH_LEN = 0.42;
export const SHIN_LEN = 0.42;
export const LEG_LEN = THIGH_LEN + SHIN_LEN;
export const UPPER_ARM_LEN = 0.30;
export const FOREARM_LEN = 0.28;

/** Hip height above the ground in the bind pose, with the legs straight. */
export const HIP_HEIGHT = 0.90;
/** Half the distance between the hip sockets. */
export const HIP_HALF_WIDTH = 0.11;
/** Half the distance between the shoulder sockets. */
export const SHOULDER_HALF_WIDTH = 0.20;

/**
 * The bind pose: each joint's offset from its parent, and who its parent is.
 * Order matters — a parent must appear before its children.
 */
export const BIND = Object.freeze([
  { name: 'root',      parent: null,        offset: [0, 0, 0] },
  { name: 'hips',      parent: 'root',      offset: [0, HIP_HEIGHT, 0] },
  { name: 'spine',     parent: 'hips',      offset: [0, 0.13, 0] },
  { name: 'chest',     parent: 'spine',     offset: [0, 0.20, 0] },
  { name: 'head',      parent: 'chest',     offset: [0, 0.26, 0] },
  { name: 'shoulderL', parent: 'chest',     offset: [-SHOULDER_HALF_WIDTH, 0.15, 0] },
  { name: 'shoulderR', parent: 'chest',     offset: [SHOULDER_HALF_WIDTH, 0.15, 0] },
  { name: 'elbowL',    parent: 'shoulderL', offset: [0, -UPPER_ARM_LEN, 0] },
  { name: 'elbowR',    parent: 'shoulderR', offset: [0, -UPPER_ARM_LEN, 0] },
  { name: 'thighL',    parent: 'hips',      offset: [-HIP_HALF_WIDTH, 0, 0] },
  { name: 'thighR',    parent: 'hips',      offset: [HIP_HALF_WIDTH, 0, 0] },
  { name: 'kneeL',     parent: 'thighL',    offset: [0, -THIGH_LEN, 0] },
  { name: 'kneeR',     parent: 'thighR',    offset: [0, -THIGH_LEN, 0] },
  { name: 'footL',     parent: 'kneeL',     offset: [0, -SHIN_LEN, 0] },
  { name: 'footR',     parent: 'kneeR',     offset: [0, -SHIN_LEN, 0] },
]);

// Sanity: BIND and JOINTS must agree, or a pose channel would land on the
// wrong bone and every assertion downstream would be measuring the wrong thing.
for (let i = 0; i < JOINTS.length; i++) {
  if (BIND[i].name !== JOINTS[i]) {
    throw new Error(`rig BIND[${i}] is ${BIND[i].name}, pose JOINTS[${i}] is ${JOINTS[i]}`);
  }
}

/**
 * Which drawable part hangs off which joint.
 *
 * There are only FOUR distinct geometries in this table, and that is the whole
 * design. Every entry is a UNIT primitive scaled per instance, so an upper arm,
 * a forearm, a thigh and a shin are all the same cylinder at different sizes —
 * which means all four, for all ten players, fit in a single InstancedMesh and
 * cost a single draw call. Thirteen parts x ten players collapses from 130
 * draw calls to 4. Row #19's mobile budget is 50 for the entire scene; there is
 * no version of this that works with one mesh per limb.
 *
 *   joint     the bone whose world matrix drives the part
 *   part      unit geometry key: 'body' | 'head' | 'limb' | 'boot'
 *   offset    the part's centre, in the bone's local space
 *   scale     [x, y, z] stretch of the unit geometry, metres
 *   tint      which palette entry colours it
 */
export const PARTS = Object.freeze([
  // The unit prism these two use has radius 1, so the x and z entries are
  // RADII, not widths. The torso must stay narrower than SHOULDER_HALF_WIDTH or
  // it swallows both arms — which it did, and only a close-up caught it.
  { joint: 'hips',      part: 'body', offset: [0, 0.065, 0],              scale: [0.170, 0.260, 0.115], tint: 'shorts' },
  { joint: 'chest',     part: 'body', offset: [0, 0.055, 0],              scale: [0.195, 0.460, 0.130], tint: 'jersey' },
  { joint: 'head',      part: 'head', offset: [0, 0.130, 0],              scale: [0.118, 0.132, 0.118], tint: 'skin' },
  { joint: 'shoulderL', part: 'limb', offset: [0, -UPPER_ARM_LEN / 2, 0], scale: [0.056, UPPER_ARM_LEN, 0.056], tint: 'jersey' },
  { joint: 'shoulderR', part: 'limb', offset: [0, -UPPER_ARM_LEN / 2, 0], scale: [0.056, UPPER_ARM_LEN, 0.056], tint: 'jersey' },
  { joint: 'elbowL',    part: 'limb', offset: [0, -FOREARM_LEN / 2, 0],   scale: [0.046, FOREARM_LEN, 0.046], tint: 'skin' },
  { joint: 'elbowR',    part: 'limb', offset: [0, -FOREARM_LEN / 2, 0],   scale: [0.046, FOREARM_LEN, 0.046], tint: 'skin' },
  { joint: 'thighL',    part: 'limb', offset: [0, -THIGH_LEN / 2, 0],     scale: [0.078, THIGH_LEN, 0.078], tint: 'shorts' },
  { joint: 'thighR',    part: 'limb', offset: [0, -THIGH_LEN / 2, 0],     scale: [0.078, THIGH_LEN, 0.078], tint: 'shorts' },
  { joint: 'kneeL',     part: 'limb', offset: [0, -SHIN_LEN / 2, 0],      scale: [0.058, SHIN_LEN, 0.058], tint: 'skin' },
  { joint: 'kneeR',     part: 'limb', offset: [0, -SHIN_LEN / 2, 0],      scale: [0.058, SHIN_LEN, 0.058], tint: 'skin' },
  { joint: 'footL',     part: 'boot', offset: [0, -0.035, 0.045],         scale: [0.088, 0.070, 0.205], tint: 'boot' },
  { joint: 'footR',     part: 'boot', offset: [0, -0.035, 0.045],         scale: [0.088, 0.070, 0.205], tint: 'boot' },
]);

/** Distinct geometry keys, in a stable order — one draw call each. */
export const PART_KEYS = Object.freeze([...new Set(PARTS.map((p) => p.part))]);

/** How many instances of each key one player needs. */
export const PARTS_PER_KEY = Object.freeze(PART_KEYS.reduce((acc, key) => {
  acc[key] = PARTS.filter((p) => p.part === key).length;
  return acc;
}, Object.create(null)));

/**
 * A detached hierarchy of Object3Ds, one per joint, in BIND order.
 * `nodes[i]` is the joint named `JOINTS[i]`.
 */
export function createSkeleton() {
  const nodes = [];
  for (const bind of BIND) {
    const node = new THREE.Object3D();
    node.name = bind.name;
    node.matrixAutoUpdate = false;
    nodes.push(node);
  }
  for (let i = 0; i < BIND.length; i++) {
    const parent = BIND[i].parent;
    if (parent !== null) nodes[JOINTS.indexOf(parent)].add(nodes[i]);
  }
  return { root: nodes[0], nodes };
}

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

/**
 * Pour a pose vector into a skeleton and compose the world matrices.
 *
 * Pure in the only sense that matters here: the resulting matrices depend on
 * `pose` and nothing else, because every joint's transform is overwritten from
 * the bind offset plus the pose, never accumulated across frames.
 */
export function applyPoseToSkeleton(skeleton, pose) {
  const { nodes } = skeleton;
  for (let i = 0; i < nodes.length; i++) {
    const base = i * CHANNELS_PER_JOINT;
    const off = BIND[i].offset;
    _e.set(pose[base + CH_RX], pose[base + CH_RY], pose[base + CH_RZ], 'XYZ');
    _q.setFromEuler(_e);
    _v.set(
      off[0] + pose[base + CH_PX],
      off[1] + pose[base + CH_PY],
      off[2] + pose[base + CH_PZ],
    );
    nodes[i].matrix.compose(_v, _q, _s);
  }
  skeleton.root.updateMatrixWorld(true);
  return skeleton;
}

/**
 * Analytic two-bone IK. This is the "iki-kemik analitik çözüm" the animation
 * standard asks for in preference to CCDIK, and it is why the feet can be
 * placed on the ground rather than swung and hoped for.
 *
 * Solves for the rotations of a thigh/shin pair whose chain starts at the hip
 * and must put the ankle at `target`, expressed in the HIP's local space with
 * the bones resting down -Y.
 *
 * @param {number[]} target [x, y, z] ankle position relative to the hip socket
 * @param {number} l1 thigh length
 * @param {number} l2 shin length
 * @param {object} out receives {thighX, thighZ, kneeX}
 */
export function solveTwoBoneIK(target, l1, l2, out) {
  const tx = target[0], ty = target[1], tz = target[2];
  const reach = l1 + l2;
  const floor = Math.abs(l1 - l2) + 1e-4;
  const dist = Math.hypot(tx, ty, tz);
  if (dist < 1e-6) { out.thighX = 0; out.thighZ = 0; out.kneeX = 0; return out; }
  // Clamping keeps acos in domain: a target beyond reach simply straightens the
  // leg toward it instead of producing NaN and a body that vanishes.
  const d = Math.min(Math.max(dist, floor), reach - 1e-4);

  // EXACT, not "aim then bend".
  //
  // The obvious construction — point the whole chain at the target, then rotate
  // the thigh back by the hip angle from the law of cosines — is only correct
  // in the sagittal plane. The moment the target has a lateral component the
  // thigh's own Z rotation sits BETWEEN the hip swing and the knee flex in the
  // Euler chain, the knee hinge is no longer axis-aligned with the swing, and
  // the ankle misses by up to a third of a metre. It looked fine and it was
  // wrong; the sweep in scripts/anim-test.mjs is what caught it.
  //
  // Forward kinematics for this rig, thigh Euler XYZ with ry = 0 and the knee
  // a child rotating about its own X:
  //
  //   ankle = Rx(a) . Rz(c) . [ (0,-l1,0) + Rx(k) . (0,-l2,0) ]
  //
  // Let P = l1 + l2 cos k and R = l2 sin k. Working the product through gives
  //
  //   ankle = ( P sin c,
  //             -P cos c cos a + R sin a,
  //             -P cos c sin a - R cos a )
  //
  // whose squared length is P^2 + R^2 = l1^2 + l2^2 + 2 l1 l2 cos k — the law
  // of cosines, which fixes k. P and R follow, c comes from the x component,
  // and the last two rows are one planar rotation, which fixes a. Closed form,
  // no iteration, exact to floating point.
  const cosKnee = (d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2);
  const k = Math.acos(Math.min(1, Math.max(-1, cosKnee)));
  const P = l1 + l2 * Math.cos(k);
  const R = l2 * Math.sin(k);

  const sinC = P > 1e-9 ? Math.min(1, Math.max(-1, tx / P)) : 0;
  const c = Math.asin(sinC);
  const Q = Math.sqrt(Math.max(0, P * P - tx * tx));   // = P cos c, c in [-pi/2, pi/2]

  const rho = Math.hypot(Q, R);
  const phi = Math.atan2(R, Q);
  const a = rho > 1e-9 ? Math.atan2(-tz, -ty) - phi : 0;

  out.thighX = a;
  out.thighZ = c;
  out.kneeX = k;
  return out;
}

/** Scratch result object for solveTwoBoneIK, so the hot path never allocates. */
export function createIKResult() {
  return { thighX: 0, thighZ: 0, kneeX: 0 };
}

/**
 * How far sideways the solver can actually put an ankle that is `dist` from the
 * hip. This is a real limit of the rig, not of the maths, and it is exported so
 * callers and tests can respect it instead of discovering it as a silent error.
 *
 * The chain is Rx(a) . Rz(c) . [thigh + Rx(k) . shin]. The outermost rotation
 * is about X, and a rotation about X cannot change an x coordinate — so the
 * ankle's x is fixed entirely by Rz(c) and equals P sin(c), where P is the
 * hip-to-ankle distance PROJECTED onto the leg plane. |x| can therefore never
 * exceed P, whatever `a` does.
 *
 * P depends only on `dist`, so this is a closed-form band. For the 0.84 m leg
 * the rig uses it works out at roughly half a metre — a splay far wider than a
 * hip joint permits anyway, which is why capping it costs nothing. Targets
 * beyond it are clamped to the widest reachable splay rather than refused.
 */
export function lateralReach(dist, l1 = THIGH_LEN, l2 = SHIN_LEN) {
  const d = Math.min(Math.max(dist, Math.abs(l1 - l2)), l1 + l2);
  const cosKnee = Math.min(1, Math.max(-1, (d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2)));
  return l1 + l2 * cosKnee;
}
