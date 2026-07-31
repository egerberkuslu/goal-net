import { Net } from './net.js';
import { Ball } from './ball.js';
import { Player } from './player.js';
import {
  POST_R, BALL_R, CONTACT_CORD_R, BALL_M,
  DT, SUBSTEPS, ITERS,
  PITCH_HALF_L, WALL_X, WALL_Z_BACK,
  PLAYER_R, PLAYER_H,
  KICK_RANGE, KICK_ASSIST, KICK_MIN, KICK_MAX, LOFT_MIN, LOFT_MAX,
  RAGDOLL_SPEED, BOARD_TOP,
} from './constants.js';
import { makeConfig } from './config.js';

function frameFor(goalZ, halfW, goalH) {
  return [
    { ax: -halfW, ay: 0, az: goalZ, bx: -halfW, by: goalH, bz: goalZ, name: 'post' },
    { ax: halfW, ay: 0, az: goalZ, bx: halfW, by: goalH, bz: goalZ, name: 'post' },
    { ax: -halfW, ay: goalH, az: goalZ, bx: halfW, by: goalH, bz: goalZ, name: 'crossbar' },
  ];
}

// Full arena: two XPBD nets, goal frames, bounded walls (Haxball-style, the
// ball only leaves play through a goal mouth), players and ball in one
// substepped solver loop.
export class World {
  constructor(config = makeConfig()) {
    this.config = config;
    this.halfW = config.goalW / 2;
    this.nets = [
      new Net(config, { goalZ: -PITCH_HALF_L, sign: 1 }),  // goal A, mouth faces +z
      new Net(config, { goalZ: PITCH_HALF_L, sign: -1 }),  // goal B, mouth faces -z
    ];
    this.frames = [
      ...frameFor(-PITCH_HALF_L, this.halfW, config.goalH),
      ...frameFor(PITCH_HALF_L, this.halfW, config.goalH),
    ];
    this.ball = new Ball();
    this.players = [];
    this.time = 0;
    this.events = [];
    this.scoringLocked = false;
    for (let i = 0; i < 50; i++) this.step(DT); // drape the nets
    this.events.length = 0;
  }

  addPlayer(team, role = 'field') {
    const p = new Player(team, role);
    this.players.push(p);
    return p;
  }

  step(dt = DT) {
    const h = dt / SUBSTEPS;
    const { ball } = this;
    for (let s = 0; s < SUBSTEPS; s++) {
      this.time += h;
      const prevBallZ = ball.pos.z;
      for (const net of this.nets) net.integrate(h, this.time);
      ball.integrate(h);
      for (const p of this.players) p.integrate(h);

      for (let it = 0; it < ITERS; it++) {
        for (const net of this.nets) {
          net.solveConstraints(h);
          // skip the expensive contact loop when the ball is far from this net
          if (Math.abs(ball.pos.z - net.goalZ) < 3.5) this.collideBallNet(net);
          net.limitStrain();
        }
      }

      this.collidePlayers();
      this.collideBallPlayers();
      this.collideBallStatic();
      for (const net of this.nets) net.collideGround();
      for (const net of this.nets) net.updateVelocities(h);
      ball.updateVelocity(h);

      this.checkGoal(prevBallZ);
    }
  }

  checkGoal(prevZ) {
    if (this.scoringLocked) return;
    const b = this.ball.pos;
    const inMouth = Math.abs(b.x) < this.halfW - 0.02 && b.y < this.config.goalH - 0.02;
    if (!inMouth) return;
    if (prevZ > -PITCH_HALF_L && b.z <= -PITCH_HALF_L) {
      this.scoringLocked = true;
      this.events.push({ type: 'goal', scorer: 1 }); // into goal A -> blue scores
    } else if (prevZ < PITCH_HALF_L && b.z >= PITCH_HALF_L) {
      this.scoringLocked = true;
      this.events.push({ type: 'goal', scorer: 0 }); // into goal B -> red scores
    }
  }

