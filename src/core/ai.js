import {
  PITCH_HALF_L, KICK_RANGE, KICK_CHARGE_TIME, BALL_R, PLAYER_R,
} from './constants.js';

// Simple Haxball-style bot: get goal-side of the ball, push it toward the
// opponent goal, kick when in reach. Decisions refresh at ~7 Hz with a bit of
// noise so it feels human rather than laser-guided.
export class BotController {
  constructor(world, player) {
    this.world = world;
    this.player = player;
    this.attackSign = player.team === 0 ? 1 : -1; // +z for red, -z for blue
    this.decideTimer = 0;
    this.target = { x: 0, z: 0 };
    this.holdingKick = false;
    this.chargeWant = 0;
    this.noise = { x: 0, z: 0 };
  }

  update(dt) {
    const { world, player, attackSign } = this;
    const b = world.ball.pos;
    const goal = { x: 0, z: attackSign * PITCH_HALF_L };
    const ownGoal = { x: 0, z: -attackSign * PITCH_HALF_L };

    this.decideTimer -= dt;
    if (this.decideTimer <= 0) {
      this.decideTimer = 0.14;
      this.noise = { x: (Math.random() - 0.5) * 0.7, z: (Math.random() - 0.5) * 0.7 };

      // direction the ball should be pushed: from ball toward the goal
      let gx = goal.x - b.x, gz = goal.z - b.z;
      const gLen = Math.sqrt(gx * gx + gz * gz) || 1;
      gx /= gLen; gz /= gLen;
      // approach point sits behind the ball on the goal-ball line
      const behind = { x: b.x - gx * 0.55, z: b.z - gz * 0.55 };

      // is the bot on the wrong side (between ball and opponent goal)?
      const wrongSide = (player.pos.z - b.z) * attackSign > 0.2;
      if (wrongSide) {
        // swing around the ball, offset sideways so we don't push it backwards
        const side = player.pos.x >= b.x ? 1 : -1;
        this.target = { x: b.x + side * (PLAYER_R + BALL_R + 0.8), z: b.z - gz * 1.4 };
      } else {
        this.target = behind;
      }

      // panic defence: ball rolling at our goal and we're not on the line
      const towardOwn = (world.ball.vel.z || 0) * -attackSign > 3;
      const inOwnHalf = (b.z - 0) * attackSign < 0;
      if (towardOwn && inOwnHalf) {
        this.target = {
          x: (b.x + ownGoal.x) / 2,
          z: (b.z + ownGoal.z) / 2,
        };
      }
    }

    let dx = this.target.x + this.noise.x - player.pos.x;
    let dz = this.target.z + this.noise.z - player.pos.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0.15) { dx /= len; dz /= len; } else { dx = 0; dz = 0; }

    // kicking: hold to charge based on distance to goal, release in reach
    const distBall = Math.hypot(b.x - player.pos.x, b.z - player.pos.z);
    const distGoal = Math.hypot(goal.x - b.x, goal.z - b.z);
    let kick = false;
    if (distBall < KICK_RANGE + BALL_R + 0.35) {
      if (!this.holdingKick) {
        this.holdingKick = true;
        this.chargeWant = Math.min(1, Math.max(0.25, distGoal / 26));
        this.heldFor = 0;
      }
      this.heldFor += dt;
      kick = this.heldFor < this.chargeWant * KICK_CHARGE_TIME;
    } else {
      this.holdingKick = false;
      kick = false;
    }

    return { x: dx, z: dz, kick };
  }
}

// Goalkeeper: shadows the ball along a guard line in front of its own goal,
// charges the ball when it enters the box, and hammers it clear. Never kicks
// when the ball is goal-side of the keeper (that would be an own goal).
export class KeeperController {
  constructor(world, player) {
    this.world = world;
    this.player = player;
    this.attackSign = player.team === 0 ? 1 : -1;
    this.guardZ = -this.attackSign * (PITCH_HALF_L - 0.9);
    this.holdingKick = false;
    this.heldFor = 0;
  }

  update(dt) {
    const { world, player, attackSign } = this;
    const b = world.ball.pos;
    const bv = world.ball.vel;

    const distGoal = Math.hypot(b.x, b.z + this.attackSign * PITCH_HALF_L);
    const dangerous = distGoal < 5.0 && b.y < 1.8;

    let target;
    if (dangerous) {
      // attack the ball from the goal side so the clearance goes fieldward
      target = { x: b.x, z: b.z - attackSign * 0.35 };
      // stay inside the box
      target.x = Math.max(-6.5, Math.min(6.5, target.x));
      const gz = -attackSign * PITCH_HALF_L;
      target.z = attackSign > 0
        ? Math.max(gz + 0.6, Math.min(gz + 5.5, target.z))
        : Math.min(gz - 0.6, Math.max(gz - 5.5, target.z));
    } else {
      // shadow the ball's x with a little velocity lead, hold the line
      const lead = Math.max(-1, Math.min(1, bv.x * 0.18));
      // hold the line inside the posts of whatever goal size the match uses
      const lim = Math.max(0, world.config.goalW / 2 - 0.4);
      const tx = Math.max(-lim, Math.min(lim, b.x * 0.55 + lead));
      target = { x: tx, z: this.guardZ };
    }

    let dx = target.x - player.pos.x;
    let dz = target.z - player.pos.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0.12) { dx /= len; dz /= len; } else { dx = 0; dz = 0; }

    // clear the ball only when it is fieldward of the keeper
    const ballFieldward = (b.z - player.pos.z) * attackSign > 0;
    const distBall = Math.hypot(b.x - player.pos.x, b.z - player.pos.z);
    let kick = false;
    if (ballFieldward && distBall < KICK_RANGE + BALL_R + 0.25) {
      if (!this.holdingKick) { this.holdingKick = true; this.heldFor = 0; }
      this.heldFor += dt;
      kick = this.heldFor < 0.45 * KICK_CHARGE_TIME; // quick, punchy clearance
    } else {
      this.holdingKick = false;
    }
    return { x: dx, z: dz, kick };
  }
}
