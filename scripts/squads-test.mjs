// Every squad size actually plays, and nobody gets welded to a corner.
//
//   node scripts/squads-test.mjs
//
// Two questions the feature matrix asks and nothing answered:
//
//   1. 1v1, 2v2, 3v3 and 4v4 are offered by the menu and by the lobby. Does
//      every player in those rosters have a controller? The answer was no —
//      startMatch handed one to the first red, the first blue and the keepers,
//      so at 4v4 six of the eight outfielders stood on the kickoff spot for the
//      whole match. Nothing failed; they simply never moved.
//
//   2. Do players get stuck in the corners? A bot chases a point behind the
//      ball, and when the ball sits in a corner that point is OUTSIDE the
//      pitch. The bounds clamp then holds the player against the wall while it
//      keeps pushing, forever, and a team-mate arriving behind wedges it there.
//
// The second is measured rather than eyeballed: drive full bot-vs-bot matches
// and record, per player, the longest unbroken run of ticks spent pressed
// against a wall while trying to move. That number is the thing to drive down,
// and it is printed whether it passes or fails.

import {
  World, BotController, KeeperController, makeConfig,
} from '../packages/client/src/core/world-entry.js';
import { Game } from '../packages/client/src/game/game.js';
import {
  DT, PITCH_HALF_L, WALL_X, PLAYER_R,
} from '../packages/client/src/core/constants.js';

// The bots steer with Math.random, so an unseeded run is a different match
// every time and a gate that can fail on a bad roll is not a gate. Seeded
// here (mulberry32, the same generator crowdView uses); SQUADS_SEED picks the
// match, and a failure names the seed that reproduces it.
const SEED = Number(process.env.SQUADS_SEED || 1) >>> 0;
{
  let a = SEED || 1;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
console.log(`seed ${SEED}`);

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};
const section = (t) => console.log(`\n--- ${t}`);

function stubEl() {
  return {
    textContent: '', className: '',
    classList: { add() {}, remove() {}, contains() { return true; } },
    querySelector() { return null; },
    insertBefore() {}, appendChild() {},
  };
}
function stubDom() {
  const d = {};
  for (const k of ['scoreRed', 'scoreBlue', 'timer', 'msg', 'menu', 'end',
    'endTitle', 'endScore']) d[k] = stubEl();
  return d;
}
const stubCamera = { position: { set() {} }, lookAt() {} };

/** A match at the given size, every player driven the way the game drives it. */
function makeMatch({ teamSize, keepers }) {
  const config = makeConfig({
    teamSize, keepers, goalLimit: 0, matchTime: 300,
  });
  const world = new World(config);
  const game = new Game(world, stubCamera, stubDom(), null);
  // startMatch() is the code under test for question 1, but it also installs a
  // KeyboardController that needs a DOM. Every player is given a bot here and
  // the controller COVERAGE is asserted separately against startMatch's own
  // map below.
  const controllers = new Map();
  for (const p of world.players) {
    controllers.set(p, p.role === 'keeper'
      ? new KeeperController(world, p)
      : new BotController(world, p));
  }
  game.beginMatch(controllers, '1p');
  const now = performance.now() / 1000;
  game.kickoffAt = now - 1;
  game.update(DT, now);
  return { game, world, now };
}

// ---------------------------------------------------------------------------
section('A. every squad size fields a full team');

for (const teamSize of [1, 2, 3, 4]) {
  for (const keepers of [false, true]) {
    const { world } = makeMatch({ teamSize, keepers });
    const label = `${teamSize}v${teamSize}${keepers ? ' + kaleci' : ''}`;
    const perTeam = [0, 1].map((t) => world.players.filter((p) => p.team === t));
    const fieldPer = perTeam.map((ps) => ps.filter((p) => p.role === 'field').length);
    const keeperPer = perTeam.map((ps) => ps.filter((p) => p.role === 'keeper').length);
    // With keepers on, the keeper is carved OUT of the team size (modes-rules),
    // so a 4v4 with keepers is three outfielders and a keeper.
    const wantField = keepers ? Math.max(1, teamSize - 1) : teamSize;
    check(`${label}: both teams field ${wantField} outfielders`,
      fieldPer[0] === wantField && fieldPer[1] === wantField,
      `red=${fieldPer[0]} blue=${fieldPer[1]}`);
    check(`${label}: keepers ${keepers ? 'present' : 'absent'}`,
      keeperPer[0] === (keepers ? 1 : 0) && keeperPer[1] === (keepers ? 1 : 0),
      `red=${keeperPer[0]} blue=${keeperPer[1]}`);
  }
}

// ---------------------------------------------------------------------------
section('B. startMatch leaves nobody without a controller');

