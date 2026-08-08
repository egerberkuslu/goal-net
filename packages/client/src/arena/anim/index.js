// arena/anim — the cosmetic animation layer for the deterministic arena.
//
// Feature matrix rows #14 (eight-way locomotion + procedural layers), #15 (the
// keeper set), #16 (kick variants + celebrations) and #17 (shake + goal replay
// camera), against brain/20-tech-spec/animation-standard.md.
//
//   pose.js            the pose vector and the blend primitives
//   clock.js           the local animation clock; stride and breath phase
//   rig.js             bind pose, bone lengths, two-bone analytic IK
//   locomotion.js      the 8 x 3 blend space and the additive layers
//   kicks.js           five kick variants, the windup, slide and stumble
//   keeper.js          stance, shuffle, four dives, get-up, catch, throw, clear
//   celebrations.js    five celebrations, two dejections, derived selection
//   stateMachine.js    the transition graph, its crossfades and its router
//   animator.js        core state -> state request -> layered pose
//   instancedBody.js   ten characters in four draw calls
//   roster.js          the seam ArenaView holds
//   camera.js          impact shake and the goal replay cutaway
//
// THE ONE RULE
//
// .claude/rules and CLAUDE.md both say the cosmetic layer READS core state and
// never writes it. Nothing in this directory imports anything from packages/core
// except CONSTANTS and the pure fnv1a helper, and nothing calls step(), place()
// or setCurve(). A player's pose is derived; it is never a source of truth, and
// deleting this whole directory would change what the match looks like and
// nothing whatsoever about what happens in it.

export {
  CHANNELS, CH_PX, CH_PY, CH_PZ, CH_RX, CH_RY, CH_RZ, JOINTS, JOINT_INDEX,
  addPose, ch, copyPose, createPose, createPosePool, describePose, lerpPose,
  poseDelta, posesEqual, scalePose, zeroPose,
} from './pose.js';

export {
  AnimClock, MAX_DT, RUN_SPEED, WALK_SPEED, angleDelta, approach, gaitBlend,
  strideRate,
} from './clock.js';

export {
  BIND, FOREARM_LEN, HIP_HEIGHT, LEG_LEN, PARTS, PARTS_PER_KEY, PART_KEYS,
  SHIN_LEN, THIGH_LEN, UPPER_ARM_LEN, applyPoseToSkeleton, createIKResult,
  createSkeleton, solveTwoBoneIK,
} from './rig.js';

export {
  ANCHORS, ANCHOR_DIRS, ANCHOR_NAMES, MAX_CHEST_TWIST, MAX_HEAD_TWIST, MAX_LEAN,
  SPEED_TIERS, TAP_DURATION, blendParams, blendWeights, footTarget, layerAim,
  layerBreath, layerLean, layerTap, writeGait,
} from './locomotion.js';

export {
  CURVE_THRESHOLD, DRIVEN_CHARGE, KICKS, KICK_IDS, kickFoot, selectKick,
  writeKick, writeSlide, writeStumble, writeWindup,
} from './kicks.js';

export {
  DIVE_IDS, diveIdOf, writeCatch, writeClearWindup, writeDive, writeGetUp,
  writeShuffle, writeStance, writeThrow,
} from './keeper.js';

export {
  CELEBRATIONS, CELEBRATION_IDS, DEJECTIONS, DEJECTION_IDS, celebrationHash,
  selectCelebration, selectDejection, writeCelebration, writeDejection,
} from './celebrations.js';

export {
  AnimStateMachine, INTERRUPTS, STATES, TRANSITIONS, canTransition, graph,
  route, successors, transitionTime,
} from './stateMachine.js';

export { GOAL_REACTION_SECONDS, PlayerAnimator, poseFromSnapshot } from './animator.js';

export { InstancedBodies, buildPartGeometries, playerPalette } from './instancedBody.js';

export { AnimRoster } from './roster.js';

export {
  ArenaCameraRig, BALL_FIELDS, CAM_MODES, CameraShake, GOAL_WINDOW_SECONDS,
  GoalReplay, JITTER_MAX, PLAYER_FIELDS, REPLAY_BUFFER_SECONDS, REPLAY_DELAY,
  REPLAY_LENGTH, REPLAY_LOOKBACK, REPLAY_RATE, REPLAY_SAMPLE_HZ, SHAKE,
  SHAKE_CUTOFF, SHAKE_DECAY, SHAKE_MAX,
} from './camera.js';
