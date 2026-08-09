// Wind: one air velocity that everything in the air agrees on.
//
// Before this, "wind" existed twice and neither was wind. The net had a fixed
// sine breeze wired into its integrator so it would not hang dead still, and
// the rain fell at a hardcoded slant. Neither touched the ball, so a cross that
// hung in the air was unaffected by the weather blowing the net beside it.
//
// This is the shared source. It is deliberately tiny, and deliberately NOT
// random: the gust is a sum of two incommensurate sines over the simulation's
// own clock, so two machines stepping the same match with the same clock get
// the same air. That keeps it usable from a deterministic path later without
// having to be rewritten.
//
// Physics note. Wind does not push a ball; it changes what "still air" means.
// Drag and Magnus act on the ball's velocity RELATIVE TO THE AIR, so the whole
// effect is one subtraction in Ball.accel() — a ball at rest in a crosswind
// feels a sideways force, a ball moving downwind feels less drag, and a ball
// thrown into the wind holds up and drops short. Adding a constant force to the
// ball instead would have looked similar for one frame and wrong ever after.

/**
 * How much a gust swings the speed, as a fraction of the prevailing wind.
 *
 * 0.35 means a 6 m/s wind breathes between roughly 4 and 8. It is a FRACTION,
 * which the first version then multiplied by the speed a second time — a 6 m/s
 * wind swung from -4.6 to 17.7 and briefly blew backwards.
 */
const GUST_FRACTION = 0.35;

/** The prevailing wind, in metres per second, in world axes. */
const base = { x: 0, z: 0 };

/** Whether a gust is active at all; the amplitude itself is GUST_FRACTION. */
let gusty = false;

/** Scratch, so sampling never allocates inside a step loop. */
const sample = { x: 0, y: 0, z: 0 };

/**
 * Set the prevailing wind.
 *
 * @param {number} directionRad where the wind blows TOWARDS, measured like the
 *   rest of the game's headings: 0 is +z, rising towards +x
 * @param {number} speedMs metres per second. A brisk match-day wind is 4-6;
 *   above about 10 a lofted ball stops behaving like football.
 */
export function setWind(directionRad, speedMs) {
  const s = Math.max(0, speedMs || 0);
  base.x = Math.sin(directionRad) * s;
  base.z = Math.cos(directionRad) * s;
  gusty = s > 0;
}

/** The prevailing wind without its gust, for HUD and commentary. */
export function windBase() {
  return { x: base.x, z: base.z, speed: Math.hypot(base.x, base.z) };
}

/**
 * The air velocity at a moment.
 *
 * Vertical air movement is left at zero on purpose: updraughts over a pitch are
 * real but small, and a ball that occasionally floats is a bug report, not a
 * feature.
 *
 * @param {number} time seconds since kickoff
 * @returns {{x:number, y:number, z:number}} a shared object — copy it if it
 *   has to outlive the call
 */
export function windAt(time) {
  if (!gusty) {
    sample.x = base.x; sample.y = 0; sample.z = base.z;
    return sample;
  }
  // Two periods that never line up, so the gust never settles into a rhythm
  // a player could time a shot against.
  const g = Math.sin(time * 0.41) * 0.65 + Math.sin(time * 1.13 + 2.1) * 0.35;
  const k = 1 + GUST_FRACTION * g;
  sample.x = base.x * k;
  sample.y = 0;
  sample.z = base.z * k;
  return sample;
}

/** No wind at all — the default, and what every existing test expects. */
export function calmWind() {
  base.x = 0; base.z = 0; gusty = false;
}
