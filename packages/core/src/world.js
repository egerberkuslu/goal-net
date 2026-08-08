// Deterministic 2D pitch simulation, 60 Hz fixed timestep.
//
// Scope of THIS core (Phase 1.1 base + Phase 1.2 rows 7-11)
//   in  : players and ball on the (x, z) plane, circle-circle and circle-wall
//         collisions with bCoef/invMass, kick as an added impulse, goal posts,
//         goal detection, kickoff reset, per-tick checksum, close-control
//         support for pure-physics dribbling, shot charge, ball curve with
//         aftertouch, slide tackles, the fixed-role keeper (catch, hand throw,
//         foot clearance, four-way dive, own-goal grief lock), the three pitch
//         presets, and the match-ending rules (full time, score limit, golden
//         goal, mercy rule).
//   out : anything with height (aerial ball, jumps, headers), full Magnus and
//         visual spin, bots, fouls, halves, stats. Those are later phases and
//         they land on top of this state, not beside it. Aerial motion in
//         particular is deliberately absent: the LOCKED constants in
//         physics-constants.md describe the 2D base, and adding a y axis before
//         those are proven would change the numbers being validated.
//
// Everything lives in one Int32Array so the checksum is a straight linear walk
// with no field-ordering ambiguity, and so serialise/deserialise is a copy.
//
// Layout (all values Q16.16 raw unless noted)
//   header  0  MAGIC              (plain int)
//           1  VERSION            (plain int)
//           2  constantsHash low  (plain int)
//           3  tick               (plain int)
//           4  playerCount        (plain int)
//           5  scoreTeam0         (plain int)
//           6  scoreTeam1         (plain int)
//           7  lastGoalTeam       (plain int, -1 = none)
//           8  lastGoalTick       (plain int, -1 = none)
//           9  kickoffTeam        (plain int, team that restarts play)
//          10  ballHolder         (plain int, keeper index or -1)
//          11  ballHoldTicks      (plain int, counts down to a forced release)
//          12  ballCurve          (Q16.16 signed scalar — the ONLY spin state)
//          13  aftertouchOwner    (plain int, player index or -1)
//          14  aftertouchTicks    (plain int)
//          15  griefTeam          (plain int, team whose own goal is void, -1)
//          16  griefTicks         (plain int)
//          17  pitchPreset        (plain int, 1..3 — NEVER 0, see matchRules.js)
//          18  settingsHash low   (plain int)
//          19  durationTicks      (plain int, 0 = untimed)
//          20  scoreLimit         (plain int, 0 = none)
//          21  ruleFlags          (plain int bitfield: golden goal, mercy, keepers)
//          22  matchState         (plain int: 0 running, 1 golden goal, 2 finished)
//          23  endReason          (plain int, see END_* in matchRules.js)
//          24..31 reserved
//   ball   32  x  33 z  34 vx  35 vz
//   player 36 + i*22: see the P_* table below
//
// Words 17..23 are the room settings, not physics. They are hashed into
// settingsHash rather than constantsHash, and deserialize() refuses a snapshot
// whose settings do not match the ones the caller expects — a big-pitch
// snapshot applied on a small pitch would place the ball outside the walls.

import {
  FX_ONE,
  fxAbs,
  fxAdd,
  fxDiv,
  fxHypot,
  fxMul,
  fxNeg,
  fxSub,
  fxSqrt,
  fxFromInt,
  fxFromNumber,
  fxNormalize,
} from './fx.js';
import { CONSTANTS, constantsHashInt } from './constants.js';
import { checksumInts } from './checksum.js';
import {
  DEFAULT_PITCH,
  END_FULL_TIME,
  END_GOLDEN_GOAL,
  END_MERCY,
  END_NONE,
  END_SCORE_LIMIT,
  MATCH_FINISHED,
  MATCH_GOLDEN_GOAL,
  MATCH_RUNNING,
  MERCY_GOAL_DIFF,
  PITCH_PRESETS,
  RULE_GOLDEN_GOAL,
  RULE_KEEPERS,
  RULE_MERCY,
  SettingsError,
  assertSameSettings,
  durationTicks,
  endReasonName,
  leaderOf,
  matchPhaseName,
  normaliseSettings,
  pitchCodeOf,
  settingsFlags,
  settingsFrom,
  settingsHashInt,
} from './matchRules.js';

export const STATE_MAGIC = 0x474e4331; // "GNC1"
// v3 = Phase 1.7a layout: the header now carries the room settings (pitch
// preset, clock, score limit, rule flags, match phase). A v2 snapshot has a
// shorter header and no notion of which arena it was recorded on, so it is
// rejected rather than reinterpreted on whatever pitch happens to be loaded.
export const STATE_VERSION = 3;

export const HDR_MAGIC = 0;
export const HDR_VERSION = 1;
export const HDR_CONST_HASH = 2;
export const HDR_TICK = 3;
export const HDR_PLAYER_COUNT = 4;
export const HDR_SCORE_0 = 5;
export const HDR_SCORE_1 = 6;
export const HDR_LAST_GOAL_TEAM = 7;
export const HDR_LAST_GOAL_TICK = 8;
export const HDR_KICKOFF_TEAM = 9;
export const HDR_BALL_HOLDER = 10;
export const HDR_BALL_HOLD_TICKS = 11;
export const HDR_BALL_CURVE = 12;
export const HDR_AFTERTOUCH_OWNER = 13;
export const HDR_AFTERTOUCH_TICKS = 14;
export const HDR_GRIEF_TEAM = 15;
export const HDR_GRIEF_TICKS = 16;
export const HDR_PITCH = 17;
export const HDR_SETTINGS_HASH = 18;
export const HDR_DURATION_TICKS = 19;
export const HDR_SCORE_LIMIT = 20;
export const HDR_RULE_FLAGS = 21;
export const HDR_MATCH_STATE = 22;
export const HDR_END_REASON = 23;
export const HDR_LEN = 32;

export const BALL_BASE = HDR_LEN;
export const BALL_LEN = 4;
export const PLAYER_BASE = BALL_BASE + BALL_LEN;
export const PLAYER_STRIDE = 22;

const P_X = 0;
const P_Z = 1;
const P_VX = 2;
const P_VZ = 3;
const P_TEAM = 4;
const P_KICK_ARM = 5;
const P_KICK_CD = 6;
const P_PREV_BUTTONS = 7; // bit 0 is the old P_PREV_KICK
const P_ROLE = 8; // 0 field player, 1 keeper — fixed for the match (ADR-0001)
const P_CHARGE = 9; // ticks the shot button has been held, 0 = not charging
const P_CHARGE_REL = 10; // ticks left of the release buffer
const P_CHARGE_PWR = 11; // Q16.16 power captured when the button came up
const P_TACKLE_ACTIVE = 12;
const P_TACKLE_RECOV = 13;
const P_TACKLE_CD = 14;
const P_DIVE_ACTIVE = 15;
const P_DIVE_LOCK = 16; // grounded after a whiff
const P_DIVE_DIR = 17; // 0 -x, 1 +x, 2 -z, 3 +z
const P_CLEAR_CHARGE = 18; // ticks the foot-clearance button has been held
const P_FLAGS = 19;
const P_TOUCH_CD = 20; // close-control touch cooldown
// index 21 is spare so the stride can absorb one more field without a reshuffle

const FLAG_TOUCHING = 1; // was overlapping the ball at the end of last tick
const FLAG_TACKLE_HELD = 2; // the tackle button was down last tick
const FLAG_DIVE_HELD = 4; // the dive button was down last tick

/** Button bits. One int on the wire, one int in the state's edge detector. */
export const BTN = Object.freeze({
  KICK: 1, //   instant pass: full impulse, ground ball, curve forced to 0
  CHARGE: 2, //   hold to charge a shot, release to fire
  CANCEL: 4, //   drop the charge without firing
  TACKLE: 8, //   slide
  CATCH: 16, //  keeper: pin the ball (inside its own area only)
  THROW: 32, //  keeper: hand throw — straight, medium, no curve
  CLEAR: 64, //  keeper: foot clearance — hold to charge, long, curvable
  DIVE: 128, //  keeper: four-way dive, direction from the move axis
  TOUCH: 256, //  close control: the small corrective kick, ~7% of a full kick
});
const BTN_MASK = 511;

const C = CONSTANTS;
const REACH = C.PLAYER_RADIUS + C.BALL_RADIUS;

/**
 * The arena this state was built on. Read from the header every time rather
 * than cached on the world object, so a world handed around as a plain
 * `{ buf, playerCount }` can never end up simulating on the wrong pitch.
 *
 * Code 0 is not a preset: an uninitialised buffer fails here instead of
 * silently becoming the small pitch.
 */
