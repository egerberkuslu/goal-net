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
import { Atmosphere } from './atmos/index.js';

const DIVE_TOTAL_S = CONSTANTS.DIVE_ACTIVE_TICKS / TICK_HZ;
const TACKLE_TOTAL_S = CONSTANTS.TACKLE_ACTIVE_TICKS / TICK_HZ;
const CHARGE_MAX = CONSTANTS.CHARGE_MAX_TICKS;
/**
 * Drawing sizes, in metres. These are cosmetic and deliberately NOT the core's
 * collision radii.
 *
 * The core is a Haxball-style disc game: its player disc is 0.64 m and its ball
 * disc 0.43 m in radius, so drawing bodies at their true collision size gives
 * 2.5 m giants shoving a 0.86 m beach ball. The discs stay exactly that big in
 * the simulation — they are locked physics constants — but a player and a ball
 * are drawn at the shipping game's proportions instead, which is the look this
 * project has always had. The gap between the drawn ball and the drawn boot on
 * contact is the price, and it is the same trade the shipping game makes at
 * 0.35 m collision against a 0.26 m capsule.
 */
const VIEW_BODY_RADIUS_M = 0.35;
const BALL_VIEW_RADIUS_M = 0.15;
const BODY_DRAW_SCALE = 1;

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

/**
 * A shirt number for a slot the lobby did not give one to: 1 for the keeper,
 * then 2 upwards in slot order within the team. Cosmetic, so it needs to be
 * stable and readable rather than authoritative.
 */
function shirtNumber(slots, index) {
  const me = slots[index];
  if (!me) return 0;
  if (me.role === 'keeper') return 1;
  let n = 2;
  for (let i = 0; i < index; i++) {
    if (slots[i].team === me.team && slots[i].role !== 'keeper') n++;
  }
  return Math.min(99, n);
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
    this.pos = { x: 0, y: BALL_VIEW_RADIUS_M, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.omega = { x: 0, y: 0, z: 0 };
    this.grounded = true;
  }

  apply(b) {
    this.pos.x = toMetres(b.x);
    this.pos.z = toMetres(b.z);
    this.pos.y = BALL_VIEW_RADIUS_M;
    this.vel.x = toMetres(b.vx || 0) * TICK_HZ;
    this.vel.z = toMetres(b.vz || 0) * TICK_HZ;
  }
}

/**
 * The playing area handed to the shipping stadium builder, in metres.
 *
 * The core's rectangle is 36 x 17.14 m, narrower than the 36 x 22 m the
 * shipping game plays on. Rather than paint corrective lines over a texture
 * drawn for the wrong pitch, the stadium is built from these numbers, so the
 * white line the player sees IS the wall the simulation bounces off. The
 * markings the core has no opinion about (goal area, penalty spot, arcs) are
 * scaled off the ones it does.
 */
const ARENA_PITCH = Object.freeze({
  halfW: PITCH_M.halfX,
  halfL: PITCH_M.halfZ,
  wallX: PITCH_M.halfX,
  goalHalfW: PITCH_M.goalHalfX,
  penaltyHalfX: PITCH_M.penaltyHalfX,
  penaltyDepth: PITCH_M.penaltyDepth,
  goalAreaHalfX: PITCH_M.goalHalfX + 1.1,
  goalAreaDepth: PITCH_M.penaltyDepth * 0.4,
  centreR: PITCH_M.halfX * 0.32,
  spotDist: PITCH_M.penaltyDepth * 0.62,
  arcR: PITCH_M.penaltyDepth * 0.42,
});

