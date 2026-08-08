const VOL_KEY = 'goalnet-vol';

// Crowd bed: a looping filtered-noise murmur under everything else.
const BED_GAIN = 0.17;     // gain at full intensity, before the swells
const NEAR_GOAL_Z = 11;    // |z| past which a kick counts as a chance
const BED_RAMP = 0.55;     // seconds-ish time constant for intensity changes

// Tiny procedural sound engine — no audio assets, everything is synthesized
// on a lazily created AudioContext (browsers require a user gesture first).
//
// Ambiance API (the crowd murmur, separate from the one-shots in play()):
//   sfx.setAmbiance(level)  0..1 bed intensity — 0 in menus, ~1 during play.
//                           Idempotent, so calling it every frame is free.
//   sfx.notify(event, ball) transient swells from world events. Accepts the
//                           same objects react() already handles; pass the
//                           ball position so a kick near a goal swells and a
//                           kick in midfield does not.
// The bed itself starts on the first user gesture (or the first sound), which
// is when a browser will let an AudioContext run at all.
export class Sfx {
  constructor() {
    let v = 0.7;
    try { const s = localStorage.getItem(VOL_KEY); if (s !== null) v = +s; } catch { /* fine */ }
    this.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.7;
    this.ctx = null;
    this.noiseBuf = null;
    this.ambTarget = 0;
    this.bed = null;
    // First click or keypress unlocks audio; the bed comes up from there.
    if (typeof addEventListener === 'function') {
      const arm = () => this.ensure();
      addEventListener('pointerdown', arm, { once: true });
      addEventListener('keydown', arm, { once: true });
    }
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.bed) this.#buildBed();
    return true;
  }

  // Looping noise shaped into a distant murmur, with two slow LFOs breathing
  // on it so the bed never sounds like a static hiss. One source, one filter
  // chain, no per-frame work: everything after this is AudioParam ramps.
  #buildBed() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 140;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 640; lp.Q.value = 0.5;
    // wander multiplies, level sets intensity: at level 0 the wander cannot
    // leak any murmur into the menus.
    const wander = ctx.createGain();
    wander.gain.value = 1;
    const level = ctx.createGain();
    level.gain.value = 0;
    src.connect(hp); hp.connect(lp); lp.connect(wander);
    wander.connect(level); level.connect(this.master);

    const lfos = [];
    for (const [rate, depth, phase] of [[0.055, 0.34, 0], [0.13, 0.17, 1.9]]) {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = rate;
      const g = ctx.createGain();
      g.gain.value = depth;
      o.connect(g); g.connect(wander.gain);
      o.start(ctx.currentTime + phase * 0.01);
      lfos.push(o);
    }
    src.start();
    this.bed = { src, level, wander, lfos };
    if (this.ambTarget > 0) this.#bedTo(BED_GAIN * this.ambTarget, BED_RAMP);
  }

  #bedTo(value, tc, at = null) {
    const g = this.bed.level.gain;
    const t = at ?? this.ctx.currentTime;
    if (at === null) {
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
    }
    g.setTargetAtTime(value, t, Math.max(0.02, tc));
  }

  /** Crowd bed intensity, 0..1. Cheap to call every frame. */
  setAmbiance(level) {
    const v = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
    if (Math.abs(v - this.ambTarget) < 0.01) return;
    this.ambTarget = v;
    const hadBed = !!this.bed;
    if (!this.ensure()) return;
    // A bed built by that ensure() already ramped itself to the new target.
    if (hadBed) this.#bedTo(BED_GAIN * v, BED_RAMP);
  }

  /** World events swell the bed. `ball` is optional {x,y,z} for kick range. */
  notify(event, ball = null) {
    const type = typeof event === 'string' ? event : event?.type;
    if (!type) return;
    switch (type) {
      case 'goal':
        this.#swell(0.62, 2.4, 0.15);
        break;
      case 'post':
      case 'crossbar':
        this.#swell(0.36, 0.9, 0.05);
        break;
      case 'kick': {
        const z = Number.isFinite(event?.z) ? event.z : ball?.z;
        if (Number.isFinite(z) && Math.abs(z) > NEAR_GOAL_Z) this.#swell(0.27, 0.5, 0.04);
        break;
      }
      case 'ragdoll':
        this.#swell(0.22, 0.45, 0.06);
        break;
      default:
        break;
    }
  }

  #swell(peak, hold, attack) {
    if (this.ambTarget <= 0 || this.volume <= 0) return; // menus stay silent
    if (!this.ensure()) return;
    const base = BED_GAIN * this.ambTarget;
    const top = Math.max(base, peak * this.ambTarget);
    const now = this.ctx.currentTime;
    this.#bedTo(top, attack);
    this.#bedTo(base, hold * 0.45, now + hold);
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
    try { localStorage.setItem(VOL_KEY, String(this.volume)); } catch { /* fine */ }
  }

  #env(node, t0, a, peak, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + a + decay);
    node.connect(g);
    g.connect(this.master);
    return g;
  }

  #noise(t0, dur, freq, q, peak, a = 0.005) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    src.connect(bp);
    this.#env(bp, t0, a, peak, dur);
    src.start(t0); src.stop(t0 + a + dur + 0.05);
  }

  #tone(t0, dur, freq, type, peak, slideTo = null) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    this.#env(o, t0, 0.004, peak, dur);
    o.start(t0); o.stop(t0 + dur + 0.1);
  }

  play(name) {
    if (!this.ensure() || this.volume <= 0) return;
    const t = this.ctx.currentTime + 0.01;
    switch (name) {
      case 'kick':
        this.#tone(t, 0.09, 95, 'sine', 0.5, 55);
        this.#noise(t, 0.06, 900, 0.8, 0.25);
        break;
      case 'post':
        this.#tone(t, 0.4, 2100, 'triangle', 0.3, 1900);
        this.#tone(t, 0.25, 3150, 'sine', 0.12);
        break;
      case 'goal': // crowd roar swell
        this.#noise(t, 1.9, 750, 0.35, 0.5, 0.18);
        this.#noise(t, 1.4, 320, 0.5, 0.35, 0.12);
        this.#tone(t + 0.05, 0.5, 2600, 'square', 0.06); // whistle on top
        break;
      case 'whistle':
        this.#tone(t, 0.35, 2500, 'square', 0.09);
        this.#tone(t + 0.02, 0.3, 2520, 'square', 0.05);
        break;
      case 'thud':
        this.#tone(t, 0.12, 70, 'sine', 0.4, 45);
        this.#noise(t, 0.1, 300, 0.6, 0.2);
        break;
      case 'ooh':
        this.#noise(t, 0.6, 600, 0.4, 0.22, 0.06);
        break;
      case 'save': // glove on leather, then a short relieved swell
        this.#noise(t, 0.07, 1500, 1.1, 0.3, 0.004);
        this.#tone(t, 0.11, 180, 'sine', 0.22, 120);
        this.#noise(t + 0.05, 0.55, 700, 0.4, 0.2, 0.08);
        break;
      default:
        break;
    }
  }
}