export function pitchOf(world) {
  const buf = world && world.buf ? world.buf : world;
  const preset = PITCH_PRESETS[buf[HDR_PITCH]];
  if (!preset) {
    throw new SettingsError(
      'bad-pitch',
      `state carries pitch preset ${buf[HDR_PITCH]}, which is not one of 1..3`,
    );
  }
  return preset;
}

export function stateLength(playerCount) {
  return PLAYER_BASE + playerCount * PLAYER_STRIDE;
}

export function playerOffset(i) {
  return PLAYER_BASE + i * PLAYER_STRIDE;
}

// ------------------------------------------------------------------ setup

function roleOf(spec) {
  if (spec === 1 || spec === true) return 1;
  if (spec === 'keeper' || spec === 'gk' || spec === 'goalkeeper') return 1;
  return 0;
}

/**
 * createWorld({ players: [{ team, role }], teams: [0,1,...], roles: [...],
 *               playerCount, settings })
 *
 * `players` wins if given; otherwise `teams`; otherwise playerCount players are
 * dealt alternately to team 0 and team 1. Roles are fixed here and nowhere else:
 * ADR-0001 says the keeper is chosen at match start and never reassigned, so the
 * core deliberately offers no mid-match setter.
 *
 * `settings` is a MatchSettings (see matchRules.js) and is normalised on the way
 * in, so a raw lobby object straight off the wire is safe to pass. It decides
 * the arena, the clock, the score limit and the two match-ending rules, and it
 * is written into the state header so a snapshot is self-describing.
 *
 * `settings.keepers === false` strips every keeper role: an off switch that
 * changes the roles at match start is the only form ADR-0001 allows.
 */
export function createWorld(config = {}) {
  const settings = normaliseSettings(config.settings, config.strictSettings ? { strict: true } : {});
  let teams;
  let roles;
  if (Array.isArray(config.players)) {
    teams = config.players.map((p) => (p && p.team ? 1 : 0));
    roles = config.players.map((p) => roleOf(p && p.role));
  } else if (Array.isArray(config.teams)) {
    teams = config.teams.map((t) => (t ? 1 : 0));
    roles = teams.map((_, i) =>
      Array.isArray(config.roles) ? roleOf(config.roles[i]) : 0,
    );
  } else {
    const n = config.playerCount == null ? 2 : config.playerCount | 0;
    teams = [];
    for (let i = 0; i < n; i++) teams.push(i % 2);
    roles = teams.map((_, i) =>
      Array.isArray(config.roles) ? roleOf(config.roles[i]) : 0,
    );
  }
  if (teams.length < 1 || teams.length > C.MAX_PLAYERS) {
    throw new RangeError(
      `player count ${teams.length} outside 1..${C.MAX_PLAYERS}`,
    );
  }
  if (!settings.keepers) roles = roles.map(() => 0);

  const buf = new Int32Array(stateLength(teams.length));
  buf[HDR_MAGIC] = STATE_MAGIC;
  buf[HDR_VERSION] = STATE_VERSION;
  buf[HDR_CONST_HASH] = constantsHashInt;
  buf[HDR_TICK] = 0;
  buf[HDR_PLAYER_COUNT] = teams.length;
  buf[HDR_SCORE_0] = 0;
  buf[HDR_SCORE_1] = 0;
  buf[HDR_LAST_GOAL_TEAM] = -1;
  buf[HDR_LAST_GOAL_TICK] = -1;
  buf[HDR_KICKOFF_TEAM] = 0;
  buf[HDR_PITCH] = pitchCodeOf(settings.pitch);
  buf[HDR_SETTINGS_HASH] = settingsHashInt(settings);
  buf[HDR_DURATION_TICKS] = durationTicks(settings);
  buf[HDR_SCORE_LIMIT] = settings.scoreLimit;
  buf[HDR_RULE_FLAGS] = settingsFlags(settings);
  buf[HDR_MATCH_STATE] = MATCH_RUNNING;
  buf[HDR_END_REASON] = END_NONE;

  for (let i = 0; i < teams.length; i++) {
    buf[playerOffset(i) + P_TEAM] = teams[i];
    buf[playerOffset(i) + P_ROLE] = roles[i];
  }
  const world = { buf, playerCount: teams.length };
  resetKickoff(world);
  return world;
}

/** Ball to the centre spot, players to their side, every timer to zero. */
export function resetKickoff(world) {
  const { buf } = world;
  const P = pitchOf(buf);
  const halfSpawnStep = P.spawnXStep / 2; // spawnXStep is even on every preset
  buf[BALL_BASE] = 0;
  buf[BALL_BASE + 1] = 0;
  buf[BALL_BASE + 2] = 0;
  buf[BALL_BASE + 3] = 0;
  buf[HDR_BALL_HOLDER] = -1;
  buf[HDR_BALL_HOLD_TICKS] = 0;
  buf[HDR_BALL_CURVE] = 0;
  buf[HDR_AFTERTOUCH_OWNER] = -1;
  buf[HDR_AFTERTOUCH_TICKS] = 0;
  buf[HDR_GRIEF_TEAM] = -1;
  buf[HDR_GRIEF_TICKS] = 0;

  // Lateral slots are handed out per team so a 2v2 and a 1v3 both look sane.
  const seen = [0, 0];
  const total = [0, 0];
  for (let i = 0; i < world.playerCount; i++) {
    total[buf[playerOffset(i) + P_TEAM]]++;
  }
  for (let i = 0; i < world.playerCount; i++) {
    const o = playerOffset(i);
    const team = buf[o + P_TEAM];
    const slot = seen[team]++;
    const n = total[team];
    buf[o + P_X] = (2 * slot - (n - 1)) * halfSpawnStep;
    buf[o + P_Z] = team === 0 ? -P.spawnZ : P.spawnZ;
    buf[o + P_VX] = 0;
    buf[o + P_VZ] = 0;
    buf[o + P_KICK_ARM] = 0;
    buf[o + P_KICK_CD] = 0;
    buf[o + P_PREV_BUTTONS] = 0;
    buf[o + P_CHARGE] = 0;
    buf[o + P_CHARGE_REL] = 0;
    buf[o + P_CHARGE_PWR] = 0;
    buf[o + P_TACKLE_ACTIVE] = 0;
    buf[o + P_TACKLE_RECOV] = 0;
    buf[o + P_TACKLE_CD] = 0;
    buf[o + P_DIVE_ACTIVE] = 0;
    buf[o + P_DIVE_LOCK] = 0;
    buf[o + P_DIVE_DIR] = 0;
    buf[o + P_CLEAR_CHARGE] = 0;
    buf[o + P_FLAGS] = 0;
    buf[o + P_TOUCH_CD] = 0;
    // P_TEAM and P_ROLE survive a restart on purpose (ADR-0001).
  }
}

// ------------------------------------------------------------------ input

/**
 * Quantise a float axis in [-1, 1] to Q16.16. This and fxFromNumber are the
 * only float doors into the tick; replays and the wire protocol should carry
 * the quantised integers, not the floats they came from.
 */
export function quantiseAxis(v) {
  if (!Number.isFinite(v)) return 0;
  let q = Math.round(v * FX_ONE);
  if (q > FX_ONE) q = FX_ONE;
  if (q < -FX_ONE) q = -FX_ONE;
  return q | 0;
}

/**
 * Normalise one player's input into `{ mx, mz, kick, buttons }` with mx/mz
 * already fixed-point and clamped to unit length. Accepts either floats
 * (moveX/moveZ) or pre-quantised integers (moveXFx/moveZFx), and either a
 * ready-made `buttons` bitmask or the named booleans.
 */
export function quantiseInput(input) {
  if (!input) return { mx: 0, mz: 0, kick: 0, buttons: 0 };
  let mx =
    input.moveXFx != null ? input.moveXFx | 0 : quantiseAxis(input.moveX || 0);
  let mz =
    input.moveZFx != null ? input.moveZFx | 0 : quantiseAxis(input.moveZ || 0);
  const len = fxHypot(mx, mz);
  if (len > FX_ONE) {
    mx = fxDiv(mx, len);
    mz = fxDiv(mz, len);
  }
  let buttons = (input.buttons | 0) & BTN_MASK;
  if (input.kick) buttons |= BTN.KICK;
  if (input.charge) buttons |= BTN.CHARGE;
  if (input.chargeCancel) buttons |= BTN.CANCEL;
  if (input.tackle) buttons |= BTN.TACKLE;
  if (input.catchBall) buttons |= BTN.CATCH;
  if (input.throwBall) buttons |= BTN.THROW;
  if (input.clearBall) buttons |= BTN.CLEAR;
  if (input.dive) buttons |= BTN.DIVE;
  if (input.touch) buttons |= BTN.TOUCH;
  return { mx, mz, kick: buttons & BTN.KICK ? 1 : 0, buttons };
}

