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
      const s = Math.sign(b.z) || 1;
      t = { x: 8.5, y: 2.8, z: s * 12.6, lx: b.x * 0.8, ly: 1.0, lz: s * 17.6 };
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
    // fpv turns fast; the fixed cameras glide
    const k = Math.min(1, dt * (this.mode === 'fpv' && ctx.state !== 'goal' ? 6.5 : 3.2));
    const c = this.cam;
    for (const key of ['x', 'y', 'z', 'lx', 'ly', 'lz']) c[key] += (t[key] - c[key]) * k;
    this.camera.position.set(c.x, c.y, c.z);
    this.camera.lookAt(c.lx, c.ly, c.lz);
  }
}
