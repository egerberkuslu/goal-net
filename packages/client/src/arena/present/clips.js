// Clip playback (feature matrix #38). No runtime TTS — ever.
//
// The commentator picks a line id; this module turns that id plus the current
// language into a sound. Two players ship:
//
//   createClipPlayer()   Web Audio. Decodes on first use, caches the buffer,
//                        plays through one gain node so the whole commentary
//                        bed can be ducked or muted in one place.
//   createNullPlayer()   Records what it was asked to play and returns. This is
//                        what node tests and a muted client use, and it is what
//                        keeps the director testable without an AudioContext.
//
// RESOLUTION
//   Files live next to this module in ./clips/. Vite is told about them
//   statically with import.meta.glob, so the bundler copies and fingerprints
//   whatever is on disk at build time and no dynamic URL is constructed. The
//   manifest lists several candidate extensions per line (opus, mp3, wav) and
//   the first one that exists wins, so dropping real recordings beside the
//   generated placeholders upgrades the mix with no code change.
//
//   Nothing here throws when a clip is absent. A missing file is silence plus a
//   console note, because a stadium with no commentator is a playable game and
//   a stadium that crashes is not.
//
// DUCKING
//   The crowd bed belongs to the atmosphere layer. Rather than reach into it,
//   the player calls the `onDuck(amount, ms)` callback it was given: 1 while a
//   line is in the air, 0 when the last one ends. Whoever owns the crowd
//   decides what to do about it.
//
// iOS
//   An AudioContext starts suspended until a user gesture. `resume()` is safe
//   to call as often as you like and is wired to the first pointer/key event by
//   index.js; until then every play() is a no-op that still reports its
//   duration, so the director's timing is identical either way.

/** Built at module load; empty under node, populated by Vite in the browser. */
const CLIP_URLS = (() => {
  try {
    // Written as a literal call because that is the only form Vite rewrites.
    // Under node `import.meta.glob` is undefined and this throws into the catch.
    const found = import.meta.glob('./clips/*.{opus,mp3,wav,ogg}', {
      eager: true, query: '?url', import: 'default',
    });
    const map = Object.create(null);
    for (const [path, url] of Object.entries(found)) {
      map[path.slice(path.lastIndexOf('/') + 1)] = url;
    }
    return map;
  } catch {
    return {};
  }
})();

/** The URL for a manifest entry, walking its candidate extensions. */
export function resolveClipUrl(entry, urls = CLIP_URLS) {
  if (!entry) return null;
  for (const name of entry.candidates || [entry.file]) {
    if (urls[name]) return urls[name];
  }
  return null;
}

/** Which manifest entries actually have a file. Used by the test and the HUD. */
export function clipCoverage(manifest, urls = CLIP_URLS) {
  const present = [];
  const missing = [];
  for (const entry of Object.values(manifest?.entries || {})) {
    (resolveClipUrl(entry, urls) ? present : missing).push(entry.file);
  }
  return { present, missing, total: present.length + missing.length };
}

/**
 * The Web Audio player.
 *
 * @param {{context?:AudioContext, destination?:AudioNode, volume?:number,
 *          urls?:object, onDuck?:(amount:number)=>void,
 *          fetchImpl?:typeof fetch}} options
 */
export function createClipPlayer(options = {}) {
  const AC = typeof AudioContext !== 'undefined'
    ? AudioContext
    : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null);
  if (!AC && !options.context) return createNullPlayer(options);

  const ctx = options.context || new AC();
  const gain = ctx.createGain();
  gain.gain.value = options.volume == null ? 0.9 : options.volume;
  gain.connect(options.destination || ctx.destination);
  const urls = options.urls || CLIP_URLS;
  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const buffers = new Map(); // url -> AudioBuffer | Promise | null
  const onDuck = options.onDuck || (() => {});
  const live = new Set();

  async function load(url) {
    if (buffers.has(url)) return buffers.get(url);
    if (!fetchImpl) return null;
    const p = fetchImpl(url)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx.decodeAudioData(b))
      .then((buf) => { buffers.set(url, buf); return buf; })
      .catch(() => { buffers.set(url, null); return null; });
    buffers.set(url, p);
    return p;
  }

  function duck() {
    onDuck(live.size > 0 ? 1 : 0);
  }

  return {
    kind: 'webaudio',
    get context() { return ctx; },
    get gainNode() { return gain; },

    /** Safe to call on every gesture; required once on iOS. */
    resume() {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume();
      return ctx.state;
    },

    setVolume(v) {
      gain.gain.value = Math.max(0, Math.min(1, v));
    },

    /** Warm the cache for a language so the first goal is not the first fetch. */
    preload(manifest, lang) {
      for (const entry of Object.values(manifest?.entries || {})) {
        if (entry.lang !== lang) continue;
        const url = resolveClipUrl(entry, urls);
        if (url) load(url);
      }
    },

    /**
     * @param {object} entry manifest entry
     * @returns {object} handle the director passes back to stop()
     */
    play(entry) {
      const handle = { entry, source: null, stopped: false };
      live.add(handle);
      duck();
      const url = resolveClipUrl(entry, urls);
      if (!url) return handle; // silence, with correct timing
      Promise.resolve(load(url)).then((buf) => {
        if (!buf || handle.stopped) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(gain);
        src.onended = () => {
          if (live.delete(handle)) duck();
        };
        handle.source = src;
        try { src.start(); } catch { /* a context that never resumed */ }
      });
      return handle;
    },

    stop(handle) {
      if (!handle || handle.stopped) return;
      handle.stopped = true;
      if (handle.source) {
        try { handle.source.stop(); } catch { /* already finished */ }
      }
      if (live.delete(handle)) duck();
    },

    dispose() {
      for (const h of [...live]) this.stop(h);
      try { gain.disconnect(); } catch { /* already gone */ }
      if (!options.context && typeof ctx.close === 'function') ctx.close();
    },
  };
}

/** A player that makes no sound and remembers everything. */
export function createNullPlayer(options = {}) {
  const played = [];
  const onDuck = options.onDuck || (() => {});
  let live = 0;
  return {
    kind: 'null',
    played,
    resume: () => 'running',
    setVolume: () => {},
    preload: () => {},
    play(entry, line) {
      live++;
      onDuck(1);
      const handle = { entry, line, stopped: false };
      played.push({ file: entry?.file || null, id: entry?.id || line?.id || null });
      return handle;
    },
    stop(handle) {
      if (!handle || handle.stopped) return;
      handle.stopped = true;
      live = Math.max(0, live - 1);
      onDuck(live > 0 ? 1 : 0);
    },
    dispose() { played.length = 0; },
  };
}