// ------------------------------------------------------------- collisions

/**
 * Elastic response between two discs held at offsets ao/bo (each laying out
 * x, z, vx, vz consecutively). invMass 0 means "immovable".
 *
 * Restitution combines multiplicatively (bCoefA * bCoefB), the Haxball
 * convention: two 0.5 bodies give a soft 0.25 bounce, a 0.5 body against a
 * 1.0 wall keeps its own 0.5.
 */
function resolveDiscs(buf, ao, bo, ra, rb, ia, ib, bcoef) {
  const dx = fxSub(buf[bo + P_X], buf[ao + P_X]);
  const dz = fxSub(buf[bo + P_Z], buf[ao + P_Z]);
  const rsum = ra + rb;
  let dist = fxHypot(dx, dz);
  if (dist >= rsum) return false;

  let nx;
  let nz;
  if (dist === 0) {
    // Perfectly stacked centres have no normal; pick +x so the tie is broken
    // the same way on every machine instead of by whatever came first.
    nx = FX_ONE;
    nz = 0;
    dist = 0;
  } else {
    nx = fxDiv(dx, dist);
    nz = fxDiv(dz, dist);
  }

  const isum = ia + ib;
  if (isum <= 0) return false;

  const overlap = rsum - dist;
  const sa = fxMul(overlap, fxDiv(ia, isum));
  const sb = fxMul(overlap, fxDiv(ib, isum));
  buf[ao + P_X] = fxSub(buf[ao + P_X], fxMul(nx, sa));
  buf[ao + P_Z] = fxSub(buf[ao + P_Z], fxMul(nz, sa));
  buf[bo + P_X] = fxAdd(buf[bo + P_X], fxMul(nx, sb));
  buf[bo + P_Z] = fxAdd(buf[bo + P_Z], fxMul(nz, sb));

  const rvx = fxSub(buf[bo + P_VX], buf[ao + P_VX]);
  const rvz = fxSub(buf[bo + P_VZ], buf[ao + P_VZ]);
  const vn = fxAdd(fxMul(rvx, nx), fxMul(rvz, nz));
  if (vn < 0) {
    const j = fxDiv(fxMul(fxNeg(fxAdd(FX_ONE, bcoef)), vn), isum);
    const ja = fxMul(j, ia);
    const jb = fxMul(j, ib);
    buf[ao + P_VX] = fxSub(buf[ao + P_VX], fxMul(nx, ja));
    buf[ao + P_VZ] = fxSub(buf[ao + P_VZ], fxMul(nz, ja));
    buf[bo + P_VX] = fxAdd(buf[bo + P_VX], fxMul(nx, jb));
    buf[bo + P_VZ] = fxAdd(buf[bo + P_VZ], fxMul(nz, jb));
  }
  return true;
}

/** Disc against a static post centred at (px, pz). */
function resolvePost(buf, o, r, invMass, bcoef, px, pz, pr) {
  const dx = fxSub(px, buf[o + P_X]);
  const dz = fxSub(pz, buf[o + P_Z]);
  const rsum = r + pr;
  let dist = fxHypot(dx, dz);
  if (dist >= rsum) return false;
  let nx;
  let nz;
  if (dist === 0) {
    nx = FX_ONE;
    nz = 0;
    dist = 0;
  } else {
    nx = fxDiv(dx, dist);
    nz = fxDiv(dz, dist);
  }
  const overlap = rsum - dist;
  buf[o + P_X] = fxSub(buf[o + P_X], fxMul(nx, overlap));
  buf[o + P_Z] = fxSub(buf[o + P_Z], fxMul(nz, overlap));
  const vn = fxAdd(fxMul(buf[o + P_VX], nx), fxMul(buf[o + P_VZ], nz));
  if (vn > 0) {
    const k = fxMul(fxAdd(FX_ONE, bcoef), vn);
    buf[o + P_VX] = fxSub(buf[o + P_VX], fxMul(nx, k));
    buf[o + P_VZ] = fxSub(buf[o + P_VZ], fxMul(nz, k));
  }
  return true;
}

/**
 * Keep a disc inside +/-limit on one axis. `ai` is P_X or P_Z; the matching
 * velocity slot is always two ints further on.
 */
function resolveWall(buf, o, r, ai, limit, bcoef) {
  const hi = limit - r;
  const p = buf[o + ai];
  if (p > hi) {
    buf[o + ai] = hi;
    const v = buf[o + ai + 2];
    if (v > 0) buf[o + ai + 2] = fxNeg(fxMul(v, bcoef));
    return true;
  }
  if (p < -hi) {
    buf[o + ai] = -hi;
    const v = buf[o + ai + 2];
    if (v < 0) buf[o + ai + 2] = fxNeg(fxMul(v, bcoef));
    return true;
  }
  return false;
}

// ------------------------------------------------------------- geometry

/** Squared-free centre distance from player i to the ball, raw units. */
function ballDistance(buf, o) {
  return fxHypot(
    fxSub(buf[BALL_BASE], buf[o + P_X]),
    fxSub(buf[BALL_BASE + 1], buf[o + P_Z]),
  );
}

/** Unit vector player -> ball into out[]; (+x, 0) when the centres coincide. */
function ballDirection(buf, o, out) {
  const dx = fxSub(buf[BALL_BASE], buf[o + P_X]);
  const dz = fxSub(buf[BALL_BASE + 1], buf[o + P_Z]);
  if (fxNormalize(dx, dz, out) === 0) {
    out[0] = FX_ONE;
    out[1] = 0;
  }
}

/**
 * Where the player is pointing: the movement stick if it is pushed, otherwise
 * straight at the opponents' goal. Never zero, so every impulse has a direction.
 */
function aimDirection(mx, mz, team, out) {
  if ((mx !== 0 || mz !== 0) && fxNormalize(mx, mz, out) !== 0) return;
  out[0] = 0;
  out[1] = team === 0 ? FX_ONE : -FX_ONE; // team 0 defends -z, attacks +z
}

/**
 * Is (x, z) inside `team`'s own penalty area? `pitch` is a preset from
 * matchRules.js; it defaults to the medium preset so a caller that has no world
 * in hand still gets the Phase 1.2 geometry it used to get.
 */
export function inPenaltyArea(x, z, team, pitch = DEFAULT_PITCH) {
  if (fxAbs(x) > pitch.penaltyHalfX) return false;
  const edge = pitch.halfZ - pitch.penaltyDepth;
  return team === 0 ? z <= -edge : z >= edge;
}

/**
 * A keeper's hand powers (catch, throw, clearance, dive) exist only inside its
 * own box; outside it the keeper is an ordinary field player. Host-side truth,
 * so a client cannot claim a catch it was never entitled to.
 */
export function keeperEmpowered(world, i, pitch = pitchOf(world)) {
  const buf = world.buf;
  const o = playerOffset(i);
  if (buf[o + P_ROLE] !== 1) return false;
  return inPenaltyArea(buf[o + P_X], buf[o + P_Z], buf[o + P_TEAM], pitch);
}

// ------------------------------------------------------------ close control

/**
 * The CMU-RoboCup close-control predicate, exposed so bots, the tuning harness
 * and the client all ask the same deterministic question: "if I move this way,
 * will the ball still be mine next tick?".
 *
 * It reads state and returns a verdict; it changes nothing. There is no magnet
 * anywhere in this file — a dribbler keeps the ball by touching it, and this
 * only tells it when the next touch is due.
 *
 * `horizon` is how many ticks to project. One tick answers "am I about to lose
 * it"; a few ticks answer "is it worth spending a touch now", which matters
 * because the charge release needs the ball still in reach when it fires.
 *
 * Returns { gap, gapNext, keep } in RAW fixed-point units.
 */
export function controlAdvice(world, i, mx = 0, mz = 0, horizon = 1) {
  const buf = world.buf;
  const o = playerOffset(i);
  const gap = ballDistance(buf, o);
  // forward integration for both bodies in the same order step() uses
  let px = buf[o + P_X];
  let pz = buf[o + P_Z];
  let pvx = buf[o + P_VX];
  let pvz = buf[o + P_VZ];
  let bx = buf[BALL_BASE];
  let bz = buf[BALL_BASE + 1];
  let bvx = buf[BALL_BASE + 2];
  let bvz = buf[BALL_BASE + 3];
  const h = horizon < 1 ? 1 : horizon | 0;
  for (let k = 0; k < h; k++) {
    pvx = fxAdd(pvx, fxMul(mx, C.PLAYER_ACCEL));
    pvz = fxAdd(pvz, fxMul(mz, C.PLAYER_ACCEL));
    px = fxAdd(px, pvx);
    pz = fxAdd(pz, pvz);
    bx = fxAdd(bx, bvx);
    bz = fxAdd(bz, bvz);
    pvx = fxMul(pvx, C.PLAYER_DAMPING);
    pvz = fxMul(pvz, C.PLAYER_DAMPING);
    bvx = fxMul(bvx, C.BALL_DAMPING);
    bvz = fxMul(bvz, C.BALL_DAMPING);
  }
  const gapNext = fxHypot(fxSub(bx, px), fxSub(bz, pz));
  return { gap, gapNext, keep: gapNext <= C.CONTROL_RADIUS };
}

