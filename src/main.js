import { World } from './core/world.js';
import { DT } from './core/constants.js';
import { createScene } from './view/scene.js';
import { NetView } from './view/netView.js';
import { BallView } from './view/ballView.js';
import { PlayerView } from './view/playerView.js';
import { AimView } from './view/aimView.js';
import { Game } from './game/game.js';

const { renderer, scene, camera } = createScene(document.getElementById('app'));

const world = new World();
const game = new Game(world, camera, {
  scoreRed: document.getElementById('scoreRed'),
  scoreBlue: document.getElementById('scoreBlue'),
  timer: document.getElementById('timer'),
  msg: document.getElementById('msg'),
  menu: document.getElementById('menu'),
  end: document.getElementById('end'),
  endTitle: document.getElementById('endTitle'),
  endScore: document.getElementById('endScore'),
  btn1p: document.getElementById('btn1p'),
  btn2p: document.getElementById('btn2p'),
  btnAgain: document.getElementById('btnAgain'),
});

const netView = new NetView(world.nets, scene);
const ballView = new BallView(world.ball, scene);
const playerViews = world.players.map((p) => new PlayerView(p, scene));
const aimViews = [game.playerRed, game.playerBlue].map((p) => new AimView(p, world, scene));

let last = performance.now() / 1000;
let accumulator = 0;

function frame(nowMs) {
  requestAnimationFrame(frame);
  const now = nowMs / 1000;
  const dt = Math.min(now - last, 0.05);
  last = now;

  // slow motion scales the step size, not the step rate, so it stays smooth
  accumulator += dt;
  let steps = 0;
  while (accumulator >= DT && steps < 4) {
    world.step(DT * game.timeScale);
    accumulator -= DT;
    steps++;
  }

  game.update(dt, now);
  netView.update();
  ballView.update(dt * game.timeScale);
  for (const pv of playerViews) pv.update(dt);
  const aiming = game.state === 'play' || game.state === 'kickoff';
  for (const av of aimViews) av.update(aiming && game.isHuman(av.player));
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// debug handle for tests
window.__game = { game, world };
