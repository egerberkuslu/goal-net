// Sharing a replay: deflate, then URL-safe base64, then either a link or an id.
//
// No dependency. Node has node:zlib, browsers have CompressionStream; both are
// raw DEFLATE (RFC 1951) with the same bytes on the wire, so a replay deflated
// in Chrome inflates in Node. The import is written as a computed specifier so
// a web bundler does not try to resolve node:zlib into a browser bundle.
//
//   const link = await toUrl(container, { base: 'https://goal.net/r' });
//   const back = await fromUrl(link);
//
// Everything here is async because CompressionStream is. The Node path could be
// synchronous, but one code path that behaves the same in both environments is
// worth more than a synchronous convenience the browser cannot have.
//
// -------------------------------------------------------------- URL vs id
//
// base64 costs 4 bytes per 3, so a URL carries roughly 0.75 x its length in
// replay bytes. URL_SAFE_LENGTH is 2000 characters, the ceiling every browser,
// proxy and chat client agrees on (IE's old 2083 is the binding one; nginx and
// friends default to 4k-8k). That leaves about 1.4 kB of compressed replay.
//
// Measured (see test/run.mjs), keyframes stripped:
//   3 min, 4 players   ~14 kB deflated  -> ~19 kB of base64: WAY over
//   3 min, 6 players   ~21 kB deflated  -> ~28 kB of base64: WAY over
//
// So the URL path is for clips and toy matches only, and a full match SHARES BY
// ID: hash the bytes, hand them to a store, share `<base>/<id>`. `contentId` is
// content-addressed on purpose — the same match uploaded twice is one object,
// and an id cannot be forged into pointing at different bytes without changing.
// The store interface is three methods so the server can implement it over a
// directory, S3 or a table without this package knowing.

import { ReplayError, decode, encode, fnv1aBytes } from './format.js';

/** Characters a replay link may spend. See the note above. */
export const URL_SAFE_LENGTH = 2000;

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Bytes -> URL-safe base64, unpadded. No dependency, no Buffer requirement. */
export function toBase64Url(bytes) {
  let out = '';
  const n = bytes.length;
  let i = 0;
  for (; i + 2 < n; i += 3) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64URL[(v >> 18) & 63] + B64URL[(v >> 12) & 63] + B64URL[(v >> 6) & 63] + B64URL[v & 63];
  }
  const rest = n - i;
  if (rest === 1) {
    const v = bytes[i] << 16;
    out += B64URL[(v >> 18) & 63] + B64URL[(v >> 12) & 63];
  } else if (rest === 2) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64URL[(v >> 18) & 63] + B64URL[(v >> 12) & 63] + B64URL[(v >> 6) & 63];
  }
  return out;
}

const B64_INVERSE = (() => {
  const m = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64URL.length; i++) m[B64URL.charCodeAt(i)] = i;
  m['='.charCodeAt(0)] = -2;
  // accept standard base64 too, so a link mangled by a "helpful" tool still opens
  m['+'.charCodeAt(0)] = 62;
  m['/'.charCodeAt(0)] = 63;
  return m;
})();

/** Inverse of toBase64Url. Refuses anything that is not base64 at all. */
export function fromBase64Url(text) {
  const clean = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const v = code < 128 ? B64_INVERSE[code] : -1;
    if (v === -2) continue;
    if (v < 0) throw new ReplayError('bad-base64', `share code holds "${text[i]}", which is not base64`);
    clean.push(v);
  }
  const n = clean.length;
  const bytes = new Uint8Array(Math.floor((n * 6) / 8));
  let p = 0;
  for (let i = 0; i + 1 < n; i += 4) {
    const a = clean[i];
    const b = clean[i + 1];
    const c = i + 2 < n ? clean[i + 2] : -1;
    const d = i + 3 < n ? clean[i + 3] : -1;
    bytes[p++] = ((a << 2) | (b >> 4)) & 0xff;
    if (c >= 0) bytes[p++] = ((b << 4) | (c >> 2)) & 0xff;
    if (d >= 0) bytes[p++] = ((c << 6) | d) & 0xff;
  }
  return bytes.subarray(0, p);
}

// ------------------------------------------------------------------ deflate

let zlibPromise = null;
function loadZlib() {
  if (!zlibPromise) {
    // computed specifier: a browser bundler cannot statically see "node:zlib"
    const specifier = ['node', 'zlib'].join(':');
    zlibPromise = import(/* @vite-ignore */ specifier);
  }
  return zlibPromise;
}

const hasNodeZlib = typeof process !== 'undefined' && !!(process.versions && process.versions.node);
const hasStreams =
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

