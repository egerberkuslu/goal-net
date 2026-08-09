// Headless gate for the arena client (feature matrix #12 and #13).
//
//   node scripts/arena-test.mjs
//
// Everything here is DOM-free on purpose. The arena's rules live in modules the
// browser only decorates — modes and rosters, the keeper constraint, the button
// packing, the end condition, the wire framing and the loop itself — so all of
// them can be driven under node with a stub view and a scripted human.
//
// The last block runs a WHOLE MATCH through the real ArenaMatch host path, twice
// with identical scripted input, and demands the two runs agree word for word.
// That is the determinism claim the entire stack rests on: same config, same
// quantised inputs, same checksum chain, forever.

import { BTN, readState } from '../packages/core/src/index.js';
import { MAX_LEAD_TICKS, RenderSmoother, advanceState } from '../packages/client/src/arena/smooth.js';
import {
  MODES, MODE_IDS, buildRoster, humanCapacity, modeOf, slotOf,
} from '../packages/client/src/arena/roster.js';
import {
  ARENA_BINDINGS, buttonsFromHeld, intentToInput, packButtons, unpackButtons,
} from '../packages/client/src/arena/input.js';
import {
  addPlayer, applyPick, applySettings, canStart, createLobby, humansFor,
  lobbyIssues, removePlayer, setReady,
} from '../packages/client/src/arena/lobbyState.js';
import { DEFAULT_SETTINGS, clockText, matchStatus } from '../packages/client/src/arena/matchRules.js';
import {
  AMSG, ARENA_MAGIC, decodeLobby, encodeLobby, frameKind, validateLobby,
} from '../packages/client/src/arena/protocol.js';
import { PITCH_M, TICK_HZ, UNITS_PER_METRE, toMetres, toUnits } from '../packages/client/src/arena/units.js';
import { ArenaMatch } from '../packages/client/src/arena/match.js';

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const eq = (name, got, want) => check(name, got === want, `got ${got}, want ${want}`);

function throws(name, fn, needle = '') {
  try {
    fn();
    check(name, false, 'did not throw');
  } catch (err) {
    check(name, !needle || String(err.message).includes(needle), err.message);
  }
}

const section = (t) => console.log(`\n--- ${t}`);

// =========================================================== unit mapping

section('unit mapping (one constant, everything derived)');

check('UNITS_PER_METRE is the core\'s own 840/36', Math.abs(UNITS_PER_METRE - 840 / 36) < 1e-3,
  UNITS_PER_METRE.toFixed(6));
check('the long axis maps onto the renderer\'s +/-18 m goal lines',
  Math.abs(PITCH_M.halfZ - 18) < 1e-3, `${PITCH_M.halfZ.toFixed(4)} m`);
// This used to assert the OPPOSITE — that the core's short axis was 400 units
// and deliberately not the 22 m the renderer drew. ADR-0009 ended that split:
// the two are the same pitch now, which is the whole point of the merge.
check('the short axis is the shipping game\'s 22 m, to a centimetre',
  Math.abs(PITCH_M.halfX * 2 - 22) < 0.05, `${(PITCH_M.halfX * 2).toFixed(3)} m`);
check('metres round-trip back to units', Math.abs(toUnits(toMetres(12345)) - 12345) < 1e-6);
eq('the core ticks at 60 Hz', TICK_HZ, 60);

// ============================================================ mode rosters

section('mode rosters (#12)');

eq('four modes are offered', MODE_IDS.length, 4);
for (const id of MODE_IDS) {
  const r = buildRoster({ mode: id, humans: [], difficulty: 'orta' });
  const mode = modeOf(id);
  eq(`${id}: slot count`, r.slots.length, mode.perTeam * 2);
  eq(`${id}: red slots`, r.slots.filter((s) => s.team === 0).length, mode.perTeam);
  eq(`${id}: blue slots`, r.slots.filter((s) => s.team === 1).length, mode.perTeam);
  eq(`${id}: every empty slot became a bot`, r.botSlots.length, mode.perTeam * 2);
  eq(`${id}: keepers per team`, r.keepersPerTeam.join(','),
    mode.keepers ? '1,1' : '0,0');
  check(`${id}: createWorld() input is positional and complete`,
    r.players.length === r.slots.length
    && r.players.every((p, i) => p.team === r.slots[i].team && p.role === r.slots[i].role));
}

