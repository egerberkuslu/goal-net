// Driving a downloaded skeleton with our own poses.
//
// The decision (ADR pending, brain/20-tech-spec/asset-sources.md): take the
// character and its skeleton from a model site, but NOT its animation clips.
// arena/anim computes a pose every frame — run cycle, five kick variants, the
// keeper's dives and get-ups, celebrations — and those are poses, not clips.
// Ragdoll, the aim stance and the shot charge only exist because they are
// computed; a clip cannot be asked to lean 12 degrees toward where the player
// is about to shoot.
//
// The problem this file solves
// ---------------------------
// Two rigs never agree on bone axes. Ours is authored with each chain
// pointing toward its own next joint (rig.js BIND) — the limbs down its
// parent's -Y, the spine chain up its parent's +Y. A downloaded rig points
// its bones wherever its author's software did. Applying our rotations
// straight onto their bones therefore bends the right leg sideways and
// twists the head.
//
// So each mapped joint gets a correction: the rotation that takes OUR bind
// direction to THEIRS. The pose is then applied as
//
//     bone.quaternion = restQuat * (C^-1 * ourDelta * C)
//
// which is the standard bone-space retarget. It gets the swing exactly right.
// It does not solve twist — a rig whose bone rolls differently will rotate a
// limb about its own length — and that is a visible-but-small error on a
// footballer, which is why it is not chased here.

import * as THREE from 'three';
import { CH_RX, CH_RY, CH_RZ, CHANNELS_PER_JOINT, JOINTS } from '../arena/anim/pose.js';
import {
  BIND, FOREARM_LEN, SHIN_LEN, THIGH_LEN, UPPER_ARM_LEN,
} from '../arena/anim/rig.js';

/**
 * Our joint -> their bone, for the two rigs in vendor-assets.
 *
 * Both come from the same rig family (Blender's Rigify-style naming), so one
 * table serves both; a bone that is missing is simply not driven, which is how
 * `spine` behaves on a rig that has no lower back.
 *
 * Matching is by prefix and punctuation-insensitive. The glTF exporter appends
 * an index to every bone (`Chest_07`) and three.js strips the dots out of a
 * Blender side suffix, so the `Arm.L` an artist typed arrives as `ArmL_012`.
 * Matching on the literal name found ten of a player's fourteen joints and
 * quietly left him with no arms or legs.
 *
 * 'hips' prefers a bone literally named 'Hips' over 'MASTER': on
 * player-rig.glb, MASTER_06 is a zero-weight control bone (verified against
 * the mesh's own skinIndex/skinWeight attributes — every vertex has 0 weight
 * on it) that sits ABOVE Hips_035 in the hierarchy and is a sibling of the
 * chest branch, not its parent. Binding 'hips' to it made every hip
 * articulation (locomotion bob, yaw, roll — written on nearly every frame)
 * invisible: the quaternion was set correctly and nothing on screen moved,
 * because no vertex is skinned to that bone. 'MASTER' stays as a last-resort
 * fallback for a rig that genuinely has no bone named 'Hips'.
 *
 * 'spine' drops the 'Hips' fallback entirely. On player-rig.glb — which has
 * no dedicated lower-back bone — that fallback landed 'spine' on the SAME
 * Hips_035 bone 'hips' now correctly claims, and because entries are applied
 * in JOINTS order (spine after hips), spine's quaternion was written last and
 * silently overwrote hips' own rotation on that bone every single frame. A
 * rig with no lower back is meant to leave 'spine' unmapped (see rig.js's own
 * comment on this), not double-drive someone else's bone.
 */
const BONE_MAP = Object.freeze({
  hips: ['Hips', 'MASTER', 'mixamorig:Hips'],
  spine: ['Spine'],
  chest: ['Chest', 'Traps', 'Spine1'],
  head: ['Head'],
  shoulderL: ['Arm.L', 'UpperArm.L', 'LeftArm'],
  shoulderR: ['Arm.R', 'UpperArm.R', 'RightArm'],
  elbowL: ['Forearm.L', 'LowerArm.L', 'LeftForeArm'],
  elbowR: ['Forearm.R', 'LowerArm.R', 'RightForeArm'],
  thighL: ['Leg.L', 'Thigh.L', 'LeftUpLeg'],
  thighR: ['Leg.R', 'Thigh.R', 'RightUpLeg'],
  kneeL: ['Calf.L', 'Shin.L', 'LeftLeg'],
  kneeR: ['Calf.R', 'Shin.R', 'RightLeg'],
  footL: ['Foot.L', 'LeftFoot'],
  footR: ['Foot.R', 'RightFoot'],
});

