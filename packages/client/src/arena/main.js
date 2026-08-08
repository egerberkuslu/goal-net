// Arena entry point: lobby -> room -> match, over the deterministic stack.
//
// This file is the only one in src/arena/ that touches the DOM directly, and it
// deliberately owns no rules: the mode table lives in roster.js, the keeper
// constraint in lobbyState.js, the end condition in matchRules.js and the loop
// in match.js. What is left here is wiring and paint.
//
// The classic game at / is untouched. It has its own entry document, its own
// world and its own protocol; the two only share the view layer and the PeerJS
// transport, both of which the arena imports rather than forks.
//
// Query parameters (they exist for scripts/arena-2tab.mjs, and are handy by hand)
//   ?net=local|peer     transport backend, default peer
//   ?auto=host|join     skip the entry screen
//   ?room=CODE          room to join with auto=join
//   ?name=...           display name
//   ?mode=4v4           mode, ?difficulty=zor, ?seconds=60, ?goalLimit=0
//   ?autostart=1        host presses Başlat as soon as `?expect=N` humans are in

import { ArenaInput, installArenaKeys } from './input.js';
import { ArenaView } from './view.js';
import { ArenaMatch } from './match.js';
import { createTransport } from './transport.js';
import { AMSG, SETTING_VALUES, decodeLobby, encodeLobby, frameKind } from './protocol.js';
import { buildRoster, DIFFICULTIES, MODES, slotOf } from './roster.js';
import { DEFAULT_SETTINGS } from './matchRules.js';
import {
  HOST_ID, addPlayer, applyPick, applySettings, canStart, createLobby,
  humansFor, lobbyIssues, removePlayer, setReady,
} from './lobbyState.js';
import { normalizeCode, sanitizeName } from '../mp/protocol.js';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

const dom = {
  app: $('app'),
  entry: $('arenaEntry'),
  entryError: $('arenaEntryError'),
  name: $('arenaName'),
  solo: $('arenaSolo'),
  create: $('arenaCreate'),
  code: $('arenaCode'),
  join: $('arenaJoin'),
  backend: $('arenaBackend'),
  lobby: $('arenaLobbyView'),
  lobbyError: $('arenaLobbyError'),
  lobbyHint: $('arenaLobbyHint'),
  roomCode: $('arenaRoomCode'),
  copy: $('arenaCopy'),
  teamRed: $('arenaTeamRed'),
  teamBlue: $('arenaTeamBlue'),
  settings: $('arenaSettings'),
  switch: $('arenaSwitch'),
  keeperBtn: $('arenaKeeperBtn'),
  ready: $('arenaReady'),
  start: $('arenaStart'),
  leave: $('arenaLeave'),
  end: $('arenaEnd'),
  endTitle: $('arenaEndTitle'),
  endScore: $('arenaEndScore'),
  endBack: $('arenaEndBack'),
  keeperKeys: $('arenaKeeperKeys'),
};

const hud = {
  scoreRed: $('arenaScoreRed'),
  scoreBlue: $('arenaScoreBlue'),
  timer: $('arenaTimer'),
  diag: $('arenaDiag'),
  msg: $('arenaMsg'),
};

// ------------------------------------------------------------------- state

const held = installArenaKeys();
let backend = params.get('net') === 'local' ? 'local' : 'peer';
let transport = null;
let role = null; // 'host' | 'guest'
let myId = HOST_ID;
let lobby = createLobby(params.get('name') || 'Oyuncu', settingsFromParams());
let match = null;
let view = null;
let matchInput = null;
let myRoster = null;

// A URL is user input like any other: a value outside the closed set would
// build a lobby the validator refuses to put on the wire, and the room would
// then look broken for no visible reason.
function settingsFromParams() {
  const s = { ...DEFAULT_SETTINGS };
  const mode = params.get('mode');
  if (mode && MODES[mode]) s.mode = mode;
  const diff = params.get('difficulty');
  if (DIFFICULTIES.includes(diff)) s.difficulty = diff;
  const seconds = Number(params.get('seconds'));
  if (SETTING_VALUES.matchSeconds.includes(seconds)) s.matchSeconds = seconds;
  const goals = Number(params.get('goalLimit'));
  if (params.get('goalLimit') !== null && SETTING_VALUES.goalLimit.includes(goals)) {
    s.goalLimit = goals;
  }
  const mercy = Number(params.get('mercy'));
  if (params.get('mercy') !== null && Number.isInteger(mercy) && mercy >= 0 && mercy <= 20) {
    s.mercyGap = mercy;
  }
  return s;
}

// --------------------------------------------------------------- screens

