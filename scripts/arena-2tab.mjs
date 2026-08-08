// Two-tab proof for the host-authoritative arena (feature matrix #5, live half).
//
//   node scripts/arena-2tab.mjs              both proofs
//   node scripts/arena-2tab.mjs --in-process  skip the browser
//   node scripts/arena-2tab.mjs --port 5301   dev server port for the browser run
//
// Two independent proofs of the same three claims, because they fail for
// different reasons and a green pair means something a green single does not.
//
//   A. IN-PROCESS  two ArenaMatch instances, host and guest, wired by a direct
//      channel. No browser, no timers, no transport: a synthetic clock drives
//      both. Deterministic, so a regression here is always real.
//
//   B. TWO TABS    a real Chromium with two pages against a real dev server,
//      talking over the arena's BroadcastChannel backend (?net=local). This is
//      the DOM, the render loop, the lobby handshake and the wire, end to end.
//      The PeerJS backend needs the public broker and a second machine to mean
//      anything, so it is a MANUAL-TESTS entry, not an assertion here.
//
// Claims, identical in both:
//   1. both sides show the SAME SCORE
//   2. the guest's authoritative checksum for a tick equals the host's own
//      digest for that exact tick — same state, not merely a similar one
//   3. the guest NEVER simulates a bot: no host session, no bot policy, zero
//      bot calls, while the host's counter is climbing

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readState } from '../packages/core/src/index.js';
import { buildRoster } from '../packages/client/src/arena/roster.js';
import { ArenaMatch } from '../packages/client/src/arena/match.js';
import { DEFAULT_SETTINGS } from '../packages/client/src/arena/matchRules.js';
import { buttonsFromHeld } from '../packages/client/src/arena/input.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const onlyInProcess = argv.includes('--in-process');
const port = Number(argv[argv.indexOf('--port') + 1]) || Number(process.env.ARENA_PORT) || 5301;
const PLAY_SECONDS = 15;

