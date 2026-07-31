import { World } from './core/physics.js';
import { DT } from './core/constants.js';
import { createScene } from './view/scene.js';
import { NetView } from './view/netView.js';
import { BallView } from './view/ballView.js';
import { TrajectoryPreview } from './view/trajectory.js';
import { Game } from './game/game.js';

const { renderer, scene, camera } = createScene(document.getElementById('app'));

const world = new World();
const netView = new NetView(world.net, scene);
const ballView = new BallView(world.ball, scene);
const trajectory = new TrajectoryPreview(scene);

const game = new Game(world, camera, trajectory, {
  score: document.getElementById('score'),
  msg: document.getElementById('msg'),
  btnPenalty: document.getElementById('btnPenalty'),
  btnFreekick: document.getElementById('btnFreekick'),
  canvas: renderer.domElement,
});

let last = performance.now();
let accumulator = 0;

function frame(nowMs) {
  requestAnimationFrame(frame);
  const now = nowMs / 1000;
  const dt = Math.min(now - last, 0.05);
  last = now;

  accumulator += dt * game.timeScale;
  let steps = 0;
  while (accumulator >= DT && steps < 4) {
    world.step(DT);
    accumulator -= DT;
    steps++;
  }

  game.update(dt, now);
  netView.update();
  ballView.update(dt * game.timeScale);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// debug handle for tests
window.__game = { game, world };
