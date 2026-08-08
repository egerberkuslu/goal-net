// Matrix #23 — goal nets as a cosmetic Verlet/XPBD cloth.
//
// The solver is NOT rewritten. packages/client/src/core/net.js already builds
// a parametric goal net (main sheet + two side panels, distance constraints,
// a hard strain limiter, ground friction) and view/netView.js already draws
// every cord of every net in one instanced draw call. Both are imported here
// exactly as the shipping game uses them; neither file is touched.
//
// What is new is the DRIVER, and it is new because the arena's core is not the
// shipping game's world:
//
//   * The deterministic core is two-dimensional and resets the ball to the
//     centre spot on the tick the goal is scored, so the authoritative ball
//     never travels into the net. During play the net is therefore driven
//     READ-ONLY: cords are pushed out of the ball, the ball is never pushed.
//     The cosmetic layer may not write core state, and it does not — the ball
//     arrives as three plain numbers.
//
//   * For the goal celebration a COSMETIC ball carries on from the last
//     authoritative sample and is caught by the net. That ball belongs to this
//     module, so the collision is two-way for it, which is what makes the sheet
//     billow the way a real one does. It is the ball the ball-boy then fetches.
//
// Post-correction (rendering-optimization.md: "ball collision: collision AND
// POST-INTEGRATION correction so the ball does not pass through the net") runs
// after the constraint solve and the strain limiter, so the last thing that
// happens in a frame is the sheet being pushed clear of the ball. That is the
// invariant scripts/atmos-test.mjs asserts.

import { Net } from '../../core/net.js';
import { NetView } from '../../view/netView.js';
import { CONTACT_CORD_R, NET_BOT_DEPTH } from '../../core/constants.js';
import { resolveTier } from './quality.js';

/** How far from a goal line the ball has to be before that net bothers. */
const NEAR_GOAL = 3.5;

/**
 * One cord-vs-ball pass. Mirrors world.collideBallNet() from the shipping
 * game, with one parameter added: when `wBall` is zero the ball is read-only
 * authority and only the cords move.
 *
 * @param {Net} net
 * @param {{x:number,y:number,z:number}} ball centre in metres (never written
 *   unless wBall > 0)
 * @param {number} radius ball radius in metres
 * @param {number} wBall inverse ball mass; 0 keeps the ball untouched
 * @returns {{contacts:number, maxPenetration:number}}
 */
export function collideBallNet(net, ball, radius, wBall) {
  const { pos, prev, invMass } = net;
  const rSum = radius + CONTACT_CORD_R;
  const reach = rSum + 0.25;
  let contacts = 0;
  let maxPen = 0;

  for (const group of net.collidable) {
    const { ids, n } = group;
    for (let c = 0; c < n; c++) {
      const a = ids[c * 2], b = ids[c * 2 + 1];
      const oa = a * 3, ob = b * 3;
      const ax = pos[oa], ay = pos[oa + 1], az = pos[oa + 2];
      if (Math.abs(ax - ball.x) > reach || Math.abs(ay - ball.y) > reach
        || Math.abs(az - ball.z) > reach) continue;
      const bx = pos[ob], by = pos[ob + 1], bz = pos[ob + 2];
      const ex = bx - ax, ey = by - ay, ez = bz - az;
      const px = ball.x - ax, py = ball.y - ay, pz = ball.z - az;
      const ee = ex * ex + ey * ey + ez * ez;
      let t = ee > 1e-12 ? (px * ex + py * ey + pz * ez) / ee : 0;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      const qx = ax + ex * t, qy = ay + ey * t, qz = az + ez * t;
      let nx = ball.x - qx, ny = ball.y - qy, nz = ball.z - qz;
      const d = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (d >= rSum || d < 1e-9) continue;
      nx /= d; ny /= d; nz /= d;
      const pen = rSum - d;
      const wa = invMass[a], wb = invMass[b];
      const denom = wBall + wa * (1 - t) * (1 - t) + wb * t * t;
      if (denom < 1e-12) continue; // both knots pinned and the ball is fixed
      const lambda = pen / denom;
      if (wBall > 0) {
        ball.x += nx * lambda * wBall;
        ball.y += ny * lambda * wBall;
        ball.z += nz * lambda * wBall;
      }
      const la = lambda * wa * (1 - t), lb = lambda * wb * t;
      pos[oa] -= nx * la; pos[oa + 1] -= ny * la; pos[oa + 2] -= nz * la;
      pos[ob] -= nx * lb; pos[ob + 1] -= ny * lb; pos[ob + 2] -= nz * lb;
      // knots grip the ball rather than sliding off it
      for (const [idx, sBary] of [[a, 1 - t], [b, t]]) {
        if (invMass[idx] === 0 || sBary < 0.05) continue;
        const o = idx * 3, k = 0.5 * sBary;
        prev[o] += (pos[o] - prev[o]) * k;
        prev[o + 1] += (pos[o + 1] - prev[o + 1]) * k;
        prev[o + 2] += (pos[o + 2] - prev[o + 2]) * k;
      }
      contacts++;
      if (pen > maxPen) maxPen = pen;
    }
  }
  return { contacts, maxPenetration: maxPen };
}