function show(which) {
  for (const el of [dom.entry, dom.lobby, dom.end]) el.classList.add('hidden');
  if (which) which.classList.remove('hidden');
}

function fail(el, text) {
  el.textContent = text;
  el.classList.toggle('show', !!text);
}

// ---------------------------------------------------------------- lobby UI

function renderLobby() {
  dom.roomCode.textContent = transport?.code || '------';
  const mode = MODES[lobby.settings.mode];
  for (const team of [0, 1]) {
    const list = team === 0 ? dom.teamRed : dom.teamBlue;
    list.innerHTML = '';
    const mine = lobby.players.filter((p) => p.team === team);
    for (const p of mine) {
      const li = document.createElement('li');
      li.className = `p${p.id === myId ? ' you' : ''}`;
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = p.name;
      li.appendChild(nm);
      if (p.role === 'keeper') li.appendChild(tag('KALECİ', 'gk'));
      if (p.isHost) li.appendChild(tag('HOST'));
      else if (p.ready) li.appendChild(tag('HAZIR', 'ok'));
      list.appendChild(li);
    }
    const botCount = Math.max(0, mode.perTeam - mine.length);
    if (botCount > 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = `+ ${botCount} bot (${lobby.settings.difficulty})`;
      list.appendChild(li);
    }
  }

  for (const btn of dom.settings.querySelectorAll('button')) {
    const on = String(lobby.settings[btn.dataset.set]) === btn.dataset.value;
    btn.classList.toggle('on', on);
    btn.disabled = role !== 'host';
  }
  const me = lobby.players.find((p) => p.id === myId);
  dom.keeperBtn.disabled = !mode.keepers;
  dom.keeperBtn.textContent = me?.role === 'keeper' ? 'Kaleciliği Bırak' : 'Kaleci Ol';
  dom.ready.style.display = role === 'host' ? 'none' : '';
  dom.ready.textContent = me?.ready ? 'Hazır değilim' : 'Hazırım';
  dom.start.style.display = role === 'host' ? '' : 'none';
  const issues = lobbyIssues(lobby.players, lobby.settings);
  dom.start.disabled = issues.length > 0;
  dom.lobbyHint.textContent = mode.keepers
    ? 'Kaleci maç başında seçilir ve maç boyunca sabittir (ADR-0001). Boş kalan kaleci slotunu bot alır.'
    : `${mode.label}: kaleci yok, herkes saha oyuncusu. Boş slotlar bota gider.`;
  fail(dom.lobbyError, issues.join(' · '));
}

function tag(text, cls = '') {
  const s = document.createElement('span');
  s.className = `tag ${cls}`;
  s.textContent = text;
  return s;
}

function broadcastLobby() {
  if (role !== 'host' || !transport) return;
  for (const peerId of transport.peers()) {
    const frame = encodeLobby({
      t: AMSG.LOBBY,
      you: peerId,
      code: transport.code || '',
      players: lobby.players,
      settings: lobby.settings,
    });
    // encodeLobby validates on the way out, so a null here means the host built
    // a lobby its own protocol refuses. Silence would look like a dead room.
    if (!frame) {
      console.error('[arena] refusing to broadcast a malformed lobby', lobby.settings);
      return;
    }
    transport.sendRaw(peerId, frame);
  }
}

// -------------------------------------------------------------- transport

function makeTransport() {
  return createTransport({
    backend,
    onOpen: () => {
      show(dom.lobby);
      renderLobby();
      maybeAutoStart();
    },
    onPeerJoin: (id) => {
      if (role === 'guest') return; // the host answers our hello with a lobby
      broadcastLobby();
    },
    onPeerLeave: (id) => {
      if (role !== 'host') return;
      lobby.players = removePlayer(lobby.players, id);
      match?.peerLeft(id);
      broadcastLobby();
      renderLobby();
    },
    onFrame: (id, data) => onFrame(id, data),
    onError: (err) => fail(role ? dom.lobbyError : dom.entryError, errorText(err)),
    onClosed: () => {},
  });
}

function errorText(err) {
  const map = {
    'room-not-found': 'Oda bulunamadı. Kodu kontrol et.',
    'invalid-code': 'Oda kodu 6 karakter olmalı.',
    'id-taken': 'Oda kodu meşgul, tekrar dene.',
    'browser-unsupported': 'Tarayıcı bu bağlantıyı desteklemiyor.',
    network: 'Ağ hatası — sinyalleşme sunucusuna ulaşılamadı.',
  };
  return map[err?.code] || err?.message || 'Bilinmeyen hata';
}

