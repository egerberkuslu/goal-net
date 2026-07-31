import {
  KICK_CHARGE_TIME, PITCH_HALF_L, MATCH_TIME, MATCH_GOALS,
} from '../core/constants.js';
import {
  KeyboardController, P1_KEYS, P1_ALT_KEYS, P1_X_KICK, P2_KEYS,
} from './input.js';
import { BotController, KeeperController } from '../core/ai.js';

const TEAM_NAMES = ['KIRMIZI', 'MAVİ'];

export class Game {
  constructor(world, camera, dom) {
    this.world = world;
    this.camera = camera;
    this.dom = dom;
    this.state = 'menu';
    this.timeScale = 1;
    this.score = [0, 0];
    this.timeLeft = MATCH_TIME;
    this.msgTimer = null;
    this.outTimer = 0;
    this.camZ = 0;

    this.playerRed = world.addPlayer(0);
    this.playerBlue = world.addPlayer(1);
    this.keeperRed = world.addPlayer(0, 'keeper');
    this.keeperBlue = world.addPlayer(1, 'keeper');
    this.chargeState = new Map(); // player -> {held, t}

    dom.btn1p.addEventListener('click', () => this.startMatch('1p'));
    dom.btn2p.addEventListener('click', () => this.startMatch('2p'));
    dom.btnAgain.addEventListener('click', () => this.startMatch(this.mode));
    this.layoutKickoff();
  }

  startMatch(mode) {
    this.mode = mode;
    // 1P: red plays WASD+Space or arrows+X; 2P: arrows belong to blue
    const p1Maps = mode === '2p' ? [P1_KEYS, P1_X_KICK] : [P1_KEYS, P1_ALT_KEYS];
    this.controllers = new Map([
      [this.playerRed, new KeyboardController(p1Maps)],
      [this.playerBlue, mode === '2p'
        ? new KeyboardController(P2_KEYS)
        : new BotController(this.world, this.playerBlue)],
      [this.keeperRed, new KeeperController(this.world, this.keeperRed)],
      [this.keeperBlue, new KeeperController(this.world, this.keeperBlue)],
    ]);
    this.score = [0, 0];
    this.timeLeft = MATCH_TIME;
    this.dom.menu.classList.add('hidden');
    this.dom.end.classList.add('hidden');
    this.updateScoreboard();
    this.kickoff();
  }

  layoutKickoff() {
    this.playerRed.reset(0, -5);
    this.playerBlue.reset(0, 5);
    this.keeperRed.reset(0, -(PITCH_HALF_L - 0.9));
    this.keeperBlue.reset(0, PITCH_HALF_L - 0.9);
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
      if (c.kick && !st.held) { st.held = true; st.t = now; }
      if (st.held) player.charge = Math.min((now - st.t) / KICK_CHARGE_TIME, 1);
      if (!c.kick && st.held) {
        st.held = false;
        const kicked = this.world.tryKick(player, player.charge);
        if (kicked) player.kickAnim = 1;
        player.charge = 0;
      }
      player.kickAnim = Math.max(0, player.kickAnim - dt * 4);
    }
  }

  endMatch() {
    this.state = 'end';
    const [r, b] = this.score;
    this.dom.endTitle.textContent =
      r === b ? 'Berabere!' : `${TEAM_NAMES[r > b ? 0 : 1]} kazandı!`;
    this.dom.endScore.textContent = `${r} — ${b}`;
    this.dom.end.classList.remove('hidden');
  }

  onGoal(scorer, now) {
    this.score[scorer]++;
    this.updateScoreboard();
    this.showMessage('GOOOL!', 'gol', 2200);
    this.timeScale = 0.28;
    this.slowUntil = now + 1.3;
    this.state = 'goal';
    this.goalResetAt = now + 2.8;
  }

  update(dt, now) {
    const playing = this.state === 'play';

    if (this.state === 'kickoff' && now > this.kickoffAt) this.state = 'play';
    if (this.state === 'play' || this.state === 'kickoff') this.applyControls(dt, now);

    for (const e of this.world.drainEvents()) {
      if (e.type === 'goal' && playing) this.onGoal(e.scorer, now);
      else if (e.type === 'post' && playing) this.showMessage('Direk!', 'direk', 900);
      else if (e.type === 'crossbar' && playing) this.showMessage('Üst direk!', 'direk', 900);
    }

    if (playing) {
      this.timeLeft -= dt;
      this.updateScoreboard();
      if (this.timeLeft <= 0) { this.endMatch(); return; }

      // failsafe: the arena is fully enclosed, but if the ball ever glitches
      // out of bounds, quietly drop it back at the centre
      const bp = this.world.ball.pos;
      if ((Math.abs(bp.z) > PITCH_HALF_L + 2.2 || Math.abs(bp.x) > 12) &&
          !this.world.scoringLocked) {
        this.outTimer += dt;
        if (this.outTimer > 1.5) {
          this.outTimer = 0;
          this.world.placeBall(0, 0);
        }
      } else {
        this.outTimer = 0;
      }
    }

    if (this.state === 'goal') {
      if (this.timeScale < 1 && now > this.slowUntil) this.timeScale = 1;
      if (now > this.goalResetAt) {
        if (this.score[0] >= MATCH_GOALS || this.score[1] >= MATCH_GOALS) this.endMatch();
        else this.kickoff();
      }
    }

    // camera: side-on, glides along z with the ball; aimed slightly toward
    // the near touchline so the bottom of the pitch stays in frame
    const b = this.world.ball.pos;
    this.camZ += (b.z * 0.28 - this.camZ) * Math.min(1, dt * 3);
    this.camera.position.set(28, 24.5, this.camZ);
    this.camera.lookAt(2.6, 0.2, this.camZ * 1.2);
  }
}
