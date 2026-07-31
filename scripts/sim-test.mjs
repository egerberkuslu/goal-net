// Headless validation of the arena world: goals register, nets don't tunnel,
// walls contain the ball, kicks and player collisions behave, perf budget holds.
import { World, KeeperController } from '../src/core/world-entry.js';
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