function onFrame(peerId, data) {
  const kind = frameKind(data);
  if (kind === 'net') {
    match?.receive(peerId, data);
    return;
  }
  if (kind !== 'lobby') return;
  const msg = decodeLobby(data);
  if (!msg) return;

  if (role === 'host') {
    if (msg.t === AMSG.HELLO) {
      lobby.players = addPlayer(lobby.players, { id: peerId, name: msg.name });
      broadcastLobby();
      renderLobby();
      maybeAutoStart();
      return;
    }
    if (msg.t === AMSG.PICK) {
      const res = applyPick(lobby.players, peerId, msg, lobby.settings);
      lobby.players = res.players;
      broadcastLobby();
      renderLobby();
      return;
    }
    if (msg.t === AMSG.READY) {
      lobby.players = setReady(lobby.players, peerId, msg.ready);
      broadcastLobby();
      renderLobby();
      maybeAutoStart();
      return;
    }
    return;
  }

  // guest
  if (msg.t === AMSG.LOBBY) {
    myId = msg.you;
    lobby = { players: msg.players, settings: msg.settings };
    show(dom.lobby);
    renderLobby();
    return;
  }
  if (msg.t === AMSG.START) {
    startAsGuest(msg);
    return;
  }
  if (msg.t === AMSG.END) {
    match?.receive(peerId, data);
  }
}

// ------------------------------------------------------------------ match

function buildView(roster) {
  view?.dispose();
  view = new ArenaView(dom.app, { slots: roster.slots });
  return view;
}

function localIsKeeper(roster, index) {
  return roster.slots[index]?.role === 'keeper';
}

function startMatch(roster, settings, localIndex, opts = {}) {
  myRoster = roster;
  buildView(roster);
  matchInput = new ArenaInput({
    held,
    isKeeper: () => localIsKeeper(roster, localIndex),
  });
  dom.keeperKeys.style.opacity = localIsKeeper(roster, localIndex) ? '1' : '0.35';
  match = new ArenaMatch({
    role: opts.role,
    roster,
    settings,
    localIndex,
    transport: transport || nullTransport,
    hostPeerId: opts.hostPeerId || null,
    view,
    input: matchInput,
    hud,
    onEnd: (result) => showEnd(result),
  });
  show(null);
  match.start();
  window.__arena = arenaHandle();
}

function startAsHost() {
  const roster = buildRoster({
    mode: lobby.settings.mode,
    difficulty: lobby.settings.difficulty,
    humans: humansFor(lobby.players),
    seed: 1337,
  });
  const frame = encodeLobby({
    t: AMSG.START, seed: roster.seed, settings: lobby.settings, slots: roster.slots,
  });
  if (frame && transport) transport.broadcastRaw(frame);
  startMatch(roster, lobby.settings, slotOf(roster, myId), { role: 'host' });
}

function startAsGuest(msg) {
  const roster = {
    mode: msg.settings.mode,
    difficulty: msg.settings.difficulty,
    seed: msg.seed,
    slots: msg.slots,
    players: msg.slots.map((s) => ({ team: s.team, role: s.role })),
    botSlots: msg.slots.filter((s) => s.kind === 'bot').map((s) => s.index),
  };
  const index = slotOf(roster, myId);
  if (index < 0) {
    fail(dom.lobbyError, 'Host bu maçta sana slot vermedi.');
    return;
  }
  startMatch(roster, msg.settings, index, {
    role: 'guest',
    hostPeerId: transport.hostId,
  });
}

function showEnd(result) {
  const title = result.winner === -1
    ? 'Berabere'
    : `${result.winner === 0 ? 'Kırmızı' : 'Mavi'} kazandı`;
  dom.endTitle.textContent = `${title} (${result.reason})`;
  dom.endScore.textContent = `${result.score[0]} — ${result.score[1]}`;
  show(dom.end);
}

const nullTransport = {
  code: null,
  hostId: null,
  sendRaw: () => false,
  broadcastRaw: () => 0,
  peers: () => [],
  close: () => {},
};

// -------------------------------------------------------------- diagnostics

function arenaHandle() {
  return {
    get role() { return match?.role || role; },
    get mode() { return myRoster?.mode || lobby.settings.mode; },
    get backend() { return backend; },
    get code() { return transport?.code || null; },
    diag: () => (match ? match.diag() : null),
    checksumAt: (tick) => (match ? match.checksumAt(tick) : null),
    lobby: () => ({ players: lobby.players, settings: lobby.settings }),
    match: () => match,
    press: (code, down = true) => { if (down) held.add(code); else held.delete(code); },
    releaseAll: () => held.clear(),
  };
}
window.__arena = arenaHandle();

// ------------------------------------------------------------------- input

