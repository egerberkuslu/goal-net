// Headless server tests. No network beyond loopback, no dependencies.
//   node packages/server/test/run.mjs
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../src/app.mjs';
import { loadConfig } from '../src/config.mjs';
import { resolveWithinRoot } from '../src/static.mjs';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function eq(name, actual, expected) {
  check(name, Object.is(actual, expected), `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

// --- an HMAC-SHA1 that shares no code with src/turn.mjs ---------------------
// RFC 2104 spelled out on top of a plain SHA-1 digest, so a bug in the
// server's crypto.createHmac usage (wrong algorithm, wrong key handling,
// wrong encoding) cannot be mirrored by the expectation.
function hmacSha1Independent(secret, message) {
  const BLOCK = 64;
  let key = Buffer.from(secret, 'utf8');
  if (key.length > BLOCK) key = createHash('sha1').update(key).digest();
  if (key.length < BLOCK) key = Buffer.concat([key, Buffer.alloc(BLOCK - key.length)]);
  const ipad = Buffer.alloc(BLOCK);
  const opad = Buffer.alloc(BLOCK);
  for (let i = 0; i < BLOCK; i += 1) {
    ipad[i] = key[i] ^ 0x36;
    opad[i] = key[i] ^ 0x5c;
  }
  const inner = createHash('sha1').update(Buffer.concat([ipad, Buffer.from(message, 'utf8')])).digest();
  return createHash('sha1').update(Buffer.concat([opad, inner])).digest();
}

// Known-answer test from RFC 2202 so the reference itself is trustworthy.
function selfCheckReference() {
  const digest = hmacSha1Independent('Jefe', 'what do ya want for nothing?').toString('hex');
  check('reference HMAC-SHA1 matches RFC 2202 test case 2',
    digest === 'effcdf6ae5eb2fa2d27416d5f184df9c259a7c79', digest);
}

const SECRET = 'test-secret-not-a-real-one';
const REALM = 'test.goalnet.local';

async function withServer(env, fn) {
  const config = loadConfig({ ...env, PORT: '0' });
  const server = createServer(config);
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base, config);
  } finally {
    await new Promise((res) => server.close(res));
  }
}

async function main() {
  selfCheckReference();

  const dist = await mkdtemp(join(tmpdir(), 'goalnet-dist-'));
  await writeFile(join(dist, 'index.html'), '<!doctype html><title>goal net</title>');
  await mkdir(join(dist, 'assets'), { recursive: true });
  await writeFile(join(dist, 'assets', 'app-a1b2c3d4.js'), 'export const ok = 1;\n');

  const env = {
    DIST_DIR: dist,
    TURN_SECRET: SECRET,
    TURN_REALM: REALM,
    TURN_HOST: 'turn.example.test',
    TURN_TTL: '300',
  };

  await withServer(env, async (base) => {
    // --- COOP/COEP on the static route -------------------------------------
    const index = await fetch(`${base}/`);
    eq('static / returns 200', index.status, 200);
    eq('static / sets Cross-Origin-Opener-Policy', index.headers.get('cross-origin-opener-policy'), 'same-origin');
    eq('static / sets Cross-Origin-Embedder-Policy', index.headers.get('cross-origin-embedder-policy'), 'require-corp');
    eq('static / content-type is html', index.headers.get('content-type'), 'text/html; charset=utf-8');
    eq('static / is revalidated, not cached hard', index.headers.get('cache-control'), 'no-cache');

    const asset = await fetch(`${base}/assets/app-a1b2c3d4.js`);
    eq('hashed asset returns 200', asset.status, 200);
    eq('hashed asset content-type is javascript', asset.headers.get('content-type'), 'text/javascript; charset=utf-8');
    eq('hashed asset is immutable', asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    eq('hashed asset keeps COEP', asset.headers.get('cross-origin-embedder-policy'), 'require-corp');
    eq('hashed asset carries CORP so COEP can load it', asset.headers.get('cross-origin-resource-policy'), 'same-origin');

    // --- /healthz ----------------------------------------------------------
    const health = await fetch(`${base}/healthz`);
    eq('/healthz returns 200', health.status, 200);
    const healthBody = await health.json();
    eq('/healthz reports ok', healthBody.status, 'ok');
    eq('/healthz reports turn configured', healthBody.turn, 'configured');
    check('/healthz reports uptime', typeof healthBody.uptimeSeconds === 'number');
    check('/healthz never echoes the secret', !JSON.stringify(healthBody).includes(SECRET));

    // --- TURN credentials --------------------------------------------------
    const before = Math.floor(Date.now() / 1000);
    const turnRes = await fetch(`${base}/turn-credentials?userId=peer-42`);
    const after = Math.floor(Date.now() / 1000);
    eq('/turn-credentials returns 200', turnRes.status, 200);
    eq('/turn-credentials is uncacheable', turnRes.headers.get('cache-control'), 'no-store');
    const turn = await turnRes.json();

    const [tsPart, ...idParts] = turn.username.split(':');
    const ts = Number(tsPart);
    eq('username userId half round-trips', idParts.join(':'), 'peer-42');
    check('username timestamp is an integer', Number.isInteger(ts), turn.username);
    check('username expiry sits ttl seconds ahead',
      ts >= before + 300 && ts <= after + 300,
      `ts=${ts} window=[${before + 300}, ${after + 300}]`);
    eq('reported ttl is 300', turn.ttl, 300);
    eq('expiresAt agrees with the username timestamp', turn.expiresAt, ts);
    check('expiry window is sane (0 < ttl <= 24h)', turn.ttl > 0 && turn.ttl <= 86400, String(turn.ttl));

    const expected = hmacSha1Independent(SECRET, turn.username).toString('base64');
    eq('credential is base64 HMAC-SHA1(secret, username)', turn.credential, expected);
    check('credential decodes to 20 bytes', Buffer.from(turn.credential, 'base64').length === 20);
    check('response never contains the shared secret', !JSON.stringify(turn).includes(SECRET));
    eq('realm is echoed', turn.realm, REALM);
    check('urls cover udp, tcp and tls relay',
      turn.urls.includes('turn:turn.example.test:3478?transport=udp')
      && turn.urls.includes('turn:turn.example.test:3478?transport=tcp')
      && turn.urls.includes('turns:turn.example.test:5349?transport=tcp'),
      JSON.stringify(turn.urls));
    check('iceServers is ready for RTCPeerConnection',
      Array.isArray(turn.iceServers) && turn.iceServers[0].username === turn.username
      && turn.iceServers[0].credential === turn.credential);

    // A second call a moment later must not reuse the first credential.
    const turn2 = await (await fetch(`${base}/turn-credentials?userId=peer-43`)).json();
    check('a different userId yields a different credential', turn2.credential !== turn.credential);

    eq('/turn-credentials without userId is a 400',
      (await fetch(`${base}/turn-credentials`)).status, 400);
    eq('/turn-credentials rejects a hostile userId',
      (await fetch(`${base}/turn-credentials?userId=${encodeURIComponent('a b/../c')}`)).status, 400);

    // --- unknown route -----------------------------------------------------
    const missing = await fetch(`${base}/definitely-not-here`);
    eq('unknown route is a 404', missing.status, 404);
    eq('unknown nested route is a 404', (await fetch(`${base}/a/b/c.js`)).status, 404);

    // --- path traversal ----------------------------------------------------
    for (const attempt of [
      '/../../etc/passwd',
      '/%2e%2e/%2e%2e/etc/passwd',
      '/assets/../../../../etc/passwd',
      '/..%2f..%2fetc%2fpasswd',
      '/%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    ]) {
      // fetch() normalises some of these client side, so hit the raw socket too.
      const res = await rawGet(base, attempt);
      const refused = res.status === 403 || res.status === 404;
      check(`traversal refused: ${attempt}`, refused && !res.body.includes('root:'),
        `status ${res.status}`);
    }

    // --- room registry still mounted ---------------------------------------
    const rooms0 = await fetch(`${base}/rooms`);
    eq('/rooms returns 200', rooms0.status, 200);
    check('/rooms starts empty', JSON.stringify(await rooms0.json()) === '[]');
    const announce = await fetch(`${base}/announce`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'ABC123', name: 'test room', players: 2, maxPlayers: 6 }),
    });
    eq('/announce accepts a valid room', announce.status, 200);
    const rooms1 = await (await fetch(`${base}/rooms`)).json();
    check('/rooms lists the announced room', rooms1.length === 1 && rooms1[0].code === 'ABC123',
      JSON.stringify(rooms1));
    eq('/announce rejects a malformed code',
      (await fetch(`${base}/announce`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'nope', name: 'x' }),
      })).status, 400);
    await fetch(`${base}/remove`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'ABC123' }),
    });
    check('/remove drops the room', (await (await fetch(`${base}/rooms`)).json()).length === 0);
  });

  // --- TURN without a secret must fail closed, not fall back to no-auth -----
  await withServer({ DIST_DIR: dist, TURN_REALM: REALM }, async (base) => {
    const res = await fetch(`${base}/turn-credentials?userId=peer-1`);
    eq('/turn-credentials is 503 when no secret is configured', res.status, 503);
    const body = await res.json();
    eq('unconfigured TURN reports a machine-readable error', body.error, 'turn-not-configured');
    check('unconfigured TURN hands out no credential', body.credential === undefined);
    const health = await (await fetch(`${base}/healthz`)).json();
    eq('/healthz flags the missing secret', health.turn, 'missing-secret');
  });

  // --- unit level: the resolver itself -------------------------------------
  check('resolveWithinRoot rejects ..', resolveWithinRoot('/srv/dist', '/../etc/passwd') === null);
  check('resolveWithinRoot rejects NUL', resolveWithinRoot('/srv/dist', '/a\0b') === null);
  check('resolveWithinRoot accepts a normal path',
    resolveWithinRoot('/srv/dist', '/assets/app.js')?.rel === 'assets/app.js');

  await rm(dist, { recursive: true, force: true });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

// fetch() rewrites ../ before it hits the wire; this speaks HTTP/1.1 by hand.
async function rawGet(base, path) {
  const { port } = new URL(base);
  const net = await import('node:net');
  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(port), '127.0.0.1', () => {
      socket.write(`GET ${path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
    });
    let raw = '';
    socket.setEncoding('utf8');
    socket.on('data', (c) => { raw += c; });
    socket.on('error', reject);
    socket.on('close', () => {
      const status = Number(raw.slice(9, 12));
      const bodyAt = raw.indexOf('\r\n\r\n');
      resolve({ status, body: bodyAt === -1 ? '' : raw.slice(bodyAt + 4) });
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
