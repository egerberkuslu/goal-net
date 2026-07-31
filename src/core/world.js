import { Net } from './net.js';
import { Ball } from './ball.js';
import { Player } from './player.js';
import {
  POST_R, BALL_R, CONTACT_CORD_R, BALL_M,
  DT, SUBSTEPS, ITERS,
  PITCH_HALF_L, WALL_X, WALL_Z_BACK,
  PLAYER_R, PLAYER_H,
  KICK_RANGE, KICK_ASSIST, KICK_MIN, KICK_MAX, LOFT_MIN, LOFT_MAX,
  RAGDOLL_SPEED, BOARD_TOP, NET_GRIP,
} from './constants.js';
import { makeConfig } from './config.js';

// how far behind the goal line the post-goal one-way ratchet still holds the
// ball; deeper than this the ball is free to sag and settle in the pocket
const MOUTH_RATCHET_DEPTH = 0.9;

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

      this.netContact = false;
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
      // cords grip the ball: while in the net, energy drains fast so the
      // shot is swallowed instead of trampolining back onto the pitch
      if (this.netContact) {
        const f = Math.exp(-NET_GRIP * h);
        ball.vel.x *= f; ball.vel.y *= f; ball.vel.z *= f;
        ball.omega.x *= f; ball.omega.y *= f; ball.omega.z *= f;
      }
      this.dribbleAssist(h);

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
    // player vs player: positional half-half separation; a sliding tackle
    // that reaches an opponent takes them down
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
        for (const [s, t] of [[a, b], [b, a]]) {
          if (s.dive > 0 && s.diveKind === 'slide' && s.team !== t.team &&
              t.down <= 0 && t.dive <= 0) {
            t.knockDown(s.diveDir.x, s.diveDir.z, 13);
            if (t.down > 0) this.events.push({ type: 'ragdoll', team: t.team });
          }
        }
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
      // a diving keeper is stretched out: much wider reach while airborne;
      // a slide pokes with the feet, only slightly beyond the body
      const reach = p.dive > 0 ? (p.diveKind === 'slide' ? 0.6 : 0.85) : PLAYER_R;
      const rSum = BALL_R + reach;
      if (d >= rSum || d < 1e-6) continue;
      const nx = dx / d, nz = dz / d;
      const pen = rSum - d;
      // a player peeling away from the ball should leave it, not shove it on:
      // ease the overlap out and drop their velocity from the contact so the
      // ball is not flicked along by a body that is already retreating
      const closing = p.vel.x * nx + p.vel.z * nz; // > 0: running into the ball
      const push = closing < 0 ? Math.min(pen * 0.25, 0.02) : pen;
      // shift prev along with pos: depenetration must not inject velocity
      // (a fast body re-penetrating every substep would pump the ball);
      // the restitution reflect provides the actual bounce
      b.pos.x += nx * push; b.pos.z += nz * push;
      b.prev.x += nx * push; b.prev.z += nz * push;
      b.contacts.push({
        nx, ny: 0, nz, type: 'player',
        cvx: closing < 0 ? 0 : p.vel.x, cvz: closing < 0 ? 0 : p.vel.z,
      });
      b.lastTouch = p.team;
      // a screamer flattens whoever it hits
      const relX = b.vel.x - p.vel.x, relZ = b.vel.z - p.vel.z;
      const relSp = Math.sqrt(relX * relX + relZ * relZ);
      // mid-dive/-slide players are already committed and cannot be floored
      if (relSp > RAGDOLL_SPEED && p.down <= 0 && p.dive <= 0) {
        p.knockDown(relX / relSp, relZ / relSp, relSp);
        this.events.push({ type: 'ragdoll', team: p.team });
      }
    }
  }

  // Dribble assist: while a player runs with the ball at their feet, gently
  // spring it toward a spot just ahead of them so it does not skitter away.
  // Only the nearest carrier gets the pull, and only at controllable speeds.
  // The pull follows where the player STEERS, not where they are drifting, so
  // a curve keeps the ball ahead of the turn while an about-turn lets go of it
  // instead of hauling it backwards.
  dribbleAssist(h) {
    const b = this.ball;
    if (b.pos.y > 0.5) { this.carrier = null; return; }
    let best = null, bestD = 1.4;
    for (const p of this.players) {
      if (p.down > 0 || p.dive > 0) continue;
      if (Math.hypot(p.vel.x, p.vel.z) < 1.2) continue;
      const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (!best) { this.carrier = null; return; }
    const p = best;
    const relX = b.vel.x - p.vel.x, relZ = b.vel.z - p.vel.z;
    const relSp = Math.hypot(relX, relZ);
    // a ball has to settle at the feet before it is carried; once it is, the
    // grip survives the higher relative speeds a turn creates
    const held = this.carrier === p;
    if (relSp > (held ? 10.5 : 4.5)) { this.carrier = null; return; }
    const sp = Math.hypot(p.vel.x, p.vel.z);
    const vx = p.vel.x / sp, vz = p.vel.z / sp;          // heading
    const inv = bestD > 1e-4 ? 1 / bestD : 0;
    const nx = (b.pos.x - p.pos.x) * inv, nz = (b.pos.z - p.pos.z) * inv;
    if (relX * nx + relZ * nz > 4.5) { this.carrier = null; return; } // squirting away
    let ix = p.input.x, iz = p.input.z;
    const il = Math.hypot(ix, iz);
    if (il > 1e-4) { ix /= il; iz /= il; } else { ix = vx; iz = vz; }
    // grip fades out as the intent turns against the run, and as the ball
    // falls behind the direction being asked for
    const turn = ix * vx + iz * vz;   // 1 = straight on, -1 = about-turn
    const ahead = ix * nx + iz * nz;  // 1 = ball in front of the new heading
    const grip = Math.max(0, Math.min(1, (turn + 0.15) / 0.5))
               * Math.max(0, Math.min(1, (ahead + 0.8) / 0.5));
    if (grip <= 0) {
      // let go: bleed the carried momentum so the loose ball is left behind
      // near the turn instead of rocketing off down the pitch
      if (held && relSp < 4.5) {
        const f = Math.exp(-3.5 * h);
        b.vel.x *= f; b.vel.z *= f;
      }
      return;
    }
    this.carrier = p;
    let cx = vx * 0.35 + ix * 0.65, cz = vz * 0.35 + iz * 0.65;
    const cl = Math.hypot(cx, cz) || 1;
    cx /= cl; cz /= cl;
    const tx = p.pos.x + cx * 0.62, tz = p.pos.z + cz * 0.62;
    b.vel.x += ((tx - b.pos.x) * 20 + (p.vel.x - b.vel.x) * 8) * grip * h;
    b.vel.z += ((tz - b.pos.z) * 20 + (p.vel.z - b.vel.z) * 8) * grip * h;
    b.lastTouch = p.team;
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
    // once a goal has been scored the mouth is one-way: the ball stays in the
    // net through the celebration instead of dribbling back onto the pitch.
    // This is a pure ratchet — outward motion inside the mouth band is
    // cancelled, never reversed, so it can only remove energy. (Clamping the
    // ball FORWARD here would act as a velocity pump and ram it through the
    // net sheet.)
    if (this.scoringLocked) {
      const s = bp.z >= 0 ? 1 : -1;
      const depth = s * bp.z - PITCH_HALF_L;          // >0 once inside the net
      const wasDepth = s * ball.prev.z - PITCH_HALF_L;
      const inMouth = Math.abs(bp.x) < this.halfW + BALL_R &&
        bp.y < this.config.goalH + BALL_R;
      if (inMouth && depth < MOUTH_RATCHET_DEPTH && wasDepth > -0.02 &&
          depth < wasDepth) {
        bp.z = ball.prev.z; // freeze the outward slice, no impulse, no push
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
        this.netContact = true;
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
    if (b.pos.y > 2.15) return null;
    // above knee height it becomes a header: shorter reach, less power, flat
    const header = b.pos.y > 1.15;
    const dx = b.pos.x - player.pos.x, dz = b.pos.z - player.pos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const reach = header ? 1.0 : KICK_RANGE;
    if (d > reach + BALL_R + rangeBonus || d < 1e-6) return null;
    let dirX = dx / d, dirZ = dz / d;
    // aim assist: when the kick already points roughly at the opponent goal,
    // pull it toward the centre of the frame (the preview shares this math)
    const goalZ = (player.team === 0 ? 1 : -1) * PITCH_HALF_L;
    let gx = -b.pos.x, gz = goalZ - b.pos.z;
    const gLen = Math.sqrt(gx * gx + gz * gz) || 1;
    gx /= gLen; gz /= gLen;
    const dot = dirX * gx + dirZ * gz;
    if (dot > 0.25) {
      const a = KICK_ASSIST * dot;
      dirX = dirX * (1 - a) + gx * a;
      dirZ = dirZ * (1 - a) + gz * a;
      const dLen = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
      dirX /= dLen; dirZ /= dLen;
    }
    const speed = header
      ? 8 + (KICK_MAX - KICK_MIN) * 0.5 * charge
      : KICK_MIN + (KICK_MAX - KICK_MIN) * charge;
    const loft = header
      ? 0.03 + 0.12 * charge
      : LOFT_MIN + (LOFT_MAX - LOFT_MIN) * charge;
    const cosL = Math.cos(loft), sinL = Math.sin(loft);
    const lateral = dirX * player.vel.z - dirZ * player.vel.x;
    const back = (5 + loft * 25) * (header ? 0.4 : 1);
    return {
      vel: { x: dirX * cosL * speed, y: sinL * speed, z: dirZ * cosL * speed },
      omega: { x: -dirZ * back, y: lateral * 7, z: dirX * back },
      header,
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
    return p.header ? 'header' : true;
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
