// Headless validation of the match rules layer: fouls and their restarts,
// two halves with a change of ends, sudden death, and the statistics counters.
import { World, BotController, KeeperController, makeConfig } from '../packages/client/src/core/world-entry.js';
import { Game } from '../packages/client/src/game/game.js';
import { MatchStats } from '../packages/client/src/game/stats.js';
import { DT, PITCH_HALF_L, PENALTY_SPOT_INSET, GOLDEN_MAX } from '../packages/client/src/core/constants.js';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

function fly(world, seconds, onFrame) {
  for (let f = 0; f < Math.round(seconds / DT); f++) {
    world.step(DT);
    if (onFrame) onFrame(world.drainEvents(), f);
  }
}

// ---------------------------------------------------------------- harness

// The Game talks to the HUD and the camera; both are stubbed so the rules can
// be exercised in node exactly as they run in the browser.
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

class Idle {
  constructor() { this.attackSign = 0; }
  update() { return { x: 0, z: 0, kick: false }; }
}

function makeGame(overrides = {}, roster = null) {
  const config = makeConfig({ keepers: false, goalLimit: 0, ...overrides });
  const world = new World(config);
  const game = new Game(world, stubCamera, stubDom(), roster);
  const events = [];
  game.onWorldEvent = (e, playing) => { if (playing) events.push(e); };
  const controllers = new Map();
  for (const p of world.players) {
    controllers.set(p, p.role === 'keeper'
      ? new KeeperController(world, p)
      : (overrides.bots ? new BotController(world, p) : new Idle()));
  }
  game.beginMatch(controllers, '1p');
  // drop straight into live play: the "Hazır…" gate is a view concern here
  const now = performance.now() / 1000;
  game.kickoffAt = now - 1;
  game.update(DT, now);
  return { game, world, events, controllers, now };
}

// Steps the world and the game together on a virtual clock.
function drive(game, world, seconds, now, onFrame) {
  for (let f = 0; f < Math.round(seconds / DT); f++) {
    world.step(DT);
    now += DT;
    game.update(DT, now);
    if (onFrame && onFrame(now) === false) break;
  }
  return now;
}

// Rolls the ball over the goal line at the given end and lets the game react.
function scoreInto(game, world, side, now) {
  game.setPiece = null;
  game.frozenUntil = 0;
  game.timeScale = 1;
  game.state = 'play';
  world.placeBall(0, side * (PITCH_HALF_L - 3));
  world.ball.vel = { x: 0, y: 0.4, z: side * 13 };
  world.ball.grounded = false;
  world.ball.lastTouch = undefined;
  return drive(game, world, 1.4, now, () => (game.state === 'goal' ? false : true));
}

// ------------------------------------------------------- 1) foul detection

// A slide that reaches the ball is a fair tackle however hard it lands.
function slide(ballX, ballZ) {
  const w = new World(makeConfig({ keepers: false }));
  const tackler = w.addPlayer(0);
  const victim = w.addPlayer(1);
  tackler.reset(0, -2);
  victim.reset(0.3, -0.6);
  w.ball.place(ballX, ballZ);
  tackler.startSlide(0, 1);
  const out = { foul: null, ragdoll: false, victim };
  fly(w, 1.5, (ev) => {
    for (const e of ev) {
      if (e.type === 'foul' && !out.foul) out.foul = e;
      if (e.type === 'ragdoll') out.ragdoll = true;
    }
  });
  return out;
}

{
  // the exact layout sim-test uses for 'slide: opponent flattened'
  const clean = slide(0.1, -0.9);
  check('foul: ball-winning slide still flattens', clean.ragdoll);
  check('foul: ball-winning slide is NOT a foul', clean.foul === null,
    JSON.stringify(clean.foul));

  const dirty = slide(5, 3);
  check('foul: ball-less slide is a foul', dirty.foul !== null);
  check('foul: awarded to the victim team', dirty.foul?.team === 1,
    JSON.stringify(dirty.foul));
  check('foul: spot is where the victim went down',
    dirty.foul !== null && Math.hypot(dirty.foul.x - 0.3, dirty.foul.z + 0.6) < 1.5,
    dirty.foul ? `x=${dirty.foul.x.toFixed(2)} z=${dirty.foul.z.toFixed(2)}` : '');

  // ball at the victim's feet, in front of the tackler: the man, not the ball
  const late = slide(0, 0.2);
  check('foul: late lunge past the ball is a foul', late.foul !== null);

  // a slide into a team-mate is never a foul
  const w = new World(makeConfig({ keepers: false }));
  const a = w.addPlayer(0), b = w.addPlayer(0);
  a.reset(0, -2); b.reset(0.3, -0.6); w.ball.place(6, 6);
  a.startSlide(0, 1);
  let mate = null;
  fly(w, 1.2, (ev) => { for (const e of ev) if (e.type === 'foul') mate = e; });
  check('foul: team-mates cannot foul each other', mate === null);
}

