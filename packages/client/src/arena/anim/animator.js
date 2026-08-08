// The animator: one per player, the only place core state is turned into a
// state-machine request, and the only place the pose layers are stacked.
//
// The contract this file exists to hold up, and that scripts/anim-test.mjs
// asserts rather than assumes:
//
//     pose = evaluate(core player fields, animation clock, machine)
//
// `evaluate` reads. It does not advance the clock, it does not touch the
// machine, and it does not write to anything the core owns. `advance` is the
// only mutator, and it takes dt explicitly. Splitting them is what makes
// "same core state => identical transforms" a thing you can check: advance
// once, evaluate twice, compare the two Float64Arrays element for element.
//
// READ-ONLY, both directions
//   Nothing here writes to packages/core. The fields consumed are exactly what
//   readState() hands out, which is also exactly what a guest's interpolated
//   sample carries, so a host and a guest watching the same tick animate the
//   same way. Where a guest's sample is missing a field (it carries positions
//   and little else), the layer that wanted it degrades to zero rather than to
//   NaN — every read below is `|| 0` for that reason and not by accident.

import { CONSTANTS } from '../../../../core/src/index.js';
import {
  addPose, ch, CH_PY, CH_RY, copyPose, createPose, createPosePool, lerpPose, zeroPose,
} from './pose.js';
import { AnimClock, RUN_SPEED, WALK_SPEED, angleDelta, approach, gaitBlend } from './clock.js';
import {
  blendParams, layerAim, layerBreath, layerLean, layerTap, writeGait, TAP_DURATION,
} from './locomotion.js';
import {
  KICKS, kickFoot, selectKick, writeKick, writeSlide, writeStumble, writeWindup,
} from './kicks.js';
import {
  CELEBRATIONS, DEJECTIONS, selectCelebration, selectDejection,
  writeCelebration, writeDejection,
} from './celebrations.js';
import {
  diveIdOf, writeCatch, writeClearWindup, writeDive, writeGetUp, writeShuffle,
  writeStance, writeThrow,
} from './keeper.js';
import { AnimStateMachine } from './stateMachine.js';

const TICK_HZ = CONSTANTS.TICK_RATE;
const CHARGE_MAX = CONSTANTS.CHARGE_MAX_TICKS;
const CLEAR_MAX = CONSTANTS.CLEAR_MAX_TICKS;
const DIVE_ACTIVE = CONSTANTS.DIVE_ACTIVE_TICKS;
const DIVE_LOCK = CONSTANTS.DIVE_WHIFF_LOCK_TICKS;
const TACKLE_ACTIVE = CONSTANTS.TACKLE_ACTIVE_TICKS;
const TACKLE_RECOVERY = CONSTANTS.TACKLE_RECOVERY_TICKS;

/** How long a celebration or a slump holds before the machine lets go. */
export const GOAL_REACTION_SECONDS = 2.6;
/** Radians per second the body may turn to face where it is going. */
const TURN_RATE = 11;
/** Speed (m/s) below which the keeper stops shuffling and just sets. */
const SHUFFLE_THRESHOLD = 0.30;

/**
 * One player's animation. Owns a clock, a machine, and the handful of edge
 * detectors that turn "this number went up" into "play that".
 */
export class PlayerAnimator {
  /**
   * @param {object} slot roster slot: { index, team, role, name }
   * @param {object} [opts]
   * @param {number} [opts.toMetres] core units -> metres; identity if omitted
   */
  constructor(slot, opts = {}) {
    this.index = slot.index | 0;
    this.team = slot.team | 0;
    this.isKeeper = slot.role === 'keeper' || slot.role === 1;
    this.toMetres = opts.toMetres || ((u) => u);

    // Offsetting the starting phase by the slot index is the cheapest possible
    // fix for ten identical characters marching in perfect lockstep.
    this.clock = new AnimClock(this.index * 0.137);
    this.machine = new AnimStateMachine(this.isKeeper ? 'keeperStance' : 'idle');

    this.pose = createPose();
    this.pool = createPosePool(4);

    // world placement, in metres
    this.x = 0;
    this.z = 0;
    this.facing = this.team === 0 ? 0 : Math.PI;
    this.speed = 0;
    this.vx = 0;
    this.vz = 0;
    this.travelAngle = 0;   // direction of travel in the player's own frame

    // edge detectors, all seeded from the first frame so nothing fires at t=0
    this.seeded = false;
    this.prevTouchCooldown = 0;
    this.prevKickCooldown = 0;
    this.prevCharge = 0;
    this.prevClearCharge = 0;
    this.prevDiveActive = 0;
    this.prevHolding = false;

    // one-shot timelines
    this.kickId = null;
    this.kickT = 0;
    this.kickFootSide = 1;
    this.tapT = Infinity;
    this.tapSide = 1;
    this.slideT = 0;
    this.stumbleT = 0;
    this.throwT = 0;
    this.reactionId = null;
    this.reactionT = 0;
    this.reactionKind = 0;  // +1 celebrate, -1 dejected
    this.holdSeconds = 0;
    this.diveId = 'lowLeft';
    this.diveU = 0;
    this.getUpU = 0;
    this.charge01 = 0;
    this.clear01 = 0;
    this.curve = 0;
    this.aimYaw = 0;
  }

