// Offline unit tests for the multiplayer wire protocol and the pure lobby
// reducers: no network, no peerjs, no DOM. protocol.js is the layer that has to
// survive hostile input; lobbyState.js is the host's decision logic, factored
// out of session.js precisely so it can be driven from node.
import {
  MSG, validate, packSnap, sanitizeName, sanitizeChat, normalizeCode, randomCode,
  isValidCode, MAX_NAME, MAX_PLAYERS, MAX_ROSTER, MAX_CHAT, DEFAULT_NAME,
  TEAM_PALETTE, DEFAULT_TEAM_COLORS,
} from '../packages/client/src/mp/protocol.js';
import {
  HOST_ID, RECONNECT_MS, CHAT_MIN_GAP_MS, CHAT_BURST, CHAT_WINDOW_MS,
  autoTeam, readyOf, allReady, canStart, setReady, clearReady,
  rosterFromPlayers, fieldPlayers, spectators, isBotId, nameKey,
  rememberDeparted, takeDeparted, forgetDeparted, pruneDeparted, chatAllowed,
} from '../packages/client/src/mp/lobbyState.js';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

const SETTINGS = { matchTime: 180, goalLimit: 5, goalScale: 1, keepers: true };
const BALL = { x: 0, y: 0.11, z: 0, vx: 1, vy: 0, vz: -2, wx: 0, wy: 3, wz: 0 };
const P = (over = {}) => ({
  id: 'peer-1', x: 1, z: -2, vx: 0, vz: 0, facing: 0.5,
  down: 0, charge: 0, kickAnim: 0, team: 0, role: 'field', ...over,
});
const SNAP = (over = {}) => ({
  t: MSG.SNAP, tick: 12, state: 'play', timeLeft: 42.5, score: [1, 0],
  ball: { ...BALL }, players: [P()], events: [], ...over,
});

// ------------------------------------------------------------------- hello
{
  const ok = validate({ t: 'hello', name: '  Ege  ' });
  check('hello: accepted and trimmed', ok?.name === 'Ege', JSON.stringify(ok));
  const long = validate({ t: 'hello', name: 'x'.repeat(60) });
  check('hello: name capped', long?.name.length === MAX_NAME, `len=${long?.name.length}`);
  const extra = { t: 'hello', name: 'A', admin: true, nested: { a: 1 } };
  const stripped = validate(extra);
  check('hello: extra fields stripped',
    Object.keys(stripped).join() === 't,name,spectate' && stripped !== extra,
    Object.keys(stripped).join());
  check('hello: non-string name rejected', validate({ t: 'hello', name: 42 }) === null);
  check('hello: spectate defaults to false',
    validate({ t: 'hello', name: 'A' })?.spectate === false);
  check('hello: spectate flag kept',
    validate({ t: 'hello', name: 'A', spectate: true })?.spectate === true);
  check('hello: truthy spectate rejected',
    validate({ t: 'hello', name: 'A', spectate: 1 }) === null);
  check('hello: string spectate rejected',
    validate({ t: 'hello', name: 'A', spectate: 'true' }) === null);
  const proto = validate(JSON.parse('{"t":"hello","name":"a","__proto__":{"polluted":true}}'));
  check('hello: no prototype pollution',
    proto !== null && ({}).polluted === undefined && proto.polluted === undefined);
}

// -------------------------------------------------------------------- team
{
  check('team: 0 accepted', validate({ t: 'team', team: 0 })?.team === 0);
  check('team: 1 accepted', validate({ t: 'team', team: 1 })?.team === 1);
  check('team: out of range rejected', validate({ t: 'team', team: 2 }) === null);
  check('team: string rejected', validate({ t: 'team', team: '1' }) === null);
  check('team: missing rejected', validate({ t: 'team' }) === null);
}

