// A pinned Verlet cloth sheet — the corner-flag half of matrix #23.
//
// rendering-optimization.md asks for "a particle grid (~10x8) + distance
// constraints, 2-4 relaxation iterations, top edge pinned", which is exactly
// what this is. It is deliberately the same family of solver as the goal net
// (position-based, relax then re-derive velocity from the position delta);
// the net gets the full XPBD compliance treatment because it has to swallow a
// shot, whereas a flag only has to flutter, so plain Verlet with a stiffness
// factor is both enough and cheaper.
//
// Pure arithmetic on typed arrays: no three.js, no DOM. The renderer in
// flags.js copies `pos` straight into a vertex buffer.

// Air drag on bunting is strong. Verlet's velocity is implicit in the position
// delta, so a constant acceleration settles at a * h^2 / (1 - damping): at
// 0.986 that terminal step is several cell widths, and no number of relaxation
// passes recovers from a particle that crossed the sheet in one go.
const DEFAULT_DAMPING = 0.955;

export class ClothSheet {
  /**
   * @param {{cols?:number, rows?:number, width?:number, height?:number,
   *          origin?:number[], right?:number[], up?:number[],
   *          stiffness?:number, mass?:number}} opts
   *   `origin` is the pinned top corner; the sheet runs `width` along `right`
   *   and hangs `height` along the negative of `up`.
   */
  constructor(opts = {}) {
    const cols = this.cols = Math.max(2, opts.cols || 10);
    const rows = this.rows = Math.max(2, opts.rows || 8);
    const width = this.width = opts.width ?? 0.45;
    const height = this.height = opts.height ?? 0.3;
    const origin = opts.origin || [0, 0, 0];
    const right = normalize(opts.right || [1, 0, 0]);
    const up = normalize(opts.up || [0, 1, 0]);
    this.stiffness = opts.stiffness ?? 0.85;
    // Bunting does not stretch. A few Gauss-Seidel sweeps cannot converge a
    // sheet that a gust has yanked, so the same trick the goal net uses is
    // applied here: a hard cap that rigidly projects any over-long edge back.
    // It is what keeps an absurd wind from turning the flag into a streamer.
    this.strainLimit = opts.strainLimit ?? 1.06;
    this.count = cols * rows;

    this.pos = new Float32Array(this.count * 3);
    this.prev = new Float32Array(this.count * 3);
    this.pinned = new Uint8Array(this.count);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const u = (c / (cols - 1)) * width;
        const v = (r / (rows - 1)) * height;
        const o = i * 3;
        this.pos[o] = origin[0] + right[0] * u - up[0] * v;
        this.pos[o + 1] = origin[1] + right[1] * u - up[1] * v;
        this.pos[o + 2] = origin[2] + right[2] * u - up[2] * v;
        // the column against the pole is laced to it
        if (c === 0) this.pinned[i] = 1;
      }
    }
    this.prev.set(this.pos);
    this.rest = this.pos.slice();

    // structural + shear distance constraints, packed the way the net packs its
    const links = [];
    const at = (r, c) => r * cols + c;
    const dist = (a, b) => {
      const oa = a * 3, ob = b * 3;
      return Math.hypot(
        this.pos[ob] - this.pos[oa],
        this.pos[ob + 1] - this.pos[oa + 1],
        this.pos[ob + 2] - this.pos[oa + 2],
      );
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c < cols - 1) links.push([at(r, c), at(r, c + 1)]);
        if (r < rows - 1) links.push([at(r, c), at(r + 1, c)]);
        if (c < cols - 1 && r < rows - 1) links.push([at(r, c), at(r + 1, c + 1)]);
        if (c > 0 && r < rows - 1) links.push([at(r, c), at(r + 1, c - 1)]);
      }
    }
    this.linkIds = new Int32Array(links.flat());
    this.linkRest = new Float32Array(links.map(([a, b]) => dist(a, b)));
    this.linkCount = links.length;
    // No particle may travel more than a fraction of the smallest cell in one
    // step, whatever the wind claims: past that it can tunnel through its own
    // neighbours and the relaxation is solving a different sheet.
    const cell = this.linkRest.reduce((m, v) => Math.min(m, v), Infinity);
    this.maxStep = opts.maxStep ?? cell * 0.3;
  }

  /**
   * @param {number} h seconds
   * @param {{wind?:number[], gravity?:number, iters?:number, damping?:number}} [opts]
   */
  step(h, opts = {}) {
    const wind = opts.wind || [0, 0, 0];
    const gravity = opts.gravity ?? -9.81;
    const iters = Math.max(1, opts.iters ?? 3);
    const damping = opts.damping ?? DEFAULT_DAMPING;
    const { pos, prev, pinned, count } = this;
    const h2 = h * h;

    const maxStep = this.maxStep;
    for (let i = 0; i < count; i++) {
      if (pinned[i]) continue;
      const o = i * 3;
      const vx = (pos[o] - prev[o]) * damping;
      const vy = (pos[o + 1] - prev[o + 1]) * damping;
      const vz = (pos[o + 2] - prev[o + 2]) * damping;
      prev[o] = pos[o]; prev[o + 1] = pos[o + 1]; prev[o + 2] = pos[o + 2];
      let dx = vx + wind[0] * h2;
      let dy = vy + (gravity + wind[1]) * h2;
      let dz = vz + wind[2] * h2;
      // A step longer than a cell would let a particle jump through the sheet
      // and no number of relaxation passes would pull it back.
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len > maxStep) {
        const k = maxStep / len;
        dx *= k; dy *= k; dz *= k;
      }
      pos[o] += dx; pos[o + 1] += dy; pos[o + 2] += dz;
    }

    for (let it = 0; it < iters; it++) this.relax();
    // One Gauss-Seidel sweep of the limiter can break an edge it already
    // fixed, so it is swept until the cap actually holds — bounded, because a
    // frame budget matters more than the last thousandth of a millimetre.
    for (let p = 0; p < 4; p++) {
      if (!this.limitStrain()) break;
    }
  }

  /**
   * Rigidly project every over-long edge back onto the cap.
   * @returns {boolean} whether anything was over the cap
   */
  limitStrain() {
    const { pos, pinned, linkIds, linkRest, linkCount, strainLimit } = this;
    let touched = false;
    for (let l = 0; l < linkCount; l++) {
      const a = linkIds[l * 2], b = linkIds[l * 2 + 1];
      const pa = pinned[a], pb = pinned[b];
      if (pa && pb) continue;
      const oa = a * 3, ob = b * 3;
      const dx = pos[ob] - pos[oa];
      const dy = pos[ob + 1] - pos[oa + 1];
      const dz = pos[ob + 2] - pos[oa + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const cap = linkRest[l] * strainLimit;
      if (d <= cap || d < 1e-9) continue;
      touched = true;
      const corr = (d - cap) / d;
      const wa = pa ? 0 : (pb ? 1 : 0.5);
      const wb = pb ? 0 : (pa ? 1 : 0.5);
      pos[oa] += dx * corr * wa; pos[oa + 1] += dy * corr * wa; pos[oa + 2] += dz * corr * wa;
      pos[ob] -= dx * corr * wb; pos[ob + 1] -= dy * corr * wb; pos[ob + 2] -= dz * corr * wb;
    }
    return touched;
  }

  relax() {
    const { pos, pinned, linkIds, linkRest, linkCount, stiffness } = this;
    for (let l = 0; l < linkCount; l++) {
      const a = linkIds[l * 2], b = linkIds[l * 2 + 1];
      const pa = pinned[a], pb = pinned[b];
      if (pa && pb) continue;
      const oa = a * 3, ob = b * 3;
      const dx = pos[ob] - pos[oa];
      const dy = pos[ob + 1] - pos[oa + 1];
      const dz = pos[ob + 2] - pos[oa + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-9) continue;
      const corr = ((d - linkRest[l]) / d) * stiffness;
      const wa = pa ? 0 : (pb ? 1 : 0.5);
      const wb = pb ? 0 : (pa ? 1 : 0.5);
      pos[oa] += dx * corr * wa; pos[oa + 1] += dy * corr * wa; pos[oa + 2] += dz * corr * wa;
      pos[ob] -= dx * corr * wb; pos[ob + 1] -= dy * corr * wb; pos[ob + 2] -= dz * corr * wb;
    }
  }

  /** True while every particle is a finite number. */
  finite() {
    for (let i = 0; i < this.pos.length; i++) {
      if (!Number.isFinite(this.pos[i])) return false;
    }
    return true;
  }

  /** Snap back to the pose the sheet was built in. */
  reset() {
    this.pos.set(this.rest);
    this.prev.set(this.rest);
  }

  /** Longest edge as a multiple of its rest length; 1 means unstretched. */
  maxStrain() {
    const { pos, linkIds, linkRest, linkCount } = this;
    let worst = 0;
    for (let l = 0; l < linkCount; l++) {
      const a = linkIds[l * 2] * 3, b = linkIds[l * 2 + 1] * 3;
      const d = Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]);
      const s = linkRest[l] > 1e-9 ? d / linkRest[l] : 1;
      if (s > worst) worst = s;
    }
    return worst;
  }
}

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * Wind at a moment in time: a slow base direction with a gust riding on it.
 * Pure, so the test can pin it down and the flags and the net can share it.
 *
 * @param {number} t seconds
 * @param {number} [strength]
 * @returns {number[]} acceleration in m/s^2
 */
export function windAt(t, strength = 1) {
  const gust = 0.65 + 0.35 * Math.sin(t * 0.37) + 0.18 * Math.sin(t * 1.31 + 1.1);
  const swirl = Math.sin(t * 0.21);
  return [
    strength * gust * 5.4,
    strength * 0.8 * Math.sin(t * 2.3),
    strength * gust * 2.1 * swirl,
  ];
}
