import { PeerNet, NET_ERR } from './peer.js';
import { MSG, sanitizeName, sanitizeChat, DEFAULT_TEAM_COLORS } from './protocol.js';
import { LobbyUI, DEFAULT_SETTINGS } from './lobbyUI.js';
import { ChatUI } from './chatUI.js';
import {
  HOST_ID, autoTeam, canStart, setReady, clearReady, rosterFromPlayers,
  fieldPlayers, spectators, isBotId, nameKey,
  rememberDeparted, takeDeparted, forgetDeparted, pruneDeparted, chatAllowed,
} from './lobbyState.js';
import { makeConfig } from '../core/config.js';
import { KeyboardController, P1_KEYS, P1_ALT_KEYS } from '../game/input.js';
import { BotController, KeeperController } from '../core/ai.js';
import { CameraRig } from '../view/cameraRig.js';
import { PITCH_HALF_L } from '../core/constants.js';

const SNAP_INTERVAL = 1 / 20;
const INPUT_INTERVAL = 1 / 30;
const ANNOUNCE_INTERVAL = 10000;
const ROOMS_POLL_INTERVAL = 4000;
const MAX_PLAYERS = 6;
const MAX_SPECTATORS = 8;
/** Guest-side reconnect budget after an unexpected drop mid-match. */
const RECONNECT_TRIES = 3;
const RECONNECT_GAP_MS = 2000;
/** How long a guest waits for the resume `start` before falling back to the lobby. */
const RESUME_GRACE_MS = 4000;
const ROOMS_URL = `${location.protocol}//${location.hostname}:5200`;

// Held by the guest side: replays the last input received from a peer.
class RemoteController {
  constructor() { this.last = { x: 0, z: 0, kick: false, slide: false }; }
  set(msg) { this.last = { x: msg.x, z: msg.z, kick: msg.kick, slide: !!msg.slide }; }
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
    this.rig = new CameraRig(camera);
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
      p.diveKind = sp.diveKind === 1 ? 'slide' : 'dive';
      p.diveDir = { x: Math.sin(sp.diveYaw), z: Math.cos(sp.diveYaw) };
      p.jumpY = sp.jumpY;
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
      else if (e.type === 'throwin') { this.showMessage('Taç!', 'kacti', 1000); this.onSnapEvent?.(e); }
      else if (e.type === 'goalkick') { this.showMessage('Kale vuruşu!', 'kacti', 1000); this.onSnapEvent?.(e); }
      else if (e.type === 'corner') { this.showMessage('Korner!', 'direk', 1000); this.onSnapEvent?.(e); }
      // contract §3: the rules layer represents match phases as plain events
      else if (e.type === 'foul') { this.showMessage('Faul!', 'kacti', 1200); this.onSnapEvent?.(e); }
      else if (e.type === 'penalty') { this.showMessage('Penaltı!', 'direk', 1600); this.onSnapEvent?.(e); }
      else if (e.type === 'freekick') { this.showMessage('Serbest vuruş!', 'kacti', 1200); this.onSnapEvent?.(e); }
      else if (e.type === 'half') { this.showMessage('Devre Arası', 'hazir', 1800); this.onSnapEvent?.(e); }
      else if (e.type === 'golden') { this.showMessage('Altın Gol!', 'gol', 2000); this.onSnapEvent?.(e); }
      else if (e.type === 'kick' || e.type === 'ragdoll') this.onSnapEvent?.(e);
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
    this.rig.update(dt, {
      ball: this.world.ball.pos,
      state: this.state,
      me: this.byId.get(this.myId) ?? null,
    });
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

    // host: peer connection id <-> roster slot id, so a guest that reconnects
    // with a fresh peer id keeps the slot (and the world player) it had before
    this.slotOf = new Map();   // connection id -> slot id
    this.connOf = new Map();   // slot id -> connection id
    this.departed = new Map(); // name key -> {id, name, team, spectator, at}
    this.bannedNames = new Set();
    this.chatBuckets = new Map();
    this.startRoster = null;

