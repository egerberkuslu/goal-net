import { PLAYER_SPEED, PLAYER_ACCEL_RATE, RAGDOLL_TIME } from './constants.js';

// A player is a vertical cylinder on the ground plane driven by an input
// direction. Velocity approaches the desired velocity exponentially, which
// gives the Haxball-like accelerate/glide feel.
export class Player {
  constructor(team, role = 'field') {
    this.team = team; // 0 = red (attacks +z), 1 = blue (attacks -z)
    this.role = role; // 'field' | 'keeper'
    this.pos = { x: 0, z: 0 };
    this.vel = { x: 0, z: 0 };
    this.input = { x: 0, z: 0 }; // desired direction, |v| <= 1
    this.facing = team === 0 ? 0 : Math.PI; // yaw around +y, 0 faces +z
    this.charge = 0;      // 0..1 kick charge, set by the game layer
    this.kickAnim = 0;    // >0 while the kick leg swings, set by the game layer
    this.down = 0;        // ragdoll: seconds until back on their feet
    this.downTotal = RAGDOLL_TIME;
    this.tumbleSpin = 0;
    this.knockCooldown = 0; // hidden immunity so players can't be stun-locked
  }

  reset(x, z) {
    this.pos = { x, z };
    this.vel = { x: 0, z: 0 };
    this.input = { x: 0, z: 0 };
    this.facing = this.team === 0 ? 0 : Math.PI;
    this.charge = 0;
    this.kickAnim = 0;
    this.down = 0;
    this.knockCooldown = 0;
  }

  // A fast ball flattens the player: thrown along the ball's travel
  // direction, no control until they scramble back up.
  knockDown(dirX, dirZ, speed) {
    if (this.down > 0 || this.knockCooldown > 0) return;
    this.knockCooldown = 6;
    this.down = this.downTotal = RAGDOLL_TIME;
    const shove = Math.min(9, speed * 0.42);
    this.vel.x += dirX * shove;
    this.vel.z += dirZ * shove;
    this.facing = Math.atan2(-dirX, -dirZ); // face the shot, fall backwards
    this.tumbleSpin = (Math.random() - 0.5) * 4;
    this.charge = 0;
  }

  integrate(h) {
    this.knockCooldown = Math.max(0, this.knockCooldown - h);
    if (this.down > 0) {
      this.down = Math.max(0, this.down - h);
      const f = Math.exp(-2.2 * h); // slide across the grass
      this.vel.x *= f; this.vel.z *= f;
    } else {
      let { x, z } = this.input;
      const len = Math.hypot(x, z);
      if (len > 1) { x /= len; z /= len; }
      const k = Math.min(1, PLAYER_ACCEL_RATE * h);
      this.vel.x += (x * PLAYER_SPEED - this.vel.x) * k;
      this.vel.z += (z * PLAYER_SPEED - this.vel.z) * k;
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0.5) this.facing = Math.atan2(this.vel.x, this.vel.z);
    }
    this.pos.x += this.vel.x * h;
    this.pos.z += this.vel.z * h;
  }

  speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }
}
