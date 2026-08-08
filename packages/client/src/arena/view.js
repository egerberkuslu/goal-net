// Rendering for the deterministic arena.
//
// Nothing here simulates. `update()` takes a plain render state — either
// readState(world) on the host or client.sample(now) on a guest — and moves
// meshes. The view layer itself is the one the game already ships:
//
//   view/scene.js       renderer, lights, stands, pitch texture, goal frames
//   view/playerView.js  the procedural character (walk, kick swing, dive pose)
//   view/ballView.js    the ball and its rolling spin
//   view/cameraRig.js   broadcast / diagonal / player cameras and the input basis
//
// None of those are forked. They are driven through small adapter objects that
// present a core player and a core ball in the shape those classes already
// expect (`pos`, `facing`, `dive`, `charge`, ...), which is why the arena gets
// dives, slide poses and charge rings without a line of new animation code.
//
// Everything is placed through units.js, so the only number that ties the core's
// 400 x 840 rectangle to metres lives there and nowhere else.

import * as THREE from 'three';
import { createScene, buildGoalFrames } from '../view/scene.js';
import { PlayerView } from '../view/playerView.js';
import { BallView } from '../view/ballView.js';
import { CameraRig } from '../view/cameraRig.js';
import { CONSTANTS } from '../../../core/src/index.js';
import { GOAL_HEIGHT_M, PITCH_M, TICK_HZ, toMetres } from './units.js';

const DIVE_TOTAL_S = CONSTANTS.DIVE_ACTIVE_TICKS / TICK_HZ;
const TACKLE_TOTAL_S = CONSTANTS.TACKLE_ACTIVE_TICKS / TICK_HZ;
const CHARGE_MAX = CONSTANTS.CHARGE_MAX_TICKS;
/** PlayerView draws a body of roughly this radius; scale it onto the real disc. */
const VIEW_BODY_RADIUS_M = 0.35;
const BALL_VIEW_RADIUS_M = 0.15;

const DIVE_VECTORS = [
  { x: -1, z: 0 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: 0, z: 1 },
];

/**
 * One core player, dressed up as the object PlayerView wants. It holds the
 * animation-only state the core has no opinion about (facing, kick swing,
 * celebration) and derives everything else from the authoritative fields.
 */
class PlayerAdapter {
  constructor(slot) {
    this.team = slot.team;
    this.role = slot.role;
    this.mpName = slot.name || '';
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, z: 0 };
    this.facing = slot.team === 0 ? 0 : Math.PI;
    this.speedMs = 0;
    // fields PlayerView reads that the 2D core simply does not have
    this.down = 0;
    this.downTotal = 1;
    this.tumbleSpin = 0;
    this.jumpY = 0;
    this.headerAnim = 0;
    this.celebrate = 0;
    this.celebrateLeft = 0;
    this.kickAnim = 0;
    this.charge = 0;
    this.dive = 0;
    this.diveTotal = DIVE_TOTAL_S;
    this.diveRecover = 0;
    this.diveDir = { x: 0, z: 1 };
    this.diveKind = 'keeper';
  }

  speed() { return this.speedMs; }

  /** @param {object} p one entry of readState().players, or a sampled stand-in */
  apply(p, dt) {
    const x = toMetres(p.x);
    const z = toMetres(p.z);
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    this.pos.x = x;
    this.pos.z = z;
    const moved = Math.hypot(dx, dz);
    this.speedMs = dt > 0 ? moved / dt : 0;
    if (moved > 1e-4) {
      const want = Math.atan2(dx, dz);
      this.facing = angleTowards(this.facing, want, Math.min(1, dt * 12));
    }

    // Optional fields: a guest's interpolated sample carries positions only, so
    // everything below degrades to "no pose" rather than to NaN.
    const charge = p.charge || 0;
    this.charge = Math.min(1, charge / CHARGE_MAX);
    if (p.tackleActive > 0) {
      this.diveKind = 'slide';
      this.dive = p.tackleActive / TICK_HZ;
      this.diveTotal = TACKLE_TOTAL_S;
      this.diveRecover = 0;
      this.diveDir = unit(dx, dz, this.diveDir);
    } else if (p.diveActive > 0) {
      this.diveKind = 'keeper';
      this.dive = p.diveActive / TICK_HZ;
      this.diveTotal = DIVE_TOTAL_S;
      this.diveRecover = 0;
      this.diveDir = DIVE_VECTORS[p.diveDir | 0] || DIVE_VECTORS[3];
    } else {
      this.dive = 0;
      const recoverTicks = Math.max(p.diveLock || 0, p.tackleRecovery || 0);
      this.diveRecover = recoverTicks > 0 ? Math.min(0.45, recoverTicks / TICK_HZ) : 0;
    }
    if (this.kickAnim > 0) this.kickAnim = Math.max(0, this.kickAnim - dt * 3.5);
    if (this.celebrate !== 0) {
      this.celebrateLeft -= dt;
      if (this.celebrateLeft <= 0) this.celebrate = 0;
    }
  }

  strike() { this.kickAnim = 1; }

  setCelebrate(kind, seconds) {
    this.celebrate = kind;
    this.celebrateLeft = seconds;
  }
}

function unit(x, z, fallback) {
  const len = Math.hypot(x, z);
  return len > 1e-6 ? { x: x / len, z: z / len } : fallback;
}

/** Shortest-way angular approach, so facing never spins the long way round. */
function angleTowards(from, to, k) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * k;
}

