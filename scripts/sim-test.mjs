// Headless validation of the arena world: goals register, nets don't tunnel,
// walls contain the ball, kicks and player collisions behave, perf budget holds.
import { World, Player, KeeperController, makeConfig } from '../packages/client/src/core/world-entry.js';
import {
  DT, PITCH_HALF_L, WALL_X, NET_BOT_DEPTH, BALL_R,
  JUMP_COOLDOWN, SLIDE_WINDOW, KEEPER_HOLD_TIME,
} from '../packages/client/src/core/constants.js';

// Deterministic harness: the bots jitter their targets and ragdolls pick a
// random tumble, so an unseeded run can drift a keeper a few centimetres and
// flip a threshold. Seeding here fixes the sequence without touching game
// behaviour — the same code paths run, they just stop being a coin toss.
const seededRandom = (seed) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
Math.random = seededRandom(0x9e3779b9);

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

const NET_LIMIT = PITCH_HALF_L + NET_BOT_DEPTH + 0.45;

function fly(world, seconds, onFrame) {
  const frames = Math.round(seconds / DT);
  for (let f = 0; f < frames; f++) {
    world.step(DT);
    if (onFrame) onFrame(world.drainEvents(), f);
  }
}

// 1) hard shot into far goal (B): goal event, no tunneling, absorbed
{
  const w = new World();
  w.ball.vel = { x: 0, y: 2, z: 26 };
  w.ball.grounded = false;
  let goal = null, maxZ = 0;
  fly(w, 2.5, (ev) => {
    for (const e of ev) if (e.type === 'goal') goal = e;
    maxZ = Math.max(maxZ, w.ball.pos.z);
    if (!Number.isFinite(w.ball.pos.z)) { maxZ = 1e9; }
  });
  check('shot B: goal event for red', goal?.scorer === 0, JSON.stringify(goal));
  check('shot B: no tunneling', maxZ < NET_LIMIT, `maxZ=${maxZ.toFixed(2)}`);
  check('shot B: absorbed', w.ball.speed() < 6, `v=${w.ball.speed().toFixed(2)}`);
}

// 2) curler into near goal (A)
{
  const w = new World();
  w.ball.place(2, -6);
  w.ball.vel = { x: -1.5, y: 3.5, z: -18 };
  w.ball.omega = { x: 0, y: 40, z: 0 };
  w.ball.grounded = false;
  let goal = null, minZ = 0;
  fly(w, 2.5, (ev) => {
    for (const e of ev) if (e.type === 'goal') goal = e;
    minZ = Math.min(minZ, w.ball.pos.z);
  });
  check('shot A: goal event for blue', goal?.scorer === 1, JSON.stringify(goal));
  check('shot A: no tunneling', minZ > -NET_LIMIT, `minZ=${minZ.toFixed(2)}`);
}

// 2b) the net SWALLOWS a 25 m/s shot: after the goal the ball never comes
//     back over the line, it settles in the pocket inside the celebration,
//     and it still never tunnels through the sheet.
function swallow(sign) {
  const w = new World();
  w.ball.place(-0.7 * sign, -4 * sign);
  w.ball.vel = { x: 1.2 * sign, y: 1.6, z: 24.9 * sign }; // |v| ≈ 25 m/s
  w.ball.grounded = false;
  const r = { goalT: null, minDepth: 1e9, maxOut: 0, lateSpeed: 0, deepest: 0 };
  fly(w, 4.6, (ev, f) => {
    const t = (f + 1) * DT;
    for (const e of ev) if (e.type === 'goal' && r.goalT === null) r.goalT = t;
    const z = w.ball.pos.z;
    r.deepest = Math.max(r.deepest, Math.abs(z));
    if (r.goalT === null) return;
    r.minDepth = Math.min(r.minDepth, sign * z - PITCH_HALF_L);
    if (t > r.goalT + 1.0) r.maxOut = Math.max(r.maxOut, -sign * w.ball.vel.z);
    if (t > r.goalT + 2.5) r.lateSpeed = Math.max(r.lateSpeed, w.ball.speed());
  });
  r.finalZ = w.ball.pos.z;
  return r;
}

for (const [name, sign] of [['swallow B', 1], ['swallow A', -1]]) {
  const r = swallow(sign);
  check(`${name}: goal event`, r.goalT !== null, `t=${r.goalT?.toFixed(2)}`);
  check(`${name}: never comes back over the line`, r.minDepth > -0.05,
    `minDepth=${r.minDepth.toFixed(3)}`);
  check(`${name}: no outward dribble`, r.maxOut <= 1, `outV=${r.maxOut.toFixed(2)}`);
  check(`${name}: settled in the pocket`,
    r.lateSpeed < 0.5 && Math.abs(r.finalZ) > PITCH_HALF_L + 0.15,
    `v=${r.lateSpeed.toFixed(2)} z=${r.finalZ.toFixed(2)}`);
  check(`${name}: no tunneling`, r.deepest < NET_LIMIT, `deepest=${r.deepest.toFixed(2)}`);
}

