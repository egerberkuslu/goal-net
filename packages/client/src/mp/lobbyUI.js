// Multiplayer lobby UI — screens, rendering and user callbacks only.
// No networking and no game wiring here: the coordinator hooks the callbacks
// up to PeerNet and calls showLobby/showError as messages arrive.

import { TEAM_PALETTE, DEFAULT_TEAM_COLORS } from './protocol.js';
import { canStart, readyOf, fieldPlayers, spectators } from './lobbyState.js';

const NAME_KEY = 'goalnet-name';
const CODE_LEN = 6;
const ERROR_MS = 5000;
const COPY_MS = 1600;
const BLANK_CODE = '------';

export const DEFAULT_SETTINGS = {
  matchTime: 180,
  goalLimit: 5,
  goalScale: 1,
  keepers: true,
  teamColors: [...DEFAULT_TEAM_COLORS],
};

const noop = () => {};
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

// data-value is always a string in the DOM; keepers is the only non-numeric key
function parseSettingValue(key, raw) {
  return key === 'keepers' ? raw === 'true' : Number(raw);
}

function readStoredName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

function storeName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* private mode: name simply is not remembered */
  }
}

export class LobbyUI {
  constructor(callbacks = {}) {
    this.cb = {
      onCreate: noop,
      onJoin: noop,
      onTeamSwitch: noop,
      onSettingsChange: noop,
      onStart: noop,
      onKick: noop,
      onBan: noop,
      onLeave: noop,
      onAddBot: noop,
      onReady: noop,
      onSpectate: noop,
      onColor: noop,
      ...callbacks,
    };

    const $ = (id) => document.getElementById(id);
    this.el = {
      menu: $('menu'),
      btnMp: $('btnMp'),
      entry: $('mpEntry'),
      connecting: $('mpConnecting'),
      connectingMsg: $('mpConnectingMsg'),
      lobby: $('mpLobby'),
      error: $('mpError'),
      name: $('mpName'),
      code: $('mpCode'),
      create: $('mpCreate'),
      join: $('mpJoin'),
      back: $('mpBack'),
      cancel: $('mpCancel'),
      roomCode: $('mpRoomCode'),
      copy: $('mpCopy'),
      teamRed: $('mpTeamRed'),
      teamBlue: $('mpTeamBlue'),
      swap: $('mpSwitch'),
      settings: $('mpSettings'),
      settingsHint: $('mpSettingsHint'),
      start: $('mpStart'),
      leave: $('mpLeave'),
      addBotRed: $('mpAddBotRed'),
      addBotBlue: $('mpAddBotBlue'),
    };
    this.overlays = [this.el.entry, this.el.connecting, this.el.lobby].filter(Boolean);

    this.state = { players: [], isHost: false, you: null };
    this.settings = { ...DEFAULT_SETTINGS };
    this.roomCode = '';
    this.swapTarget = 1;
    this.rows = new Map(); // player id (string) -> <li>
    this.specRows = new Map(); // spectator id (string) -> <li>
    this.errorTimer = null;
    this.copyTimer = null;
    this.iAmReady = false;

    this.ready = !!(this.el.entry && this.el.lobby);
    if (!this.ready) return;
    this.#buildExtraDom();
    this.#bind();
    if (this.el.name) this.el.name.value = readStoredName();
    this.#renderSettings();
  }

  // ---------- DOM the markup does not ship (index.html is off limits) ----------

  #buildExtraDom() {
    const el = this.el;
    this.#injectStyle();

    // entry screen: spectator path next to "Katıl"
    if (el.join?.parentElement) {
      const spec = document.createElement('button');
      spec.id = 'mpSpectate';
      spec.className = 'mp-ghost mp-small';
      spec.textContent = 'İzleyici olarak katıl';
      spec.title = 'Takıma girmeden maçı izle';
      el.join.parentElement.insertBefore(spec, el.join.nextSibling);
      el.spectate = spec;
    }

    // lobby: spectator column beside the two team columns
    const teams = el.lobby?.querySelector('.mp-teams');
    if (teams) {
      const box = document.createElement('div');
      box.className = 'mp-team mp-team-spec';
      box.id = 'mpSpectatorBox';
      const title = document.createElement('h3');
      title.textContent = 'İZLEYİCİLER';
      const list = document.createElement('ul');
      list.className = 'mp-playerlist';
      list.id = 'mpSpectators';
      box.append(title, list);
      teams.appendChild(box);
      el.spectators = list;
      el.spectatorBox = box;
    }

