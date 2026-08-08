// THE ONE PLACE @goalnet/bots KNOWS THE CORE STATE LAYOUT.
//
// Everything else in this package (observation, scripted heuristics, the ONNX
// wrapper, the tests) reads a plain-number `scene` object produced here and
// never touches `world.buf` or a FIELD offset itself. When packages/core grows
// a field — dribbling, shot charge, curve, slide tackle, keeper flags — the
// edit lands in this file and nowhere else.
//
// How it survives a core that is being edited underneath it
//   * offsets come from the core's own exported symbols (BALL_BASE,
//     playerOffset, PLAYER_STRIDE, FIELD), never from literals
//   * OPTIONAL_FIELDS are looked up by name and resolve to null when the core
//     has not grown them yet; the scene carries `null` for those and consumers
//     treat null as "mechanic absent". Adding P_CHARGE to core's FIELD is
//     therefore enough to make `scene.players[i].charge` start reporting.
//   * a shape assertion runs once at module load, so a layout change that this
//     file has not been taught about fails loudly instead of silently reading
//     the wrong int.
//
// Units. The core stores Q16.16 raw integers; the scene is plain floats in
// core world units (pitch is 400 x 840 units, player radius 15, ball radius
// 10). No normalisation happens here — that is observation.js's job.

import {
  BALL_BASE,
  PLAYER_STRIDE,
  FIELD,
  playerOffset,
  stateLength,
  HDR_TICK,
  HDR_PLAYER_COUNT,
  HDR_SCORE_0,
  HDR_SCORE_1,
  CONSTANTS,
  fx,
} from '../../core/src/index.js';

/** Q16.16 raw -> plain float in core world units. */
export const FX_ONE = fx.FX_ONE;
export function u(raw) {
  return raw / FX_ONE;
}

// --------------------------------------------------------------- offsets

/** Fields this package cannot work without. Absence is a hard error. */
const REQUIRED_FIELDS = ['P_X', 'P_Z', 'P_VX', 'P_VZ', 'P_TEAM'];

/**
 * Fields this package uses when the core has them. `scene` name on the left,
 * core FIELD key on the right. Anything unresolved reports as null.
 *
 * Phase 1.2 names are listed ahead of time on purpose: the concurrent core
 * work adds dribbling / charge / curve / tackle / keeper state, and the moment
 * those keys appear in core's FIELD export this table picks them up with no
 * further edit. Spelling variants are tried in order.
 */
const OPTIONAL_FIELDS = {
  kickArm: ['P_KICK_ARM'],
  kickCooldown: ['P_KICK_CD', 'P_KICK_COOLDOWN'],
  prevKick: ['P_PREV_KICK'],
  charge: ['P_CHARGE', 'P_KICK_CHARGE'],
  curve: ['P_CURVE', 'P_SPIN'],
  slide: ['P_SLIDE', 'P_TACKLE'],
  slideCooldown: ['P_SLIDE_CD', 'P_TACKLE_CD'],
  role: ['P_ROLE'],
  holdTicks: ['P_HOLD', 'P_CATCH_TICKS'],
};

function resolveOptional() {
  const out = {};
  for (const [name, candidates] of Object.entries(OPTIONAL_FIELDS)) {
    let hit = null;
    for (const key of candidates) {
      if (Object.prototype.hasOwnProperty.call(FIELD, key)) {
        hit = FIELD[key];
        break;
      }
    }
    out[name] = hit;
  }
  return out;
}

for (const key of REQUIRED_FIELDS) {
  if (!Object.prototype.hasOwnProperty.call(FIELD, key)) {
    throw new Error(
      `bots/layout: core FIELD is missing ${key}; the state layout changed in a way this file has not been taught`,
    );
  }
}

/** Resolved per-player slot offsets. Optional entries are null when absent. */
export const SLOT = Object.freeze({
  x: FIELD.P_X,
  z: FIELD.P_Z,
  vx: FIELD.P_VX,
  vz: FIELD.P_VZ,
  team: FIELD.P_TEAM,
  ...resolveOptional(),
});

/** Which optional mechanics this core build actually exposes. */
export const AVAILABLE = Object.freeze(
  Object.fromEntries(
    Object.keys(OPTIONAL_FIELDS).map((k) => [k, SLOT[k] !== null]),
  ),
);

// The ball occupies the same x/z/vx/vz prefix as a player, which is what makes
// the core's collision routines index-agnostic. If that ever stops being true
// the assertion below is where it gets caught.
if (!(SLOT.x === 0 && SLOT.z === 1 && SLOT.vx === 2 && SLOT.vz === 3)) {
  throw new Error(
    'bots/layout: core no longer lays out x,z,vx,vz as the first four slots; ball reads must be revisited',
  );
}
if (PLAYER_STRIDE < 5) {
  throw new Error(`bots/layout: PLAYER_STRIDE ${PLAYER_STRIDE} is too small to hold the required fields`);
}

// ------------------------------------------------------- geometry constants

const C = CONSTANTS;

/**
 * Everything about the pitch a bot is allowed to know, in world units.
 * Derived from the locked constant table, never hardcoded.
 */
