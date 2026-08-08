// The ONE place the deterministic core's integer pitch becomes metres.
//
// The core is unit-less on purpose: its arena is 400 x 840 raw units with the
// goals on the +/-z lines. The renderer this client already ships draws a
// 36 m x 22 m pitch with the goal lines at z = +/-18 m. Those two are reconciled
// by exactly one number, and packages/core already owns it:
//
//   CONSTANTS.UNITS_PER_METRE = 23.333333   (840 units / 36 m)
//
// physics-constants.md fixes it and constants.js states the intent in words:
// "the pitch is 840 units long and stands in for the 36 m arena the renderer
// draws". Picking any other scale here would put the arena client at odds with
// the locked table, so this module simply re-exports that constant and derives
// everything else from it. Nothing else in src/arena/ may divide by 65536.
//
// What the mapping implies, stated plainly rather than fudged:
//
//   long axis    840 u -> 36.00 m    the drawn goal lines land exactly on the
//                                    core's, so buildGoalFrames() needs no shim
//   short axis   400 u -> 17.14 m    NARROWER than the 22 m the pitch texture
//                                    draws; the true walls are marked by the
//                                    boundary overlay, not by the texture
//   goal mouth   110 u ->  4.71 m    the core's goal, not the FIFA 7.32 m one
//   player       r 15 u -> 0.643 m   a core player is a fat disc, so the body
//                                    mesh is scaled up to cover its real radius
//   ball         r 10 u -> 0.429 m
//
// The width disagreement is real and deliberate: the core's rectangle is the
// truth, the texture underneath it is decoration.

import { CONSTANTS, fx } from '../../../core/src/index.js';

const FX_ONE = fx.FX_ONE;

/** Raw Q16.16 constant -> plain number. Only this module is allowed to do it. */
const raw = (v) => v / FX_ONE;

/** Core units per metre. The single scale constant of the arena client. */
export const UNITS_PER_METRE = raw(CONSTANTS.UNITS_PER_METRE);

/** Core units -> metres. */
export const toMetres = (u) => u / UNITS_PER_METRE;

/** Metres -> core units. */
export const toUnits = (m) => m * UNITS_PER_METRE;

/** Every pitch dimension the renderer needs, in metres. */
export const PITCH_M = Object.freeze({
  halfX: toMetres(raw(CONSTANTS.PITCH_HALF_X)),
  halfZ: toMetres(raw(CONSTANTS.PITCH_HALF_Z)),
  goalHalfX: toMetres(raw(CONSTANTS.GOAL_HALF_X)),
  postR: toMetres(raw(CONSTANTS.POST_RADIUS)),
  playerR: toMetres(raw(CONSTANTS.PLAYER_RADIUS)),
  ballR: toMetres(raw(CONSTANTS.BALL_RADIUS)),
  penaltyHalfX: toMetres(raw(CONSTANTS.PENALTY_HALF_X)),
  penaltyDepth: toMetres(raw(CONSTANTS.PENALTY_DEPTH)),
  spawnZ: toMetres(raw(CONSTANTS.SPAWN_Z)),
  controlR: toMetres(raw(CONSTANTS.CONTROL_RADIUS)),
});

/**
 * Crossbar height. The core is two-dimensional, so this is pure decoration and
 * can never change play; it is kept at the shipping renderer's FIFA value so a
 * goal frame still reads as a goal frame.
 */
export const GOAL_HEIGHT_M = 2.44;

/** Ticks per second the core runs at. Mirrored here so the loop reads clearly. */
export const TICK_HZ = CONSTANTS.TICK_RATE;
export const TICK_MS = 1000 / TICK_HZ;
