// Render-time interpolation for the host's own view (matrix #12 follow-up).
//
// The simulation is a fixed 60 Hz clock driven by a worker timer; the screen is
// a separate ~60 Hz clock driven by requestAnimationFrame. Nothing keeps the
// two in phase, so drawing readState(world) directly means every frame shows a
// state that is somewhere between 0 and 16.7 ms old, and the amount changes
// frame to frame. Positions then move 0, 1 or 2 ticks' worth per frame instead
// of one — which is exactly what a player sees as characters twitching in
// place while they run.
//
// The fix is the standard one: draw one tick in the past and fill the gap. The
// host keeps the last two simulated states and blends between them by how far
// the wall clock has travelled since the newer one arrived. The cost is 16.7 ms
// of extra display latency, which is below what anyone can see, and the whole
// thing is cosmetic — the authoritative state still drives rules, netcode and
// the HUD, and the core never learns this file exists.
//
// The guest path already interpolates inside packages/net (it has to, at 20 Hz
// snapshots), so this is only ever used by the host.

/** Position jump, in metres, past which a lerp is wrong and a cut is right. */
const TELEPORT_M = 1.5;

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Blend two positions unless the thing teleported.
 *
 * Kickoffs, goal restarts and throw-in placements move a body across the pitch
 * between one tick and the next. Interpolating those would drag every player
 * through the centre circle over 16 ms, so anything faster than a sprint is
 * treated as a cut and snaps to the newer value.
 */
function blendPos(prev, curr, t) {
  if (Math.abs(curr - prev) > TELEPORT_M) return curr;
  return lerp(prev, curr, t);
}

/**
 * A drawable state between two simulated ones.
 *
 * Only what moves is blended. Counters, flags, scores and ticks come from the
 * newer state untouched: half a charge tick is not a number the pose layer
 * should ever see, and a score that reads 0.5 for one frame is a bug.
 *
 * @param {object|null} prev older readState() result
 * @param {object} curr newer readState() result
 * @param {number} alpha 0 at prev, 1 at curr
 * @returns {object} a state shaped exactly like `curr`
 */
export function interpolateState(prev, curr, alpha) {
  if (!prev || !curr) return curr;
  if (!(alpha > 0)) return prev.players.length === curr.players.length ? prev : curr;
  if (alpha >= 1) return curr;
  if (prev.players.length !== curr.players.length) return curr;
  // A rewound or repeated tick means the pair is not a consecutive step; there
  // is nothing meaningful to blend, so show the newer one.
  if (curr.tick <= prev.tick) return curr;

  const players = curr.players.map((p, i) => {
    const q = prev.players[i];
    if (!q || q.index !== p.index) return p;
    return {
      ...p,
      x: blendPos(q.x, p.x, alpha),
      z: blendPos(q.z, p.z, alpha),
    };
  });
  return {
    ...curr,
    ball: {
      ...curr.ball,
      x: blendPos(prev.ball.x, curr.ball.x, alpha),
      z: blendPos(prev.ball.z, curr.ball.z, alpha),
    },
    players,
  };
}

/**
 * Keeps the last two simulated states and hands out the blend for a moment.
 *
 * `push` is called once per simulated tick, `sample` once per drawn frame.
 * They are deliberately separate: a frame that arrives before any tick, or
 * three frames between two ticks, both have to produce something sane.
 */
export class RenderSmoother {
  /** @param {number} tickMs milliseconds per simulated tick */
  constructor(tickMs) {
    this.tickMs = tickMs > 0 ? tickMs : 1000 / 60;
    this.prev = null;
    this.curr = null;
    this.currAtMs = 0;
  }

  /** @param {object} state readState() result @param {number} nowMs */
  push(state, nowMs) {
    if (this.curr && state.tick === this.curr.tick) return; // no tick happened
    this.prev = this.curr;
    this.curr = state;
    this.currAtMs = nowMs;
  }

  /** @param {number} nowMs @returns {object|null} what to draw */
  sample(nowMs) {
    if (!this.curr) return null;
    if (!this.prev) return this.curr;
    const alpha = (nowMs - this.currAtMs) / this.tickMs;
    return interpolateState(this.prev, this.curr, Math.max(0, Math.min(1, alpha)));
  }

  reset() {
    this.prev = null;
    this.curr = null;
    this.currAtMs = 0;
  }
}