async function throughStream(bytes, stream) {
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const reader = stream.readable.getReader();
  const parts = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parts.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

/** Raw DEFLATE. node:zlib on the server, CompressionStream in a browser. */
export async function deflate(bytes) {
  if (hasNodeZlib) {
    const zlib = await loadZlib();
    return new Uint8Array(zlib.deflateRawSync(bytes, { level: 9 }));
  }
  if (hasStreams) return throughStream(bytes, new CompressionStream('deflate-raw'));
  throw new ReplayError('no-deflate', 'no deflate implementation: neither node:zlib nor CompressionStream');
}

/** Inverse of deflate. A corrupt stream throws here, before decode() sees it. */
export async function inflate(bytes) {
  try {
    if (hasNodeZlib) {
      const zlib = await loadZlib();
      return new Uint8Array(zlib.inflateRawSync(bytes));
    }
    if (hasStreams) return throughStream(bytes, new DecompressionStream('deflate-raw'));
  } catch (err) {
    throw new ReplayError('corrupt', `share code does not inflate: ${err.message}`);
  }
  throw new ReplayError('no-deflate', 'no inflate implementation: neither node:zlib nor DecompressionStream');
}

// -------------------------------------------------------------- share codec

/**
 * container -> compressed bytes.
 *
 * `keyframes: false` (the default for sharing) drops the seek index, which is
 * derivable from the inputs. It is the single biggest saving available and it
 * costs the viewer one forward pass on their first backward seek.
 */
export async function pack(container, options = {}) {
  const keep = options.keyframes === true;
  const source = keep ? container : { ...container, keyframes: [], keyframeInterval: 0 };
  return deflate(encode(source));
}

/** Compressed bytes -> container, validated exactly as decode() validates. */
export async function unpack(bytes, expect = {}) {
  return decode(await inflate(bytes), expect);
}

/** container -> URL-safe base64 share code. */
export async function encodeShare(container, options = {}) {
  return toBase64Url(await pack(container, options));
}

/** Share code -> container. */
export async function decodeShare(code, expect = {}) {
  return unpack(fromBase64Url(code), expect);
}

/** Is this replay small enough to live in a link at all? */
export function fitsInUrl(code, base = '') {
  return base.length + 1 + code.length <= URL_SAFE_LENGTH;
}

/**
 * A shareable link, or a refusal to make one.
 *
 * Returns `{ ok: true, url, code, bytes }` when the code fits, and
 * `{ ok: false, reason: 'too-long', length, limit, code }` when it does not, so
 * a caller can fall back to `publish()` instead of emitting a link that a chat
 * client will silently cut in half.
 */
export async function toUrl(container, options = {}) {
  const base = options.base || '';
  const code = await encodeShare(container, options);
  const url = base ? `${base}#${code}` : code;
  if (!fitsInUrl(code, base)) {
    return { ok: false, reason: 'too-long', length: url.length, limit: URL_SAFE_LENGTH, code, url };
  }
  return { ok: true, url, code, bytes: code.length };
}

/** Inverse of toUrl: takes the whole link or just the fragment. */
export async function fromUrl(url, expect = {}) {
  const hash = url.lastIndexOf('#');
  const code = hash >= 0 ? url.slice(hash + 1) : url;
  return decodeShare(code, expect);
}

// -------------------------------------------------------------- short ids

/**
 * Content id: two fnv1a passes over the compressed bytes with different offset
 * bases, printed as 16 hex characters. Two seeds rather than one because a
 * 32-bit id collides at about 65k replays and a 16-hex id does not.
 * Content-addressed, so the same replay is the same id everywhere and a store
 * never holds two copies. It is a
 * DEDUPLICATION key, not a capability — a server that wants unguessable links
 * should keep its own random alias pointing at this id.
 */
export function contentId(bytes) {
  const a = fnv1aBytes(bytes, 0, bytes.length, 0x811c9dc5);
  const b = fnv1aBytes(bytes, 0, bytes.length, 0x9e3779b9);
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

/**
 * The interface a server implements for the id path. Three methods, no
 * transport assumptions:
 *
 *   put(id, bytes) -> Promise<void>     idempotent; the id is the content hash
 *   get(id)        -> Promise<Uint8Array | null>
 *   has(id)        -> Promise<boolean>
 */
export function createMemoryStore() {
  const map = new Map();
  return {
    async put(id, bytes) {
      if (!map.has(id)) map.set(id, Uint8Array.from(bytes));
    },
    async get(id) {
      return map.get(id) || null;
    },
    async has(id) {
      return map.has(id);
    },
    get size() {
      return map.size;
    },
  };
}

/** Compress, store, and hand back the short link. The long-match path. */
export async function publish(container, store, options = {}) {
  const bytes = await pack(container, options);
  const id = contentId(bytes);
  await store.put(id, bytes);
  const base = options.base || '';
  return { id, url: base ? `${base}/${id}` : id, bytes: bytes.length };
}

/** Fetch by id (or by a link ending in one) and decode. */
export async function fetchShared(idOrUrl, store, expect = {}) {
  const id = idOrUrl.slice(idOrUrl.lastIndexOf('/') + 1);
  const bytes = await store.get(id);
  if (!bytes) throw new ReplayError('not-found', `no replay stored under ${id}`);
  return unpack(bytes, expect);
}