// 3) side wall bounce keeps the ball in
{
  const w = new World();
  w.ball.vel = { x: 18, y: 1, z: 4 };
  w.ball.grounded = false;
  let maxX = 0;
  fly(w, 2.0, () => { maxX = Math.max(maxX, Math.abs(w.ball.pos.x)); });
  check('wall: contained', maxX <= WALL_X - BALL_R + 0.02, `maxX=${maxX.toFixed(2)}`);
  check('wall: bounced back', Math.abs(w.ball.pos.x) < WALL_X - 0.5);
}

// 3b) a lofted ball clears the low boards and leaves the pitch (throw-in land)
{
  const w = new World();
  w.ball.vel = { x: 13, y: 7, z: 2 };
  w.ball.grounded = false;
  let maxX = 0;
  fly(w, 1.6, () => { maxX = Math.max(maxX, Math.abs(w.ball.pos.x)); });
  check('high ball: sails over the boards', maxX > WALL_X + 0.3, `maxX=${maxX.toFixed(2)}`);
}

// 3b2) once outside, the ball STAYS outside (no teleport back at low height)
{
  const w = new World();
  w.ball.place(6, 0);
  w.ball.vel = { x: 8.5, y: 5.2, z: 0 };
  w.ball.grounded = false;
  let maxX = 0;
  fly(w, 3.0, () => { maxX = Math.max(maxX, Math.abs(w.ball.pos.x)); });
  const finalX = w.ball.pos.x;
  check('out ball: crossed the boards', maxX > WALL_X + 0.3, `maxX=${maxX.toFixed(2)}`);
  check('out ball: not teleported back in', finalX > WALL_X, `x=${finalX.toFixed(2)}`);
}

// 3c) a chip over the crossbar leaves play behind the goal without scoring
{
  const w = new World();
  w.ball.place(0, 8);
  w.ball.vel = { x: 0, y: 9.5, z: 12 };
  w.ball.grounded = false;
  let goal = null, maxZ = 0;
  fly(w, 2.2, (ev) => {
    for (const e of ev) if (e.type === 'goal') goal = e;
    maxZ = Math.max(maxZ, w.ball.pos.z);
  });
  check('over the bar: no goal', goal === null);
  check('over the bar: left the pitch', maxZ > PITCH_HALF_L + 0.15, `maxZ=${maxZ.toFixed(2)}`);
}

// 3d) the strip at the posts belongs to the post/goal, not the boards:
//     a low shot just inside the post must score or hit the post, never
//     bounce off a phantom wall
{
  for (const x of [3.45, 3.58]) {
    const w = new World();
    w.ball.place(x, 9);
    w.ball.vel = { x: 0, y: 0.8, z: 16 };
    w.ball.grounded = false;
    let goal = null, woodwork = false;
    fly(w, 1.5, (ev) => {
      for (const e of ev) {
        if (e.type === 'goal') goal = e;
        if (e.type === 'post' || e.type === 'crossbar') woodwork = true;
      }
    });
    check(`post strip x=${x}: goal or woodwork, no phantom wall`,
      goal !== null || woodwork,
      `goal=${!!goal} wood=${woodwork} z=${w.ball.pos.z.toFixed(2)}`);
  }
}

// 3e) a player cannot shove the ball out of the arena. The boards only
//     rebound a ball that was inside, and player depenetration moves the
//     ball's prev alongside its pos, so reading prev for "was it inside"
//     made a shoved ball look like it had always been out: it escaped at
//     the corner and stayed there, unreachable.
{
  const w = new World();
  const p = w.addPlayer(0);
  const cx = WALL_X - BALL_R, cz = PITCH_HALF_L - BALL_R;
  w.ball.place(cx, cz);
  w.ball.vel = { x: 0, y: 0, z: 0 };
  w.ball.grounded = true;
  p.reset(cx - 0.6, cz - 0.6);
  let maxX = 0, maxZ = 0;
  for (let f = 0; f < Math.round(7 / DT); f++) {
    p.input.x = 1; p.input.z = 1;   // lean into the corner for seven seconds
    w.step(DT);
    w.drainEvents();
    maxX = Math.max(maxX, Math.abs(w.ball.pos.x));
    maxZ = Math.max(maxZ, Math.abs(w.ball.pos.z));
  }
  check('corner: shoving cannot push the ball past the boards',
    maxX <= WALL_X + 0.05 && maxZ <= PITCH_HALF_L + 0.05,
    `maxX=${maxX.toFixed(2)} maxZ=${maxZ.toFixed(2)}`);
}

// 4) end wall outside the mouth is solid (no phantom goal)
{
  const w = new World();
  w.ball.place(8, 0);
  w.ball.vel = { x: 0, y: 1, z: 24 };
  w.ball.grounded = false;
  let goal = null, maxZ = 0;
  fly(w, 2.0, (ev) => {
    for (const e of ev) if (e.type === 'goal') goal = e;
    maxZ = Math.max(maxZ, w.ball.pos.z);
  });
  check('end wall: no goal', goal === null);
  check('end wall: contained', maxZ <= PITCH_HALF_L - BALL_R + 0.02, `maxZ=${maxZ.toFixed(2)}`);
}

