// Tiny open-rooms registry so players can browse public rooms instead of
// typing codes. Hosts POST /announce every ~10s (TTL prunes silent rooms);
// the game polls GET /rooms. Run: node server/room-list.mjs  (port 5200)
import http from 'node:http';

const PORT = process.env.PORT || 5200;
const TTL_MS = 25000;
const rooms = new Map(); // code -> {code, name, players, maxPlayers, ts}

const CODE_RE = /^[A-Z0-9]{6}$/;

function prune() {
  const now = Date.now();
  for (const [code, r] of rooms) if (now - r.ts > TTL_MS) rooms.delete(code);
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

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/rooms') {
    prune();
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify([...rooms.values()].map(({ ts, ...r }) => r)));
    return;
  }
  if (req.method === 'POST' && req.url === '/announce') {
    const b = await readBody(req);
    if (b && CODE_RE.test(b.code || '') && typeof b.name === 'string') {
      rooms.set(b.code, {
        code: b.code,
        name: String(b.name).slice(0, 30),
        players: Math.max(1, Math.min(99, b.players | 0)),
        maxPlayers: Math.max(2, Math.min(99, b.maxPlayers | 0)) || 6,
        ts: Date.now(),
      });
      res.end('{"ok":true}');
      return;
    }
    res.writeHead(400); res.end('{"ok":false}');
    return;
  }
  if (req.method === 'POST' && req.url === '/remove') {
    const b = await readBody(req);
    if (b && typeof b.code === 'string') rooms.delete(b.code);
    res.end('{"ok":true}');
    return;
  }
  res.writeHead(404); res.end();
});

server.listen(PORT, () => console.log(`room-list registry on :${PORT}`));
