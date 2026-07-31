import { PLAYER_SPEED, PLAYER_ACCEL_RATE } from './constants.js';

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
  }

  reset(x, z) {
    this.pos = { x, z };
    this.vel = { x: 0, z: 0 };
    this.input = { x: 0, z: 0 };
    this.facing = this.team === 0 ? 0 : Math.PI;
    this.charge = 0;
    this.kickAnim = 0;
  }

  integrate(h) {
    let { x, z } = this.input;
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    const k = Math.min(1, PLAYER_ACCEL_RATE * h);
    this.vel.x += (x * PLAYER_SPEED - this.vel.x) * k;
    this.vel.z += (z * PLAYER_SPEED - this.vel.z) * k;
    this.pos.x += this.vel.x * h;
    this.pos.z += this.vel.z * h;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.5) this.facing = Math.atan2(this.vel.x, this.vel.z);
  }

  speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }
}
