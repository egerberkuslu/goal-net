// Offline unit tests for the multiplayer wire protocol: no network, no peerjs.
// Only src/mp/protocol.js is imported (peer.js pulls in peerjs at module load),
// which is exactly the layer that has to survive hostile input.
import {
  MSG, validate, packSnap, sanitizeName, normalizeCode, randomCode, isValidCode,
  MAX_NAME, MAX_PLAYERS, DEFAULT_NAME,
} from '../src/mp/protocol.js';

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
    Object.keys(stripped).join() === 't,name' && stripped !== extra,
    Object.keys(stripped).join());
  check('hello: non-string name rejected', validate({ t: 'hello', name: 42 }) === null);
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

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
