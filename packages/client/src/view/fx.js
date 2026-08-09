import * as THREE from 'three';
import { windAt } from '../core/wind.js';
import { STAND_INFO } from './crowdView.js';

// Atmosphere effects layer: goal confetti and rain. Both are pooled
// InstancedMeshes allocated once and recycled forever — update() only ever
// rewrites matrices of live particles, and nothing is created or destroyed
// while the match runs.
//
//   const fx = new Fx(scene);
//   fx.setWeather('yagmur');        // 'acik' | 'yagmur' | 'kar'
//   fx.onGoal(scorerTeam, zsign);   // burst from the stands behind that goal
//   fx.update(dt);                  // once per frame
//
// No physics coupling: nothing here is ever read by src/core.

const CONFETTI_MAX = 320;
const CONFETTI_BURST = 260;      // pieces per goal (rest of the pool idles)
const CONFETTI_LIFE = 3.3;       // seconds, plus up to +1.0 of jitter
const CONFETTI_G = 3.6;          // gentle: paper falls slowly
const CONFETTI_DRAG = 0.85;      // per second, applied to x/z drift

// Scoring-team palettes, matched to the crowd blocks in crowdView.js.
const CONFETTI_COLORS = [
  [0xd8443c, 0xf07a5a, 0xffd166, 0xf5f0e6, 0xb02f2f],
  [0x3560c8, 0x5b8ce8, 0x8fd6ff, 0xeaf1ff, 0x24407f],
];

const RAIN_COUNT = 1200;
const RAIN_TOP = 12;             // spawn ceiling
const RAIN_SPEED = 15.5;         // m/s downward
const RAIN_TILT = 0.13;          // radians of wind lean
const RAIN_HALF_X = 17;
const RAIN_HALF_Z = 27;

// Snow. Slower and smaller than rain, and it does not streak: a flake at
// 1.1 m/s covers 18 mm in a frame, so it reads as a dot that drifts, which is
// why these are little quads on a sway rather than scaled streaks.
const SNOW_COUNT = 900;
const SNOW_TOP = 13;
const SNOW_FALL = 1.1;           // m/s downward, before the wind
const SNOW_SWAY = 0.55;          // metres of side-to-side wander
const SNOW_SIZE = 0.055;

// Fog / light treatment applied by applyWeatherToScene().
const RAIN_FOG_COLOR = 0x060b18;
const RAIN_FOG_NEAR = 34;
const RAIN_FOG_FAR = 115;
const RAIN_HEMI_MUL = 0.55;
const RAIN_SUN_MUL = 0.5;

const ZERO_MATRIX = new THREE.Matrix4().set(
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
);

