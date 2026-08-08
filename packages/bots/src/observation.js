// observe(world, playerIndex, opts) -> Float32Array of fixed length.
//
// The single contract between a football situation and a policy. A scripted
// heuristic and a trained network see exactly the same numbers in exactly the
// same slots, which is the whole point of Phase 1.5: swapping the brain must
// not require touching anything else.
//
// ---------------------------------------------------------------- properties
//
// Fixed length. OBS_SIZE never depends on how many players are on the pitch.
// Absent team-mates and opponents occupy their slots with a present=0 flag and
// zeroed geometry, so a policy trained on 3v3 can be run in 1v1 unchanged.
//
// Egocentric. Every coordinate is expressed in the observing player's ATTACK
// frame: team 0 attacks +z and sees the world as it is; team 1 attacks -z and
// sees the world rotated 180 degrees about the vertical axis, i.e.
// (x, z) -> (-x, -z). This is a rotation and not a mirror on purpose — mirroring
// only z would flip handedness, and a policy that had learned "cut inside from
// the left" would come out cutting outside. After the rotation, "forward" is
// always +z and the opponent goal is always at (0, +HALF_Z).
//
// Deterministic ordering. Team-mates and opponents are sorted by squared
// distance to the observer, ties broken by ascending player index. Nothing here
// depends on iteration order, Map ordering, join order or roster order, so the
// same pitch always yields the same vector on any host.
//
// Bounded. Every feature is clamped into its declared range, so an INT8
// quantised network never sees an input outside its calibration set. Ranges are
// declared in OBSERVATION_SPEC and asserted by the test gate.
//
// Float discipline. Only +, -, *, / and Math.sqrt are used. Math.hypot,
// Math.atan2 and the transcendentals are implementation-approximated in the
// ECMAScript spec and are banned here for the same reason packages/core banned
// them: two engines must not disagree.
//
// ------------------------------------------------------------ python mirror
//
// OBSERVATION_SPEC is exported as a plain (index, name, lo, hi, description)
// table precisely so the Phase 2 PettingZoo environment can mirror it field for
// field, and so the parity harness can diff a JS vector against a NumPy one by
// name rather than by position. Print it with
//   node -e "import('./packages/bots/src/observation.js').then(m=>console.log(m.specTable()))"

import {
  PITCH,
  PITCH_DIAG,
  SPEED,
  attackSignOf,
  createScene,
  readScene,
} from './layout.js';

/** Team-mate slots (excluding self) and opponent slots in the vector. */
export const MATE_SLOTS = 5;
export const OPP_SLOTS = 6;
/** Floats per team-mate / opponent slot. */
export const ENTITY_STRIDE = 6;

const REL_X = 2 * PITCH.HALF_X; // widest possible x separation
const REL_Z = 2 * PITCH.HALF_Z; // longest possible z separation

// ------------------------------------------------------------------- spec

