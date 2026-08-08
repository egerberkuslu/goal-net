// #17 — impact shake and the goal replay camera, for the arena.
//
// The shipping game's view/cameraRig.js already had the right idea for both
// halves, and the shake here is deliberately the same maths so the two views
// feel like the same game: three incommensurate sines per axis, exponential
// decay, a hard ceiling, and a cutoff below which it snaps to exactly zero.
// What is new is the replay.
//
// WHY THE REPLAY IS A RING BUFFER AND NOT packages/replay
//
// packages/replay is an INPUT recorder. Replaying through it means re-running
// the deterministic core from a keyframe, which is the correct tool for
// watching a whole match back and completely the wrong one for a two-second
// cutaway during a live game: it needs a second world, it costs a few hundred
// simulation steps in the middle of a frame, and on a guest — which owns no
// world at all — it cannot work even in principle.
//
// So the arena keeps a small ring of the last few seconds of RENDER state:
// positions, velocities and the handful of counters the animators need to
// re-fire the same kick swing. Roughly 6 kB for four seconds of a 4v4. It
// replays on both host and guest, identically, because it replays what was
// drawn rather than what was simulated.
//
// The recorded fields are exactly the ones PlayerAnimator reads, so a replayed
// strike plays the same variant, off the same foot, with the same tap — not a
// generic run cycle with the ball moving.

import { setInputBasis } from '../../game/input.js';

// ------------------------------------------------------------------ shake ---

/** e^(-5t): under 1% of the initial amplitude after 1 s, zero by 1.5 s. */
export const SHAKE_DECAY = 5;
/** Hard ceiling in metres of peak camera travel, however hard it is hit. */
export const SHAKE_MAX = 0.8;
/**
 * Below this the shake is snapped to exactly zero rather than left to crawl.
 *
 * One millimetre of camera travel. Sub-pixel at every focal length the arena
 * uses, so the cutoff is invisible, and it is what makes "zero within 1.5 s"
 * true rather than nearly true: 0.8 * e^(-5t) crosses 1e-3 at 1.34 s. With the
 * cutoff an order of magnitude lower the amplitude is still a non-zero float at
 * 1.5 s, which is a floating-point tail nobody can see and a test can.
 */
export const SHAKE_CUTOFF = 1e-3;

/** Suggested strengths, so callers do not invent their own scale. */
export const SHAKE = Object.freeze({
  goal: 0.50,
  woodwork: 0.28,
  drivenShot: 0.18,
  tackle: 0.14,
  save: 0.12,
});

/** Sum of three incommensurate sines: smooth, tableless, and no two axes ever
 *  line up into a straight-line jolt. */
function jitter(t, seed) {
  return Math.sin(t * 13.1 + seed) * 0.6
    + Math.sin(t * 23.7 + seed * 2.3) * 0.3
    + Math.sin(t * 41.3 + seed * 4.1) * 0.1;
}

/** The largest value `jitter` can return, for the bound the test asserts. */
export const JITTER_MAX = 1.0;

/**
 * Impact shake with a provable envelope.
 *
 * The invariant, which scripts/anim-test.mjs checks by running it rather than
 * by reading it: amplitude never exceeds SHAKE_MAX no matter what is fed in,
 * never increases except on an explicit kick, and is exactly zero within 1.5 s
 * of the last kick. A goal burst therefore cannot accumulate into seasickness.
 */
export class CameraShake {
  constructor() {
    this.amp = 0;
    this.t = 0;                       // own clock: frame-rate independent
    this.offset = { x: 0, y: 0, z: 0 };
  }

  /** Kick it. Shakes never stack past the strongest one currently in flight. */
  kick(strength) {
    const s = Number.isFinite(strength) ? Math.abs(strength) : 0;
    const clamped = Math.min(s, SHAKE_MAX);
    if (clamped > this.amp) this.amp = clamped;
    return this.amp;
  }

  update(dt) {
    const d = dt > 0 ? dt : 0;
    const o = this.offset;
    if (this.amp > SHAKE_CUTOFF) {
      this.t += d;
      this.amp *= Math.exp(-SHAKE_DECAY * d);
      if (this.amp <= SHAKE_CUTOFF) this.amp = 0;
      const a = this.amp;
      o.x = jitter(this.t, 0.0) * a;
      o.y = jitter(this.t, 1.7) * a * 0.7;
      o.z = jitter(this.t, 3.4) * a;
    } else if (o.x !== 0 || o.y !== 0 || o.z !== 0) {
      this.amp = 0;
      o.x = 0; o.y = 0; o.z = 0;
    }
    return o;
  }
}

