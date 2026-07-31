import { PeerNet, NET_ERR } from './peer.js';
import { MSG, sanitizeName } from './protocol.js';
import { LobbyUI, DEFAULT_SETTINGS } from './lobbyUI.js';
import { makeConfig } from '../core/config.js';
import { KeyboardController, P1_KEYS, P1_ALT_KEYS } from '../game/input.js';
import { BotController, KeeperController } from '../core/ai.js';
import { PITCH_HALF_L } from '../core/constants.js';

const SNAP_INTERVAL = 1 / 20;
const INPUT_INTERVAL = 1 / 30;
const ANNOUNCE_INTERVAL = 10000;
const ROOMS_POLL_INTERVAL = 4000;
const HOST_ID = 'host';
const MAX_PLAYERS = 6;
const ROOMS_URL = `${location.protocol}//${location.hostname}:5200`;

// Held by the guest side: replays the last input received from a peer.
class RemoteController {
  constructor() { this.last = { x: 0, z: 0, kick: false }; }
  set(msg) { this.last = { x: msg.x, z: msg.z, kick: msg.kick }; }
  update() { return this.last; }
}

// Guest-side puppet "game": mirrors host snapshots onto the local world,
// drives HUD/camera/messages, and exposes the same surface main.js expects
// from Game (state, timeScale, update, isHuman, byId, playerRed...).
class GuestMatch {
  constructor(world, camera, dom, myId) {
    this.world = world;
    this.camera = camera;
    this.dom = dom;
    this.myId = myId;
    this.state = 'kickoff';
    this.timeScale = 1;
    this.score = [0, 0];
    this.timeLeft = world.config.matchTime;
    this.mode = 'mp-guest';
    this.camZ = 0;
    this.cam = { x: 28, y: 24.5, z: 0, lx: 2.6, ly: 0.2, lz: 0 };
    this.msgTimer = null;
    this.byId = new Map();
    this.slowUntil = 0;
    this.playerRed = null;
    this.playerBlue = null;
    dom.menu.classList.add('hidden');
    dom.end.classList.add('hidden');
  }

  registerPlayers() {
    this.byId.clear();
    for (const p of this.world.players) this.byId.set(p.mpId, p);
  }

  isHuman(player) {
    return player?.mpId === this.myId;
  }