function buildSpec(mateSlots, oppSlots) {
  const spec = [];
  const add = (name, lo, hi, desc) => {
    spec.push({ index: spec.length, name, lo, hi, desc });
  };

  // --- self kinematics and kick state (10)
  add('self_x', -1, 1, 'own x / PITCH_HALF_X, attack frame');
  add('self_z', -1, 1, 'own z / PITCH_HALF_Z, attack frame (+1 = opponent goal line)');
  add('self_vx', -1, 1, 'own vx / SPEED.PLAYER, attack frame');
  add('self_vz', -1, 1, 'own vz / SPEED.PLAYER, attack frame');
  add('self_speed', 0, 1, '|own velocity| / SPEED.PLAYER');
  add('self_kick_ready', 0, 1, '1 when the kick cooldown has expired');
  add('self_kick_cd', 0, 1, 'remaining kick cooldown / KICK_COOLDOWN_TICKS');
  add('self_kick_armed', 0, 1, 'remaining kick latch / KICK_LATCH_TICKS');
  add('self_dist_own_goal', 0, 1, 'distance to own goal centre / PITCH_DIAG');
  add('self_dist_opp_goal', 0, 1, 'distance to opponent goal centre / PITCH_DIAG');

  // --- ball, absolute and relative (10)
  add('ball_x', -1, 1, 'ball x / PITCH_HALF_X, attack frame');
  add('ball_z', -1, 1, 'ball z / PITCH_HALF_Z, attack frame');
  add('ball_vx', -1, 1, 'ball vx / SPEED.BALL, attack frame');
  add('ball_vz', -1, 1, 'ball vz / SPEED.BALL, attack frame');
  add('ball_dx', -1, 1, '(ball.x - self.x) / (2*PITCH_HALF_X)');
  add('ball_dz', -1, 1, '(ball.z - self.z) / (2*PITCH_HALF_Z)');
  add('ball_dist', 0, 1, 'centre distance to the ball / PITCH_DIAG');
  add('ball_dir_x', -1, 1, 'unit vector self -> ball, x component');
  add('ball_dir_z', -1, 1, 'unit vector self -> ball, z component');
  add('ball_closing', -1, 1, 'gap closing rate along self->ball / SPEED.BALL (+ = closing)');

  // --- goal-relative geometry (8)
  add('opp_goal_dx', -1, 1, '(opponent goal centre x - self.x) / (2*PITCH_HALF_X)');
  add('opp_goal_dz', -1, 1, '(opponent goal centre z - self.z) / (2*PITCH_HALF_Z)');
  add('opp_goal_dist', 0, 1, 'distance self -> opponent goal centre / PITCH_DIAG');
  add('own_goal_dx', -1, 1, '(own goal centre x - self.x) / (2*PITCH_HALF_X)');
  add('own_goal_dz', -1, 1, '(own goal centre z - self.z) / (2*PITCH_HALF_Z)');
  add('own_goal_dist', 0, 1, 'distance self -> own goal centre / PITCH_DIAG');
  add('ball_opp_goal_dist', 0, 1, 'distance ball -> opponent goal centre / PITCH_DIAG');
  add('shot_alignment', -1, 1, 'dot(unit(self->ball), unit(ball->opponent goal)); +1 = perfectly behind the ball');

  // --- role and match context (6)
  add('role_field', 0, 1, '1 when this bot plays as an outfield player');
  add('role_keeper', 0, 1, '1 when this bot plays as the goalkeeper');
  add('possession', -1, 1, '+1 when the player nearest the ball is on our team, -1 otherwise');
  add('self_nearest', 0, 1, '1 when this player is the one nearest the ball');
  add('mate_count', 0, 1, 'number of present team-mates / MATE_SLOTS');
  add('score_diff', -1, 1, '(our goals - their goals) / 5, clamped');

  // --- team-mates then opponents, nearest first (mateSlots+oppSlots) * 6
  const entity = (prefix, k) => {
    add(`${prefix}${k}_present`, 0, 1, `1 when slot ${k} is occupied`);
    add(`${prefix}${k}_dx`, -1, 1, 'relative x / (2*PITCH_HALF_X), attack frame');
    add(`${prefix}${k}_dz`, -1, 1, 'relative z / (2*PITCH_HALF_Z), attack frame');
    add(`${prefix}${k}_dist`, 0, 1, 'centre distance / PITCH_DIAG');
    add(`${prefix}${k}_vx`, -1, 1, 'their vx / SPEED.PLAYER, attack frame');
    add(`${prefix}${k}_vz`, -1, 1, 'their vz / SPEED.PLAYER, attack frame');
  };
  for (let k = 0; k < mateSlots; k++) entity('mate', k);
  for (let k = 0; k < oppSlots; k++) entity('opp', k);

  return spec;
}

/**
 * buildObservationSpec({ mateSlots, oppSlots }) -> spec array.
 * Exposed so an experiment can size the vector differently; the DEFAULT spec
 * below is the one Phase 2 mirrors and the one every shipped model uses.
 */
export function buildObservationSpec(opts = {}) {
  const mateSlots = opts.mateSlots == null ? MATE_SLOTS : opts.mateSlots | 0;
  const oppSlots = opts.oppSlots == null ? OPP_SLOTS : opts.oppSlots | 0;
  return buildSpec(mateSlots, oppSlots);
}

/** The canonical table. Index, name, range and meaning of every feature. */
export const OBSERVATION_SPEC = Object.freeze(
  buildSpec(MATE_SLOTS, OPP_SLOTS).map(Object.freeze),
);

/** Length of a default observation vector. */
export const OBS_SIZE = OBSERVATION_SPEC.length;

/** name -> index, so nothing downstream ever writes a bare integer. */
export const OBS = Object.freeze(
  Object.fromEntries(OBSERVATION_SPEC.map((f) => [f.name, f.index])),
);

/** Version tag for the layout. Bump on any spec change; models pin it. */
export const OBSERVATION_VERSION = 1;

/** Human/Python readable dump of the spec. */
export function specTable(spec = OBSERVATION_SPEC) {
  const lines = [`# observation v${OBSERVATION_VERSION}, ${spec.length} features`];
  for (const f of spec) {
    lines.push(
      `${String(f.index).padStart(3)}  ${f.name.padEnd(22)} [${String(f.lo).padStart(2)}, ${f.hi}]  ${f.desc}`,
    );
  }
  return lines.join('\n');
}

// ------------------------------------------------------------------ helpers

