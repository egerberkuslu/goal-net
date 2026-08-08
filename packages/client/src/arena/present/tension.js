// Tension (feature matrix #39) — one scalar in [0,1] that says how much this
// moment matters. Pure, deterministic, cosmetic.
//
// Nothing here reads the world: `tensionOf()` takes a plain object of numbers
// that the caller lifted out of readState(), and returns a number. It never
// writes anything and no gameplay value is derived from it. The crowd layer and
// the commentator subscribe to it; neither of them may reach back.
//
// ------------------------------------------------------------------ formula
//
// Four components, each already normalised to [0,1]:
//
//   closeness  = 1 / (1 + |score0 - score1|)
//                a level game is 1, one goal in it 0.5, two 0.333, three 0.25.
//                Hyperbolic rather than linear because the drop from level to
//                one-goal is the one a spectator actually feels; the difference
//                between four and five goals is not.
//
//   urgency    = 1 - remainingSeconds / totalSeconds        (clamped to [0,1])
//                Linear in the clock. A golden-goal period pins it at 1: every
//                second of it is the last second.
//
//   territory  = |ballZ| / halfZ                            (clamped to [0,1])
//                How far the ball is from the halfway line, i.e. how close it is
//                to somebody's goal. The core is 2D and z is the long axis, so
//                this is the whole of "where the danger is".
//
//   balance    = 1 - |possession0 - possession1|            (shares, sum 1)
//                A contested game is tense; a training exercise in which one
//                side never touches the ball is not. Falls to 0 at total
//                one-sidedness.
//
// Combined:
//
//   T = 0.45 * closeness * (0.4 + 0.6 * urgency)   stakes, sharpened by the clock
//     + 0.25 * urgency                             the clock on its own
//     + 0.20 * territory                           where the ball is
//     + 0.10 * balance                             how even the game is
//
// The weights are chosen so the maximum is exactly 1 (closeness = urgency =
// territory = balance = 1 gives 0.45 + 0.25 + 0.20 + 0.10) and the minimum is
// exactly 0, so no clamp is load-bearing — the clamp is there for garbage input,
// not to hide an out-of-range formula.
//
// The closeness term is multiplied by (0.4 + 0.6 * urgency) rather than used
// raw because a level game in the first minute is not the same event as a level
// game in the last: the scoreline only becomes frightening once there is no
// time left to fix it. The 0.4 floor keeps a level early game from reading as
// dead.
//
// Golden goal is a floor of 0.85 rather than a separate branch, so the value
// still moves with territory during sudden death.
//
// Monotonicity, which present-test.mjs asserts:
//   * wider score gap        -> lower  (closeness falls, nothing else moves)
//   * less time remaining    -> higher (urgency rises in two terms)
//   * ball nearer a goal     -> higher (territory rises)
//   * more even possession   -> higher (balance rises)
//
// Determinism: plain IEEE doubles over the same inputs, then quantised to 1e-4.
// Two clients handed the same readState()-derived inputs print the same number,
// which is what lets a replay reproduce the commentary track.

/** Weights. They sum to 1 at the component maximum; see the header. */
export const TENSION_WEIGHTS = Object.freeze({
  closeness: 0.45,
  urgency: 0.25,
  territory: 0.2,
  balance: 0.1,
});

/** Floor applied while a golden-goal period is running. */
export const GOLDEN_FLOOR = 0.85;

/** Output quantum. Everything downstream sees a multiple of this. */
export const TENSION_QUANTUM = 1e-4;

const clamp01 = (v) => (v > 1 ? 1 : v < 0 ? 0 : v);
const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

/** Round to TENSION_QUANTUM so the value is stable across engines. */
export function quantiseTension(v) {
  return Math.round(clamp01(v) / TENSION_QUANTUM) * TENSION_QUANTUM;
}

/**
 * The four normalised components, exposed so a debug overlay (and the test)
 * can show why the number is what it is.
 *
 * @param {{score?:number[], remainingSeconds?:number, totalSeconds?:number,
 *          ballZ?:number, halfZ?:number, possession?:number[],
 *          golden?:boolean}} input
 */
export function tensionParts(input = {}) {
  const score = Array.isArray(input.score) ? input.score : [0, 0];
  const gap = Math.abs(num(score[0]) - num(score[1]));
  const closeness = 1 / (1 + gap);

  const total = Math.max(1e-6, num(input.totalSeconds, 180));
  const left = Math.max(0, num(input.remainingSeconds, total));
  const urgency = input.golden ? 1 : clamp01(1 - left / total);

  const halfZ = Math.max(1e-6, num(input.halfZ, 1));
  const territory = clamp01(Math.abs(num(input.ballZ)) / halfZ);

  const poss = Array.isArray(input.possession) ? input.possession : [0.5, 0.5];
  const p0 = Math.max(0, num(poss[0], 0.5));
  const p1 = Math.max(0, num(poss[1], 0.5));
  const sum = p0 + p1;
  const balance = sum > 0 ? clamp01(1 - Math.abs(p0 - p1) / sum) : 1;

  return { closeness, urgency, territory, balance };
}