// ------------------------------------------------------------------- ready
{
  check('ready: true accepted', validate({ t: 'ready', ready: true })?.ready === true);
  check('ready: false accepted', validate({ t: 'ready', ready: false })?.ready === false);
  check('ready: missing rejected', validate({ t: 'ready' }) === null);
  check('ready: truthy number rejected', validate({ t: 'ready', ready: 1 }) === null);
  check('ready: string rejected', validate({ t: 'ready', ready: 'true' }) === null);
  check('ready: null rejected', validate({ t: 'ready', ready: null }) === null);
  const extra = validate({ t: 'ready', ready: true, id: 'host', force: true });
  check('ready: extra fields stripped', Object.keys(extra).join() === 't,ready',
    Object.keys(extra).join());
}

// -------------------------------------------------------------------- chat
{
  const ok = validate({ t: 'chat', text: '  merhaba  ' });
  check('chat: accepted and trimmed', ok?.text === 'merhaba', JSON.stringify(ok));
  check('chat: no from on the guest->host leg', ok?.from === undefined);
  const relayed = validate({ t: 'chat', from: ' Ege ', text: 'pas ver' });
  check('chat: host relay keeps a sanitized from',
    relayed?.from === 'Ege' && relayed.text === 'pas ver', JSON.stringify(relayed));
  const long = validate({ t: 'chat', text: 'x'.repeat(400) });
  check('chat: text capped at MAX_CHAT', long?.text.length === MAX_CHAT, `len=${long?.text.length}`);
  check('chat: empty rejected', validate({ t: 'chat', text: '' }) === null);
  check('chat: whitespace-only rejected', validate({ t: 'chat', text: '   \t  ' }) === null);
  check('chat: non-string rejected', validate({ t: 'chat', text: 42 }) === null);
  check('chat: missing text rejected', validate({ t: 'chat' }) === null);
  check('chat: object text rejected', validate({ t: 'chat', text: { a: 1 } }) === null);
  const ctrl = validate({ t: 'chat', text: 'ab​c\nd' });
  check('chat: control chars neutralised', ctrl?.text === 'a b c d', JSON.stringify(ctrl?.text));
  const markup = validate({ t: 'chat', text: '<script>alert(1)</script>' });
  check('chat: angle brackets dropped',
    !markup.text.includes('<') && !markup.text.includes('>'), markup?.text);
  const overLongFrom = validate({ t: 'chat', from: 'y'.repeat(60), text: 'hi' });
  check('chat: over-long from capped', overLongFrom?.from.length === MAX_NAME);
  const stripped = validate({ t: 'chat', text: 'hi', to: 'everyone', html: '<b>' });
  check('chat: extra fields stripped', Object.keys(stripped).join() === 't,text',
    Object.keys(stripped).join());
  check('sanitizeChat: non-string is empty', sanitizeChat(undefined) === '');
  check('sanitizeChat: collapses whitespace', sanitizeChat(' a   b ') === 'a b');
}

// ------------------------------------------------------------------- input
{
  const ok = validate({ t: 'input', seq: 7, x: 0.5, z: -1, kick: true });
  check('input: accepted', ok?.seq === 7 && ok.x === 0.5 && ok.kick === true, JSON.stringify(ok));
  const clamped = validate({ t: 'input', seq: 0, x: 99, z: -99, kick: false });
  check('input: axes clamped to -1..1', clamped?.x === 1 && clamped.z === -1, JSON.stringify(clamped));
  check('input: NaN axis rejected', validate({ t: 'input', seq: 1, x: NaN, z: 0, kick: false }) === null);
  check('input: Infinity axis rejected',
    validate({ t: 'input', seq: 1, x: Infinity, z: 0, kick: false }) === null);
  check('input: negative seq rejected',
    validate({ t: 'input', seq: -1, x: 0, z: 0, kick: false }) === null);
  check('input: fractional seq rejected',
    validate({ t: 'input', seq: 1.5, x: 0, z: 0, kick: false }) === null);
  check('input: truthy kick rejected',
    validate({ t: 'input', seq: 1, x: 0, z: 0, kick: 1 }) === null);
}

