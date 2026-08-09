import {
  PLAYER_SPEED, PLAYER_ACCEL_RATE, RAGDOLL_TIME,
  GRAV, JUMP_TAKEOFF_VY, JUMP_COOLDOWN,
} from './constants.js';

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
    this.headerAnim = 0;  // >0 while the head snaps forward
    this.celebrate = 0;   // 1: scored (arms up), -1: conceded (slump)
    this.down = 0;        // ragdoll: seconds until back on their feet
    this.downTotal = RAGDOLL_TIME;
    this.tumbleSpin = 0;
    this.knockCooldown = 0; // hidden immunity so players can't be stun-locked
    this.jumpY = 0;         // vertical leap height (reaching balls over standing reach)
    this.jumpVy = 0;
    this.jumpCooldown = 0;  // dead time on the ground after landing (no instant re-jump)
    this.dive = 0;          // dive/slide: seconds of the action left
    this.diveTotal = 0.55;
    this.diveKind = 'dive'; // 'dive' (keeper flight) | 'slide' (tackle)
    this.diveRecover = 0;   // scramble-up time after the action
    this.diveDir = { x: 1, z: 0 };
    this.shoveCooldown = 0; // shoulder-to-shoulder: dead time before this player can shove/be shoved again
  }

  // Vertical leap: straight up with the arms raised, for balls over the head.
  // No double-jump: blocked while airborne, and again for JUMP_COOLDOWN after
  // landing, so a player can't chain leaps into a permanent extra reach.
  startJump() {
    if (this.jumpY > 0 || this.jumpCooldown > 0 || this.down > 0 || this.dive > 0) return false;
    this.jumpVy = JUMP_TAKEOFF_VY;
    this.jumpY = 0.001;
    return true;
  }

  // Slide tackle: feet-first burst along the given direction. Pokes the ball
  // away through the normal contact, and flattens opponents it runs into.
  startSlide(dx, dz) {
    if (this.dive > 0 || this.diveRecover > 0 || this.down > 0) return false;
    const len = Math.hypot(dx, dz) || 1;
    this.diveDir = { x: dx / len, z: dz / len };
    this.diveKind = 'slide';
    this.dive = this.diveTotal = 0.6;
    this.vel.x += this.diveDir.x * 7.5;
    this.vel.z += this.diveDir.z * 7.5;
    this.facing = Math.atan2(this.diveDir.x, this.diveDir.z);
    this.charge = 0;
    return true;
  }

  // Keeper dive: a sideways burst with the body stretched out. No steering
  // mid-air; short recovery after landing.
  startDive(dx, dz, power = 8.5) {
    if (this.dive > 0 || this.diveRecover > 0 || this.down > 0) return false;
    const len = Math.hypot(dx, dz) || 1;
    this.diveDir = { x: dx / len, z: dz / len };
    this.diveKind = 'dive';
    this.dive = this.diveTotal = 0.55;
    this.vel.x += this.diveDir.x * power;
    this.vel.z += this.diveDir.z * power;
    this.charge = 0;
    return true;
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
    this.dive = 0;
    this.diveRecover = 0;
    this.jumpY = 0;
    this.jumpVy = 0;
    this.jumpCooldown = 0;
    this.shoveCooldown = 0;
    this.celebrate = 0;
  }

  // A fast ball flattens the player: thrown along the ball's travel
  // direction, no control until they scramble back up.
  knockDown(dirX, dirZ, speed) {
    if (this.down > 0 || this.knockCooldown > 0) return;
    this.knockCooldown = 6;
    this.dive = 0;
    this.diveRecover = 0;
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
    this.jumpCooldown = Math.max(0, this.jumpCooldown - h);
    this.shoveCooldown = Math.max(0, this.shoveCooldown - h);
    if (this.jumpY > 0) {
      this.jumpY += this.jumpVy * h;
      this.jumpVy -= GRAV * h;
      if (this.jumpY <= 0) {
        this.jumpY = 0; this.jumpVy = 0;
        this.jumpCooldown = JUMP_COOLDOWN; // just landed: no instant re-jump
      }
    }
    if (this.down > 0) {
      this.down = Math.max(0, this.down - h);
      const f = Math.exp(-2.2 * h); // slide across the grass
      this.vel.x *= f; this.vel.z *= f;
    } else if (this.dive > 0) {
      this.dive = Math.max(0, this.dive - h);
      if (this.dive === 0) this.diveRecover = 0.45;
      const f = Math.exp(-1.4 * h); // glide through the dive
      this.vel.x *= f; this.vel.z *= f;
    } else if (this.diveRecover > 0) {
      this.diveRecover = Math.max(0, this.diveRecover - h);
      const f = Math.exp(-6 * h); // getting up, barely moving
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
