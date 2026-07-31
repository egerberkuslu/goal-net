import { Net } from './net.js';
import { Ball } from './ball.js';
import {
  GOAL_W, GOAL_H, POST_R, BALL_R, CONTACT_CORD_R, BALL_M,
  DT, SUBSTEPS, ITERS, REST_GROUND, REST_POST,
} from './constants.js';

const HALF_W = GOAL_W / 2;
// goal frame as capsules: two posts + crossbar
const FRAME = [
  { ax: -HALF_W, ay: 0, az: 0, bx: -HALF_W, by: GOAL_H, bz: 0, name: 'post' },
  { ax: HALF_W, ay: 0, az: 0, bx: HALF_W, by: GOAL_H, bz: 0, name: 'post' },
  { ax: -HALF_W, ay: GOAL_H, az: 0, bx: HALF_W, by: GOAL_H, bz: 0, name: 'crossbar' },
];

export class World {
  constructor() {
    this.net = new Net();
    this.ball = new Ball();
    this.time = 0;
    this.events = [];
    this.netTouched = false;
    // let the net drape into its natural rest shape before first render
    for (let i = 0; i < 70; i++) this.step(DT);
    this.events.length = 0;
  }

  step(dt = DT) {
    const h = dt / SUBSTEPS;
    const { net, ball } = this;
    for (let s = 0; s < SUBSTEPS; s++) {
      this.time += h;
      net.integrate(h, this.time);
      ball.integrate(h);
      for (let it = 0; it < ITERS; it++) {
        net.solveConstraints(h);
        this.collideBallNet();
        net.limitStrain();
      }
      net.collideGround();
      this.collideBallStatic();
      net.updateVelocities(h);
      ball.updateVelocity(h, REST_GROUND, REST_POST);
    }
  }

  collideBallNet() {
    const { net, ball } = this;
    const { pos, prev, invMass } = net;
    const bp = ball.pos;
    const wBall = 1 / BALL_M;
    const rSum = BALL_R + CONTACT_CORD_R;
    const reach = rSum + 0.25; // broad-phase margin around the ball
    let touched = false;

    for (const group of net.collidable) {
      const { ids, n } = group;
      for (let c = 0; c < n; c++) {
        const a = ids[c * 2], b = ids[c * 2 + 1];
        const oa = a * 3, ob = b * 3;
        const ax = pos[oa], ay = pos[oa + 1], az = pos[oa + 2];
        if (Math.abs(ax - bp.x) > reach || Math.abs(ay - bp.y) > reach ||
            Math.abs(az - bp.z) > reach) continue;
        const bx = pos[ob], by = pos[ob + 1], bz = pos[ob + 2];
        // closest point on segment ab to ball centre
        const ex = bx - ax, ey = by - ay, ez = bz - az;
        const px = bp.x - ax, py = bp.y - ay, pz = bp.z - az;
        const ee = ex * ex + ey * ey + ez * ez;
        let t = ee > 1e-12 ? (px * ex + py * ey + pz * ez) / ee : 0;
        t = Math.max(0, Math.min(1, t));
        const qx = ax + ex * t, qy = ay + ey * t, qz = az + ez * t;
        let nx = bp.x - qx, ny = bp.y - qy, nz = bp.z - qz;
        const d = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (d >= rSum || d < 1e-9) continue;
        nx /= d; ny /= d; nz /= d;
        const pen = rSum - d;
        const wa = invMass[a], wb = invMass[b];
        const denom = wBall + wa * (1 - t) * (1 - t) + wb * t * t;
        const lambda = pen / denom;
        bp.x += nx * lambda * wBall;
        bp.y += ny * lambda * wBall;
        bp.z += nz * lambda * wBall;
        const la = lambda * wa * (1 - t), lb = lambda * wb * t;
        pos[oa] -= nx * la; pos[oa + 1] -= ny * la; pos[oa + 2] -= nz * la;
        pos[ob] -= nx * lb; pos[ob + 1] -= ny * lb; pos[ob + 2] -= nz * lb;
        // contact friction: knots grip the ball, cords don't slide off it.
        // Pull each endpoint's prev toward its pos, bleeding tangential slip.
        for (const [idx, s] of [[a, 1 - t], [b, t]]) {
          if (invMass[idx] === 0 || s < 0.05) continue;
          const o = idx * 3, k = 0.5 * s;
          prev[o] += (pos[o] - prev[o]) * k;
          prev[o + 1] += (pos[o + 1] - prev[o + 1]) * k;
          prev[o + 2] += (pos[o + 2] - prev[o + 2]) * k;
        }
        touched = true;
      }
    }
    if (touched && !this.netTouched) {
      this.netTouched = true;
      this.events.push({ type: 'net' });
    }
  }

  collideBallStatic() {
    const { ball } = this;
    const bp = ball.pos;
    if (bp.y < BALL_R) {
      bp.y = BALL_R;
      ball.contacts.push({ nx: 0, ny: 1, nz: 0, type: 'ground' });
    }
    for (const seg of FRAME) {
      const ex = seg.bx - seg.ax, ey = seg.by - seg.ay, ez = seg.bz - seg.az;
      const px = bp.x - seg.ax, py = bp.y - seg.ay, pz = bp.z - seg.az;
      const ee = ex * ex + ey * ey + ez * ez;
      let t = (px * ex + py * ey + pz * ez) / ee;
      t = Math.max(0, Math.min(1, t));
      const qx = seg.ax + ex * t, qy = seg.ay + ey * t, qz = seg.az + ez * t;
      let nx = bp.x - qx, ny = bp.y - qy, nz = bp.z - qz;
      const d = Math.hypot(nx, ny, nz);
      const rSum = BALL_R + POST_R;
      if (d >= rSum || d < 1e-9) continue;
      nx /= d; ny /= d; nz /= d;
      const pen = rSum - d;
      bp.x += nx * pen; bp.y += ny * pen; bp.z += nz * pen;
      ball.contacts.push({ nx, ny, nz, type: seg.name });
      this.events.push({ type: seg.name });
    }
  }

  placeBall(x, z) {
    this.ball.place(x, z);
    this.netTouched = false;
  }

  shoot(vel, omega) {
    this.ball.shoot(vel, omega);
    this.netTouched = false;
  }

  drainEvents() {
    const ev = this.events.slice();
    this.events.length = 0;
    return ev;
  }
}