// 5) player blocks and pushes the ball
{
  const w = new World();
  const p = w.addPlayer(0);
  p.reset(0, 2);
  w.ball.place(0, -2);
  w.ball.vel = { x: 0, y: 0.5, z: 8 };
  w.ball.grounded = false;
  fly(w, 1.0);
  check('player: ball bounced off', w.ball.vel.z < 0 || w.ball.pos.z < p.pos.z,
    `z=${w.ball.pos.z.toFixed(2)} vz=${w.ball.vel.z.toFixed(2)}`);
}

// 6) kick launches the ball toward where the player faces it
{
  const w = new World();
  const p = w.addPlayer(0);
  p.reset(0, -1);
  w.ball.place(0, -0.3);
  const ok = w.tryKick(p, 0.8);
  check('kick: connects', ok);
  check('kick: powerful', w.ball.vel.z > 15 && w.ball.vel.y > 2,
    `vz=${w.ball.vel.z.toFixed(1)} vy=${w.ball.vel.y.toFixed(1)}`);
  const far = w.tryKick(p, 0.8); // ball already flew away next frames
  fly(w, 0.3);
  check('kick: out of range refused', w.tryKick(p, 0.5) === false && far === true);
}

// 6b) dribble: the ball rides at the feet through a run, and an about-turn
//     carries it around the body to the new front (orbital carry)
{
  const w = new World();
  const p = w.addPlayer(0);
  p.reset(0, -10);
  w.ball.place(0, -9.3);
  const drive = (ix, iz, seconds, onFrame) => {
    const frames = Math.round(seconds / DT);
    for (let f = 0; f < frames; f++) {
      p.input.x = ix; p.input.z = iz;
      w.step(DT);
      if (onFrame) onFrame((f + 1) * DT);
    }
  };
  const gap = () => Math.hypot(w.ball.pos.x - p.pos.x, w.ball.pos.z - p.pos.z);

  let sum = 0, n = 0, max = 0;
  drive(0, 1, 1.5, (t) => {
    if (t <= 0.3) return; // the first touches settle the ball at the feet
    const d = gap();
    sum += d; n++; max = Math.max(max, d);
  });
  const avg = sum / n;
  check('dribble: ball stays at the feet', avg < 1.0, `avg=${avg.toFixed(2)} m`);
  check('dribble: never gets away', max < 1.4, `max=${max.toFixed(2)} m`);

  let turnTime = null, frontTime = null;
  drive(0, -1, 1.4, (t) => {
    if (turnTime === null && p.vel.z < -4) turnTime = t;
    // ball has swung around to the NEW front (bearing -z) and is in reach
    const bx = w.ball.pos.x - p.pos.x, bz = w.ball.pos.z - p.pos.z;
    const dNow = Math.hypot(bx, bz);
    if (frontTime === null && bz < -0.25 && dNow < 1.0) frontTime = t;
  });
  check('dribble: about-turn accelerates freely',
    turnTime !== null && turnTime < 0.9,
    turnTime === null ? 'never reached -4 m/s' : `vz<-4 after ${turnTime.toFixed(2)} s`);
  check('dribble: ball orbits to the new front',
    frontTime !== null && frontTime < 0.9,
    frontTime === null ? 'ball never came around' : `in front after ${frontTime.toFixed(2)} s`);
  check('dribble: still carried after the turn', gap() < 1.1, `d=${gap().toFixed(2)} m`);
}

// 6c) the same run and about-turn with the carrier a shoulder off the ball's
//     line — the everyday case; the orbital carry must keep control too
{
  const w = new World();
  const p = w.addPlayer(0);
  p.reset(0.35, -10);
  w.ball.place(0, -9.3);
  const drive = (ix, iz, seconds, onFrame) => {
    for (let f = 0; f < Math.round(seconds / DT); f++) {
      p.input.x = ix; p.input.z = iz;
      w.step(DT);
      if (onFrame) onFrame((f + 1) * DT);
    }
  };
  drive(0, 1, 1.5);
  const carried = Math.hypot(w.ball.pos.x - p.pos.x, w.ball.pos.z - p.pos.z);
  check('dribble: off-centre ball still carried', carried < 1.0, `d=${carried.toFixed(2)} m`);
  drive(0, -1, 1.4);
  const after = Math.hypot(w.ball.pos.x - p.pos.x, w.ball.pos.z - p.pos.z);
  check('dribble: off-centre about-turn keeps control', after < 1.1,
    `d=${after.toFixed(2)} m`);
}