dom.name.value = sanitizeName(params.get('name') || localStorage.getItem('goalnet-name') || 'Oyuncu');
for (const btn of dom.backend.querySelectorAll('button')) {
  btn.classList.toggle('on', btn.dataset.backend === backend);
  btn.addEventListener('click', () => {
    backend = btn.dataset.backend;
    for (const b of dom.backend.querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset.backend === backend);
    }
  });
}

function rememberName() {
  const name = sanitizeName(dom.name.value);
  try { localStorage.setItem('goalnet-name', name); } catch { /* private mode */ }
  return name;
}

dom.solo.addEventListener('click', () => {
  role = 'host';
  myId = HOST_ID;
  lobby = createLobby(rememberName(), lobby.settings);
  show(dom.lobby);
  renderLobby();
});

dom.create.addEventListener('click', () => {
  role = 'host';
  myId = HOST_ID;
  lobby = createLobby(rememberName(), lobby.settings);
  transport = makeTransport();
  transport.host();
});

dom.join.addEventListener('click', () => {
  const code = normalizeCode(dom.code.value);
  if (code.length !== 6) {
    fail(dom.entryError, 'Oda kodu 6 karakter olmalı.');
    return;
  }
  role = 'guest';
  transport = makeTransport();
  const name = rememberName();
  transport.cb.onPeerJoin = (id) => {
    const frame = encodeLobby({ t: AMSG.HELLO, name });
    if (frame) transport.sendRaw(id, frame);
  };
  transport.join(code, name);
});

dom.copy.addEventListener('click', () => {
  if (transport?.code) navigator.clipboard?.writeText(transport.code);
});

dom.switch.addEventListener('click', () => {
  const me = lobby.players.find((p) => p.id === myId);
  if (!me) return;
  pick({ team: me.team === 0 ? 1 : 0, role: me.role });
});

dom.keeperBtn.addEventListener('click', () => {
  const me = lobby.players.find((p) => p.id === myId);
  if (!me) return;
  pick({ team: me.team, role: me.role === 'keeper' ? 'field' : 'keeper' });
});

function pick(next) {
  if (role === 'host') {
    const res = applyPick(lobby.players, myId, next, lobby.settings);
    lobby.players = res.players;
    if (!res.ok) fail(dom.lobbyError, refusal(res.reason));
    broadcastLobby();
    renderLobby();
    return;
  }
  const frame = encodeLobby({ t: AMSG.PICK, team: next.team, role: next.role });
  if (frame) transport.sendRaw(transport.hostId, frame);
}

function refusal(reason) {
  return {
    'mode-has-no-keeper': 'Bu modda kaleci yok.',
    'keeper-taken': 'Bu takımın kalecisi zaten var.',
    'team-full': 'Takım dolu.',
  }[reason] || '';
}

dom.ready.addEventListener('click', () => {
  const me = lobby.players.find((p) => p.id === myId);
  const frame = encodeLobby({ t: AMSG.READY, ready: !me?.ready });
  if (frame) transport.sendRaw(transport.hostId, frame);
});

for (const btn of dom.settings.querySelectorAll('button')) {
  btn.addEventListener('click', () => {
    if (role !== 'host') return;
    const key = btn.dataset.set;
    const raw = btn.dataset.value;
    const value = key === 'mode' || key === 'difficulty' ? raw : Number(raw);
    const next = applySettings(lobby.players, lobby.settings, { [key]: value });
    lobby = next;
    broadcastLobby();
    renderLobby();
  });
}

dom.start.addEventListener('click', () => {
  if (!canStart(lobby.players, lobby.settings)) return;
  startAsHost();
});

dom.leave.addEventListener('click', () => {
  transport?.close();
  transport = null;
  role = null;
  location.reload();
});

dom.endBack.addEventListener('click', () => {
  match?.stop();
  match = null;
  view?.dispose();
  view = null;
  show(role ? dom.lobby : dom.entry);
  if (role) renderLobby();
});

addEventListener('keydown', (e) => {
  if (e.code === 'KeyV' && view) view.cycleCamera();
});

// -------------------------------------------------------------- automation

function maybeAutoStart() {
  if (role !== 'host' || match) return;
  if (params.get('autostart') !== '1') return;
  const expect = Number(params.get('expect') || '1');
  const humans = lobby.players.length;
  if (humans < expect) return;
  if (!canStart(lobby.players, lobby.settings)) return;
  startAsHost();
}

const auto = params.get('auto');
if (auto === 'host') dom.create.click();
else if (auto === 'join') {
  dom.code.value = params.get('room') || '';
  dom.join.click();
} else if (auto === 'solo') {
  dom.solo.click();
  if (params.get('autostart') === '1') startAsHost();
}