// ------------------------------------ 1b) shoulder charge feeds the same whistle
{
  // a reckless shoulder charge (closing speed past SHOULDER_FOUL_SPEED) goes
  // through the exact same onFoul pipeline a mistimed slide does — proof the
  // mechanic is wired into the real match flow, not just the core method
  const { game, world } = makeGame({ matchTime: 600 });
  let now = performance.now() / 1000;
  const red = world.players.find((p) => p.team === 0);
  const blue = world.players.find((p) => p.team === 1);
  game.state = 'play';
  red.reset(-0.65, 10); red.vel = { x: 9, z: 0 };
  blue.reset(0, 10); blue.vel = { x: -4, z: 0 }; // closing speed 13 m/s: reckless
  world.placeBall(6, 6); // ball nowhere near this
  now = drive(game, world, 0.2, now, () => (game.setPiece ? false : true));
  check('integration: a reckless shoulder charge is whistled',
    game.setPiece?.kind === 'freekick', game.setPiece?.kind ?? 'nothing');
  check('integration: awarded to the charged-into side', game.stats.fouls[0] === 1,
    `red=${game.stats.fouls[0]} blue=${game.stats.fouls[1]}`);
}

// --------------------------------- 1c) keeper hands via the real control path
{
  // catch -> hold -> release, driven through applyControls exactly like a
  // human or bot keeper would drive it (not the core tryCatch/releaseHold
  // API directly) — proof the mechanic is actually reachable in a match
  const config = makeConfig({ keepers: true, matchTime: 600 });
  const world = new World(config);
  const game = new Game(world, stubCamera, stubDom(), null);
  const redKeeper = world.players.find((p) => p.team === 0 && p.role === 'keeper');
  const others = world.players.filter((p) => p !== redKeeper);

  class FakeKeeper {
    constructor() { this.kick = false; }
    update() { return { x: 0, z: 0, kick: this.kick, slide: false, jump: false }; }
  }
  const keeperCtrl = new FakeKeeper();
  const controllers = new Map([[redKeeper, keeperCtrl]]);
  for (const p of others) controllers.set(p, new Idle());
  game.beginMatch(controllers, '1p');
  let now = performance.now() / 1000;
  game.kickoffAt = now - 1;
  game.state = 'play';
  redKeeper.reset(0, -(PITCH_HALF_L - 1.5));
  redKeeper.facing = 0;
  world.placeBall(0.2, -(PITCH_HALF_L - 1.8));
  world.ball.vel = { x: 0, y: 0, z: 0 };

  keeperCtrl.kick = true;
  now = drive(game, world, DT, now); // press: catch on the rising edge
  check('integration: keeper catch via applyControls', world.holder === redKeeper);

  keeperCtrl.kick = false;
  now = drive(game, world, 3 * DT, now); // quick release: a hand throw
  check('integration: a quick tap throws the ball, ball back in play',
    world.holder === null && Math.hypot(world.ball.vel.x, world.ball.vel.z) > 5,
    `holder=${world.holder} v=${Math.hypot(world.ball.vel.x, world.ball.vel.z).toFixed(1)}`);
}

// ---------------------------------------------- 2) free kick vs penalty spot