// 6d) a right-angle change of direction keeps the ball, it is a turn and not
//     an about-turn
{
  const w = new World();
  const p = w.addPlayer(0);
  p.reset(0, -13);
  w.ball.place(0, -12.3);
  let max = 0;
  for (let f = 0; f < Math.round(1.2 / DT); f++) { p.input.x = 0; p.input.z = 1; w.step(DT); }
  for (let f = 0; f < Math.round(1.2 / DT); f++) {
    p.input.x = 1; p.input.z = 0;
    w.step(DT);
    max = Math.max(max, Math.hypot(w.ball.pos.x - p.pos.x, w.ball.pos.z - p.pos.z));
  }
  check('dribble: right-angle turn keeps the ball', max < 1.4, `max=${max.toFixed(2)} m`);
}

// 6b2) sniper cap: a full-power shot aimed at the goal from close range must
//      stay under the bar instead of ballooning out of play
{
  const w = new World();
  const p = w.addPlayer(0);
  for (const dist of [5, 8, 11]) {
    p.reset(0, PITCH_HALF_L - dist - 0.9);
    w.ball.place(0, PITCH_HALF_L - dist);
    w.scoringLocked = false;
    w.tryKick(p, 1.0); // full charge, aim assist engaged (straight at goal)
    let goal = null, crossedHigh = false;
    fly(w, 1.2, (ev) => {
      for (const e of ev) if (e.type === 'goal') goal = e;
      if (Math.abs(w.ball.pos.z) > PITCH_HALF_L - 0.2 && w.ball.pos.y > 2.42) crossedHigh = true;
    });
    check(`sniper cap ${dist}m: no ballooning over the bar`, !crossedHigh && goal !== null,
      goal ? 'goal' : 'no goal scored');
  }
}

// 6b3) restart possession: the penalized team cannot touch the ball and is
//      held outside a 3m ring; the favored team's first touch clears it
{
  const w = new World();
  const bad = w.addPlayer(0);
  const good = w.addPlayer(1);
  w.ball.place(0, 0);
  w.restartTeam = 1;
  bad.reset(0.8, 0); // starts inside the ring
  good.reset(0, 6);
  // penalized player pushes toward the ball, favored player stays away
  for (let f = 0; f < Math.round(1.0 / DT); f++) {
    bad.input.x = -1; bad.input.z = 0;
    w.step(DT);
  }
  const dBad = Math.hypot(bad.pos.x - w.ball.pos.x, bad.pos.z - w.ball.pos.z);
  check('restart: penalized held out of the ring', dBad > 2.9, `d=${dBad.toFixed(2)}`);
  check('restart: penalized cannot kick', w.tryKick(bad, 0.5) === false);
  check('restart: ball untouched', Math.hypot(w.ball.vel.x, w.ball.vel.z) < 0.2);
  // favored team takes it
  good.reset(0, 1.2);
  const took = w.tryKick(good, 0.4);
  check('restart: favored team kicks freely', took !== false);
  check('restart: lock cleared on first touch', w.restartTeam === null);
}

// 6c) slide tackle: pokes the ball away and flattens the opponent
{
  const w = new World();
  const tackler = w.addPlayer(0);
  const victim = w.addPlayer(1);
  tackler.reset(0, -2);
  victim.reset(0.3, -0.6);
  w.ball.place(0.1, -0.9);
  const started = tackler.startSlide(0, 1);
  let victimDown = false, ballKicked = 0;
  fly(w, 1.5, () => {
    if (victim.down > 0) victimDown = true;
    ballKicked = Math.max(ballKicked, Math.hypot(w.ball.vel.x, w.ball.vel.z));
  });
  check('slide: starts', started === true);
  check('slide: ball poked away', ballKicked > 4 && ballKicked < 20,
    `v=${ballKicked.toFixed(1)}`);
  check('slide: opponent flattened', victimDown);
  check('slide: tackler recovers', tackler.dive === 0 && tackler.diveRecover === 0);
}

// 6e) jumping: height/hang-time band, no double-jump, landing cooldown
{
  const p = new Player(0);
  let peak = 0, landed = null;
  const started = p.startJump();
  for (let f = 0; f < Math.round(1.2 / DT); f++) {
    p.integrate(DT);
    peak = Math.max(peak, p.jumpY);
    if (landed === null && f > 0 && p.jumpY === 0) landed = (f + 1) * DT;
  }
  check('jump: takes off', started === true);
  check('jump: rises within the documented height band (0.85-1.05 m)',
    peak > 0.85 && peak < 1.05, `peak=${peak.toFixed(3)} m`);
  check('jump: back on the ground within the documented hang time (<1.0 s)',
    landed !== null && landed < 1.0, `landed at ${landed?.toFixed(2)} s`);
  check('jump: a landing cooldown is armed', p.jumpCooldown > 0,
    `cooldown=${p.jumpCooldown.toFixed(2)} s`);
}
{
  const p = new Player(0);
  const first = p.startJump();
  const midAirHeight = p.jumpY;
  const second = p.startJump(); // still airborne — must refuse
  check('jump: no double-jump while airborne',
    first === true && second === false && p.jumpY === midAirHeight);
  for (let f = 0; f < Math.round(1.2 / DT); f++) p.integrate(DT); // land
  const early = p.startJump(); // cooldown still running
  check('jump: cooldown blocks an immediate re-jump after landing', early === false);
  for (let f = 0; f < Math.round((JUMP_COOLDOWN + 0.05) / DT); f++) p.integrate(DT);
  const later = p.startJump();
  check('jump: jump is available again once the cooldown expires', later === true);
}

