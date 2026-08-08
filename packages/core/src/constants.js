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
