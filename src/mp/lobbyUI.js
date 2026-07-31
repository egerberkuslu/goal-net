// Multiplayer lobby UI — screens, rendering and user callbacks only.
// No networking and no game wiring here: the coordinator hooks the callbacks
// up to PeerNet and calls showLobby/showError as messages arrive.

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
};

const noop = () => {};

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
    this.errorTimer = null;
    this.copyTimer = null;

    this.ready = !!(this.el.entry && this.el.lobby);
    if (!this.ready) return;
    this.#bind();
    if (this.el.name) this.el.name.value = readStoredName();
    this.#renderSettings();
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

  #join() {
    const name = this.#name();
    if (!name) { this.showError('Önce bir oyuncu adı gir.'); return; }
    const code = (this.el.code?.value || '').trim().toUpperCase();
    if (code.length !== CODE_LEN) { this.showError('Oda kodu 6 karakter olmalı.'); return; }
    this.cb.onJoin(code, name);
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

    columns.forEach((ul, team) => {
      if (!ul) return;
      const list = players.filter((p) => (Number(p.team) || 0) === team);
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

    const me = players.find((p) => String(p.id) === String(you));
    this.swapTarget = me && (Number(me.team) || 0) === 1 ? 0 : 1;
    if (this.el.swap) this.el.swap.disabled = !me;
  }

  #playerRow(player, you, isHost) {
    const id = String(player.id);
    let li = this.rows.get(id);
    if (!li) {
      li = document.createElement('li');
      li.className = 'mp-player';
      li.dataset.id = id;
      li.__pid = player.id;

      const name = document.createElement('span');
      name.className = 'mp-pname';
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

      li.append(name, tag, kick, ban);
      li.__parts = { name, tag, kick, ban };
      this.rows.set(id, li);
    }

    li.__pid = player.id;
    const isSelf = String(you) === id;
    const { name, tag, kick, ban } = li.__parts;
    name.textContent = player.name || 'Oyuncu';
    const marks = [];
    if (player.isHost) marks.push('👑');
    if (isSelf) marks.push('sen');
    tag.textContent = marks.join(' ');
    li.classList.toggle('is-you', isSelf);
    const canModerate = isHost && !isSelf;
    kick.hidden = !canModerate;
    ban.hidden = !canModerate;
    return li;
  }

  #renderActions() {
    const { players, isHost } = this.state;
    if (this.el.start) {
      const enough = players.length >= 2;
      this.el.start.hidden = !isHost;
      this.el.start.disabled = !enough;
      this.el.start.title = enough ? '' : 'En az 2 oyuncu gerekli';
    }
    for (const btn of [this.el.addBotRed, this.el.addBotBlue]) {
      if (btn) btn.hidden = !isHost;
    }
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
    });
    const mock = {
      code: 'K7P2QX',
      you: 'p1',
      isHost: true,
      players: [
        { id: 'p1', name: 'Ege', team: 0, isHost: true },
        { id: 'p2', name: 'Mert', team: 0, isHost: false },
        { id: 'p3', name: 'Zeynep', team: 1, isHost: false },
        { id: 'p4', name: 'Can', team: 1, isHost: false },
      ],
      settings: { matchTime: 180, goalLimit: 5, goalScale: 1, keepers: true },
    };
    window.__lobbyDemo = { ui, mock, guest: { ...mock, you: 'p3', isHost: false } };
    ui.showMenu();
    setTimeout(() => ui.showConnecting('Oda kuruluyor…'), 900);
    setTimeout(() => ui.showLobby(mock), 2000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}
