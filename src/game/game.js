import {
  KICK_CHARGE_TIME, PITCH_HALF_L, WALL_X, BALL_R,
} from '../core/constants.js';
import {
  KeyboardController, P1_KEYS, P1_ALT_KEYS, P1_X_KICK, P2_KEYS,
} from './input.js';
import { BotController, KeeperController } from '../core/ai.js';

const TEAM_NAMES = ['KIRMIZI', 'MAVİ'];

// Default roster: one field player per team plus (config permitting) keepers.
function defaultRoster(config) {
  const roster = [
    { id: 'p1', team: 0, role: 'field' },
    { id: 'p2', team: 1, role: 'field' },
  ];
  if (config.keepers) {
    roster.push({ id: 'kr', team: 0, role: 'keeper' }, { id: 'kb', team: 1, role: 'keeper' });
  }
  return roster;
}

export class Game {
  constructor(world, camera, dom, roster = null) {
    this.world = world;
    this.camera = camera;
    this.dom = dom;
    this.state = 'menu';
    this.timeScale = 1;
    this.score = [0, 0];
    this.timeLeft = world.config.matchTime;
    this.msgTimer = null;
    this.outTimer = 0;
    this.camZ = 0;
    this.cam = { x: 28, y: 24.5, z: 0, lx: 2.6, ly: 0.2, lz: 0 };

    this.byId = new Map();
    for (const entry of roster ?? defaultRoster(world.config)) {
      const p = world.addPlayer(entry.team, entry.role ?? 'field');
      p.mpId = entry.id;
      this.byId.set(entry.id, p);
    }
    this.playerRed = world.players.find((p) => p.team === 0 && p.role === 'field') ?? null;
    this.playerBlue = world.players.find((p) => p.team === 1 && p.role === 'field') ?? null;
    this.keepers = world.players.filter((p) => p.role === 'keeper');
    this.chargeState = new Map(); // player -> {held, t}
    this.layoutKickoff();
  }

  startMatch(mode) {
    this.mode = mode;
    // 1P: red plays WASD+Space or arrows+X; 2P: arrows belong to blue
    const p1Maps = mode === '2p' ? [P1_KEYS, P1_X_KICK] : [P1_KEYS, P1_ALT_KEYS];
    const controllers = new Map([[this.playerRed, new KeyboardController(p1Maps)]]);
    if (this.playerBlue) {
      controllers.set(this.playerBlue, mode === '2p'
        ? new KeyboardController(P2_KEYS)
        : new BotController(this.world, this.playerBlue));
    }
    for (const k of this.keepers) controllers.set(k, new KeeperController(this.world, k));
    this.beginMatch(controllers, mode);
  }

  // Shared by local play and the multiplayer host: start with an explicit
  // player -> controller map.
  beginMatch(controllers, mode = this.mode) {
    this.mode = mode;
    this.controllers = controllers;
    this.score = [0, 0];
    this.timeLeft = this.world.config.matchTime;
    this.dom.menu.classList.add('hidden');
    this.dom.end.classList.add('hidden');
    this.updateScoreboard();
    this.kickoff();
  }

  layoutKickoff() {
    const spread = [0, -2.4, 2.4];
    for (const team of [0, 1]) {
      const sign = team === 0 ? -1 : 1;
      const fields = this.world.players.filter((p) => p.team === team && p.role === 'field');
      fields.forEach((p, i) => p.reset(spread[i % spread.length], sign * 5));
      for (const k of this.keepers.filter((p) => p.team === team)) {
        k.reset(0, sign * (PITCH_HALF_L - 0.9));
      }
    }
    this.world.placeBall(0, 0);
    this.chargeState.clear();
  }

  kickoff() {
    this.layoutKickoff();
    this.timeScale = 1;
    this.state = 'kickoff';
    this.kickoffAt = performance.now() / 1000 + 1.1;
    this.showMessage('Hazır…', 'hazir', 1000);
  }