{
  // blue (team 1) attacks -z, so blue defends the +z end
  const { game, world, events } = makeGame({ matchTime: 60 });
  const now = performance.now() / 1000;
  game.state = 'play';

  // foul by blue inside blue's own box -> penalty for red
  game.onFoul({ type: 'foul', team: 0, x: 1.2, z: 15 }, now);
  const spot = world.ball.pos;
  check('penalty: given inside the offender box', game.setPiece?.kind === 'penalty',
    game.setPiece?.kind);
  check('penalty: ball on the spot',
    Math.abs(spot.x) < 1e-6 && Math.abs(spot.z - (PITCH_HALF_L - PENALTY_SPOT_INSET)) < 1e-6,
    `x=${spot.x.toFixed(2)} z=${spot.z.toFixed(2)}`);
  check('penalty: taker belongs to the fouled team', game.setPiece?.kicker?.team === 0);
  check('penalty: guest event emitted',
    events.some((e) => e.type === 'penalty' && e.team === 0));
  check('penalty: play is frozen for the ceremony',
    game.state === 'kickoff' && game.setPiece.live === false);

  // same offender, same half, but outside the box -> free kick on the spot
  game.setPiece = null;
  game.state = 'play';
  game.onFoul({ type: 'foul', team: 0, x: 1.2, z: 8 }, now);
  check('free kick: given outside the box', game.setPiece?.kind === 'freekick',
    game.setPiece?.kind);
  check('free kick: ball on the foul spot',
    Math.abs(world.ball.pos.x - 1.2) < 1e-6 && Math.abs(world.ball.pos.z - 8) < 1e-6,
    `x=${world.ball.pos.x.toFixed(2)} z=${world.ball.pos.z.toFixed(2)}`);

  // wide of the box, level with the goal: still only a free kick
  game.setPiece = null;
  game.state = 'play';
  game.onFoul({ type: 'foul', team: 0, x: 9.5, z: 16 }, now);
  check('free kick: wide of the box is not a penalty',
    game.setPiece?.kind === 'freekick', game.setPiece?.kind);

  // a foul by blue in RED's box is a free kick: the box that matters is the
  // one the offender defends
  game.setPiece = null;
  game.state = 'play';
  game.onFoul({ type: 'foul', team: 0, x: 0, z: -15 }, now);
  check('free kick: offender attacking third is not a penalty',
    game.setPiece?.kind === 'freekick', game.setPiece?.kind);
  check('foul: counted against the offender',
    game.stats.fouls[1] === 4 && game.stats.fouls[0] === 0,
    `red=${game.stats.fouls[0]} blue=${game.stats.fouls[1]}`);
}

// ------------------------------------------- 3) set piece freeze and release

{
  const { game, world } = makeGame({ matchTime: 60 });
  let now = performance.now() / 1000;
  game.state = 'play';
  game.onFoul({ type: 'foul', team: 0, x: 0, z: 4 }, now);
  const kicker = game.setPiece.kicker;
  const other = world.players.find((p) => p !== kicker);
  // during the ceremony nobody is allowed to move
  check('set piece: ceremony freezes the taker too', game.canAct(kicker) === false);
  check('set piece: ceremony freezes the opponent', game.canAct(other) === false);

  now = drive(game, world, 1.4, now);
  check('set piece: goes live after the ceremony',
    game.state === 'play' && game.setPiece?.live === true);
  check('set piece: taker may move', game.canAct(kicker) === true);
  check('set piece: opponent still held', game.canAct(other) === false);

  // the taking side puts the ball in motion -> everyone is released
  world.ball.lastTouch = 0;
  world.ball.vel = { x: 0, y: 0, z: 9 };
  game.update(DT, now + DT);
  check('set piece: released once the ball is struck', game.setPiece === null);
  check('set piece: opponent unfrozen', game.canAct(other) === true);
}

{
  // a restart that nobody takes must not deadlock the match
  const { game, world } = makeGame({ matchTime: 600 });
  let now = performance.now() / 1000;
  game.state = 'play';
  game.onFoul({ type: 'foul', team: 0, x: 0, z: 4 }, now);
  now = drive(game, world, 11, now);
  check('set piece: times out so play resumes', game.setPiece === null);
}

// --------------------------------------- 4) two halves and the change of ends

{
  // world level: the same goal mouth credits the other team after the swap
  const w = new World(makeConfig({ keepers: false }));
  check('swap: first half credits red at the +z goal', w.scorerAt(PITCH_HALF_L) === 0);
  check('swap: first half credits blue at the -z goal', w.scorerAt(-PITCH_HALF_L) === 1);
  w.sideSwap = true;
  check('swap: second half credits blue at the +z goal', w.scorerAt(PITCH_HALF_L) === 1);
  check('swap: second half credits red at the -z goal', w.scorerAt(-PITCH_HALF_L) === 0);
  check('swap: attack signs mirror', w.attackSign(0) === -1 && w.attackSign(1) === 1);
}