// ------------------------------------------------------------- lobby / start
{
  const msg = {
    t: 'lobby', you: 'peer-1', settings: { ...SETTINGS },
    players: [{ id: 'peer-1', name: 'Ege', team: 0, isHost: true }],
  };
  const ok = validate(msg);
  check('lobby: accepted', ok?.players[0].isHost === true && ok.settings.matchTime === 180);
  check('lobby: missing settings rejected', validate({ ...msg, settings: undefined }) === null);
  check('lobby: illegal matchTime rejected',
    validate({ ...msg, settings: { ...SETTINGS, matchTime: 90 } }) === null);
  check('lobby: missing keepers rejected',
    validate({ ...msg, settings: { matchTime: 60, goalLimit: 3, goalScale: 1 } }) === null);
  check('lobby: bad player entry rejected',
    validate({ ...msg, players: [{ id: 'p', name: 'n', team: 3, isHost: false }] }) === null);
  check('lobby: oversized roster rejected',
    validate({ ...msg, players: Array.from({ length: MAX_PLAYERS + 1 },
      (_, i) => ({ id: `p${i}`, name: 'n', team: 0, isHost: false })) }) === null);
  check('lobby: empty id rejected', validate({ ...msg, you: '' }) === null);
  check('lobby: oversized id rejected', validate({ ...msg, you: 'x'.repeat(300) }) === null);
  check('start: accepted', validate({ t: 'start', settings: { ...SETTINGS } })?.settings.keepers === true);
  check('start: bad goalScale rejected',
    validate({ t: 'start', settings: { ...SETTINGS, goalScale: 2 } }) === null);

  // ready / spectator flags on the lobby roster
  const flags = validate({
    ...msg,
    players: [
      { id: 'a', name: 'Ege', team: 0, isHost: true },
      { id: 'b', name: 'Mert', team: 1, isHost: false, ready: true },
      { id: 'c', name: 'Can', team: 0, isHost: false, spectator: true },
    ],
  });
  check('lobby: ready/spectator default to false',
    flags?.players[0].ready === false && flags.players[0].spectator === false);
  check('lobby: ready flag kept', flags?.players[1].ready === true);
  check('lobby: spectator flag kept', flags?.players[2].spectator === true);
  check('lobby: non-boolean ready rejected',
    validate({ ...msg, players: [{ id: 'a', name: 'n', team: 0, isHost: false, ready: 1 }] }) === null);
  check('lobby: non-boolean spectator rejected',
    validate({ ...msg, players: [{ id: 'a', name: 'n', team: 0, isHost: false, spectator: 'yes' }] }) === null);
  check('lobby: player entry has exactly the agreed keys',
    Object.keys(flags.players[0]).join() === 'id,name,team,isHost,ready,spectator',
    Object.keys(flags.players[0]).join());
}

// -------------------------------------------------------------- team colours
{
  const withColors = (teamColors) => validate({ t: 'start', settings: { ...SETTINGS, teamColors } });
  check('teamColors: absent falls back to the classic pair',
    validate({ t: 'start', settings: { ...SETTINGS } })?.settings.teamColors
      .join() === DEFAULT_TEAM_COLORS.join());
  const picked = withColors([TEAM_PALETTE[0][2], TEAM_PALETTE[1][3]]);
  check('teamColors: palette entries accepted',
    picked?.settings.teamColors[0] === TEAM_PALETTE[0][2]
    && picked.settings.teamColors[1] === TEAM_PALETTE[1][3]);
  check('teamColors: off-palette colour rejected', withColors([0x123456, TEAM_PALETTE[1][0]]) === null);
  check('teamColors: red colour on the blue side rejected',
    withColors([TEAM_PALETTE[0][0], TEAM_PALETTE[0][1]]) === null);
  check('teamColors: blue colour on the red side rejected',
    withColors([TEAM_PALETTE[1][0], TEAM_PALETTE[1][1]]) === null);
  check('teamColors: wrong length rejected', withColors([TEAM_PALETTE[0][0]]) === null);
  check('teamColors: three entries rejected',
    withColors([TEAM_PALETTE[0][0], TEAM_PALETTE[1][0], TEAM_PALETTE[0][1]]) === null);
  check('teamColors: string colour rejected',
    withColors([String(TEAM_PALETTE[0][0]), TEAM_PALETTE[1][0]]) === null);
  check('teamColors: fractional colour rejected',
    withColors([TEAM_PALETTE[0][0] + 0.5, TEAM_PALETTE[1][0]]) === null);
  check('teamColors: object rejected', withColors({ 0: TEAM_PALETTE[0][0] }) === null);
  check('teamColors: null rejected', withColors(null) === null);
  check('teamColors: palette sides are disjoint',
    TEAM_PALETTE[0].every((c) => !TEAM_PALETTE[1].includes(c)));
  check('teamColors: lobby carries them too',
    validate({
      t: 'lobby', you: 'p', players: [], settings: { ...SETTINGS, teamColors: [TEAM_PALETTE[0][1], TEAM_PALETTE[1][1]] },
    })?.settings.teamColors[0] === TEAM_PALETTE[0][1]);
}

