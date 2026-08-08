// Static hosting for the built client. Two things matter beyond "read a file":
// the cross-origin isolation headers WASM threads need, and never letting a
// request escape the dist directory.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { contentTypeFor } from './mime.mjs';

// Vite emits assets/name-<hash>.<ext>; those are safe to cache forever.
const HASHED_RE = /-[0-9a-zA-Z_]{8,}\.[0-9a-z]+$/;

export function crossOriginIsolationHeaders() {
  return {
    // Both are required before crossOriginIsolated flips true, which is what
    // gates SharedArrayBuffer and therefore ONNX/WASM threads.
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-embedder-policy': 'require-corp',
    'cross-origin-resource-policy': 'same-origin',
    'x-content-type-options': 'nosniff',
  };
}

function cacheControlFor(relPath) {
  if (relPath === 'index.html' || relPath.endsWith('/index.html')) return 'no-cache';
  if (HASHED_RE.test(relPath)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

// Resolves a request path to a file inside root, or null when the path tries
// to leave. Percent-encoding is decoded first, so %2e%2e is caught too.
export function resolveWithinRoot(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const normalised = decoded.replace(/\\/g, '/');
  const segments = normalised.split('/').filter((s) => s.length > 0);
  // The URL parser already collapses most ../ but an encoded one survives it.
  if (segments.some((s) => s === '..' || s === '.')) return null;
  const rootAbs = resolve(root);
  const full = resolve(rootAbs, segments.join('/'));
  if (full !== rootAbs && !full.startsWith(rootAbs + sep)) return null;
  return { full, rel: segments.join('/') };
}

async function statFile(path) {
  try {
    const info = await stat(path);
    return info.isFile() ? info : null;
  } catch {
    return null;
  }
}

export async function serveStatic(req, res, { distDir, spaFallback }) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' });
    res.end('method not allowed');
    return;
  }

  const pathname = new URL(req.url, 'http://localhost').pathname;
  const resolved = resolveWithinRoot(distDir, pathname);
  if (!resolved) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('forbidden');
    return;
  }

  let { full, rel } = resolved;
  if (rel === '') {
    rel = 'index.html';
    full = join(resolve(distDir), 'index.html');
  }

  let info = await statFile(full);
  if (!info && spaFallback && !extname(rel)) {
    rel = 'index.html';
    full = join(resolve(distDir), 'index.html');
    info = await statFile(full);
  }
  if (!info) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }

  const etag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
  const headers = {
    'content-type': contentTypeFor(extname(rel)),
    'content-length': info.size,
    'cache-control': cacheControlFor(rel),
    'last-modified': info.mtime.toUTCString(),
    etag,
  };

  if (req.headers['if-none-match'] === etag) {
    delete headers['content-length'];
    res.writeHead(304, headers);
    res.end();
    return;
  }

  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(full).pipe(res);
}
