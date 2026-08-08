// LOCKED physics constants, encoded as Q16.16 raw integers.
//
// Source of truth: brain/20-tech-spec/physics-constants.md. Changing any value
// here is a spec change: it needs an ADR and it moves constantsHash, which in
// turn makes every older replay refuse to load (by design — a silent desync is
// worse than a rejected file).
//
// Values are written as literal integers with the decimal they encode in a
// comment. Literals rather than fxFromNumber(0.1) so the table can be audited
// by eye and so no float ever runs at module load.

import { fnv1aString, toHex32 } from './checksum.js';

export const TICK_RATE = 60;
export const TICK_MS = 1000 / 60; // reporting only, never used inside a tick

/**
 * Every number the simulation reads. Q16.16 raw unless the name ends in
 * _TICKS or _RATE (those are plain integers).
 */
export const CONSTANTS = Object.freeze({
  // --- timing
  TICK_RATE: 60,

  // --- player (physics-constants.md: accel 0.1, kickingAccel 0.07, damping 0.96)
  PLAYER_ACCEL: 6554, //  0.100006103515625  (0.1)
  PLAYER_KICKING_ACCEL: 4588, //  0.07000732421875   (0.07)
  PLAYER_DAMPING: 62915, //  0.9600067138671875 (0.96)
  PLAYER_RADIUS: 983040, // 15
  PLAYER_INV_MASS: 32768, //  0.5
  PLAYER_BCOEF: 32768, //  0.5

  // --- ball (damping MUST stay above the player's; that gap is what makes
  //     pure-physics dribbling work at all — see 10-design/gameplay-core.md)
  BALL_DAMPING: 64881, //  0.9900054931640625 (0.99)
  BALL_RADIUS: 655360, // 10
  BALL_INV_MASS: 65536, //  1
  BALL_BCOEF: 32768, //  0.5

  // --- kick: an impulse ADDED along unit(player -> ball), never a velocity set
  KICK_IMPULSE: 327680, //  5
  // Reach measured from the surfaces (centre distance minus both radii). The
  // spec caps the range at "< 25 units"; the radii already sum to 25, so a
  // centre-distance reading could never fire. 4 units of surface gap is the
  // Haxball-shaped value and sits well inside the cap.
  KICK_RANGE: 262144, //  4
  KICK_LATCH_TICKS: 18, //  0.3 s of armed intent
  KICK_COOLDOWN_TICKS: 8, //  7.5 kick/s, inside the locked 4-12 band

  // --- static geometry
  WALL_BCOEF: 65536, //  1
  POST_RADIUS: 524288, //  8
  POST_BCOEF: 32768, //  0.5

  // --- pitch: z is the long axis, goals sit on the +/-z lines
  PITCH_HALF_X: 13107200, // 200
  PITCH_HALF_Z: 27525120, // 420
  GOAL_HALF_X: 3604480, // 55

  // --- kickoff layout
  SPAWN_Z: 6553600, // 100  (distance from the centre line)
  SPAWN_X_STEP: 3932160, //  60  (lateral spacing between team mates)
  KICKOFF_FREEZE_TICKS: 0, // no restart freeze in the core (game layer's job)

  // --- close control (matrix #7). No magnet, no sticking: the only thing the
  //     core adds is a radius the CMU-RoboCup close-control predicate reads, and
  //     it is exactly the kick reach (radii + KICK_RANGE) so a ball judged
  //     "still under control" is always a ball a corrective touch can reach.
  CONTROL_RADIUS: 1900544, // 29  = PLAYER_RADIUS + BALL_RADIUS + KICK_RANGE
  // The "small corrective kick" of the CMU pattern. It is NOT the shot charge:
  // the charge floor is 0.3 x 5 = 1.5, which sends the ball 148 units and loses
  // it. A touch has to move the ball about one control radius, i.e. ~0.35.
  TOUCH_IMPULSE: 22938, //  0.35
  TOUCH_COOLDOWN_TICKS: 6, // 10 touches/s ceiling; the ball outruns a spammer
  // The pitch is 840 units long and stands in for the 36 m arena the renderer
  // draws (client constants: PITCH_HALF_L = 18 m). One metre is therefore
  // 840/36 units; the 10 m dribble acceptance is 233.33 units.
  UNITS_PER_METRE: 1529173, // 23.333333

  // --- shot charge (matrix #8): hold 100->800 ms, power 0.3x + 0.7x * t^1.5
  CHARGE_MIN_TICKS: 6, //  100 ms — below this the release is a 0.3x tap
  CHARGE_MAX_TICKS: 48, //  800 ms — the curve is flat past this
  CHARGE_BASE: 19661, //  0.3 of KICK_IMPULSE
  CHARGE_SPAN: 45875, //  0.7 of KICK_IMPULSE (base + span = 1.0 exactly)
  CHARGE_BUFFER_TICKS: 5, //  release buffer, inside the locked 4-6 band

  // --- curve (matrix #9): ONE signed scalar on the ball, v += k*perp(v)*curve
  CURVE_ACCEL: 1311, //  0.02
  CURVE_DAMPING: 63570, //  0.97  (half-life ~23 ticks)
  CURVE_MAX: 65536, //  1
  AFTERTOUCH_TICKS: 20, //  window after a shot in which input bends the ball
  AFTERTOUCH_GAIN: 3277, //  0.05 of curve per tick of full lateral input

  // --- slide tackle (matrix #10): active window then twice as long recovering
  TACKLE_ACTIVE_TICKS: 12,
  TACKLE_RECOVERY_TICKS: 24, // 2x the active window, movement locked
  TACKLE_COOLDOWN_TICKS: 20, // spam tax on top of the recovery
  TACKLE_REACH: 786432, // 12  extra radius while the slide is active
  TACKLE_IMPULSE: 196608, //  3  lunge along the aim direction
  TACKLE_BALL_DAMP: 16384, //  0.25 of the ball's speed survives a clean win
  TACKLE_POKE: 98304, //  1.5 poke away from the tackler on a clean win
  TACKLE_KNOCK: 131072, //  2  shove applied to an OPPONENT caught by the slide

  // --- keeper (matrix #11, ADR-0001: role fixed at match start)
  PENALTY_HALF_X: 8388608, // 128  (same share of the width as the 3D pitch box)
  PENALTY_DEPTH: 6881280, // 105  measured in from the goal line
  CATCH_REACH: 131072, //   2  extra grab reach on top of the radii
  CATCH_HOLD_TICKS: 210, // 3.5 s, inside the designed 180-240 band
  THROW_IMPULSE: 196608, //   3  hand throw: straight, medium, no curve
  CLEAR_MIN_IMPULSE: 262144, //   4  foot clearance floor
  CLEAR_MAX_IMPULSE: 589824, //   9  foot clearance at full charge
  CLEAR_MAX_TICKS: 48, // 800 ms to a full clearance
  DIVE_ACTIVE_TICKS: 14,
  DIVE_IMPULSE: 327680, //   5  thrown at the keeper, not at the ball
  DIVE_REACH: 655360, //  10  extra reach while stretched
  DIVE_SAVE_DAMP: 9830, //   0.15 of the shot's speed survives a save
  DIVE_WHIFF_LOCK_TICKS: 60, // grounded and defenceless after a miss
  GRIEF_LOCK_TICKS: 180, // a released hold cannot become an own goal for 3 s
  HOLD_OFFSET: 1638400, //  25  where a held ball sits, = PLAYER_R + BALL_R

  // --- input
  MAX_PLAYERS: 12,
});

/**
 * Canonical serialisation of the constant table: keys sorted, `name=value`
 * joined by `;`. Sorting is what makes the hash independent of declaration
 * order, so reordering the table above does not invalidate replays.
 */
export function serializeConstants(table = CONSTANTS) {
  const keys = Object.keys(table).sort();
  let s = '';
  for (const k of keys) s += `${k}=${table[k] | 0};`;
  return s;
}

/** Stable 32-bit hex digest of the constant table. Goes into replay headers. */
export function hashConstants(table = CONSTANTS) {
  return toHex32(fnv1aString(serializeConstants(table)));
}

export const constantsHash = hashConstants(CONSTANTS);

/** Low 32 bits of constantsHash as a signed int, for the state header. */
export const constantsHashInt = parseInt(constantsHash, 16) | 0;
