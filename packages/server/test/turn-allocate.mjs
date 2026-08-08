// Scripted TURN relay check: performs a real RFC 5766 Allocate handshake over
// UDP against coturn using the REST credentials the web server hands out, and
// asserts the server answers with an allocation (XOR-RELAYED-ADDRESS).
//
// Run standalone:
//   node packages/server/test/turn-allocate.mjs --host 127.0.0.1 --port 3478 \
//        --realm goalnet.local --secret "$TURN_SECRET" --user relay-probe
// or let it pull credentials from a running web server:
//   node packages/server/test/turn-allocate.mjs --from http://127.0.0.1:5210
//
// Everything below is hand-rolled STUN/TURN wire format; no dependencies.
import dgram from 'node:dgram';
import { createHash, createHmac, randomBytes } from 'node:crypto';

const MAGIC_COOKIE = 0x2112a442;

const METHOD_ALLOCATE = 0x003;
const CLASS_REQUEST = 0x00;
const CLASS_SUCCESS = 0x02;
const CLASS_ERROR = 0x03;

const ATTR = {
  MAPPED_ADDRESS: 0x0001,
  USERNAME: 0x0006,
  MESSAGE_INTEGRITY: 0x0008,
  ERROR_CODE: 0x0009,
  REALM: 0x0014,
  NONCE: 0x0015,
  XOR_RELAYED_ADDRESS: 0x0016,
  REQUESTED_TRANSPORT: 0x0019,
  XOR_MAPPED_ADDRESS: 0x0020,
  SOFTWARE: 0x8022,
  LIFETIME: 0x000d,
};

function messageType(method, cls) {
  // RFC 5389 §6: the method bits are split around the two class bits.
  return ((method & 0xf80) << 2) | ((method & 0x70) << 1) | ((cls & 0x2) << 7)
    | ((cls & 0x1) << 4) | (method & 0x0f);
}

function parseType(type) {
  const method = ((type >> 2) & 0xf80) | ((type >> 1) & 0x70) | (type & 0x0f);
  const cls = ((type >> 7) & 0x2) | ((type >> 4) & 0x1);
  return { method, cls };
}

function pad4(n) {
  return (4 - (n % 4)) % 4;
}

function encodeAttribute(type, value) {
  const head = Buffer.alloc(4);
  head.writeUInt16BE(type, 0);
  head.writeUInt16BE(value.length, 2);
  return Buffer.concat([head, value, Buffer.alloc(pad4(value.length))]);
}

function buildMessage({ method, cls, transactionId, attributes }) {
  const body = Buffer.concat(attributes.map(([t, v]) => encodeAttribute(t, v)));
  const header = Buffer.alloc(20);
  header.writeUInt16BE(messageType(method, cls), 0);
  header.writeUInt16BE(body.length, 2);
  header.writeUInt32BE(MAGIC_COOKIE, 4);
  transactionId.copy(header, 8);
  return Buffer.concat([header, body]);
}

// The long-term credential key. coturn in use-auth-secret mode still speaks
// plain long-term credentials; the "password" is the base64 HMAC we computed.
function longTermKey(username, realm, password) {
  return createHash('md5').update(`${username}:${realm}:${password}`).digest();
}

function withMessageIntegrity(message, key) {
  // The length in the header must already account for the 24 bytes the
  // MESSAGE-INTEGRITY attribute will occupy, otherwise the HMAC will not match.
  const framed = Buffer.from(message);
  framed.writeUInt16BE(message.length - 20 + 24, 2);
  const mac = createHmac('sha1', key).update(framed).digest();
  return Buffer.concat([framed, encodeAttribute(ATTR.MESSAGE_INTEGRITY, mac)]);
}

function parseMessage(buf) {
  if (buf.length < 20) throw new Error('short STUN message');
  const type = buf.readUInt16BE(0);
  const length = buf.readUInt16BE(2);
  const cookie = buf.readUInt32BE(4);
  if (cookie !== MAGIC_COOKIE) throw new Error('bad magic cookie');
  const transactionId = buf.subarray(8, 20);
  const attrs = new Map();
  let off = 20;
  const end = Math.min(20 + length, buf.length);
  while (off + 4 <= end) {
    const aType = buf.readUInt16BE(off);
    const aLen = buf.readUInt16BE(off + 2);
    const value = buf.subarray(off + 4, off + 4 + aLen);
    if (!attrs.has(aType)) attrs.set(aType, value);
    off += 4 + aLen + pad4(aLen);
  }
  return { ...parseType(type), transactionId, attrs, raw: buf };
}

function parseErrorCode(value) {
  if (!value || value.length < 4) return { code: 0, reason: '' };
  const cls = value[2] & 0x07;
  const number = value[3];
  return { code: cls * 100 + number, reason: value.subarray(4).toString('utf8') };
}

function parseXorAddress(value, transactionId) {
  const family = value[1];
  const port = value.readUInt16BE(2) ^ (MAGIC_COOKIE >>> 16);
  if (family === 0x01) {
    const raw = value.subarray(4, 8);
    const cookie = Buffer.alloc(4);
    cookie.writeUInt32BE(MAGIC_COOKIE, 0);
    const addr = raw.map((b, i) => b ^ cookie[i]);
    return { family: 'IPv4', address: Array.from(addr).join('.'), port };
  }
  if (family === 0x02) {
    const key = Buffer.concat([Buffer.from([0x21, 0x12, 0xa4, 0x42]), transactionId]);
    const out = Buffer.from(value.subarray(4, 20));
    for (let i = 0; i < 16; i += 1) out[i] ^= key[i];
    const parts = [];
    for (let i = 0; i < 16; i += 2) parts.push(out.readUInt16BE(i).toString(16));
    return { family: 'IPv6', address: parts.join(':'), port };
  }
  return { family: `unknown(${family})`, address: '', port };
}

