// The atmosphere layer of the deterministic arena — matrix rows #21 to #25.
//
// THE ONE RULE
// ------------
// This layer reads core state and never writes it. Every entry point here
// takes plain numbers (metres, seconds, team indices) or nothing at all. There
// is no world, no session, no state buffer and no tick anywhere below this
// comment, and there is no code path by which the atmosphere can change what
// the simulation does. Deleting the whole directory would change how the
// arena looks and sounds and nothing else. scripts/atmos-test.mjs asserts the
// negative: it drives a full goal sequence with a frozen match state and
// checks the state came back byte-identical.
//
// WHAT IS MOUNTED
//   #21 crowd      crowd.js   one instanced draw call, VAT clips
//   #22 ball boys  ballboy.js one instanced draw call, timeline is a fraction
//                             of the restart window the arena already runs
//   #23 net/flags  net.js     the shipping XPBD net driven read-only, plus
//                  flags.js   corner flags on a Verlet sheet
//   #24 kits       kit.js     one atlas, one program, uniform-only re-dressing
//   #25 sound      sound.js   procedural bed and one-shots behind an iOS-safe
//                             autoplay gate
//
// Cost, at the default desktop tier: six extra draw calls.

import * as THREE from 'three';
import { ArenaCrowd } from './crowd.js';
import { ArenaNets } from './net.js';
import { CornerFlags } from './flags.js';
import { BallBoys, PHASE } from './ballboy.js';
import { KitSystem, dressPlayerView, resolveKit } from './kit.js';
import { ArenaSfx, tensionOf } from './sound.js';
import { resolveTier } from './quality.js';

export { ArenaCrowd } from './crowd.js';
export { ArenaNets, CosmeticBall, collideBallNet } from './net.js';
export { CornerFlags } from './flags.js';
export { BallBoys, ballBoyPose, PHASE } from './ballboy.js';
export * from './kit.js';
export { ArenaSfx, createAudioGate, tensionOf } from './sound.js';
export * from './quality.js';
export * from './vat.js';
export { ClothSheet, windAt } from './cloth.js';

/** How long a goal celebration owns the scene, matching arena/match.js. */
export const DEFAULT_RESTART_S = 2.6;

