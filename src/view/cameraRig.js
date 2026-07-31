import { setInputBasis } from '../game/input.js';

const MODE_KEY = 'goalnet-cam';
export const CAM_MODES = [
  { id: 'yayin', label: 'Kamera: Yayın' },
  { id: 'capraz', label: 'Kamera: Çapraz' },
  { id: 'fpv', label: 'Kamera: Oyuncu' },
];

// One camera brain for every match view (local game and multiplayer guest):
// broadcast side-on, FIFA-style diagonal tele, or a low chase cam behind the
// player. A goal always cuts to the cinematic net close-up.
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    let stored = null;
    try { stored = localStorage.getItem(MODE_KEY); } catch { /* fine */ }
    this.modeIndex = Math.max(0, CAM_MODES.findIndex((m) => m.id === stored));
    this.camZ = 0;
    this.goalT = 0; // seconds inside the goal cinematic (drives the push-in)
    this.cam = { x: 28, y: 24.5, z: 0, lx: 2.6, ly: 0.2, lz: 0 };
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
        t = { x: b.x * 0.55 + 4, y: 1.6 + push * 0.5, z: s * (10.8 + push * 3),
              lx: b.x, ly: b.y + 0.3, lz: b.z };
      } else if (this.mode === 'capraz') {
        // diagonal crane dropping down toward the net
        t = { x: 13 - push * 4, y: 7 - push * 3.6, z: s * (10.5 + push * 3),
              lx: b.x, ly: b.y + 0.4, lz: b.z };
      } else {
        // broadcast: the classic low net-side shot, easing closer
        t = { x: 8.5 - push * 2.5, y: 2.8 - push * 0.7, z: s * (12.6 + push * 2.2),
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
        x: 23, y: 15, z: this.camZ * 0.55 + 11,
        lx: b.x * 0.45, ly: 0.6, lz: b.z * 0.55,
      };
    } else {
      t = { x: 28, y: 24.5, z: this.camZ, lx: 2.6, ly: 0.2, lz: this.camZ * 1.2 };
    }
    if (ctx.state !== 'goal') this.goalT = 0;
    // fpv turns fast; the fixed cameras glide; the goal cut snaps in quick
    const k = Math.min(1, dt * (ctx.state === 'goal'
      ? (this.goalT < 0.8 ? 5.5 : 2.2)
      : (this.mode === 'fpv' ? 6.5 : 3.2)));
    const c = this.cam;
    for (const key of ['x', 'y', 'z', 'lx', 'ly', 'lz']) c[key] += (t[key] - c[key]) * k;
    this.camera.position.set(c.x, c.y, c.z);
    this.camera.lookAt(c.lx, c.ly, c.lz);

    // keep keyboard directions matched to what is on screen: project the
    // view direction to the ground and hand it to the input layer
    let fx = c.lx - c.x, fz = c.lz - c.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl; fz /= fl;
    setInputBasis(fx, fz, -fz, fx); // screen-right = view dir rotated -90°
  }
}
