import {
  BALL_R, BALL_M, BALL_A, GRAV, RHO_AIR, CD_BALL,
} from './constants.js';

export class Ball {
  constructor() {
    this.pos = { x: 0, y: BALL_R, z: 11 };
    this.prev = { x: 0, y: BALL_R, z: 11 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.omega = { x: 0, y: 0, z: 0 }; // rad/s, world space
    this.grounded = true;
    this.contacts = []; // static contacts collected this substep
  }

  place(x, z) {
    this.pos = { x, y: BALL_R, z };
    this.prev = { ...this.pos };
    this.vel = { x: 0, y: 0, z: 0 };
    this.omega = { x: 0, y: 0, z: 0 };
    this.grounded = true;
  }

  shoot(vel, omega) {
    this.vel = { ...vel };
    this.omega = { ...omega };
    this.grounded = false;
  }

  accel() {
    const { vel, omega } = this;
    const speed = Math.hypot(vel.x, vel.y, vel.z);
    let ax = 0, ay = -GRAV, az = 0;
    if (speed > 1e-3) {
      const fd = -0.5 * RHO_AIR * CD_BALL * BALL_A * speed / BALL_M;
      ax += fd * vel.x; ay += fd * vel.y; az += fd * vel.z;
      const wMag = Math.hypot(omega.x, omega.y, omega.z);
      if (wMag > 0.5) {
        const cl = 1 / (2 + speed / (BALL_R * wMag));
        // direction of Magnus force: omega x v
        let mx = omega.y * vel.z - omega.z * vel.y;
        let my = omega.z * vel.x - omega.x * vel.z;
        let mz = omega.x * vel.y - omega.y * vel.x;
        const mLen = Math.hypot(mx, my, mz);
        if (mLen > 1e-6) {
          const fm = 0.5 * RHO_AIR * BALL_A * cl * speed * speed / (BALL_M * mLen);
          ax += fm * mx; ay += fm * my; az += fm * mz;
        }
      }
    }
    return { ax, ay, az };
  }

  integrate(h) {
    const { pos, prev, vel } = this;
    const { ax, ay, az } = this.accel();
    vel.x += ax * h; vel.y += ay * h; vel.z += az * h;
    prev.x = pos.x; prev.y = pos.y; prev.z = pos.z;
    pos.x += vel.x * h; pos.y += vel.y * h; pos.z += vel.z * h;
    this.contacts.length = 0;
    // spin decays slowly in the air
    const sd = Math.exp(-0.12 * h);
    this.omega.x *= sd; this.omega.y *= sd; this.omega.z *= sd;
  }

  updateVelocity(h, restGround, restPost) {
    const { pos, prev, vel, omega } = this;
    const inv = 1 / h;
    vel.x = (pos.x - prev.x) * inv;
    vel.y = (pos.y - prev.y) * inv;
    vel.z = (pos.z - prev.z) * inv;

    this.grounded = false;
    for (const c of this.contacts) {
      const vn = vel.x * c.nx + vel.y * c.ny + vel.z * c.nz;
      if (vn < 0) {
        const e = c.type === 'ground' ? restGround : restPost;
        const j = -(1 + e) * vn;
        vel.x += j * c.nx; vel.y += j * c.ny; vel.z += j * c.nz;
        if (c.type === 'ground') {
          // tangential friction + a spin-induced kick on the bounce
          vel.x = vel.x * 0.82 + (omega.z * c.ny - omega.y * c.nz) * BALL_R * 0.25;
          vel.z = vel.z * 0.82 + (omega.y * c.nx - omega.x * c.ny) * BALL_R * 0.25;
          omega.x *= 0.75; omega.y *= 0.75; omega.z *= 0.75;
        }
      }
      if (c.type === 'ground') this.grounded = true;
    }
    if (this.grounded && Math.abs(vel.y) < 0.4) {
      vel.y = Math.max(vel.y, 0);
      const f = Math.max(0, 1 - 2.2 * h); // rolling resistance
      vel.x *= f; vel.z *= f;
    }
  }

  speed() {
    return Math.hypot(this.vel.x, this.vel.y, this.vel.z);
  }
}