// ------------------------------------------------------------- start roster
{
  const ROSTER = [
    { id: 'host', team: 0, role: 'field', name: 'Ege' },
    { id: 'p2', team: 1, role: 'field', name: 'Mert' },
    { id: 'kr', team: 0, role: 'keeper', name: '' },
  ];
  const start = (roster) => validate({ t: 'start', settings: { ...SETTINGS }, roster });
  const ok = start(ROSTER);
  check('start roster: accepted', ok?.roster.length === 3, JSON.stringify(ok?.roster?.[0]));
  check('start roster: names survive', ok?.roster[1].name === 'Mert');
  check('start roster: empty name falls back', ok?.roster[2].name === DEFAULT_NAME);
  check('start roster: role defaults to field',
    start([{ id: 'p', team: 0, name: 'A' }])?.roster[0].role === 'field');
  check('start roster: absent is an empty list (guest re-derives)',
    validate({ t: 'start', settings: { ...SETTINGS } })?.roster.length === 0);
  check('start roster: unknown role rejected',
    start([{ id: 'p', team: 0, role: 'striker', name: 'A' }]) === null);
  check('start roster: bad team rejected',
    start([{ id: 'p', team: 2, role: 'field', name: 'A' }]) === null);
  check('start roster: empty id rejected',
    start([{ id: '', team: 0, role: 'field', name: 'A' }]) === null);
  check('start roster: oversized id rejected',
    start([{ id: 'x'.repeat(300), team: 0, role: 'field', name: 'A' }]) === null);
  check('start roster: over-long name capped',
    start([{ id: 'p', team: 0, role: 'field', name: 'z'.repeat(80) }])?.roster[0].name.length === MAX_NAME);
  check('start roster: non-array rejected', start({ id: 'p' }) === null);
  check('start roster: oversized roster rejected',
    start(Array.from({ length: MAX_ROSTER + 1 },
      (_, i) => ({ id: `p${i}`, team: 0, role: 'field', name: 'A' }))) === null);
  check('start roster: entry has exactly the agreed keys',
    Object.keys(ok.roster[0]).join() === 'id,team,role,name', Object.keys(ok.roster[0]).join());
  check('start roster: extra entry fields stripped',
    start([{ id: 'p', team: 0, role: 'field', name: 'A', admin: true }])?.roster[0].admin === undefined);
}

// -------------------------------------------------------------------- snap
{
  check('snap: accepted', validate(SNAP())?.players[0].role === 'field');
  check('snap: unknown state rejected', validate(SNAP({ state: 'halftime' })) === null);
  check('snap: non-finite ball rejected',
    validate(SNAP({ ball: { ...BALL, vy: Infinity } })) === null);
  check('snap: missing ball field rejected',
    validate(SNAP({ ball: { x: 0, y: 0, z: 0 } })) === null);
  check('snap: bad score shape rejected', validate(SNAP({ score: [1] })) === null);
  check('snap: string score rejected', validate(SNAP({ score: ['1', 0] })) === null);
  check('snap: negative timeLeft floored', validate(SNAP({ timeLeft: -5 }))?.timeLeft === 0);
  check('snap: events default to []', validate(SNAP({ events: undefined }))?.events.length === 0);
  const ev = validate(SNAP({ events: [{ type: 'goal', scorer: 0, deep: { a: 1 }, note: 'x' }] }));
  check('snap: event scalars kept, objects stripped',
    ev?.events[0].scorer === 0 && ev.events[0].note === 'x' && ev.events[0].deep === undefined,
    JSON.stringify(ev?.events[0]));
  check('snap: event without type rejected', validate(SNAP({ events: [{ scorer: 1 }] })) === null);
  const partial = validate(SNAP({ players: [{ id: 'p', x: 0, z: 0, team: 1 }] }));
  check('snap: optional player fields default to 0',
    partial?.players[0].vx === 0 && partial.players[0].role === 'field');
  check('snap: NaN player position rejected',
    validate(SNAP({ players: [P({ x: NaN })] })) === null);
  check('snap: fractional tick rejected', validate(SNAP({ tick: 1.5 })) === null);
}

