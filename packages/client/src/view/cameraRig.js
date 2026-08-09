import { setInputBasis } from '../game/input.js';

const MODE_KEY = 'goalnet-cam';

// Impact shake: e^(-5t) is under 1% of the initial strength after 1 s and
// inaudible by 1.5 s, so a burst of goals never accumulates into seasickness.
const SHAKE_DECAY = 5;
const SHAKE_MAX = 0.8;
const SHAKE_CUTOFF = 1e-4;

// Sum of three incommensurate sines per axis: smooth like value noise, no
// table, and no two axes ever line up into a straight-line jolt.
function jitter(t, seed) {
  return Math.sin(t * 13.1 + seed) * 0.6
    + Math.sin(t * 23.7 + seed * 2.3) * 0.3
    + Math.sin(t * 41.3 + seed * 4.1) * 0.1;
}
export const CAM_MODES = [
  { id: 'yayin', label: 'Kamera: Yayın' },
  { id: 'capraz', label: 'Kamera: Çapraz' },
  { id: 'fpv', label: 'Kamera: Oyuncu' },
];

// One camera brain for every match view (local game and multiplayer guest):
// broadcast side-on, FIFA-style diagonal tele, or a low chase cam behind the
// player. A goal always cuts to the cinematic net close-up.
export class CameraRig {
  /**
   * @param {THREE.Camera} camera
   * @param {{halfW?:number, halfL?:number}} [pitch] playing area in metres.
   *   Every framing distance below was tuned by eye on the shipping game's
   *   22 x 36 m pitch, so they are stored as fractions of it and scaled back
   *   out here. A narrower pitch (the arena's is 17.14 m) pulls the camera in
   *   by the same fraction instead of leaving half the frame on empty grass.
   */
  constructor(camera, pitch) {
    this.camera = camera;
    this.sx = pitch && pitch.halfW ? pitch.halfW / 11 : 1;
    this.sz = pitch && pitch.halfL ? pitch.halfL / 18 : 1;
    let stored = null;
    try { stored = localStorage.getItem(MODE_KEY); } catch { /* fine */ }
    this.modeIndex = Math.max(0, CAM_MODES.findIndex((m) => m.id === stored));
    this.camZ = 0;
    this.goalT = 0; // seconds inside the goal cinematic (drives the push-in)
    this.cam = { x: 28 * this.sx, y: 24.5 * this.sx, z: 0,
                 lx: 2.6 * this.sx, ly: 0.2, lz: 0 };
    this.shakeAmp = 0;  // current impact energy, decays exponentially
    this.shakeT = 0;    // own clock so the jitter is frame-rate independent
    this.shakeOffset = { x: 0, y: 0, z: 0 };
  }

  // Impact kick for the camera. Strength is roughly metres of peak travel:
  // 0.5 for a goal, 0.25 for the woodwork, 0.15 for a body hitting the turf.
  // Shakes never stack past the strongest one in flight.
  shake(strength) {
    const s = Number.isFinite(strength) ? Math.abs(strength) : 0;
    if (s > this.shakeAmp) this.shakeAmp = Math.min(s, SHAKE_MAX);
  }

  get mode() { return CAM_MODES[this.modeIndex].id; }

  cycle() {
    this.modeIndex = (this.modeIndex + 1) % CAM_MODES.length;
    try { localStorage.setItem(MODE_KEY, this.mode); } catch { /* fine */ }
    return CAM_MODES[this.modeIndex].label;
  }

  // ctx: { ball: {x,y,z}, state, me: Player|null }
  update(dt, ctx) {
    const b = ctx.ball;
    this.camZ += (b.z * 0.28 - this.camZ) * Math.min(1, dt * 3);
    let t;
    if (ctx.state === 'goal') {
      // mode-aware cinematic: each camera has its own goal shot, every one
      // tracking the ball live in the net with a slow push-in
      this.goalT += dt;
      const s = Math.sign(b.z) || 1;
      const push = Math.min(this.goalT / 3, 1);
      if (this.mode === 'fpv') {
        // low over-the-shoulder crawl toward the net
        t = { x: b.x * 0.55 + 4 * this.sx, y: 1.6 + push * 0.5,
              z: s * (10.8 + push * 3) * this.sz,
              lx: b.x, ly: b.y + 0.3, lz: b.z };
      } else if (this.mode === 'capraz') {
        // diagonal crane dropping down toward the net
        t = { x: (13 - push * 4) * this.sx, y: 7 - push * 3.6,
              z: s * (10.5 + push * 3) * this.sz,
              lx: b.x, ly: b.y + 0.4, lz: b.z };
      } else {
        // broadcast: the classic low net-side shot, easing closer
        t = { x: (8.5 - push * 2.5) * this.sx, y: 2.8 - push * 0.7,
              z: s * (12.6 + push * 2.2) * this.sz,
              lx: b.x, ly: b.y + 0.3, lz: b.z };
      }
    } else if (this.mode === 'fpv' && ctx.me) {
      const me = ctx.me;
      const fx = Math.sin(me.facing), fz = Math.cos(me.facing);
      t = {
        x: me.pos.x - fx * 3.6, y: 2.4, z: me.pos.z - fz * 3.6,
        lx: me.pos.x + fx * 4, ly: 0.8, lz: me.pos.z + fz * 4,
      };
    } else if (this.mode === 'capraz') {
      t = {
        x: 23 * this.sx, y: 15 * this.sx, z: this.camZ * 0.55 + 11 * this.sz,
        lx: b.x * 0.45, ly: 0.6, lz: b.z * 0.55,
      };
    } else {
      t = { x: 28 * this.sx, y: 24.5 * this.sx, z: this.camZ,
            lx: 2.6 * this.sx, ly: 0.2, lz: this.camZ * 1.2 };
    }
    if (ctx.state !== 'goal') this.goalT = 0;
    // fpv turns fast; the fixed cameras glide; the goal cut snaps in quick
    const k = Math.min(1, dt * (ctx.state === 'goal'
      ? (this.goalT < 0.8 ? 5.5 : 2.2)
      : (this.mode === 'fpv' ? 6.5 : 3.2)));
    const c = this.cam;
    for (const key of ['x', 'y', 'z', 'lx', 'ly', 'lz']) c[key] += (t[key] - c[key]) * k;

    // Impact jitter rides on top of the solved position only. The look-at
    // target and the basis below stay on the unshaken values, so a shake never
    // twitches the controls or the aim.
    const o = this.shakeOffset;
    if (this.shakeAmp > SHAKE_CUTOFF) {
      this.shakeT += dt;
      this.shakeAmp *= Math.exp(-SHAKE_DECAY * dt);
      if (this.shakeAmp <= SHAKE_CUTOFF) this.shakeAmp = 0;
      const a = this.shakeAmp;
      o.x = jitter(this.shakeT, 0.0) * a;
      o.y = jitter(this.shakeT, 1.7) * a * 0.7;
      o.z = jitter(this.shakeT, 3.4) * a;
    } else if (o.x !== 0 || o.y !== 0 || o.z !== 0) {
      this.shakeAmp = 0;
      o.x = o.y = o.z = 0;
    }

    this.camera.position.set(c.x + o.x, c.y + o.y, c.z + o.z);
    this.camera.lookAt(c.lx, c.ly, c.lz);

    // keep keyboard directions matched to what is on screen: project the
    // view direction to the ground and hand it to the input layer
    let fx = c.lx - c.x, fz = c.lz - c.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl; fz /= fl;
    setInputBasis(fx, fz, -fz, fx); // screen-right = view dir rotated -90°
  }
}
