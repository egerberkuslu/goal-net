// Live TURN relay test. Needs coturn actually running (docker compose up) and
// the web service handing out credentials:
//
//   node packages/server/test/relay.mjs
//   node packages/server/test/relay.mjs --from http://127.0.0.1:5210 --host 127.0.0.1
//
// Asserts three things, in order of how badly each would hurt:
//   1. a valid REST credential gets a relay allocation  (the acceptance test)
//   2. a wrong credential is refused                    (not an open relay)
//   3. an expired timestamp is refused                  (ttl actually binds)
import { createHmac } from 'node:crypto';
import { allocate } from './turn-allocate.mjs';

let passed = 0;
let failed = 0;

function report(name, ok, detail = '') {
  if (ok) { passed += 1; console.log(`PASS  ${name}`); }
  else { failed += 1; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

function sign(secret, username) {
  return createHmac('sha1', secret).update(username).digest('base64');
}

async function expectRejected(name, params) {
  try {
    const r = await allocate(params);
    report(name, false, `unexpectedly allocated ${r.relayed.address}:${r.relayed.port}`);
  } catch (err) {
    // 401 is what coturn answers on a bad long-term credential; anything that
    // is not a success is acceptable here, but a timeout is not proof.
    const refused = /rejected|401|403|Unauthorized|Forbidden|integrity/i.test(err.message);
    report(name, refused, err.message);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const from = args.from || process.env.WEB_URL || 'http://127.0.0.1:5210';
  const host = args.host || process.env.TURN_HOST || '127.0.0.1';
  const port = Number(args.port || process.env.TURN_PORT || 3478);
  const userId = args.user || 'relay-probe';

  const res = await fetch(`${from}/turn-credentials?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error(`credential endpoint ${from} returned ${res.status}`);
  const creds = await res.json();
  console.log(`credentials from ${from}: username=${creds.username} realm=${creds.realm}`);

  // 1. the acceptance criterion
  try {
    const result = await allocate({
      host, port, username: creds.username, password: creds.credential, realm: creds.realm,
    });
    report('valid REST credential gets a relay allocation', true);
    report('allocation carries a relayed transport address',
      Boolean(result.relayed?.address) && result.relayed.port > 0,
      JSON.stringify(result.relayed));
    report('allocation lifetime is positive', (result.lifetime ?? 0) > 0, String(result.lifetime));
    report('server realm matches the one the web service reports',
      result.realm === creds.realm, `${result.realm} vs ${creds.realm}`);
    console.log(`      relay ${result.relayed.address}:${result.relayed.port}, lifetime ${result.lifetime}s`);
  } catch (err) {
    report('valid REST credential gets a relay allocation', false, err.message);
  }

  // 2. a forged credential must not work, or the relay is open to the world
  await expectRejected('forged credential is refused', {
    host, port, username: creds.username, password: 'not-the-right-hmac=', realm: creds.realm,
  });

  // 3. the ttl in the username has to be enforced by coturn, not just by us
  const secret = args.secret || process.env.TURN_SECRET;
  if (secret) {
    const expiredUser = `${Math.floor(Date.now() / 1000) - 60}:${userId}`;
    await expectRejected('expired credential timestamp is refused', {
      host, port, username: expiredUser, password: sign(secret, expiredUser), realm: creds.realm,
    });
  } else {
    console.log('SKIP  expired credential timestamp is refused (needs TURN_SECRET or --secret)');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`FAIL  ${err.message}`);
  process.exit(1);
});