// ------------------------------------------------------------ shot charge

/**
 * Charge curve from the design note: power = 0.3 + 0.7 * t^1.5, with t the
 * fraction of the 100 ms -> 800 ms window that was held. Returns a Q16.16
 * multiplier on KICK_IMPULSE, so a tap is 0.3x and a full hold is exactly 1x.
 *
 * t^1.5 is t * sqrt(t); fxSqrt is the exact integer root, so the curve is the
 * same integer on every engine.
 */
export function chargePower(ticks) {
  const span = C.CHARGE_MAX_TICKS - C.CHARGE_MIN_TICKS;
  let held = (ticks | 0) - C.CHARGE_MIN_TICKS;
  if (held <= 0) return C.CHARGE_BASE;
  if (held > span) held = span;
  const t = fxDiv(fxFromInt(held), fxFromInt(span));
  const t15 = fxMul(t, fxSqrt(t));
  return fxAdd(C.CHARGE_BASE, fxMul(C.CHARGE_SPAN, t15));
}

/** Same shape, mapped onto the keeper's clearance range instead of 0.3..1. */
function clearImpulse(ticks) {
  const span = C.CLEAR_MAX_TICKS;
  let held = ticks | 0;
  if (held < 0) held = 0;
  if (held > span) held = span;
  const t = fxDiv(fxFromInt(held), fxFromInt(span));
  const t15 = fxMul(t, fxSqrt(t));
  return fxAdd(
    C.CLEAR_MIN_IMPULSE,
    fxMul(C.CLEAR_MAX_IMPULSE - C.CLEAR_MIN_IMPULSE, t15),
  );
}

// ------------------------------------------------------------------- step

/**
 * Advance one 60 Hz tick.
 *
 * `inputs` is indexed by player: { moveX, moveZ, kick, charge, tackle, ... }
 * floats/booleans, or the pre-quantised { moveXFx, moveZFx, buttons } form.
 * Missing entries count as no input.
 *
 * Returns the events produced this tick. Order inside the tick is fixed and
 * load-bearing: timers, acceleration, tackle lunge, impulses, tackle hitbox,
 * curve, integrate, collide, hold pin, damp, decay, score, match rules.
 *
 * Once the match is finished the world freezes: the clock still advances (the
 * net layer's delta and ack machinery is indexed by tick and must keep moving)
 * but nothing else is simulated and no further event is produced. Restarting is
 * a new world, not a mutation of this one.
 */