  // ------------------------------------------------------------- advance ---

  /**
   * Consume one rendered frame of core state. The ONLY mutator.
   *
   * @param {number} dt seconds since the previous frame
   * @param {object} p one entry of readState().players, or a sampled stand-in
   * @param {object} ctx { ball, tick, score, flow }
   */
  advance(dt, p, ctx = {}) {
    const d = dt > 0 ? Math.min(dt, 0.1) : 0;
    if (!p) return this;

    const x = this.toMetres(p.x || 0);
    const z = this.toMetres(p.z || 0);
    // Velocity from the core's own vx/vz when it has them (the host path), and
    // from the position difference when it does not (a guest's sample carries
    // interpolated positions only). Both are metres per second.
    let vx;
    let vz;
    if (Number.isFinite(p.vx) && (p.vx !== 0 || p.vz !== 0)) {
      vx = this.toMetres(p.vx) * TICK_HZ;
      vz = this.toMetres(p.vz) * TICK_HZ;
    } else if (d > 0 && this.seeded) {
      vx = (x - this.x) / d;
      vz = (z - this.z) / d;
    } else {
      vx = 0;
      vz = 0;
    }
    const prevVx = this.vx;
    const prevVz = this.vz;
    this.x = x;
    this.z = z;
    this.vx = vx;
    this.vz = vz;
    this.speed = Math.hypot(vx, vz);

    // Facing turns toward travel, but never while stationary — a player who has
    // stopped keeps looking where they were, which is what a real one does.
    if (this.speed > WALK_SPEED * 0.6) {
      const want = Math.atan2(vx, vz);
      this.facing += angleDelta(this.facing, want) * approach(d, TURN_RATE);
    }
    // Travel direction expressed in the player's own frame: this is the ONE
    // number the eight-way blend space is indexed by.
    this.travelAngle = this.speed > 1e-4
      ? angleDelta(this.facing, Math.atan2(vx, vz))
      : 0;

    // Acceleration in the player's own frame, for the lean layer.
    const ax = d > 0 ? (vx - prevVx) / d : 0;
    const az = d > 0 ? (vz - prevVz) / d : 0;
    const cf = Math.cos(this.facing);
    const sf = Math.sin(this.facing);
    const accelF = ax * sf + az * cf;
    const accelR = ax * cf - az * sf;
    this.clock.advance(d, this.speed, this.seeded ? accelF : 0, this.seeded ? accelR : 0);

    // Bearing to the ball, for the aim layer.
    if (ctx.ball) {
      const bx = this.toMetres(ctx.ball.x || 0) - x;
      const bz = this.toMetres(ctx.ball.z || 0) - z;
      if (Math.hypot(bx, bz) > 1e-3) {
        this.aimYaw = angleDelta(this.facing, Math.atan2(bx, bz));
      }
      this.curve = ctx.ball.curve || 0;
    }

    this._detectEvents(d, p, ctx);
    this._advanceTimelines(d);
    this.machine.request(this._wantedState(p, ctx));
    this.machine.update(d);
    this.seeded = true;
    return this;
  }

