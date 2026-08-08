// Matrix #25 — cheers and base sounds, plus the autoplay gate.
//
// The synthesis engine is view/sfx.js, unchanged in every respect that
// matters: procedural crowd bed, procedural one-shots, no audio assets. What
// this module adds is the part that file does not have, and the part iOS
// actually breaks on.
//
// view/sfx.js arms itself with `addEventListener('pointerdown', arm, {once:
// true})`. That is right on desktop and wrong on iOS, because there
// `ctx.resume()` inside the first gesture can still leave the context
// suspended (Safari has resolved the promise with the context interrupted
// more than once), and because iOS suspends the context again every time the
// tab goes to the background. With a one-shot listener the game is then
// silent for the rest of the session with no way back.
//
// So the gate below:
//   * never uses {once: true} — it removes its listeners only after it has
//     SEEN state === 'running', not after it has asked once;
//   * re-arms itself if the context falls back to suspended or interrupted;
//   * retries on visibilitychange and pageshow, which is when iOS hands the
//     context back;
//   * takes its context through an injected `ensure()`, so the whole state
//     machine can be driven by a fake in a headless test.
//
// presentation.md also asks for ducking and a tension value driving the crowd
// layer; `setTension` maps that onto the bed the engine already exposes.

import { Sfx } from '../../view/sfx.js';

const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];
const WAKEUPS = ['visibilitychange', 'pageshow', 'focus'];

/**
 * @param {{ensure:() => (object|null), on?:Function, off?:Function,
 *          doc?:object, maxAttempts?:number}} deps
 *   `ensure` returns something with `.state` and `.resume()`, or null when
 *   audio is not available at all.
 */
export function createAudioGate(deps) {
  const on = deps.on || ((t, h) => globalThis.addEventListener?.(t, h));
  const off = deps.off || ((t, h) => globalThis.removeEventListener?.(t, h));
  const doc = deps.doc !== undefined ? deps.doc : globalThis.document;
  const maxAttempts = deps.maxAttempts ?? 200;

  const gate = {
    state: 'idle',      // idle | suspended | running | unsupported
    attempts: 0,
    resumes: 0,
    armed: false,
    context: null,
    onChange: null,
  };

  const setState = (next) => {
    if (gate.state === next) return;
    gate.state = next;
    gate.onChange?.(next);
  };

  const handler = () => { gate.poke(); };

  const arm = () => {
    if (gate.armed) return;
    gate.armed = true;
    for (const type of GESTURES) on(type, handler);
    for (const type of WAKEUPS) {
      if (type === 'visibilitychange' && doc?.addEventListener) {
        doc.addEventListener(type, handler);
      } else {
        on(type, handler);
      }
    }
  };

  const disarm = () => {
    if (!gate.armed) return;
    gate.armed = false;
    for (const type of GESTURES) off(type, handler);
    for (const type of WAKEUPS) {
      if (type === 'visibilitychange' && doc?.removeEventListener) {
        doc.removeEventListener(type, handler);
      } else {
        off(type, handler);
      }
    }
  };

  /** One attempt. Safe to call from a gesture, a timer or the render loop. */
  gate.poke = () => {
    if (gate.state === 'running') {
      // iOS takes the context away again on backgrounding; notice and re-arm.
      if (gate.context && gate.context.state !== 'running') {
        setState(gate.context.state === 'closed' ? 'unsupported' : 'suspended');
        arm();
      } else {
        return gate.state;
      }
    }
    if (gate.attempts >= maxAttempts) return gate.state;
    gate.attempts++;
    const ctx = deps.ensure();
    if (!ctx) {
      setState('unsupported');
      return gate.state;
    }
    gate.context = ctx;
    if (ctx.state === 'running') {
      setState('running');
      disarm();
      return gate.state;
    }
    setState('suspended');
    gate.resumes++;
    let out = null;
    try { out = ctx.resume?.(); } catch { /* a closed context throws; stay armed */ }
    // A fake, and Chrome, flip synchronously; Safari flips on the promise.
    check();
    if (out && typeof out.then === 'function') out.then(check, () => {});
    return gate.state;
  };

  function check() {
    const ctx = gate.context;
    if (!ctx) return;
    if (ctx.state === 'running') {
      setState('running');
      disarm();
    } else if (ctx.state === 'closed') {
      setState('unsupported');
      disarm();
    }
  }

  gate.arm = arm;
  gate.disarm = disarm;
  return gate;
}

