// Headless physics validation: no tunneling, no NaN, net stays bounded,
// on-target shots are absorbed by the net.
import { World } from '../src/core/world-entry.js';
import { DT, NET_BOT_DEPTH } from '../src/core/constants.js';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

function runShot(name, vel, omega, seconds = 2.5) {
  const world = new World();
  world.placeBall(0, 11);
  world.shoot(vel, omega);
  let minZ = Infinity, maxNetDisp = 0, touchedNet = false;
  const frames = Math.round(seconds / DT);
  for (let f = 0; f < frames; f++) {
    world.step(DT);
    for (const e of world.drainEvents()) if (e.type === 'net') touchedNet = true;
    const b = world.ball.pos;
    if (!Number.isFinite(b.x + b.y + b.z)) {
      check(`${name}: finite ball`, false, `frame ${f}`);
      return null;
    }
    minZ = Math.min(minZ, b.z);
    const { pos, count } = world.net;
    for (let i = 0; i < count; i++) {
      const z = pos[i * 3 + 2];
      if (!Number.isFinite(z)) {
        check(`${name}: finite net`, false, `node ${i}`);
        return null;
      }
      maxNetDisp = Math.max(maxNetDisp, -z);
    }
  }
  return { world, minZ, maxNetDisp, touchedNet };
}

// 1) hard straight shot into the middle of the goal
{
  const r = runShot('hard shot', { x: 0, y: 2.0, z: -28 }, { x: 0, y: 0, z: 0 });
  if (r) {
    check('hard shot: touched net', r.touchedNet);
    check('hard shot: no tunneling', r.minZ > -(NET_BOT_DEPTH + 0.45), `minZ=${r.minZ.toFixed(2)}`);
    check('hard shot: net bounded', r.maxNetDisp < NET_BOT_DEPTH + 0.8, `maxDisp=${r.maxNetDisp.toFixed(2)}`);
    check('hard shot: ball absorbed', r.world.ball.speed() < 6, `v=${r.world.ball.speed().toFixed(2)}`);
  }
}

// 2) curling shot toward the top corner
{
  const r = runShot('curler', { x: 2.5, y: 4.5, z: -20 }, { x: 0, y: -45, z: 0 });
  if (r) {
    check('curler: touched net', r.touchedNet);
    check('curler: no tunneling', r.minZ > -(NET_BOT_DEPTH + 0.45), `minZ=${r.minZ.toFixed(2)}`);
  }
}

// 3) lofted chip
{
  const r = runShot('chip', { x: 0, y: 6.5, z: -12 }, { x: -20, y: 0, z: 0 }, 3.0);
  if (r) {
    check('chip: touched net', r.touchedNet);
    check('chip: no tunneling', r.minZ > -(NET_BOT_DEPTH + 0.45), `minZ=${r.minZ.toFixed(2)}`);
  }
}

// 4) wide miss should fly past the goal untouched
{
  const r = runShot('wide miss', { x: 9, y: 3, z: -22 }, { x: 0, y: 0, z: 0 }, 2.0);
  if (r) {
    check('wide miss: net untouched', !r.touchedNet);
    check('wide miss: ball flew past', r.minZ < -3, `minZ=${r.minZ.toFixed(2)}`);
  }
}

// 5) net settles without a ball
{
  const world = new World();
  let maxV = 0;
  for (let f = 0; f < 120; f++) world.step(DT);
  const { vel, count } = world.net;
  for (let i = 0; i < count; i++) {
    maxV = Math.max(maxV, Math.hypot(vel[i * 3], vel[i * 3 + 1], vel[i * 3 + 2]));
  }
  check('idle net: settles', maxV < 0.6, `maxV=${maxV.toFixed(3)}`);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