  /** Edge detection on the core's counters. Nothing here writes to the core. */
  _detectEvents(d, p, ctx) {
    const touch = p.touchCooldown || 0;
    const kickCd = p.kickCooldown || 0;
    const charge = p.charge || 0;
    const clearCharge = p.clearCharge || 0;
    const diveActive = p.diveActive || 0;
    const holding = (ctx.ball?.holder | 0) === this.index && (ctx.ball?.holder ?? -1) >= 0;

    this.charge01 = CHARGE_MAX > 0 ? Math.min(1, charge / CHARGE_MAX) : 0;
    this.clear01 = CLEAR_MAX > 0 ? Math.min(1, clearCharge / CLEAR_MAX) : 0;

    if (this.seeded) {
      // A ball contact: the core's touch cooldown is reset to full on the tick
      // it touches, so a jump upward IS the contact. This is the same trick
      // arena/match.js uses for the kick swing, and it works on a guest's
      // interpolated sample for the same reason.
      if (touch > this.prevTouchCooldown) {
        this.tapT = 0;
        this.tapSide = this.kickFootSide;
      }
      // A strike: the kick cooldown jumping to full.
      if (kickCd > this.prevKickCooldown) {
        // The variant is chosen from the charge that was on the clock the frame
        // BEFORE the release, because the core zeroes it on release.
        const released = Math.max(this.charge01, CHARGE_MAX > 0 ? this.prevCharge / CHARGE_MAX : 0);
        const clearing = this.isKeeper && this.prevClearCharge > 0;
        this.kickId = selectKick({ charge01: released, curve: this.curve, clearing });
        this.kickFootSide = kickFoot(this.kickId, this.curve);
        this.kickT = 0;
      }
      // A dive starting: latch which of the four it is, once, so a changing
      // diveDir mid-flight cannot swap the pose out from under the viewer.
      if (diveActive > 0 && this.prevDiveActive === 0) {
        this.diveId = diveIdOf(p.diveDir || 0);
      }
      if (holding && !this.prevHolding) this.holdSeconds = 0;
      // A hand roll-out: the ball leaving a keeper who was holding it, with no
      // clearance charge on the clock, is a throw.
      if (!holding && this.prevHolding && clearCharge === 0 && kickCd <= this.prevKickCooldown) {
        this.throwT = 0;
      }
    }
    if (holding) this.holdSeconds += d;

    // slide and stumble read straight off the core's own windows
    const tackle = p.tackleActive || 0;
    if (tackle > 0) this.slideT = 1 - tackle / TACKLE_ACTIVE;
    const recovery = p.tackleRecovery || 0;
    if (recovery > 0) this.stumbleT = 1 - recovery / TACKLE_RECOVERY;

    if (diveActive > 0) this.diveU = 1 - diveActive / DIVE_ACTIVE;
    const lock = p.diveLock || 0;
    this.getUpU = lock > 0 ? Math.min(1, lock / DIVE_LOCK) : 0;

    // The goal reaction. The score change is spotted by the caller (arena's
    // match loop already does it); we just latch the choice once.
    if (ctx.goal && ctx.goal.tick !== this.lastGoalTick) {
      this.lastGoalTick = ctx.goal.tick;
      const seed = {
        playerIndex: this.index,
        tick: ctx.goal.tick | 0,
        scoreRed: ctx.goal.score?.[0] | 0,
        scoreBlue: ctx.goal.score?.[1] | 0,
        team: ctx.goal.team | 0,
      };
      if (ctx.goal.team === this.team) {
        this.reactionKind = 1;
        this.reactionId = selectCelebration(seed);
      } else {
        this.reactionKind = -1;
        this.reactionId = selectDejection(seed);
      }
      this.reactionT = 0;
    }

    this.prevTouchCooldown = touch;
    this.prevKickCooldown = kickCd;
    this.prevCharge = charge;
    this.prevClearCharge = clearCharge;
    this.prevDiveActive = diveActive;
    this.prevHolding = holding;
  }

  _advanceTimelines(d) {
    if (this.kickId) {
      this.kickT += d;
      if (this.kickT > (KICKS[this.kickId]?.seconds ?? 0.4)) this.kickId = null;
    }
    if (this.tapT < TAP_DURATION) this.tapT += d;
    if (this.throwT < 1) this.throwT += d;
    if (this.reactionKind !== 0) {
      this.reactionT += d;
      if (this.reactionT > GOAL_REACTION_SECONDS) {
        this.reactionKind = 0;
        this.reactionId = null;
      }
    }
  }

