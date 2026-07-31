// Headless validation of the arena world: goals register, nets don't tunnel,
// walls contain the ball, kicks and player collisions behave, perf budget holds.
import { World, KeeperController, makeConfig } from '../src/core/world-entry.js';
import { DT, PITCH_HALF_L, WALL_X, NET_BOT_DEPTH, BALL_R } from '../src/core/constants.js';

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

// 8) performance budget with two nets + players
{
  const w = new World();
  w.addPlayer(0).reset(0, -4);
  w.addPlayer(1).reset(0, 4);
  w.ball.vel = { x: 3, y: 4, z: 20 };
  w.ball.grounded = false;
  const t0 = performance.now();
  fly(w, 5.0);
  const ms = (performance.now() - t0) / (5.0 / DT);
  check('perf: step under 10ms', ms < 10, `${ms.toFixed(2)} ms/frame`);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