/**
 * Which way EACH of our joints points, derived from rig.js's own BIND table
 * instead of a single hardcoded guess.
 *
 * The previous version of this file used one constant, (0,-1,0), for every
 * joint, on the claim that "every bone in rig.js points down its parent's
 * -Y". That is true of the arm and leg chains but false of the spine chain:
 * BIND's offsets for spine/chest/head are all POSITIVE Y (each sits ABOVE its
 * parent, not below it — hips -> spine is [0, 0.13, 0], spine -> chest is
 * [0, 0.20, 0], chest -> head is [0, 0.26, 0]). Feeding the leg-and-arm
 * direction into the correction for the torso put OUR_DIR and the target
 * bone's own direction anti-parallel for 'chest' on player-rig.glb — a
 * 180-degree case where THREE.Quaternion.setFromUnitVectors has no single
 * correct axis to turn about and picks an arbitrary one — degrading the whole
 * upper body's retarget to a coin flip. The fix: for each joint, point OUR_DIR
 * at whichever of THIS joint's own children BIND lists first (the same "one
 * main direction" a two-bone chain already has); a joint with no BIND child
 * (an arm/leg's endpoint) reuses the direction it arrived from its own
 * parent, since the part drawn past it (rig.js PARTS) continues that way.
 */
const OUR_JOINT_DIR = (() => {
  const firstChildOffset = Object.create(null);
  for (const b of BIND) {
    if (b.parent && !(b.parent in firstChildOffset)) firstChildOffset[b.parent] = b.offset;
  }
  const ownOffset = Object.create(null);
  for (const b of BIND) ownOffset[b.name] = b.offset;

  const dirs = Object.create(null);
  for (const b of BIND) {
    const offset = firstChildOffset[b.name] || ownOffset[b.name];
    const v = new THREE.Vector3(offset[0], offset[1], offset[2]);
    dirs[b.name] = v.lengthSq() > 1e-12 ? v.normalize() : new THREE.Vector3(0, -1, 0);
  }
  return dirs;
})();

/** Fallback for a joint OUR_JOINT_DIR somehow has no entry for. */
const DOWN = new THREE.Vector3(0, -1, 0);

/** Lowercase, and with every separator dropped: `Arm.L_012` -> `arml012`. */
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * A limb joint's bind-pose offset from ITS OWN parent, checked against the
 * length rig.js already gives that same segment in OUR rig, generously
 * multiplied up to absorb real proportion differences between characters.
 *
 * It exists because player-rig.glb's own `FootL` bone sits roughly 3.7 m from
 * its declared parent in the bind pose — an unresolved IK end-effector the
 * exporter left in the skeleton, not a modelling choice, against a shin that
 * is 0.42 m in our own rig. It carries real skin weight (it IS the boot), so
 * nothing upstream flags it as decorative the way a zero-weight control bone
 * does — the only sign is the number, which is why this checks it. A bone
 * this far from its parent gets rotated by our pose exactly like any other,
 * and a shin-length rotation on a lever three metres longer than a shin
 * swings the boot across the pitch. Rejecting it here falls through to the
 * rest of the prefix list, and past that to `missing` — a foot that stays in
 * its bind pose (still carried correctly by the knee above it, since normal
 * FK inheritance is untouched) instead of one that visibly flies off.
 *
 * Torso joints (hips, spine, chest, head) are deliberately NOT checked here.
 * They have no single expected segment length the way a limb does — a rig's
 * own choice of how far the chest sits from whatever it calls its root
 * varies too much between authors to police by a length cap, and on
 * player-rig.glb specifically 'chest' legitimately sits tens of centimetres
 * from 'MASTER' while still being the right, real, skin-weighted bone. The
 * zero-weight-bone problem those joints actually had is caught by BONE_MAP's
 * own prefix ordering (hips before MASTER) instead of by a magnitude check.
 */
