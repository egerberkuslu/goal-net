import { Net } from './net.js';
import { Ball } from './ball.js';
import { Player } from './player.js';
import {
  POST_R, BALL_R, CONTACT_CORD_R, BALL_M,
  DT, SUBSTEPS, ITERS,
  PITCH_HALF_L, WALL_X, WALL_Z_BACK,
  PLAYER_R, PLAYER_H,
  KICK_RANGE, KICK_ASSIST, KICK_MIN, KICK_MAX, LOFT_MIN, LOFT_MAX,
  RAGDOLL_SPEED, BOARD_TOP, NET_GRIP, FOUL_BALL_DIST,
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
    // restart possession: only this team may touch the ball (null = anyone).
    // Cleared automatically on their first touch.
    this.restartTeam = null;
    // second half: the teams have changed ends. Every "which way does this
    // team attack" question in the sim goes through attackSign(), so flipping
    // this single flag turns the pitch around for scoring, aim assist, the
    // bots, the keepers and the kickoff layout at once.
    this.sideSwap = false;
    for (let i = 0; i < 50; i++) this.step(DT); // drape the nets
    this.events.length = 0;
  }

  // +1 when this team shoots toward +z, -1 when it shoots toward -z.
  // Red (team 0) attacks +z in the first half and -z after the change of ends.
  attackSign(team) {
    return (team === 0 ? 1 : -1) * (this.sideSwap ? -1 : 1);
  }

  // the team that scores when the ball crosses the goal line at this end
  scorerAt(goalZ) {
    return this.attackSign(0) * Math.sign(goalZ) > 0 ? 0 : 1;
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
      if (this.puppet) {
        // replay playback: ball and players are driven from recorded frames;
        // only the nets simulate, reacting to the scripted ball
        for (let it = 0; it < ITERS; it++) {
          for (const net of this.nets) {
            net.solveConstraints(h);
            if (Math.abs(ball.pos.z - net.goalZ) < 3.5) this.collideBallNet(net);
            net.limitStrain();
          }
        }
        for (const net of this.nets) net.collideGround();
        for (const net of this.nets) net.updateVelocities(h);
        this.events.length = 0;
        continue;
      }
      // Snapshot "was the ball inside the arena" BEFORE anything can move it.
      // The board rebound needs to know where the ball came from, and it must
      // not read ball.prev for that: player depenetration shifts prev along
      // with pos (so contacts inject no velocity), which used to make a shoved
      // ball look like it had always been outside — and a ball nudged into a
      // corner escaped the pitch and stayed there.
      ball.wasInsideX = Math.abs(ball.pos.x) < WALL_X - BALL_R + 0.02;
      ball.wasInsideZ = Math.abs(ball.pos.z) < PITCH_HALF_L - BALL_R + 0.02;
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
      this.enforceRestartZone();
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
      // into goal A: credited to whichever team is attacking this end
      this.events.push({ type: 'goal', scorer: this.scorerAt(-PITCH_HALF_L) });
    } else if (prevZ < PITCH_HALF_L && b.z >= PITCH_HALF_L) {
      this.scoringLocked = true;
      this.events.push({ type: 'goal', scorer: this.scorerAt(PITCH_HALF_L) });
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
            // a tackle that reaches the ball is fair however hard it lands;
            // one that only reaches the man, with the ball nowhere near, is
            // a foul. Measure before the knockdown so the shove cannot move
            // the verdict.
            const wonBall = Math.hypot(this.ball.pos.x - s.pos.x,
              this.ball.pos.z - s.pos.z) <= FOUL_BALL_DIST;
            t.knockDown(s.diveDir.x, s.diveDir.z, 13);
            if (t.down > 0) {
              this.events.push({ type: 'ragdoll', team: t.team });
              // spot of the offence is where the victim went down
              if (!wonBall) {
                this.events.push({
                  type: 'foul', team: t.team, x: t.pos.x, z: t.pos.z,
                });
              }
            }
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

  // FIFA-style exclusion: while a restart belongs to one team, the other team
  // is held out of a ring around the ball (scaled 9.15m -> our pitch).
  enforceRestartZone() {
    if (this.restartTeam === null) return;
    const b = this.ball.pos;
    const R = 3.0;
    const limX = WALL_X - PLAYER_R, limZ = PITCH_HALF_L - PLAYER_R - 0.1;
    for (const p of this.players) {
      if (p.team === this.restartTeam) continue;
      const dx = p.pos.x - b.x, dz = p.pos.z - b.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d >= R) continue;
      const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
      p.pos.x = Math.max(-limX, Math.min(limX, b.x + nx * R));
      p.pos.z = Math.max(-limZ, Math.min(limZ, b.z + nz * R));
      const vn = p.vel.x * nx + p.vel.z * nz;
      if (vn < 0) { p.vel.x -= vn * nx; p.vel.z -= vn * nz; }
    }
  }

  collideBallPlayers() {
    const b = this.ball;
    for (const p of this.players) {
      // during a restart the ball is untouchable for the penalized team
      if (this.restartTeam !== null && p.team !== this.restartTeam) continue;
      // a leap raises the reachable height (raised arms add a bit more)
      const top = PLAYER_H + p.jumpY + (p.jumpY > 0.05 ? 0.45 : 0);
      if (b.pos.y > top) continue;
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
      if (this.restartTeam === p.team) this.restartTeam = null; // restart taken
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

  // Dribble carry: the ball ORBITS the carrier. Its bearing around the player
  // swings toward the input direction at a fixed angular rate, so any change
  // of direction — including a full about-turn — walks the ball around the
  // body to the new front instead of dragging it through the player or
  // abandoning it. Release happens only on a kick / poke (relative-speed
  // spike) or when an opponent gets closer.
  dribbleAssist(h) {
    const b = this.ball;
    if (b.pos.y > 0.5) { this.carrier = null; return; }
    const wants = (p) => Math.hypot(p.vel.x, p.vel.z) > 0.6 ||
                         Math.hypot(p.input.x, p.input.z) > 0.2;
    // the current carrier is sticky: an about-turn briefly opens the gap and
    // the relative speed, and neither may break the hold
    let p = this.carrier;
    let dist = p ? Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z) : Infinity;
    const allowed = (q) => this.restartTeam === null || q.team === this.restartTeam;
    const carrierOk = p && p.down <= 0 && p.dive <= 0 && wants(p) && dist < 2.3 && allowed(p);
    if (!carrierOk) {
      p = null; dist = 1.45;
      for (const q of this.players) {
        if (q.down > 0 || q.dive > 0 || !wants(q) || !allowed(q)) continue;
        const d = Math.hypot(b.pos.x - q.pos.x, b.pos.z - q.pos.z);
        if (d < dist) { dist = d; p = q; }
      }
      if (!p) { this.carrier = null; return; }
    }
    const relX = b.vel.x - p.vel.x, relZ = b.vel.z - p.vel.z;
    const relSp = Math.hypot(relX, relZ);
    // a loose ball must settle before it is carried; a held ball tolerates
    // the transient speeds of a hard turn. A kick blows straight through.
    const held = this.carrier === p;
    if (relSp > (held ? 13 : 4.5)) { this.carrier = null; return; }
    const inv = dist > 1e-4 ? 1 / dist : 0;
    const nx = (b.pos.x - p.pos.x) * inv, nz = (b.pos.z - p.pos.z) * inv;
    // a kick or poke fires the ball radially away much faster than any turn
    if (relX * nx + relZ * nz > (held ? 8 : 4.5)) { this.carrier = null; return; }
    this.carrier = p;

    // desired bearing: input first, then heading, then facing
    let ix = p.input.x, iz = p.input.z;
    const il = Math.hypot(ix, iz);
    if (il < 0.2) {
      const sp = Math.hypot(p.vel.x, p.vel.z);
      if (sp > 0.5) { ix = p.vel.x / sp; iz = p.vel.z / sp; }
      else { ix = Math.sin(p.facing); iz = Math.cos(p.facing); }
    } else { ix /= il; iz /= il; }
    const targetA = Math.atan2(ix, iz);
    const curA = Math.atan2(nx, nz);
    let dA = targetA - curA;
    if (dA > Math.PI) dA -= 2 * Math.PI;
    if (dA < -Math.PI) dA += 2 * Math.PI;
    const maxTurn = 14 * h; // ~0.22s for a full about-turn
    const applied = Math.max(-maxTurn, Math.min(maxTurn, dA));
    const newA = curA + applied;
    // the carry point breathes like real touches: the ball is knocked a
    // little ahead, drops back to the feet, gets knocked on again
    this.touchPhase = (this.touchPhase || 0) + h * (0.9 + Math.hypot(p.vel.x, p.vel.z) * 0.12);
    const R = 0.62 + 0.16 * Math.sin(this.touchPhase * Math.PI * 2);
    const tx = p.pos.x + Math.sin(newA) * R;
    const tz = p.pos.z + Math.cos(newA) * R;
    // the carry point itself moves: player velocity plus the orbital sweep.
    // Feeding that forward lets the ball come AROUND a body that is already
    // accelerating the other way, instead of trailing behind it forever.
    const sweep = (applied / h) * R;
    const ringVx = p.vel.x + Math.cos(newA) * sweep;
    const ringVz = p.vel.z - Math.sin(newA) * sweep;
    const matchK = 10 + Math.min(14, Math.abs(dA) * 10);
    b.vel.x += ((tx - b.pos.x) * 60 + (ringVx - b.vel.x) * matchK) * h;
    b.vel.z += ((tz - b.pos.z) * 60 + (ringVz - b.vel.z) * matchK) * h;
    // turning with the ball scrubs a little pace — and gives the ball the
    // fraction of a second it needs to swing past the body
    if (held && Math.abs(dA) > 1.2) {
      const drag = Math.exp(-2.6 * h);
      p.vel.x *= drag; p.vel.z *= drag;
    }
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
    const wasInsideX = ball.wasInsideX !== false;
    if (belowBoards && wasInsideX) {
      if (bp.x > WALL_X - BALL_R) {
        bp.x = WALL_X - BALL_R;
        ball.contacts.push({ nx: -1, ny: 0, nz: 0, type: 'wall' });
      } else if (bp.x < -(WALL_X - BALL_R)) {
        bp.x = -(WALL_X - BALL_R);
        ball.contacts.push({ nx: 1, ny: 0, nz: 0, type: 'wall' });
      }
    }
    // goal-line boards: solid only clearly OUTSIDE the posts (the visual
    // boards start past the post plus the ball radius; the post capsule
    // guards the strip in between). Starting the wall at the post's inner
    // face used to swallow balls that should have hit the post or gone in.
    const wasInsideZ = ball.wasInsideZ !== false;
    if (belowBoards && wasInsideZ && Math.abs(bp.x) > this.halfW + 0.1) {
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
    const goalZ = this.attackSign(player.team) * PITCH_HALF_L;
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
    let loft = header
      ? 0.03 + 0.12 * charge
      : LOFT_MIN + (LOFT_MAX - LOFT_MIN) * charge;
    // sniper cap: a full-power shot clearly aimed at the goal from close in
    // must not balloon over the bar — cap the loft so the (drag-free) arc
    // still passes under it at the goal plane. Drag only pulls it lower.
    if (!header && dot > 0.5 && gLen < 15) {
      let lo = 0, hi = loft;
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        const t = gLen / (speed * Math.cos(mid));
        const yAt = b.pos.y + speed * Math.sin(mid) * t - 4.905 * t * t;
        // clearance covers the bar capsule + ball radius + a safety margin
        if (yAt > this.config.goalH - 0.45) hi = mid; else lo = mid;
      }
      loft = Math.min(loft, lo);
    }
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
    if (this.restartTeam !== null && player.team !== this.restartTeam) return false;
    const p = this.kickParams(player, charge);
    if (!p) return false;
    const b = this.ball;
    b.vel = { ...p.vel };
    b.omega = { ...p.omega };
    b.grounded = false;
    b.lastTouch = player.team;
    if (this.restartTeam === player.team) this.restartTeam = null; // restart taken
    // where the shot was struck from — the replay only rolls for screamers
    this.lastShot = { x: b.pos.x, z: b.pos.z };
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
