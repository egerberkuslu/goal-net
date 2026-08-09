import {
  KICK_CHARGE_TIME, PITCH_HALF_L, WALL_X, BALL_R,
  BOX_HALF_W, BOX_DEPTH, PENALTY_SPOT_INSET,
  SETPIECE_FREEZE, SETPIECE_TIMEOUT, HALF_BREAK, GOLDEN_MAX,
} from '../core/constants.js';
import {
  KeyboardController, P1_KEYS, P1_ALT_KEYS, P1_X_KICK, P2_KEYS,
} from './input.js';
import { BotController, KeeperController } from '../core/ai.js';
import { CameraRig } from '../view/cameraRig.js';
import { MatchStats } from './stats.js';

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
  /**
   * @param {object} world
   * @param {THREE.Camera} camera
   * @param {object} dom the HUD nodes
   * @param {object[]|null} roster
   * @param {THREE.Scene|null} scene only so the in-ground scoreboard can be fed
   *   the same numbers the HUD gets; nothing here draws.
   */
  constructor(world, camera, dom, roster = null, scene = null) {
    this.world = world;
    this.camera = camera;
    this.scene = scene;
    this.dom = dom;
    this.state = 'menu';
    this.timeScale = 1;
    this.score = [0, 0];
    this.halfLength = world.config.matchTime / 2;
    this.timeLeft = this.halfLength;
    this.half = 1;
    this.golden = false;
    this.setPiece = null;   // {kind, team, kicker, keeper, live, deadline}
    this.frozenUntil = 0;   // ceremonies where nobody may move
    this.stats = new MatchStats();
    this.msgTimer = null;
    this.setPieceMsgTimer = null;
    this.outTimer = 0;
    this.rig = new CameraRig(camera);

    this.byId = new Map();
    for (const entry of roster ?? defaultRoster(world.config)) {
      const p = world.addPlayer(entry.team, entry.role ?? 'field');
      p.mpId = entry.id;
      p.mpName = entry.name ?? '';
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
    this.halfLength = this.world.config.matchTime / 2;
    this.timeLeft = this.halfLength;
    this.half = 1;
    this.golden = false;
    this.setPiece = null;
    this.frozenUntil = 0;
    this.kickoffTeam = null; // opening kickoff is free
    this.world.sideSwap = false; // first half: red attacks +z
    this.applyAttackSigns();
    this.stats.reset();
    this.dom.menu.classList.add('hidden');
    this.dom.end.classList.add('hidden');
    this.updateScoreboard();
    this.kickoff();
  }

  // The bots and keepers cache which way they attack. After a change of ends
  // the cache is stale, so it is refreshed from the world rather than by
  // rebuilding the controllers (which would drop their timers and cooldowns).
  applyAttackSigns() {
    if (!this.controllers) return;
    for (const [player, ctrl] of this.controllers) {
      if (!ctrl || typeof ctrl.attackSign !== 'number') continue;
      ctrl.attackSign = this.world.attackSign(player.team);
      if (typeof ctrl.guardZ === 'number') {
        ctrl.guardZ = -ctrl.attackSign * (PITCH_HALF_L - 0.9);
      }
    }
  }

  layoutKickoff() {
    const spread = [0, -2.4, 2.4];
    for (const team of [0, 1]) {
      const sign = -this.world.attackSign(team); // line up in your own half
      const fields = this.world.players.filter((p) => p.team === team && p.role === 'field');
      fields.forEach((p, i) => p.reset(spread[i % spread.length], sign * 5));
      for (const k of this.keepers.filter((p) => p.team === team)) {
        k.reset(0, sign * (PITCH_HALF_L - 0.9));
      }
    }
    this.world.placeBall(0, 0);
    this.world.restartTeam = null;
    this.chargeState.clear();
  }

  kickoff() {
    this.layoutKickoff();
    this.setPiece = null;
    this.timeScale = 1;
    this.state = 'kickoff';
    this.kickoffAt = performance.now() / 1000 + 1.1;
    // after a goal the CONCEDING team restarts: the scorers cannot touch the
    // ball and are held outside the centre circle until the first touch
    if (this.kickoffTeam != null) {
      this.world.restartTeam = this.kickoffTeam;
      this.restartClearAt = performance.now() / 1000 + 6;
      this.kickoffTeam = null;
    }
    this.showMessage('Hazır…', 'hazir', 1000);
  }

  // Every restart: one mandatory frozen second for everyone, then only the
  // team the restart belongs to may touch the ball (the other side is also
  // held out of a FIFA-style ring by the physics). A timeout stops stalling.
  beginRestart(now, team) {
    this.restartFreezeUntil = now + 1.0;
    this.world.restartTeam = team ?? null;
    this.restartClearAt = now + 6;
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

  // ---------------------------------------------------------------- fouls

  // Nearest field player of a team to a point (a keeper only if nobody else).
  nearestOf(team, x, z) {
    let best = null, bestD = Infinity;
    for (const pass of ['field', 'any']) {
      for (const p of this.world.players) {
        if (p.team !== team) continue;
        if (pass === 'field' && p.role !== 'field') continue;
        const d = Math.hypot(p.pos.x - x, p.pos.z - z);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (best) return best;
    }
    return best;
  }

  // A slide that took the man and not the ball. The restart is a penalty when
  // it happened inside the box the offender defends, a free kick otherwise.
  onFoul(e, now) {
    const offender = 1 - e.team;
    this.stats.foul(offender);
    const ownGoalZ = -this.world.attackSign(offender) * PITCH_HALF_L;
    const inBox = Math.abs(e.x) < BOX_HALF_W &&
      Math.abs(e.z - ownGoalZ) < BOX_DEPTH;
    if (inBox) this.awardPenalty(e.team, Math.sign(ownGoalZ), now);
    else this.awardFreeKick(e.team, e.x, e.z, now);
  }

  awardFreeKick(team, x, z, now) {
    const bx = Math.max(-(WALL_X - 1.2), Math.min(WALL_X - 1.2, x));
    const bz = Math.max(-(PITCH_HALF_L - 1.2), Math.min(PITCH_HALF_L - 1.2, z));
    this.world.placeBall(bx, bz);
    const kicker = this.nearestOf(team, bx, bz);
    // the taker stands behind the ball, facing the goal they attack
    const sign = this.world.attackSign(team);
    if (kicker) { kicker.reset(bx, bz - sign * 0.9); kicker.facing = sign > 0 ? 0 : Math.PI; }
    this.beginSetPiece('freekick', team, kicker, null, now);
    this.onWorldEvent?.({ type: 'freekick', team }, true);
    this.announce('Serbest vuruş!', 'direk');
  }

  awardPenalty(team, goalSide, now) {
    const spotZ = goalSide * (PITCH_HALF_L - PENALTY_SPOT_INSET);
    const goalZ = goalSide * PITCH_HALF_L;
    this.world.placeBall(0, spotZ);
    const kicker = this.nearestOf(team, 0, spotZ);
    const keeper = this.keepers.find((k) => k.team === 1 - team) ?? null;
    // everybody else clears the area, in a line on the field side of it
    const outZ = goalSide * (PITCH_HALF_L - BOX_DEPTH - 1.6);
    let lane = 0;
    for (const p of this.world.players) {
      if (p === kicker || p === keeper) continue;
      const inBox = Math.abs(p.pos.x) < BOX_HALF_W &&
        Math.abs(p.pos.z - goalZ) < BOX_DEPTH;
      if (!inBox) continue;
      const off = (lane % 2 === 0 ? 1 : -1) * (1.6 + Math.floor(lane / 2) * 1.7);
      lane++;
      p.reset(Math.max(-(WALL_X - 1), Math.min(WALL_X - 1, off)), outZ);
    }
    // taker behind the ball looking at the goal, keeper on his line looking out
    if (kicker) {
      kicker.reset(0, spotZ - goalSide * 1.0);
      kicker.facing = goalSide > 0 ? 0 : Math.PI;
    }
    if (keeper) {
      keeper.reset(0, goalZ - goalSide * 0.9);
      keeper.facing = goalSide > 0 ? Math.PI : 0;
    }
    this.beginSetPiece('penalty', team, kicker, keeper, now);
    this.onWorldEvent?.({ type: 'penalty', team }, true);
    this.announce('Penaltı!', 'gol');
  }

  beginSetPiece(kind, team, kicker, keeper, now) {
    this.setPiece = {
      kind, team, kicker, keeper, live: false,
      deadline: now + SETPIECE_FREEZE + SETPIECE_TIMEOUT,
    };
    this.timeScale = 1;
    this.state = 'kickoff';           // frozen phase, goals do not count yet
    this.kickoffAt = now + SETPIECE_FREEZE;
    this.chargeState.clear();
  }

  // 'Faul!' first, then what the referee gives. The second line is dropped if
  // the restart is already gone (a goal, a new whistle, the end of the match)
  // so it can never talk over a later message.
  announce(text, cls) {
    const sp = this.setPiece;
    this.showMessage('Faul!', 'kacti', 700);
    clearTimeout(this.setPieceMsgTimer);
    this.setPieceMsgTimer = setTimeout(() => {
      if (this.setPiece === sp) this.showMessage(text, cls, 1400);
    }, 750);
  }

  // Who is allowed to move right now.
  canAct(player) {
    const sp = this.setPiece;
    if (!sp) return true;
    if (!sp.live) return false;                    // the ceremony freezes all
    if (player === sp.kicker) return true;
    if (sp.kind === 'penalty') return player === sp.keeper;
    return player.team === sp.team;                // opponents hold the wall
  }

  // The restart is over once the taking side puts the ball in motion.
  resolveSetPiece(now) {
    const sp = this.setPiece;
    if (!sp || !sp.live) return;
    const b = this.world.ball;
    const struck = b.lastTouch === sp.team && Math.hypot(b.vel.x, b.vel.z) > 1.5;
    if (struck || now > sp.deadline) this.setPiece = null;
  }

  // -------------------------------------------------------------- halves

  halfTime(now) {
    this.half = 2;
    this.world.sideSwap = !this.world.sideSwap; // change of ends
    this.applyAttackSigns();
    this.timeLeft = this.halfLength;
    this.setPiece = null;
    this.layoutKickoff();
    this.timeScale = 1;
    this.state = 'kickoff';
    this.kickoffAt = now + HALF_BREAK;
    this.frozenUntil = now + HALF_BREAK;
    this.updateScoreboard();
    this.onWorldEvent?.({ type: 'half' }, true);
    this.showMessage('Devre Arası', 'hazir', HALF_BREAK * 1000);
  }

  startGolden(now) {
    this.golden = true;
    this.timeLeft = GOLDEN_MAX;
    this.updateScoreboard();
    this.onWorldEvent?.({ type: 'golden' }, true);
    this.showMessage('Altın Gol!', 'gol', 2200);
  }

  updateScoreboard() {
    this.dom.scoreRed.textContent = this.score[0];
    this.dom.scoreBlue.textContent = this.score[1];
    const clock = this.mode === 'train'
      ? '∞'
      : (() => {
        const t = Math.max(0, Math.ceil(this.timeLeft));
        return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      })();
    this.dom.timer.textContent = clock;
    // The board in the ground reads from the same two values as the HUD, so
    // the two can never disagree about the score or the time.
    this.scene?.userData?.scoreboard?.update(this.score, clock);
  }

  applyControls(dt, now) {
    // ceremonies (half time, set-piece run-ups, throw-in/corner/goal-kick
    // beats) pin everyone in place; the controllers still tick so their
    // timers and cooldowns stay coherent
    const frozenAll = now < this.frozenUntil || now < (this.restartFreezeUntil ?? 0);
    for (const [player, ctrl] of this.controllers) {
      const c = ctrl.update(dt);
      const allowed = !frozenAll && this.canAct(player);
      player.input.x = allowed ? c.x : 0;
      player.input.z = allowed ? c.z : 0;

      let st = this.chargeState.get(player);
      if (!st) { st = { held: false, t: 0 }; this.chargeState.set(player, st); }
      if (!allowed) {
        st.held = false;
        st.slideHeld = !!c.slide;
        player.charge = 0;
        player.kickAnim = Math.max(0, player.kickAnim - dt * 4);
        continue;
      }
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
    this.setPiece = null;
    this.frozenUntil = 0;
    const [r, b] = this.score;
    this.dom.endTitle.textContent =
      r === b ? 'Berabere!' : `${TEAM_NAMES[r > b ? 0 : 1]} kazandı!`;
    this.dom.endScore.textContent = `${r} — ${b}`;
    this.stats.renderPanel(this.dom.end);
    this.dom.end.classList.remove('hidden');
    this.onMatchEnd?.();
  }

  onGoal(scorer, now) {
    // scorers celebrate, the conceding side hangs their heads (kickoff resets)
    for (const p of this.world.players) p.celebrate = p.team === scorer ? 1 : -1;
    this.kickoffTeam = 1 - scorer; // real football: the conceding team restarts
    this.score[scorer]++;
    this.stats.onGoal(scorer);
    this.setPiece = null;
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

    if (this.state === 'kickoff' && now > this.kickoffAt) {
      this.state = 'play';
      if (this.setPiece) this.setPiece.live = true; // the taker may go
    }
    if (this.state === 'play' || this.state === 'kickoff') this.applyControls(dt, now);

    let fouled = false;
    for (const e of this.world.drainEvents()) {
      this.onWorldEvent?.(e, playing);
      if (e.type === 'goal' && playing) this.onGoal(e.scorer, now);
      else if (e.type === 'post' && playing) this.showMessage('Direk!', 'direk', 900);
      else if (e.type === 'crossbar' && playing) this.showMessage('Üst direk!', 'direk', 900);
      else if (e.type === 'kick' && playing) {
        this.stats.onKick(e.team, this.world);
        if (this.setPiece?.live && e.team === this.setPiece.team) this.setPiece = null;
      } else if (e.type === 'foul' && playing && !fouled) {
        fouled = true;
        this.onFoul(e, now);
      }
    }
    if (fouled) return; // the whistle stops everything else this frame

    if (playing) {
      this.stats.update(dt, this.world);
      this.resolveSetPiece(now);
    }

    if (playing && this.mode !== 'train') {
      this.timeLeft -= dt;
      this.updateScoreboard();
      if (this.timeLeft <= 0) {
        if (this.half === 1) { this.halfTime(now); return; }
        // full time: a level match goes to sudden death, once
        if (!this.golden && this.score[0] === this.score[1]) {
          this.startGolden(now);
        } else { this.endMatch(); return; }
      }
    }
    if (playing) {
      // stalling guard: the restart possession lock lifts after a few seconds
      if (this.world.restartTeam !== null && now > (this.restartClearAt ?? 0)) {
        this.world.restartTeam = null;
      }
      // outs: the boards are low, so a high ball can leave the pitch.
      // Over a touchline -> throw-in from where it went out; over the goal
      // line / the goal -> goal kick.
      const bp = this.world.ball.pos;
      if (Math.abs(bp.x) > WALL_X + BALL_R) {
        const side = Math.sign(bp.x);
        const z = Math.max(-PITCH_HALF_L + 2, Math.min(PITCH_HALF_L - 2, bp.z));
        const lastTouch = this.world.ball.lastTouch;
        this.world.placeBall(side * (WALL_X - 1.2), z);
        this.showMessage('Taç!', 'kacti', 1000);
        this.onWorldEvent?.({ type: 'throwin' }, true);
        this.beginRestart(now, lastTouch === null ? null : 1 - lastTouch);
        this.outTimer = 0;
      } else if (Math.abs(bp.z) > PITCH_HALF_L + 0.2 && !this.world.scoringLocked) {
        // the whole end line is out of play: anything that clears the boards
        // without being a goal restarts immediately — corner if the defender
        // touched it last, goal kick otherwise
        const s = Math.sign(bp.z);
        // whoever defends this end — which side of the pitch that is depends
        // on the half
        const defender = this.world.attackSign(0) === s ? 1 : 0;
        if (this.world.ball.lastTouch === defender) {
          const cx = (Math.sign(bp.x) || 1) * 10.6;
          this.world.placeBall(cx, s * (PITCH_HALF_L - 0.4));
          this.showMessage('Korner!', 'direk', 1000);
          this.onWorldEvent?.({ type: 'corner' }, true);
          this.beginRestart(now, 1 - defender);
        } else {
          this.world.placeBall(0, s * (PITCH_HALF_L - 3.2));
          this.showMessage('Kale vuruşu!', 'kacti', 1000);
          this.onWorldEvent?.({ type: 'goalkick' }, true);
          this.beginRestart(now, defender);
        }
      }
    }

    if (this.state === 'goal') {
      if (this.timeScale < 1 && now > this.slowUntil) this.timeScale = 1;
      if (now > this.goalResetAt) {
        const limit = this.world.config.goalLimit; // 0 = unlimited, time decides
        // sudden death: the celebration finishes, then the match is over
        if (this.mode !== 'train' && this.golden) this.endMatch();
        else if (this.mode !== 'train' && limit > 0 &&
            (this.score[0] >= limit || this.score[1] >= limit)) this.endMatch();
        else this.kickoff();
      }
    }

    // camera: mode-driven rig; a goal always cuts to the net close-up
    this.rig.update(dt, {
      ball: this.world.ball.pos,
      state: this.state,
      me: this.playerRed,
    });
  }
}