function clamp(v, lo, hi) {
  if (!(v === v)) return 0; // NaN guard; a bot never gets to see NaN
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

const c1 = (v) => clamp(v, -1, 1);
const c01 = (v) => clamp(v, 0, 1);

function len2(x, z) {
  return Math.sqrt(x * x + z * z);
}

// Scratch arrays reused across calls: `observe` is hot on the host (one call
// per bot per decision) and must not churn the allocator.
const scratchMates = [];
const scratchOpps = [];

/** Ascending by squared distance, ties broken by ascending player index. */
function byDistanceThenIndex(a, b) {
  if (a.d2 !== b.d2) return a.d2 - b.d2;
  return a.index - b.index;
}

// ------------------------------------------------------------------ observe

/**
 * observe(world, playerIndex, opts) -> Float32Array
 *
 *   world        a @goalnet/core world (only read, never written)
 *   playerIndex  the observing player
 *   opts.role    'field' | 'keeper'; defaults to the core's role field when it
 *                exists, otherwise 'field'
 *   opts.out     a Float32Array of OBS_SIZE to fill in place
 *   opts.scene   a reusable scene from layout.createScene(playerCount)
 *   opts.spec    an alternative spec from buildObservationSpec()
 *
 * Pure: same world + same arguments => bit-identical vector, always.
 */
export function observe(world, playerIndex, opts = {}) {
  const spec = opts.spec || OBSERVATION_SPEC;
  const size = spec.length;
  const out = opts.out && opts.out.length === size ? opts.out : new Float32Array(size);
  out.fill(0);

  const scene = readScene(world, opts.scene || createScene(world.playerCount));
  const n = scene.playerCount;
  if (!(playerIndex >= 0 && playerIndex < n)) {
    throw new RangeError(`observe: playerIndex ${playerIndex} outside 0..${n - 1}`);
  }

  const self = scene.players[playerIndex];
  const sign = attackSignOf(self.team);

  // Attack frame: a 180 degree yaw for team 1, identity for team 0.
  const sx = sign * self.x;
  const sz = sign * self.z;
  const svx = sign * self.vx;
  const svz = sign * self.vz;
  const bx = sign * scene.ball.x;
  const bz = sign * scene.ball.z;
  const bvx = sign * scene.ball.vx;
  const bvz = sign * scene.ball.vz;

  // Goals in the attack frame: always the same two points, whatever the team.
  const oppGoalX = 0;
  const oppGoalZ = PITCH.HALF_Z;
  const ownGoalX = 0;
  const ownGoalZ = -PITCH.HALF_Z;

  // Layout is honoured by name, so a spec reorder cannot silently misfile a
  // feature; a missing name throws on the undefined index instead.
  const I = spec === OBSERVATION_SPEC ? OBS : indexMap(spec);

  // --- self ---------------------------------------------------------------
  out[I.self_x] = c1(sx / PITCH.HALF_X);
  out[I.self_z] = c1(sz / PITCH.HALF_Z);
  out[I.self_vx] = c1(svx / SPEED.PLAYER);
  out[I.self_vz] = c1(svz / SPEED.PLAYER);
  out[I.self_speed] = c01(len2(svx, svz) / SPEED.PLAYER);
  out[I.self_kick_ready] = self.kickCooldown > 0 ? 0 : 1;
  out[I.self_kick_cd] = c01(self.kickCooldown / PITCH.KICK_COOLDOWN_TICKS);
  out[I.self_kick_armed] = c01(self.kickArm / PITCH.KICK_LATCH_TICKS);

  const dOwnX = ownGoalX - sx;
  const dOwnZ = ownGoalZ - sz;
  const dOppX = oppGoalX - sx;
  const dOppZ = oppGoalZ - sz;
  const distOwn = len2(dOwnX, dOwnZ);
  const distOpp = len2(dOppX, dOppZ);
  out[I.self_dist_own_goal] = c01(distOwn / PITCH_DIAG);
  out[I.self_dist_opp_goal] = c01(distOpp / PITCH_DIAG);

  // --- ball ---------------------------------------------------------------
  const bdx = bx - sx;
  const bdz = bz - sz;
  const bdist = len2(bdx, bdz);
  const bux = bdist > 0 ? bdx / bdist : 0;
  const buz = bdist > 0 ? bdz / bdist : 0;

  out[I.ball_x] = c1(bx / PITCH.HALF_X);
  out[I.ball_z] = c1(bz / PITCH.HALF_Z);
  out[I.ball_vx] = c1(bvx / SPEED.BALL);
  out[I.ball_vz] = c1(bvz / SPEED.BALL);
  out[I.ball_dx] = c1(bdx / REL_X);
  out[I.ball_dz] = c1(bdz / REL_Z);
  out[I.ball_dist] = c01(bdist / PITCH_DIAG);
  out[I.ball_dir_x] = c1(bux);
  out[I.ball_dir_z] = c1(buz);
  // Positive when the gap is shrinking: our motion along the axis minus theirs.
  out[I.ball_closing] = c1(((svx - bvx) * bux + (svz - bvz) * buz) / SPEED.BALL);

  // --- goal geometry ------------------------------------------------------
  out[I.opp_goal_dx] = c1(dOppX / REL_X);
  out[I.opp_goal_dz] = c1(dOppZ / REL_Z);
  out[I.opp_goal_dist] = c01(distOpp / PITCH_DIAG);
  out[I.own_goal_dx] = c1(dOwnX / REL_X);
  out[I.own_goal_dz] = c1(dOwnZ / REL_Z);
  out[I.own_goal_dist] = c01(distOwn / PITCH_DIAG);

  const bgx = oppGoalX - bx;
  const bgz = oppGoalZ - bz;
  const bgd = len2(bgx, bgz);
  out[I.ball_opp_goal_dist] = c01(bgd / PITCH_DIAG);
  out[I.shot_alignment] = bdist > 0 && bgd > 0 ? c1(bux * (bgx / bgd) + buz * (bgz / bgd)) : 0;

  // --- role and context ---------------------------------------------------
  const role = resolveRole(self, opts.role);
  out[I.role_field] = role === 'keeper' ? 0 : 1;
  out[I.role_keeper] = role === 'keeper' ? 1 : 0;

  // --- team-mates and opponents, nearest first ---------------------------
  scratchMates.length = 0;
  scratchOpps.length = 0;
  let nearestIndex = playerIndex;
  let nearestD2 = Infinity;
  for (let i = 0; i < n; i++) {
    const p = scene.players[i];
    const pdx = sign * p.x - bx;
    const pdz = sign * p.z - bz;
    const pd2 = pdx * pdx + pdz * pdz;
    if (pd2 < nearestD2 || (pd2 === nearestD2 && i < nearestIndex)) {
      nearestD2 = pd2;
      nearestIndex = i;
    }
    if (i === playerIndex) continue;
    const ex = sign * p.x - sx;
    const ez = sign * p.z - sz;
    const entry = {
      index: i,
      d2: ex * ex + ez * ez,
      ex,
      ez,
      evx: sign * p.vx,
      evz: sign * p.vz,
    };
    if (p.team === self.team) scratchMates.push(entry);
    else scratchOpps.push(entry);
  }
  scratchMates.sort(byDistanceThenIndex);
  scratchOpps.sort(byDistanceThenIndex);

  const nearestTeam = scene.players[nearestIndex].team;
  out[I.possession] = nearestTeam === self.team ? 1 : -1;
  out[I.self_nearest] = nearestIndex === playerIndex ? 1 : 0;
  out[I.mate_count] = c01(scratchMates.length / MATE_SLOTS);
  const ours = scene.score[self.team];
  const theirs = scene.score[self.team === 0 ? 1 : 0];
  out[I.score_diff] = c1((ours - theirs) / 5);

  writeEntities(out, I, 'mate', scratchMates, MATE_SLOTS);
  writeEntities(out, I, 'opp', scratchOpps, OPP_SLOTS);

  return out;
}

function writeEntities(out, I, prefix, list, slots) {
  for (let k = 0; k < slots; k++) {
    const base = I[`${prefix}${k}_present`];
    if (base === undefined) break; // a custom spec may declare fewer slots
    const e = list[k];
    if (!e) continue; // already zeroed, present stays 0
    const d = Math.sqrt(e.d2);
    out[base] = 1;
    out[base + 1] = c1(e.ex / REL_X);
    out[base + 2] = c1(e.ez / REL_Z);
    out[base + 3] = c01(d / PITCH_DIAG);
    out[base + 4] = c1(e.evx / SPEED.PLAYER);
    out[base + 5] = c1(e.evz / SPEED.PLAYER);
  }
}

function resolveRole(self, explicit) {
  if (explicit === 'keeper' || explicit === 'field') return explicit;
  // The core may grow a role field (goalkeeper.md: the role is picked in the
  // lobby and fixed for the match). Until then, callers pass it in.
  if (self.role === 1) return 'keeper';
  return 'field';
}

/** name -> index for a custom spec. */
export function indexMap(spec) {
  return Object.fromEntries(spec.map((f) => [f.name, f.index]));
}

/**
 * Assert every value of `obs` sits inside its declared range. Returns the list
 * of violations, empty when the vector is clean.
 */
export function checkBounds(obs, spec = OBSERVATION_SPEC) {
  const bad = [];
  for (const f of spec) {
    const v = obs[f.index];
    if (!Number.isFinite(v) || v < f.lo || v > f.hi) {
      bad.push({ index: f.index, name: f.name, value: v, lo: f.lo, hi: f.hi });
    }
  }
  return bad;
}