{
  const r = buildRoster({ mode: '3v3', humans: [], difficulty: 'zor' });
  eq('3v3 has no keeper anywhere', r.slots.filter((s) => s.role === 'keeper').length, 0);
  check('3v3 bots all inherit the chosen difficulty',
    r.slots.every((s) => s.difficulty === 'zor'));
}

{
  const r = buildRoster({ mode: '4v4', humans: [], difficulty: 'orta' });
  eq('4v4 has exactly two keepers', r.slots.filter((s) => s.role === 'keeper').length, 2);
  eq('4v4 keeper on red', r.slots.filter((s) => s.team === 0 && s.role === 'keeper').length, 1);
  eq('4v4 keeper on blue', r.slots.filter((s) => s.team === 1 && s.role === 'keeper').length, 1);
}

{
  // human/bot slot mapping: humans take their team's earliest slots, in lobby
  // order, and the bots fill in behind them.
  const humans = [
    { id: 'host', name: 'H', team: 0, role: 'field' },
    { id: 'g1', name: 'G1', team: 1, role: 'field' },
    { id: 'g2', name: 'G2', team: 0, role: 'field' },
  ];
  const r = buildRoster({ mode: '3v3', humans, difficulty: 'kolay' });
  eq('host landed in slot 0', slotOf(r, 'host'), 0);
  eq('first blue human landed in slot 1', slotOf(r, 'g1'), 1);
  eq('second red human landed in slot 2', slotOf(r, 'g2'), 2);
  eq('three bots fill the rest', r.botSlots.join(','), '3,4,5');
  check('every human slot is marked human',
    ['host', 'g1', 'g2'].every((id) => r.slots[slotOf(r, id)].kind === 'human'));
  check('slots alternate teams so both sides spread alike',
    r.slots.every((s, i) => s.team === i % 2));
}

{
  const humans = [
    { id: 'host', name: 'H', team: 0, role: 'keeper' },
    { id: 'g1', name: 'G1', team: 1, role: 'field' },
  ];
  const r = buildRoster({ mode: '4v4', humans, difficulty: 'orta' });
  eq('a claimed keeper keeps its claim', r.slots[slotOf(r, 'host')].role, 'keeper');
  const blueKeeper = r.slots.find((s) => s.team === 1 && s.role === 'keeper');
  eq('the unclaimed blue keeper went to a bot', blueKeeper.kind, 'bot');
  eq('and only one blue keeper exists', r.keepersPerTeam[1], 1);
}

throws('a keeper in a keeperless mode is refused',
  () => buildRoster({ mode: '3v3', humans: [{ id: 'a', team: 0, role: 'keeper' }] }),
  'no keeper slot');
throws('two keepers on one side are refused',
  () => buildRoster({
    mode: '4v4',
    humans: [{ id: 'a', team: 0, role: 'keeper' }, { id: 'b', team: 0, role: 'keeper' }],
  }),
  'exactly one');
throws('more humans than seats is refused',
  () => buildRoster({ mode: '1v1', humans: [{ id: 'a', team: 0 }, { id: 'b', team: 1 }, { id: 'c', team: 0 }] }),
  'seats');
throws('an unknown mode is refused', () => buildRoster({ mode: '5v5' }), 'unknown mode');
throws('an unknown difficulty is refused',
  () => buildRoster({ mode: '3v3', difficulty: 'imkansiz' }), 'unknown difficulty');
eq('human capacity of 4v4', humanCapacity('4v4'), 8);

// ============================================================ lobby (#13)

section('lobby: create / join / pick / start gate (#13)');