const COOLDOWN_MS = {
  kick: 60,
  save: 260,
  post: 140,
  whistle: 300,
  goal: 900,
  ooh: 500,
  thud: 90,
};

/**
 * The arena's audio surface. Wraps the shipping engine, adds the gate and the
 * cooldowns that stop a per-frame event from machine-gunning a one-shot.
 */
export class ArenaSfx {
  /**
   * @param {{engine?:object, gate?:object, now?:Function}} [opts] `engine` and
   *   `gate` are injectable so the state machine can be tested without a real
   *   AudioContext.
   */
  constructor(opts = {}) {
    this.engine = opts.engine || new Sfx();
    this.now = opts.now || (() => (typeof performance !== 'undefined'
      ? performance.now() : Date.now()));
    this.last = Object.create(null);
    this.played = Object.create(null);
    this.tensionLevel = 0;
    this.ambiance = 0;
    this.gate = opts.gate || createAudioGate({
      ensure: () => (this.engine.ensure() ? this.engine.ctx : null),
    });
    this.gate.arm();
    // Creating the context up front is allowed everywhere; it simply comes up
    // suspended when there has been no gesture yet, which is the state the
    // gate is built to sit in.
    this.gate.poke();
  }

  get state() { return this.gate.state; }

  /** Call from the render loop; free once the context is running. */
  poke() { return this.gate.poke(); }

  /** Crowd bed level, 0..1. Idempotent, cheap every frame. */
  setAmbiance(level) {
    this.ambiance = Math.max(0, Math.min(1, Number(level) || 0));
    this.engine.setAmbiance?.(this.ambiance);
  }

  /**
   * presentation.md's tension value: score gap, time left and how close the
   * ball is to a goal, collapsed to one number that drives the bed.
   * @param {number} t 0..1
   */
  setTension(t) {
    this.tensionLevel = Math.max(0, Math.min(1, Number(t) || 0));
    this.setAmbiance(0.42 + 0.58 * this.tensionLevel);
  }

  /** @param {string} name @returns {boolean} whether it actually fired */
  play(name) {
    const t = this.now();
    const gap = COOLDOWN_MS[name] ?? 120;
    if (this.last[name] !== undefined && t - this.last[name] < gap) return false;
    this.last[name] = t;
    this.played[name] = (this.played[name] || 0) + 1;
    this.engine.play?.(name);
    return true;
  }

  onGoal(team) {
    this.play('goal');
    this.engine.notify?.('goal');
    void team;
  }

  onStrike(ballZ) {
    this.play('kick');
    this.engine.notify?.({ type: 'kick', z: ballZ });
  }

  onSave() {
    this.play('save');
    this.engine.notify?.('post');
  }

  onPost() {
    this.play('post');
    this.engine.notify?.('post');
  }

  onWhistle() { this.play('whistle'); }

  stats() {
    return {
      state: this.state,
      attempts: this.gate.attempts,
      resumes: this.gate.resumes,
      armed: this.gate.armed,
      ambiance: this.ambiance,
      tension: this.tensionLevel,
      played: { ...this.played },
    };
  }

  dispose() { this.gate.disarm(); }
}

/**
 * Tension from the match situation. Pure, so the number in the report and the
 * number in the test come from the same place.
 *
 * @param {{scoreGap:number, secondsLeft:number, ballZ:number, halfZ:number}} s
 * @returns {number} 0..1
 */
export function tensionOf(s) {
  const gap = Math.min(3, Math.abs(Number(s.scoreGap) || 0));
  const close = 1 - gap / 3;                       // a tight score is tense
  const left = Number(s.secondsLeft);
  const late = Number.isFinite(left) && left >= 0
    ? Math.max(0, Math.min(1, 1 - left / 120)) : 0; // the last two minutes
  const halfZ = Number(s.halfZ) || 18;
  const near = Math.max(0, Math.min(1, (Math.abs(Number(s.ballZ) || 0) / halfZ - 0.45) / 0.55));
  return Math.max(0, Math.min(1, 0.34 * close + 0.3 * late + 0.36 * near));
}
