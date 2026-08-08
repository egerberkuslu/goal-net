// The pose vector: the one data structure every animation layer speaks.
//
// A pose is a flat Float64Array of CHANNELS numbers. No objects, no allocation
// per frame, no hidden classes — which matters twice over here:
//
//   * blending, additive layering and crossfading are all plain vector maths,
//     so a "state machine transition" is a lerp and cannot pop by construction;
//   * two poses are equal iff their arrays are equal element for element, which
//     is exactly the determinism assertion scripts/anim-test.mjs makes.
//
// Every joint owns six channels — three Euler rotations (XYZ order, radians)
// and three position offsets from its bind pose, in metres. The rig in rig.js
// is the only thing that knows what a joint looks like; everything in this
// directory only ever writes numbers into a pose.
//
// The root joint is special: its position channels are WORLD metres and its
// RY channel is the world facing. Everything else is local to its parent.

export const JOINTS = Object.freeze([
  'root',      // 0  world placement: position = metres, ry = facing
  'hips',      // 1  pelvis; the locomotion bob and the lean live here
  'spine',     // 2  lower back
  'chest',     // 3  upper back; the aim twist lands here
  'head',      // 4  look-at, plus the breathing bob
  'shoulderL', // 5
  'shoulderR', // 6
  'elbowL',    // 7
  'elbowR',    // 8
  'thighL',    // 9
  'thighR',    // 10
  'kneeL',     // 11
  'kneeR',     // 12
  'footL',     // 13  ankle; the IK solver writes here
  'footR',     // 14
]);

export const JOINT_INDEX = Object.freeze(
  JOINTS.reduce((acc, name, i) => { acc[name] = i; return acc; }, Object.create(null)),
);

/** Channels per joint: rx, ry, rz, px, py, pz. */
export const CHANNELS_PER_JOINT = 6;
export const CHANNELS = JOINTS.length * CHANNELS_PER_JOINT;

export const CH_RX = 0;
export const CH_RY = 1;
export const CH_RZ = 2;
export const CH_PX = 3;
export const CH_PY = 4;
export const CH_PZ = 5;

/** Flat index of one channel of one joint. `joint` may be a name or an index. */
export function ch(joint, channel) {
  const j = typeof joint === 'number' ? joint : JOINT_INDEX[joint];
  if (j === undefined) throw new Error(`unknown joint: ${joint}`);
  return j * CHANNELS_PER_JOINT + channel;
}

/** A fresh, all-zero pose. Zero IS the bind pose; the rig holds the offsets. */
export function createPose() {
  return new Float64Array(CHANNELS);
}

export function zeroPose(out) {
  out.fill(0);
  return out;
}

export function copyPose(out, src) {
  out.set(src);
  return out;
}

/** out = a + (b - a) * t, componentwise. The only transition primitive. */
export function lerpPose(out, a, b, t) {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  for (let i = 0; i < CHANNELS; i++) out[i] = a[i] + (b[i] - a[i]) * k;
  return out;
}

/** out += delta * weight. Additive layers (aim, lean, tap, breath) use this. */
export function addPose(out, delta, weight = 1) {
  if (weight === 0) return out;
  for (let i = 0; i < CHANNELS; i++) out[i] += delta[i] * weight;
  return out;
}

/** out += src * weight, for accumulating a normalised blend of anchor poses. */
export const accumulatePose = addPose;

export function scalePose(out, k) {
  for (let i = 0; i < CHANNELS; i++) out[i] *= k;
  return out;
}

/** Largest absolute channel difference. Used by the continuity assertions. */
export function poseDelta(a, b) {
  let worst = 0;
  for (let i = 0; i < CHANNELS; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > worst) worst = d;
  }
  return worst;
}

/** Exact equality, channel for channel. The determinism assertion. */
export function posesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Human-readable dump, for a failing assertion's detail string. */
export function describePose(pose, epsilon = 1e-6) {
  const out = [];
  for (let j = 0; j < JOINTS.length; j++) {
    const parts = [];
    for (let c = 0; c < CHANNELS_PER_JOINT; c++) {
      const v = pose[j * CHANNELS_PER_JOINT + c];
      if (Math.abs(v) > epsilon) parts.push(`${'rx ry rz px py pz'.split(' ')[c]}=${v.toFixed(3)}`);
    }
    if (parts.length) out.push(`${JOINTS[j]}(${parts.join(' ')})`);
  }
  return out.join(' ');
}

/** A small pool so per-frame layering never allocates. */
export function createPosePool(size) {
  const buf = [];
  for (let i = 0; i < size; i++) buf.push(createPose());
  let cursor = 0;
  return {
    /** Borrow the next scratch pose, already zeroed. */
    take() {
      const p = buf[cursor];
      cursor = (cursor + 1) % buf.length;
      p.fill(0);
      return p;
    },
    reset() { cursor = 0; },
  };
}
