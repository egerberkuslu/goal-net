// Deterministic 2D pitch simulation, 60 Hz fixed timestep.
//
// Scope of THIS core (Phase 1.1)
//   in  : players and ball on the (x, z) plane, circle-circle and circle-wall
//         collisions with bCoef/invMass, kick as an added impulse, goal posts,
//         goal detection, kickoff reset, per-tick checksum
//   out : anything with height (aerial ball, jumps, headers), spin/curve,
//         slide tackles, shot charging, keepers, bots, fouls, halves, stats.
//         Those are Phase 1.2+ and they land on top of this state, not beside
//         it. Aerial motion in particular is deliberately absent: the LOCKED
//         constants in physics-constants.md describe the 2D base, and adding a
//         y axis before those are proven would change the numbers being
//         validated.
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
//          10  reserved
//          11  reserved
//   ball   12  x  13 z  14 vx  15 vz
//   player 16 + i*8: x, z, vx, vz, team, kickArm, kickCooldown, prevKick

import {
  FX_ONE,
  fxAbs,
  fxAdd,
  fxDiv,
  fxHypot,
  fxMul,
  fxNeg,
  fxSub,
  fxFromNumber,
} from './fx.js';
import { CONSTANTS, constantsHashInt } from './constants.js';
import { checksumInts } from './checksum.js';

export const STATE_MAGIC = 0x474e4331; // "GNC1"
export const STATE_VERSION = 1;

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
export const HDR_LEN = 12;

export const BALL_BASE = HDR_LEN;
export const BALL_LEN = 4;
export const PLAYER_BASE = BALL_BASE + BALL_LEN;
export const PLAYER_STRIDE = 8;

const P_X = 0;
const P_Z = 1;
const P_VX = 2;
const P_VZ = 3;
const P_TEAM = 4;
const P_KICK_ARM = 5;
const P_KICK_CD = 6;
const P_PREV_KICK = 7;

const C = CONSTANTS;
const HALF_SPAWN_STEP = C.SPAWN_X_STEP / 2; // SPAWN_X_STEP is even by construction

export function stateLength(playerCount) {
  return PLAYER_BASE + playerCount * PLAYER_STRIDE;
}

export function playerOffset(i) {
  return PLAYER_BASE + i * PLAYER_STRIDE;
}

// ------------------------------------------------------------------ setup

/**
 * createWorld({ players: [{ team }], teams: [0,1,...], playerCount })
 *
 * `players` wins if given; otherwise `teams`; otherwise playerCount players are
 * dealt alternately to team 0 and team 1.
 */
export function createWorld(config = {}) {
  let teams;
  if (Array.isArray(config.players)) {
    teams = config.players.map((p) => (p && p.team ? 1 : 0));
  } else if (Array.isArray(config.teams)) {
    teams = config.teams.map((t) => (t ? 1 : 0));
  } else {
    const n = config.playerCount == null ? 2 : config.playerCount | 0;
    teams = [];
    for (let i = 0; i < n; i++) teams.push(i % 2);
  }
  if (teams.length < 1 || teams.length > C.MAX_PLAYERS) {
    throw new RangeError(
      `player count ${teams.length} outside 1..${C.MAX_PLAYERS}`,
    );
  }

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

  for (let i = 0; i < teams.length; i++) {
    buf[playerOffset(i) + P_TEAM] = teams[i];
  }
  const world = { buf, playerCount: teams.length };
  resetKickoff(world);
  return world;
}