{
  // an empty pitch so the crediting is measured, not the goalkeeping
  const { game, world, events } = makeGame({ matchTime: 40 });
  let now = performance.now() / 1000;
  const red = world.players.find((p) => p.team === 0 && p.role === 'field');

  check('halves: match splits in two', game.halfLength === 20 && game.half === 1);
  check('halves: red starts in its own half', red.pos.z < 0, `z=${red.pos.z.toFixed(1)}`);

  // first half: the +z end is red's
  now = scoreInto(game, world, +1, now);
  check('halves: H1 goal at the +z end is red\'s',
    game.score[0] === 1 && game.score[1] === 0, JSON.stringify(game.score));

  // run the clock out on the first half
  game.state = 'play';
  game.timeLeft = 0.0001;
  now += DT;
  game.update(DT, now);
  check('halves: half time reached', game.half === 2 && world.sideSwap === true);
  check('halves: half event emitted', events.some((e) => e.type === 'half'));
  check('halves: clock reset for the second half',
    Math.abs(game.timeLeft - 20) < 0.05, `t=${game.timeLeft.toFixed(2)}`);
  check('halves: teams changed ends', red.pos.z > 0, `z=${red.pos.z.toFixed(1)}`);
  check('halves: the break freezes the pitch', now < game.frozenUntil);

  // second half: the very same end now belongs to blue
  now = scoreInto(game, world, +1, now);
  check('halves: H2 goal at the +z end is blue\'s',
    game.score[0] === 1 && game.score[1] === 1, JSON.stringify(game.score));

  // and the end red now attacks credits red
  now = scoreInto(game, world, -1, now);
  check('halves: H2 goal at the -z end is red\'s',
    game.score[0] === 2 && game.score[1] === 1, JSON.stringify(game.score));
}

{
  // the live bots and keepers turn around with the pitch
  const { game, world, controllers } = makeGame({ matchTime: 40, keepers: true, bots: true });
  const now = performance.now() / 1000;
  const red = world.players.find((p) => p.team === 0 && p.role === 'field');
  const blueKeeper = world.players.find((p) => p.team === 1 && p.role === 'keeper');
  check('halves: bot attacks +z in the first half',
    controllers.get(red).attackSign === 1);
  check('halves: keeper guards the -z line in the first half',
    Math.abs(controllers.get(blueKeeper).guardZ - (PITCH_HALF_L - 0.9)) < 1e-6,
    String(controllers.get(blueKeeper).guardZ));

  game.state = 'play';
  game.timeLeft = 0.0001;
  game.update(DT, now + DT);
  check('halves: bot attack sign flipped',
    controllers.get(red).attackSign === -1, String(controllers.get(red).attackSign));
  check('halves: keeper guard line moved',
    Math.abs(controllers.get(blueKeeper).guardZ + (PITCH_HALF_L - 0.9)) < 1e-6,
    String(controllers.get(blueKeeper).guardZ));
  check('halves: keeper lines up at its new goal',
    blueKeeper.pos.z < 0, `z=${blueKeeper.pos.z.toFixed(1)}`);
}

{
  // training mode ignores the clock entirely: no halves, no sudden death
  const { game, world } = makeGame({ matchTime: 40 });
  let now = performance.now() / 1000;
  game.mode = 'train';
  game.state = 'play';
  game.timeLeft = 0.0001;
  now = drive(game, world, 0.5, now);
  check('train: no half time', game.half === 1 && world.sideSwap === false);
  check('train: no sudden death', game.golden === false && game.state === 'play');
}

// ------------------------------------------------------- 5) the golden goal