let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`); } else { failed++; console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
};

// ======================================================= A. in-process proof

function stubView() {
  return { frames: 0, onGoal() {}, onStrike() {}, update() { this.frames++; } };
}

/** Chase the ball from behind, poke it goalward. Deterministic in state alone. */
function chaser(getState, index) {
  const held = new Set();
  return {
    read() {
      const st = getState();
      if (!st) return { moveX: 0, moveZ: 0, buttons: 0 };
      const me = st.players[index];
      if (!me) return { moveX: 0, moveZ: 0, buttons: 0 };
      const attack = me.team === 0 ? 1 : -1;
      let ax = st.ball.x;
      let az = st.ball.z - attack * 420;
      const al = Math.hypot(ax, az) || 1;
      let dx = st.ball.x + (ax / al) * 27 - me.x;
      let dz = st.ball.z + (az / al) * 27 - me.z;
      if (Math.hypot(dx, dz) < 18) { dx = st.ball.x - me.x; dz = st.ball.z - me.z; }
      const len = Math.hypot(dx, dz) || 1;
      held.clear();
      if (Math.hypot(st.ball.x - me.x, st.ball.z - me.z) < 29) held.add('KeyF');
      return { moveX: dx / len, moveZ: dz / len, buttons: buttonsFromHeld(held) };
    },
  };
}

function inProcessProof() {
  console.log('\n=== A. in-process: one host session, one client session, direct channel');

  const roster = buildRoster({
    mode: '2v2',
    difficulty: 'orta',
    humans: [
      { id: 'host', name: 'Host', team: 0, role: 'field' },
      { id: 'guest', name: 'Guest', team: 1, role: 'field' },
    ],
    seed: 1337,
  });
  const settings = {
    ...DEFAULT_SETTINGS, mode: '2v2', difficulty: 'orta',
    matchSeconds: 600, goalLimit: 0, mercyGap: 0,
  };

  let host = null;
  let guest = null;
  // The transports are the whole network: whatever the host writes lands in the
  // guest's receive() and vice versa, with the peer id the host knows it by.
  const hostTransport = {
    sendRaw: (to, buffer) => { void to; guest.receive('host', buffer); return true; },
    broadcastRaw: (buffer) => { guest.receive('host', buffer); return 1; },
    peers: () => ['guest'],
  };
  const guestTransport = {
    sendRaw: (to, buffer) => { void to; host.receive('guest', buffer); return true; },
    broadcastRaw: () => 0,
    peers: () => ['host'],
  };

  const hostView = stubView();
  const guestView = stubView();

  host = new ArenaMatch({
    role: 'host',
    roster,
    settings,
    localIndex: 0,
    transport: hostTransport,
    view: hostView,
    input: chaser(() => readState(host.host.world), 0),
    hud: {},
  });
  guest = new ArenaMatch({
    role: 'guest',
    roster,
    settings,
    localIndex: 1,
    transport: guestTransport,
    hostPeerId: 'host',
    view: guestView,
    input: chaser(() => guest.client.authoritativeState(), 1),
    hud: {},
  });
  guest._sendHello();

  const frames = PLAY_SECONDS * 60;
  let t = 0;
  for (let f = 0; f < frames; f++) {
    t += 1000 / 60;
    host.frame(t);
    guest.frame(t);
  }

  const h = host.diag();
  const g = guest.diag();
  const hostState = readState(host.host.world);

  check('the guest received snapshots', g.applied > 0, `${g.applied} applied`);
  check('the guest rendered', guestView.frames > 0, `${guestView.frames} frames`);
  check('scores agree', h.score.join('-') === g.score.join('-'),
    `host ${h.score.join('-')} vs guest ${g.score.join('-')}`);

  const hostChecksum = host.checksumAt(g.tick);
  check('the host still holds the digest for the guest\'s tick', hostChecksum !== null,
    `tick ${g.tick} (host at ${h.tick})`);
  check('the guest\'s authoritative checksum matches the host\'s for that tick',
    hostChecksum !== null && hostChecksum === g.checksum,
    `tick ${g.tick}: host ${hex(hostChecksum)} vs guest ${hex(g.checksum)}`);
  check('no reconstruction was ever refused', g.checksumMismatches === 0,
    `${g.checksumMismatches} mismatches`);

  check('the host ran the bots', h.botCalls > 0, `${h.botCalls} calls`);
  check('the guest owns no host session', g.hasHostSession === false);
  check('the guest has no bot policy', g.botPolicyInstalled === false);
  check('the guest never called a bot', g.botCalls === 0, `${g.botCalls} calls`);
  check('the host drove every bot slot',
    h.hostBotCalls === roster.botSlots.length * hostState.tick,
    `${h.hostBotCalls} for ${roster.botSlots.length} bots over ${hostState.tick} ticks`);
  check('the guest is behind the host, as an interpolating client should be',
    g.tick <= h.tick, `guest ${g.tick} vs host ${h.tick}`);

  console.log(`     ${PLAY_SECONDS}s: host tick ${h.tick} score ${h.score.join('-')},`
    + ` guest tick ${g.tick} score ${g.score.join('-')}, ${g.applied} snapshots,`
    + ` ${g.desyncs} prediction corrections`);
}

const hex = (v) => (v === null ? 'null' : (v >>> 0).toString(16).padStart(8, '0'));

// ========================================================= B. browser proof

async function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core', '@playwright/test']) {
    try {
      const mod = await import(name);
      if (mod.chromium) return mod;
    } catch { /* not installed under that name */ }
  }
  return null;
}

/**
 * Playwright's own chromium first, then whatever Chrome the machine already has.
 * A missing 170 MB download is not a reason for a proof to be unavailable.
 */
async function launchChromium(playwright) {
  const args = [
    // a background tab must keep hosting; the arena also has a worker ticker
    // for this, but the flags make the run reproducible rather than lucky
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ];
  const attempts = [
    { args },
    { args, channel: 'chrome' },
    { args, executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable' },
  ];
  let last = null;
  for (const opts of attempts) {
    try {
      const browser = await playwright.chromium.launch(opts);
      console.log(`     browser: ${opts.channel || opts.executablePath || 'bundled chromium'}`);
      return browser;
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

function startServer() {
  const child = spawn(
    process.execPath,
    [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(port), '--strictPort'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return new Promise((ok, no) => {
    const die = setTimeout(() => no(new Error('vite did not start in 30 s')), 30000);
    const onData = (buf) => {
      if (String(buf).includes('ready in') || String(buf).includes('Local:')) {
        clearTimeout(die);
        ok(child);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', no);
  });
}

async function browserProof(playwright) {
  console.log(`\n=== B. two tabs: real Chromium against http://localhost:${port}/arena.html`);
  const server = await startServer();
  const browser = await launchChromium(playwright);
  const shots = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 640 } });
    const base = `http://localhost:${port}/arena.html`;
    const common = 'net=local&mode=2v2&difficulty=orta&seconds=300&goalLimit=0&mercy=0';

    const hostPage = await ctx.newPage();
    hostPage.on('pageerror', (e) => console.log('  [host page error]', e.message));
    await hostPage.goto(`${base}?${common}&auto=host&autostart=1&expect=2&name=Host`);
    await hostPage.waitForFunction(
      () => document.getElementById('arenaRoomCode').textContent.trim().length === 6,
      null, { timeout: 20000 },
    );
    const code = (await hostPage.textContent('#arenaRoomCode')).trim();
    check('the host opened a room', /^[A-Z0-9]{6}$/.test(code), code);

    const guestPage = await ctx.newPage();
    guestPage.on('pageerror', (e) => console.log('  [guest page error]', e.message));
    await guestPage.goto(`${base}?${common}&auto=join&room=${code}&name=Guest`);
    await guestPage.waitForSelector('#arenaLobbyView:not(.hidden)', { timeout: 20000 });
    check('the guest reached the lobby', true, `room ${code}`);

    const seated = await hostPage.evaluate(() => window.__arena.lobby().players.length);
    check('the host seated the guest', seated === 2, `${seated} players`);

    await guestPage.click('#arenaReady');
    // the host autostarts once both are in and the guest is ready
    await hostPage.waitForFunction(() => !!window.__arena.diag(), null, { timeout: 20000 });
    await guestPage.waitForFunction(
      () => { const d = window.__arena.diag(); return d && d.applied > 0; },
      null, { timeout: 20000 },
    );
    check('the match started on both tabs', true);

    // scripted play: both keep pushing at the ball, host also passes
    const script = async () => {
      const keys = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
      for (let i = 0; i < PLAY_SECONDS * 2; i++) {
        const k = keys[i % keys.length];
        for (const page of [hostPage, guestPage]) {
          await page.evaluate((code2) => {
            window.__arena.releaseAll();
            window.__arena.press(code2);
            window.__arena.press('KeyF');
          }, k);
        }
        await hostPage.waitForTimeout(500);
      }
      for (const page of [hostPage, guestPage]) {
        await page.evaluate(() => window.__arena.releaseAll());
      }
    };
    await script();

    const g = await guestPage.evaluate(() => window.__arena.diag());
    const hostChecksum = await hostPage.evaluate((t) => window.__arena.checksumAt(t), g.tick);
    const h = await hostPage.evaluate(() => window.__arena.diag());

    const readBoard = (page) => page.evaluate(() => [
      document.getElementById('arenaScoreRed').textContent,
      document.getElementById('arenaScoreBlue').textContent,
    ].join('-'));
    const hostBoard = await readBoard(hostPage);
    const guestBoard = await readBoard(guestPage);

    check('both tabs simulated forward', h.tick > 300 && g.tick > 300,
      `host tick ${h.tick}, guest tick ${g.tick}`);
    check('the scoreboards agree', hostBoard === guestBoard,
      `host DOM ${hostBoard} vs guest DOM ${guestBoard}`);
    check('the sessions agree on the score', h.score.join('-') === g.score.join('-'),
      `${h.score.join('-')} vs ${g.score.join('-')}`);
    check('the host still holds the digest for the guest\'s tick', hostChecksum !== null,
      `tick ${g.tick}`);
    check('the guest\'s authoritative checksum matches the host\'s for that tick',
      hostChecksum !== null && hostChecksum === g.checksum,
      `tick ${g.tick}: host ${hex(hostChecksum)} vs guest ${hex(g.checksum)}`);
    check('the guest never refused a reconstruction', g.checksumMismatches === 0,
      `${g.checksumMismatches}`);
    check('the host ran the bots', h.botCalls > 0, `${h.botCalls} calls`);
    check('the guest owns no host session', g.hasHostSession === false);
    check('the guest has no bot policy', g.botPolicyInstalled === false);
    check('the guest never called a bot', g.botCalls === 0, `${g.botCalls} calls`);

    for (const [name, page] of [['host', hostPage], ['guest', guestPage]]) {
      const file = resolve(root, `arena-2tab-${name}.png`);
      await page.screenshot({ path: file });
      shots.push(file);
    }
    console.log(`     screenshots: ${shots.join(', ')}`);
    check('the host served snapshots at the rate it promised',
      h.snapshots > PLAY_SECONDS * 10, `${h.snapshots} in ~${PLAY_SECONDS}s`);
    check('the guest applied most of them',
      g.applied > h.snapshots * 0.8, `${g.applied} of ${h.snapshots}`);
    // queueOverflow is not a refusal: the input was accepted and the OLDEST
    // queued one was dropped to keep the backlog bounded. Everything else in
    // this map means the host disbelieved a message.
    const refused = Object.entries(h.rejected)
      .filter(([k, n]) => n > 0 && k !== 'queueOverflow');
    check('the host accepted the guest\'s inputs', h.accepted > PLAY_SECONDS * 15,
      `${h.accepted} of ${g.inputsSent} sent`);
    check('nothing legitimate was refused by the anti-cheat limits',
      refused.length === 0, refused.map(([k, n]) => `${k}=${n}`).join(' ') || 'none');

    console.log(`     host ${h.tick} ticks / ${h.botCalls} bot calls / ${h.snapshots} snapshots`
      + ` / ${h.accepted} inputs accepted · guest ${g.tick} ticks / ${g.applied} applied`
      + ` / ${g.inputsSent} inputs sent / ${g.frames} frames ${g.pumps} pumps / ${g.desyncs} corrections`
      + ` / ${g.staleDropped} stale / ${g.missingBase} missing-base`);
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }
}

// ================================================================== driver

inProcessProof();

if (!onlyInProcess) {
  const playwright = await loadPlaywright();
  if (!playwright) {
    console.log('\n=== B. two tabs: SKIPPED — playwright is not installed in this checkout');
    console.log('    install it with `npm i -D playwright && npx playwright install chromium`,');
    console.log('    or run the browser half by hand: brain/40-progress/MANUAL-TESTS.md, "Arena iki sekme".');
  } else {
    try {
      await browserProof(playwright);
    } catch (err) {
      failed++;
      console.log(`FAIL two-tab browser proof — ${err.message}`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