/**
 * The cosmetic ball that carries on into the net after a goal. It exists only
 * between the goal and the restart, and nothing outside this layer reads it.
 */
export class CosmeticBall {
  constructor(radius) {
    this.radius = radius;
    this.x = 0; this.y = radius; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.active = false;
    this.held = false;   // the ball-boy has picked it up
  }

  /** @param {{x:number,z:number,vx:number,vz:number}} sample metres, m/s */
  launch(sample) {
    this.x = sample.x;
    this.y = this.radius;
    this.z = sample.z;
    this.vx = sample.vx;
    this.vy = 0;
    this.vz = sample.vz;
    this.active = true;
    this.held = false;
  }

  stop() {
    this.active = false;
    this.held = false;
    this.vx = this.vy = this.vz = 0;
  }

  integrate(h) {
    if (!this.active || this.held) return;
    this.vy -= 9.81 * h;
    // Rolling drag as a rate, not a per-substep multiplier: the core's ball
    // sits on the grass by definition, so a per-substep scrub would be applied
    // hundreds of times a second and stop the ball dead a hand's width past
    // the goal line.
    const damp = Math.exp(-1.4 * h);
    this.vx *= damp; this.vz *= damp;
    this.x += this.vx * h;
    this.y += this.vy * h;
    this.z += this.vz * h;
    if (this.y < this.radius) {
      this.y = this.radius;
      const impact = -this.vy;
      if (impact > 1.2) {
        // a real bounce scrubs some pace off; resting on the grass does not
        this.vy = impact * 0.35;
        this.vx *= 0.88; this.vz *= 0.88;
      } else {
        this.vy = 0;
      }
    }
  }
}

/**
 * Both goal nets, their renderer and the cosmetic ball that fills them.
 */
export class ArenaNets {
  /**
   * @param {THREE.Scene|{add:Function, remove?:Function}} scene
   * @param {{goalW:number, goalH:number, goalZ:number, ballRadius:number,
   *          tier?:string|object}} opts
   */
  constructor(scene, opts) {
    const tier = resolveTier(opts.tier);
    this.tier = tier;
    this.scene = scene;
    this.ballRadius = opts.ballRadius;
    this.goalZ = opts.goalZ;
    const config = { goalW: opts.goalW, goalH: opts.goalH };

    this.nets = [
      new Net(config, { goalZ: -opts.goalZ, sign: 1 }),  // mouth faces +z
      new Net(config, { goalZ: opts.goalZ, sign: -1 }),  // mouth faces -z
    ];
    this.rest = this.nets.map((n) => n.pos.slice());
    this.nodeCount = this.nets.reduce((s, n) => s + n.count, 0);

    // The stitch cords are a detail only a high tier pays for; dropping them
    // is a third of the fat-line segments on a phone.
    this.viewProxies = this.nets.map((n) => ({
      pos: n.pos,
      collidable: tier.netStitchCords ? n.collidable : [n.struct],
    }));
    this.view = new NetView(this.viewProxies, scene);
    this.segments = this.view.segCount;

    this.ball = new CosmeticBall(opts.ballRadius);
    this.time = 0;
    this.resets = 0;
    this.lastContacts = 0;
    this.lastMaxPenetration = 0;
    this.lastSolveMs = 0;
  }