/** The ball, in the shape BallView wants. The core is 2D, so it always rolls. */
class BallAdapter {
  constructor() {
    this.pos = { x: 0, y: PITCH_M.ballR, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.omega = { x: 0, y: 0, z: 0 };
    this.grounded = true;
  }

  apply(b) {
    this.pos.x = toMetres(b.x);
    this.pos.z = toMetres(b.z);
    this.pos.y = PITCH_M.ballR;
    this.vel.x = toMetres(b.vx || 0) * TICK_HZ;
    this.vel.z = toMetres(b.vz || 0) * TICK_HZ;
  }
}

/**
 * The true playing area, drawn from the core's own numbers.
 *
 * The pitch texture underneath belongs to the shipping renderer and draws a
 * 36 x 22 m field; the core's rectangle is 36 x 17.14 m. Rather than fork the
 * texture, the real walls, the real goal mouth and the real penalty areas are
 * struck on top in bright white, so what the player sees as the boundary is the
 * boundary the simulation enforces.
 */
function buildPitchOverlay(scene) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false,
  });
  const W = 0.12; // line width in metres
  const Y = 0.02;

  const line = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 1e-6) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, W), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
    m.position.set((x1 + x2) / 2, Y, (z1 + z2) / 2);
    group.add(m);
  };

  const { halfX, halfZ, goalHalfX, penaltyHalfX, penaltyDepth } = PITCH_M;
  // touchlines (the side walls the core bounces off)
  line(-halfX, -halfZ, -halfX, halfZ);
  line(halfX, -halfZ, halfX, halfZ);
  // goal lines, split around the mouth so the opening is visible
  for (const s of [-1, 1]) {
    line(-halfX, s * halfZ, -goalHalfX, s * halfZ);
    line(goalHalfX, s * halfZ, halfX, s * halfZ);
    // penalty area
    line(-penaltyHalfX, s * halfZ, -penaltyHalfX, s * (halfZ - penaltyDepth));
    line(penaltyHalfX, s * halfZ, penaltyHalfX, s * (halfZ - penaltyDepth));
    line(-penaltyHalfX, s * (halfZ - penaltyDepth), penaltyHalfX, s * (halfZ - penaltyDepth));
  }
  // halfway line and centre circle
  line(-halfX, 0, halfX, 0);
  const circle = new THREE.Mesh(
    new THREE.RingGeometry(halfX * 0.28 - W / 2, halfX * 0.28 + W / 2, 64),
    mat,
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = Y;
  group.add(circle);

  scene.add(group);
  return {
    group,
    dispose() {
      scene.remove(group);
      group.traverse((o) => o.geometry && o.geometry.dispose());
      mat.dispose();
    },
  };
}

/** The whole visual side of one match. */
export class ArenaView {
  /**
   * @param {HTMLElement} container mount point for the canvas
   * @param {{slots:object[], teamColors?:number[]}} match
   */
  constructor(container, match) {
    const { renderer, scene, camera } = createScene(container);
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.rig = new CameraRig(camera);

    this.goalFrames = buildGoalFrames(scene, {
      goalW: PITCH_M.goalHalfX * 2,
      goalH: GOAL_HEIGHT_M,
    });
    this.overlay = buildPitchOverlay(scene);

    this.ball = new BallAdapter();
    this.ballView = new BallView(this.ball, scene);
    this.ballView.mesh.scale.setScalar(PITCH_M.ballR / BALL_VIEW_RADIUS_M);

    const bodyScale = PITCH_M.playerR / VIEW_BODY_RADIUS_M;
    this.players = match.slots.map((slot) => {
      const adapter = new PlayerAdapter(slot);
      const view = new PlayerView(adapter, scene, match.teamColors || null);
      view.group.scale.setScalar(bodyScale);
      return { adapter, view, slot };
    });
    this.bodyScale = bodyScale;
    this.state = 'kickoff';
  }

  /** Mark a strike so the kick swing plays; called from core events. */
  onStrike(index) {
    this.players[index]?.adapter.strike();
  }

  /** Goal reaction: the scoring side bounces, the conceding side slumps. */
  onGoal(team, seconds = 2.4) {
    for (const p of this.players) {
      p.adapter.setCelebrate(p.slot.team === team ? 1 : -1, seconds);
    }
  }

  /**
   * @param {{players:object[], ball:object}} state a readState() or a sample()
   * @param {number} dt seconds since the previous render
   * @param {{state?:string, me?:number}} ctx match flow, for the camera
   */
  update(state, dt, ctx = {}) {
    this.ball.apply(state.ball);
    for (let i = 0; i < this.players.length; i++) {
      const p = state.players[i];
      if (!p) continue;
      this.players[i].adapter.apply(p, dt);
    }
    this.ballView.update(dt);
    for (const p of this.players) {
      p.view.update(dt);
      // the name tag is positioned in metres by PlayerView; lift it clear of a
      // body that has been scaled up onto its real collision radius
      if (p.view.tag) p.view.tag.position.y = 2.06 * this.bodyScale;
    }
    const me = ctx.me != null ? this.players[ctx.me]?.adapter : null;
    this.rig.update(dt, { ball: this.ball.pos, state: ctx.state || 'play', me: me || null });
    this.renderer.render(this.scene, this.camera);
  }

  cycleCamera() { return this.rig.cycle(); }

  dispose() {
    this.goalFrames.dispose();
    this.overlay.dispose();
    this.ballView.dispose();
    for (const p of this.players) p.view.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
