// The local animation clock.
//
// The core is the only authority on where a player IS. It has no opinion at all
// about where that player's left foot is in its stride, and it must not grow
// one: a stride phase in the simulation would be state that has to be
// checksummed, serialised and rolled back for something nobody can see.
//
// So the phase lives here, on the cosmetic side, in a clock that is advanced by
// the renderer's dt. That gives the contract every other module in this
// directory is written against:
//
//     pose = f(core state, clock)          — pure, no hidden reads
//     clock' = advance(clock, dt, speed)   — the only mutable thing
//
// which is what makes "same core state + same clock => identical transforms"
// testable at all.
//
// FOOT PHASE CONTINUITY
//
// The stride phase is INTEGRATED, never recomputed from speed. That is the
// whole reason a player can accelerate from a standstill to a sprint without
// the feet snapping: changing `speed` changes dφ/dt, and a change in the
// derivative is invisible, whereas recomputing φ from speed would teleport it.
// scripts/anim-test.mjs asserts exactly this by slamming the speed between
// frames and demanding the phase move by no more than one frame's worth.

/** Strides per second at a dead stop — a slow idle weight-shift, not a walk. */
const IDLE_RATE = 0.45;
/** Strides per second at full sprint. Roughly two footfalls a second. */
const RUN_RATE = 1.55;
/** Above this speed (m/s) the gait is a full run. */
export const RUN_SPEED = 4.2;
/** Below this speed (m/s) the gait is an idle. */
export const WALK_SPEED = 0.35;

/** Breaths per second. Deliberately incommensurate with the stride rate. */
const BREATH_RATE = 0.31;

/** Longest dt the clock will honour in one go, so an alt-tab cannot fast-forward
 *  a player through fifty strides in a single frame. */
export const MAX_DT = 0.1;

/**
 * Strides per second for a given ground speed. Continuous and monotonic in
 * `speed`, which is what keeps the phase derivative from jumping.
 * @param {number} speed metres per second
 */
export function strideRate(speed) {
  const s = speed > 0 ? speed : 0;
  const t = Math.min(1, s / RUN_SPEED);
  // Ease-out quadratic: cadence climbs fast out of a standstill and flattens
  // toward a sprint, the way a real gait does.
  //
  // This was sqrt(t) first, which has the same shape and is wrong for a reason
  // worth writing down: sqrt has an INFINITE derivative at zero, so a player
  // stepping off from a dead stop got a cadence that jumped by 0.05 strides per
  // second between two consecutive frames. Continuous, but not Lipschitz, and
  // the visible result is a hitch on every single start. t*(2-t) has the same
  // curve with a finite slope of 2 at the origin, and the continuity assertion
  // in scripts/anim-test.mjs holds.
  return IDLE_RATE + (RUN_RATE - IDLE_RATE) * t * (2 - t);
}

/**
 * Normalised gait blend from a ground speed: 0 = idle, 0.5 = walk, 1 = run.
 * Piecewise-linear and continuous, so the blend weights never jump either.
 */
export function gaitBlend(speed) {
  const s = speed > 0 ? speed : 0;
  if (s <= WALK_SPEED) return 0;
  if (s >= RUN_SPEED) return 1;
  return (s - WALK_SPEED) / (RUN_SPEED - WALK_SPEED);
}

/** One player's cosmetic clock. Cheap enough to keep one per player forever. */
export class AnimClock {
  /** @param {number} phase0 starting stride phase, so two players never march
   *                         in lockstep. Pass the player index. */
  constructor(phase0 = 0) {
    /** Seconds since the view was built. Drives every non-gait oscillator. */
    this.t = 0;
    /** Stride phase in turns [0,1). Foot L is planted over [0, 0.5). */
    this.phase = phase0 - Math.floor(phase0);
    /** Breath phase in turns [0,1). */
    this.breath = (phase0 * 0.618) % 1;
    /** Last speed we were advanced with, for the acceleration layer. */
    this.speed = 0;
    /** Smoothed acceleration in local space, metres per second squared. */
    this.accelF = 0;
    this.accelR = 0;
    /** Monotonic frame counter; useful when a test wants a stable seed. */
    this.frames = 0;
  }

  /**
   * Advance one rendered frame.
   * @param {number} dt seconds since the previous frame
   * @param {number} speed ground speed in metres per second
   * @param {number} accelF forward acceleration in the player's own frame
   * @param {number} accelR rightward acceleration in the player's own frame
   */
  advance(dt, speed, accelF = 0, accelR = 0) {
    const d = dt > 0 ? Math.min(dt, MAX_DT) : 0;
    this.t += d;
    this.phase = (this.phase + strideRate(speed) * d) % 1;
    this.breath = (this.breath + BREATH_RATE * d) % 1;
    this.speed = speed;
    // A first-order filter, not a raw difference: the core's velocity is
    // quantised, so a raw derivative is a staircase and the lean would buzz.
    const k = d > 0 ? Math.min(1, d * 8) : 0;
    this.accelF += (accelF - this.accelF) * k;
    this.accelR += (accelR - this.accelR) * k;
    this.frames++;
    return this;
  }

  /** Exact snapshot, for a test that wants to replay a frame twice. */
  snapshot() {
    return {
      t: this.t, phase: this.phase, breath: this.breath,
      speed: this.speed, accelF: this.accelF, accelR: this.accelR,
      frames: this.frames,
    };
  }

  restore(s) {
    this.t = s.t; this.phase = s.phase; this.breath = s.breath;
    this.speed = s.speed; this.accelF = s.accelF; this.accelR = s.accelR;
    this.frames = s.frames;
    return this;
  }
}

/** Shortest signed angular difference, in (-PI, PI]. */
export function angleDelta(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Frame-rate independent exponential approach: 0 at dt=0, 1 as dt grows. */
export function approach(dt, rate) {
  return 1 - Math.exp(-rate * (dt > 0 ? dt : 0));
}