  collidePlayers() {
    const ps = this.players;
    // player vs player: positional half-half separation
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const rSum = PLAYER_R * 2;
        if (d >= rSum || d < 1e-6) continue;
        const push = (rSum - d) / (2 * d);
        a.pos.x -= dx * push; a.pos.z -= dz * push;
        b.pos.x += dx * push; b.pos.z += dz * push;
      }
    }
    // pitch bounds: players stay on the field, off the nets
    const limX = WALL_X - PLAYER_R, limZ = PITCH_HALF_L - PLAYER_R - 0.1;
    for (const p of ps) {
      p.pos.x = Math.max(-limX, Math.min(limX, p.pos.x));
      p.pos.z = Math.max(-limZ, Math.min(limZ, p.pos.z));
    }
  }

  collideBallPlayers() {
    const b = this.ball;
    if (b.pos.y > PLAYER_H) return;
    for (const p of this.players) {
      const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      // a diving keeper is stretched out: much wider reach while airborne
      const reach = p.dive > 0 ? 0.85 : PLAYER_R;
      const rSum = BALL_R + reach;
      if (d >= rSum || d < 1e-6) continue;
      const nx = dx / d, nz = dz / d;
      const pen = rSum - d;
      b.pos.x += nx * pen; b.pos.z += nz * pen;
      b.contacts.push({ nx, ny: 0, nz, type: 'player', cvx: p.vel.x, cvz: p.vel.z });
      b.lastTouch = p.team;
      // a screamer flattens whoever it hits
      const relX = b.vel.x - p.vel.x, relZ = b.vel.z - p.vel.z;
      const relSp = Math.sqrt(relX * relX + relZ * relZ);
      if (relSp > RAGDOLL_SPEED && p.down <= 0) {
        p.knockDown(relX / relSp, relZ / relSp, relSp);
        this.events.push({ type: 'ragdoll', team: p.team });
      }
    }
  }

  collideBallStatic() {
    const { ball } = this;
    const bp = ball.pos;
    if (bp.y < BALL_R) {
      bp.y = BALL_R;
      ball.contacts.push({ nx: 0, ny: 1, nz: 0, type: 'ground' });
    }
    // ad boards are the walls, and they are LOW: only a ball below the board
    // top rebounds — anything higher sails out (throw-in / goal kick, handled
    // by the game layer)
    // Boards rebound ONLY balls that were inside on the previous substep:
    // a ball that sailed over them and came down outside stays outside, so
    // the game layer can award the throw-in / goal kick / corner.
    const belowBoards = bp.y < BOARD_TOP;
    const wasInsideX = Math.abs(ball.prev.x) < WALL_X - BALL_R + 0.02;
    if (belowBoards && wasInsideX) {
      if (bp.x > WALL_X - BALL_R) {
        bp.x = WALL_X - BALL_R;
        ball.contacts.push({ nx: -1, ny: 0, nz: 0, type: 'wall' });
      } else if (bp.x < -(WALL_X - BALL_R)) {
        bp.x = -(WALL_X - BALL_R);
        ball.contacts.push({ nx: 1, ny: 0, nz: 0, type: 'wall' });
      }
    }
    // goal-line boards: solid outside the goal mouth, open inside it (goal!),
    // open above board height, and never pulling an already-out ball back
    const wasInsideZ = Math.abs(ball.prev.z) < PITCH_HALF_L - BALL_R + 0.02;
    if (belowBoards && wasInsideZ && Math.abs(bp.x) > this.halfW - 0.05) {
      if (bp.z > PITCH_HALF_L - BALL_R) {
        bp.z = PITCH_HALF_L - BALL_R;
        ball.contacts.push({ nx: 0, ny: 0, nz: -1, type: 'wall' });
      } else if (bp.z < -(PITCH_HALF_L - BALL_R)) {
        bp.z = -(PITCH_HALF_L - BALL_R);
        ball.contacts.push({ nx: 0, ny: 0, nz: 1, type: 'wall' });
      }
    }
    // safety wall far behind the nets
    if (bp.z > WALL_Z_BACK) {
      bp.z = WALL_Z_BACK;
      ball.contacts.push({ nx: 0, ny: 0, nz: -1, type: 'wall' });
    } else if (bp.z < -WALL_Z_BACK) {
      bp.z = -WALL_Z_BACK;
      ball.contacts.push({ nx: 0, ny: 0, nz: 1, type: 'wall' });
    }
    // goal frames
    for (const seg of this.frames) {
      if (Math.abs(bp.z - seg.az) > 1) continue;
      const ex = seg.bx - seg.ax, ey = seg.by - seg.ay, ez = seg.bz - seg.az;
      const px = bp.x - seg.ax, py = bp.y - seg.ay, pz = bp.z - seg.az;
      const ee = ex * ex + ey * ey + ez * ez;
      let t = (px * ex + py * ey + pz * ez) / ee;
      t = Math.max(0, Math.min(1, t));
      const qx = seg.ax + ex * t, qy = seg.ay + ey * t, qz = seg.az + ez * t;
      let nx = bp.x - qx, ny = bp.y - qy, nz = bp.z - qz;
      const d = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const rSum = BALL_R + POST_R;
      if (d >= rSum || d < 1e-9) continue;
      nx /= d; ny /= d; nz /= d;
      const pen = rSum - d;
      bp.x += nx * pen; bp.y += ny * pen; bp.z += nz * pen;
      ball.contacts.push({ nx, ny, nz, type: seg.name });
      this.events.push({ type: seg.name });
    }
  }

  collideBallNet(net) {
    const { ball } = this;
    const { pos, prev, invMass } = net;
    const bp = ball.pos;
    const wBall = 1 / BALL_M;
    const rSum = BALL_R + CONTACT_CORD_R;
    const reach = rSum + 0.25;

    for (const group of net.collidable) {
      const { ids, n } = group;
      for (let c = 0; c < n; c++) {
        const a = ids[c * 2], b = ids[c * 2 + 1];
        const oa = a * 3, ob = b * 3;
        const ax = pos[oa], ay = pos[oa + 1], az = pos[oa + 2];
        if (Math.abs(ax - bp.x) > reach || Math.abs(ay - bp.y) > reach ||
            Math.abs(az - bp.z) > reach) continue;
        const bx = pos[ob], by = pos[ob + 1], bz = pos[ob + 2];
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
        // contact friction: knots grip the ball, cords don't slide off it
        for (const [idx, sBary] of [[a, 1 - t], [b, t]]) {
          if (invMass[idx] === 0 || sBary < 0.05) continue;
          const o = idx * 3, k = 0.5 * sBary;
          prev[o] += (pos[o] - prev[o]) * k;
          prev[o + 1] += (pos[o + 1] - prev[o + 1]) * k;
          prev[o + 2] += (pos[o + 2] - prev[o + 2]) * k;
        }
      }
    }
  }

  // Kick parameters for a player at the current instant, or null when the
  // ball is out of reach. Direction is from the player centre through the
  // ball; charge raises both power and loft; the player's sideways motion
  // puts curl on the ball (feeds the Magnus force). Shared by the actual
  // kick and the aim preview so they can never disagree.
  kickParams(player, charge, rangeBonus = 0) {
    const b = this.ball;
    if (b.pos.y > 1.2) return null;
    const dx = b.pos.x - player.pos.x, dz = b.pos.z - player.pos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > KICK_RANGE + BALL_R + rangeBonus || d < 1e-6) return null;
    let dirX = dx / d, dirZ = dz / d;
    // aim assist: when the kick already points roughly at the opponent goal,
    // pull it toward the centre of the frame (the preview shares this math)
    const goalZ = (player.team === 0 ? 1 : -1) * PITCH_HALF_L;
    let gx = -b.pos.x, gz = goalZ - b.pos.z;
    const gLen = Math.sqrt(gx * gx + gz * gz) || 1;
    gx /= gLen; gz /= gLen;
    const dot = dirX * gx + dirZ * gz;
    if (dot > 0.45) {
      const a = KICK_ASSIST * dot;
      dirX = dirX * (1 - a) + gx * a;
      dirZ = dirZ * (1 - a) + gz * a;
      const dLen = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
      dirX /= dLen; dirZ /= dLen;
    }
    const speed = KICK_MIN + (KICK_MAX - KICK_MIN) * charge;
    const loft = LOFT_MIN + (LOFT_MAX - LOFT_MIN) * charge;
    const cosL = Math.cos(loft), sinL = Math.sin(loft);
    const lateral = dirX * player.vel.z - dirZ * player.vel.x;
    const back = 5 + loft * 25;
    return {
      vel: { x: dirX * cosL * speed, y: sinL * speed, z: dirZ * cosL * speed },
      omega: { x: -dirZ * back, y: lateral * 7, z: dirX * back },
    };
  }

  tryKick(player, charge) {
    const p = this.kickParams(player, charge);
    if (!p) return false;
    const b = this.ball;
    b.vel = { ...p.vel };
    b.omega = { ...p.omega };
    b.grounded = false;
    b.lastTouch = player.team;
    this.events.push({ type: 'kick', team: player.team });
    return true;
  }

  placeBall(x, z) {
    this.ball.place(x, z);
    this.scoringLocked = false;
  }

  drainEvents() {
    const ev = this.events.slice();
    this.events.length = 0;
    return ev;
  }
}