export function step(world, inputs) {
  const { buf } = world;
  const n = world.playerCount;
  const events = [];
  const tick = buf[HDR_TICK];
  const P = pitchOf(buf);

  if (buf[HDR_MATCH_STATE] === MATCH_FINISHED) {
    buf[HDR_TICK] = (tick + 1) | 0;
    return events;
  }

  const dir = [0, 0];
  const aim = [0, 0];
  // touched[i] !== 0 means player i already produced a touch event this tick,
  // which suppresses the duplicate "contact" touch after the collision pass.
  const touched = new Int32Array(n);

  const inp = [];
  for (let i = 0; i < n; i++) inp.push(quantiseInput(inputs && inputs[i]));

  const holder = buf[HDR_BALL_HOLDER];
  const held = holder >= 0;

  // 1) timers, button edges and the charge accumulators ---------------------
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    const b = inp[i].buttons;
    const prev = buf[o + P_PREV_BUTTONS];
    const pressed = b & ~prev;
    const released = prev & ~b;

    if (buf[o + P_TACKLE_CD] > 0) buf[o + P_TACKLE_CD]--;
    if (buf[o + P_TOUCH_CD] > 0) buf[o + P_TOUCH_CD]--;
    if (buf[o + P_DIVE_LOCK] > 0) buf[o + P_DIVE_LOCK]--;
    if (buf[o + P_TACKLE_RECOV] > 0) buf[o + P_TACKLE_RECOV]--;

    // shot charge lives here, in state, so the host and every client agree on
    // the power a release is worth without trusting a timestamp
    if (b & BTN.CANCEL) {
      if (buf[o + P_CHARGE] > 0 || buf[o + P_CHARGE_REL] > 0) {
        events.push({ type: 'charge-cancel', player: i, tick });
      }
      buf[o + P_CHARGE] = 0;
      buf[o + P_CHARGE_REL] = 0;
      buf[o + P_CHARGE_PWR] = 0;
      buf[o + P_CLEAR_CHARGE] = 0;
    } else {
      if (b & BTN.CHARGE) {
        if (buf[o + P_CHARGE] < C.CHARGE_MAX_TICKS) buf[o + P_CHARGE]++;
        // `P_CHARGE > 0` is what stops a cancel from turning into a shot: the
        // cancel zeroes the accumulator, and the button coming up on the NEXT
        // tick is still a release edge
      } else if (released & BTN.CHARGE && buf[o + P_CHARGE] > 0) {
        buf[o + P_CHARGE_PWR] = chargePower(buf[o + P_CHARGE]);
        buf[o + P_CHARGE_REL] = C.CHARGE_BUFFER_TICKS;
        buf[o + P_CHARGE] = 0;
      }
      if (b & BTN.CLEAR) {
        if (buf[o + P_CLEAR_CHARGE] < C.CLEAR_MAX_TICKS) buf[o + P_CLEAR_CHARGE]++;
      } else if (holder !== i) {
        // only the keeper actually holding the ball keeps a clearance charge
        buf[o + P_CLEAR_CHARGE] = 0;
      }
    }

    // latch: a fresh press arms the kick for KICK_LATCH_TICKS so a press a few
    // frames before contact still connects
    if (pressed & BTN.KICK && buf[o + P_KICK_CD] === 0) {
      buf[o + P_KICK_ARM] = C.KICK_LATCH_TICKS;
    }
    buf[o + P_PREV_BUTTONS] = b;
  }

  // 2) acceleration from input, unless the player is committed or grounded ---
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    if (buf[o + P_TACKLE_ACTIVE] > 0) continue; // riding the slide
    if (buf[o + P_TACKLE_RECOV] > 0) continue; // movement lock
    if (buf[o + P_DIVE_LOCK] > 0) continue; // grounded after a whiff
    const { mx, mz, kick } = inp[i];
    const accel = kick ? C.PLAYER_KICKING_ACCEL : C.PLAYER_ACCEL;
    if (mx !== 0) buf[o + P_VX] = fxAdd(buf[o + P_VX], fxMul(mx, accel));
    if (mz !== 0) buf[o + P_VZ] = fxAdd(buf[o + P_VZ], fxMul(mz, accel));
  }

  // 3) slide tackle: start the lunge ---------------------------------------
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    const b = inp[i].buttons;
    const startable =
      buf[o + P_TACKLE_ACTIVE] === 0 &&
      buf[o + P_TACKLE_RECOV] === 0 &&
      buf[o + P_TACKLE_CD] === 0 &&
      buf[o + P_DIVE_LOCK] === 0 &&
      holder !== i;
    // strict rising edge, held in the flags word: section 1 has already
    // overwritten P_PREV_BUTTONS, and a held button must never re-trigger
    if ((b & BTN.TACKLE) === 0) {
      buf[o + P_FLAGS] &= ~FLAG_TACKLE_HELD;
      continue;
    }
    const fresh = (buf[o + P_FLAGS] & FLAG_TACKLE_HELD) === 0;
    buf[o + P_FLAGS] |= FLAG_TACKLE_HELD;
    if (fresh && startable) {
      buf[o + P_TACKLE_ACTIVE] = C.TACKLE_ACTIVE_TICKS;
      aimDirection(inp[i].mx, inp[i].mz, buf[o + P_TEAM], aim);
      buf[o + P_VX] = fxAdd(buf[o + P_VX], fxMul(aim[0], C.TACKLE_IMPULSE));
      buf[o + P_VZ] = fxAdd(buf[o + P_VZ], fxMul(aim[1], C.TACKLE_IMPULSE));
      events.push({ type: 'tackle-start', player: i, tick });
    }
  }

  // 4) keeper: dive start ---------------------------------------------------
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    const b = inp[i].buttons;
    if ((b & BTN.DIVE) === 0) {
      buf[o + P_FLAGS] &= ~FLAG_DIVE_HELD;
      continue;
    }
    if (buf[o + P_FLAGS] & FLAG_DIVE_HELD) continue; // already consumed
    buf[o + P_FLAGS] |= FLAG_DIVE_HELD;
    if (!keeperEmpowered(world, i)) continue;
    if (buf[o + P_DIVE_ACTIVE] > 0 || buf[o + P_DIVE_LOCK] > 0) continue;
    if (holder === i) continue;
    // four directions only: whichever axis the stick leans on hardest
    const { mx, mz } = inp[i];
    let d;
    if (fxAbs(mx) >= fxAbs(mz)) d = mx < 0 ? 0 : 1;
    else d = mz < 0 ? 2 : 3;
    const dvx = d === 0 ? -FX_ONE : d === 1 ? FX_ONE : 0;
    const dvz = d === 2 ? -FX_ONE : d === 3 ? FX_ONE : 0;
    buf[o + P_DIVE_DIR] = d;
    buf[o + P_DIVE_ACTIVE] = C.DIVE_ACTIVE_TICKS;
    buf[o + P_VX] = fxAdd(buf[o + P_VX], fxMul(dvx, C.DIVE_IMPULSE));
    buf[o + P_VZ] = fxAdd(buf[o + P_VZ], fxMul(dvz, C.DIVE_IMPULSE));
    events.push({ type: 'dive-start', player: i, dir: d, tick });
  }

  // 5) impulses on the ball -------------------------------------------------
  // 5a) the keeper who is holding it decides how it leaves his hands
  if (held) {
    const o = playerOffset(holder);
    const b = inp[holder].buttons;
    // section 1 only lets a holder's clearance charge survive while the button
    // is down, so "charge > 0 and button up" is exactly the release edge
    const releasedClear = (b & BTN.CLEAR) === 0 && buf[o + P_CLEAR_CHARGE] > 0;
    let kind = null;
    let impulse = 0;
    if (b & BTN.THROW) {
      kind = 'throw';
      impulse = C.THROW_IMPULSE;
    } else if (releasedClear) {
      kind = 'clear';
      impulse = clearImpulse(buf[o + P_CLEAR_CHARGE]);
    } else if (buf[HDR_BALL_HOLD_TICKS] <= 1) {
      kind = 'forced'; // the counter ran out: the ball leaves whether he likes it or not
      impulse = C.THROW_IMPULSE;
    }
    if (kind) {
      aimDirection(inp[holder].mx, inp[holder].mz, buf[o + P_TEAM], aim);
      buf[BALL_BASE] = fxAdd(buf[o + P_X], fxMul(aim[0], C.HOLD_OFFSET));
      buf[BALL_BASE + 1] = fxAdd(buf[o + P_Z], fxMul(aim[1], C.HOLD_OFFSET));
      buf[BALL_BASE + 2] = fxAdd(buf[o + P_VX], fxMul(aim[0], impulse));
      buf[BALL_BASE + 3] = fxAdd(buf[o + P_VZ], fxMul(aim[1], impulse));
      buf[HDR_BALL_HOLDER] = -1;
      buf[HDR_BALL_HOLD_TICKS] = 0;
      buf[o + P_CLEAR_CHARGE] = 0;
      // a hand throw is deliberately straight; only the foot clearance bends
      buf[HDR_BALL_CURVE] = 0;
      if (kind === 'clear') {
        buf[HDR_AFTERTOUCH_OWNER] = holder;
        buf[HDR_AFTERTOUCH_TICKS] = C.AFTERTOUCH_TICKS;
      } else {
        buf[HDR_AFTERTOUCH_OWNER] = -1;
        buf[HDR_AFTERTOUCH_TICKS] = 0;
      }
      // grief lock: whatever he does with it, it cannot end up an own goal
      buf[HDR_GRIEF_TEAM] = buf[o + P_TEAM];
      buf[HDR_GRIEF_TICKS] = C.GRIEF_LOCK_TICKS;
      touched[holder] = 1;
      events.push({ type: 'keeper-release', player: holder, kind, tick });
      events.push({ type: 'touch', player: holder, kind, tick });
    } else {
      buf[HDR_BALL_HOLD_TICKS]--;
    }
  }

  const stillHeld = buf[HDR_BALL_HOLDER] >= 0;

  // 5b) close-control touch: the CMU "small corrective kick". Level triggered
  //     behind its own cooldown, because a dribbler asks for it every few ticks
  //     and a rising edge would make close control a drum solo. It cannot glue
  //     the ball on: repeated touches raise the ball's speed until it outruns
  //     the player, so spamming it loses possession rather than keeping it.
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    if ((inp[i].buttons & BTN.TOUCH) === 0) continue;
    if (stillHeld || buf[o + P_TOUCH_CD] > 0) continue;
    const dist = ballDistance(buf, o);
    if (fxSub(dist, REACH) >= C.KICK_RANGE) continue;
    ballDirection(buf, o, dir);
    buf[BALL_BASE + 2] = fxAdd(buf[BALL_BASE + 2], fxMul(dir[0], C.TOUCH_IMPULSE));
    buf[BALL_BASE + 3] = fxAdd(buf[BALL_BASE + 3], fxMul(dir[1], C.TOUCH_IMPULSE));
    buf[o + P_TOUCH_CD] = C.TOUCH_COOLDOWN_TICKS;
    buf[HDR_BALL_CURVE] = 0; // a dribble touch is a ground touch
    touched[i] = 1;
    events.push({ type: 'touch', player: i, kind: 'control', tick });
  }

  // 5c) plain kick — the latched instant pass, unchanged from Phase 1.1
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    if (buf[o + P_KICK_CD] > 0) buf[o + P_KICK_CD]--;
    if (buf[o + P_KICK_ARM] <= 0) continue;
    if (stillHeld || buf[o + P_KICK_CD] > 0) {
      buf[o + P_KICK_ARM]--;
      continue;
    }
    const dist = ballDistance(buf, o);
    if (fxSub(dist, REACH) < C.KICK_RANGE) {
      ballDirection(buf, o, dir);
      buf[BALL_BASE + 2] = fxAdd(buf[BALL_BASE + 2], fxMul(dir[0], C.KICK_IMPULSE));
      buf[BALL_BASE + 3] = fxAdd(buf[BALL_BASE + 3], fxMul(dir[1], C.KICK_IMPULSE));
      buf[o + P_KICK_ARM] = 0;
      buf[o + P_KICK_CD] = C.KICK_COOLDOWN_TICKS;
      // a ground pass carries no spin, by design, and takes no aftertouch
      buf[HDR_BALL_CURVE] = 0;
      buf[HDR_AFTERTOUCH_OWNER] = -1;
      buf[HDR_AFTERTOUCH_TICKS] = 0;
      touched[i] = 1;
      events.push({ type: 'kick', player: i, tick });
      events.push({ type: 'touch', player: i, kind: 'kick', tick });
    } else {
      buf[o + P_KICK_ARM]--;
    }
  }

  // 5d) charged shot: the buffered release fires on the first tick the ball is
  //     actually reachable, which is what "4-6 tick input buffer" means
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    if (buf[o + P_CHARGE_REL] <= 0) continue;
    if (stillHeld || buf[o + P_KICK_CD] > 0) {
      buf[o + P_CHARGE_REL]--;
      continue;
    }
    const dist = ballDistance(buf, o);
    if (fxSub(dist, REACH) < C.KICK_RANGE) {
      const power = buf[o + P_CHARGE_PWR];
      const impulse = fxMul(power, C.KICK_IMPULSE);
      ballDirection(buf, o, dir);
      buf[BALL_BASE + 2] = fxAdd(buf[BALL_BASE + 2], fxMul(dir[0], impulse));
      buf[BALL_BASE + 3] = fxAdd(buf[BALL_BASE + 3], fxMul(dir[1], impulse));
      buf[o + P_CHARGE_REL] = 0;
      buf[o + P_CHARGE_PWR] = 0;
      buf[o + P_KICK_CD] = C.KICK_COOLDOWN_TICKS;
      buf[HDR_BALL_CURVE] = 0;
      buf[HDR_AFTERTOUCH_OWNER] = i;
      buf[HDR_AFTERTOUCH_TICKS] = C.AFTERTOUCH_TICKS;
      touched[i] = 1;
      events.push({ type: 'shot', player: i, power, impulse, tick });
      events.push({ type: 'touch', player: i, kind: 'shot', tick });
    } else {
      buf[o + P_CHARGE_REL]--;
    }
  }

  // 6) slide tackle: the widened hitbox ------------------------------------
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    if (buf[o + P_TACKLE_ACTIVE] <= 0) continue;
    buf[o + P_TACKLE_ACTIVE]--;
    let done = false;

    if (!stillHeld) {
      const dist = ballDistance(buf, o);
      if (dist <= REACH + C.TACKLE_REACH) {
        // clean win: the ball is killed and poked away from the tackler
        ballDirection(buf, o, dir);
        buf[BALL_BASE + 2] = fxAdd(
          fxMul(buf[BALL_BASE + 2], C.TACKLE_BALL_DAMP),
          fxMul(dir[0], C.TACKLE_POKE),
        );
        buf[BALL_BASE + 3] = fxAdd(
          fxMul(buf[BALL_BASE + 3], C.TACKLE_BALL_DAMP),
          fxMul(dir[1], C.TACKLE_POKE),
        );
        buf[HDR_BALL_CURVE] = 0;
        buf[HDR_AFTERTOUCH_OWNER] = -1;
        buf[HDR_AFTERTOUCH_TICKS] = 0;
        touched[i] = 1;
        events.push({ type: 'tackle', player: i, won: true, tick });
        events.push({ type: 'touch', player: i, kind: 'tackle', tick });
        done = true;
      }
    }

    if (!done) {
      // a slide that catches a body instead. Team-mates are invisible to it:
      // this is the grief lock, and it is decided here so the host owns it.
      for (let j = 0; j < n && !done; j++) {
        if (j === i) continue;
        const oj = playerOffset(j);
        if (buf[oj + P_TEAM] === buf[o + P_TEAM]) continue;
        const d = fxHypot(
          fxSub(buf[oj + P_X], buf[o + P_X]),
          fxSub(buf[oj + P_Z], buf[o + P_Z]),
        );
        if (d > C.PLAYER_RADIUS + C.TACKLE_REACH + C.PLAYER_RADIUS) continue;
        const kx = fxSub(buf[oj + P_X], buf[o + P_X]);
        const kz = fxSub(buf[oj + P_Z], buf[o + P_Z]);
        if (fxNormalize(kx, kz, dir) === 0) {
          dir[0] = FX_ONE;
          dir[1] = 0;
        }
        buf[oj + P_VX] = fxAdd(buf[oj + P_VX], fxMul(dir[0], C.TACKLE_KNOCK));
        buf[oj + P_VZ] = fxAdd(buf[oj + P_VZ], fxMul(dir[1], C.TACKLE_KNOCK));
        events.push({ type: 'tackle', player: i, victim: j, won: false, tick });
        done = true;
      }
    }

    if (done) buf[o + P_TACKLE_ACTIVE] = 0;
    if (buf[o + P_TACKLE_ACTIVE] === 0) {
      buf[o + P_TACKLE_RECOV] = C.TACKLE_RECOVERY_TICKS;
      buf[o + P_TACKLE_CD] = C.TACKLE_COOLDOWN_TICKS;
    }
  }

  // 7) curve: ONE signed scalar, applied as v += k * perp(v) * curve --------
  if (!stillHeld) {
    // aftertouch first: within the window, sideways input feeds the scalar
    const at = buf[HDR_AFTERTOUCH_OWNER];
    if (at >= 0 && at < n && buf[HDR_AFTERTOUCH_TICKS] > 0) {
      const vx = buf[BALL_BASE + 2];
      const vz = buf[BALL_BASE + 3];
      if (fxNormalize(vx, vz, dir) !== 0) {
        const { mx, mz } = inp[at];
        // cross(unit(v), move): positive means "bend left"
        const lateral = fxSub(fxMul(dir[0], mz), fxMul(dir[1], mx));
        let curve = fxAdd(
          buf[HDR_BALL_CURVE],
          fxMul(lateral, C.AFTERTOUCH_GAIN),
        );
        if (curve > C.CURVE_MAX) curve = C.CURVE_MAX;
        if (curve < -C.CURVE_MAX) curve = -C.CURVE_MAX;
        buf[HDR_BALL_CURVE] = curve;
      }
      buf[HDR_AFTERTOUCH_TICKS]--;
      if (buf[HDR_AFTERTOUCH_TICKS] === 0) buf[HDR_AFTERTOUCH_OWNER] = -1;
    }
    const curve = buf[HDR_BALL_CURVE];
    if (curve !== 0) {
      const vx = buf[BALL_BASE + 2];
      const vz = buf[BALL_BASE + 3];
      const k = fxMul(C.CURVE_ACCEL, curve);
      // perp(v) = (-vz, vx)
      buf[BALL_BASE + 2] = fxAdd(vx, fxMul(fxNeg(vz), k));
      buf[BALL_BASE + 3] = fxAdd(vz, fxMul(vx, k));
    }
  }

  // 8) integrate ----------------------------------------------------------
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    buf[o + P_X] = fxAdd(buf[o + P_X], buf[o + P_VX]);
    buf[o + P_Z] = fxAdd(buf[o + P_Z], buf[o + P_VZ]);
  }
  if (!stillHeld) {
    buf[BALL_BASE] = fxAdd(buf[BALL_BASE], buf[BALL_BASE + 2]);
    buf[BALL_BASE + 1] = fxAdd(buf[BALL_BASE + 1], buf[BALL_BASE + 3]);
  }

  // 9) collisions, in a fixed order ---------------------------------------
  const playerWallCoef = fxMul(C.PLAYER_BCOEF, C.WALL_BCOEF);
  const ballWallCoef = fxMul(C.BALL_BCOEF, C.WALL_BCOEF);
  const playerPostCoef = fxMul(C.PLAYER_BCOEF, C.POST_BCOEF);
  const ballPostCoef = fxMul(C.BALL_BCOEF, C.POST_BCOEF);
  const playerPlayerCoef = fxMul(C.PLAYER_BCOEF, C.PLAYER_BCOEF);
  const playerBallCoef = fxMul(C.PLAYER_BCOEF, C.BALL_BCOEF);

  // 9a) players stay inside the rectangle; they never enter a goal mouth
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    resolveWall(buf, o, C.PLAYER_RADIUS, P_X, P.halfX, playerWallCoef);
    resolveWall(buf, o, C.PLAYER_RADIUS, P_Z, P.halfZ, playerWallCoef);
  }

  if (!stillHeld) {
    // 9b) ball: side walls always, goal lines only outside the mouth
    resolveWall(buf, BALL_BASE, C.BALL_RADIUS, P_X, P.halfX, ballWallCoef);
    if (fxAbs(buf[BALL_BASE]) >= P.goalHalfX) {
      resolveWall(
        buf,
        BALL_BASE,
        C.BALL_RADIUS,
        P_Z,
        P.halfZ,
        ballWallCoef,
      );
    }
  }

  // 9c) the four posts
  for (let s = 0; s < 4; s++) {
    const px = s & 1 ? P.goalHalfX : -P.goalHalfX;
    const pz = s & 2 ? P.halfZ : -P.halfZ;
    for (let i = 0; i < n; i++) {
      resolvePost(
        buf,
        playerOffset(i),
        C.PLAYER_RADIUS,
        C.PLAYER_INV_MASS,
        playerPostCoef,
        px,
        pz,
        C.POST_RADIUS,
      );
    }
    if (!stillHeld) {
      resolvePost(
        buf,
        BALL_BASE,
        C.BALL_RADIUS,
        C.BALL_INV_MASS,
        ballPostCoef,
        px,
        pz,
        C.POST_RADIUS,
      );
    }
  }

  // 9d) player vs player
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      resolveDiscs(
        buf,
        playerOffset(i),
        playerOffset(j),
        C.PLAYER_RADIUS,
        C.PLAYER_RADIUS,
        C.PLAYER_INV_MASS,
        C.PLAYER_INV_MASS,
        playerPlayerCoef,
      );
    }
  }

  // 9e) player vs ball. This is the whole of dribbling: no attraction, no
  //     sticking, just the disc response plus the damping gap (ball 0.99 >
  //     player 0.96) that keeps a nudged ball inside chasing range.
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    let contact = false;
    if (!stillHeld) {
      contact = resolveDiscs(
        buf,
        o,
        BALL_BASE,
        C.PLAYER_RADIUS,
        C.BALL_RADIUS,
        C.PLAYER_INV_MASS,
        C.BALL_INV_MASS,
        playerBallCoef,
      );
    }
    const was = (buf[o + P_FLAGS] & FLAG_TOUCHING) !== 0;
    if (contact) {
      buf[o + P_FLAGS] |= FLAG_TOUCHING;
      if (!was && !touched[i]) {
        touched[i] = 1;
        events.push({ type: 'touch', player: i, kind: 'contact', tick });
      }
      // possession changed hands, so the spin the last striker put on it dies
      buf[HDR_BALL_CURVE] = 0;
      if (buf[HDR_AFTERTOUCH_OWNER] !== i) {
        buf[HDR_AFTERTOUCH_OWNER] = -1;
        buf[HDR_AFTERTOUCH_TICKS] = 0;
      }
      // anyone else touching the ball ends the released-hold protection
      if (buf[HDR_GRIEF_TEAM] >= 0 && buf[o + P_TEAM] !== buf[HDR_GRIEF_TEAM]) {
        buf[HDR_GRIEF_TEAM] = -1;
        buf[HDR_GRIEF_TICKS] = 0;
      }
    } else {
      buf[o + P_FLAGS] &= ~FLAG_TOUCHING;
    }
  }

  // 10) keeper: dive resolution, then catch --------------------------------
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    if (buf[o + P_DIVE_ACTIVE] <= 0) continue;
    buf[o + P_DIVE_ACTIVE]--;
    if (buf[HDR_BALL_HOLDER] >= 0) continue;
    const dist = ballDistance(buf, o);
    if (dist <= REACH + C.DIVE_REACH) {
      buf[BALL_BASE + 2] = fxMul(buf[BALL_BASE + 2], C.DIVE_SAVE_DAMP);
      buf[BALL_BASE + 3] = fxMul(buf[BALL_BASE + 3], C.DIVE_SAVE_DAMP);
      buf[HDR_BALL_CURVE] = 0;
      buf[o + P_DIVE_ACTIVE] = 0;
      if (!touched[i]) {
        touched[i] = 1;
        events.push({ type: 'touch', player: i, kind: 'save', tick });
      }
      events.push({ type: 'keeper-save', player: i, tick });
    } else if (buf[o + P_DIVE_ACTIVE] === 0) {
      // the window closed with nothing in it: grounded and defenceless
      buf[o + P_DIVE_LOCK] = C.DIVE_WHIFF_LOCK_TICKS;
      events.push({ type: 'keeper-whiff', player: i, tick });
    }
  }

  if (buf[HDR_BALL_HOLDER] < 0) {
    for (let i = 0; i < n; i++) {
      const o = playerOffset(i);
      if ((inp[i].buttons & BTN.CATCH) === 0) continue;
      if (!keeperEmpowered(world, i)) continue;
      if (ballDistance(buf, o) > REACH + C.CATCH_REACH) continue;
      buf[HDR_BALL_HOLDER] = i;
      buf[HDR_BALL_HOLD_TICKS] = C.CATCH_HOLD_TICKS;
      buf[HDR_BALL_CURVE] = 0;
      buf[HDR_AFTERTOUCH_OWNER] = -1;
      buf[HDR_AFTERTOUCH_TICKS] = 0;
      buf[o + P_DIVE_ACTIVE] = 0;
      if (!touched[i]) {
        touched[i] = 1;
        events.push({ type: 'touch', player: i, kind: 'catch', tick });
      }
      events.push({ type: 'keeper-catch', player: i, tick });
      break; // lowest index wins a simultaneous grab, deterministically
    }
  }

  // 11) a held ball rides with its keeper -----------------------------------
  const nowHolder = buf[HDR_BALL_HOLDER];
  if (nowHolder >= 0) {
    const o = playerOffset(nowHolder);
    // pinned in FRONT of the keeper (goal-ward), never behind him: a held ball
    // must not be able to drift over his own line while it is still in his hands
    aimDirection(0, 0, buf[o + P_TEAM], aim);
    buf[BALL_BASE] = fxAdd(buf[o + P_X], fxMul(aim[0], C.HOLD_OFFSET));
    buf[BALL_BASE + 1] = fxAdd(buf[o + P_Z], fxMul(aim[1], C.HOLD_OFFSET));
    buf[BALL_BASE + 2] = buf[o + P_VX];
    buf[BALL_BASE + 3] = buf[o + P_VZ];
  }

  // 12) damping: newSpeed = damping * oldSpeed, applied after the move -----
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    buf[o + P_VX] = fxMul(buf[o + P_VX], C.PLAYER_DAMPING);
    buf[o + P_VZ] = fxMul(buf[o + P_VZ], C.PLAYER_DAMPING);
  }
  if (nowHolder < 0) {
    buf[BALL_BASE + 2] = fxMul(buf[BALL_BASE + 2], C.BALL_DAMPING);
    buf[BALL_BASE + 3] = fxMul(buf[BALL_BASE + 3], C.BALL_DAMPING);
    // spin bleeds off on its own; nothing else has to remember to clear it
    if (buf[HDR_BALL_CURVE] !== 0) {
      buf[HDR_BALL_CURVE] = fxMul(buf[HDR_BALL_CURVE], C.CURVE_DAMPING);
    }
  }
  if (buf[HDR_GRIEF_TICKS] > 0) {
    buf[HDR_GRIEF_TICKS]--;
    if (buf[HDR_GRIEF_TICKS] === 0) buf[HDR_GRIEF_TEAM] = -1;
  }

  // 13) goals --------------------------------------------------------------
  let scored = false;
  const bz = buf[BALL_BASE + 1];
  const line = P.halfZ + C.BALL_RADIUS;
  if (fxAbs(buf[BALL_BASE]) < P.goalHalfX && (bz > line || bz < -line)) {
    // team 0 defends -z and attacks +z
    const scorer = bz > 0 ? 0 : 1;
    const conceding = scorer === 0 ? 1 : 0;
    if (buf[HDR_GRIEF_TEAM] === conceding && buf[HDR_GRIEF_TICKS] > 0) {
      // a keeper cannot throw or boot his own hold into his own net; the ball
      // goes back into his hands and he takes the clearance again
      const gk = findKeeper(world, conceding);
      const o = playerOffset(gk >= 0 ? gk : 0);
      buf[HDR_BALL_HOLDER] = gk >= 0 ? gk : -1;
      buf[HDR_BALL_HOLD_TICKS] = gk >= 0 ? C.CATCH_HOLD_TICKS : 0;
      aimDirection(0, 0, buf[o + P_TEAM], aim);
      buf[BALL_BASE] = fxAdd(buf[o + P_X], fxMul(aim[0], C.HOLD_OFFSET));
      buf[BALL_BASE + 1] = fxAdd(buf[o + P_Z], fxMul(aim[1], C.HOLD_OFFSET));
      buf[BALL_BASE + 2] = 0;
      buf[BALL_BASE + 3] = 0;
      buf[HDR_BALL_CURVE] = 0;
      buf[HDR_GRIEF_TEAM] = -1;
      buf[HDR_GRIEF_TICKS] = 0;
      events.push({ type: 'grief-void', team: conceding, tick });
    } else {
      if (scorer === 0) buf[HDR_SCORE_0]++;
      else buf[HDR_SCORE_1]++;
      buf[HDR_LAST_GOAL_TEAM] = scorer;
      buf[HDR_LAST_GOAL_TICK] = tick;
      buf[HDR_KICKOFF_TEAM] = conceding; // conceding side restarts
      events.push({ type: 'goal', team: scorer, tick });
      scored = true;
      resetKickoff(world);
    }
  }

  // 13b) match rules -------------------------------------------------------
  //
  // Decided here, in the core, on the host's own state: "the match is over" is
  // exactly the kind of verdict a client must never be allowed to author.
  //
  // Precedence when a single goal satisfies several rules at once:
  //   mercy  >  golden goal  >  score limit
  // Mercy first because a four-goal gap is the harshest fact on the board;
  // golden goal before the score limit because during a golden-goal period the
  // score limit has usually already been passed and "golden goal" is the reason
  // a human would give for the ending.
  {
    const s0 = buf[HDR_SCORE_0];
    const s1 = buf[HDR_SCORE_1];
    const diff = s0 - s1;
    const gap = diff < 0 ? -diff : diff;
    const flags = buf[HDR_RULE_FLAGS];
    const limit = buf[HDR_SCORE_LIMIT];
    let reason = END_NONE;

    if (scored) {
      if (flags & RULE_MERCY && gap >= MERCY_GOAL_DIFF) reason = END_MERCY;
      else if (buf[HDR_MATCH_STATE] === MATCH_GOLDEN_GOAL) reason = END_GOLDEN_GOAL;
      else if (limit > 0 && (s0 >= limit || s1 >= limit)) reason = END_SCORE_LIMIT;
    }

    // Full time. The clock is checked against the tick this step is about to
    // produce, so a duration of D means exactly D ticks were simulated.
    const dur = buf[HDR_DURATION_TICKS];
    if (
      reason === END_NONE &&
      dur > 0 &&
      tick + 1 >= dur &&
      buf[HDR_MATCH_STATE] === MATCH_RUNNING
    ) {
      if (diff !== 0 || (flags & RULE_GOLDEN_GOAL) === 0) {
        reason = END_FULL_TIME; // a winner, or a draw nobody asked to break
      } else {
        // level, and the room wants it settled: play on, next goal wins
        buf[HDR_MATCH_STATE] = MATCH_GOLDEN_GOAL;
        events.push({ type: 'golden-goal', score: [s0, s1], tick });
      }
    }

    if (reason !== END_NONE) {
      buf[HDR_MATCH_STATE] = MATCH_FINISHED;
      buf[HDR_END_REASON] = reason;
      events.push({
        type: 'match-end',
        reason: endReasonName(reason),
        winner: leaderOf(s0, s1),
        score: [s0, s1],
        tick,
      });
    }
  }

  // 14) advance the clock --------------------------------------------------
  buf[HDR_TICK] = (tick + 1) | 0;
  return events;
}