// ----------------------------------------------------------------- replay ---

/** Seconds of render state kept. The cutaway never needs more than this. */
export const REPLAY_BUFFER_SECONDS = 4.0;
/** Samples per second. 30 is plenty: the replay is played back slowly. */
export const REPLAY_SAMPLE_HZ = 30;
/** Fields recorded per player, in this order. Keep in sync with _writeFrame. */
export const PLAYER_FIELDS = Object.freeze([
  'x', 'z', 'vx', 'vz', 'charge', 'kickCooldown', 'touchCooldown',
  'tackleActive', 'tackleRecovery', 'diveActive', 'diveLock', 'diveDir',
  'clearCharge',
]);
export const BALL_FIELDS = Object.freeze(['x', 'z', 'vx', 'vz', 'curve', 'holder']);

// The whole cutaway has to fit inside the arena's goal window, which
// arena/match.js fixes at 2600 ms. DELAY + LOOKBACK / RATE is the total, and
// that sum is asserted in scripts/anim-test.mjs rather than left to drift.
/** Seconds after the goal before the cutaway takes the picture. */
export const REPLAY_DELAY = 0.55;
/** Seconds of MATCH time shown, ending on the goal itself. */
export const REPLAY_LOOKBACK = 1.20;
/** Playback speed. Below 1 is slow motion. */
export const REPLAY_RATE = 0.68;
/** Seconds of WALL time the cutaway occupies. Derived, never set by hand. */
export const REPLAY_LENGTH = REPLAY_LOOKBACK / REPLAY_RATE;
/** The arena's goal window. The cutaway must finish inside it. */
export const GOAL_WINDOW_SECONDS = 2.6;

/**
 * A ring of recent render states, and the cutaway that plays them back.
 */
export class GoalReplay {
  /** @param {number} playerCount */
  constructor(playerCount) {
    this.playerCount = playerCount;
    this.stride = 1 + BALL_FIELDS.length + playerCount * PLAYER_FIELDS.length;
    this.capacity = Math.ceil(REPLAY_BUFFER_SECONDS * REPLAY_SAMPLE_HZ) + 2;
    this.buf = new Float32Array(this.capacity * this.stride);
    this.head = 0;      // next slot to write
    this.filled = 0;
    this.clock = 0;     // seconds since the view was built
    this.nextSampleAt = 0;

    this.active = false;
    this.armedAt = -1;  // clock time the goal was seen
    this.t = 0;         // seconds since the cutaway started
    this.goalPoint = { x: 0, z: 0 };
    /** Reused output object, in the exact shape readState() returns. */
    this.out = {
      tick: 0,
      score: [0, 0],
      ball: { x: 0, z: 0, vx: 0, vz: 0, curve: 0, holder: -1 },
      players: Array.from({ length: playerCount }, (_, index) => {
        const p = { index };
        for (const f of PLAYER_FIELDS) p[f] = 0;
        return p;
      }),
    };
  }

  /** Feed one rendered frame. Cheap: a few dozen float writes, 30 times a second. */
  record(dt, state) {
    this.clock += dt > 0 ? dt : 0;
    if (this.clock < this.nextSampleAt) return;
    this.nextSampleAt = this.clock + 1 / REPLAY_SAMPLE_HZ;
    const base = this.head * this.stride;
    const b = this.buf;
    let o = base;
    b[o++] = this.clock;
    const ball = state.ball || {};
    for (const f of BALL_FIELDS) b[o++] = Number(ball[f]) || 0;
    for (let i = 0; i < this.playerCount; i++) {
      const p = state.players?.[i] || {};
      for (const f of PLAYER_FIELDS) b[o++] = Number(p[f]) || 0;
    }
    this.head = (this.head + 1) % this.capacity;
    if (this.filled < this.capacity) this.filled++;
  }

  /** A goal happened. The cutaway starts REPLAY_DELAY seconds from now. */
  arm(goalPoint) {
    this.armedAt = this.clock;
    this.active = false;
    this.t = 0;
    if (goalPoint) {
      this.goalPoint.x = goalPoint.x || 0;
      this.goalPoint.z = goalPoint.z || 0;
    }
  }

  cancel() {
    this.armedAt = -1;
    this.active = false;
    this.t = 0;
  }

