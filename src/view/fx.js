import * as THREE from 'three';
import { STAND_INFO } from './crowdView.js';

// Atmosphere effects layer: goal confetti and rain. Both are pooled
// InstancedMeshes allocated once and recycled forever — update() only ever
// rewrites matrices of live particles, and nothing is created or destroyed
// while the match runs.
//
//   const fx = new Fx(scene);
//   fx.setWeather('yagmur');        // 'acik' | 'yagmur'
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

export const WEATHER_MODES = ['acik', 'yagmur'];

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.weather = 'acik';
    this.time = 0;
    this.confettiActive = 0;
    // Allocation counters: the whole point of the pools is that these stop
    // growing after the first use, so the test can assert on them.
    this.allocations = { confetti: 0, rain: 0, sheen: 0 };
    this._rnd = mulberry32(0xc0ffee);
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._col = new THREE.Color();
    this._sceneBase = null;
    this.rain = null;
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
    // Streaks share one orientation (wind lean), so the per-frame work is a
    // straight position write into a prepared matrix instead of a compose().
    this._rainBase = new THREE.Matrix4().makeRotationZ(RAIN_TILT);
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

  #writeRain() {
    const r = this.r;
    const m = this._m.copy(this._rainBase);
    for (let i = 0; i < RAIN_COUNT; i++) {
      // scale the streak along y in place, then drop the translation in
      m.elements[4] = -Math.sin(RAIN_TILT) * r.len[i];
      m.elements[5] = Math.cos(RAIN_TILT) * r.len[i];
      m.elements[12] = r.x[i];
      m.elements[13] = r.y[i];
      m.elements[14] = r.z[i];
      this.rain.setMatrixAt(i, m);
    }
    this.rain.instanceMatrix.needsUpdate = true;
  }

  #updateRain(dt) {
    const r = this.r;
    const drift = 2.1 * dt; // wind pushes the column along +x as it falls
    for (let i = 0; i < RAIN_COUNT; i++) {
      r.y[i] -= r.speed[i] * dt;
      r.x[i] += drift;
      if (r.y[i] < 0) this.#seedDrop(i, RAIN_TOP + this._rnd() * 2);
      else if (r.x[i] > RAIN_HALF_X) r.x[i] -= RAIN_HALF_X * 2;
    }
    this.#writeRain();
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
    }
    // Meshes are never torn down: clear weather just stops drawing them.
    if (this.rain) this.rain.visible = next === 'yagmur';
    if (this.sheen) this.sheen.visible = next === 'yagmur';
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
  }

  dispose() {
    for (const mesh of [this.confetti, this.rain, this.sheen]) {
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
