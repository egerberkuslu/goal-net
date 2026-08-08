// Emit python/layout.json: every number the Python port needs, read straight
// out of the JS modules instead of retyped on the Python side.
//
//   node python/tools/dump-layout.mjs > python/layout.json
//
// Nothing here is authored: if packages/core moves a field, adds a constant or
// renames a preset, this file's output moves with it and the Python port picks
// the change up on the next regeneration. The Python side asserts the shape it
// expects (haxball3d_sim/layout.py), so a layout change that the port has not
// been taught about fails loudly rather than reading the wrong int.

import * as world from '../../packages/core/src/world.js';
import * as rules from '../../packages/core/src/matchRules.js';
import { CONSTANTS, constantsHash, constantsHashInt, TICK_RATE } from '../../packages/core/src/constants.js';
import { CORE_VERSION } from '../../packages/core/src/index.js';
import {
  OBSERVATION_SPEC,
  OBSERVATION_VERSION,
  OBS_SIZE,
  MATE_SLOTS,
  OPP_SLOTS,
  ENTITY_STRIDE,
} from '../../packages/bots/src/observation.js';
import { PITCH, SPEED, PITCH_DIAG } from '../../packages/bots/src/layout.js';
import {
  DISCRETE_ACTIONS,
  DISCRETE_SIZE,
  DIRECTIONS,
  BUTTONS,
  ACTION_VERSION,
  DEADZONE,
} from '../../packages/bots/src/action.js';

const hdr = {};
for (const [k, v] of Object.entries(world)) {
  if (k.startsWith('HDR_') && typeof v === 'number') hdr[k] = v;
}

const presets = rules.PITCH_PRESETS.map((p) =>
  p === null
    ? null
    : {
        code: p.code,
        id: p.id,
        label: p.label,
        scaleNum: p.scaleNum,
        scaleDen: p.scaleDen,
        halfX: p.halfX,
        halfZ: p.halfZ,
        goalHalfX: p.goalHalfX,
        penaltyHalfX: p.penaltyHalfX,
        penaltyDepth: p.penaltyDepth,
        spawnZ: p.spawnZ,
        spawnXStep: p.spawnXStep,
        keeperGuardZ: p.keeperGuardZ,
      },
);

const out = {
  generatedBy: 'python/tools/dump-layout.mjs',
  coreVersion: CORE_VERSION,
  stateMagic: world.STATE_MAGIC,
  stateVersion: world.STATE_VERSION,
  constantsHash,
  constantsHashInt,
  tickRate: TICK_RATE,
  header: { ...hdr, HDR_LEN: world.HDR_LEN },
  ballBase: world.BALL_BASE,
  ballLen: world.BALL_LEN,
  playerBase: world.PLAYER_BASE,
  playerStride: world.PLAYER_STRIDE,
  field: { ...world.FIELD },
  buttons: { ...world.BTN },
  constants: { ...CONSTANTS },
  pitchPresets: presets,
  settings: {
    default: { ...rules.DEFAULT_SETTINGS },
    words: rules.SETTINGS_WORDS,
    ruleGoldenGoal: rules.RULE_GOLDEN_GOAL,
    ruleMercy: rules.RULE_MERCY,
    ruleKeepers: rules.RULE_KEEPERS,
    mercyGoalDiff: rules.MERCY_GOAL_DIFF,
    minDurationSeconds: rules.MIN_DURATION_SECONDS,
    maxDurationSeconds: rules.MAX_DURATION_SECONDS,
    minScoreLimit: rules.MIN_SCORE_LIMIT,
    maxScoreLimit: rules.MAX_SCORE_LIMIT,
    matchRunning: rules.MATCH_RUNNING,
    matchGoldenGoal: rules.MATCH_GOLDEN_GOAL,
    matchFinished: rules.MATCH_FINISHED,
    endNone: rules.END_NONE,
    endFullTime: rules.END_FULL_TIME,
    endScoreLimit: rules.END_SCORE_LIMIT,
    endMercy: rules.END_MERCY,
    endGoldenGoal: rules.END_GOLDEN_GOAL,
  },
  observation: {
    version: OBSERVATION_VERSION,
    size: OBS_SIZE,
    mateSlots: MATE_SLOTS,
    oppSlots: OPP_SLOTS,
    entityStride: ENTITY_STRIDE,
    speedPlayer: SPEED.PLAYER,
    speedBall: SPEED.BALL,
    pitchDiag: PITCH_DIAG,
    pitch: { ...PITCH },
    spec: OBSERVATION_SPEC.map((f) => ({ index: f.index, name: f.name, lo: f.lo, hi: f.hi, desc: f.desc })),
  },
  action: {
    version: ACTION_VERSION,
    discreteSize: DISCRETE_SIZE,
    deadzone: DEADZONE,
    buttons: [...BUTTONS],
    directions: DIRECTIONS.map((d) => ({ name: d.name, x: d.x, z: d.z })),
    discrete: DISCRETE_ACTIONS.map((a) => ({
      index: a.index,
      label: a.label,
      moveX: a.moveX,
      moveZ: a.moveZ,
      kick: a.kick,
    })),
  },
};

process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