// KeyboardController reaches for the document; give it the least DOM that lets
// it construct, since what is under test is the SHAPE of the controller map.
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = { addEventListener() {}, removeEventListener() {} };
}
globalThis.addEventListener = globalThis.addEventListener || (() => {});

for (const teamSize of [1, 2, 3, 4]) {
  for (const mode of ['1p', '2p']) {
    const config = makeConfig({ teamSize, keepers: true, goalLimit: 0 });
    const world = new World(config);
    const game = new Game(world, stubCamera, stubDom(), null);
    game.startMatch(mode);
    const missing = world.players.filter((p) => !game.controllers.has(p));
    check(`${teamSize}v${teamSize} ${mode}: every player has a controller`,
      missing.length === 0,
      `${world.players.length} players, ${missing.length} without one`);
    // And they must not all be the human's: exactly one keyboard in 1p, two in
    // 2p, everyone else a bot or a keeper.
    const keyboards = [...game.controllers.values()]
      .filter((c) => c.constructor.name === 'KeyboardController').length;
    check(`${teamSize}v${teamSize} ${mode}: ${mode === '2p' ? 2 : 1} human seat(s)`,
      keyboards === (mode === '2p' ? 2 : 1), `${keyboards}`);
  }
}

// ---------------------------------------------------------------------------
section('C. nobody is welded to a wall');

/**
 * Drive a bot-vs-bot match and watch the walls.
 *
 * "Stuck" is deliberately strict: pressed within a centimetre of the bound,
 * moving slower than a walk, and the run has to be UNBROKEN. A player who
 * touches the wall, scrapes along it and leaves is playing football; one that
 * holds the same corner for seconds is a bug.
 */
function wallWatch({ teamSize, keepers, seconds }) {
  const { game, world } = makeMatch({ teamSize, keepers });
  const limX = WALL_X - PLAYER_R;
  const limZ = PITCH_HALF_L - PLAYER_R - 0.1;
  const run = new Map(world.players.map((p) => [p, 0]));
  const worst = new Map(world.players.map((p) => [p, 0]));
  let worstCorner = 0;
  // The ball's own corner stall. A player pinned to a wall for a second is
  // football; a ball parked in the corner arc while eight players fail to dig
  // it out is the match stopping, and it is the thing that actually reads as
  // "stuck in the corner" while playing.
  let ballRun = 0;
  let ballWorst = 0;
  let now = performance.now() / 1000;
  const steps = Math.round(seconds / DT);
  for (let f = 0; f < steps; f++) {
    world.step(DT);
    now += DT;
    game.update(DT, now);
    const b = world.ball.pos;
    const inCorner = Math.abs(b.x) > WALL_X - 2.2
      && Math.abs(b.z) > PITCH_HALF_L - 2.2;
    const ballSlow = Math.hypot(world.ball.vel.x, world.ball.vel.z) < 1.2;
    ballRun = inCorner && ballSlow ? ballRun + 1 : 0;
    if (ballRun > ballWorst) ballWorst = ballRun;
    for (const p of world.players) {
      const onX = Math.abs(Math.abs(p.pos.x) - limX) < 0.01;
      const onZ = Math.abs(Math.abs(p.pos.z) - limZ) < 0.01;
      const slow = p.speed() < 0.8;
      const pinned = (onX || onZ) && slow && p.down <= 0 && p.dive <= 0;
      const n = pinned ? run.get(p) + 1 : 0;
      run.set(p, n);
      if (n > worst.get(p)) worst.set(p, n);
      if (onX && onZ && n > worstCorner) worstCorner = n;
    }
  }
  const longest = Math.max(...worst.values());
  return {
    longest: longest * DT, corner: worstCorner * DT, ball: ballWorst * DT, world,
  };
}

for (const teamSize of [1, 2, 3, 4]) {
  const r = wallWatch({ teamSize, keepers: true, seconds: 180 });
  console.log(`     ${teamSize}v${teamSize}: longest wall pin ${r.longest.toFixed(2)}s, `
    + `corner pin ${r.corner.toFixed(2)}s, ball parked in a corner `
    + `${r.ball.toFixed(2)}s — over 180s`);
  // Two seconds is already a long time to be helpless; a real stick runs for
  // tens of seconds, so this separates the two without being flaky.
  check(`${teamSize}v${teamSize}: nobody is pinned to a wall for 2 s`,
    r.longest < 2.0, `${r.longest.toFixed(2)}s`);
  check(`${teamSize}v${teamSize}: nobody is stuck in a corner for 2 s`,
    r.corner < 2.0, `${r.corner.toFixed(2)}s`);
  // The ball gets longer: a corner scrap is part of the game. Five seconds of
  // nothing happening is not.
  check(`${teamSize}v${teamSize}: the ball never parks in a corner for 5 s`,
    r.ball < 5.0, `${r.ball.toFixed(2)}s`);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
