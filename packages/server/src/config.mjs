// Every knob the server reads lives here so the rest of the code never
// touches process.env directly and the tests can build a config by hand.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/server/src -> repo root
export const REPO_ROOT = resolve(HERE, '..', '..', '..');

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function int(value, fallback) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

export function loadConfig(env = process.env) {
  return {
    port: int(env.PORT, 5210),
    host: env.HOST || '0.0.0.0',
    distDir: resolve(env.DIST_DIR || resolve(REPO_ROOT, 'dist')),
    // Off by default: an unknown path must 404 rather than silently hand back
    // index.html, which hides broken asset links. Turn on for hash-free routing.
    spaFallback: bool(env.SPA_FALLBACK, false),
    turn: {
      // Never leaves the process: only the derived HMAC goes to the client.
      secret: env.TURN_SECRET || '',
      realm: env.TURN_REALM || 'goalnet.local',
      host: env.TURN_HOST || '127.0.0.1',
      ttl: int(env.TURN_TTL, 300),
      port: int(env.TURN_PORT, 3478),
      tlsPort: int(env.TURN_TLS_PORT, 5349),
    },
  };
}