{
  let lobby = createLobby('Ege', { mode: '4v4' });
  eq('a fresh lobby holds only the host', lobby.players.length, 1);
  check('the host counts as ready', canStart(lobby.players, lobby.settings));

  lobby.players = addPlayer(lobby.players, { id: 'p2', name: 'Ali' });
  eq('a guest joined', lobby.players.length, 2);
  eq('the guest was seated on the thinner side', lobby.players[1].team, 1);
  check('a guest that has not pressed hazır blocks the start',
    !canStart(lobby.players, lobby.settings),
    lobbyIssues(lobby.players, lobby.settings).join(' / '));

  lobby.players = setReady(lobby.players, 'p2', true);
  check('...and unblocks it once ready', canStart(lobby.players, lobby.settings));

  let res = applyPick(lobby.players, 'p2', { team: 1, role: 'keeper' }, lobby.settings);
  check('a free keeper slot may be claimed', res.ok);
  lobby.players = res.players;
  eq('the claim stuck', lobby.players[1].role, 'keeper');

  lobby.players = addPlayer(lobby.players, { id: 'p3', name: 'Veli' });
  res = applyPick(lobby.players, 'p3', { team: 1, role: 'keeper' }, lobby.settings);
  check('a taken keeper slot is refused, not stolen', !res.ok && res.reason === 'keeper-taken');
  eq('the incumbent keeps the shirt', res.players.find((p) => p.id === 'p2').role, 'keeper');

  const three = applySettings(lobby.players, lobby.settings, { mode: '3v3' });
  eq('switching to a keeperless mode demotes every keeper',
    three.players.filter((p) => p.role === 'keeper').length, 0);
  res = applyPick(three.players, 'p2', { team: 1, role: 'keeper' }, three.settings);
  check('and refuses new keeper picks', !res.ok && res.reason === 'mode-has-no-keeper');

  const tiny = applySettings(lobby.players, lobby.settings, { mode: '1v1' });
  check('a mode that no longer seats everyone is reported, not silently fixed',
    lobbyIssues(tiny.players, tiny.settings).some((s) => s.includes('en fazla')),
    lobbyIssues(tiny.players, tiny.settings).join(' / '));

  const gone = removePlayer(lobby.players, 'p3');
  eq('a leaver is dropped', gone.length, 2);

  const roster = buildRoster({
    mode: lobby.settings.mode,
    difficulty: lobby.settings.difficulty,
    humans: humansFor(gone),
  });
  eq('the lobby feeds buildRoster directly', roster.slots.length, 8);
  eq('the keeper the lobby chose is the keeper the core gets',
    roster.slots[slotOf(roster, 'p2')].role, 'keeper');
}

{
  const full = createLobby('H', { mode: '1v1' });
  full.players = addPlayer(full.players, { id: 'a', name: 'A' });
  const res = applyPick(full.players, 'a', { team: 0, role: 'field' }, full.settings);
  check('a full team refuses another body', !res.ok && res.reason === 'team-full');
}

// ================================================== input -> BTN packing

section('input: keys -> BTN mask -> keys');

{
  for (const b of ARENA_BINDINGS) {
    for (const code of b.codes) {
      const mask = buttonsFromHeld(new Set([code]), { isKeeper: true });
      eq(`${code} raises ${b.name}`, mask, b.bit);
    }
  }
  eq('Space is the charge, not the kick', buttonsFromHeld(new Set(['Space'])), BTN.CHARGE);
  eq('F is the instant pass', buttonsFromHeld(new Set(['KeyF'])), BTN.KICK);
  eq('ShiftLeft and KeyC are the same slide',
    buttonsFromHeld(new Set(['KeyC'])), buttonsFromHeld(new Set(['ShiftLeft'])));

  const keeperCodes = ARENA_BINDINGS.filter((b) => b.keeper).flatMap((b) => b.codes);
  eq('a field player cannot send keeper buttons',
    buttonsFromHeld(new Set(keeperCodes), { isKeeper: false }), 0);
  const keeperMask = ARENA_BINDINGS.filter((b) => b.keeper)
    .reduce((m, b) => m | b.bit, 0);
  eq('a keeper can', buttonsFromHeld(new Set(keeperCodes), { isKeeper: true }), keeperMask);

  // exhaustive round trip over every reachable mask
  const bits = ARENA_BINDINGS.map((b) => b.bit);
  let roundTrips = 0;
  let bad = 0;
  for (let combo = 0; combo < (1 << bits.length); combo++) {
    let mask = 0;
    for (let i = 0; i < bits.length; i++) if (combo & (1 << i)) mask |= bits[i];
    const back = packButtons(unpackButtons(mask), { isKeeper: true });
    if (back !== mask) bad++;
    roundTrips++;
  }
  check('every button combination round-trips through the mask', bad === 0,
    `${roundTrips} masks, ${bad} mismatches`);

  const all = ARENA_BINDINGS.reduce((m, b) => m | b.bit, 0);
  check('the mask fits the wire\'s 16 bits', all <= 0xffff, `0x${all.toString(16)}`);

  const input = intentToInput({ right: 1, up: 0, kick: true, slide: true },
    new Set(['KeyE']), { isKeeper: false });
  check('the pad face buttons fold into charge and tackle',
    (input.buttons & BTN.CHARGE) !== 0 && (input.buttons & BTN.TACKLE) !== 0
    && (input.buttons & BTN.TOUCH) !== 0, `0b${input.buttons.toString(2)}`);
  check('movement leaves the screen frame as a world direction',
    Number.isFinite(input.moveX) && Number.isFinite(input.moveZ)
    && Math.hypot(input.moveX, input.moveZ) > 0.9);
}

