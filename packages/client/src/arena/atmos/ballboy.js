// Matrix #22 — ball-boy scenes.
//
// The rule the row exists for: when the ball leaves play a ball-boy sequence
// plays, and the core restarts after T seconds regardless. This layer owns the
// SCENE and nothing else. It never advances a tick, never touches a world, and
// the T it runs against is the restart window the arena already has — the
// `flow === 'goal'` interval in arena/match.js. Every phase boundary is a
// fraction of that window, so however long the arena decides a restart takes,
// the boy is back on the touchline exactly as play resumes. If the atmosphere
// layer were deleted the match would keep exactly the same timing.
//
// The deterministic core is a walled 2D rectangle, so the only dead ball it
// produces is a goal (the ball is reset to the centre spot on the scoring
// tick). `onDeadBall` therefore takes a `kind`, and the goal case is the one
// wired up; throw-ins and corners are accepted for the day the ruleset grows
// them and cost nothing until then.

import * as THREE from 'three';
import { buildSpectatorMesh } from './vat.js';
import { resolveTier } from './quality.js';

export const PHASE = Object.freeze({
  IDLE: 'idle',
  FETCH: 'fetch',
  PICKUP: 'pickup',
  DELIVER: 'deliver',
  PLACE: 'place',
  RETURN: 'return',
});

// Phase boundaries as fractions of the restart window.
const T_FETCH = 0.34;
const T_PICKUP = 0.44;
const T_DELIVER = 0.78;
const T_PLACE = 0.86;

const BOY_SCALE = 1.45;
const RUN_BOB = 0.06;

/**
 * The whole sequence as one pure function of progress. Returned `carrying` is
 * what tells the caller to move the cosmetic ball with the boy.
 *
 * @param {number} p progress through the restart window, 0..1
 * @param {{x:number,z:number}} home where the boy stands between jobs
 * @param {{x:number,z:number}} ball where the dead ball came to rest
 * @param {{x:number,z:number}} spot where play restarts from
 * @returns {{phase:string, x:number, z:number, carrying:boolean,
 *            crouch:number, run:number}}
 */
export function ballBoyPose(p, home, ball, spot) {
  const t = p < 0 ? 0 : (p > 1 ? 1 : p);
  if (t < T_FETCH) {
    const k = ease(t / T_FETCH);
    return {
      phase: PHASE.FETCH,
      x: lerp(home.x, ball.x, k),
      z: lerp(home.z, ball.z, k),
      carrying: false,
      crouch: 0,
      run: 1,
    };
  }
  if (t < T_PICKUP) {
    const k = (t - T_FETCH) / (T_PICKUP - T_FETCH);
    return {
      phase: PHASE.PICKUP,
      x: ball.x,
      z: ball.z,
      carrying: k > 0.5,
      crouch: Math.sin(k * Math.PI),
      run: 0,
    };
  }
  if (t < T_DELIVER) {
    const k = ease((t - T_PICKUP) / (T_DELIVER - T_PICKUP));
    return {
      phase: PHASE.DELIVER,
      x: lerp(ball.x, spot.x, k),
      z: lerp(ball.z, spot.z, k),
      carrying: true,
      crouch: 0,
      run: 1,
    };
  }
  if (t < T_PLACE) {
    const k = (t - T_DELIVER) / (T_PLACE - T_DELIVER);
    return {
      phase: PHASE.PLACE,
      x: spot.x,
      z: spot.z,
      carrying: k < 0.5,
      crouch: Math.sin(k * Math.PI),
      run: 0,
    };
  }
  const k = ease((t - T_PLACE) / (1 - T_PLACE));
  return {
    phase: PHASE.RETURN,
    x: lerp(spot.x, home.x, k),
    z: lerp(spot.z, home.z, k),
    carrying: false,
    crouch: 0,
    run: 1,
  };
}

const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

export class BallBoys {
  /**
   * @param {THREE.Scene|{add:Function, remove?:Function}} scene
   * @param {{halfX:number, halfZ:number, tier?:string|object,
   *          color?:number}} opts
   */
  constructor(scene, opts) {
    const tier = resolveTier(opts.tier);
    this.tier = tier;
    this.scene = scene;
    this.count = tier.ballBoys;

    const homes = [];
    for (const sx of [1, -1]) {
      for (const sz of [-1, 1]) {
        homes.push({ x: sx * (opts.halfX + 1.7), z: sz * (opts.halfZ - 3.2) });
      }
    }
    this.homes = homes.slice(0, this.count);

    // The spectator mesh is reused rather than authored twice: same 24
    // triangles, standing up and scaled, which keeps this to one draw call.
    const mesh = buildSpectatorMesh();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions.slice(), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(mesh.normals.slice(), 3));
    this.geometry = geo;
    this.triangles = mesh.triangleCount * this.count;

    this.material = new THREE.MeshLambertMaterial({
      color: opts.color ?? 0xe9a13b, side: THREE.DoubleSide,
    });
    this.instanced = new THREE.InstancedMesh(geo, this.material, this.count);
    this.instanced.name = 'atmos.ballboys';
    this.instanced.frustumCulled = false;
    this.instanced.castShadow = false;

