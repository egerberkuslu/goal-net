// The one HTTP surface the game talks to: built client, room registry,
// ephemeral TURN credentials, health probe. No framework, Node built-ins only.
import http from 'node:http';
import { crossOriginIsolationHeaders, serveStatic } from './static.mjs';
import { createRoomRegistry, handleRoomRequest } from './rooms.mjs';
import { handleTurnCredentials } from './turn.mjs';

const STARTED_AT = Date.now();

export function createApp(config) {
  const registry = createRoomRegistry();

  return async function handler(req, res) {
    // Cross-origin isolation applies to every response, not just documents:
    // a sub-resource without CORP would be blocked once COEP is on.
    for (const [k, v] of Object.entries(crossOriginIsolationHeaders())) res.setHeader(k, v);

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // The registry and the credential endpoint are called cross-origin when
    // the client is served from a CDN, so they stay permissive; the static
    // route does not need CORS at all.
    if (url.pathname === '/rooms' || url.pathname === '/announce'
      || url.pathname === '/remove' || url.pathname === '/turn-credentials'
      || url.pathname === '/healthz') {
      res.setHeader('access-control-allow-origin', '*');
      res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
      res.setHeader('access-control-allow-headers', 'content-type');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    }

    if (url.pathname === '/healthz') {
      const body = JSON.stringify({
        status: 'ok',
        uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
        rooms: registry.size(),
        // Says whether TURN is wired up without revealing anything about it.
        turn: config.turn.secret ? 'configured' : 'missing-secret',
        distDir: config.distDir,
      });
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(body);
      return;
    }

    if (url.pathname === '/turn-credentials') {
      if (req.method !== 'GET') {
        res.writeHead(405, { allow: 'GET' });
        res.end();
        return;
      }
      handleTurnCredentials(req, res, config.turn, url);
      return;
    }

    if (await handleRoomRequest(req, res, registry)) return;

    await serveStatic(req, res, config);
  };
}

export function createServer(config) {
  const handler = createApp(config);
  return http.createServer((req, res) => {
    handler(req, res).catch((err) => {
      console.error('request failed:', err);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('internal error');
    });
  });
}