  /** The state the core's numbers say we should be in, this frame. */
  _wantedState(p, ctx) {
    if (this.reactionKind > 0) return 'celebrate';
    if (this.reactionKind < 0) return 'dejected';

    if ((p.tackleActive || 0) > 0) return 'slide';
    if ((p.tackleRecovery || 0) > 0) return 'stumble';

    if (this.isKeeper) {
      if ((p.diveActive || 0) > 0) return 'keeperDive';
      if ((p.diveLock || 0) > 0) return 'keeperGetUp';
      const holding = (ctx.ball?.holder | 0) === this.index && (ctx.ball?.holder ?? -1) >= 0;
      if (holding) {
        if ((p.clearCharge || 0) > 0) return 'keeperClear';
        return 'keeperCatch';
      }
      if (this.throwT < 0.6) return 'keeperThrow';
      if (this.kickId) return 'kick';
      // Outside their own box a keeper is an ordinary field player
      // (goalkeeper.md), so the field states are the right ones there.
      if (ctx.inBox === false) {
        if ((p.charge || 0) > 0) return 'windup';
        return this.speed > WALK_SPEED ? 'locomotion' : 'idle';
      }
      if (this.speed > SHUFFLE_THRESHOLD) return 'keeperShuffle';
      return 'keeperStance';
    }

    if (this.kickId) return 'kick';
    if ((p.charge || 0) > 0) return 'windup';
    return this.speed > WALK_SPEED ? 'locomotion' : 'idle';
  }

  // ------------------------------------------------------------ evaluate ---

  /**
   * Build this frame's pose. PURE with respect to the animator's state: calling
   * it twice in a row returns identical numbers, which is the determinism
   * assertion. Writes into `out` and returns it.
   */
  evaluate(out = this.pose) {
    const m = this.machine;
    zeroPose(out);
    if (m.blend >= 1 || m.from === m.to) {
      this._writeState(out, m.to, m.elapsed);
    } else {
      const a = this.pool.take();
      const b = this.pool.take();
      this._writeState(a, m.from, m.elapsed + m.duration);
      this._writeState(b, m.to, m.elapsed);
      lerpPose(out, a, b, m.eased);
    }
    // Layers that ride on top of EVERY state, including a crossfade, so the
    // aim and the breath never stutter across a transition.
    this._writeGlobalLayers(out);
    // Facing goes in the pose because a rotation commutes with the uniform
    // scale the renderer applies. The WORLD POSITION deliberately does not.
    //
    // The rig is authored as a 1.75 m character and the arena scales it up onto
    // the core's fat collision disc, so the renderer multiplies every bone
    // matrix by ~2.14. A world position living in the pose gets multiplied too,
    // and every player is drawn at 2.14x their real pitch coordinates — bunched
    // into one corner, out of step with their own name tags, and still passing
    // every determinism assertion, because the poses were consistently wrong.
    // A screenshot caught it; no unit test would have. So x and z stay out of
    // the pose and the renderer composes T(x, z) . S(scale) . bone itself.
    out[ch('root', CH_RY)] += this.facing;
    return out;
  }

  /** Advance and evaluate in one call, for the render loop. */
  update(dt, p, ctx) {
    this.advance(dt, p, ctx);
    return this.evaluate();
  }

  _writeGlobalLayers(out) {
    const c = this.clock;
    const st = this.machine.current;
    // No aim while the body is on the floor or mid-celebration: a player lying
    // on the grass does not swivel their chest at the ball, and a celebration
    // has its own head direction.
    const grounded = st === 'slide' || st === 'keeperDive' || st === 'keeperGetUp'
      || st === 'celebrate' || st === 'dejected' || st === 'stumble';
    if (!grounded) {
      const aimWeight = st === 'kick' || st === 'windup' ? 0.55 : 1;
      layerAim(out, this.aimYaw, 0, aimWeight);
      layerLean(out, c.accelF, c.accelR, 1);
    }
    layerBreath(out, c.breath, grounded ? 0.35 : 1 - gaitBlend(this.speed) * 0.6);
    if (this.tapT < TAP_DURATION) layerTap(out, this.tapT, this.tapSide, 1);
  }