export class Atmosphere {
  /**
   * @param {THREE.Scene|{add:Function, remove?:Function}} scene
   * @param {{pitch:object, goalHeight:number, tier?:string|object,
   *          seed?:number, sound?:boolean, sfx?:object,
   *          teamColors?:number[]}} opts `pitch` is arena/units.js PITCH_M.
   */
  constructor(scene, opts) {
    const tier = resolveTier(opts.tier);
    this.tier = tier;
    this.scene = scene;
    this.pitch = opts.pitch;
    this.teamColors = opts.teamColors || null;

    this.crowd = new ArenaCrowd(scene, { tier, seed: opts.seed });
    this.nets = new ArenaNets(scene, {
      goalW: opts.pitch.goalHalfX * 2,
      goalH: opts.goalHeight,
      goalZ: opts.pitch.halfZ,
      ballRadius: opts.pitch.ballR,
      tier,
    });
    this.flags = new CornerFlags(scene, {
      halfX: opts.pitch.halfX, halfZ: opts.pitch.halfZ, tier,
    });
    this.boys = new BallBoys(scene, {
      halfX: opts.pitch.halfX, halfZ: opts.pitch.halfZ, tier,
    });
    this.kits = new KitSystem();

    // The ball the net catches and the ball-boy carries. One draw call, and
    // it is only ever visible between a goal and the restart.
    const ballGeo = new THREE.SphereGeometry(opts.pitch.ballR, 14, 10);
    this.ballMaterial = new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.55 });
    this.ballMesh = new THREE.Mesh(ballGeo, this.ballMaterial);
    this.ballMesh.name = 'atmos.cosmeticBall';
    this.ballMesh.visible = false;
    this.ballMesh.castShadow = true;
    scene.add(this.ballMesh);

    this.sfx = opts.sound === false ? null : (opts.sfx || new ArenaSfx());

    this.time = 0;
    this.goalLeft = 0;
    this.goalTeam = -1;
    this.restartSeconds = opts.restartSeconds ?? DEFAULT_RESTART_S;
    this.frames = 0;
    this.lastCostMs = 0;
  }

  /** True while the cosmetic ball owns the scene, so the match ball hides. */
  get hidesMatchBall() {
    return this.goalLeft > 0 && this.nets.ball.active;
  }

  /**
   * @param {number} dt seconds since the previous frame
   * @param {{ball?:{x:number,z:number,vx?:number,vz?:number},
   *          flow?:string, scoreGap?:number, secondsLeft?:number}} [ctx]
   *   Everything here is a copy of core state, in metres. Nothing is written.
   */
  update(dt, ctx = {}) {
    const t0 = nowMs();
    const step = Math.max(0, Math.min(0.25, Number.isFinite(dt) ? dt : 0));
    this.time += step;
    this.frames++;

    if (this.goalLeft > 0) {
      this.goalLeft = Math.max(0, this.goalLeft - step);
      if (this.goalLeft === 0) this._endGoalScene();
    }

    // While the boy is still running out, keep aiming him at where the ball
    // actually is; it is still settling into the net when he sets off.
    const cball = this.nets.ball;
    if (cball.active && this.boys.phase === PHASE.FETCH) {
      this.boys.ballAt.x = cball.x;
      this.boys.ballAt.z = cball.z;
    }

    const matchBall = ctx.ball
      ? { x: ctx.ball.x, y: this.pitch.ballR, z: ctx.ball.z }
      : null;
    this.nets.update(step, matchBall);
    this.flags.update(step);
    this.boys.update(step, cball);
    this.crowd.update(step, this.time);

    this.ballMesh.visible = cball.active;
    if (cball.active) this.ballMesh.position.set(cball.x, cball.y, cball.z);

    if (this.sfx) {
      this.sfx.poke();
      if (ctx.flow === 'end' || ctx.flow === undefined) this.sfx.setAmbiance(this.sfx.ambiance);
      this.sfx.setTension(tensionOf({
        scoreGap: ctx.scoreGap ?? 0,
        secondsLeft: ctx.secondsLeft ?? -1,
        ballZ: ctx.ball ? ctx.ball.z : 0,
        halfZ: this.pitch.halfZ,
      }));
    }

    this.lastCostMs = nowMs() - t0;
  }

  /**
   * A goal. `sample` is the last authoritative ball reading BEFORE the core
   * reset it to the centre spot, in metres and metres per second — a copy, not
   * a reference into anything the core owns.
   *
   * @param {number} team 0 red, 1 blue
   * @param {{x:number,z:number,vx:number,vz:number}} [sample]
   * @param {number} [seconds] the restart window the arena is running
   */
  onGoal(team, sample = null, seconds = this.restartSeconds) {
    this.goalTeam = team === 1 ? 1 : 0;
    this.goalLeft = seconds;
    this.crowd.onGoal(this.goalTeam);
    this.sfx?.onGoal(this.goalTeam);

    const shot = this._goalSample(this.goalTeam, sample);
    this.nets.launchCosmeticBall(shot);
    this.boys.onDeadBall({
      kind: 'goal', x: shot.x, z: shot.z, spotX: 0, spotZ: 0, seconds,
    });
  }

  /**
   * Team 0 attacks +z (packages/core/src/world.js). A sample that does not
   * agree with that — a guest's interpolated stream can lag the reset — is
   * replaced by a plausible one rather than trusted, because the cosmetic ball
   * has to end up in the right net or the whole scene reads as a bug.
   */
  _goalSample(team, sample) {
    const sign = team === 0 ? 1 : -1;
    const line = this.pitch.halfZ;
    const goalHalf = this.pitch.goalHalfX;
    const ok = sample && Number.isFinite(sample.x) && Number.isFinite(sample.z)
      && Math.sign(sample.z) === sign && Math.abs(sample.z) > line - 4
      && Math.abs(sample.x) < goalHalf + 0.6;
    if (!ok) {
      return { x: 0, z: sign * (line - 0.4), vx: 0, vz: sign * 11 };
    }
    const vz = Number.isFinite(sample.vz) ? sample.vz : 0;
    const vx = Number.isFinite(sample.vx) ? sample.vx : 0;
    const speed = Math.hypot(vx, vz);
    // a crawler over the line still has to reach the net for the scene to work
    const boost = speed < 4 ? 4 / Math.max(speed, 0.6) : 1;
    return {
      x: Math.max(-goalHalf * 0.9, Math.min(goalHalf * 0.9, sample.x)),
      z: sign * Math.min(Math.abs(sample.z), line - 0.15),
      vx: vx * boost,
      vz: (Math.sign(vz) === sign ? vz : sign * Math.abs(vz || 6)) * boost,
    };
  }

  _endGoalScene() {
    this.nets.clearCosmeticBall();
    this.ballMesh.visible = false;
    this.goalTeam = -1;
  }

  /** Someone struck the ball. `ballZ` is used for the crowd swell distance. */
  onStrike(ballZ = 0) { this.sfx?.onStrike(ballZ); }

  /** A keeper kept it out: applause and a one-shot. */
  onSave() {
    this.crowd.onApplause();
    this.sfx?.onSave();
  }

  onWhistle() { this.sfx?.onWhistle(); }

  /** Kickoff, half time, full time: whistle plus a round of applause. */
  onRestart() {
    this.onWhistle();
    this.crowd.onApplause(1.4);
  }

  /**
   * Dress one PlayerView. Called once per player at build time; after that a
   * kit change is `applyKit`, which writes uniforms and allocates nothing.
   *
   * @param {object} view a view/playerView.js PlayerView
   * @param {{team:number, role?:string, number?:number, pattern?:string}} spec
   */
  dress(view, spec) {
    const set = this.kits.createSet();
    const kit = resolveKit({ ...spec, colors: this.teamColors });
    this.kits.apply(set, kit);
    dressPlayerView(view, set);
    return { set, kit };
  }

  /** @param {{set:object}} dressed @param {object} spec */
  applyKit(dressed, spec) {
    const kit = resolveKit({ ...spec, colors: this.teamColors });
    this.kits.apply(dressed.set, kit);
    return kit;
  }

  stats() {
    return {
      tier: this.tier.name,
      frames: this.frames,
      costMs: this.lastCostMs,
      drawCalls: this.crowd.stats().drawCalls + this.nets.stats().drawCalls
        + this.flags.stats().drawCalls + this.boys.stats().drawCalls + 1,
      crowd: this.crowd.stats(),
      nets: this.nets.stats(),
      flags: this.flags.stats(),
      boys: this.boys.stats(),
      kits: this.kits.stats(),
      sound: this.sfx ? this.sfx.stats() : null,
    };
  }

  dispose() {
    this.crowd.dispose();
    this.nets.dispose();
    this.flags.dispose();
    this.boys.dispose();
    this.kits.dispose();
    this.sfx?.dispose();
    this.scene.remove?.(this.ballMesh);
    this.ballMesh.geometry.dispose();
    this.ballMaterial.dispose();
  }
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