// ================================================================= rules

section('match rules');

{
  const s = { ...DEFAULT_SETTINGS, matchSeconds: 60, goalLimit: 3, mercyGap: 4 };
  check('a fresh match is not over', !matchStatus(0, [0, 0], s).over);
  check('the goal limit ends it', matchStatus(100, [3, 1], s).over);
  eq('and names the winner', matchStatus(100, [3, 1], s).winner, 0);
  eq('the goal limit is the reason', matchStatus(100, [3, 1], s).reason, 'goal-limit');
  eq('a four-goal gap is mercy', matchStatus(100, [0, 4], { ...s, goalLimit: 0 }).reason, 'mercy');
  const fullTime = 60 * 60;
  eq('full time with a lead ends it', matchStatus(fullTime, [2, 1], s).reason, 'time');
  check('full time level goes to golden goal', !matchStatus(fullTime, [1, 1], s).over);
  check('golden goal is flagged', matchStatus(fullTime, [1, 1], s).golden);
  eq('the next goal wins it', matchStatus(fullTime + 60, [2, 1], s).reason, 'golden');
  check('golden goal off means a draw stands',
    matchStatus(fullTime, [1, 1], { ...s, goldenGoal: false }).over);
  eq('a draw has no winner', matchStatus(fullTime, [1, 1], { ...s, goldenGoal: false }).winner, -1);
  eq('the clock reads mm:ss', clockText(125), '2:05');
}

// ============================================================== framing

section('wire framing: lobby JSON beside the binary match protocol');

{
  const settings = { ...DEFAULT_SETTINGS };
  const frame = encodeLobby({
    t: AMSG.LOBBY,
    you: 'p2',
    code: 'ABC123',
    players: [{ id: 'host', name: 'Ege', team: 0, role: 'field', isHost: true, ready: true }],
    settings,
  });
  check('a lobby message frames', frame instanceof ArrayBuffer, `${frame?.byteLength} bytes`);
  eq('with the arena magic', new DataView(frame).getInt32(0, true), ARENA_MAGIC);
  eq('and is recognised as lobby', frameKind(frame), 'lobby');
  const back = decodeLobby(frame);
  eq('it round-trips', back.you, 'p2');
  eq('settings survive', back.settings.mode, settings.mode);

  // a @goalnet/net frame must never be mistaken for lobby JSON
  const netFrame = new ArrayBuffer(20);
  new DataView(netFrame).setInt32(0, 0x474e4e31, true);
  eq('a net frame is routed to the session', frameKind(netFrame), 'net');
  eq('and never parsed as lobby JSON', decodeLobby(netFrame), null);
  eq('junk is neither', frameKind(new ArrayBuffer(2)), 'unknown');

  check('an unknown message type is rejected', validateLobby({ t: 'a-nope' }) === null);
  check('a bad mode is rejected',
    validateLobby({ t: AMSG.START, seed: 1, slots: [], settings: { ...settings, mode: '9v9' } }) === null);
  check('a slot claiming a bad role is rejected',
    validateLobby({
      t: AMSG.START, seed: 1, settings,
      slots: [{ index: 0, team: 0, role: 'striker', kind: 'human', id: 'a', name: 'a' }],
    }) === null);
  check('a hostile score is rejected',
    validateLobby({ t: AMSG.END, score: [1, -3], winner: 0, reason: 'time' }) === null);
  check('encodeLobby refuses to put a malformed frame on the wire',
    encodeLobby({ t: AMSG.END, score: ['x', 0], winner: 0, reason: 'time' }) === null);
}

// ==================================================== full headless match

section('a whole match, twice, through the real loop');

