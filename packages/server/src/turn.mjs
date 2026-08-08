// TURN REST API ephemeral credentials, exactly as coturn's use-auth-secret
// mode expects them (see brain/20-tech-spec/netcode-p2p.md):
//   username   = (unix_ts + ttl) + ":" + userId
//   credential = base64( HMAC-SHA1(static-auth-secret, username) )
// The shared secret stays on the server; the browser only ever sees the
// derived credential, which expires on its own.
import { createHmac, timingSafeEqual } from 'node:crypto';

// Room codes, peer ids and nicknames all fit in this; anything else is a
// probe and gets rejected before it can reach the HMAC.
const USER_ID_RE = /^[A-Za-z0-9._:-]{1,64}$/;

export function turnUsername(userId, ttlSeconds, nowSeconds = Math.floor(Date.now() / 1000)) {
  return `${nowSeconds + ttlSeconds}:${userId}`;
}

export function turnCredential(secret, username) {
  return createHmac('sha1', secret).update(username).digest('base64');
}

export function isValidUserId(userId) {
  return typeof userId === 'string' && USER_ID_RE.test(userId);
}

export function credentialsMatch(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

// Builds the payload the client feeds straight into RTCPeerConnection's
// iceServers. STUN first (cheap), then UDP/TCP relay, then TLS relay for
// networks that only let 443-ish TLS out.
export function buildTurnResponse(turn, userId, nowSeconds = Math.floor(Date.now() / 1000)) {
  const username = turnUsername(userId, turn.ttl, nowSeconds);
  const credential = turnCredential(turn.secret, username);
  const urls = [
    `stun:${turn.host}:${turn.port}`,
    `turn:${turn.host}:${turn.port}?transport=udp`,
    `turn:${turn.host}:${turn.port}?transport=tcp`,
    `turns:${turn.host}:${turn.tlsPort}?transport=tcp`,
  ];
  return {
    username,
    credential,
    ttl: turn.ttl,
    expiresAt: nowSeconds + turn.ttl,
    realm: turn.realm,
    urls,
    iceServers: [{ urls, username, credential }],
  };
}

export function handleTurnCredentials(req, res, turn, url) {
  const userId = url.searchParams.get('userId');
  if (!isValidUserId(userId)) {
    return sendJson(res, 400, { error: 'bad-user-id', detail: 'userId must match [A-Za-z0-9._:-]{1,64}' });
  }
  if (!turn.secret) {
    // Deliberately vague: never hint at how the secret is configured.
    return sendJson(res, 503, { error: 'turn-not-configured' });
  }
  return sendJson(res, 200, buildTurnResponse(turn, userId));
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    // Credentials are per-user and short lived; nothing may cache them.
    'cache-control': 'no-store',
  });
  res.end(payload);
}
