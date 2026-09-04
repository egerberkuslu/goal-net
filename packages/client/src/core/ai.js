import {
  PITCH_HALF_L, KICK_RANGE, KICK_CHARGE_TIME, BALL_R, PLAYER_R, WALL_X,
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
    const bv = world.ball.vel;
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

      // A ball against the boards puts every point "behind" it OUTSIDE the
      // pitch, and a target the bounds clamp will never let the bot reach is
      // a bot pressing into the corner for as long as the ball sits there —
      // which, with a team-mate arriving behind, is exactly the corner the
      // player reported being stuck in. So the target is kept inside the
      // playable rectangle, and when the ball is in a corner the bot comes at
      // it from the pitch side, where there is room to stand and a direction
      // to kick.
      const limX = WALL_X - PLAYER_R - 0.05;
      const limZ = PITCH_HALF_L - PLAYER_R - 0.15;
      const inCorner = Math.abs(b.x) > WALL_X - 1.6 && Math.abs(b.z) > PITCH_HALF_L - 1.6;
      if (inCorner) {
        // from the ball toward the centre of the pitch
        let cx = -b.x, cz = -b.z;
        const cl = Math.hypot(cx, cz) || 1;
        cx /= cl; cz /= cl;
        this.target = { x: b.x + cx * 0.6, z: b.z + cz * 0.6 };
      }
      this.target.x = Math.max(-limX, Math.min(limX, this.target.x));
      this.target.z = Math.max(-limZ, Math.min(limZ, this.target.z));

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

    // a ball floated in above standing reach: leap for it, the same reach the
    // header check already relies on (see world.js#collideBallPlayers)
    const closeToBall = Math.abs(b.x - player.pos.x) < 1.0 &&
      Math.abs(b.z - player.pos.z) < 1.0;
    const jump = closeToBall && b.y > 1.7 && b.y < 2.9 && bv.y < 3;

    return { x: dx, z: dz, kick, jump };
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
    this.diveCooldown = 0;
    this.actionCooldown = 0; // shared breather between clears and dives
    this.decideTimer = 0;
    this.cachedMove = { x: 0, z: 0 };
  }

  update(dt) {
    const { world, player, attackSign } = this;
    const b = world.ball.pos;
    const bv = world.ball.vel;

    this.actionCooldown = Math.max(0, this.actionCooldown - dt);

    // dive ONLY as a last resort: a real shot (fast, on target, from
    // distance) crossing the line where running can no longer reach it.
    // Everything else is handled on foot — that keeps him catching balls.
    this.diveCooldown = Math.max(0, this.diveCooldown - dt);
    const incoming = bv.z * -attackSign > 9;
    if (incoming && this.diveCooldown <= 0 && this.actionCooldown <= 0 &&
        player.dive <= 0 && b.y < 2.2) {
      const dz = Math.abs(b.z - player.pos.z);
      const tHit = dz / Math.abs(bv.z || 1);
      if (dz > 2.5 && dz < 7.5 && tHit < 0.5) {
        const crossX = b.x + bv.x * tHit;
        const dx = crossX - player.pos.x;
        const onTarget = Math.abs(crossX) < world.config.goalW / 2 + 0.35;
        // a ball sailing in over the head: leap straight up for it
        const crossY = b.y + bv.y * tHit - 4.905 * tHit * tHit;
        if (onTarget && crossY > 1.5 && crossY < 2.75 && Math.abs(dx) < 1.0 &&
            player.jumpY <= 0) {
          player.startJump();
          this.actionCooldown = Math.max(this.actionCooldown, 0.9);
        }
        const needSpeed = Math.abs(dx) / Math.max(tHit, 0.06);
        if (onTarget && needSpeed > 5.5 && Math.abs(dx) > 1.0 && Math.abs(dx) < 3.0) {
          // impulse sized to land ON the intercept point, not past it
          // (dive displacement ~= 0.386 * impulse over the dive duration)
          const power = Math.min(8.5, Math.max(3.2, Math.abs(dx) * 2.6));
          player.startDive(Math.sign(dx), 0, power);
          this.diveCooldown = 1.6;
          this.actionCooldown = 1.4;
        }
      }
    }

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

    // 8 Hz steering refresh keeps the keeper from twitching every frame
    this.decideTimer -= dt;
    if (this.decideTimer <= 0) {
      this.decideTimer = 0.12;
      let dx = target.x - player.pos.x;
      let dz = target.z - player.pos.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0.12) { dx /= len; dz /= len; } else { dx = 0; dz = 0; }
      // catching a breath after a clearance or dive: slower, stays composed
      const pace = this.actionCooldown > 0 ? 0.55 : 1;
      this.cachedMove = { x: dx * pace, z: dz * pace };
    }

    // clear the ball only when it is fieldward of the keeper, and never
    // twice in a row without a breather
    const ballFieldward = (b.z - player.pos.z) * attackSign > 0;
    const distBall = Math.hypot(b.x - player.pos.x, b.z - player.pos.z);
    let kick = false;
    if (this.actionCooldown <= 0 && ballFieldward &&
        distBall < KICK_RANGE + BALL_R + 0.25) {
      if (!this.holdingKick) { this.holdingKick = true; this.heldFor = 0; }
      this.heldFor += dt;
      kick = this.heldFor < 0.45 * KICK_CHARGE_TIME; // quick, punchy clearance
      if (!kick) { this.holdingKick = false; this.actionCooldown = 1.2; }
    } else {
      this.holdingKick = false;
    }
    return { x: this.cachedMove.x, z: this.cachedMove.z, kick };
  }
}