  showMessage(text, cls, ms = 1600) {
    const m = this.dom.msg;
    m.textContent = text;
    m.className = `hud show ${cls}`;
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { m.className = 'hud'; }, ms);
  }

  applySnap(snap, now) {
    const prevState = this.state;
    this.state = snap.state;
    this.timeLeft = snap.timeLeft;
    this.score = snap.score;

    const b = this.world.ball;
    b.pos.x = snap.ball.x; b.pos.y = snap.ball.y; b.pos.z = snap.ball.z;
    b.vel.x = snap.ball.vx; b.vel.y = snap.ball.vy; b.vel.z = snap.ball.vz;
    b.omega.x = snap.ball.wx; b.omega.y = snap.ball.wy; b.omega.z = snap.ball.wz;
    b.prev.x = b.pos.x; b.prev.y = b.pos.y; b.prev.z = b.pos.z;

    for (const sp of snap.players) {
      const p = this.byId.get(sp.id);
      if (!p) continue;
      p.pos.x = sp.x; p.pos.z = sp.z;
      p.vel.x = sp.vx; p.vel.z = sp.vz;
      p.facing = sp.facing;
      p.down = sp.down;
      if (sp.down > 0 && p.downTotal <= 0) p.downTotal = 1.5;
      p.charge = sp.charge;
      p.kickAnim = sp.kickAnim;
      p.headerAnim = sp.headerAnim;
      p.dive = sp.dive;
      p.diveRecover = sp.diveRecover;
      p.diveDir = { x: Math.sin(sp.diveYaw), z: Math.cos(sp.diveYaw) };
      p.input.x = 0; p.input.z = 0; // guests never steer remote players
    }

    for (const e of snap.events || []) {
      if (e.type === 'goal') {
        this.showMessage('GOOOL!', 'gol', 2600);
        this.timeScale = 0.3;
        this.slowUntil = now + 2.2;
        this.onSnapEvent?.(e);
      } else if (e.type === 'post') { this.showMessage('Direk!', 'direk', 900); this.onSnapEvent?.(e); }
      else if (e.type === 'crossbar') { this.showMessage('Üst direk!', 'direk', 900); this.onSnapEvent?.(e); }
      else if (e.type === 'throwin') this.showMessage('Taç!', 'kacti', 1000);
      else if (e.type === 'goalkick') this.showMessage('Kale vuruşu!', 'kacti', 1000);
      else if (e.type === 'corner') this.showMessage('Korner!', 'direk', 1000);
    }
    if (prevState !== 'kickoff' && snap.state === 'kickoff') this.showMessage('Hazır…', 'hazir', 1000);
    if (prevState !== 'end' && snap.state === 'end') this.showEnd();
    this.updateScoreboard();
  }

  showEnd() {
    const [r, b] = this.score;
    this.dom.endTitle.textContent = r === b ? 'Berabere!' : `${r > b ? 'KIRMIZI' : 'MAVİ'} kazandı!`;
    this.dom.endScore.textContent = `${r} — ${b}`;
    this.dom.end.classList.remove('hidden');
  }

  updateScoreboard() {
    this.dom.scoreRed.textContent = this.score[0];
    this.dom.scoreBlue.textContent = this.score[1];
    const t = Math.max(0, Math.ceil(this.timeLeft));
    this.dom.timer.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }

  update(dt, now) {
    // the host owns all events; the guest world's own events are discarded
    this.world.drainEvents();
    if (this.state === 'play') { this.timeLeft = Math.max(0, this.timeLeft - dt); this.updateScoreboard(); }
    if (this.timeScale < 1 && now > this.slowUntil) this.timeScale = 1;
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

export class MpSession {
  // hooks: { buildMatch(config, roster, opts) -> {game, world}, backToLocal() }
  constructor(hooks, dom) {
    this.hooks = hooks;
    this.dom = dom;
    this.active = false;
    this.role = null; // 'host' | 'guest'
    this.net = null;
    this.myName = '';
    this.players = []; // host-authoritative lobby roster
    this.settings = { ...DEFAULT_SETTINGS };
    this.code = '';
    this.remotes = new Map(); // peerId -> RemoteController
    this.inMatch = false;
    this.pendingEvents = [];
    this.snapAcc = 0;
    this.inputAcc = 0;
    this.inputSeq = 0;
    this.tick = 0;
    this.guestKeyboard = null;
    this.lastLobby = null;
    this.announceTimer = null;
    this.roomsTimer = null;

    this.ui = new LobbyUI({
      onCreate: (name) => this.hostRoom(name),
      onJoin: (code, name) => this.joinRoom(code, name),
      onTeamSwitch: (team) => this.requestTeam(team),
      onSettingsChange: (settings) => this.changeSettings(settings),
      onStart: () => this.hostStartMatch(),
      onKick: (id) => this.removePeer(id, 'kick'),
      onBan: (id) => this.removePeer(id, 'ban'),
      onLeave: () => this.leave(),
      onAddBot: (team) => this.addBot(team),
    });
    this.botCounter = 0;
    this.roomsEl = document.getElementById('mpRooms');
    this.startRoomsPolling();
  }

  // ---------- host ----------

  hostRoom(name) {
    this.teardownNet();
    this.myName = sanitizeName(name);
    this.role = 'host';
    this.ui.showConnecting('Oda kuruluyor…');
    this.net = new PeerNet({
      onOpen: (code) => {
        this.code = code;
        this.active = true;
        this.players = [{ id: HOST_ID, name: this.myName, team: 0, isHost: true }];
        this.ui.setRoomCode(code);
        this.broadcastLobby();
        this.announce();
        this.announceTimer = setInterval(() => this.announce(), ANNOUNCE_INTERVAL);
      },
      onPeerJoin: () => {},
      onPeerLeave: (id) => this.onGuestLeft(id),
      onMessage: (id, msg) => this.onHostMessage(id, msg),
      onError: (err) => this.onNetError(err),
      onClosed: () => {},
    });
    this.net.host();
  }

  onHostMessage(id, msg) {
    if (msg.t === MSG.HELLO) {
      if (this.players.some((p) => p.id === id)) return;
      if (this.players.length >= MAX_PLAYERS) { this.net.kick(id); return; }
      const reds = this.players.filter((p) => p.team === 0).length;
      const blues = this.players.filter((p) => p.team === 1).length;
      this.players.push({
        id, name: sanitizeName(msg.name), team: blues < reds ? 1 : 0, isHost: false,
      });
      this.broadcastLobby();
      this.announce();
    } else if (msg.t === MSG.TEAM) {
      const p = this.players.find((p) => p.id === id);
      if (p && !this.inMatch) { p.team = msg.team; this.broadcastLobby(); }
    } else if (msg.t === MSG.INPUT) {
      this.remotes.get(id)?.set(msg);
    }
  }

  onGuestLeft(id) {
    const gone = this.players.find((p) => p.id === id);
    if (!gone) return;
    this.players = this.players.filter((p) => p.id !== id);
    if (this.inMatch) {
      const player = this.app?.game.byId.get(id);
      if (player) { player.input.x = 0; player.input.z = 0; }
      this.app?.game.showMessage(`${gone.name} ayrıldı`, 'kacti', 1400);
    }
    this.broadcastLobby();
    this.announce();
  }

  addBot(team) {
    if (this.role !== 'host' || this.inMatch) return;
    if (this.players.length >= MAX_PLAYERS) {
      this.ui.showError('Oda dolu.');
      return;
    }
    this.botCounter++;
    this.players.push({
      id: `bot${this.botCounter}`, name: `Bot ${this.botCounter}`, team, isHost: false,
    });
    this.broadcastLobby();
    this.announce();
  }

  removePeer(id, how) {
    if (this.role !== 'host' || id === HOST_ID) return;
    if (String(id).startsWith('bot')) {
      this.players = this.players.filter((p) => p.id !== id);
      this.broadcastLobby();
      return;
    }
    if (how === 'ban') this.net.ban(id); else this.net.kick(id);
    this.onGuestLeft(id);
  }

  requestTeam(team) {
    if (this.role === 'host') {
      const me = this.players.find((p) => p.id === HOST_ID);
      if (me && !this.inMatch) { me.team = team; this.broadcastLobby(); }
    } else {
      this.net?.send(this.hostPeerId, { t: MSG.TEAM, team });
    }
  }

  changeSettings(settings) {
    if (this.role !== 'host') return;
    this.settings = { ...this.settings, ...settings };
    this.broadcastLobby();
  }

  broadcastLobby() {
    const lobby = {
      t: MSG.LOBBY, you: '', players: this.players, settings: this.settings,
    };
    for (const p of this.players) {
      if (p.id === HOST_ID) continue;
      this.net.send(p.id, { ...lobby, you: p.id });
    }
    this.showOwnLobby();
  }

  showOwnLobby() {
    this.ui.showLobby({
      code: this.code,
      you: this.role === 'host' ? HOST_ID : this.myId,
      isHost: this.role === 'host',
      players: this.players,
      settings: this.settings,
    });
  }

  rosterFromLobby() {
    const roster = this.players.map((p) => ({ id: p.id, team: p.team, role: 'field' }));
    if (this.settings.keepers) {
      roster.push({ id: 'kr', team: 0, role: 'keeper' }, { id: 'kb', team: 1, role: 'keeper' });
    }
    return roster;
  }

  hostStartMatch() {
    if (this.role !== 'host' || this.players.length < 2) return;
    const config = makeConfig(this.settings);
    const roster = this.rosterFromLobby();
    this.net.broadcast({ t: MSG.START, settings: this.settings });
    // guests derive the same roster from the last lobby broadcast

    this.app = this.hooks.buildMatch(config, roster, { mp: 'host' });
    const { game, world } = this.app;
    const controllers = new Map();
    this.remotes.clear();
    for (const p of this.players) {
      const player = game.byId.get(p.id);
      if (!player) continue;
      if (p.id === HOST_ID) {
        controllers.set(player, new KeyboardController([P1_KEYS, P1_ALT_KEYS]));
      } else if (String(p.id).startsWith('bot')) {
        controllers.set(player, new BotController(world, player));
      } else {
        const rc = new RemoteController();
        this.remotes.set(p.id, rc);
        controllers.set(player, rc);
      }
    }
    for (const k of game.keepers) controllers.set(k, new KeeperController(world, k));

    const prevHook = game.onWorldEvent;
    const shared = new Set(['post', 'crossbar', 'throwin', 'goalkick', 'corner']);
    game.onWorldEvent = (e, playing) => {
      prevHook?.(e, playing);
      if (!playing) return;
      if (e.type === 'goal') this.pendingEvents.push({ type: 'goal', scorer: e.scorer });
      else if (shared.has(e.type)) this.pendingEvents.push({ type: e.type });
    };
    game.onMatchEnd = () => {
      this.net.broadcast({ t: MSG.END, score: [...game.score] });
      this.dom.btnAgain.textContent = 'Lobiye Dön';
    };
    game.beginMatch(controllers, 'mp-host');
    this.inMatch = true;
    this.ui.hide();
  }

  // ---------- guest ----------

  joinRoom(code, name) {
    this.teardownNet();
    this.myName = sanitizeName(name);
    this.role = 'guest';
    this.ui.showConnecting('Odaya bağlanılıyor…');
    this.net = new PeerNet({
      onOpen: () => {},
      onPeerJoin: (hostId) => {
        this.hostPeerId = hostId;
        this.active = true;
        this.net.send(hostId, { t: MSG.HELLO, name: this.myName });
      },
      onPeerLeave: () => this.onHostGone(),
      onMessage: (id, msg) => this.onGuestMessage(msg),
      onError: (err) => this.onNetError(err),
      onClosed: () => this.onHostGone(),
    });
    this.net.join(code, name);
    this.code = code;
  }

  onGuestMessage(msg) {
    if (msg.t === MSG.LOBBY) {
      this.myId = msg.you;
      this.players = msg.players;
      this.settings = msg.settings;
      this.ui.setRoomCode(this.code);
      if (!this.inMatch) this.showOwnLobby();
    } else if (msg.t === MSG.START) {
      this.settings = msg.settings;
      const config = makeConfig(this.settings);
      this.app = this.hooks.buildMatch(config, this.rosterFromLobby(), {
        mp: 'guest', myId: this.myId,
      });
      this.guestKeyboard = new KeyboardController([P1_KEYS, P1_ALT_KEYS]);
      this.dom.btnAgain.textContent = 'Lobiye Dön';
      this.inMatch = true;
      this.ui.hide();
    } else if (msg.t === MSG.SNAP) {
      if (this.inMatch && this.app?.game.applySnap) {
        this.app.game.applySnap(msg, performance.now() / 1000);
      }
    } else if (msg.t === MSG.KICKED) {
      this.exitToMenu(msg.reason === 'ban'
        ? 'Odadan banlandın.' : 'Odadan atıldın.');
    } else if (msg.t === MSG.END) {
      // snap.state also carries 'end'; nothing extra needed here
    }
  }

  onHostGone() {
    if (!this.active) return;
    this.exitToMenu('Oda sahibi ayrıldı, oda kapandı.');
  }

  // ---------- shared ----------

  onNetError(err) {
    if (err?.code === NET_ERR.ROOM_NOT_FOUND) this.ui.showError('Oda bulunamadı. Kodu kontrol et.');
    else if (err?.code === NET_ERR.INVALID_CODE) this.ui.showError('Geçersiz oda kodu.');
    else this.ui.showError('Bağlantı hatası. Tekrar dene.');
    if (!this.active) this.ui.showEntry();
  }

  exitToMenu(message) {
    this.teardownNet();
    if (this.inMatch) this.hooks.backToLocal();
    this.inMatch = false;
    this.ui.showMenu();
    if (message) {
      this.ui.showEntry();
      this.ui.showError(message);
    }
  }

  leave() {
    if (this.role === 'host') this.unannounce();
    this.teardownNet();
    if (this.inMatch) { this.hooks.backToLocal(); this.inMatch = false; }
  }

  backToLobbyAfterMatch() {
    this.inMatch = false;
    this.dom.btnAgain.textContent = 'Tekrar Oyna';
    this.dom.end.classList.add('hidden');
    this.pendingEvents.length = 0;
    if (this.role === 'host') this.broadcastLobby();
    else this.showOwnLobby();
  }

  teardownNet() {
    clearInterval(this.announceTimer);
    this.announceTimer = null;
    if (this.role === 'host') this.unannounce();
    this.net?.close();
    this.net = null;
    this.active = false;
    this.role = null;
    this.inMatch = false;
    this.players = [];
    this.remotes.clear();
    this.pendingEvents.length = 0;
    this.code = '';
  }

  // Called from the main loop every frame while a network match runs.
  frameHook(dt) {
    if (!this.active || !this.inMatch || !this.app) return;
    if (this.role === 'host') {
      this.snapAcc += dt;
      if (this.snapAcc >= SNAP_INTERVAL) {
        this.snapAcc = 0;
        this.net.broadcast(this.makeSnap());
      }
    } else {
      this.inputAcc += dt;
      if (this.inputAcc >= INPUT_INTERVAL && this.guestKeyboard) {
        this.inputAcc = 0;
        const c = this.guestKeyboard.update();
        this.net.send(this.hostPeerId, {
          t: MSG.INPUT, seq: this.inputSeq++, x: c.x, z: c.z, kick: c.kick,
        });
      }
    }
  }

  makeSnap() {
    const { game, world } = this.app;
    const state = ['kickoff', 'play', 'goal', 'end'].includes(game.state) ? game.state : 'kickoff';
    const b = world.ball;
    return {
      t: MSG.SNAP,
      tick: this.tick++,
      state,
      timeLeft: Math.max(0, game.timeLeft),
      score: [...game.score],
      ball: {
        x: b.pos.x, y: b.pos.y, z: b.pos.z,
        vx: b.vel.x, vy: b.vel.y, vz: b.vel.z,
        wx: b.omega.x, wy: b.omega.y, wz: b.omega.z,
      },
      players: world.players.map((p) => ({
        id: p.mpId, x: p.pos.x, z: p.pos.z, vx: p.vel.x, vz: p.vel.z,
        facing: p.facing, down: p.down, charge: p.charge, kickAnim: p.kickAnim,
        headerAnim: p.headerAnim, dive: p.dive, diveRecover: p.diveRecover,
        diveYaw: Math.atan2(p.diveDir.x, p.diveDir.z),
        team: p.team, role: p.role,
      })),
      events: this.pendingEvents.splice(0),
    };
  }

  // ---------- open-room registry (optional; degrades to code-only) ----------

  async announce() {
    if (this.role !== 'host' || !this.code) return;
    try {
      await fetch(`${ROOMS_URL}/announce`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code: this.code,
          name: `${this.myName} odası`,
          players: this.players.length,
          maxPlayers: MAX_PLAYERS,
        }),
      });
    } catch { /* registry offline: code-only mode */ }
  }

  async unannounce() {
    if (!this.code) return;
    try {
      await fetch(`${ROOMS_URL}/remove`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: this.code }),
      });
    } catch { /* fine */ }
  }

  startRoomsPolling() {
    if (!this.roomsEl) return;
    const poll = async () => {
      const entryVisible = !document.getElementById('mpEntry')?.classList.contains('hidden');
      if (!entryVisible) return;
      try {
        const res = await fetch(`${ROOMS_URL}/rooms`);
        const rooms = await res.json();
        this.renderRooms(rooms);
      } catch {
        this.renderRooms(null); // registry unreachable
      }
    };
    this.roomsTimer = setInterval(poll, ROOMS_POLL_INTERVAL);
    // refresh instantly whenever the entry screen opens
    document.getElementById('btnMp')?.addEventListener('click', () => setTimeout(poll, 60));
    poll();
  }

  renderRooms(rooms) {
    const el = this.roomsEl;
    el.textContent = '';
    const info = document.createElement('li');
    info.className = 'mp-empty';
    if (rooms === null) {
      info.textContent = 'Oda listesi sunucusuna ulaşılamıyor (kodla katılabilirsin).';
      el.appendChild(info);
      return;
    }
    if (!rooms.length) {
      info.textContent = 'Şu an açık oda yok.';
      el.appendChild(info);
      return;
    }
    for (const r of rooms) {
      const li = document.createElement('li');
      li.className = 'mp-room';
      const label = document.createElement('span');
      label.className = 'mp-pname';
      label.textContent = `${r.name} · ${r.players}/${r.maxPlayers}`;
      const codeEl = document.createElement('span');
      codeEl.className = 'mp-tag';
      codeEl.textContent = r.code;
      const btn = document.createElement('button');
      btn.textContent = 'Katıl';
      btn.addEventListener('click', () => {
        const name = (document.getElementById('mpName')?.value || '').trim();
        if (!name) { this.ui.showError('Önce bir oyuncu adı gir.'); return; }
        this.joinRoom(r.code, name);
      });
      li.append(label, codeEl, btn);
      el.appendChild(li);
    }
  }
}

export { GuestMatch };
