// Screenshot sweep for the stadium variants (feature matrix #40).
//
//   npm run dev:present            # vite on 5303, in another terminal
//   npm run present:shots
//
// Loads /arena.html once per variant with ?time=&weather=&theme=, drops into a
// solo match, lets the scene settle and captures a PNG plus the renderer's own
// draw-call and triangle counters. The point is not the pictures: it is the
// numbers under them, because "GPU-friendly particles" is a claim and
// renderer.info.render.calls is the only honest way to check it.
//
// Playwright is optional. Without it this prints SKIP and exits 0, exactly like
// scripts/arena-2tab.mjs treats a missing browser, so the gate never turns a
// developer machine without chromium into a red build.

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { allVariants } from '../packages/client/src/arena/present/stadium.js';

const BASE = process.env.ARENA_URL || 'http://localhost:5303/arena.html';
const OUT = resolve(process.cwd(), process.env.SHOT_DIR || '.playwright-mcp/stadium');
const SETTLE_MS = Number(process.env.SETTLE_MS || 2500);

let chromium = null;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('SKIP present-shots — playwright is not installed');
  console.log('  npm i -D playwright && npx playwright install chromium');
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const rows = [];
let failed = 0;

for (const v of allVariants()) {
  const id = `${v.time}-${v.weather}-${v.theme}`;
  const url = `${BASE}?auto=solo&autostart=1&net=local&mode=1v1&seconds=60`
    + `&time=${v.time}&weather=${v.weather}&theme=${v.theme}`;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__arena?.present?.() != null, { timeout: 20000 });
    await page.waitForTimeout(SETTLE_MS);
    const info = await page.evaluate(() => {
      const present = window.__arena.present();
      const match = window.__arena.match();
      const r = match?.view?.renderer;
      return {
        stadium: present.stadium,
        quality: present.quality,
        drawCallDelta: present.drawCallDelta,
        tension: present.tension,
        calls: r ? r.info.render.calls : -1,
        triangles: r ? r.info.render.triangles : -1,
        lines: r ? r.info.render.lines : -1,
        programs: r ? r.info.programs.length : -1,
      };
    });
    await page.screenshot({ path: resolve(OUT, `${id}.png`) });
    rows.push({ id, ...info });
    console.log(
      `PASS ${id.padEnd(24)} calls ${String(info.calls).padStart(4)} `
      + `tris ${String(info.triangles).padStart(7)} lines ${String(info.lines).padStart(6)} `
      + `(+${info.drawCallDelta} from the variant)`,
    );
  } catch (err) {
    failed++;
    console.log(`FAIL ${id} — ${err.message.split('\n')[0]}`);
  }
}

await browser.close();

if (rows.length > 1) {
  const dry = rows.filter((r) => r.id.includes('-acik-'));
  const wet = rows.filter((r) => r.id.includes('-yagmur-'));
  const avg = (a, k) => (a.reduce((s, r) => s + r[k], 0) / Math.max(1, a.length)).toFixed(1);
  console.log(`\nclear  avg draw calls ${avg(dry, 'calls')}`);
  console.log(`rain   avg draw calls ${avg(wet, 'calls')}  (one LineSegments each)`);
  console.log(`shots in ${OUT}`);
}

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