{
  const { game, world, events } = makeGame({ matchTime: 40 });
  let now = performance.now() / 1000;
  game.half = 2;
  game.state = 'play';
  game.timeLeft = 0.0001;
  now += DT;
  game.update(DT, now);
  check('golden: level match goes to sudden death', game.golden === true);
  check('golden: event emitted', events.some((e) => e.type === 'golden'));
  check('golden: extra time granted',
    Math.abs(game.timeLeft - GOLDEN_MAX) < 0.05, `t=${game.timeLeft.toFixed(1)}`);
  check('golden: still playing', game.state === 'play');

  now = scoreInto(game, world, +1, now);
  check('golden: the goal is credited', game.score[0] === 1);
  // the celebration runs, then the match is over
  now = game.goalResetAt + 0.05;
  game.update(DT, now);
  check('golden: next goal ends the match', game.state === 'end');
}

{
  // nobody scores in sudden death: it stays a draw
  const { game, world } = makeGame({ matchTime: 40 });
  let now = performance.now() / 1000;
  game.half = 2;
  game.golden = true;
  game.state = 'play';
  game.timeLeft = 0.0001;
  now = drive(game, world, 0.2, now);
  check('golden: expires into a draw',
    game.state === 'end' && game.score[0] === game.score[1]);
}

{
  // a decided match does not go to sudden death
  const { game, world } = makeGame({ matchTime: 40 });
  let now = performance.now() / 1000;
  game.half = 2;
  game.score = [2, 1];
  game.state = 'play';
  game.timeLeft = 0.0001;
  now = drive(game, world, 0.2, now);
  check('golden: not triggered when a team leads',
    game.golden === false && game.state === 'end');
}

// -------------------------------------------------------------- 6) the stats

{
  const w = new World(makeConfig({ keepers: false }));
  const stats = new MatchStats();
  w.ball.lastTouch = 0;
  for (let i = 0; i < 60; i++) stats.update(DT, w);
  w.ball.lastTouch = 1;
  for (let i = 0; i < 20; i++) stats.update(DT, w);
  check('stats: possession accrues to the last toucher',
    stats.possession[0] > 0.9 && stats.possession[1] > 0.3 &&
    stats.possession[0] > stats.possession[1],
    `red=${stats.possession[0].toFixed(2)}s blue=${stats.possession[1].toFixed(2)}s`);
  const pct = stats.possessionPct();
  check('stats: possession percentages add to 100', pct[0] + pct[1] === 100,
    `${pct[0]}/${pct[1]}`);

  stats.foul(1);
  stats.foul(1);
  check('stats: fouls counted per team',
    stats.fouls[1] === 2 && stats.fouls[0] === 0);
  check('stats: table has a row per metric', stats.rows().length === 5);
}

{
  // a kick at the opponent goal is a shot; a pass backwards is not
  const w = new World(makeConfig({ keepers: false }));
  const stats = new MatchStats();
  const p = w.addPlayer(0);
  p.reset(0, 6);
  w.ball.place(0, 6.7);
  w.tryKick(p, 0.9);
  stats.onKick(0, w);
  check('stats: goalward kick is a shot', stats.shots[0] === 1, String(stats.shots[0]));

  w.ball.place(0, 6);
  w.ball.vel = { x: 0, y: 0, z: -12 }; // played back toward its own half
  stats.onKick(0, w);
  check('stats: backwards pass is not a shot', stats.shots[0] === 1, String(stats.shots[0]));
}

{
  // a shot that goes in is on target
  const { game, world } = makeGame({ matchTime: 600 });
  let now = performance.now() / 1000;
  const red = world.players.find((p) => p.team === 0 && p.role === 'field');
  game.state = 'play';
  red.reset(0, PITCH_HALF_L - 8.7);
  world.placeBall(0, PITCH_HALF_L - 8);
  world.tryKick(red, 1.0);
  now = drive(game, world, 1.6, now, () => (game.state === 'goal' ? false : true));
  check('stats: the shot was registered', game.stats.shots[0] === 1,
    String(game.stats.shots[0]));
  check('stats: a goal counts as on target', game.stats.onTarget[0] === 1,
    String(game.stats.onTarget[0]));
  check('stats: possession moved with the shooter', game.stats.possession[0] > 0,
    game.stats.possession[0].toFixed(2));

  // a goal out of a scramble, with no shot on the books, still books one
  const scrappy = new MatchStats();
  scrappy.onGoal(1);
  check('stats: a scrappy goal is never fewer shots than goals',
    scrappy.shots[1] === 1 && scrappy.onTarget[1] === 1,
    `shots=${scrappy.shots[1]} onTarget=${scrappy.onTarget[1]}`);
}