    // settings: one swatch row per team
    if (el.settings) {
      el.colorSegs = [0, 1].map((side) => {
        const label = document.createElement('span');
        label.className = 'mp-setlabel';
        label.textContent = side === 0 ? 'Kırmızı forma' : 'Mavi forma';
        const seg = document.createElement('span');
        seg.className = 'mp-seg mp-colors';
        seg.id = side === 0 ? 'mpColorsRed' : 'mpColorsBlue';
        for (const color of TEAM_PALETTE[side]) {
          const btn = document.createElement('button');
          btn.className = 'mp-swatch';
          btn.dataset.side = String(side);
          btn.dataset.color = String(color);
          btn.style.background = hex(color);
          btn.title = hex(color);
          btn.setAttribute('aria-label', `${side === 0 ? 'Kırmızı' : 'Mavi'} ${hex(color)}`);
          btn.addEventListener('click', () => this.cb.onColor(side, color));
          seg.appendChild(btn);
        }
        el.settings.append(label, seg);
        return seg;
      });
    }

    // lobby actions: ready toggle for guests
    if (el.start?.parentElement) {
      const ready = document.createElement('button');
      ready.id = 'mpReady';
      ready.className = 'mp-ghost';
      ready.textContent = 'Hazır';
      el.start.parentElement.insertBefore(ready, el.start);
      el.readyBtn = ready;
    }
  }

  #injectStyle() {
    if (document.getElementById('mp-social-style')) return;
    const style = document.createElement('style');
    style.id = 'mp-social-style';
    style.textContent = `
      .mp-team-spec { border-top-color: #7f8ec0; min-width: 190px; }
      .mp-ready { color: #4ad07a; font-weight: 700; font-size: 14px; }
      .mp-ready.waiting { color: #7f8ec0; }
      .mp-player.is-absent { opacity: .55; }
      .overlay .mp-seg.mp-colors button.mp-swatch { width: 26px; height: 26px; padding: 0;
        border-radius: 50%; border: 2px solid rgba(255, 255, 255, .25); }
      .overlay .mp-seg.mp-colors button.mp-swatch.on { border-color: #fff;
        box-shadow: 0 0 0 2px rgba(36, 86, 230, .9); }
      .overlay .mp-seg.mp-colors button.mp-swatch:disabled { cursor: default; }
      #mpReady.on { background: #1f8a4c; color: #fff; }
    `;
    document.head.appendChild(style);
  }

  // ---------- public API ----------

  /** Back to the existing single/local-play menu. */
  showMenu() {
    this.clearError();
    this.#hideOverlays();
    if (this.el.menu) this.el.menu.classList.remove('hidden');
  }

  /** Name + room-code screen. Not in the contract but needed by the flow. */
  showEntry() {
    this.clearError();
    this.#show(this.el.entry);
    if (this.el.name) this.el.name.focus();
  }

  showConnecting(msg = 'Bağlanılıyor…') {
    this.clearError();
    if (this.el.connectingMsg) this.el.connectingMsg.textContent = msg;
    this.#show(this.el.connecting);
  }

  /**
   * state = contents of the `lobby` message plus isHost (and optionally code):
   * { code?, you, isHost, players:[{id,name,team,isHost}], settings }
   * Safe to call repeatedly — rows are reconciled, settings buttons reused.
   */
  showLobby(state = {}) {
    if (!this.ready) return;
    this.state = {
      you: state.you ?? null,
      isHost: !!state.isHost,
      players: Array.isArray(state.players) ? state.players : [],
      settings: state.settings,
    };
    if (state.settings) this.settings = { ...DEFAULT_SETTINGS, ...state.settings };
    if (state.code) this.setRoomCode(state.code);
    this.#show(this.el.lobby);
    this.#renderPlayers();
    this.#renderSettings();
    this.#renderActions();
  }

  /** Host learns its code from PeerNet.onOpen before any lobby state exists. */
  setRoomCode(code) {
    this.roomCode = String(code || '').toUpperCase();
    if (this.el.roomCode) this.el.roomCode.textContent = this.roomCode || BLANK_CODE;
  }

  /** Red-tinted inline line inside whichever multiplayer overlay is visible. */
  showError(msg) {
    const err = this.el.error;
    if (!err) return;
    const slot = this.#visibleOverlay()?.querySelector('.mp-error-slot');
    if (slot && err.parentElement !== slot) slot.appendChild(err);
    err.textContent = msg;
    err.classList.add('show');
    clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => this.clearError(), ERROR_MS);
  }

  clearError() {
    clearTimeout(this.errorTimer);
    if (this.el.error) {
      this.el.error.classList.remove('show');
      this.el.error.textContent = '';
    }
  }

  /** Match is starting: close every multiplayer overlay. */
  hide() {
    this.clearError();
    this.#hideOverlays();
  }

  // ---------- wiring ----------

  #bind() {
    const el = this.el;
    if (el.btnMp) el.btnMp.addEventListener('click', () => this.showEntry());
    if (el.name) {
      el.name.addEventListener('input', () => storeName(el.name.value));
      el.name.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.#create(); });
    }
    if (el.code) {
      el.code.addEventListener('input', () => this.#normalizeCode());
      el.code.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.#join(); });
    }
    if (el.create) el.create.addEventListener('click', () => this.#create());
    if (el.join) el.join.addEventListener('click', () => this.#join());
    if (el.spectate) el.spectate.addEventListener('click', () => this.#join(true));
    if (el.readyBtn) el.readyBtn.addEventListener('click', () => {
      this.iAmReady = !this.iAmReady;
      this.#renderReadyButton();
      this.cb.onReady(this.iAmReady);
    });
    if (el.back) el.back.addEventListener('click', () => this.showMenu());
    if (el.cancel) el.cancel.addEventListener('click', () => this.#leave());
    if (el.copy) el.copy.addEventListener('click', () => this.#copyCode());
    if (el.swap) el.swap.addEventListener('click', () => this.cb.onTeamSwitch(this.swapTarget));
    if (el.start) el.start.addEventListener('click', () => this.cb.onStart());
    if (el.addBotRed) el.addBotRed.addEventListener('click', () => this.cb.onAddBot(0));
    if (el.addBotBlue) el.addBotBlue.addEventListener('click', () => this.cb.onAddBot(1));
    if (el.leave) el.leave.addEventListener('click', () => this.#leave());
    if (el.settings) el.settings.addEventListener('click', (e) => this.#onSettingClick(e));
  }

  #name() {
    return (this.el.name?.value || '').trim().slice(0, 20);
  }

  #create() {
    const name = this.#name();
    if (!name) { this.showError('Önce bir oyuncu adı gir.'); return; }
    this.cb.onCreate(name);
  }

  #join(spectate = false) {
    const name = this.#name();
    if (!name) { this.showError('Önce bir oyuncu adı gir.'); return; }
    const code = (this.el.code?.value || '').trim().toUpperCase();
    if (code.length !== CODE_LEN) { this.showError('Oda kodu 6 karakter olmalı.'); return; }
    if (spectate) this.cb.onSpectate(code, name);
    else this.cb.onJoin(code, name);
  }

  #leave() {
    this.cb.onLeave();
    this.showMenu();
  }

  // uppercase + strip separators without throwing the caret to the end
  #normalizeCode() {
    const input = this.el.code;
    const caret = input.selectionStart;
    const cleaned = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);
    if (cleaned === input.value) return;
    const removed = input.value.length - cleaned.length;
    input.value = cleaned;
    const pos = Math.max(0, (caret ?? cleaned.length) - removed);
    try { input.setSelectionRange(pos, pos); } catch { /* not selectable */ }
  }

  #copyCode() {
    const code = this.roomCode || (this.el.roomCode?.textContent || '').trim();
    if (!code || code === BLANK_CODE) return;
    const flash = () => {
      this.el.copy.textContent = 'Kopyalandı ✓';
      clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => { this.el.copy.textContent = 'Kopyala'; }, COPY_MS);
    };
    const fail = () => this.showError('Kopyalanamadı, kodu elle seç.');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(flash, fail);
    else fail();
  }

  #onSettingClick(ev) {
    const btn = ev.target.closest('button[data-setting]');
    if (!btn || btn.disabled) return;
    const key = btn.dataset.setting;
    const value = parseSettingValue(key, btn.dataset.value);
    if (this.settings[key] === value) return;
    this.settings = { ...this.settings, [key]: value };
    this.#renderSettings();
    this.cb.onSettingsChange({ ...this.settings });
  }

  // ---------- rendering ----------

  #hideOverlays() {
    for (const o of this.overlays) o.classList.add('hidden');
  }

  #show(target) {
    if (!target) return;
    if (this.el.menu) this.el.menu.classList.add('hidden');
    for (const o of this.overlays) o.classList.toggle('hidden', o !== target);
  }

  #visibleOverlay() {
    return this.overlays.find((o) => !o.classList.contains('hidden')) || null;
  }

  #renderSettings() {
    const panel = this.el.settings;
    if (!panel) return;
    const host = !!this.state.isHost;
    for (const btn of panel.querySelectorAll('button[data-setting]')) {
      const key = btn.dataset.setting;
      const on = this.settings[key] === parseSettingValue(key, btn.dataset.value);
      btn.classList.toggle('on', on);
      btn.disabled = !host;
    }
    const colors = this.settings.teamColors ?? DEFAULT_TEAM_COLORS;
    for (const btn of panel.querySelectorAll('button.mp-swatch')) {
      const side = Number(btn.dataset.side);
      btn.classList.toggle('on', colors[side] === Number(btn.dataset.color));
      btn.disabled = !host;
    }
    panel.classList.toggle('readonly', !host);
    if (this.el.settingsHint) {
      this.el.settingsHint.textContent = host
        ? 'Ayarları sen belirliyorsun.'
        : 'Ayarları oda sahibi belirler.';
    }
  }

  #renderPlayers() {
    const { players, you, isHost } = this.state;
    const columns = [this.el.teamRed, this.el.teamBlue];
    const alive = new Set();
    const onPitch = fieldPlayers(players);

    columns.forEach((ul, team) => {
      if (!ul) return;
      const list = onPitch.filter((p) => (Number(p.team) || 0) === team);
      list.forEach((p, index) => {
        const li = this.#playerRow(p, you, isHost);
        alive.add(String(p.id));
        if (ul.children[index] !== li) ul.insertBefore(li, ul.children[index] || null);
      });
      // drop rows that left this column (moved team, kicked, disconnected)
      for (const li of [...ul.children]) {
        if (!alive.has(li.dataset.id) || li.dataset.id === '') li.remove();
      }
      if (!ul.children.length) {
        const empty = document.createElement('li');
        empty.className = 'mp-empty';
        empty.dataset.id = '';
        empty.textContent = 'Boş';
        ul.appendChild(empty);
      }
    });

    for (const [id, li] of this.rows) {
      if (!alive.has(id)) { li.remove(); this.rows.delete(id); }
    }

    this.#renderSpectators();

    const me = players.find((p) => String(p.id) === String(you));
    this.swapTarget = me && (Number(me.team) || 0) === 1 ? 0 : 1;
    // spectators sit out: no team to switch to
    if (this.el.swap) this.el.swap.disabled = !me || me.spectator === true;
  }

  #renderSpectators() {
    const ul = this.el.spectators;
    if (!ul) return;
    const { players, you, isHost } = this.state;
    const list = spectators(players);
    if (this.el.spectatorBox) this.el.spectatorBox.hidden = list.length === 0;

    const alive = new Set(list.map((p) => String(p.id)));
    list.forEach((p, index) => {
      const li = this.#playerRow(p, you, isHost, this.specRows);
      if (ul.children[index] !== li) ul.insertBefore(li, ul.children[index] || null);
    });
    for (const [id, li] of this.specRows) {
      if (!alive.has(id)) { li.remove(); this.specRows.delete(id); }
    }
  }

  #playerRow(player, you, isHost, store = this.rows) {
    const id = String(player.id);
    let li = store.get(id);
    if (!li) {
      li = document.createElement('li');
      li.className = 'mp-player';
      li.dataset.id = id;
      li.__pid = player.id;

      const name = document.createElement('span');
      name.className = 'mp-pname';
      const ready = document.createElement('span');
      ready.className = 'mp-ready';
      const tag = document.createElement('span');
      tag.className = 'mp-tag';
      const kick = document.createElement('button');
      kick.textContent = 'At';
      kick.title = 'Odadan at';
      kick.addEventListener('click', () => this.cb.onKick(li.__pid));
      const ban = document.createElement('button');
      ban.textContent = 'Banla';
      ban.title = 'Odadan at ve tekrar girmesini engelle';
      ban.addEventListener('click', () => this.cb.onBan(li.__pid));

      li.append(name, ready, tag, kick, ban);
      li.__parts = { name, ready, tag, kick, ban };
      store.set(id, li);
    }

    li.__pid = player.id;
    const isSelf = String(you) === id;
    const { name, ready, tag, kick, ban } = li.__parts;
    name.textContent = player.name || 'Oyuncu';
    const marks = [];
    if (player.isHost) marks.push('👑');
    if (player.spectator) marks.push('izleyici');
    if (isSelf) marks.push('sen');
    tag.textContent = marks.join(' ');
    // host, bots and spectators need no ready flag, so they never show a mark
    const needsReady = !player.isHost && !player.spectator && !String(player.id).startsWith('bot');
    ready.textContent = !needsReady ? '' : (readyOf(player) ? '✓' : '…');
    ready.classList.toggle('waiting', needsReady && !readyOf(player));
    ready.title = !needsReady ? '' : (readyOf(player) ? 'Hazır' : 'Bekleniyor');
    li.classList.toggle('is-you', isSelf);
    li.classList.toggle('is-absent', player.absent === true);
    const canModerate = isHost && !isSelf;
    kick.hidden = !canModerate;
    ban.hidden = !canModerate;
    return li;
  }

  #renderActions() {
    const { players, isHost, you } = this.state;
    if (this.el.start) {
      const enough = fieldPlayers(players).length >= 2;
      const ok = canStart(players);
      this.el.start.hidden = !isHost;
      this.el.start.disabled = !ok;
      this.el.start.title = enough
        ? (ok ? '' : 'Tüm oyuncular hazır olmalı')
        : 'En az 2 oyuncu gerekli';
    }
    for (const btn of [this.el.addBotRed, this.el.addBotBlue]) {
      if (btn) btn.hidden = !isHost;
    }
    const me = players.find((p) => String(p.id) === String(you));
    if (this.el.readyBtn) {
      // only a guest that actually takes the pitch has anything to confirm
      this.el.readyBtn.hidden = isHost || !me || me.spectator === true;
      this.iAmReady = me?.ready === true;
      this.#renderReadyButton();
    }
  }

  #renderReadyButton() {
    const btn = this.el.readyBtn;
    if (!btn) return;
    btn.classList.toggle('on', this.iAmReady);
    btn.textContent = this.iAmReady ? 'Hazır ✓' : 'Hazır';
  }

  /** Append a JS-built node (the chat panel) to the lobby overlay, once. */
  attachChat(node) {
    if (!node || !this.el.lobby) return;
    const actions = this.el.lobby.querySelector('.mp-actions');
    if (actions) this.el.lobby.insertBefore(node, actions);
    else this.el.lobby.appendChild(node);
  }
}

