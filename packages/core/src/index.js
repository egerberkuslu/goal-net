// @goalnet/core — deterministic fixed-point football simulation.
//
// DOM-free, side-effect-free, no Math.random, no Date/performance reads. The
// module graph is fx.js -> constants.js/checksum.js -> world.js -> here, and
// nothing below this file imports anything outside packages/core.
//
//   import { createWorld, step, checksum } from '@goalnet/core';
//   const world = createWorld({ playerCount: 2 });
//   step(world, [{ moveX: 1, moveZ: 0, kick: false }, null]);
//   checksum(world); // "1a2b3c4d"
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
  quantiseInput,
  quantiseAxis,
  stateLength,
  playerOffset,
  STATE_MAGIC,
  STATE_VERSION,
  HDR_TICK,
  HDR_PLAYER_COUNT,
  HDR_SCORE_0,
  HDR_SCORE_1,
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
