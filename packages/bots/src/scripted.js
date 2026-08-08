// The scripted bot: packages/client/src/core/ai.js, re-expressed as a policy.
//
// Same football, different plumbing. The old BotController and KeeperController
// read `world.ball.pos` and `player.pos` straight out of the renderer's mutable
// scene; this one sees nothing but the observation vector and returns nothing
// but an action, so it can be swapped for an ONNX policy without the host
// noticing. The behaviours are ported one for one:
//
//   BotController      get goal-side of the ball, push it at the opponent goal,
//                      swing around when caught on the wrong side, drop into a
//                      covering position when the ball is rolling at our own
//                      goal, kick when in reach
//   KeeperController   hold a guard line in front of the goal shadowing the
//                      ball's x with a velocity lead, attack the ball when it
//                      gets dangerous, clear it fieldward, never kick a ball
//                      that is goal-side of him, take a breather after a clear
//
// The numbers moved because the units did. The client works in metres on a
// 36 x 22 pitch; the core works in its own units on a 840 x 400 pitch with a
// 15-unit player radius. Every distance below is derived from the core's own
// constant table (via layout.PITCH) or is a straight rescaling of the client
// constant it replaces, noted where it matters.
//
// ------------------------------------------------------------- difficulty
//
// Three tiers, differing along three axes that are each measurable in a test
// rather than in a feeling:
//
//   reactionTicks  how stale the observation the bot acts on is. onnx-bots.md
//                  asks for +150-250 ms on easy; 13 ticks is 217 ms.
//   decisionTicks  how often the target point is recomputed. Between refreshes
//                  the bot commits to what it decided, so a coarse cadence
//                  reads as a slower, more predictable player.
//   aimNoise       seeded lateral error at the goal mouth, in core units. The
//                  bot aims at (aimNoise, goal line) instead of dead centre and
//                  then places itself on THAT line, so the error shows up as a
//                  shot that misses by roughly aimNoise at 420 units of range.
//                  A 110-unit error against a 110-unit-wide goal is an easy bot
//                  that mostly misses; 12 units is a hard bot that mostly does
//                  not. Never Math.random: the stream belongs to the policy and
//                  rewinds with reset(seed).
//   moveJitter     small positional noise on the standing target, so the bot
//                  does not track a perfect line even when it aims well.
//   pace           scale on the movement axes, i.e. on the acceleration the
//                  core applies. 0.9 costs an easy bot 10% of its top speed.
//
//        tier   reaction  decision  aimNoise  jitter  pace
//        kolay    13 t      12 t      110 u    10 u   0.90
//        orta      6 t       8 t       45 u     5 u   1.00
//        zor       1 t       4 t       12 u     2 u   1.00

import { OBS, OBS_SIZE } from './observation.js';
import { PITCH, PITCH_DIAG, SPEED } from './layout.js';
import { egoToWorld, neutralAction } from './action.js';
import { makePrng, normaliseDifficulty, assertPolicy } from './policy.js';

/** Tuning per difficulty. Everything that differs between tiers lives here. */
export const TIERS = Object.freeze({
  kolay: Object.freeze({ reactionTicks: 13, decisionTicks: 12, aimNoise: 110, moveJitter: 10, pace: 0.9 }),
  orta: Object.freeze({ reactionTicks: 6, decisionTicks: 8, aimNoise: 45, moveJitter: 5, pace: 1 }),
  zor: Object.freeze({ reactionTicks: 1, decisionTicks: 4, aimNoise: 12, moveJitter: 2, pace: 1 }),
});

// ------------------------------------------------------------- geometry

const HALF_X = PITCH.HALF_X;
const HALF_Z = PITCH.HALF_Z;
const CONTACT = PITCH.PLAYER_RADIUS + PITCH.BALL_RADIUS; // 25: surfaces touching

/** Where the bot stands to push the ball forward: just behind it on the shot line. */
const STANDOFF = CONTACT + 2;
/** Lateral swing offset when the bot is caught on the wrong side (client 1.3 m). */
const SWING_X = CONTACT + 5;
/** How far back the swing target sits along the shot line (client 1.4 m). */
const SWING_Z = 33;
/** Being this far past the ball counts as the wrong side (client 0.2 m). */
const WRONG_SIDE_MARGIN = 6;
/** Steering deadzone; below this the bot stops rather than jitters (client 0.15 m). */
const MOVE_DEADZONE = 3.5;
/**
 * Distance at which the kick intent is raised. The core connects when the
 * surface gap is under KICK_RANGE, and the 18-tick latch means intent raised a
 * little early still lands, so the trigger sits KICK_LEAD beyond the true reach.
 */