// Tiny standalone preview so the screens can be eyeballed without networking:
// open http://localhost:5199/?lobbydemo
if (typeof location !== 'undefined' && location.search.includes('lobbydemo')) {
  const log = (name) => (...args) => console.log('[lobbydemo]', name, ...args);
  const run = () => {
    const ui = new LobbyUI({
      onCreate: log('onCreate'),
      onJoin: log('onJoin'),
      onTeamSwitch: log('onTeamSwitch'),
      onSettingsChange: log('onSettingsChange'),
      onStart: log('onStart'),
      onKick: log('onKick'),
      onBan: log('onBan'),
      onLeave: log('onLeave'),
      onReady: log('onReady'),
      onSpectate: log('onSpectate'),
      onColor: log('onColor'),
    });
    const mock = {
      code: 'K7P2QX',
      you: 'p1',
      isHost: true,
      players: [
        { id: 'p1', name: 'Ege', team: 0, isHost: true },
        { id: 'p2', name: 'Mert', team: 0, isHost: false, ready: true },
        { id: 'p3', name: 'Zeynep', team: 1, isHost: false, ready: false },
        { id: 'p4', name: 'Can', team: 1, isHost: false, ready: true },
        { id: 'p5', name: 'Deniz', team: 0, isHost: false, spectator: true },
      ],
      settings: {
        matchTime: 180, goalLimit: 5, goalScale: 1, keepers: true,
        teamColors: [...DEFAULT_TEAM_COLORS],
      },
    };
    window.__lobbyDemo = { ui, mock, guest: { ...mock, you: 'p3', isHost: false } };
    ui.showMenu();
    setTimeout(() => ui.showConnecting('Oda kuruluyor…'), 900);
    setTimeout(() => ui.showLobby(mock), 2000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}
