// Does the picture actually stop twitching? Measured on screen, not in theory.
//
//   npx vite --port 5301 &
//   node scripts/jitter-test.mjs
//
// Why this file exists
// --------------------
// arena-test.mjs proves the smoother's arithmetic. It cannot prove the smoother
// is wired into the render path correctly, and the first attempt at this fix
// passed every unit test while the characters carried on twitching: the state
// was being stamped at render time instead of at tick time, and the unit tests
// never saw the real clock. So this one drives the actual game in a real
// browser and measures the actual drawn position of an actual body.
//
// The measurement
// ---------------
// Real motion is smooth: a body's acceleration is bounded, so five consecutive
// samples of its position lie close to a quadratic in time. Sampling error —
// drawing a state that is a varying amount stale — does not, and shows up as a
// residual from that fit. The residual is reported in millimetres.
//
// Gameplay events (a kickoff reset, a goal) move a body across the pitch
// between two frames, which is a cut and not a twitch, so a window containing a
// jump over 0.6 m is discarded rather than counted as wobble.
//
// It runs A/B in one session — smoothing on, then off, alternating — because
// the frame rate of a software rasteriser is not stable enough to compare two
// separate runs, and because the bots are doing something different every time.

const URL_BASE = process.env.ARENA_URL || 'http://localhost:5301';
const ROUNDS = Number(process.env.JITTER_ROUNDS || 5);
/** The fix must remove at least this much of the wobble to count as working. */
const MIN_IMPROVEMENT = 2.5;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('SKIP jitter-test — playwright is not installed');
  console.log('  npm i -D playwright && npx playwright install chromium');
  process.exit(0);
}

try {
  const res = await fetch(`${URL_BASE}/arena.html`, { method: 'HEAD' });
  if (!res.ok) throw new Error(String(res.status));
} catch (err) {
  console.log(`SKIP jitter-test — no dev server at ${URL_BASE} (${err.message})`);
  console.log('  npx vite --port 5301');
  process.exit(0);
}

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${URL_BASE}/arena.html?auto=solo&autostart=1`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => {
  const m = window.__arena?.match?.();
  return !!(m && m.view && m.view.players && m.view.players.length > 1);
}, null, { timeout: 30000 });
await page.waitForTimeout(4000);

const result = await page.evaluate(async (rounds) => {
  const m = window.__arena.match();
  const real = m.smoother;
  const bypass = { push() {}, sample() { return null; } };

  const collect = (n) => new Promise((done) => {
    const rows = [];
    let i = 0;
    const step = (t) => {
      const p = m.view.players[1].view.group.position;
      rows.push([t / 1000, p.x, p.z]);
      if (++i < n) requestAnimationFrame(step); else done(rows);
    };
    requestAnimationFrame(step);
  });

  const solve3 = (A, b) => {
    const det = (M) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
      - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
      + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    const D = det(A);
    if (Math.abs(D) < 1e-12) return null;
    const rep = (k) => A.map((row, ri) => row.map((v, ci) => (ci === k ? b[ri] : v)));
    return [det(rep(0)) / D, det(rep(1)) / D, det(rep(2)) / D];
  };

  const wobbleMm = (rows) => {
    for (let i = 1; i < rows.length; i++) {
      const d = Math.hypot(rows[i][1] - rows[i - 1][1], rows[i][2] - rows[i - 1][2]);
      if (d > 0.6) return null;              // a reset, not a twitch
    }
    let sum = 0;
    let cnt = 0;
    for (let i = 2; i + 2 < rows.length; i++) {
      const w = rows.slice(i - 2, i + 3);
      const t0 = w[2][0];
      for (const axis of [1, 2]) {
        const S = [0, 0, 0, 0, 0];
        const b = [0, 0, 0];
        for (const r of w) {
          const dt = r[0] - t0;
          const y = r[axis];
          S[0] += 1; S[1] += dt; S[2] += dt * dt; S[3] += dt ** 3; S[4] += dt ** 4;
          b[0] += y; b[1] += y * dt; b[2] += y * dt * dt;
        }
        const c = solve3([[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]], b);
        if (!c) continue;
        for (const r of w) {
          const dt = r[0] - t0;
          sum += (r[axis] - (c[0] + c[1] * dt + c[2] * dt * dt)) ** 2;
          cnt++;
        }
      }
    }
    return Math.sqrt(sum / (cnt || 1)) * 1000;
  };

  const on = [];
  const off = [];
  for (let r = 0; r < rounds; r++) {
    m.smoother = real;
    const a = wobbleMm(await collect(70));
    if (a != null) on.push(a);
    m.smoother = bypass;
    const b = wobbleMm(await collect(70));
    if (b != null) off.push(b);
  }
  m.smoother = real;
  const median = (xs) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    return s[s.length >> 1];
  };
  return { on, off, onMedian: median(on), offMedian: median(off) };
}, ROUNDS);

await browser.close();

const fmt = (xs) => xs.map((v) => v.toFixed(1)).join(', ');
console.log('drawn-position wobble, RMS residual from a local quadratic fit\n');
console.log(`  smoothing ON   ${fmt(result.on)}  mm   (median ${result.onMedian?.toFixed(1)})`);
console.log(`  smoothing OFF  ${fmt(result.off)}  mm   (median ${result.offMedian?.toFixed(1)})`);

if (result.on.length < 2 || result.off.length < 2) {
  console.log('\nINCONCLUSIVE — too few clean windows (the match kept resetting)');
  process.exit(0);
}
const ratio = result.offMedian / result.onMedian;
console.log(`\n  improvement ${ratio.toFixed(1)}x`);
if (ratio < MIN_IMPROVEMENT) {
  console.log(`FAIL — expected at least ${MIN_IMPROVEMENT}x`);
  process.exit(1);
}
console.log('PASS');
