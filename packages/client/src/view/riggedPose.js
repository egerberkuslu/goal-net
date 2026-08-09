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
// Two rigs never agree on bone axes. Ours is authored so every bone points
// along -Y from its parent (rig.js BIND). A downloaded rig points its bones
// wherever its author's software did. Applying our rotations straight onto
// their bones therefore bends the right leg sideways and twists the head.
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
 */
const BONE_MAP = Object.freeze({
  hips: ['MASTER', 'Hips', 'mixamorig:Hips'],
  spine: ['Spine', 'Hips'],
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

/** Our bind direction: every bone in rig.js points down its parent's -Y. */
const OUR_DIR = new THREE.Vector3(0, -1, 0);

/** Lowercase, and with every separator dropped: `Arm.L_012` -> `arml012`. */
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function findBone(bones, prefixes) {
  for (const prefix of prefixes) {
    const want = key(prefix);
    // exact first, so `Arm.L` never loses to `Forearm.L`
    const exact = bones.find((b) => key(b.name) === want);
    if (exact) return exact;
    const indexed = bones.find((b) => {
      const k = key(b.name);
      return k.startsWith(want) && /^[0-9]+$/.test(k.slice(want.length));
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
  const bones = [];
  root.traverse((o) => { if (o.isBone) bones.push(o); });
  if (!bones.length) return null;

  const entries = [];
  const missing = [];
  for (let j = 0; j < JOINTS.length; j++) {
    const name = JOINTS[j];
    const prefixes = BONE_MAP[name];
    if (!prefixes) continue;                      // 'root' is the object itself
    const bone = findBone(bones, prefixes);
    if (!bone) { missing.push(name); continue; }

    const theirDir = boneDirection(bone);
    const correction = new THREE.Quaternion();
    if (theirDir) correction.setFromUnitVectors(OUR_DIR, theirDir);

    entries.push({
      index: j,
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