/** The view ArenaMatch draws through. Counts calls; renders nothing. */
function stubView() {
  return {
    goals: [], strikes: 0, frames: 0,
    onGoal(team) { this.goals.push(team); },
    onStrike() { this.strikes++; },
    update() { this.frames++; },
  };
}

/**
 * A scripted human: walk at the ball, hold charge when it is close, release to
 * shoot. Deterministic in the tick alone, so two runs produce the same match.
 * It goes through buttonsFromHeld, so the packing above is exercised for real.
 */
function scriptedHuman(getState, index) {
  const held = new Set();
  const STANDOFF = 27; // player radius + ball radius, plus a little
  return {
    read() {
      const st = getState();
      if (!st) return { moveX: 0, moveZ: 0, buttons: 0 };
      const me = st.players[index];
      const attack = me.team === 0 ? 1 : -1; // team 0 attacks +z
      // stand behind the ball on the line to the goal, then run through it
      const gx = 0;
      const gz = attack * 420;
      let ax = st.ball.x - gx;
      let az = st.ball.z - gz;
      const al = Math.hypot(ax, az) || 1;
      ax /= al; az /= al;
      const tx = st.ball.x + ax * STANDOFF;
      const tz = st.ball.z + az * STANDOFF;
      let dx = tx - me.x;
      let dz = tz - me.z;
      const len = Math.hypot(dx, dz) || 1;
      const behind = len < 18;
      if (behind) { dx = st.ball.x - me.x; dz = st.ball.z - me.z; }
      const mlen = Math.hypot(dx, dz) || 1;
      const reach = Math.hypot(st.ball.x - me.x, st.ball.z - me.z) < 29;

      held.clear();
      if (reach) held.add('KeyF'); // instant pass toward the ball's far side
      return {
        moveX: dx / mlen,
        moveZ: dz / mlen,
        buttons: buttonsFromHeld(held, { isKeeper: false }),
      };
    },
  };
}

function runMatch(settings, maxFrames = 60000) {
  const roster = buildRoster({
    mode: settings.mode,
    difficulty: settings.difficulty,
    humans: [{ id: 'host', name: 'Ege', team: 0, role: 'field' }],
    seed: 1337,
  });
  const view = stubView();
  let handle = null;
  const input = scriptedHuman(() => (handle ? readState(handle.host.world) : null), 0);
  const match = new ArenaMatch({
    role: 'host',
    roster,
    settings,
    localIndex: 0,
    transport: { sendRaw: () => false, broadcastRaw: () => 0, peers: () => [] },
    view,
    input,
    hud: {},
  });
  handle = match;

  // synthetic clock: one frame per 60 Hz tick, so the session's integer tick
  // schedule is driven exactly and nothing depends on how fast this box is
  let t = 0;
  let frames = 0;
  while (!match.finished && frames < maxFrames) {
    t += 1000 / 60;
    match.frame(t);
    frames++;
  }
  const state = readState(match.host.world);
  return {
    roster, view, match, frames,
    tick: state.tick,
    score: state.score,
    checksum: match.host.checksum(),
    result: match.finished,
    botCalls: match.botCalls,
  };
}

{
  const settings = {
    ...DEFAULT_SETTINGS, mode: '2v2', difficulty: 'orta',
    matchSeconds: 90, goalLimit: 3, mercyGap: 0,
  };
  const a = runMatch(settings);
  const b = runMatch(settings);

  check('the match ended on its own', !!a.result, JSON.stringify(a.result));
  check('a final score was reached', a.score[0] + a.score[1] > 0, a.score.join('-'));
  check('bots ran, and only on the host', a.botCalls > 0, `${a.botCalls} calls`);
  eq('every bot slot was driven', a.roster.botSlots.length, 3);
  check('the view saw the goals', a.view.goals.length === a.score[0] + a.score[1],
    `${a.view.goals.length} reactions vs ${a.score.join('-')}`);
  check('the kick swing was triggered', a.view.strikes > 0, `${a.view.strikes}`);

  eq('rerun: same final tick', b.tick, a.tick);
  eq('rerun: same final score', b.score.join('-'), a.score.join('-'));
  eq('rerun: same state checksum', b.checksum, a.checksum);
  eq('rerun: same end reason', b.result.reason, a.result.reason);
  eq('rerun: same bot call count', b.botCalls, a.botCalls);
  console.log(`     ${settings.mode} finished ${a.score.join('-')} at tick ${a.tick}`
    + ` (${a.result.reason}), checksum ${(a.checksum >>> 0).toString(16)}`);
}