// ------------------------------------------------------------ kicked / end
{
  check('kicked: kick accepted', validate({ t: 'kicked', reason: 'kick' })?.reason === 'kick');
  check('kicked: ban accepted', validate({ t: 'kicked', reason: 'ban' })?.reason === 'ban');
  check('kicked: unknown reason rejected', validate({ t: 'kicked', reason: 'because' }) === null);
  check('end: accepted', validate({ t: 'end', score: [3, 2] })?.score[0] === 3);
  check('end: fractional score rejected', validate({ t: 'end', score: [3.5, 2] }) === null);
  check('end: negative score rejected', validate({ t: 'end', score: [-1, 2] }) === null);
}

// ----------------------------------------------------------- envelope guards
{
  check('envelope: unknown type rejected', validate({ t: 'exec', cmd: 'rm -rf' }) === null);
  check('envelope: missing type rejected', validate({ name: 'x' }) === null);
  check('envelope: null rejected', validate(null) === null);
  check('envelope: array rejected', validate([{ t: 'hello', name: 'a' }]) === null);
  check('envelope: string rejected', validate('{"t":"hello"}') === null);
  check('envelope: number rejected', validate(7) === null);
}

// ---------------------------------------------------------------- packSnap
{
  const packed = packSnap({
    tick: 3, state: 'kickoff', timeLeft: 60, score: [0, 0],
    ball: { ...BALL }, players: [P()], events: [{ type: 'kickoff' }],
  });
  check('packSnap: shapes a valid snap', packed?.t === MSG.SNAP && packed.tick === 3);
  check('packSnap: rejects malformed parts', packSnap({ tick: 0, state: 'play' }) === null);
  check('packSnap: rejects non-object', packSnap(null) === null);
}

// ----------------------------------------------------------------- helpers
{
  check('sanitizeName: collapses whitespace', sanitizeName('  Ege   Erberk ') === 'Ege Erberk');
  check('sanitizeName: strips control chars', sanitizeName('a\u0007b\u200bc') === 'a b c',
    JSON.stringify(sanitizeName('a\u0007b\u200bc')));
  check('sanitizeName: caps length', sanitizeName('y'.repeat(50)).length === MAX_NAME);
  check('sanitizeName: empty falls back', sanitizeName('   ') === DEFAULT_NAME);
  check('sanitizeName: non-string falls back', sanitizeName(undefined) === DEFAULT_NAME);

  check('normalizeCode: uppercases and strips', normalizeCode('ab-3d 9f') === 'AB3D9F');
  check('normalizeCode: caps at 6', normalizeCode('abcdefghij') === 'ABCDEF');
  check('normalizeCode: non-string is empty', normalizeCode(null) === '');
  check('normalizeCode: idempotent', normalizeCode(normalizeCode('a-b c1d2')) === normalizeCode('a-b c1d2'));

  check('isValidCode: accepts 6 alnum uppercase', isValidCode('AB3D9F'));
  check('isValidCode: rejects lowercase', isValidCode('ab3d9f') === false);
  check('isValidCode: rejects wrong length', isValidCode('AB3D9') === false);

  const codes = Array.from({ length: 500 }, randomCode);
  check('randomCode: always 6 chars', codes.every((c) => c.length === 6));
  check('randomCode: unambiguous alphabet', codes.every((c) => /^[A-HJ-NP-Z2-9]{6}$/.test(c)),
    codes.find((c) => !/^[A-HJ-NP-Z2-9]{6}$/.test(c)) || '');
  check('randomCode: passes isValidCode', codes.every(isValidCode));
  check('randomCode: survives normalizeCode', codes.every((c) => normalizeCode(c) === c));
  check('randomCode: varied', new Set(codes).size > 490, `${new Set(codes).size}/500 unique`);
}

