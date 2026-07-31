const VOL_KEY = 'goalnet-vol';

// Tiny procedural sound engine — no audio assets, everything is synthesized
// on a lazily created AudioContext (browsers require a user gesture first).
export class Sfx {
  constructor() {
    let v = 0.7;
    try { const s = localStorage.getItem(VOL_KEY); if (s !== null) v = +s; } catch { /* fine */ }
    this.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.7;
    this.ctx = null;
    this.noiseBuf = null;
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
    return true;
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
      default:
        break;
    }
  }
}