export const PITCH = Object.freeze({
  HALF_X: u(C.PITCH_HALF_X), // 200 — touchlines at x = +/-200
  HALF_Z: u(C.PITCH_HALF_Z), // 420 — goal lines at z = +/-420
  GOAL_HALF_X: u(C.GOAL_HALF_X), // 55 — goal mouth half width
  PLAYER_RADIUS: u(C.PLAYER_RADIUS), // 15
  BALL_RADIUS: u(C.BALL_RADIUS), // 10
  POST_RADIUS: u(C.POST_RADIUS), // 8
  KICK_RANGE: u(C.KICK_RANGE), // 4, measured surface-to-surface
  KICK_IMPULSE: u(C.KICK_IMPULSE), // 5 units/tick added to the ball
  KICK_COOLDOWN_TICKS: C.KICK_COOLDOWN_TICKS | 0,
  KICK_LATCH_TICKS: C.KICK_LATCH_TICKS | 0,
  SPAWN_Z: u(C.SPAWN_Z),
  TICK_RATE: C.TICK_RATE | 0,
  MAX_PLAYERS: C.MAX_PLAYERS | 0,
});

/**
 * Reference speeds used for normalisation.
 *
 * A player's terminal speed is the fixed point of v' = (v + a) * d, i.e.
 * a*d/(1-d) — about 2.4 units/tick with the locked table. The ball reference
 * is one clean kick off a running player, which is the fastest thing that
 * routinely happens; faster balls exist (stacked impulses) and clamp.
 */
const _accel = u(C.PLAYER_ACCEL);
const _damping = u(C.PLAYER_DAMPING);
export const SPEED = Object.freeze({
  PLAYER: (_accel * _damping) / (1 - _damping),
  BALL: PITCH.KICK_IMPULSE + (_accel * _damping) / (1 - _damping),
});

/** Longest straight line on the pitch: corner to opposite corner. */
export const PITCH_DIAG = Math.sqrt(
  4 * PITCH.HALF_X * PITCH.HALF_X + 4 * PITCH.HALF_Z * PITCH.HALF_Z,
);

/** Centre of the goal a team attacks / defends. Team 0 attacks +z. */
export function attackSignOf(team) {
  return team === 0 ? 1 : -1;
}

// ------------------------------------------------------------------- scene

/** Allocate a reusable scene for `playerCount` players. */
export function createScene(playerCount) {
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({
      index: i,
      team: 0,
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      kickArm: 0,
      kickCooldown: 0,
      prevKick: 0,
      charge: null,
      curve: null,
      slide: null,
      slideCooldown: null,
      role: null,
      holdTicks: null,
    });
  }
  return {
    tick: 0,
    playerCount,
    score: [0, 0],
    ball: { x: 0, z: 0, vx: 0, vz: 0 },
    players,
  };
}

function readOptional(buf, base, name) {
  const off = SLOT[name];
  return off === null || off === undefined ? null : buf[base + off];
}

/**
 * Fill `scene` from `world`. Allocation-free when the scene is reused, which
 * matters because this runs once per bot per decision on the host.
 */
export function readScene(world, scene) {
  const buf = world.buf;
  const n = world.playerCount != null ? world.playerCount : buf[HDR_PLAYER_COUNT];
  const s = scene && scene.playerCount === n ? scene : createScene(n);

  if (buf.length < stateLength(n)) {
    throw new Error('bots/layout: state buffer is shorter than the declared player count');
  }

  s.tick = buf[HDR_TICK];
  s.score[0] = buf[HDR_SCORE_0];
  s.score[1] = buf[HDR_SCORE_1];

  s.ball.x = u(buf[BALL_BASE + SLOT.x]);
  s.ball.z = u(buf[BALL_BASE + SLOT.z]);
  s.ball.vx = u(buf[BALL_BASE + SLOT.vx]);
  s.ball.vz = u(buf[BALL_BASE + SLOT.vz]);

  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    const p = s.players[i];
    p.index = i;
    p.team = buf[o + SLOT.team];
    p.x = u(buf[o + SLOT.x]);
    p.z = u(buf[o + SLOT.z]);
    p.vx = u(buf[o + SLOT.vx]);
    p.vz = u(buf[o + SLOT.vz]);
    // Tick counters are plain integers in the core, not Q16.16.
    p.kickArm = readOptional(buf, o, 'kickArm') || 0;
    p.kickCooldown = readOptional(buf, o, 'kickCooldown') || 0;
    p.prevKick = readOptional(buf, o, 'prevKick') || 0;
    p.slideCooldown = readOptional(buf, o, 'slideCooldown');
    p.role = readOptional(buf, o, 'role');
    p.holdTicks = readOptional(buf, o, 'holdTicks');
    // Q16.16-valued optionals go through u().
    const charge = readOptional(buf, o, 'charge');
    p.charge = charge === null ? null : u(charge);
    const curve = readOptional(buf, o, 'curve');
    p.curve = curve === null ? null : u(curve);
    const slide = readOptional(buf, o, 'slide');
    p.slide = slide === null ? null : slide;
  }
  return s;
}
