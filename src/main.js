import { World } from './core/world.js';
import { makeConfig } from './core/config.js';
import { DT } from './core/constants.js';
import { createScene, buildGoalFrames } from './view/scene.js';
import { NetView } from './view/netView.js';
import { BallView } from './view/ballView.js';
import { PlayerView } from './view/playerView.js';
import { AimView } from './view/aimView.js';
import { CrowdView } from './view/crowdView.js';
import { Game } from './game/game.js';
import { MpSession, GuestMatch } from './mp/session.js';
import { Sfx } from './view/sfx.js';
import { PauseMenu } from './game/pauseMenu.js';

const { renderer, scene, camera } = createScene(document.getElementById('app'));
const crowd = new CrowdView(scene);

const dom = {
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
};

// The match stack (world + game + its views) is disposable so the lobby can
// rebuild it with different settings (goal size, keepers, roster).
const app = {};

function disposeMatch() {
  app.goalFrames?.dispose();
  app.netView?.dispose();
  app.ballView?.dispose();
  for (const v of app.playerViews ?? []) v.dispose();
  for (const v of app.aimViews ?? []) v.dispose();
}

function buildMatch(config, roster = null, opts = {}) {
  disposeMatch();
  app.config = config;
  app.goalFrames = buildGoalFrames(scene, config);
  app.world = new World(config);
  if (opts.mp === 'guest') {
    app.game = new GuestMatch(app.world, camera, dom, opts.myId);
    for (const entry of roster) {
      const p = app.world.addPlayer(entry.team, entry.role ?? 'field');
      p.mpId = entry.id;
    }
    app.game.registerPlayers();
  } else {
    app.game = new Game(app.world, camera, dom, roster);
  }
  const react = (e) => {
    if (e.type === 'goal') { crowd.onGoal(e.scorer); sfx.play('goal'); }
    else if (e.type === 'post' || e.type === 'crossbar') { crowd.onNearMiss(); sfx.play('post'); sfx.play('ooh'); }
    else if (e.type === 'kick') sfx.play('kick');
    else if (e.type === 'ragdoll') sfx.play('thud');
    else if (e.type === 'throwin' || e.type === 'goalkick' || e.type === 'corner') sfx.play('whistle');
  };
  app.game.onWorldEvent = (e, playing) => { if (playing) react(e); };
  if (opts.mp === 'guest') app.game.onSnapEvent = react;
  app.netView = new NetView(app.world.nets, scene);
  app.ballView = new BallView(app.world.ball, scene);
  app.playerViews = app.world.players.map((p) => new PlayerView(p, scene));
  app.aimViews = app.world.players
    .filter((p) => p.role === 'field')
    .map((p) => new AimView(p, app.world, scene));
  window.__game = { ...app, session };
  return app;
}

const session = new MpSession({
  buildMatch,
  backToLocal: () => {
    buildMatch(makeConfig());
    dom.btnAgain.textContent = 'Tekrar Oyna';
    dom.end.classList.add('hidden');
    dom.menu.classList.remove('hidden');
  },
}, dom);

buildMatch(makeConfig());

dom.btn1p.addEventListener('click', () => {
  if (!session.inMatch) app.game.startMatch('1p');
});
dom.btn2p.addEventListener('click', () => {
  if (!session.inMatch) app.game.startMatch('2p');
});
document.getElementById('btnTrain').addEventListener('click', () => {
  if (session.inMatch) return;
  // free practice: just you, both keepers, no clock, no goal limit
  buildMatch(makeConfig(), [
    { id: 'p1', team: 0, role: 'field' },
    { id: 'kr', team: 0, role: 'keeper' },
    { id: 'kb', team: 1, role: 'keeper' },
  ]);
  app.game.startMatch('train');
});
dom.btnAgain.addEventListener('click', () => {
  if (session.active && session.inMatch) session.backToLobbyAfterMatch();
  else app.game.startMatch(app.game.mode ?? '1p');
});
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyV') return;
  const label = app.game.rig?.cycle();
  if (label) app.game.showMessage(label, 'hazir', 900);
});

const sfx = new Sfx();
const pause = new PauseMenu({
  getRig: () => app.game.rig,
  sfx,
  isMp: () => session.inMatch,
  onExit: () => {
    if (session.active) session.leave();
    buildMatch(makeConfig());
    dom.end.classList.add('hidden');
    dom.menu.classList.remove('hidden');
  },
});
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  const inMenus = !dom.menu.classList.contains('hidden');
  if (inMenus && !pause.active) return; // main menu: nothing to pause
  pause.toggle();
});

let last = performance.now() / 1000;
let accumulator = 0;

function frame(nowMs) {
  requestAnimationFrame(frame);
  const now = nowMs / 1000;
  const dt = Math.min(now - last, 0.05);
  last = now;

  // slow motion scales the step size, not the step rate, so it stays smooth.
  // A local pause freezes the simulation; multiplayer keeps running under
  // the pause overlay (the host must keep serving its guests).
  const frozen = pause.active && !session.inMatch;
  accumulator += dt;
  let steps = 0;
  while (accumulator >= DT && steps < 4) {
    if (!frozen) app.world.step(DT * app.game.timeScale);
    accumulator -= DT;
    steps++;
  }

  if (!frozen) {
    app.game.update(dt, now);
    session.frameHook(dt);
  }
  app.netView.update();
  app.ballView.update(dt * app.game.timeScale);
  for (const pv of app.playerViews) pv.update(dt);
  crowd.update(dt, now);
  const aiming = app.game.state === 'play' || app.game.state === 'kickoff';
  for (const av of app.aimViews) av.update(aiming && app.game.isHuman(av.player));
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// rAF stops in background tabs, which would freeze a multiplayer host and
// starve its guests. A worker's timer keeps ticking, so we step from there
// whenever the page is hidden.
const ticker = new Worker(URL.createObjectURL(new Blob(
  ['setInterval(() => postMessage(0), 50);'], { type: 'text/javascript' },
)));
ticker.onmessage = () => {
  if (!document.hidden) return;
  if (pause.active && !session.inMatch) return;
  const now = performance.now() / 1000;
  const dt = Math.min(now - last, 0.1);
  last = now;
  accumulator += dt;
  let steps = 0;
  while (accumulator >= DT && steps < 4) {
    app.world.step(DT * app.game.timeScale);
    accumulator -= DT;
    steps++;
  }
  app.game.update(dt, now);
  session.frameHook(dt);
};