// Deterministic PRNG: bursts look random but replay identically in tests.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WEATHER_MODES = ['acik', 'yagmur', 'kar'];

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.weather = 'acik';
    this.time = 0;
    this.confettiActive = 0;
    // Allocation counters: the whole point of the pools is that these stop
    // growing after the first use, so the test can assert on them.
    this.allocations = { confetti: 0, rain: 0, sheen: 0, snow: 0 };
    this._rnd = mulberry32(0xc0ffee);
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._col = new THREE.Color();
    this._sceneBase = null;
    this.rain = null;
    this.snow = null;
    this.sheen = null;
    this.#buildConfetti();
  }

  // ---------------------------------------------------------------- confetti

  #buildConfetti() {
    const n = CONFETTI_MAX;
    this.c = {
      x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n),
      vx: new Float32Array(n), vy: new Float32Array(n), vz: new Float32Array(n),
      rx: new Float32Array(n), ry: new Float32Array(n), rz: new Float32Array(n),
      sx: new Float32Array(n), sy: new Float32Array(n), sz: new Float32Array(n),
      life: new Float32Array(n), size: new Float32Array(n),
      phase: new Float32Array(n), sway: new Float32Array(n),
      alive: new Uint8Array(n),
    };
    // A single double-sided quad: the flutter comes from the rotation, so the
    // geometry stays 2 triangles and the whole burst is one draw call.
    const geo = new THREE.PlaneGeometry(0.19, 0.12);
    const mat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide, toneMapped: false,
    });
    this.confetti = new THREE.InstancedMesh(geo, mat, n);
    this.confetti.frustumCulled = false; // pool spans the whole stadium
    this.confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.confetti.castShadow = false;
    this.confetti.receiveShadow = false;
    for (let i = 0; i < n; i++) {
      this.confetti.setMatrixAt(i, ZERO_MATRIX);
      this.confetti.setColorAt(i, this._col.setHex(0xffffff));
    }
    this.confetti.instanceMatrix.needsUpdate = true;
    if (this.confetti.instanceColor) this.confetti.instanceColor.needsUpdate = true;
    this.scene.add(this.confetti);
    this.allocations.confetti++;
  }

  // scorerTeam: 0 red / 1 blue. goalZsign: which end was scored in
  // (red attacks +z, blue attacks -z) — derived from the team when omitted.
  onGoal(scorerTeam, goalZsign) {
    const team = scorerTeam === 1 ? 1 : 0;
    const s = Math.sign(goalZsign) || (team === 0 ? 1 : -1);
    const palette = CONFETTI_COLORS[team];
    const rnd = this._rnd;
    const c = this.c;
    const halfX = STAND_INFO.endHalfX;

    for (let i = 0; i < CONFETTI_MAX; i++) {
      if (i >= CONFETTI_BURST) { // tail of the pool stays parked and hidden
        c.alive[i] = 0;
        this.confetti.setMatrixAt(i, ZERO_MATRIX);
        continue;
      }
      const tier = Math.min(STAND_INFO.tiers - 1, (rnd() * STAND_INFO.tiers) | 0);
      c.x[i] = (rnd() * 2 - 1) * halfX;
      c.y[i] = STAND_INFO.tierTop(tier) + 1.1 + rnd() * 1.9;
      c.z[i] = s * (STAND_INFO.endZ(tier) + (rnd() - 0.5) * STAND_INFO.tierDepth);
      // thrown up and out over the goal, never back into the seats
      c.vx[i] = (rnd() - 0.5) * 3.0;
      c.vy[i] = 1.8 + rnd() * 2.2;
      c.vz[i] = -s * (0.6 + rnd() * 2.4);
      c.rx[i] = rnd() * Math.PI * 2;
      c.ry[i] = rnd() * Math.PI * 2;
      c.rz[i] = rnd() * Math.PI * 2;
      c.sx[i] = (rnd() - 0.5) * 9;
      c.sy[i] = (rnd() - 0.5) * 7;
      c.sz[i] = (rnd() - 0.5) * 11;
      c.life[i] = CONFETTI_LIFE + rnd();
      c.size[i] = 0.8 + rnd() * 0.7;
      c.phase[i] = rnd() * Math.PI * 2;
      c.sway[i] = 1.3 + rnd() * 2.2;
      c.alive[i] = 1;
      this.confetti.setColorAt(i, this._col.setHex(palette[(rnd() * palette.length) | 0]));
    }
    this.confettiActive = CONFETTI_BURST;
    this.confetti.instanceMatrix.needsUpdate = true;
    if (this.confetti.instanceColor) this.confetti.instanceColor.needsUpdate = true;
  }

  #updateConfetti(dt) {
    const c = this.c;
    const m = this._m, p = this._p, q = this._q, e = this._e, s = this._s;
    let alive = 0;
    for (let i = 0; i < CONFETTI_MAX; i++) {
      if (!c.alive[i]) continue;
      c.life[i] -= dt;
      if (c.life[i] <= 0 || c.y[i] <= 0.03) {
        c.alive[i] = 0;
        this.confetti.setMatrixAt(i, ZERO_MATRIX);
        continue;
      }
      // flutter: a sideways push that reverses a couple of times a second,
      // which is what makes paper drift instead of dropping like a stone
      const flutter = Math.sin(this.time * c.sway[i] + c.phase[i]);
      c.vx[i] += flutter * 1.7 * dt;
      c.vz[i] += Math.cos(this.time * c.sway[i] * 0.8 + c.phase[i]) * 1.2 * dt;
      c.vy[i] -= CONFETTI_G * dt;
      // terminal velocity, so a long-lived piece still lands softly
      if (c.vy[i] < -1.9) c.vy[i] = -1.9;
      const drag = Math.max(0, 1 - CONFETTI_DRAG * dt);
      c.vx[i] *= drag; c.vz[i] *= drag;
      c.x[i] += c.vx[i] * dt;
      c.y[i] += c.vy[i] * dt;
      c.z[i] += c.vz[i] * dt;
      c.rx[i] += c.sx[i] * dt;
      c.ry[i] += c.sy[i] * dt;
      c.rz[i] += c.sz[i] * dt;

      // fade the last half second by shrinking: cheaper than a per-instance
      // alpha (which a shared material cannot express without a custom shader)
      const fade = Math.min(1, c.life[i] / 0.5);
      const sc = c.size[i] * fade;
      p.set(c.x[i], c.y[i], c.z[i]);
      e.set(c.rx[i], c.ry[i], c.rz[i]);
      q.setFromEuler(e);
      s.set(sc, sc, sc);
      m.compose(p, q, s);
      this.confetti.setMatrixAt(i, m);
      alive++;
    }
    this.confettiActive = alive;
    this.confetti.instanceMatrix.needsUpdate = true;
  }

  // -------------------------------------------------------------------- rain

  #buildRain() {
    if (this.rain) return;
    const n = RAIN_COUNT;
    const rnd = this._rnd;
    this.r = {
      x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n),
      len: new Float32Array(n), speed: new Float32Array(n),
    };
    for (let i = 0; i < n; i++) this.#seedDrop(i, rnd() * RAIN_TOP);

    const geo = new THREE.PlaneGeometry(0.022, 0.85);
    geo.translate(0, -0.425, 0); // pivot at the top of the streak
    const mat = new THREE.MeshBasicMaterial({
      color: 0xb9cff0, transparent: true, opacity: 0.34,
      depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    });
    this.rain = new THREE.InstancedMesh(geo, mat, n);
    this.rain.frustumCulled = false;
    this.rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rain.castShadow = false;
    this.rain.receiveShadow = false;
    this.rain.renderOrder = 2;
    // Streaks share one orientation, rebuilt once a frame from the wind — it
    // used to be a hardcoded lean with a hardcoded +x drift, which meant the
    // rain fell one way while the net beside it blew another.
    this._rainBase = new THREE.Matrix4().makeRotationZ(RAIN_TILT);
    this._rainEuler = new THREE.Euler();
    this.#writeRain();
    this.scene.add(this.rain);
    this.allocations.rain++;
  }

  #seedDrop(i, y) {
    const rnd = this._rnd;
    const r = this.r;
    r.x[i] = (rnd() * 2 - 1) * RAIN_HALF_X;
    r.z[i] = (rnd() * 2 - 1) * RAIN_HALF_Z;
    r.y[i] = y;
    r.len[i] = 0.75 + rnd() * 0.8;
    r.speed[i] = RAIN_SPEED * (0.85 + rnd() * 0.35);
  }

  /** Lean the whole column into the wind, once per frame. */
  #rainOrientation() {
    const w = windAt(this.time);
    // A streak falling at RAIN_SPEED through air moving sideways at w leans by
    // atan(w / fall). Both axes, so a wind across the pitch tilts it out of the
    // camera plane rather than only along x.
    this._rainEuler.set(Math.atan2(w.z, RAIN_SPEED), 0, -Math.atan2(w.x, RAIN_SPEED));
    this._rainBase.makeRotationFromEuler(this._rainEuler);
    return w;
  }

  #writeRain() {
    const r = this.r;
    const b = this._rainBase.elements;
    const m = this._m.copy(this._rainBase);
    for (let i = 0; i < RAIN_COUNT; i++) {
      // Scale the local Y axis (column 1) by the streak length. Writing the
      // column rather than two fixed entries is what lets the base matrix be a
      // full rotation instead of a Z-only one.
      m.elements[4] = b[4] * r.len[i];
      m.elements[5] = b[5] * r.len[i];
      m.elements[6] = b[6] * r.len[i];
      m.elements[12] = r.x[i];
      m.elements[13] = r.y[i];
      m.elements[14] = r.z[i];
      this.rain.setMatrixAt(i, m);
    }
    this.rain.instanceMatrix.needsUpdate = true;
  }

  #updateRain(dt) {
    const r = this.r;
    const w = this.#rainOrientation();
    const dx = w.x * dt;
    const dz = w.z * dt;
    for (let i = 0; i < RAIN_COUNT; i++) {
      r.y[i] -= r.speed[i] * dt;
      r.x[i] += dx;
      r.z[i] += dz;
      if (r.y[i] < 0) this.#seedDrop(i, RAIN_TOP + this._rnd() * 2);
      else {
        // wrap rather than reseed: a drop crossing the column edge is the same
        // drop, and reseeding it would thin the near edge in a steady wind
        if (r.x[i] > RAIN_HALF_X) r.x[i] -= RAIN_HALF_X * 2;
        else if (r.x[i] < -RAIN_HALF_X) r.x[i] += RAIN_HALF_X * 2;
        if (r.z[i] > RAIN_HALF_Z) r.z[i] -= RAIN_HALF_Z * 2;
        else if (r.z[i] < -RAIN_HALF_Z) r.z[i] += RAIN_HALF_Z * 2;
      }
    }
    this.#writeRain();
  }


  // -------------------------------------------------------------------- snow

  #buildSnow() {
    if (this.snow) return;
    const n = SNOW_COUNT;
    const rnd = this._rnd;
    this.s = {
      x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n),
      // where the flake would be with no sway, so the wander never accumulates
      baseX: new Float32Array(n), baseZ: new Float32Array(n),
      phase: new Float32Array(n), rate: new Float32Array(n),
      speed: new Float32Array(n), size: new Float32Array(n),
    };
    for (let i = 0; i < n; i++) this.#seedFlake(i, rnd() * SNOW_TOP);

    const geo = new THREE.PlaneGeometry(SNOW_SIZE, SNOW_SIZE);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf4f8ff, transparent: true, opacity: 0.9,
      depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    });
    this.snow = new THREE.InstancedMesh(geo, mat, n);
    this.snow.frustumCulled = false;
    this.snow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.snow.castShadow = false;
    this.snow.receiveShadow = false;
    this.snow.renderOrder = 2;
    this.#writeSnow();
    this.scene.add(this.snow);
    this.allocations.snow++;
  }

  #seedFlake(i, y) {
    const rnd = this._rnd;
    const f = this.s;
    f.baseX[i] = (rnd() * 2 - 1) * RAIN_HALF_X;
    f.baseZ[i] = (rnd() * 2 - 1) * RAIN_HALF_Z;
    f.x[i] = f.baseX[i];
    f.z[i] = f.baseZ[i];
    f.y[i] = y;
    f.phase[i] = rnd() * Math.PI * 2;
    f.rate[i] = 0.6 + rnd() * 1.1;       // its own wander frequency
    f.speed[i] = SNOW_FALL * (0.7 + rnd() * 0.6);
    f.size[i] = 0.7 + rnd() * 0.8;
  }

  #writeSnow() {
    const f = this.s;
    const m = this._m;
    for (let i = 0; i < SNOW_COUNT; i++) {
      m.identity();
      const k = f.size[i];
      m.elements[0] = k; m.elements[5] = k; m.elements[10] = k;
      m.elements[12] = f.x[i];
      m.elements[13] = f.y[i];
      m.elements[14] = f.z[i];
      this.snow.setMatrixAt(i, m);
    }
    this.snow.instanceMatrix.needsUpdate = true;
  }

  #updateSnow(dt) {
    const f = this.s;
    const w = windAt(this.time);
    for (let i = 0; i < SNOW_COUNT; i++) {
      f.y[i] -= f.speed[i] * dt;
      f.baseX[i] += w.x * dt;
      f.baseZ[i] += w.z * dt;
      if (f.y[i] < 0) {
        this.#seedFlake(i, SNOW_TOP + this._rnd() * 2);
        continue;
      }
      if (f.baseX[i] > RAIN_HALF_X) f.baseX[i] -= RAIN_HALF_X * 2;
      else if (f.baseX[i] < -RAIN_HALF_X) f.baseX[i] += RAIN_HALF_X * 2;
      if (f.baseZ[i] > RAIN_HALF_Z) f.baseZ[i] -= RAIN_HALF_Z * 2;
      else if (f.baseZ[i] < -RAIN_HALF_Z) f.baseZ[i] += RAIN_HALF_Z * 2;
      // The sway is a displacement from the drifting base, not an integration,
      // so a flake wanders around its path instead of walking off it.
      const t = this.time * f.rate[i] + f.phase[i];
      f.x[i] = f.baseX[i] + Math.sin(t) * SNOW_SWAY;
      f.z[i] = f.baseZ[i] + Math.cos(t * 0.7) * SNOW_SWAY * 0.6;
    }
    this.#writeSnow();
  }

  #buildSheen() {
    if (this.sheen) return;
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.085,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    // A soft radial gradient reads as a wet gloss under the floodlights. The
    // canvas is skipped headlessly (node has no DOM); the flat overlay still
    // works, it is just uniform.
    if (typeof document !== 'undefined' && document.createElement) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const g = cv.getContext('2d');
      const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      mat.map = tex;
    }
    this.sheen = new THREE.Mesh(new THREE.PlaneGeometry(30, 48), mat);
    this.sheen.rotation.x = -Math.PI / 2;
    this.sheen.position.y = 0.014;
    this.sheen.renderOrder = 1;
    this.scene.add(this.sheen);
    this.allocations.sheen++;
  }

  // ----------------------------------------------------------------- weather

  setWeather(mode) {
    const next = WEATHER_MODES.includes(mode) ? mode : 'acik';
    this.weather = next;
    if (next === 'yagmur') {
      this.#buildRain();
      this.#buildSheen();
    } else if (next === 'kar') {
      this.#buildSnow();
    }
    // Meshes are never torn down: clear weather just stops drawing them.
    if (this.rain) this.rain.visible = next === 'yagmur';
    if (this.sheen) this.sheen.visible = next === 'yagmur';
    if (this.snow) this.snow.visible = next === 'kar';
    this.applyWeatherToScene(this.scene);
    return this.weather;
  }

  // Darkens the sky, tightens the fog and dims the lights while it rains.
  // Separate from setWeather so a rebuilt scene can be re-tinted on demand.
  applyWeatherToScene(scene = this.scene) {
    if (!scene || typeof scene.traverse !== 'function') return false;
    if (!this._sceneBase || this._sceneBase.scene !== scene) {
      const lights = [];
      scene.traverse((o) => {
        if (o.isHemisphereLight || o.isDirectionalLight) {
          lights.push({ light: o, intensity: o.intensity });
        }
      });
      this._sceneBase = {
        scene, lights,
        fog: scene.fog
          ? { color: scene.fog.color.getHex(), near: scene.fog.near, far: scene.fog.far }
          : null,
        background: scene.background?.isColor ? scene.background.getHex() : null,
      };
    }
    const base = this._sceneBase;
    const wet = this.weather === 'yagmur';
    for (const { light, intensity } of base.lights) {
      light.intensity = intensity * (wet ? (light.isHemisphereLight ? RAIN_HEMI_MUL : RAIN_SUN_MUL) : 1);
    }
    if (scene.fog && base.fog) {
      scene.fog.color.setHex(wet ? RAIN_FOG_COLOR : base.fog.color);
      scene.fog.near = wet ? RAIN_FOG_NEAR : base.fog.near;
      scene.fog.far = wet ? RAIN_FOG_FAR : base.fog.far;
    }
    if (scene.background?.isColor && base.background !== null) {
      scene.background.setHex(wet ? RAIN_FOG_COLOR : base.background);
    }
    return true;
  }

  // ------------------------------------------------------------------ frame

  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const d = Math.min(dt, 0.05);
    this.time += d;
    if (this.confettiActive > 0) this.#updateConfetti(d);
    if (this.weather === 'yagmur' && this.rain) this.#updateRain(d);
    else if (this.weather === 'kar' && this.snow) this.#updateSnow(d);
  }

  dispose() {
    for (const mesh of [this.confetti, this.rain, this.sheen, this.snow]) {
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.map?.dispose();
      mesh.material.dispose();
    }
    this.confetti = this.rain = this.sheen = null;
    this.confettiActive = 0;
  }
}