// 6f) jump extends reach: a ball above standing reach is untouchable to a
//     grounded player and becomes reachable mid-leap, same position, same ball
{
  const w = new World();
  const p = w.addPlayer(0);
  p.reset(0, 0);
  w.ball.place(0.3, 0);
  w.ball.pos.y = 2.0; // above a standing player's ~1.7 m reach
  w.ball.grounded = false;
  w.collideBallPlayers();
  check('jump: a standing player cannot touch a ball this high',
    w.ball.lastTouch !== p.team, `lastTouch=${w.ball.lastTouch}`);

  p.startJump();
  for (let f = 0; f < Math.round(0.35 / DT); f++) p.integrate(DT); // rising toward the apex
  w.ball.place(0.3, 0);
  w.ball.pos.y = 2.0;
  w.ball.grounded = false;
  w.collideBallPlayers();
  check('jump: the same ball, same spot, is reachable mid-leap',
    w.ball.lastTouch === p.team, `lastTouch=${w.ball.lastTouch} jumpY=${p.jumpY.toFixed(2)}`);
}

// 6g) shoulder-to-shoulder: a fair shove costs the pusher pace and moves the
//     victim off the ball's line; a reckless closing speed is a foul instead
{
  const w = new World();
  const a = w.addPlayer(0); // the pusher
  const b = w.addPlayer(1); // the victim
  a.reset(-0.65, 0); a.vel = { x: 5, z: 0 };
  b.reset(0, 0); b.vel = { x: -2, z: 0 }; // closing speed = 7 m/s, saturates the shove
  const pusherBefore = a.speed();
  w.collidePlayers();
  const lossFrac = 1 - a.speed() / pusherBefore;
  check('shoulder: pusher pays 20-35% of their own speed',
    lossFrac > 0.20 && lossFrac < 0.35, `loss=${(lossFrac * 100).toFixed(1)}%`);
  check('shoulder: victim is shoved off the line', b.vel.x > 0.5, `vx=${b.vel.x.toFixed(2)}`);
  check('shoulder: a fair closing speed is not a foul',
    w.drainEvents().every((e) => e.type !== 'foul'));
}
{
  const w = new World();
  const a = w.addPlayer(0);
  const b = w.addPlayer(1);
  a.reset(-0.65, 0); a.vel = { x: 9, z: 0 };
  b.reset(0, 0); b.vel = { x: -4, z: 0 }; // closing speed = 13 m/s: a reckless charge
  w.collidePlayers();
  const events = w.drainEvents();
  check('shoulder: a reckless closing speed is a foul on the charging side',
    events.some((e) => e.type === 'foul' && e.team === 1), JSON.stringify(events));
}
{
  // sustained contact reads as a cadence of jostles, not one shove per substep
  const w = new World();
  const a = w.addPlayer(0);
  const b = w.addPlayer(1);
  a.reset(-0.6, 0); a.input = { x: 1, z: 0 };
  b.reset(0.6, 0); b.input = { x: -1, z: 0 };
  let shoves = 0;
  for (let f = 0; f < Math.round(1.0 / DT); f++) {
    w.step(DT);
    for (const e of w.drainEvents()) if (e.type === 'shoulder') shoves++;
  }
  check('shoulder: cooldown caps repeated shoves over 1 s of contact',
    shoves >= 1 && shoves <= 5, `count=${shoves}`);
}

// 6h) slide tackle timing window: a late, mistimed lunge is a foul even when
//     it lands right next to the ball — the risk grows the longer the
//     tackler has been committed to the ground without connecting
{
  const w = new World();
  const tackler = w.addPlayer(0);
  const victim = w.addPlayer(1);
  tackler.reset(0, -3.25);
  victim.reset(0, 0);
  w.ball.place(0.1, 0.05); // right at the victim's feet: a "clean" tackle IF it lands in time
  tackler.startSlide(0, 1);
  let contactAt = null, foul = null;
  fly(w, 1.5, (ev, f) => {
    for (const e of ev) {
      if (e.type === 'ragdoll' && contactAt === null) contactAt = (f + 1) * DT;
      if (e.type === 'foul' && !foul) foul = e;
    }
  });
  check('slide: the lunge lands after the clean-win window',
    contactAt !== null && contactAt > SLIDE_WINDOW,
    `contact at ${contactAt?.toFixed(2)} s (window ${SLIDE_WINDOW} s)`);
  check('slide: a late challenge is a foul even with the ball right there',
    foul !== null, JSON.stringify(foul));
}