/** Ball to the centre spot, players to their side, every velocity to zero. */
export function resetKickoff(world) {
  const { buf } = world;
  buf[BALL_BASE] = 0;
  buf[BALL_BASE + 1] = 0;
  buf[BALL_BASE + 2] = 0;
  buf[BALL_BASE + 3] = 0;

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
    buf[o + P_X] = (2 * slot - (n - 1)) * HALF_SPAWN_STEP;
    buf[o + P_Z] = team === 0 ? -C.SPAWN_Z : C.SPAWN_Z;
    buf[o + P_VX] = 0;
    buf[o + P_VZ] = 0;
    buf[o + P_KICK_ARM] = 0;
    buf[o + P_KICK_CD] = 0;
    buf[o + P_PREV_KICK] = 0;
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
 * Normalise one player's input into `{ mx, mz, kick }` with mx/mz already
 * fixed-point and clamped to unit length. Accepts either floats (moveX/moveZ)
 * or pre-quantised integers (moveXFx/moveZFx).
 */
export function quantiseInput(input) {
  if (!input) return { mx: 0, mz: 0, kick: 0 };
  let mx =
    input.moveXFx != null ? input.moveXFx | 0 : quantiseAxis(input.moveX || 0);
  let mz =
    input.moveZFx != null ? input.moveZFx | 0 : quantiseAxis(input.moveZ || 0);
  const len = fxHypot(mx, mz);
  if (len > FX_ONE) {
    mx = fxDiv(mx, len);
    mz = fxDiv(mz, len);
  }
  return { mx, mz, kick: input.kick ? 1 : 0 };
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

// ------------------------------------------------------------------- step

/**
 * Advance one 60 Hz tick.
 *
 * `inputs` is indexed by player: { moveX, moveZ, kick } floats, or
 * { moveXFx, moveZFx, kick } if the caller already quantised. Missing entries
 * count as no input.
 *
 * Returns the events produced this tick. Order inside the tick is fixed and
 * load-bearing: accelerate, kick, integrate, collide, damp, score.
 */
export function step(world, inputs) {
  const { buf } = world;
  const n = world.playerCount;
  const events = [];

  // 1) acceleration from input -------------------------------------------
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    const inp = quantiseInput(inputs && inputs[i]);
    const accel = inp.kick ? C.PLAYER_KICKING_ACCEL : C.PLAYER_ACCEL;
    if (inp.mx !== 0) buf[o + P_VX] = fxAdd(buf[o + P_VX], fxMul(inp.mx, accel));
    if (inp.mz !== 0) buf[o + P_VZ] = fxAdd(buf[o + P_VZ], fxMul(inp.mz, accel));

    // latch: a fresh press arms the kick for KICK_LATCH_TICKS so a press a few
    // frames before contact still connects
    const kick = inp.kick;
    if (kick && !buf[o + P_PREV_KICK] && buf[o + P_KICK_CD] === 0) {
      buf[o + P_KICK_ARM] = C.KICK_LATCH_TICKS;
    }
    buf[o + P_PREV_KICK] = kick;
  }

  // 2) kicks: impulse ADDED along unit(player -> ball), never a velocity set
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    if (buf[o + P_KICK_CD] > 0) buf[o + P_KICK_CD]--;
    if (buf[o + P_KICK_ARM] <= 0) continue;
    if (buf[o + P_KICK_CD] > 0) {
      buf[o + P_KICK_ARM]--;
      continue;
    }
    const dx = fxSub(buf[BALL_BASE], buf[o + P_X]);
    const dz = fxSub(buf[BALL_BASE + 1], buf[o + P_Z]);
    const dist = fxHypot(dx, dz);
    const gap = fxSub(dist, C.PLAYER_RADIUS + C.BALL_RADIUS);
    if (gap < C.KICK_RANGE) {
      let nx = FX_ONE;
      let nz = 0;
      if (dist !== 0) {
        nx = fxDiv(dx, dist);
        nz = fxDiv(dz, dist);
      }
      buf[BALL_BASE + 2] = fxAdd(
        buf[BALL_BASE + 2],
        fxMul(nx, C.KICK_IMPULSE),
      );
      buf[BALL_BASE + 3] = fxAdd(
        buf[BALL_BASE + 3],
        fxMul(nz, C.KICK_IMPULSE),
      );
      buf[o + P_KICK_ARM] = 0;
      buf[o + P_KICK_CD] = C.KICK_COOLDOWN_TICKS;
      events.push({ type: 'kick', player: i, tick: buf[HDR_TICK] });
    } else {
      buf[o + P_KICK_ARM]--;
    }
  }

  // 3) integrate ----------------------------------------------------------
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    buf[o + P_X] = fxAdd(buf[o + P_X], buf[o + P_VX]);
    buf[o + P_Z] = fxAdd(buf[o + P_Z], buf[o + P_VZ]);
  }
  buf[BALL_BASE] = fxAdd(buf[BALL_BASE], buf[BALL_BASE + 2]);
  buf[BALL_BASE + 1] = fxAdd(buf[BALL_BASE + 1], buf[BALL_BASE + 3]);

  // 4) collisions, in a fixed order ---------------------------------------
  const playerWallCoef = fxMul(C.PLAYER_BCOEF, C.WALL_BCOEF);
  const ballWallCoef = fxMul(C.BALL_BCOEF, C.WALL_BCOEF);
  const playerPostCoef = fxMul(C.PLAYER_BCOEF, C.POST_BCOEF);
  const ballPostCoef = fxMul(C.BALL_BCOEF, C.POST_BCOEF);
  const playerPlayerCoef = fxMul(C.PLAYER_BCOEF, C.PLAYER_BCOEF);
  const playerBallCoef = fxMul(C.PLAYER_BCOEF, C.BALL_BCOEF);

  // 4a) players stay inside the rectangle; they never enter a goal mouth
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    resolveWall(buf, o, C.PLAYER_RADIUS, P_X, C.PITCH_HALF_X, playerWallCoef);
    resolveWall(buf, o, C.PLAYER_RADIUS, P_Z, C.PITCH_HALF_Z, playerWallCoef);
  }

  // 4b) ball: side walls always, goal lines only outside the mouth
  resolveWall(buf, BALL_BASE, C.BALL_RADIUS, P_X, C.PITCH_HALF_X, ballWallCoef);
  if (fxAbs(buf[BALL_BASE]) >= C.GOAL_HALF_X) {
    resolveWall(
      buf,
      BALL_BASE,
      C.BALL_RADIUS,
      P_Z,
      C.PITCH_HALF_Z,
      ballWallCoef,
    );
  }

  // 4c) the four posts
  for (let s = 0; s < 4; s++) {
    const px = s & 1 ? C.GOAL_HALF_X : -C.GOAL_HALF_X;
    const pz = s & 2 ? C.PITCH_HALF_Z : -C.PITCH_HALF_Z;
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

  // 4d) player vs player
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

  // 4e) player vs ball
  for (let i = 0; i < n; i++) {
    resolveDiscs(
      buf,
      playerOffset(i),
      BALL_BASE,
      C.PLAYER_RADIUS,
      C.BALL_RADIUS,
      C.PLAYER_INV_MASS,
      C.BALL_INV_MASS,
      playerBallCoef,
    );
  }

  // 5) damping: newSpeed = damping * oldSpeed, applied after the move -----
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    buf[o + P_VX] = fxMul(buf[o + P_VX], C.PLAYER_DAMPING);
    buf[o + P_VZ] = fxMul(buf[o + P_VZ], C.PLAYER_DAMPING);
  }
  buf[BALL_BASE + 2] = fxMul(buf[BALL_BASE + 2], C.BALL_DAMPING);
  buf[BALL_BASE + 3] = fxMul(buf[BALL_BASE + 3], C.BALL_DAMPING);

  // 6) goals --------------------------------------------------------------
  const bz = buf[BALL_BASE + 1];
  const line = C.PITCH_HALF_Z + C.BALL_RADIUS;
  if (fxAbs(buf[BALL_BASE]) < C.GOAL_HALF_X && (bz > line || bz < -line)) {
    // team 0 defends -z and attacks +z
    const scorer = bz > 0 ? 0 : 1;
    if (scorer === 0) buf[HDR_SCORE_0]++;
    else buf[HDR_SCORE_1]++;
    buf[HDR_LAST_GOAL_TEAM] = scorer;
    buf[HDR_LAST_GOAL_TICK] = buf[HDR_TICK];
    buf[HDR_KICKOFF_TEAM] = scorer === 0 ? 1 : 0; // conceding side restarts
    events.push({ type: 'goal', team: scorer, tick: buf[HDR_TICK] });
    resetKickoff(world);
  }

  // 7) advance the clock --------------------------------------------------
  buf[HDR_TICK] = (buf[HDR_TICK] + 1) | 0;
  return events;
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

/** Rebuild a world from a snapshot, rejecting anything that will not match. */
export function deserialize(snapshot) {
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
      x: buf[o + P_X] / FX_ONE,
      z: buf[o + P_Z] / FX_ONE,
      vx: buf[o + P_VX] / FX_ONE,
      vz: buf[o + P_VZ] / FX_ONE,
      kickArm: buf[o + P_KICK_ARM],
      kickCooldown: buf[o + P_KICK_CD],
    });
  }
  return {
    tick: buf[HDR_TICK],
    score: [buf[HDR_SCORE_0], buf[HDR_SCORE_1]],
    kickoffTeam: buf[HDR_KICKOFF_TEAM],
    ball: {
      x: buf[BALL_BASE] / FX_ONE,
      z: buf[BALL_BASE + 1] / FX_ONE,
      vx: buf[BALL_BASE + 2] / FX_ONE,
      vz: buf[BALL_BASE + 3] / FX_ONE,
    },
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

export const FIELD = {
  P_X,
  P_Z,
  P_VX,
  P_VZ,
  P_TEAM,
  P_KICK_ARM,
  P_KICK_CD,
  P_PREV_KICK,
};