const REFERENCE_LENGTH_M = Object.freeze({
  shoulderL: UPPER_ARM_LEN, shoulderR: UPPER_ARM_LEN,
  elbowL: FOREARM_LEN, elbowR: FOREARM_LEN,
  thighL: THIGH_LEN, thighR: THIGH_LEN,
  kneeL: SHIN_LEN, kneeR: SHIN_LEN,
  // no dedicated ankle length in our rig; the shin's is a generous proxy —
  // it is 4x that will reject the artifact either way
  footL: SHIN_LEN, footR: SHIN_LEN,
});
const PLAUSIBLE_MULTIPLE = 4;

function plausibleOffset(jointName, bone) {
  const ref = REFERENCE_LENGTH_M[jointName];
  if (!ref) return true; // no opinion for a joint with no reference length
  const worldScale = new THREE.Vector3();
  bone.getWorldScale(worldScale);
  const scale = (worldScale.x + worldScale.y + worldScale.z) / 3;
  return bone.position.length() * scale <= ref * PLAUSIBLE_MULTIPLE;
}

function findBone(bones, prefixes, jointName) {
  for (const prefix of prefixes) {
    const want = key(prefix);
    // exact first, so `Arm.L` never loses to `Forearm.L`
    const exact = bones.find((b) => key(b.name) === want && plausibleOffset(jointName, b));
    if (exact) return exact;
    const indexed = bones.find((b) => {
      const k = key(b.name);
      return k.startsWith(want) && /^[0-9]+$/.test(k.slice(want.length))
        && plausibleOffset(jointName, b);
    });
    if (indexed) return indexed;
  }
  return null;
}

/**
 * Which way a bone points, in its own local space.
 *
 * A three.js Bone has no length — it is a transform — so its direction is
 * toward its child. A leaf bone (a foot with no toe) has none, and gets the
 * identity correction: nothing downstream depends on it.
 */
function boneDirection(bone) {
  const child = bone.children.find((c) => c.isBone);
  if (!child) return null;
  const v = child.position.clone();
  if (v.lengthSq() < 1e-12) return null;
  return v.normalize();
}

/**
 * Bind a skeleton to our pose vector.
 *
 * @param {THREE.Object3D} root the loaded character
 * @returns {{apply:(pose:Float32Array)=>void, joints:number, missing:string[]}|null}
 */
export function bindRiggedPose(root) {
  // plausibleOffset() reads getWorldScale(), which is only correct once the
  // world matrices have been composed at least once — not guaranteed yet for
  // a mesh that was just loaded or cloned and has not been rendered.
  root.updateMatrixWorld(true);
  const bones = [];
  root.traverse((o) => { if (o.isBone) bones.push(o); });
  if (!bones.length) return null;

  const entries = [];
  const missing = [];
  for (let j = 0; j < JOINTS.length; j++) {
    const name = JOINTS[j];
    const prefixes = BONE_MAP[name];
    if (!prefixes) continue;                      // 'root' is the object itself
    const bone = findBone(bones, prefixes, name);
    if (!bone) { missing.push(name); continue; }

    const theirDir = boneDirection(bone);
    const ourDir = OUR_JOINT_DIR[name] || DOWN;
    const correction = new THREE.Quaternion();
    if (theirDir) correction.setFromUnitVectors(ourDir, theirDir);

    entries.push({
      index: j,
      name,
      bone,
      rest: bone.quaternion.clone(),
      correction,
      inverse: correction.clone().invert(),
    });
  }
  if (!entries.length) return null;

  const euler = new THREE.Euler();
  const delta = new THREE.Quaternion();
  const tmp = new THREE.Quaternion();

  return {
    joints: entries.length,
    missing,
    /** joint name -> the bone actually driving it. Exported so a caller (a
     *  headless test, or the coordinator's browser pass) can measure a world
     *  position rather than trust the correction math by eye. */
    bones: Object.freeze(Object.fromEntries(entries.map((e) => [e.name, e.bone]))),
    /**
     * @param {Float32Array} pose one frame from arena/anim
     */
    apply(pose) {
      for (const e of entries) {
        const base = e.index * CHANNELS_PER_JOINT;
        euler.set(pose[base + CH_RX], pose[base + CH_RY], pose[base + CH_RZ], 'XYZ');
        delta.setFromEuler(euler);
        // C^-1 * delta * C, then onto the bone's own rest orientation
        tmp.copy(e.inverse).multiply(delta).multiply(e.correction);
        e.bone.quaternion.copy(e.rest).multiply(tmp);
      }
    },
    /** Put every driven bone back where the artist left it. */
    reset() {
      for (const e of entries) e.bone.quaternion.copy(e.rest);
    },
  };
}