function sendAndWait(socket, message, host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeListener('message', onMessage);
      reject(new Error(`no response from ${host}:${port} within ${timeoutMs}ms`));
    }, timeoutMs);
    function onMessage(buf) {
      clearTimeout(timer);
      socket.removeListener('message', onMessage);
      try {
        resolve(parseMessage(buf));
      } catch (err) {
        reject(err);
      }
    }
    socket.on('message', onMessage);
    socket.send(message, port, host, (err) => {
      if (err) {
        clearTimeout(timer);
        socket.removeListener('message', onMessage);
        reject(err);
      }
    });
  });
}

/**
 * Runs the two-step Allocate handshake (unauthenticated probe -> 401 with
 * realm+nonce -> authenticated retry) and resolves with the relayed address.
 */
export async function allocate({ host, port = 3478, username, password, realm, timeoutMs = 3000 }) {
  const socket = dgram.createSocket('udp4');
  const trace = [];
  try {
    await new Promise((res, rej) => {
      socket.once('error', rej);
      socket.bind(0, '0.0.0.0', () => res());
    });

    const probeId = randomBytes(12);
    const probe = buildMessage({
      method: METHOD_ALLOCATE,
      cls: CLASS_REQUEST,
      transactionId: probeId,
      attributes: [
        [ATTR.REQUESTED_TRANSPORT, Buffer.from([17, 0, 0, 0])], // 17 = UDP
        [ATTR.SOFTWARE, Buffer.from('goalnet-turn-check')],
      ],
    });
    const challenge = await sendAndWait(socket, probe, host, port, timeoutMs);
    if (challenge.cls !== CLASS_ERROR) {
      // A server that allocates without asking who we are is running no-auth.
      throw new Error('server allocated without a credential challenge (no-auth?)');
    }
    const err401 = parseErrorCode(challenge.attrs.get(ATTR.ERROR_CODE));
    trace.push(`challenge ${err401.code} ${err401.reason}`);
    if (err401.code !== 401) throw new Error(`expected 401 challenge, got ${err401.code} ${err401.reason}`);

    const serverRealm = challenge.attrs.get(ATTR.REALM)?.toString('utf8');
    const nonce = challenge.attrs.get(ATTR.NONCE);
    if (!serverRealm || !nonce) throw new Error('challenge missing REALM or NONCE');
    if (realm && serverRealm !== realm) {
      throw new Error(`realm mismatch: server says "${serverRealm}", we expected "${realm}"`);
    }

    const key = longTermKey(username, serverRealm, password);
    const authId = randomBytes(12);
    const authBase = buildMessage({
      method: METHOD_ALLOCATE,
      cls: CLASS_REQUEST,
      transactionId: authId,
      attributes: [
        [ATTR.REQUESTED_TRANSPORT, Buffer.from([17, 0, 0, 0])],
        [ATTR.USERNAME, Buffer.from(username, 'utf8')],
        [ATTR.REALM, Buffer.from(serverRealm, 'utf8')],
        [ATTR.NONCE, nonce],
      ],
    });
    const reply = await sendAndWait(socket, withMessageIntegrity(authBase, key), host, port, timeoutMs);

    if (reply.cls === CLASS_ERROR) {
      const e = parseErrorCode(reply.attrs.get(ATTR.ERROR_CODE));
      throw new Error(`allocate rejected: ${e.code} ${e.reason}`);
    }
    if (reply.cls !== CLASS_SUCCESS || reply.method !== METHOD_ALLOCATE) {
      throw new Error(`unexpected reply class=${reply.cls} method=${reply.method}`);
    }
    const relayedRaw = reply.attrs.get(ATTR.XOR_RELAYED_ADDRESS);
    if (!relayedRaw) throw new Error('allocation success without XOR-RELAYED-ADDRESS');
    const relayed = parseXorAddress(relayedRaw, reply.transactionId);
    const mappedRaw = reply.attrs.get(ATTR.XOR_MAPPED_ADDRESS);
    const lifetime = reply.attrs.get(ATTR.LIFETIME)?.readUInt32BE(0);
    trace.push(`allocated relay ${relayed.address}:${relayed.port} lifetime=${lifetime}s`);
    return {
      relayed,
      mapped: mappedRaw ? parseXorAddress(mappedRaw, reply.transactionId) : null,
      lifetime,
      realm: serverRealm,
      trace,
    };
  } finally {
    socket.close();
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = args.host || process.env.TURN_HOST || '127.0.0.1';
  const port = Number(args.port || process.env.TURN_PORT || 3478);
  let username = args.username;
  let password = args.password;
  let realm = args.realm || process.env.TURN_REALM || '';

  if (args.from) {
    const userId = args.user || 'relay-probe';
    const res = await fetch(`${args.from}/turn-credentials?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error(`credential endpoint returned ${res.status}`);
    const body = await res.json();
    username = body.username;
    password = body.credential;
    realm = realm || body.realm;
    console.log(`credentials from ${args.from}: username=${username}`);
  } else if (!username) {
    const secret = args.secret || process.env.TURN_SECRET;
    if (!secret) throw new Error('need --secret, --username/--password or --from');
    const userId = args.user || 'relay-probe';
    username = `${Math.floor(Date.now() / 1000) + 300}:${userId}`;
    password = createHmac('sha1', secret).update(username).digest('base64');
  }

  const result = await allocate({ host, port, username, password, realm });
  for (const line of result.trace) console.log(`  ${line}`);
  console.log(`PASS  TURN relay allocation on ${host}:${port} (realm ${result.realm})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`FAIL  ${err.message}`);
    process.exit(1);
  });
}
