// @goalnet/bots — one observe -> act interface, two brains behind it.
//
// Feature matrix row 20 (Phase 1.5): "scripted and ONNX bots share the same
// observe -> action interface". This package is that interface plus the two
// implementations. It depends on @goalnet/core for the state layout and the
// physics constants, on nothing else, and it holds no state of its own beyond
// what a policy owns.
//
//   observation.js  world -> Float32Array(100), documented and bounded
//   action.js       policy output -> { moveX, moveZ, kick } for the core
//   policy.js       the BotPolicy contract, the seeded PRNG, the host adapter
//   scripted.js     the ai.js heuristics, in kolay / orta / zor
//   onnxPolicy.js   the same contract over an injected ONNX runtime
//   layout.js       the ONLY place the core state layout is known
//
// -------------------------------------------------------------- host wiring
//
// Bots run on the host and only on the host (see the netcode invariant: a peer
// authors input axes and a kick bit, nothing else, so a bot on a peer would be
// a bot nobody can trust). createHostSession already has the single call site;
// makeBotPolicy fills it.
//
//   import { createHostSession } from '@goalnet/net';
//   import { createScriptedPolicy, makeBotPolicy } from '@goalnet/bots';
//
//   const host = createHostSession({
//     playerCount: 4,
//     hostPlayerId: 0,
//     botSlots: [2, 3],
//     botPolicy: makeBotPolicy({
//       policies: {
//         2: createScriptedPolicy({ difficulty: 'zor', seed: 1337 }),
//         3: createScriptedPolicy({ difficulty: 'kolay', seed: 1337 }),
//       },
//       roles: { 3: 'keeper' },
//       seed: 1337,
//     }),
//   });
//
// Swapping in a trained checkpoint changes the policy and nothing else. Note
// the factory: a BotPolicy owns per-tick state, so every slot gets its own.
//
//   botPolicy: makeBotPolicy({
//     policy: (slot) => createOnnxPolicy({
//       difficulty: 'zor',
//       runtime: workerRuntime,           // see onnxPolicy.js, Phase 2 wiring
//       modelBytes: modelBytes,           // fetched once, shared by every slot
//       head: 'discrete',
//       fallback: createScriptedPolicy({ difficulty: 'zor', seed: 1337 + slot }),
//     }),
//     seed: 1337,
//   });
//
// The seed is what makes a bot match reproducible: given the same seed and the
// same human inputs, the same goals happen. Put it in the replay header.

export {
  observe,
  OBSERVATION_SPEC,
  OBSERVATION_VERSION,
  OBS,
  OBS_SIZE,
  MATE_SLOTS,
  OPP_SLOTS,
  ENTITY_STRIDE,
  buildObservationSpec,
  indexMap,
  checkBounds,
  specTable,
} from './observation.js';

export {
  ACTION_VERSION,
  BUTTONS,
  DIRECTIONS,
  DISCRETE_ACTIONS,
  DISCRETE_SIZE,
  DISCRETE_MODIFIERS,
  CONTINUOUS_SIZE,
  CONTINUOUS_LAYOUT,
  DEADZONE,
  argmax,
  decodeAction,
  decodeDiscrete,
  encodeDiscrete,
  decodeContinuous,
  encodeContinuous,
  egoToWorld,
  worldToEgo,
  toCoreInput,
  neutralAction,
  normaliseAction,
  actionsEqual,
} from './action.js';

export {
  DIFFICULTIES,
  normaliseDifficulty,
  makePrng,
  seedFor,
  assertPolicy,
  assertAction,
  createBotRunner,
  makeBotPolicy,
} from './policy.js';

export { createScriptedPolicy, createScriptedTiers, TIERS } from './scripted.js';

export {
  createOnnxPolicy,
  probeThreads,
  DEFAULT_DECISION_EVERY,
  OBSERVATION_DELAY_TICKS,
} from './onnxPolicy.js';

export {
  PITCH,
  PITCH_DIAG,
  SPEED,
  SLOT,
  AVAILABLE,
  attackSignOf,
  createScene,
  readScene,
} from './layout.js';

export const BOTS_VERSION = '0.1.0';
