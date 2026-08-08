// @goalnet/core — deterministic fixed-point football simulation.
//
// DOM-free, side-effect-free, no Math.random, no Date/performance reads. The
// module graph is fx.js -> constants.js/checksum.js -> world.js -> here, and
// nothing below this file imports anything outside packages/core.
//
//   import { createWorld, step, checksum } from '@goalnet/core';
//   const world = createWorld({ players: [{ team: 0, role: 'keeper' }, { team: 1 }] });
//   step(world, [{ moveX: 1, moveZ: 0, kick: false }, null]);
//   checksum(world); // "1a2b3c4d"
//
// Input shape (per player, all optional)
//   moveX/moveZ  float axes, or moveXFx/moveZFx if already quantised
//   kick         instant ground pass, full impulse, no spin
//   charge       hold to charge a shot, release to fire (0.3x -> 1x)
//   chargeCancel drop a charge without firing
//   tackle       slide
//   catchBall / throwBall / clearBall / dive   keeper only, own box only
//   buttons      the same eight as a pre-packed BTN bitmask, for the wire
//
// Determinism contract
//   * identical config + identical quantised input sequence => identical
//     checksum chain, on any engine, in any process, forever
//   * serialize()/deserialize() round-trips exactly; a run resumed from a
//     snapshot continues the same chain
//   * constantsHash pins the physics table; a snapshot or replay carrying a
//     different hash is rejected loudly rather than desyncing quietly

export {
  createWorld,
  step,
  checksum,
  serialize,
  deserialize,
  resetKickoff,
  readState,
  place,
  setCurve,
  quantiseInput,
  quantiseAxis,
  stateLength,
  playerOffset,
  controlAdvice,
  chargePower,
  inPenaltyArea,
  keeperEmpowered,
  BTN,
  STATE_MAGIC,
  STATE_VERSION,
  HDR_TICK,
  HDR_PLAYER_COUNT,
  HDR_SCORE_0,
  HDR_SCORE_1,
  HDR_BALL_HOLDER,
  HDR_BALL_HOLD_TICKS,
  HDR_BALL_CURVE,
  HDR_AFTERTOUCH_OWNER,
  HDR_AFTERTOUCH_TICKS,
  HDR_GRIEF_TEAM,
  HDR_GRIEF_TICKS,
  HDR_LEN,
  BALL_BASE,
  PLAYER_BASE,
  PLAYER_STRIDE,
  FIELD,
} from './world.js';

export {
  CONSTANTS,
  constantsHash,
  constantsHashInt,
  hashConstants,
  serializeConstants,
  TICK_RATE,
} from './constants.js';

export { checksumInts, fnv1aInts, fnv1aString, toHex32 } from './checksum.js';

export * as fx from './fx.js';

export const CORE_VERSION = '0.1.0';