    this.group = new THREE.Group();
    this.group.name = 'atmos.ballboyScene';
    this.group.add(this.instanced);
    scene.add(this.group);

    this.state = this.homes.map((h) => ({
      x: h.x, z: h.z, home: h, facing: h.x > 0 ? -Math.PI / 2 : Math.PI / 2,
      bob: Math.random() * Math.PI * 2,
    }));

    this.active = -1;
    this.progress = 0;
    this.window = 0;
    this.phase = PHASE.IDLE;
    this.ballAt = { x: 0, z: 0 };
    this.spot = { x: 0, z: 0 };
    this.scenes = 0;
    this.clock = 0;

    this._m4 = new THREE.Matrix4();
    this._pos = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._axis = new THREE.Vector3(0, 1, 0);
    this._scl = new THREE.Vector3(BOY_SCALE, BOY_SCALE, BOY_SCALE);
    this.sync();
  }

  /**
   * Start a scene. Purely a request to animate: it neither knows nor can
   * change when the core restarts.
   *
   * @param {{kind?:string, x:number, z:number, spotX?:number, spotZ?:number,
   *          seconds:number}} info the dead ball, in metres
   */
  onDeadBall(info) {
    const seconds = Number.isFinite(info.seconds) ? info.seconds : 2.4;
    if (seconds <= 0 || this.count === 0) return false;
    this.ballAt = { x: info.x, z: info.z };
    this.spot = { x: info.spotX ?? 0, z: info.spotZ ?? 0 };
    this.kind = info.kind || 'goal';
    // whoever is standing closest to the dead ball goes
    let best = 0, bestD = Infinity;
    for (let i = 0; i < this.state.length; i++) {
      const d = (this.state[i].home.x - this.ballAt.x) ** 2
        + (this.state[i].home.z - this.ballAt.z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    this.active = best;
    this.window = seconds;
    this.progress = 0;
    this.phase = PHASE.FETCH;
    this.scenes++;
    return true;
  }

  /** Abort the scene and send everyone home; used when a match ends. */
  cancel() {
    this.active = -1;
    this.progress = 0;
    this.phase = PHASE.IDLE;
  }

  /**
   * @param {number} dt seconds
   * @param {{x:number,y:number,z:number,held:boolean,active:boolean}|null} [ball]
   *   the cosmetic ball from net.js; carried while the boy has it. This object
   *   belongs to the atmosphere layer, never to the core.
   */
  update(dt, ball = null) {
    const step = Math.max(0, Math.min(0.25, Number.isFinite(dt) ? dt : 0));
    this.clock += step;

    if (this.active >= 0) {
      this.progress += this.window > 0 ? step / this.window : 1;
      const boy = this.state[this.active];
      const pose = ballBoyPose(this.progress, boy.home, this.ballAt, this.spot);
      this.phase = pose.phase;
      const dx = pose.x - boy.x, dz = pose.z - boy.z;
      if (Math.hypot(dx, dz) > 1e-4) boy.facing = Math.atan2(dx, dz);
      boy.x = pose.x; boy.z = pose.z;
      boy.crouch = pose.crouch;
      boy.run = pose.run;
      if (ball && ball.active) {
        ball.held = pose.carrying;
        if (pose.carrying) {
          ball.x = pose.x;
          ball.z = pose.z;
          ball.y = 1.05;
          ball.vx = 0; ball.vy = 0; ball.vz = 0;
        } else if (this.phase === PHASE.PLACE || this.phase === PHASE.RETURN) {
          ball.x = this.spot.x;
          ball.z = this.spot.z;
          ball.y = ball.radius;
        }
      }
      if (this.progress >= 1) {
        boy.x = boy.home.x; boy.z = boy.home.z;
        boy.crouch = 0; boy.run = 0;
        this.active = -1;
        this.phase = PHASE.IDLE;
        this.progress = 0;
      }
    }

    for (let i = 0; i < this.state.length; i++) {
      const s = this.state[i];
      s.bob += step * (s.run ? 11 : 1.6);
    }
    this.sync();
  }

  sync() {
    for (let i = 0; i < this.state.length; i++) {
      const s = this.state[i];
      const bob = (s.run ? RUN_BOB : 0.012) * Math.abs(Math.sin(s.bob));
      const y = bob - (s.crouch || 0) * 0.42;
      this._pos.set(s.x, y, s.z);
      this._quat.setFromAxisAngle(this._axis, s.facing);
      this._m4.compose(this._pos, this._quat, this._scl);
      this.instanced.setMatrixAt(i, this._m4);
    }
    this.instanced.instanceMatrix.needsUpdate = true;
  }

  stats() {
    return {
      boys: this.count,
      drawCalls: 1,
      triangles: this.triangles,
      phase: this.phase,
      progress: this.progress,
      scenes: this.scenes,
      active: this.active,
    };
  }

  dispose() {
    this.scene.remove?.(this.group);
    this.geometry.dispose();
    this.material.dispose();
    this.instanced.dispose?.();
  }
}