  /**
   * Advance the cutaway.
   * @returns {object|null} a render state to draw INSTEAD of the live one, or
   *   null when the cutaway is not running and the live state should be drawn.
   */
  update(dt) {
    if (this.armedAt < 0) return null;
    const since = this.clock - this.armedAt;
    if (since < REPLAY_DELAY) return null;
    if (!this.active) { this.active = true; this.t = 0; }
    this.t += dt > 0 ? dt : 0;
    if (this.t >= REPLAY_LENGTH) { this.cancel(); return null; }
    // Cutaway time -> recorded time. One second of wall time advances the
    // recording by REPLAY_RATE seconds, and the window ends exactly on the goal.
    const at = this.armedAt - REPLAY_LOOKBACK + this.t * REPLAY_RATE;
    const frame = this.sample(at);
    // Nothing recorded that far back yet (a goal in the first two seconds of a
    // match): drop the cutaway rather than show a frozen frame.
    if (!frame) { this.cancel(); return null; }
    return frame;
  }

  /** True while the cutaway owns the picture. */
  get showing() { return this.active; }

  /** Normalised progress through the cutaway, 0..1. */
  get progress() { return REPLAY_LENGTH > 0 ? Math.min(1, this.t / REPLAY_LENGTH) : 1; }

  /**
   * The recorded state at an absolute clock time, linearly interpolated
   * between the two bracketing samples. Returns null if it has aged out.
   */
  sample(at) {
    if (this.filled < 2) return null;
    const oldest = (this.head - this.filled + this.capacity) % this.capacity;
    const b = this.buf;
    const timeAt = (slot) => b[((oldest + slot) % this.capacity) * this.stride];
    const t0 = timeAt(0);
    const t1 = timeAt(this.filled - 1);
    if (!(at >= t0) || at > t1) return null;
    // Linear scan backwards from the newest is fine: 120 slots, once a frame,
    // and the target is almost always near the end.
    let lo = 0;
    for (let i = this.filled - 1; i >= 0; i--) {
      if (timeAt(i) <= at) { lo = i; break; }
    }
    const hi = Math.min(this.filled - 1, lo + 1);
    const a = timeAt(lo);
    const c = timeAt(hi);
    const f = c > a ? (at - a) / (c - a) : 0;
    const baseA = ((oldest + lo) % this.capacity) * this.stride;
    const baseB = ((oldest + hi) % this.capacity) * this.stride;
    const mix = (k) => b[baseA + k] + (b[baseB + k] - b[baseA + k]) * f;

    const out = this.out;
    let o = 1;
    for (const key of BALL_FIELDS) {
      // holder is an index, not a quantity: never interpolate it
      out.ball[key] = key === 'holder' ? b[baseA + o] : mix(o);
      o++;
    }
    for (let i = 0; i < this.playerCount; i++) {
      const p = out.players[i];
      for (const key of PLAYER_FIELDS) {
        // counters must step, not blend, or the animators' edge detection
        // would never see the jump that IS the event
        p[key] = key === 'x' || key === 'z' || key === 'vx' || key === 'vz'
          ? mix(o) : b[baseA + o];
        o++;
      }
    }
    return out;
  }
}

// ------------------------------------------------------------------- rig ----

export const CAM_MODES = Object.freeze([
  { id: 'yayin', label: 'Kamera: Yayın' },
  { id: 'capraz', label: 'Kamera: Çapraz' },
  { id: 'fpv', label: 'Kamera: Oyuncu' },
]);

const MODE_KEY = 'goalnet-arena-cam';

/**
 * The arena's camera. Modes and framing follow the shipping rig so the two
 * views agree; the shake and the replay orbit are this file's.
 */
export class ArenaCameraRig {
  constructor(camera, opts = {}) {
    this.camera = camera;
    this.playerCount = opts.playerCount || 0;
    // The chase camera's stand-off has to scale with the character, and this is
    // not a nicety. The arena stretches a 1.75 m rig onto the core's collision
    // disc, which makes a player about 3.7 m tall; the shipping rig's fixed
    // 3.6 m stand-off at 2.4 m height then sits INSIDE the torso and the player
    // camera shows the inside of a shirt.
    this.bodyScale = opts.bodyScale || 1;
    let stored = null;
    try { stored = localStorage.getItem(MODE_KEY); } catch { /* fine */ }
    const found = CAM_MODES.findIndex((m) => m.id === stored);
    this.modeIndex = found >= 0 ? found : 0;
    this.camZ = 0;
    this.cam = { x: 28, y: 24.5, z: 0, lx: 2.6, ly: 0.2, lz: 0 };
    this.shake = new CameraShake();
    this.replay = new GoalReplay(this.playerCount);
    this.goalT = 0;
    this.orbit = 0;
  }