  showMessage(text, cls, ms = 1600) {
    const m = this.dom.msg;
    m.textContent = text;
    m.className = `hud show ${cls}`;
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { m.className = 'hud'; }, ms);
  }

  isHuman(player) {
    return !!this.controllers && this.controllers.get(player) instanceof KeyboardController;
  }

  updateScoreboard() {
    this.dom.scoreRed.textContent = this.score[0];
    this.dom.scoreBlue.textContent = this.score[1];
    if (this.mode === 'train') {
      this.dom.timer.textContent = '∞';
      return;
    }
    const t = Math.max(0, Math.ceil(this.timeLeft));
    this.dom.timer.textContent =
      `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }

  applyControls(dt, now) {
    for (const [player, ctrl] of this.controllers) {
      const c = ctrl.update(dt);
      player.input.x = c.x; player.input.z = c.z;

      let st = this.chargeState.get(player);
      if (!st) { st = { held: false, t: 0 }; this.chargeState.set(player, st); }
      if (player.down > 0) { // floored players can't kick
        st.held = false;
        player.charge = 0;
        player.kickAnim = Math.max(0, player.kickAnim - dt * 4);
        continue;
      }
      // slide tackle on key edge, along current intent (or facing when idle)
      if (c.slide && !st.slideHeld) {
        const ix = c.x || Math.sin(player.facing), iz = c.z || Math.cos(player.facing);
        player.startSlide(ix, iz);
      }
      st.slideHeld = !!c.slide;
      if (c.kick && !st.held) { st.held = true; st.t = now; }
      if (st.held) player.charge = Math.min((now - st.t) / KICK_CHARGE_TIME, 1);
      if (!c.kick && st.held) {
        st.held = false;
        const kicked = this.world.tryKick(player, player.charge);
        if (kicked === 'header') player.headerAnim = 1;
        else if (kicked) player.kickAnim = 1;
        player.charge = 0;
      }
      player.kickAnim = Math.max(0, player.kickAnim - dt * 4);
      player.headerAnim = Math.max(0, player.headerAnim - dt * 5);
    }
  }

  endMatch() {
    this.state = 'end';
    const [r, b] = this.score;
    this.dom.endTitle.textContent =
      r === b ? 'Berabere!' : `${TEAM_NAMES[r > b ? 0 : 1]} kazandı!`;
    this.dom.endScore.textContent = `${r} — ${b}`;
    this.dom.end.classList.remove('hidden');
    this.onMatchEnd?.();
  }

  onGoal(scorer, now) {
    this.score[scorer]++;
    this.updateScoreboard();
    this.showMessage('GOOOL!', 'gol', 2600);
    // long slow-motion with the goal camera: the net billowing IS the show
    this.timeScale = 0.3;
    this.slowUntil = now + 2.2;
    this.state = 'goal';
    this.goalResetAt = now + 4.6;
  }

  update(dt, now) {
    const playing = this.state === 'play';

    if (this.state === 'kickoff' && now > this.kickoffAt) this.state = 'play';
    if (this.state === 'play' || this.state === 'kickoff') this.applyControls(dt, now);

    for (const e of this.world.drainEvents()) {
      this.onWorldEvent?.(e, playing);
      if (e.type === 'goal' && playing) this.onGoal(e.scorer, now);
      else if (e.type === 'post' && playing) this.showMessage('Direk!', 'direk', 900);
      else if (e.type === 'crossbar' && playing) this.showMessage('Üst direk!', 'direk', 900);
    }

    if (playing && this.mode !== 'train') {
      this.timeLeft -= dt;
      this.updateScoreboard();
      if (this.timeLeft <= 0) { this.endMatch(); return; }
    }
    if (playing) {
      // outs: the boards are low, so a high ball can leave the pitch.
      // Over a touchline -> throw-in from where it went out; over the goal
      // line / the goal -> goal kick.
      const bp = this.world.ball.pos;
      if (Math.abs(bp.x) > WALL_X + BALL_R) {
        const side = Math.sign(bp.x);
        const z = Math.max(-PITCH_HALF_L + 2, Math.min(PITCH_HALF_L - 2, bp.z));
        this.world.placeBall(side * (WALL_X - 1.2), z);
        this.showMessage('Taç!', 'kacti', 1000);
        this.onWorldEvent?.({ type: 'throwin' }, true);
        this.outTimer = 0;
      } else if (Math.abs(bp.z) > PITCH_HALF_L + 0.2 && !this.world.scoringLocked) {
        // the whole end line is out of play: anything that clears the boards
        // without being a goal restarts immediately — corner if the defender
        // touched it last, goal kick otherwise
        const s = Math.sign(bp.z);
        const defender = s > 0 ? 1 : 0;
        if (this.world.ball.lastTouch === defender) {
          const cx = (Math.sign(bp.x) || 1) * 10.6;
          this.world.placeBall(cx, s * (PITCH_HALF_L - 0.4));
          this.showMessage('Korner!', 'direk', 1000);
          this.onWorldEvent?.({ type: 'corner' }, true);
        } else {
          this.world.placeBall(0, s * (PITCH_HALF_L - 3.2));
          this.showMessage('Kale vuruşu!', 'kacti', 1000);
          this.onWorldEvent?.({ type: 'goalkick' }, true);
        }
      }
    }

    if (this.state === 'goal') {
      if (this.timeScale < 1 && now > this.slowUntil) this.timeScale = 1;
      if (now > this.goalResetAt) {
        const limit = this.world.config.goalLimit; // 0 = unlimited, time decides
        if (this.mode !== 'train' && limit > 0 &&
            (this.score[0] >= limit || this.score[1] >= limit)) this.endMatch();
        else this.kickoff();
      }
    }

    // camera: side-on, glides along z with the ball; on a goal it swoops in
    // low next to the net so the slow-motion billow fills the screen
    const b = this.world.ball.pos;
    this.camZ += (b.z * 0.28 - this.camZ) * Math.min(1, dt * 3);
    let t;
    if (this.state === 'goal') {
      const s = Math.sign(b.z) || 1;
      t = { x: 8.5, y: 2.8, z: s * 12.6, lx: b.x * 0.8, ly: 1.0, lz: s * 17.6 };
    } else {
      t = { x: 28, y: 24.5, z: this.camZ, lx: 2.6, ly: 0.2, lz: this.camZ * 1.2 };
    }
    const k = Math.min(1, dt * 3.2);
    const c = this.cam;
    for (const key of ['x', 'y', 'z', 'lx', 'ly', 'lz']) c[key] += (t[key] - c[key]) * k;
    this.camera.position.set(c.x, c.y, c.z);
    this.camera.lookAt(c.lx, c.ly, c.lz);
  }
}