/**
 * The scalar. Deterministic and pure: same input object, same number, forever.
 * @returns {number} in [0,1], a multiple of TENSION_QUANTUM
 */
export function tensionOf(input = {}) {
  const { closeness, urgency, territory, balance } = tensionParts(input);
  const W = TENSION_WEIGHTS;
  let t =
    W.closeness * closeness * (0.4 + 0.6 * urgency) +
    W.urgency * urgency +
    W.territory * territory +
    W.balance * balance;
  if (input.golden && t < GOLDEN_FLOOR) t = GOLDEN_FLOOR;
  return quantiseTension(t);
}

/**
 * Lift the inputs out of a readState() result. This is the ONLY place the
 * presentation layer reads match state for tension, and it reads it — the world
 * is never touched.
 *
 * @param {object} state readState(world) or a guest sample
 * @param {{halfZ:number, totalSeconds:number, possession?:number[],
 *          golden?:boolean, secondsLeft?:number}} ctx
 */
export function tensionInputFromState(state, ctx = {}) {
  const remaining = Number.isFinite(ctx.secondsLeft)
    ? ctx.secondsLeft
    : Number.isFinite(state?.match?.remainingTicks) && state.match.remainingTicks >= 0
      ? state.match.remainingTicks / 60
      : ctx.totalSeconds;
  return {
    score: state?.score || [0, 0],
    remainingSeconds: remaining,
    totalSeconds: ctx.totalSeconds,
    ballZ: state?.ball?.z || 0,
    halfZ: ctx.halfZ,
    possession: ctx.possession,
    golden: !!ctx.golden || state?.match?.phase === 'golden-goal',
  };
}

/** Three bands, for a crowd loop crossfade. Thresholds are inclusive-below. */
export const TENSION_BANDS = Object.freeze(['sakin', 'orta', 'coskulu']);
export const BAND_EDGES = Object.freeze([0.34, 0.67]);

export function tensionBand(t) {
  const v = clamp01(num(t));
  if (v < BAND_EDGES[0]) return TENSION_BANDS[0];
  if (v < BAND_EDGES[1]) return TENSION_BANDS[1];
  return TENSION_BANDS[2];
}

/**
 * Commentary density: the minimum gap between two spoken lines, in ms. A dead
 * game gets a line every 3.2 s at most; a golden-goal scramble every 0.9 s.
 */
export const DENSITY_MS = Object.freeze({ calm: 3200, hot: 900 });

export function commentaryGapMs(t) {
  const v = clamp01(num(t));
  return Math.round(DENSITY_MS.calm + (DENSITY_MS.hot - DENSITY_MS.calm) * v);
}

/**
 * A meter with a subscribe hook. The atmosphere layer (crowd loops, cloth wind)
 * subscribes; it does not import tension.js internals and this module knows
 * nothing about it, which is the whole point of the split.
 *
 *   const meter = createTensionMeter({ smoothing: 0.6 });
 *   meter.subscribe(({ value, band }) => crowd.setIntensity(value));
 *   meter.set(tensionInputFromState(state, ctx), dt);
 *
 * `smoothing` is the half-life in seconds of an exponential approach, so the
 * crowd swells and settles instead of stepping. Given the same (input, dt)
 * sequence the smoothed value is reproducible too.
 */
export function createTensionMeter(options = {}) {
  const halfLife = Math.max(0, num(options.smoothing, 0.6));
  const listeners = new Set();
  let raw = 0;
  let value = num(options.initial, 0);
  let band = tensionBand(value);
  let started = false;

  function publish() {
    const nextBand = tensionBand(value);
    const changed = nextBand !== band;
    band = nextBand;
    const payload = { value, raw, band, bandChanged: changed };
    for (const fn of listeners) fn(payload);
  }

  return {
    get value() { return value; },
    get raw() { return raw; },
    get band() { return band; },
    /** @returns {() => void} unsubscribe */
    subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.add(fn);
      fn({ value, raw, band, bandChanged: false });
      return () => listeners.delete(fn);
    },
    /** @param {object} input tensionOf() input @param {number} dt seconds */
    set(input, dt = 0) {
      raw = tensionOf(input);
      if (!started || halfLife <= 0 || !(dt > 0)) {
        started = true;
        value = raw;
      } else {
        const k = 1 - Math.pow(0.5, dt / halfLife);
        value = quantiseTension(value + (raw - value) * k);
      }
      publish();
      return value;
    },
    reset(v = 0) {
      raw = quantiseTension(v);
      value = raw;
      started = false;
      publish();
    },
  };
}
