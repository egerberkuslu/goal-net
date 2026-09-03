// A screenshot of the game, from the game's own camera.
//
//   node scripts/shot.mjs                    # spawns vite, writes shot-check.png
//   GAME_URL=http://localhost:5199 node scripts/shot.mjs
//   SHOT=play-boards.png SIZE=3 node scripts/shot.mjs
//
// Why this exists: three times in this project a change passed every test
// and looked wrong on screen, and once it looked right in a frame I had
// composed myself and wrong from the broadcast camera the player actually
// sees. So this takes the frame the rig chooses, not one I choose: start a
// match, let the camera settle, capture. The second frame is the near
// touchline, for the ad boards, taken during the kickoff freeze so the rig
// does not fight it.
//
// Playwright is optional: without it this prints SKIP and exits 0, like every
// other browser check here.

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const OUT = resolve(process.cwd(), process.env.SHOT || 'shot-check.png');
const OUT_NEAR = OUT.replace(/\.png$/, '-near.png');
const SIZE = process.env.SIZE || '3';
const SETTLE_MS = Number(process.env.SETTLE_MS || 4000);

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('SKIP shot — playwright is not installed');
  process.exit(0);
}

let server = null;
let base = process.env.GAME_URL;
if (!base) {
  const port = 5300 + Math.floor(Math.random() * 200);
  server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((ok, fail) => {
    const timer = setTimeout(() => fail(new Error('vite did not start')), 20000);
    const onData = (d) => { if (/Local:|ready in/.test(String(d))) { clearTimeout(timer); ok(); } };
    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
  });
  base = `http://localhost:${port}`;
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate((size) => {
    document.querySelector(`button[data-teamsize="${size}"]`)?.click();
    document.getElementById('btn1p').click();
  }, SIZE);
  await page.waitForFunction(() => {
    const r = window.__game?.renderer;
    return !!r && r.info.render.calls > 0;
  }, null, { timeout: 25000 });
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: OUT });
  console.log(`wrote ${OUT}`);

  // The far touchline up close, with the world frozen so nothing re-aims the camera.
  await page.evaluate(() => {
    const g = window.__game;
    g.world.step = () => {};
    g.game.update = () => {};
    // The FAR touchline (-x): that run is opaque and is where a banner has to
    // read. The near run is 30 % translucent by design and tells you little.
    const c = g.game.camera;
    c.position.set(-4, 1.4, -6);
    c.lookAt(-11.5, 0.45, 3);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT_NEAR });
  console.log(`wrote ${OUT_NEAR}`);
} finally {
  await browser.close();
  if (server) server.kill();
}