// 6i) keeper hands: catch, hold, forced release; hand throw vs. foot
//     clearance power; catching is gated to the box and to keepers only
{
  const w = new World();
  const keeper = w.addPlayer(0, 'keeper');
  keeper.reset(0, -(PITCH_HALF_L - 2));
  w.ball.place(0.2, -(PITCH_HALF_L - 2.3));
  w.ball.vel = { x: 0, y: 0, z: 0 };
  const caught = w.tryCatch(keeper);
  check('keeper: catches a slow ball inside the box', caught === true);
  check('keeper: the ball is pinned to him', w.holder === keeper);
  fly(w, 1.0);
  check('keeper: still holding well under the hold limit', w.holder === keeper,
    `holdTime=${w.holdTime.toFixed(2)} (limit ${KEEPER_HOLD_TIME})`);
  fly(w, 3.0); // crosses the KEEPER_HOLD_TIME clock
  check('keeper: the hold clock forces a release', w.holder === null);
  check('keeper: the forced release put the ball back in play',
    Math.hypot(w.ball.vel.x, w.ball.vel.z) > 5,
    `v=${Math.hypot(w.ball.vel.x, w.ball.vel.z).toFixed(1)}`);
}
{
  const w = new World();
  const keeper = w.addPlayer(0, 'keeper');
  keeper.reset(0, 0); // well outside the box
  w.ball.place(0.2, 0);
  check('keeper: cannot catch outside his own box', w.tryCatch(keeper) === false);

  const p = w.addPlayer(0, 'field');
  p.reset(0, -(PITCH_HALF_L - 2));
  w.ball.place(0.2, -(PITCH_HALF_L - 2.3));
  check('keeper: an outfield player cannot catch at all', w.tryCatch(p) === false);
}
{
  const throwRun = (kind, charge) => {
    const w = new World();
    const keeper = w.addPlayer(0, 'keeper');
    keeper.reset(0, -16);
    keeper.facing = 0; // faces +z, upfield for a first-half team 0
    w.ball.place(0.2, -15.8);
    w.ball.vel = { x: 0, y: 0, z: 0 };
    w.tryCatch(keeper);
    w.releaseHold(keeper, kind, charge);
    return Math.hypot(w.ball.vel.x, w.ball.vel.z);
  };
  const throwSpeed = throwRun('throw', 0);
  const clearSpeed = throwRun('clear', 1.0);
  check('keeper: a full foot clearance flies harder than the hand throw',
    clearSpeed > throwSpeed, `throw=${throwSpeed.toFixed(1)} clear=${clearSpeed.toFixed(1)}`);
  check('keeper: the clearance carries goal-kick distance',
    clearSpeed > 20, `clear=${clearSpeed.toFixed(1)}`);
}
{
  // grief lock: a release that curls straight back into the keeper's own net
  // before anyone else touches it is voided, not scored
  const w = new World();
  const keeper = w.addPlayer(0, 'keeper');
  keeper.reset(0, -17);
  w.ball.place(0, -17.3);
  w.tryCatch(keeper);
  w.releaseHold(keeper, 'clear', 0);
  w.ball.pos.x = 0; w.ball.pos.z = -18.05; // now over his own goal line
  w.checkGoal(-17.9);
  check('keeper: grief lock voids an own-net bounce right off the release',
    w.holder === keeper && w.scoringLocked === false,
    `holder=${w.holder === keeper} locked=${w.scoringLocked}`);
}

// 7) both nets idle-settle, everything stays finite
{
  const w = new World();
  fly(w, 2.0);
  let maxV = 0, finite = true;
  for (const net of w.nets) {
    const { vel, pos, count } = net;
    for (let i = 0; i < count; i++) {
      const v = Math.hypot(vel[i * 3], vel[i * 3 + 1], vel[i * 3 + 2]);
      maxV = Math.max(maxV, v);
      if (!Number.isFinite(pos[i * 3 + 2])) finite = false;
    }
  }
  check('idle: settles', maxV < 0.6, `maxV=${maxV.toFixed(3)}`);
  check('idle: finite', finite);
}

// 7b) a screamer knocks the player down, and they recover
{
  const w = new World();
  const p = w.addPlayer(1);
  p.reset(0, 3);
  w.ball.place(0, -2);
  w.ball.vel = { x: 0, y: 0.8, z: 16 };
  w.ball.grounded = false;
  let ragdolled = false;
  fly(w, 0.6, (ev) => { for (const e of ev) if (e.type === 'ragdoll') ragdolled = true; });
  check('ragdoll: knocked down', ragdolled && p.down > 0, `down=${p.down.toFixed(2)}`);
  const zAfterHit = p.pos.z;
  fly(w, 2.0);
  check('ragdoll: shoved along shot direction', zAfterHit > 3.05, `z=${zAfterHit.toFixed(2)}`);
  check('ragdoll: back up', p.down === 0);
}