// ------------------------------------------------- lobby reducers (pure logic)
const LP = (over = {}) => ({
  id: 'p1', name: 'Oyuncu', team: 0, isHost: false, ready: false, spectator: false, ...over,
});

// ---- roster building
{
  const players = [
    LP({ id: HOST_ID, name: 'Ege', isHost: true, ready: true }),
    LP({ id: 'p2', name: 'Mert', team: 1, ready: true }),
    LP({ id: 'bot1', name: 'Bot 1', team: 1 }),
    LP({ id: 's1', name: 'Deniz', spectator: true }),
  ];
  const roster = rosterFromPlayers(players, { keepers: true });
  check('roster: spectators excluded', !roster.some((e) => e.id === 's1'));
  check('roster: names carried through',
    roster.find((e) => e.id === HOST_ID)?.name === 'Ege'
    && roster.find((e) => e.id === 'p2')?.name === 'Mert');
  check('roster: every entry has id/team/role/name',
    roster.every((e) => Object.keys(e).join() === 'id,team,role,name'));
  check('roster: keepers appended last',
    roster.slice(-2).map((e) => e.id).join() === 'kr,kb');
  check('roster: keepers omitted when disabled',
    rosterFromPlayers(players, { keepers: false }).every((e) => e.role === 'field'));
  check('roster: bots stay on the pitch', roster.some((e) => e.id === 'bot1'));
  check('roster: survives the wire',
    validate({ t: 'start', settings: { ...SETTINGS }, roster })?.roster.length === roster.length);
  check('fieldPlayers/spectators partition the lobby',
    fieldPlayers(players).length === 3 && spectators(players).length === 1);
  check('isBotId: recognises bot slots', isBotId('bot3') && !isBotId('host') && !isBotId(undefined));
}

// ---- auto team balance
{
  check('autoTeam: first player goes red', autoTeam([]) === 0);
  check('autoTeam: fills the thinner side',
    autoTeam([LP({ id: 'a', team: 0 })]) === 1);
  check('autoTeam: ties go red',
    autoTeam([LP({ id: 'a', team: 0 }), LP({ id: 'b', team: 1 })]) === 0);
  check('autoTeam: spectators do not count',
    autoTeam([LP({ id: 'a', team: 0 }), LP({ id: 's', team: 1, spectator: true })]) === 1);
}

// ---- ready gating
{
  const host = LP({ id: HOST_ID, isHost: true });
  const bot = LP({ id: 'bot1' });
  const spec = LP({ id: 's1', spectator: true });
  const guest = LP({ id: 'g1' });
  check('readyOf: host is always ready', readyOf(host));
  check('readyOf: bots are always ready', readyOf(bot));
  check('readyOf: spectators need no ready', readyOf(spec));
  check('readyOf: a plain guest is not ready by default', readyOf(guest) === false);
  check('readyOf: a confirmed guest is ready', readyOf({ ...guest, ready: true }));

  const lobby = [host, guest, LP({ id: 'g2', team: 1 })];
  check('canStart: blocked while a guest is undecided', canStart(lobby) === false);
  check('allReady: false with one pending', allReady(lobby) === false);
  const bothReady = setReady(setReady(lobby, 'g1', true), 'g2', true);
  check('canStart: opens once every guest is ready', canStart(bothReady));
  check('setReady: returns a new array, leaves the old one alone',
    bothReady !== lobby && lobby[1].ready === false);
  check('canStart: needs two on the pitch',
    canStart([host, { ...spec, ready: true }]) === false);
  check('canStart: bots count as ready teammates',
    canStart([host, bot]) === true);
  check('canStart: rejects a non-array', canStart(null) === false);
  check('setReady: cannot unready the host',
    setReady([host], HOST_ID, false)[0].ready !== false || readyOf(setReady([host], HOST_ID, false)[0]));
  check('setReady: cannot unready a bot', readyOf(setReady([bot], 'bot1', false)[0]));
  check('setReady: ignores unknown ids', setReady(lobby, 'nobody', true).every((p, i) => p === lobby[i]));
  check('clearReady: resets confirmations after a match',
    clearReady(bothReady).filter((p) => p.ready === true).length === 0);
  check('clearReady: host still counts as ready', readyOf(clearReady(bothReady)[0]));
}