  /**
   * @param {number} dt seconds
   * @param {{x:number,y:number,z:number}|null} matchBall the authoritative ball
   *   in metres, read only. Pass null to leave the nets idling.
   */
  update(dt, matchBall) {
    const t0 = nowMs();
    const step = Math.max(0, Math.min(1 / 20, Number.isFinite(dt) ? dt : 0));
    if (step === 0) return;
    this.lastContacts = 0;
    this.lastMaxPenetration = 0;

    const cosmetic = this.ball.active ? this.ball : null;
    // The cosmetic ball, when it exists, is the one the nets react to: it is
    // the ball the viewer can see going in.
    const driver = cosmetic || matchBall;
    const wBall = cosmetic ? 1 : 0;

    // The goals are 36 m apart and the contact gate is 3.5 m, so at most one
    // net is ever in play. Solving them in one loop would integrate the
    // cosmetic ball twice per frame.
    let nearIndex = -1;
    if (driver) {
      for (let i = 0; i < this.nets.length; i++) {
        if (Math.abs(driver.z - this.nets[i].goalZ) < NEAR_GOAL) { nearIndex = i; break; }
      }
    }

    if (nearIndex >= 0) {
      const net = this.nets[nearIndex];
      const substeps = this.tier.netSubsteps;
      const h = step / substeps;
      for (let s = 0; s < substeps; s++) {
        const t = this.time + h * (s + 1);
        net.integrate(h, t);
        if (cosmetic) cosmetic.integrate(h);
        for (let it = 0; it < this.tier.netIters; it++) {
          net.solveConstraints(h);
          this.lastContacts += collideBallNet(net, driver, this.ballRadius, wBall).contacts;
          net.limitStrain();
        }
        net.collideGround();
        net.updateVelocities(h);
      }
      // POST-INTEGRATION correction, and it has to be the LAST thing that
      // touches the sheet. Running the strain limiter or the ground contact
      // after it would push cords straight back into the ball, which is the
      // exact artefact this pass exists to remove.
      const post = collideBallNet(net, driver, this.ballRadius, wBall);
      this.lastMaxPenetration = post.maxPenetration;
      if (!allFinite(net.pos)) this._reset(nearIndex);
    }

    // Every other net just idles: gravity, the breeze and enough relaxation to
    // hold its shape. No contact loop, because nothing is near it.
    for (let i = 0; i < this.nets.length; i++) {
      if (i === nearIndex) continue;
      if (!this.tier.netFarNet && nearIndex >= 0) continue;
      const net = this.nets[i];
      const substeps = this.tier.netIdleSubsteps;
      const h = step / substeps;
      for (let s = 0; s < substeps; s++) {
        net.integrate(h, this.time + h * (s + 1));
        net.solveConstraints(h);
        net.limitStrain();
        net.collideGround();
        net.updateVelocities(h);
      }
      if (!allFinite(net.pos)) this._reset(i);
    }

    this.time += step;
    this.view.update();
    this.lastSolveMs = nowMs() - t0;
  }

  /** Nothing in the sheet may become NaN; if it does, snap back to the rest pose. */
  _reset(index) {
    const net = this.nets[index];
    net.pos.set(this.rest[index]);
    net.prev.set(this.rest[index]);
    net.vel.fill(0);
    this.resets++;
  }

  /**
   * A goal was scored: carry the last authoritative ball sample on into the
   * net so the sheet actually catches something.
   * @param {{x:number,z:number,vx:number,vz:number}} sample metres and m/s
   */
  launchCosmeticBall(sample) {
    this.ball.launch(sample);
  }

  clearCosmeticBall() {
    this.ball.stop();
  }

  stats() {
    return {
      nets: this.nets.length,
      nodes: this.nodeCount,
      segments: this.segments,
      drawCalls: 1,
      contacts: this.lastContacts,
      maxPenetration: this.lastMaxPenetration,
      resets: this.resets,
      solveMs: this.lastSolveMs,
      substeps: this.tier.netSubsteps,
      iters: this.tier.netIters,
      backDepth: NET_BOT_DEPTH,
    };
  }

  dispose() {
    this.view.dispose();
  }
}

function allFinite(arr) {
  for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) return false;
  return true;
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