/** The whole visual side of one match. */
export class ArenaView {
  /**
   * @param {HTMLElement} container mount point for the canvas
   * @param {{slots:object[], teamColors?:number[]}} match
   */
  constructor(container, match) {
    const { renderer, scene, camera } = createScene(container, { pitch: ARENA_PITCH });
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.rig = new CameraRig(camera, { halfW: PITCH_M.halfX, halfL: PITCH_M.halfZ });

    this.goalFrames = buildGoalFrames(scene, {
      goalW: PITCH_M.goalHalfX * 2,
      goalH: GOAL_HEIGHT_M,
    });

    this.ball = new BallAdapter();
    this.ballView = new BallView(this.ball, scene);

    // The cosmetic layer (matrix #21-#25). It is handed metres and seconds and
    // nothing else; it cannot reach the world from here. `atmos: false` builds
    // the arena exactly as it was before, which is how the draw-call and
    // triangle deltas in the report were measured.
    this.atmos = match.atmos === false ? null : new Atmosphere(scene, {
      pitch: PITCH_M,
      ballRadius: BALL_VIEW_RADIUS_M,
      goalHeight: GOAL_HEIGHT_M,
      tier: match.tier,
      seed: 0x5eed17,
      sound: match.sound !== false,
      teamColors: match.teamColors || null,
    });

    const bodyScale = BODY_DRAW_SCALE;
    this.players = match.slots.map((slot, index) => {
      const adapter = new PlayerAdapter(slot);
      const view = new PlayerView(adapter, scene, match.teamColors || null);
      view.group.scale.setScalar(bodyScale);
      const entry = { adapter, view, slot };
      // Kits are applied once here; a later change goes through
      // atmos.applyKit(), which only writes uniforms.
      entry.dressed = this.atmos?.dress(view, {
        team: slot.team,
        role: slot.role,
        number: slot.number ?? shirtNumber(match.slots, index),
        pattern: slot.team === 0 ? 'stripes' : 'hoops',
      }) || null;
      return entry;
    });
    this.bodyScale = bodyScale;
    this.state = 'kickoff';
    // The ball reading of the PREVIOUS frame. The core resets the ball to the
    // centre spot on the tick it awards the goal, so by the time the score has
    // visibly moved the live ball is already back at the middle; the cosmetic
    // ball that flies into the net is launched from this copy instead.
    this.prevBall = { x: 0, z: 0, vx: 0, vz: 0 };
    this.saveArmed = true;
  }

  /** Mark a strike so the kick swing plays; called from core events. */
  onStrike(index) {
    this.players[index]?.adapter.strike();
    this.atmos?.onStrike(this.ball.pos.z);
  }

  /** Goal reaction: the scoring side bounces, the conceding side slumps. */
  onGoal(team, seconds = 2.4) {
    for (const p of this.players) {
      p.adapter.setCelebrate(p.slot.team === team ? 1 : -1, seconds);
    }
    this.atmos?.onGoal(team, this.prevBall, Math.max(seconds, 2.4));
  }

  /**
   * @param {{players:object[], ball:object}} state a readState() or a sample()
   * @param {number} dt seconds since the previous render
   * @param {{state?:string, me?:number}} ctx match flow, for the camera
   */
  update(state, dt, ctx = {}) {
    // copy, never a reference: the atmosphere gets numbers it cannot write back
    this.prevBall.x = this.ball.pos.x;
    this.prevBall.z = this.ball.pos.z;
    this.prevBall.vx = this.ball.vel.x;
    this.prevBall.vz = this.ball.vel.z;
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
    if (this.atmos) {
      this._reactSave(state);
      this.atmos.update(dt, {
        ball: { x: this.ball.pos.x, z: this.ball.pos.z },
        flow: ctx.state || 'play',
        scoreGap: state.score ? state.score[0] - state.score[1] : 0,
        secondsLeft: ctx.secondsLeft,
      });
      // during the goal scene the ball the viewer sees is the one in the net
      this.ballView.mesh.visible = !this.atmos.hidesMatchBall;
    }
    const me = ctx.me != null ? this.players[ctx.me]?.adapter : null;
    this.rig.update(dt, { ball: this.ball.pos, state: ctx.state || 'play', me: me || null });
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * A save is not a core event, so it is inferred the same way match.js infers
   * a strike: a keeper stretched out with the ball inside his reach. Read-only,
   * and wrong at worst by a round of applause.
   */
  _reactSave(state) {
    let stretched = false;
    for (let i = 0; i < this.players.length; i++) {
      const p = state.players[i];
      if (!p || this.players[i].slot.role !== 'keeper') continue;
      if (!(p.diveActive > 0)) continue;
      stretched = true;
      const dx = toMetres(p.x) - this.ball.pos.x;
      const dz = toMetres(p.z) - this.ball.pos.z;
      if (Math.hypot(dx, dz) < PITCH_M.controlR * 1.4 && this.saveArmed) {
        this.saveArmed = false;
        this.atmos.onSave();
      }
    }
    if (!stretched) this.saveArmed = true;
  }

  cycleCamera() { return this.rig.cycle(); }

  dispose() {
    this.atmos?.dispose();
    this.goalFrames.dispose();
    this.ballView.dispose();
    for (const p of this.players) p.view.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
