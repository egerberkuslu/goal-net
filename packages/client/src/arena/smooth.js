// Drawing between the simulation's ticks (matrix #12 follow-up).
//
// The problem
// -----------
// The simulation is a fixed 60 Hz clock pumped by a worker timer; the screen is
// a separate clock driven by requestAnimationFrame. Nothing keeps the two in
// phase. Drawing readState(world) straight therefore shows a state that is
// anywhere from 0 to 16.7 ms old, and the staleness changes every frame — so a
// player running at 6 m/s is drawn up to 10 cm from where it should be, in a
// direction that flips frame to frame. That is what a player sees as characters
// twitching on the spot, and it happens at any frame rate, including a
// comfortable 60.
//
// Why this extrapolates instead of interpolating
// ----------------------------------------------
// The first attempt kept the last two ticks and blended between them, which
// draws the world one tick in the past. Measured on screen it barely helped —
// 14.2 mm of wobble down to 12.1 — because it assumes the two states are one
// tick apart. They often are not: a pump can advance several ticks at once
// whenever a frame runs long, and then the pair being blended spans 80 ms of
// travel and the blend lands nowhere near the truth.
//
// The core hands out velocity as well as position, so the honest answer is to
// take the newest tick and carry it forward by how long ago it happened. It is
// exact for a body moving in a straight line, it costs no latency at all (the
// interpolating version added a tick), and multi-tick pumps stop mattering
// because only the newest state is ever used.
//
// The error left over is the distance a body's acceleration can bend the path
// inside one tick — millimetres — and a contact can overshoot for at most one
// tick before the next state corrects it. Both are far below the 10 cm this
// removes.
//
// It is cosmetic and host-only. Rules, netcode, the HUD and the replay all run
// on the authoritative tick; a guest's stream is already interpolated inside
// packages/net. The core never learns this file exists.

/**
 * Ticks of extrapolation past which the sample is clamped.
 *
 * One tick covers the normal case. Beyond that the pump has stalled (a long
 * frame, a tab coming back to the front) and carrying a stale velocity further
 * would slide bodies through walls on screen; freezing until the next tick
 * arrives is the lesser artefact.
 */
export const MAX_LEAD_TICKS = 1.25;

/**
 * Carry one state forward by `ticks` of its own velocity.
 *
 * Positions and velocities are in the core's units per tick, which is why this
 * is a plain multiply and why nothing here needs to know what a metre is.
 * Everything that is not a position is passed through untouched: a half-counted
 * charge tick or a fractional score is never a number anything downstream
 * should see.
 *
 * @param {object} state a readState() result
 * @param {number} ticks how long ago the state was simulated, in ticks
 * @returns {object} a state shaped exactly like `state`
 */
export function advanceState(state, ticks) {
  if (!state || !(ticks > 0)) return state;
  const t = Math.min(ticks, MAX_LEAD_TICKS);
  const ball = state.ball;
  return {
    ...state,
    ball: ball ? { ...ball, x: ball.x + (ball.vx || 0) * t, z: ball.z + (ball.vz || 0) * t } : ball,
    players: state.players.map((p) => (
      { ...p, x: p.x + (p.vx || 0) * t, z: p.z + (p.vz || 0) * t }
    )),
  };
}

/**
 * Holds the newest simulated tick and hands out where things are *now*.
 *
 * `push` is called once per simulated tick, from the pump, stamped with the
 * time the tick was simulated — not the time a frame noticed it. That
 * distinction is the whole fix: stamping at render time feeds this a wobbly
 * clock and the twitch survives.
 */
export class RenderSmoother {
  /** @param {number} tickMs milliseconds per simulated tick */
  constructor(tickMs) {
    this.tickMs = tickMs > 0 ? tickMs : 1000 / 60;
    this.curr = null;
    this.currAtMs = 0;
  }

  /** @param {object} state readState() result @param {number} nowMs */
  push(state, nowMs) {
    this.curr = state;
    this.currAtMs = nowMs;
  }

  /** @param {number} nowMs @returns {object|null} what to draw */
  sample(nowMs) {
    if (!this.curr) return null;
    return advanceState(this.curr, (nowMs - this.currAtMs) / this.tickMs);
  }

  reset() {
    this.curr = null;
    this.currAtMs = 0;
  }
}