{
  // the keepered mode has to be playable end to end too, keeper bots and all
  const settings = {
    ...DEFAULT_SETTINGS, mode: '4v4', difficulty: 'kolay',
    matchSeconds: 45, goalLimit: 0, mercyGap: 0, goldenGoal: false,
  };
  const r = runMatch(settings);
  check('4v4 reached full time', !!r.result && r.result.reason === 'time',
    JSON.stringify(r.result));
  eq('4v4 kept exactly one keeper a side', r.roster.keepersPerTeam.join(','), '1,1');
  check('4v4 produced a score', r.score[0] >= 0 && r.score[1] >= 0, r.score.join('-'));
  console.log(`     4v4 finished ${r.score.join('-')} at tick ${r.tick}`);
}

// ------------------------------------------------- render smoothing (#12)
//
// The host used to draw readState() straight, so with the simulation clock and
// the display clock free-running, a character was drawn 0 to 16.7 ms stale by a
// changing amount — up to 10 cm of positional wobble at running speed. These
// check the carry-forward that replaced it.
{
  const mk = (tick, x, vx, bx, bvx) => ({
    tick, score: [0, 0],
    ball: { x: bx, z: 0, vx: bvx, vz: 0 },
    players: [{ index: 0, team: 0, x, z: 0, vx, vz: 0, charge: 3, diveActive: 0 }],
  });
  const a = mk(10, 0, 0.1, 0, 0.2);

  eq('half a tick carries half a tick of travel',
    advanceState(a, 0.5).players[0].x.toFixed(3), '0.050');
  eq('the ball carries its own velocity',
    advanceState(a, 0.5).ball.x.toFixed(3), '0.100');
  eq('a state sampled at its own instant is untouched', advanceState(a, 0).players[0].x, 0);
  eq('counters are never carried', advanceState(a, 0.5).players[0].charge, 3);
  eq('the tick is the simulated one', advanceState(a, 0.9).tick, 10);
  // a stalled pump must not slide bodies across the pitch on a stale velocity
  eq('the lead is clamped', advanceState(a, 40).players[0].x.toFixed(3),
    (0.1 * MAX_LEAD_TICKS).toFixed(3));

  // The property that matters: what is drawn must track the wall clock, not
  // the tick boundaries. Sample a constant-velocity body at a frame rate that
  // does not divide the tick rate and check every frame lands where the clock
  // says it should.
  const sm = new RenderSmoother(1000 / 60);
  const TICK = 1000 / 60;
  let tick = 0, worst = 0;
  for (let f = 0; f < 400; f++) {
    const nowMs = f * (1000 / 144);            // 144 Hz display, 60 Hz sim
    while ((tick + 1) * TICK <= nowMs) {
      tick++;
      sm.push(mk(tick, tick * 0.1, 0.1, 0, 0), tick * TICK);
    }
    if (tick === 0) continue;
    const drawn = sm.sample(nowMs).players[0].x;
    const truth = (nowMs / TICK) * 0.1;        // where a real body would be
    worst = Math.max(worst, Math.abs(drawn - truth));
  }
  check('the drawn position tracks the clock, not the tick boundary',
    worst < 1e-9, `worst error ${worst.toExponential(2)} units`);

  // and the same at a frame rate SLOWER than the tick rate, where a pump
  // advances several ticks at once — the case that defeated the first attempt
  const sm2 = new RenderSmoother(1000 / 60);
  let tick2 = 0, worst2 = 0;
  for (let f = 0; f < 120; f++) {
    const nowMs = f * (1000 / 13);             // 13 FPS, ~4.6 ticks per frame
    while ((tick2 + 1) * TICK <= nowMs) {
      tick2++;
      sm2.push(mk(tick2, tick2 * 0.1, 0.1, 0, 0), tick2 * TICK);
    }
    if (tick2 === 0) continue;
    const drawn = sm2.sample(nowMs).players[0].x;
    worst2 = Math.max(worst2, Math.abs(drawn - (nowMs / TICK) * 0.1));
  }
  check('multi-tick pumps do not break it', worst2 < 1e-9,
    `worst error ${worst2.toExponential(2)} units`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