/** Lowest-index keeper on a team, or -1. Deterministic tie-break (ADR-0001). */
function findKeeper(world, team) {
  const buf = world.buf;
  for (let i = 0; i < world.playerCount; i++) {
    const o = playerOffset(i);
    if (buf[o + P_ROLE] === 1 && buf[o + P_TEAM] === team) return i;
  }
  return -1;
}

// ------------------------------------------------------------- inspection

/** Per-tick 32-bit hex digest of the whole state buffer. */
export function checksum(world) {
  return checksumInts(world.buf);
}

/** Detached Int32Array snapshot. Safe to keep, transfer or hash. */
export function serialize(world) {
  return Int32Array.from(world.buf);
}

/**
 * The MatchSettings a state was built with, reconstructed from its header.
 * Derived rather than cached, so it cannot drift from what the sim reads.
 */
export function worldSettings(world) {
  const buf = world && world.buf ? world.buf : world;
  return settingsFrom({
    durationTicks: buf[HDR_DURATION_TICKS],
    scoreLimit: buf[HDR_SCORE_LIMIT],
    pitchCode: buf[HDR_PITCH],
    flags: buf[HDR_RULE_FLAGS],
  });
}

/**
 * Rebuild a world from a snapshot, rejecting anything that will not match.
 *
 * `expect.settings`, when given, is the settings the CALLER believes it is
 * playing under. A snapshot from a different room is refused here — that is the
 * whole point of putting the settings in the header. A big-pitch snapshot
 * applied by a small-pitch client would put players through walls and score
 * goals that never happened, and it would do it silently.
 */