const KICK_REACH = CONTACT + PITCH.KICK_RANGE;
const KICK_LEAD = 6;
/** Never kick when the shot line points this far back toward our own goal. */
const MIN_SHOT_ALIGNMENT = -0.35;
/** Outside our own third, the kick has to actually send the ball somewhere. */
const GOOD_SHOT_ALIGNMENT = 0.25;

/** Ball speed toward our own goal that counts as an emergency (client 3 m/s). */
const PANIC_BALL_VZ = -1.15;

// --- keeper
/** Guard line distance in front of the goal (client 0.9 m). */
const GUARD_INSET = 22;
/** Ball this close to the goal centre pulls the keeper off his line (client 5 m). */
const DANGER_RADIUS = 120;
/** Keeper stands this far goal-side of the ball so the clearance goes fieldward. */
const KEEPER_BEHIND = 8;
/** Box the keeper will not leave. */
const KEEPER_MAX_X = 120;
const KEEPER_MIN_ADVANCE = 14;
const KEEPER_MAX_ADVANCE = 128;
/** How far the keeper's line shadowing leads the ball's lateral motion. */
const KEEPER_LEAD_GAIN = 8;
const KEEPER_LEAD_CAP = 20;
/** Fraction of the ball's x the keeper mirrors while holding the line. */
const KEEPER_SHADOW = 0.55;
/**
 * Kick button shape. The core arms a kick on the RISING edge only, so a button
 * held down is one kick and not a stream of them: the bot has to let go. Hold
 * long enough for the 18-tick latch to catch a contact, then release for at
 * least the core's own 8-tick cooldown. 4 + 8 ticks is 5 kicks/s, inside the
 * locked 4-12 band and under the 7.5/s the cooldown allows.
 */
const KICK_HOLD_TICKS = 4;
const KICK_RELEASE_TICKS = PITCH.KICK_COOLDOWN_TICKS;
/** The keeper's breather after a clearance, and how much it slows him. */
const CLEAR_COOLDOWN_TICKS = 72;
const CLEAR_PACE = 0.55;

// ------------------------------------------------------------------ helpers

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function len2(x, z) {
  return Math.sqrt(x * x + z * z);
}

/**
 * The handful of observation features the heuristics need, denormalised back to
 * core units in the attack frame. Reading through OBS by name means a spec
 * reorder cannot silently feed the bot the wrong number.
 */
function decodeObs(o, s) {
  s.selfX = o[OBS.self_x] * HALF_X;
  s.selfZ = o[OBS.self_z] * HALF_Z;
  s.ballX = o[OBS.ball_x] * HALF_X;
  s.ballZ = o[OBS.ball_z] * HALF_Z;
  s.ballVX = o[OBS.ball_vx] * SPEED.BALL;
  s.ballVZ = o[OBS.ball_vz] * SPEED.BALL;
  s.ballDist = o[OBS.ball_dist] * PITCH_DIAG;
  s.ballGoalDist = o[OBS.ball_opp_goal_dist] * PITCH_DIAG;
  s.alignment = o[OBS.shot_alignment];
  // self_kick_ready / self_kick_cd are in the spec for a learned policy to use;
  // this one owns its own press-release timer and does not need to read them.
  s.keeper = o[OBS.role_keeper] > 0.5;
  return s;
}

function newSample() {
  return {
    selfX: 0,
    selfZ: 0,
    ballX: 0,
    ballZ: 0,
    ballVX: 0,
    ballVZ: 0,
    ballDist: 0,
    ballGoalDist: 0,
    alignment: 0,
    keeper: false,
  };
}

// ------------------------------------------------------------------- policy

/**
 * createScriptedPolicy({ difficulty, id, seed, role, tier })
 *
 *   difficulty  'kolay' | 'orta' | 'zor' (easy/medium/hard also accepted)
 *   role        'field' | 'keeper'; the observation's role flag wins when set
 *   tier        overrides for the TIERS entry, for tuning experiments
 *
 * Returns a BotPolicy. Deterministic: reset(seed) then the same observation
 * sequence always produces the same action sequence.
 */