{
  // the keeper stops a shot: a save, and the shot was on target
  const { game, world } = makeGame({ matchTime: 600, keepers: true });
  let now = performance.now() / 1000;
  const blue = world.players.find((p) => p.team === 1 && p.role === 'field');
  game.state = 'play';
  // blue attacks -z, so red's keeper is the one under fire
  blue.reset(0, -(PITCH_HALF_L - 9.7));
  world.placeBall(0, -(PITCH_HALF_L - 9));
  world.tryKick(blue, 0.75);
  now = drive(game, world, 1.6, now, () => (game.state === 'goal' ? false : true));
  check('stats: keeper credited with a save', game.stats.saves[0] >= 1,
    String(game.stats.saves[0]));
  check('stats: the saved shot counted as on target', game.stats.onTarget[1] === 1,
    String(game.stats.onTarget[1]));
}

{
  // a real slide foul inside the box drives the whole chain end to end
  const { game, world, events } = makeGame({ matchTime: 600 });
  let now = performance.now() / 1000;
  const red = world.players.find((p) => p.team === 0);
  const blue = world.players.find((p) => p.team === 1);
  game.state = 'play';
  red.reset(0.3, 15.4);
  blue.reset(0, 14);
  world.placeBall(6, 4); // the ball is nowhere near this challenge
  blue.startSlide(0, 1);
  now = drive(game, world, 1.2, now, () => (game.setPiece ? false : true));
  check('integration: slide in the box gives a penalty',
    game.setPiece?.kind === 'penalty', game.setPiece?.kind ?? 'nothing');
  check('integration: foul event reached the guest hook',
    events.some((e) => e.type === 'foul'));
  check('integration: ball moved to the penalty spot',
    Math.abs(world.ball.pos.z - (PITCH_HALF_L - PENALTY_SPOT_INSET)) < 1e-6,
    `z=${world.ball.pos.z.toFixed(2)}`);
  check('integration: the foul is on blue\'s count', game.stats.fouls[1] === 1);
}

// -------------------------------------------------- 7) roster shapes (#5)

{
  // defaultRoster(config): the offline/fallback roster carves the keeper out
  // of the team size instead of adding it on top (4v4 kalecili = 3+1)
  const shapes = [
    { teamSize: 1, keepers: false, field: 1, keeper: 0 },
    { teamSize: 2, keepers: false, field: 2, keeper: 0 },
    { teamSize: 3, keepers: false, field: 3, keeper: 0 }, // 3v3: no keeper, by house rule
    { teamSize: 4, keepers: true, field: 3, keeper: 1 },  // 4v4 kalecili
  ];
  for (const s of shapes) {
    const config = makeConfig({ keepers: s.keepers, teamSize: s.teamSize, matchTime: 60 });
    const world = new World(config);
    new Game(world, stubCamera, stubDom(), null); // builds the roster via defaultRoster()
    const label = `${s.teamSize}v${s.teamSize}${s.keepers ? ' kalecili' : ''}`;
    for (const team of [0, 1]) {
      const field = world.players.filter((p) => p.team === team && p.role === 'field').length;
      const keeper = world.players.filter((p) => p.team === team && p.role === 'keeper').length;
      check(`roster ${label}: team ${team} has ${s.field} field player(s)`,
        field === s.field, `field=${field}`);
      check(`roster ${label}: team ${team} has ${s.keeper} keeper(s)`,
        keeper === s.keeper, `keeper=${keeper}`);
    }
  }
}

{
  // kickoff spread: a 4th+ field player used to land on the same spawn x as
  // the 1st (the old fixed 3-slot table wrapped with modulo) — now it fans
  // out to fit however many team-mates are on the pitch
  const config = makeConfig({ keepers: true, teamSize: 4, matchTime: 60 });
  const world = new World(config);
  new Game(world, stubCamera, stubDom(), null);
  for (const team of [0, 1]) {
    const xs = world.players
      .filter((p) => p.team === team && p.role === 'field')
      .map((p) => p.pos.x.toFixed(2));
    check(`kickoff: 4v4 field team-mates spawn at distinct x (team ${team})`,
      new Set(xs).size === xs.length, `xs=${xs.join(',')}`);
  }
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