  /**
   * The pose of ONE state, at `t` seconds into it. Every branch is a pure
   * function of the animator's latched fields and `t`.
   */
  _writeState(out, state, t) {
    switch (state) {
      case 'idle':
      case 'locomotion': {
        const p = blendParams(this.travelAngle, this.speed);
        writeGait(out, p, this.clock.phase, this.travelAngle);
        return out;
      }
      case 'windup': {
        const p = blendParams(this.travelAngle, this.speed * 0.5);
        writeGait(out, p, this.clock.phase, this.travelAngle);
        writeWindup(out, this.charge01);
        return out;
      }
      case 'kick': {
        const id = this.kickId || 'pass';
        const dur = KICKS[id]?.seconds ?? 0.4;
        // The swing plays off its OWN clock, not the machine's, so a crossfade
        // into it does not restart the swing halfway through the ball.
        const u = dur > 0 ? this.kickT / dur : 1;
        const p = blendParams(this.travelAngle, this.speed * 0.6);
        writeGait(out, p, this.clock.phase, this.travelAngle);
        writeKick(out, id, u, this.kickFootSide);
        return out;
      }
      case 'slide':
        writeSlide(out, this.slideT);
        return out;
      case 'stumble':
        writeStumble(out, this.stumbleT);
        return out;
      case 'celebrate': {
        const id = this.reactionId || CELEBRATIONS[0].id;
        return writeCelebration(out, id, this.reactionT);
      }
      case 'dejected': {
        const id = this.reactionId || DEJECTIONS[0].id;
        return writeDejection(out, id, this.reactionT);
      }
      case 'keeperStance':
        return writeStance(out, this.clock.t, this._alertness());
      case 'keeperShuffle': {
        writeStance(out, this.clock.t, this._alertness());
        const dir = Math.abs(this.vx) > 1e-4 ? Math.sign(this.vx) : 0;
        const intensity = Math.min(1, this.speed / (RUN_SPEED * 0.6));
        return writeShuffle(out, this.clock.phase, dir, intensity);
      }
      case 'keeperDive':
        return writeDive(out, this.diveId, this.diveU);
      case 'keeperGetUp':
        return writeGetUp(out, this.getUpU);
      case 'keeperCatch':
        return writeCatch(out, this.holdSeconds);
      case 'keeperThrow':
        return writeThrow(out, Math.min(1, this.throwT / 0.6));
      case 'keeperClear':
        writeStance(out, this.clock.t, 0);
        return writeClearWindup(out, this.clear01);
      default:
        return out;
    }
  }

  /** How wound-up the keeper's stance is: closer ball, lower crouch. */
  _alertness() {
    const yaw = Math.abs(this.aimYaw);
    return Math.max(0, Math.min(1, 1 - yaw / Math.PI)) * 0.8;
  }

  /** Exact internal state, so a test can rewind and replay a frame. */
  snapshot() {
    return {
      clock: this.clock.snapshot(),
      machine: {
        from: this.machine.from, to: this.machine.to, goal: this.machine.goal,
        blend: this.machine.blend, duration: this.machine.duration,
        elapsed: this.machine.elapsed,
      },
      x: this.x, z: this.z, facing: this.facing, speed: this.speed,
      vx: this.vx, vz: this.vz, travelAngle: this.travelAngle,
      kickId: this.kickId, kickT: this.kickT, kickFootSide: this.kickFootSide,
      tapT: this.tapT, tapSide: this.tapSide, slideT: this.slideT,
      stumbleT: this.stumbleT, throwT: this.throwT,
      reactionId: this.reactionId, reactionT: this.reactionT,
      reactionKind: this.reactionKind, holdSeconds: this.holdSeconds,
      diveId: this.diveId, diveU: this.diveU, getUpU: this.getUpU,
      charge01: this.charge01, clear01: this.clear01, curve: this.curve,
      aimYaw: this.aimYaw,
    };
  }

  restore(s) {
    this.clock.restore(s.clock);
    Object.assign(this.machine, s.machine);
    for (const k of Object.keys(s)) {
      if (k !== 'clock' && k !== 'machine') this[k] = s[k];
    }
    return this;
  }
}

/** Convenience: a pose evaluated straight from a snapshot, no side effects. */
export function poseFromSnapshot(animator, snapshot, out = createPose()) {
  const saved = animator.snapshot();
  animator.restore(snapshot);
  const pose = copyPose(out, animator.evaluate(createPose()));
  animator.restore(saved);
  return pose;
}

export { addPose, createPose };