export function createScriptedPolicy(options = {}) {
  const difficulty = normaliseDifficulty(options.difficulty);
  const tier = { ...TIERS[difficulty], ...(options.tier || {}) };
  const baseSeed = options.seed == null ? 1 : options.seed >>> 0;
  const defaultRole = options.role === 'keeper' ? 'keeper' : 'field';

  const rng = makePrng(baseSeed);

  // Observation history for the reaction delay. One extra slot so the write
  // never overwrites the sample that is about to be read.
  const ringLength = tier.reactionTicks + 1;
  const ring = [];
  for (let i = 0; i < ringLength; i++) ring.push(new Float32Array(OBS_SIZE));
  let ringHead = -1;
  let ringFilled = 0;

  const sample = newSample();
  const action = neutralAction();
  const ego = neutralAction();

  let decisionCountdown = 0;
  let targetX = 0;
  let targetZ = 0;
  let aimX = 0;
  let noiseX = 0;
  let noiseZ = 0;
  let clearCooldown = 0;
  let kickHold = 0;
  let kickRelease = 0;

  function reset(seed) {
    rng.reset(seed == null ? baseSeed : seed >>> 0);
    ringHead = -1;
    ringFilled = 0;
    for (const r of ring) r.fill(0);
    decisionCountdown = 0;
    targetX = 0;
    targetZ = 0;
    aimX = 0;
    noiseX = 0;
    noiseZ = 0;
    clearCooldown = 0;
    kickHold = 0;
    kickRelease = 0;
  }

  /** Push `obs` into the ring and return the sample the bot is allowed to see. */
  function delayed(obs) {
    ringHead = (ringHead + 1) % ringLength;
    ring[ringHead].set(obs);
    if (ringFilled < ringLength) ringFilled++;
    // Before the ring has filled, the bot reads the oldest sample it has, which
    // is exactly what a player who just walked onto the pitch would know.
    const back = Math.min(tier.reactionTicks, ringFilled - 1);
    const idx = (ringHead - back + ringLength) % ringLength;
    return ring[idx];
  }

  // --------------------------------------------------------- field player

  function decideField(s) {
    // Direction the ball has to travel: from the ball toward the point the bot
    // is aiming at, which is the goal centre plus this decision's aim error.
    const gx = aimX - s.ballX;
    const gz = HALF_Z - s.ballZ;
    const gl = len2(gx, gz) || 1;
    const ux = gx / gl;
    const uz = gz / gl;

    // Rolling at our own goal and we are behind it: drop into cover instead of
    // chasing round the outside.
    const towardOwn = s.ballVZ < PANIC_BALL_VZ;
    const inOwnHalf = s.ballZ < 0;
    if (towardOwn && inOwnHalf) {
      targetX = s.ballX / 2;
      targetZ = (s.ballZ - HALF_Z) / 2;
      return;
    }

    // Caught between the ball and the goal we are attacking: swing around the
    // side rather than shoving the ball backwards.
    if (s.selfZ - s.ballZ > WRONG_SIDE_MARGIN) {
      const side = s.selfX >= s.ballX ? 1 : -1;
      targetX = s.ballX + side * SWING_X;
      targetZ = s.ballZ - uz * SWING_Z;
      return;
    }

    // Otherwise: stand just behind the ball on the shot line and push.
    targetX = s.ballX - ux * STANDOFF;
    targetZ = s.ballZ - uz * STANDOFF;
  }

  function kickField(s) {
    if (s.ballDist > KICK_REACH + KICK_LEAD) return false;
    // Inside our own third any clearance is progress. Further up the pitch the
    // kick has to be roughly goalward, otherwise the bot spends the match
    // poking the ball sideways — and a bot that scores own goals is worse than
    // one that does nothing.
    const defensive = s.ballZ < -HALF_Z / 3;
    return s.alignment >= (defensive ? MIN_SHOT_ALIGNMENT : GOOD_SHOT_ALIGNMENT);
  }

  // --------------------------------------------------------------- keeper

  function decideKeeper(s) {
    const goalZ = -HALF_Z;
    const distGoal = len2(s.ballX, s.ballZ - goalZ);
    if (distGoal < DANGER_RADIUS) {
      // Attack the ball from the goal side so the clearance travels fieldward.
      targetX = clamp(s.ballX, -KEEPER_MAX_X, KEEPER_MAX_X);
      targetZ = clamp(
        s.ballZ - KEEPER_BEHIND,
        goalZ + KEEPER_MIN_ADVANCE,
        goalZ + KEEPER_MAX_ADVANCE,
      );
      return;
    }
    const lead = clamp(s.ballVX * KEEPER_LEAD_GAIN, -KEEPER_LEAD_CAP, KEEPER_LEAD_CAP);
    const lim = Math.max(0, PITCH.GOAL_HALF_X - 10);
    targetX = clamp(s.ballX * KEEPER_SHADOW + lead, -lim, lim);
    targetZ = goalZ + GUARD_INSET;
  }

  function kickKeeper(s) {
    if (clearCooldown > 0) return false;
    // Fieldward only: kicking a ball that is behind the keeper is an own goal.
    if (s.ballZ <= s.selfZ) return false;
    if (s.ballDist > KICK_REACH + KICK_LEAD) return false;
    return true;
  }

  // ------------------------------------------------------------------ act

  function act(obs, ctx) {
    const view = delayed(obs);
    decodeObs(view, sample);
    const keeper = sample.keeper || (ctx && ctx.role === 'keeper') || defaultRole === 'keeper';

    if (clearCooldown > 0) clearCooldown--;

    if (decisionCountdown <= 0) {
      decisionCountdown = tier.decisionTicks;
      // Fresh aim error and standing jitter per decision, from the policy's own
      // stream. Order matters: aimX is consumed by decideField below.
      aimX = clamp(rng.signed() * tier.aimNoise, -HALF_X, HALF_X);
      noiseX = rng.signed() * tier.moveJitter;
      noiseZ = rng.signed() * tier.moveJitter;
      if (keeper) decideKeeper(sample);
      else decideField(sample);
    }
    decisionCountdown--;

    let dx = targetX + noiseX - sample.selfX;
    let dz = targetZ + noiseZ - sample.selfZ;
    const len = len2(dx, dz);
    if (len > MOVE_DEADZONE) {
      dx /= len;
      dz /= len;
    } else {
      dx = 0;
      dz = 0;
    }

    let pace = tier.pace;
    if (keeper && clearCooldown > 0) pace *= CLEAR_PACE;

    // Kick intent: press, hold long enough for the core's latch to catch a
    // contact, then release long enough for the next press to be a fresh rising
    // edge. The keeper takes a longer breather after every clearance.
    let kick = false;
    if (kickHold > 0) {
      kickHold--;
      kick = true;
    } else if (kickRelease > 0) {
      kickRelease--;
    } else if (keeper ? kickKeeper(sample) : kickField(sample)) {
      kick = true;
      kickHold = KICK_HOLD_TICKS - 1;
      kickRelease = KICK_RELEASE_TICKS;
      if (keeper) clearCooldown = CLEAR_COOLDOWN_TICKS;
    }

    ego.moveX = dx * pace;
    ego.moveZ = dz * pace;
    ego.kick = kick;
    // Phase 1.2 fields, already carried: a long-range shot asks for a charge, a
    // keeper clearance never does. The core ignores them until it does not.
    ego.charge = !keeper && kick && sample.ballGoalDist > 0.45 * PITCH_DIAG;
    ego.slide = false;
    ego.catch = false;
    ego.clear = keeper && kick;
    ego.chargeLevel = ego.charge ? clamp(sample.ballGoalDist / (0.7 * PITCH_DIAG), 0.25, 1) : 0;

    return egoToWorld(ego, ctx && ctx.attackSign != null ? ctx.attackSign : 1, action);
  }

  const policy = {
    id: options.id || `scripted-${difficulty}`,
    kind: 'scripted',
    difficulty,
    role: defaultRole,
    tier: Object.freeze({ ...tier }),
    reset,
    act,
  };
  reset(baseSeed);
  return assertPolicy(policy, `scripted(${difficulty})`);
}

/** Shorthand: one scripted policy per difficulty, sharing a base seed. */
export function createScriptedTiers(seed = 1) {
  return {
    kolay: createScriptedPolicy({ difficulty: 'kolay', seed }),
    orta: createScriptedPolicy({ difficulty: 'orta', seed }),
    zor: createScriptedPolicy({ difficulty: 'zor', seed }),
  };
}