  get mode() { return CAM_MODES[this.modeIndex].id; }

  cycle() {
    this.modeIndex = (this.modeIndex + 1) % CAM_MODES.length;
    try { localStorage.setItem(MODE_KEY, this.mode); } catch { /* fine */ }
    return CAM_MODES[this.modeIndex].label;
  }

  /**
   * A goal. Kicks the camera and arms the cutaway in one call, so a caller
   * cannot do half of it.
   */
  onGoal(ballPos) {
    this.shake.kick(SHAKE.goal);
    this.replay.arm(ballPos);
  }

  /** Any other impact. `SHAKE` holds the sanctioned strengths. */
  impact(strength) { this.shake.kick(strength); }

  /**
   * @param {number} dt
   * @param {object} ctx { ball:{x,y,z}, state, me }
   */
  update(dt, ctx) {
    const b = ctx.ball;
    this.camZ += (b.z * 0.28 - this.camZ) * Math.min(1, dt * 3);
    let t;

    if (this.replay.showing) {
      // The cutaway: a slow arc around the point the ball crossed the line,
      // dropping toward it. Deliberately a different SHAPE from every live
      // camera, so a viewer knows instantly that this already happened.
      const u = this.replay.progress;
      this.orbit += dt * 0.55;
      const s = Math.sign(this.replay.goalPoint.z) || 1;
      const radius = 13.5 - u * 4.5;
      const angle = this.orbit + s * 0.6;
      t = {
        x: Math.sin(angle) * radius * 0.55 + 6,
        y: 6.5 - u * 4.0,
        z: s * (11.0 + Math.cos(angle) * 2.4) + this.replay.goalPoint.z * 0.1,
        lx: b.x, ly: b.y + 0.35, lz: b.z,
      };
    } else if (ctx.state === 'goal') {
      this.goalT += dt;
      const s = Math.sign(b.z) || 1;
      const push = Math.min(this.goalT / 3, 1);
      if (this.mode === 'fpv') {
        t = { x: b.x * 0.55 + 4, y: 1.6 + push * 0.5, z: s * (10.8 + push * 3),
              lx: b.x, ly: b.y + 0.3, lz: b.z };
      } else if (this.mode === 'capraz') {
        t = { x: 13 - push * 4, y: 7 - push * 3.6, z: s * (10.5 + push * 3),
              lx: b.x, ly: b.y + 0.4, lz: b.z };
      } else {
        t = { x: 8.5 - push * 2.5, y: 2.8 - push * 0.7, z: s * (12.6 + push * 2.2),
              lx: b.x, ly: b.y + 0.3, lz: b.z };
      }
    } else if (this.mode === 'fpv' && ctx.me) {
      const me = ctx.me;
      const s = this.bodyScale;
      const fx = Math.sin(me.facing);
      const fz = Math.cos(me.facing);
      const back = 3.6 * s;
      t = {
        x: me.x - fx * back, y: 2.4 * s, z: me.z - fz * back,
        lx: me.x + fx * 4 * s, ly: 0.9 * s, lz: me.z + fz * 4 * s,
      };
    } else if (this.mode === 'capraz') {
      t = { x: 23, y: 15, z: this.camZ * 0.55 + 11,
            lx: b.x * 0.45, ly: 0.6, lz: b.z * 0.55 };
    } else {
      t = { x: 28, y: 24.5, z: this.camZ, lx: 2.6, ly: 0.2, lz: this.camZ * 1.2 };
    }
    if (ctx.state !== 'goal') this.goalT = 0;
    if (!this.replay.showing) this.orbit = 0;

    const k = Math.min(1, dt * (this.replay.showing
      ? 3.8
      : ctx.state === 'goal'
        ? (this.goalT < 0.8 ? 5.5 : 2.2)
        : (this.mode === 'fpv' ? 6.5 : 3.2)));
    const c = this.cam;
    for (const key of ['x', 'y', 'z', 'lx', 'ly', 'lz']) c[key] += (t[key] - c[key]) * k;

    // The jitter rides on the solved POSITION only. The look-at target and the
    // input basis below stay on the unshaken values, so a shake never twitches
    // the controls or the aim — the single most important property it has.
    const o = this.shake.update(dt);
    this.camera.position.set(c.x + o.x, c.y + o.y, c.z + o.z);
    this.camera.lookAt(c.lx, c.ly, c.lz);

    let fx = c.lx - c.x;
    let fz = c.lz - c.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl; fz /= fl;
    setInputBasis(fx, fz, -fz, fx);
  }
}