// 8b) keeper saves a straight low shot at its goal
{
  const w = new World();
  const keeper = w.addPlayer(0, 'keeper');
  keeper.reset(0, -(PITCH_HALF_L - 0.9));
  const ctrl = new KeeperController(w, keeper);
  w.ball.place(0, 2);
  w.ball.vel = { x: 1.2, y: 0.6, z: -13 };
  w.ball.grounded = false;
  let goal = null;
  const frames = Math.round(2.5 / DT);
  for (let f = 0; f < frames; f++) {
    const c = ctrl.update(DT);
    keeper.input.x = c.x; keeper.input.z = c.z;
    // emulate the game layer's charge-release kick handling
    if (c.kick) { ctrl._held = (ctrl._held || 0) + DT; }
    else if (ctrl._held) { w.tryKick(keeper, Math.min(ctrl._held / 0.6, 1)); ctrl._held = 0; }
    w.step(DT);
    for (const e of w.drainEvents()) if (e.type === 'goal') goal = e;
  }
  check('keeper: save made', goal === null, JSON.stringify(goal));
  check('keeper: ball cleared fieldward', w.ball.pos.z > -PITCH_HALF_L + 1,
    `z=${w.ball.pos.z.toFixed(2)}`);
}

// 9) a smaller goal still scores down the middle, but its narrower mouth
//    rejects a shot that would beat a full-size goal
{
  const cfg = makeConfig({ goalScale: 0.8 });
  const w = new World(cfg);
  w.ball.vel = { x: 0, y: 1.5, z: 22 };
  w.ball.grounded = false;
  let goal = null, maxZ = 0;
  fly(w, 2.5, (ev) => {
    for (const e of ev) if (e.type === 'goal') goal = e;
    maxZ = Math.max(maxZ, w.ball.pos.z);
  });
  check('small goal: centre shot scores', goal?.scorer === 0, JSON.stringify(goal));
  check('small goal: no tunneling', maxZ < NET_LIMIT, `maxZ=${maxZ.toFixed(2)}`);

  const w2 = new World(makeConfig({ goalScale: 0.8 }));
  w2.ball.place(3.2, 0);
  w2.ball.vel = { x: 0, y: 1, z: 22 };
  w2.ball.grounded = false;
  let goal2 = null, maxZ2 = 0;
  fly(w2, 2.0, (ev) => {
    for (const e of ev) if (e.type === 'goal') goal2 = e;
    maxZ2 = Math.max(maxZ2, w2.ball.pos.z);
  });
  check('small goal: x=3.2 misses the narrowed mouth', goal2 === null, JSON.stringify(goal2));
  check('small goal: x=3.2 hits the end wall',
    maxZ2 <= PITCH_HALF_L - BALL_R + 0.02, `maxZ=${maxZ2.toFixed(2)}`);
}

// 8c) keeper dives for a corner-bound shot
{
  const w = new World();
  const keeper = w.addPlayer(0, 'keeper');
  keeper.reset(0, -(PITCH_HALF_L - 0.9));
  const ctrl = new KeeperController(w, keeper);
  w.ball.place(-2, -8);
  w.ball.vel = { x: 8.5, y: 0.8, z: -20.5 };
  w.ball.grounded = false;
  w.ball.lastTouch = 1;
  let goal = null, dived = false;
  const frames = Math.round(2.0 / DT);
  for (let f = 0; f < frames; f++) {
    const c = ctrl.update(DT);
    keeper.input.x = c.x; keeper.input.z = c.z;
    if (keeper.dive > 0) dived = true;
    w.step(DT);
    for (const e of w.drainEvents()) if (e.type === 'goal') goal = e;
  }
  check('dive: keeper left his feet', dived);
  check('dive: shot to the corner saved', goal === null, JSON.stringify(goal));
}

// 8d) keeper leaps for a ball floated in over his head
{
  const w = new World();
  const keeper = w.addPlayer(0, 'keeper');
  keeper.reset(0, -(PITCH_HALF_L - 0.9));
  const ctrl = new KeeperController(w, keeper);
  // crosses the keeper's line at ~2.1m: over a standing keeper, under the bar
  w.ball.place(0, -11);
  w.ball.vel = { x: 0.3, y: 6.6, z: -13.5 };
  w.ball.grounded = false;
  let goal = null, jumped = false;
  const frames = Math.round(2.0 / DT);
  for (let f = 0; f < frames; f++) {
    const c = ctrl.update(DT);
    keeper.input.x = c.x; keeper.input.z = c.z;
    if (keeper.jumpY > 0.1) jumped = true;
    w.step(DT);
    for (const e of w.drainEvents()) if (e.type === 'goal') goal = e;
  }
  check('leap: keeper jumped', jumped);
  check('leap: high ball kept out', goal === null, JSON.stringify(goal));
}