export function deserialize(snapshot, expect = {}) {
  const buf = Int32Array.from(snapshot);
  if (buf[HDR_MAGIC] !== STATE_MAGIC) throw new Error('core: bad state magic');
  if (buf[HDR_VERSION] !== STATE_VERSION) {
    throw new Error(
      `core: state version ${buf[HDR_VERSION]} != ${STATE_VERSION}`,
    );
  }
  if (buf[HDR_CONST_HASH] !== constantsHashInt) {
    throw new Error(
      'core: constantsHash mismatch — this snapshot belongs to a different physics build',
    );
  }
  const playerCount = buf[HDR_PLAYER_COUNT];
  if (buf.length !== stateLength(playerCount)) {
    throw new Error('core: snapshot length does not match player count');
  }
  // settingsFrom validates the pitch code, the rule bits and the clock; the
  // hash word then has to agree with them, which catches a single tampered word
  const settings = worldSettings(buf);
  if (buf[HDR_SETTINGS_HASH] !== settingsHashInt(settings)) {
    throw new SettingsError(
      'settings-hash',
      'core: settings hash in the state header does not match the settings words',
    );
  }
  if (buf[HDR_MATCH_STATE] < MATCH_RUNNING || buf[HDR_MATCH_STATE] > MATCH_FINISHED) {
    throw new SettingsError(
      'bad-match-state',
      `core: match state ${buf[HDR_MATCH_STATE]} is not one of 0..2`,
    );
  }
  if (expect.settings !== undefined) assertSameSettings(expect.settings, settings);
  return { buf, playerCount };
}