    // guest: reconnect bookkeeping
    this.spectating = false;
    this.retry = 0;
    this.resuming = false;
    this.hadMatch = false;
    this.reconnectTimer = null;
    this.resumeTimer = null;

    this.ui = new LobbyUI({
      onCreate: (name) => this.hostRoom(name),
      onJoin: (code, name) => this.joinRoom(code, name),
      onSpectate: (code, name) => this.joinRoom(code, name, { spectate: true }),
      onTeamSwitch: (team) => this.requestTeam(team),
      onSettingsChange: (settings) => this.changeSettings(settings),
      onColor: (side, color) => this.changeColor(side, color),
      onStart: () => this.hostStartMatch(),
      onKick: (id) => this.removePeer(id, 'kick'),
      onBan: (id) => this.removePeer(id, 'ban'),
      onLeave: () => this.leave(),
      onAddBot: (team) => this.addBot(team),
      onReady: (ready) => this.setOwnReady(ready),
    });
    this.chat = new ChatUI({
      onSend: (text) => this.sendChat(text),
      isInMatch: () => this.active && this.inMatch,
      canChat: () => this.active,
    });
    this.ui.attachChat(this.chat.panel);
    this.botCounter = 0;
    this.roomsEl = document.getElementById('mpRooms');
    this.startRoomsPolling();
  }

  /** @returns {object|null} my own lobby entry, host or guest */
  get me() {
    const id = this.role === 'host' ? HOST_ID : this.myId;
    return this.players.find((p) => p.id === id) ?? null;
  }

  /** Host: address a slot through whichever connection currently holds it. */
  sendTo(slotId, msg) {
    if (!this.net) return false;
    const conn = this.connOf.get(slotId) ?? slotId;
    return this.net.send(conn, msg);
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
        this.players = [{
          id: HOST_ID, name: this.myName, team: 0, isHost: true,
          ready: true, spectator: false,
        }];
        this.ui.setRoomCode(code);
        this.broadcastLobby();
        this.announce();
        this.announceTimer = setInterval(() => {
          this.pruneAbsent();
          this.announce();
        }, ANNOUNCE_INTERVAL);
      },
      onPeerJoin: () => {},
      onPeerLeave: (id) => this.onGuestLeft(id),
      onMessage: (id, msg) => this.onHostMessage(id, msg),
      onError: (err) => this.onNetError(err),
      onClosed: () => {},
    });
    this.net.host();
  }

  onHostMessage(connId, msg) {
    if (msg.t === MSG.HELLO) { this.onHello(connId, msg); return; }
    // every later message is addressed by slot, not by connection
    const id = this.slotOf.get(connId) ?? connId;
    if (msg.t === MSG.TEAM) {
      const p = this.players.find((p) => p.id === id);
      if (p && !p.spectator && !this.inMatch) { p.team = msg.team; this.broadcastLobby(); }
    } else if (msg.t === MSG.READY) {
      if (this.inMatch) return;
      const before = this.players;
      this.players = setReady(this.players, id, msg.ready);
      if (this.players !== before) this.broadcastLobby();
    } else if (msg.t === MSG.CHAT) {
      this.relayChat(id, msg.text);
    } else if (msg.t === MSG.INPUT) {
      this.remotes.get(id)?.set(msg);
    }
  }

  /**
   * A peer introduced itself. Either it is a brand new player/spectator, or it
   * is somebody who dropped less than a minute ago and gets its slot back.
   */
  onHello(connId, msg) {
    if (this.slotOf.has(connId) || this.players.some((p) => p.id === connId)) return;
    const now = Date.now();
    pruneDeparted(this.departed, now);
    const name = sanitizeName(msg.name);
    if (this.bannedNames.has(nameKey(name))) { this.net.ban(connId); return; }

    const back = takeDeparted(this.departed, name, now);
    if (back) { this.restoreGuest(connId, back, name); return; }

    if (msg.spectate) {
      if (spectators(this.players).length >= MAX_SPECTATORS) { this.net.kick(connId); return; }
      this.players.push({
        id: connId, name, team: 0, isHost: false, ready: true, spectator: true,
      });
    } else {
      if (fieldPlayers(this.players).length >= MAX_PLAYERS) { this.net.kick(connId); return; }
      this.players.push({
        id: connId, name, team: autoTeam(this.players), isHost: false,
        ready: false, spectator: false,
      });
    }
    this.chat.system(`${name} katıldı`);
    this.broadcastLobby();
    this.announce();
  }

  /** Put a returning peer back on the slot it left, mid-match included. */
  restoreGuest(connId, slot, name) {
    this.slotOf.set(connId, slot.id);
    this.connOf.set(slot.id, connId);
    const existing = this.players.find((p) => p.id === slot.id);
    if (existing) {
      existing.absent = false;
      existing.name = name;
    } else {
      this.players.push({
        id: slot.id, name, team: slot.team, isHost: false,
        ready: false, spectator: slot.spectator,
      });
    }
    this.chat.system(`${name} yeniden bağlandı`);
    this.broadcastLobby();
    this.announce();
    if (this.inMatch) this.resumeGuest(slot.id, name);
  }

  /**
   * Mid-match, a dropped player keeps its slot only while the reconnect window
   * is open. Once that lapses the entry goes, freeing the room slot; the body on
   * the pitch simply stands still for the rest of the match.
   */
  pruneAbsent(now = Date.now()) {
    if (this.role !== 'host') return;
    pruneDeparted(this.departed, now);
    const before = this.players.length;
    this.players = this.players.filter((p) => !p.absent || this.departed.has(nameKey(p.name)));
    if (this.players.length !== before) this.broadcastLobby();
  }

  /** Hand a reconnected guest the running match again; snaps already broadcast. */
  resumeGuest(slotId, name) {
    if (!this.startRoster) return;
    const entry = this.players.find((p) => p.id === slotId);
    if (entry && !entry.spectator && !this.remotes.has(slotId)) {
      const player = this.app?.game.byId.get(slotId);
      if (player) {
        const rc = new RemoteController();
        this.remotes.set(slotId, rc);
        this.app.game.controllers?.set(player, rc);
      }
    }
    this.sendTo(slotId, { t: MSG.START, settings: this.settings, roster: this.startRoster });
    this.app?.game.showMessage?.(`${name} döndü`, 'hazir', 1400);
  }

  /** Host validates, throttles and rebroadcasts one chat line under a real name. */
  relayChat(id, rawText) {
    const text = sanitizeChat(rawText);
    if (!text) return;
    if (!chatAllowed(this.chatBuckets, id, Date.now())) return;
    const from = this.players.find((p) => p.id === id)?.name ?? sanitizeName('');
    const line = { t: MSG.CHAT, from, text };
    this.net.broadcast(line);
    this.chat.push({ from, text, own: id === HOST_ID });
  }

  /** Local send path, shared by the lobby panel, the T overlay and keys 1-4. */
  sendChat(text) {
    const clean = sanitizeChat(text);
    if (!clean || !this.active) return;
    if (this.role === 'host') this.relayChat(HOST_ID, clean);
    else this.net?.send(this.hostPeerId, { t: MSG.CHAT, text: clean });
  }

  /** Guest presses "Hazır"; the host just flips its own flag. */
  setOwnReady(ready) {
    if (this.role === 'host') return;
    this.net?.send(this.hostPeerId, { t: MSG.READY, ready: !!ready });
  }

  /**
   * A connection dropped. Mid-match the slot is kept alive (greyed out) so the
   * same player can walk back into it; in the lobby the entry simply goes away.
   * Either way the slot is remembered for RECONNECT_MS.
   */
  onGuestLeft(connId) {
    const slotId = this.slotOf.get(connId) ?? connId;
    const gone = this.players.find((p) => p.id === slotId);
    this.slotOf.delete(connId);
    this.connOf.delete(slotId);
    if (!gone) return;

    rememberDeparted(this.departed, gone, Date.now());
    if (this.inMatch && !gone.spectator) {
      gone.absent = true;
      gone.ready = false;
      const player = this.app?.game.byId.get(slotId);
      if (player) { player.input.x = 0; player.input.z = 0; }
      this.remotes.get(slotId)?.set({ x: 0, z: 0, kick: false, slide: false });
      this.app?.game.showMessage(`${gone.name} bağlantısı koptu`, 'kacti', 1400);
    } else {
      this.players = this.players.filter((p) => p.id !== slotId);
      this.chat.system(`${gone.name} ayrıldı`);
    }
    this.broadcastLobby();
    this.announce();
  }

  addBot(team) {
    if (this.role !== 'host' || this.inMatch) return;
    if (fieldPlayers(this.players).length >= MAX_PLAYERS) {
      this.ui.showError('Oda dolu.');
      return;
    }
    this.botCounter++;
    this.players.push({
      id: `bot${this.botCounter}`, name: `Bot ${this.botCounter}`, team, isHost: false,
      ready: true, spectator: false,
    });
    this.broadcastLobby();
    this.announce();
  }

  removePeer(id, how) {
    if (this.role !== 'host' || id === HOST_ID) return;
    const gone = this.players.find((p) => p.id === id);
    if (isBotId(id)) {
      this.players = this.players.filter((p) => p.id !== id);
      this.broadcastLobby();
      return;
    }
    const conn = this.connOf.get(id) ?? id;
    // a moderated peer never reclaims its slot, and a ban also blocks the name
    if (gone) forgetDeparted(this.departed, gone.name);
    if (how === 'ban') {
      if (gone) this.bannedNames.add(nameKey(gone.name));
      this.net.ban(conn);
    } else {
      this.net.kick(conn);
    }
    this.slotOf.delete(conn);
    this.connOf.delete(id);
    this.players = this.players.filter((p) => p.id !== id);
    this.remotes.delete(id);
    if (this.inMatch) {
      const player = this.app?.game.byId.get(id);
      if (player) { player.input.x = 0; player.input.z = 0; }
    }
    this.broadcastLobby();
    this.announce();
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

  /** Host picks one shirt colour; validation against the palette is on the wire. */
  changeColor(side, color) {
    if (this.role !== 'host' || (side !== 0 && side !== 1)) return;
    const colors = [...(this.settings.teamColors ?? DEFAULT_TEAM_COLORS)];
    colors[side] = color;
    this.settings = { ...this.settings, teamColors: colors };
    this.broadcastLobby();
  }

  broadcastLobby() {
    const lobby = {
      t: MSG.LOBBY, you: '', players: this.players, settings: this.settings,
    };
    for (const p of this.players) {
      if (p.id === HOST_ID || isBotId(p.id) || p.absent) continue;
      this.sendTo(p.id, { ...lobby, you: p.id });
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

  /** Roster entries carry the display name so guests can label the players. */
  rosterFromLobby() {
    return rosterFromPlayers(this.players, this.settings);
  }

  hostStartMatch() {
    if (this.role !== 'host' || !canStart(this.players)) return;
    const config = makeConfig(this.settings);
    const roster = this.rosterFromLobby();
    this.startRoster = roster;
    // the roster travels with `start`, so guests never re-derive it
    this.net.broadcast({ t: MSG.START, settings: this.settings, roster });

    this.app = this.hooks.buildMatch(config, roster, { mp: 'host' });
    const { game, world } = this.app;
    const controllers = new Map();
    this.remotes.clear();
    for (const p of this.players) {
      if (p.spectator) continue;
      const player = game.byId.get(p.id);
      if (!player) continue;
      if (p.id === HOST_ID) {
        controllers.set(player, new KeyboardController([P1_KEYS, P1_ALT_KEYS]));
      } else if (isBotId(p.id)) {
        controllers.set(player, new BotController(world, player));
      } else {
        const rc = new RemoteController();
        this.remotes.set(p.id, rc);
        controllers.set(player, rc);
      }
    }
    for (const k of game.keepers) controllers.set(k, new KeeperController(world, k));

    const prevHook = game.onWorldEvent;
    const shared = new Set([
      'post', 'crossbar', 'throwin', 'goalkick', 'corner', 'kick', 'ragdoll',
      'foul', 'freekick', 'half', 'golden', // contract §3
    ]);
    game.onWorldEvent = (e, playing) => {
      prevHook?.(e, playing);
      if (!playing) return;
      if (e.type === 'goal') this.pendingEvents.push({ type: 'goal', scorer: e.scorer });
      else if (e.type === 'penalty') this.pendingEvents.push({ type: 'penalty', team: e.team });
      else if (shared.has(e.type)) this.pendingEvents.push({ type: e.type });
    };
    game.onMatchEnd = () => {
      this.net.broadcast({ t: MSG.END, score: [...game.score] });
      this.dom.btnAgain.textContent = 'Lobiye Dön';
    };
    game.beginMatch(controllers, 'mp-host');
    this.inMatch = true;
    this.hadMatch = true;
    this.chat.setInMatch(true);
    this.ui.hide();
  }

  // ---------- guest ----------

  /**
   * @param {string} code room code
   * @param {string} name display name (also the reconnect identity)
   * @param {{spectate?:boolean, resume?:boolean}} [opts]
   */
  joinRoom(code, name, opts = {}) {
    const resume = opts.resume === true;
    this.teardownNet({ keepReconnect: resume });
    this.myName = sanitizeName(name);
    this.role = 'guest';
    this.spectating = opts.spectate === true;
    if (!resume) { this.retry = 0; this.resuming = false; }
    this.ui.showConnecting(resume ? 'Yeniden bağlanılıyor…' : 'Odaya bağlanılıyor…');
    this.net = new PeerNet({
      onOpen: () => {},
      onPeerJoin: (hostId) => {
        this.hostPeerId = hostId;
        this.active = true;
        this.net.send(hostId, {
          t: MSG.HELLO, name: this.myName, spectate: this.spectating,
        });
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
      this.spectating = this.me?.spectator === true;
      this.retry = 0; // a lobby message proves the link is healthy again
      this.ui.setRoomCode(this.code);
      // while resuming, the host's `start` follows immediately: do not flash the lobby
      if (!this.inMatch && !this.resuming) this.showOwnLobby();
      else if (this.resuming) this.#armResumeFallback();
    } else if (msg.t === MSG.START) {
      this.#clearResume();
      this.settings = msg.settings;
      const roster = msg.roster?.length ? msg.roster : this.rosterFromLobby();
      // a spectator is simply absent from the roster: no player, no input
      this.spectating = !roster.some((e) => e.id === this.myId);
      const config = makeConfig(this.settings);
      this.app = this.hooks.buildMatch(config, roster, {
        mp: 'guest', myId: this.myId,
      });
      this.guestKeyboard = this.spectating
        ? null
        : new KeyboardController([P1_KEYS, P1_ALT_KEYS]);
      this.dom.btnAgain.textContent = 'Lobiye Dön';
      this.inMatch = true;
      this.hadMatch = true;
      this.chat.setInMatch(true);
      this.ui.hide();
    } else if (msg.t === MSG.SNAP) {
      if (this.inMatch && this.app?.game.applySnap) {
        this.app.game.applySnap(msg, performance.now() / 1000);
      }
    } else if (msg.t === MSG.CHAT) {
      this.chat.push({ from: msg.from, text: msg.text, own: msg.from === this.myName });
    } else if (msg.t === MSG.KICKED) {
      this.retry = RECONNECT_TRIES; // moderated out: never retry
      this.exitToMenu(msg.reason === 'ban'
        ? 'Odadan banlandın.' : 'Odadan atıldın.');
    } else if (msg.t === MSG.END) {
      // snap.state also carries 'end'; nothing extra needed here
    }
  }

  onHostGone() {
    if (!this.active) return;
    const wasResuming = this.resuming;
    if (this.role === 'guest' && (this.inMatch || wasResuming) && this.retry < RECONNECT_TRIES) {
      this.scheduleReconnect();
      return;
    }
    this.exitToMenu(wasResuming
      ? 'Bağlantı yeniden kurulamadı.'
      : 'Oda sahibi ayrıldı, oda kapandı.');
  }

  /** Guest: try the same room again, up to RECONNECT_TRIES times, 2s apart. */
  scheduleReconnect() {
    const code = this.code;
    const name = this.myName;
    const spectate = this.spectating;
    this.retry++;
    this.resuming = true;
    clearTimeout(this.reconnectTimer);
    this.ui.showConnecting(`Yeniden bağlanılıyor… (${this.retry}/${RECONNECT_TRIES})`);
    this.reconnectTimer = setTimeout(() => {
      this.joinRoom(code, name, { spectate, resume: true });
    }, RECONNECT_GAP_MS);
  }

  /** If the host never sends the resume `start`, fall back to the normal lobby. */
  #armResumeFallback() {
    clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => {
      this.resuming = false;
      if (!this.inMatch) this.showOwnLobby();
    }, RESUME_GRACE_MS);
  }

  #clearResume() {
    clearTimeout(this.resumeTimer);
    clearTimeout(this.reconnectTimer);
    this.resumeTimer = null;
    this.reconnectTimer = null;
    this.resuming = false;
    this.retry = 0;
  }

  // ---------- shared ----------

  onNetError(err) {
    // a failed retry is not a user-facing error yet: burn a try and go again
    if (this.resuming && this.retry < RECONNECT_TRIES) { this.scheduleReconnect(); return; }
    if (err?.code === NET_ERR.ROOM_NOT_FOUND) this.ui.showError('Oda bulunamadı. Kodu kontrol et.');
    else if (err?.code === NET_ERR.INVALID_CODE) this.ui.showError('Geçersiz oda kodu.');
    else this.ui.showError('Bağlantı hatası. Tekrar dene.');
    if (!this.active) this.ui.showEntry();
  }

  exitToMenu(message) {
    const hadMatch = this.inMatch || this.hadMatch;
    this.#clearResume();
    this.teardownNet();
    if (hadMatch) this.hooks.backToLocal();
    this.inMatch = false;
    this.ui.showMenu();
    if (message) {
      this.ui.showEntry();
      this.ui.showError(message);
    }
  }

  leave() {
    if (this.role === 'host') this.unannounce();
    this.#clearResume();
    const hadMatch = this.inMatch || this.hadMatch;
    this.teardownNet();
    if (hadMatch) { this.hooks.backToLocal(); this.inMatch = false; }
  }

  backToLobbyAfterMatch() {
    this.inMatch = false;
    this.hadMatch = false;
    this.chat.setInMatch(false);
    this.dom.btnAgain.textContent = 'Tekrar Oyna';
    this.dom.end.classList.add('hidden');
    this.pendingEvents.length = 0;
    this.startRoster = null;
    if (this.role === 'host') {
      // fresh match, fresh confirmations; anyone who stayed away is gone for good
      this.players = clearReady(this.players.filter((p) => !p.absent));
      this.broadcastLobby();
    } else {
      this.showOwnLobby();
    }
  }

  teardownNet({ keepReconnect = false } = {}) {
    clearInterval(this.announceTimer);
    this.announceTimer = null;
    if (!keepReconnect) {
      this.#clearResume();
      this.hadMatch = false;
      this.chat.clear();
    }
    this.chat.setInMatch(false);
    if (this.role === 'host') this.unannounce();
    this.net?.close();
    this.net = null;
    this.active = false;
    this.role = null;
    this.inMatch = false;
    this.players = [];
    this.remotes.clear();
    this.slotOf.clear();
    this.connOf.clear();
    this.chatBuckets.clear();
    this.pendingEvents.length = 0;
    this.startRoster = null;
    if (!keepReconnect) {
      this.departed.clear();
      this.bannedNames.clear();
      this.spectating = false;
      this.code = '';
    }
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
    } else if (!this.spectating) {
      this.inputAcc += dt;
      if (this.inputAcc >= INPUT_INTERVAL && this.guestKeyboard) {
        this.inputAcc = 0;
        const c = this.guestKeyboard.update();
        this.net.send(this.hostPeerId, {
          t: MSG.INPUT, seq: this.inputSeq++, x: c.x, z: c.z, kick: c.kick,
          slide: c.slide,
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
        diveKind: p.diveKind === 'slide' ? 1 : 0,
        jumpY: p.jumpY,
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
          players: fieldPlayers(this.players).length,
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
