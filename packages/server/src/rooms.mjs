// Open-rooms registry so players can browse public rooms instead of typing
// codes. Hosts POST /announce every ~10s (TTL prunes silent rooms); the game
// polls GET /rooms. Moved here from server/room-list.mjs, which now just boots
// this handler on its own port so `npm run rooms` keeps working.
import http from 'node:http';

const TTL_MS = 25000;
const CODE_RE = /^[A-Z0-9]{6}$/;

export function createRoomRegistry() {
  const rooms = new Map(); // code -> {code, name, players, maxPlayers, ts}

  function prune() {
    const now = Date.now();
    for (const [code, r] of rooms) if (now - r.ts > TTL_MS) rooms.delete(code);
  }

  function list() {
    prune();
    return [...rooms.values()].map(({ ts, ...r }) => r);
  }

  function announce(body) {
    if (!body || !CODE_RE.test(body.code || '') || typeof body.name !== 'string') return false;
    rooms.set(body.code, {
      code: body.code,
      name: String(body.name).slice(0, 30),
      players: Math.max(1, Math.min(99, body.players | 0)),
      maxPlayers: Math.max(2, Math.min(99, body.maxPlayers | 0)) || 6,
      ts: Date.now(),
    });
    return true;
  }

  function remove(body) {
    if (body && typeof body.code === 'string') rooms.delete(body.code);
  }

  return { list, announce, remove, size: () => rooms.size };
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 4096) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve(null); }
    });
  });
}

// Returns true when it owned the request, false to let the caller carry on.
export async function handleRoomRequest(req, res, registry) {
  if (req.method === 'GET' && req.url.split('?')[0] === '/rooms') {
    const payload = JSON.stringify(registry.list());
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(payload);
    return true;
  }
  if (req.method === 'POST' && req.url === '/announce') {
    const ok = registry.announce(await readBody(req));
    res.writeHead(ok ? 200 : 400, { 'content-type': 'application/json' });
    res.end(ok ? '{"ok":true}' : '{"ok":false}');
    return true;
  }
  if (req.method === 'POST' && req.url === '/remove') {
    registry.remove(await readBody(req));
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
    return true;
  }
  return false;
}

// Standalone mode: the registry alone, no static hosting, no TURN.
export function startRoomListServer(port = process.env.PORT || 5200) {
  const registry = createRoomRegistry();
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (await handleRoomRequest(req, res, registry)) return;
    res.writeHead(404); res.end();
  });
  server.listen(port, () => console.log(`room-list registry on :${port}`));
  return server;
}