/** Plain-number view for rendering, logging and tests. Never feed it back in. */
export function readState(world) {
  const { buf } = world;
  const players = [];
  for (let i = 0; i < world.playerCount; i++) {
    const o = playerOffset(i);
    players.push({
      index: i,
      team: buf[o + P_TEAM],
      role: buf[o + P_ROLE],
      x: buf[o + P_X] / FX_ONE,
      z: buf[o + P_Z] / FX_ONE,
      vx: buf[o + P_VX] / FX_ONE,
      vz: buf[o + P_VZ] / FX_ONE,
      kickArm: buf[o + P_KICK_ARM],
      kickCooldown: buf[o + P_KICK_CD],
      charge: buf[o + P_CHARGE],
      chargeRelease: buf[o + P_CHARGE_REL],
      clearCharge: buf[o + P_CLEAR_CHARGE],
      tackleActive: buf[o + P_TACKLE_ACTIVE],
      tackleRecovery: buf[o + P_TACKLE_RECOV],
      tackleCooldown: buf[o + P_TACKLE_CD],
      diveActive: buf[o + P_DIVE_ACTIVE],
      diveLock: buf[o + P_DIVE_LOCK],
      diveDir: buf[o + P_DIVE_DIR],
      touchCooldown: buf[o + P_TOUCH_CD],
    });
  }
  const dur = buf[HDR_DURATION_TICKS];
  return {
    tick: buf[HDR_TICK],
    score: [buf[HDR_SCORE_0], buf[HDR_SCORE_1]],
    kickoffTeam: buf[HDR_KICKOFF_TEAM],
    settings: worldSettings(buf),
    pitch: pitchOf(buf).id,
    match: {
      phase: matchPhaseName(buf[HDR_MATCH_STATE]),
      reason: endReasonName(buf[HDR_END_REASON]),
      over: buf[HDR_MATCH_STATE] === MATCH_FINISHED,
      winner:
        buf[HDR_MATCH_STATE] === MATCH_FINISHED
          ? leaderOf(buf[HDR_SCORE_0], buf[HDR_SCORE_1])
          : -1,
      elapsedTicks: buf[HDR_TICK],
      remainingTicks: dur > 0 ? Math.max(0, dur - buf[HDR_TICK]) : -1,
    },
    ball: {
      x: buf[BALL_BASE] / FX_ONE,
      z: buf[BALL_BASE + 1] / FX_ONE,
      vx: buf[BALL_BASE + 2] / FX_ONE,
      vz: buf[BALL_BASE + 3] / FX_ONE,
      curve: buf[HDR_BALL_CURVE] / FX_ONE,
      holder: buf[HDR_BALL_HOLDER],
      holdTicks: buf[HDR_BALL_HOLD_TICKS],
    },
    aftertouch: {
      owner: buf[HDR_AFTERTOUCH_OWNER],
      ticks: buf[HDR_AFTERTOUCH_TICKS],
    },
    griefLock: { team: buf[HDR_GRIEF_TEAM], ticks: buf[HDR_GRIEF_TICKS] },
    players,
  };
}

/** Authoring helper for tests and scenario setup; floats stop here. */
export function place(world, target, x, z, vx = 0, vz = 0) {
  const o = target === 'ball' ? BALL_BASE : playerOffset(target);
  world.buf[o + P_X] = fxFromNumber(x);
  world.buf[o + P_Z] = fxFromNumber(z);
  world.buf[o + P_VX] = fxFromNumber(vx);
  world.buf[o + P_VZ] = fxFromNumber(vz);
}

/** Authoring helper: set the ball's curve scalar directly. Tests only. */
export function setCurve(world, curve) {
  world.buf[HDR_BALL_CURVE] = fxFromNumber(curve);
}

export const FIELD = {
  P_X,
  P_Z,
  P_VX,
  P_VZ,
  P_TEAM,
  P_KICK_ARM,
  P_KICK_CD,
  P_PREV_BUTTONS,
  P_PREV_KICK: P_PREV_BUTTONS, // back-compat alias: bit 0 of the mask
  P_ROLE,
  P_CHARGE,
  P_CHARGE_REL,
  P_CHARGE_PWR,
  P_TACKLE_ACTIVE,
  P_TACKLE_RECOV,
  P_TACKLE_CD,
  P_DIVE_ACTIVE,
  P_DIVE_LOCK,
  P_DIVE_DIR,
  P_CLEAR_CHARGE,
  P_FLAGS,
  P_TOUCH_CD,
};