// 8) performance budget with two nets + players.
//
// Judged against a calibration workload measured in the same process, not
// against a fixed millisecond count. A shared machine can halve its effective
// speed (other processes, thermal/frequency scaling) and an absolute budget
// then fails on code that never changed — verified by A/B benching an older
// commit under load: it measured the same as HEAD. The ratio cancels all of
// that out, because both numbers move together.
//
// Anchor, from measurements: on an idle machine the step cost 8.1 ms/frame;
// under load it measures 14.3 ms against a 8.9 ms calibration, so the true
// ratio is ~1.6 and the implied idle calibration is 8.1/1.6 ≈ 5.1 ms. The
// original budget of 10 ms/frame is therefore a ceiling of 10/5.1 ≈ 1.95.
const PERF_RATIO_MAX = 1.95;
{
  const cpuMs = (fn) => {
    const c0 = process.cpuUsage();
    fn();
    const c = process.cpuUsage(c0);
    return (c.user + c.system) / 1000;
  };
  const calibrate = () => cpuMs(() => {
    let s = 0;
    for (let i = 1; i < 4_000_000; i++) s += Math.sqrt(i) * 1.000001;
    if (!Number.isFinite(s)) throw new Error('calibration collapsed');
  });
  const stepMs = () => {
    const w = new World();
    w.addPlayer(0).reset(0, -4);
    w.addPlayer(1).reset(0, 4);
    w.ball.vel = { x: 3, y: 4, z: 20 };
    w.ball.grounded = false;
    return cpuMs(() => fly(w, 3.0)) / (3.0 / DT);
  };
  calibrate(); stepMs(); // warm-up both paths before measuring
  const cal = Math.min(calibrate(), calibrate());
  const ms = Math.min(stepMs(), stepMs());
  const ratio = ms / cal;
  check('perf: step within budget', ratio < PERF_RATIO_MAX,
    `${ratio.toFixed(2)}x calibration (${ms.toFixed(2)} ms/frame, calib ${cal.toFixed(2)} ms)`);
}

// ---------------------------------------------------------------- wind
//
// Wind used to exist twice and be neither: a fixed sine in the net's
// integrator and a hardcoded slant on the rain, with the ball feeling nothing.
// These check that one air velocity now reaches everything, and that calm is
// still exactly the game everyone has been playing.
{
  const { setWind, calmWind, windAt, windBase } = await import('../packages/client/src/core/wind.js');

  calmWind();
  const calm = windAt(12.5);
  check('calm air is still air', calm.x === 0 && calm.y === 0 && calm.z === 0,
    JSON.stringify(calm));

  // A ball dropped from height in a crosswind must drift downwind, and a ball
  // dropped in calm must not move sideways at all.
  const drop = () => {
    const w = new World();
    w.ball.pos.x = 0; w.ball.pos.y = 6; w.ball.pos.z = 0;
    w.ball.prev.x = 0; w.ball.prev.y = 6; w.ball.prev.z = 0;
    w.ball.vel.x = 0; w.ball.vel.y = 0; w.ball.vel.z = 0;
    w.ball.omega.x = 0; w.ball.omega.y = 0; w.ball.omega.z = 0;
    for (let i = 0; i < 120; i++) w.step(1 / 60);
    return { x: w.ball.pos.x, z: w.ball.pos.z };
  };

  calmWind();
  const still = drop();
  check('a ball dropped in calm air falls straight',
    Math.abs(still.x) < 0.02 && Math.abs(still.z) < 0.02,
    `x ${still.x.toFixed(3)} z ${still.z.toFixed(3)}`);

  setWind(Math.PI / 2, 8);           // blowing towards +x
  const blown = drop();
  calmWind();
  check('the same ball drifts downwind',
    blown.x > 0.25 && Math.abs(blown.z) < 0.15,
    `x ${blown.x.toFixed(3)} z ${blown.z.toFixed(3)}`);

  // Into the wind a struck ball must fall SHORT of the same strike in calm:
  // that is the whole point of modelling air-relative velocity rather than
  // adding a push.
  const drive = () => {
    const w = new World();
    w.ball.pos.x = 0; w.ball.pos.y = 0.2; w.ball.pos.z = -12;
    w.ball.prev.x = 0; w.ball.prev.y = 0.2; w.ball.prev.z = -12;
    w.ball.vel.x = 0; w.ball.vel.y = 6; w.ball.vel.z = 18;
    w.ball.omega.x = 0; w.ball.omega.y = 0; w.ball.omega.z = 0;
    for (let i = 0; i < 90; i++) w.step(1 / 60);
    return w.ball.pos.z;
  };
  calmWind();
  const calmReach = drive();
  setWind(Math.PI, 9);               // straight back down the pitch, towards -z
  const intoWind = drive();
  calmWind();
  check('a drive into the wind falls short of the same drive in calm',
    intoWind < calmReach - 0.3,
    `calm ${calmReach.toFixed(2)} m, into wind ${intoWind.toFixed(2)} m`);

  // and the gust must actually vary, without ever reversing the prevailing air
  setWind(Math.PI / 2, 6);
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t < 40; t += 0.25) {
    const s = windAt(t).x;
    lo = Math.min(lo, s); hi = Math.max(hi, s);
  }
  check('gusts vary the speed without reversing it', lo > 0 && hi > lo * 1.2,
    `${lo.toFixed(2)} to ${hi.toFixed(2)} m/s`);
  check('the prevailing speed is reported for the HUD',
    Math.round(windBase().speed) === 6, `${windBase().speed.toFixed(2)} m/s`);
  calmWind();
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