// ---- reconnect bookkeeping
{
  const t0 = 1_000_000;
  const departed = new Map();
  rememberDeparted(departed, { id: 'peer-a', name: 'Ege', team: 1, spectator: false }, t0);
  check('departed: remembers a dropped guest', departed.size === 1);
  check('departed: bots are not remembered',
    rememberDeparted(new Map(), { id: 'bot1', name: 'Bot 1', team: 0 }, t0).size === 0);

  const back = takeDeparted(departed, 'ege', t0 + 5000);
  check('departed: name match is case-insensitive', back?.id === 'peer-a');
  check('departed: restores the old team', back?.team === 1);
  check('departed: a claimed slot is consumed', departed.size === 0);

  const stale = new Map();
  rememberDeparted(stale, { id: 'peer-b', name: 'Mert', team: 0 }, t0);
  check('departed: expires after the window',
    takeDeparted(stale, 'Mert', t0 + RECONNECT_MS + 1) === null);
  check('departed: the expired record is dropped', stale.size === 0);

  const held = new Map();
  rememberDeparted(held, { id: 'peer-c', name: 'Can', team: 0 }, t0);
  check('departed: still valid one second before the deadline',
    takeDeparted(held, 'Can', t0 + RECONNECT_MS - 1000)?.id === 'peer-c');

  const moderated = new Map();
  rememberDeparted(moderated, { id: 'peer-d', name: 'Troll', team: 0 }, t0);
  forgetDeparted(moderated, 'Troll');
  check('departed: a kicked/banned slot is never restored',
    takeDeparted(moderated, 'Troll', t0 + 1000) === null);

  const mixed = new Map();
  rememberDeparted(mixed, { id: 'old', name: 'Eski', team: 0 }, t0);
  rememberDeparted(mixed, { id: 'new', name: 'Yeni', team: 1 }, t0 + RECONNECT_MS);
  pruneDeparted(mixed, t0 + RECONNECT_MS + 10);
  check('departed: prune only drops what expired',
    mixed.size === 1 && mixed.has(nameKey('Yeni')));

  const specSlot = new Map();
  rememberDeparted(specSlot, { id: 'peer-e', name: 'İzci', team: 0, spectator: true }, t0);
  check('departed: spectators come back as spectators',
    takeDeparted(specSlot, 'İzci', t0 + 10)?.spectator === true);
  check('nameKey: normalises whitespace and case', nameKey('  EGE  ') === nameKey('ege'));
}

// ---- chat throttling
{
  const buckets = new Map();
  const t0 = 500_000;
  check('chat throttle: first line passes', chatAllowed(buckets, 'p1', t0));
  check('chat throttle: an instant repeat is dropped', chatAllowed(buckets, 'p1', t0 + 10) === false);
  check('chat throttle: another peer is unaffected', chatAllowed(buckets, 'p2', t0 + 10));
  check('chat throttle: passes again after the gap',
    chatAllowed(buckets, 'p1', t0 + CHAT_MIN_GAP_MS + 1));

  // hammer one window at the fastest cadence the per-line gap allows
  const flood = new Map();
  let inWindow = 0;
  for (let t = t0; t < t0 + CHAT_WINDOW_MS; t += CHAT_MIN_GAP_MS + 1) {
    if (chatAllowed(flood, 'spammer', t)) inWindow++;
  }
  check('chat throttle: a burst is capped inside the window',
    inWindow <= CHAT_BURST, `${inWindow} lines got through`);
  check('chat throttle: the window reopens later',
    chatAllowed(flood, 'spammer', t0 + 60_000));
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
