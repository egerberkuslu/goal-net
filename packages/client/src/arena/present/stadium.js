// Stadium variants (feature matrix #40) — the configuration half.
//
// No three.js import lives in this file on purpose: the tables, the room
// selection, the device heuristics and the validation are plain data and plain
// arithmetic, so scripts/present-test.mjs can check them under node without a
// GPU. Everything that actually touches the scene graph is in sky.js.
//
// COSMETIC ONLY. A variant changes light colour, fog, stand tint and whether it
// is raining. It cannot change a pitch dimension, a physics constant or a rule,
// and nothing in packages/core can see it. Two players in the same room see the
// same variant only because it is derived from the room code — not because it
// is synchronised, and not because it matters if it drifts.
//
// ------------------------------------------------------------------ pieces
//
//   TIME_OF_DAY   gunduz / gece. "Baked" in the sense the design note means: a
//                 fixed table of light colours and intensities chosen once at
//                 match start. There is exactly one realtime shadow-casting
//                 directional light either way (the one createScene already
//                 makes); night lowers its intensity and turns the pylon heads
//                 into the dominant key. No relighting per frame, ever.
//
//   WEATHER       acik / yagmur. Rain is a single GPU-animated Points cloud:
//                 one draw call, one uniform, zero per-frame buffer writes.
//
//   THEME         klasik / neon / sahil. Stand and seat tints, ad-board
//                 saturation, fog colour. Textures are not swapped — a theme is
//                 a colour table, which is what keeps it free.
//
//   QUALITY       yuksek / orta / dusuk. Particle count, shadow map size, pixel
//                 ratio cap. Chosen by detectQuality() and overridable by hand
//                 (?quality=dusuk, or the returned handle's setQuality).

/** Ordered so an index can be derived from a hash without a lookup table. */
export const TIMES_OF_DAY = Object.freeze(['gunduz', 'gece']);
export const WEATHERS = Object.freeze(['acik', 'yagmur']);
export const THEMES = Object.freeze(['klasik', 'neon', 'sahil']);
export const QUALITIES = Object.freeze(['dusuk', 'orta', 'yuksek']);

/**
 * Light and atmosphere per time of day. Colours are 0xRRGGBB, intensities are
 * three.js light intensities, fog distances are metres.
 */
export const TIME_TABLE = Object.freeze({
  gunduz: Object.freeze({
    label: 'Gündüz',
    background: 0x8fb6e8,
    fog: 0x9dc0ea,
    fogNear: 70,
    fogFar: 220,
    hemiSky: 0xdfeaff,
    hemiGround: 0x2f5a35,
    hemiIntensity: 0.95,
    sun: 0xfff4dc,
    sunIntensity: 1.6,
    sunPosition: Object.freeze([24, 34, 12]),
    pylons: 0x2a2f3a, // unlit heads in daylight
    pylonEmissive: 0,
    exposure: 1,
  }),
  // These are the shipping game's own lighting values, not a dimmed copy of
  // the daylight table. A floodlit pitch is BRIGHT — the darkness belongs to
  // everything around it — and the earlier 0.55 sun turned the arena into a
  // silhouette of the game it is meant to replace.
  gece: Object.freeze({
    label: 'Gece',
    background: 0x0b1226,
    fog: 0x0b1226,
    fogNear: 60,
    fogFar: 160,
    hemiSky: 0xc4d6ff,
    hemiGround: 0x1c3a24,
    hemiIntensity: 0.8,
    sun: 0xfff2d8,
    sunIntensity: 1.5,
    sunPosition: Object.freeze([24, 34, 12]),
    pylons: 0xfff6d8,
    pylonEmissive: 1,
    exposure: 1,
  }),
});

/** Weather. `particles` is the count at quality "yuksek"; see QUALITY_TABLE. */
export const WEATHER_TABLE = Object.freeze({
  acik: Object.freeze({
    label: 'Açık',
    particles: 0,
    fallSpeed: 0,
    wind: 0,
    dimming: 1,
    wet: 0,
  }),
  yagmur: Object.freeze({
    label: 'Yağmur',
    particles: 9000,
    fallSpeed: 16, // metres per second
    wind: 2.2,
    dimming: 0.78, // multiplies both light intensities
    wet: 0.35, // pitch specular boost
  }),
});

/** Stand, seat and board tints per theme. */
export const THEME_TABLE = Object.freeze({
  klasik: Object.freeze({
    label: 'Klasik',
    stand: 0x232c44,
    seat: 0x2e3a5c,
    board: 0x1c3f8f,
    accent: 0xf5f5f5,
    fogTint: 0x0b1226,
    grass: 0x2f8f43,
  }),
  neon: Object.freeze({
    label: 'Neon',
    stand: 0x140f2e,
    seat: 0x2b0f4d,
    board: 0xff2d95,
    accent: 0x2ef2ff,
    fogTint: 0x120a2a,
    grass: 0x1f6f5a,
  }),
  sahil: Object.freeze({
    label: 'Sahil',
    stand: 0x3d3527,
    seat: 0xc9a86a,
    board: 0x1f8fb0,
    accent: 0xfff2cf,
    fogTint: 0x18293a,
    grass: 0x46a04a,
  }),
});

/**
 * Quality tiers. `particleScale` multiplies WEATHER_TABLE.particles,
 * `shadowMap` is the directional light's map size (0 disables shadows outright)
 * and `pixelRatio` caps devicePixelRatio.
 */
export const QUALITY_TABLE = Object.freeze({
  dusuk: Object.freeze({
    label: 'Düşük',
    particleScale: 0.18,
    shadowMap: 0,
    pixelRatio: 1,
    fogEnabled: true,
    pylonHeads: false,
  }),
  orta: Object.freeze({
    label: 'Orta',
    particleScale: 0.5,
    shadowMap: 1024,
    pixelRatio: 1.5,
    fogEnabled: true,
    pylonHeads: true,
  }),
  yuksek: Object.freeze({
    label: 'Yüksek',
    particleScale: 1,
    shadowMap: 2048,
    pixelRatio: 2,
    fogEnabled: true,
    pylonHeads: true,
  }),
});

/** The variant used when nothing is specified. */
export const DEFAULT_VARIANT = Object.freeze({
  time: 'gece',
  weather: 'acik',
  theme: 'klasik',
});

/**
 * FNV-1a over a string. Same function packages/core uses for its hashes, in
 * miniature: a room code has to map to the same stadium in every tab, and a
 * hash is the only way to do that without a message.
 */
export function hashString(s) {
  let h = 0x811c9dc5;
  const str = String(s ?? '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Pick a variant for a room. Deterministic in the room code, so every peer in
 * room ABC123 gets the same stadium without a byte on the wire.
 *
 * Weather is biased: three quarters of rooms are dry, because a rain effect
 * that plays every other match stops reading as weather and starts reading as
 * a bug.
 *
 * @param {string|null} roomCode
 * @param {{weatherBias?:number}} options
 */
export function variantForRoom(roomCode, options = {}) {
  if (roomCode == null || roomCode === '') return { ...DEFAULT_VARIANT };
  const h = hashString(roomCode);
  const bias = options.weatherBias == null ? 0.25 : options.weatherBias;
  const wet = ((h >>> 8) & 0xff) / 256 < bias;
  // Time and theme are biased the same way rain is, and for the same reason:
  // the floodlit classic night is what this game looks like, so it has to be
  // what a room looks like unless the hash says otherwise. An even three-way
  // split put a magenta neon daylight match in front of every other player and
  // read as a broken stadium rather than as variety. Every combination is
  // still reachable — the odds just match how often you would want to see it.
  const day = ((h >>> 4) & 0xff) / 256 < 0.25;
  const themed = ((h >>> 16) & 0xff) / 256 < 0.3;
  return {
    time: day ? 'gunduz' : 'gece',
    weather: wet ? 'yagmur' : 'acik',
    theme: themed ? THEMES[1 + ((h >>> 24) % (THEMES.length - 1))] : THEMES[0],
  };
}

/** Read a variant off URL parameters, falling back to the room's. */
export function variantFromParams(params, roomCode) {
  const base = variantForRoom(roomCode);
  if (!params) return base;
  const get = (k) => (typeof params.get === 'function' ? params.get(k) : params[k]);
  const time = get('time');
  const weather = get('weather');
  const theme = get('theme');
  return {
    time: TIMES_OF_DAY.includes(time) ? time : base.time,
    weather: WEATHERS.includes(weather) ? weather : base.weather,
    theme: THEMES.includes(theme) ? theme : base.theme,
  };
}

/**
 * Structural validation. Returns the problems; empty means the variant is
 * safe to hand to sky.js.
 */
export function validateVariant(v) {
  const issues = [];
  if (!v || typeof v !== 'object') return ['variant is not an object'];
  if (!TIMES_OF_DAY.includes(v.time)) issues.push(`unknown time: ${v.time}`);
  if (!WEATHERS.includes(v.weather)) issues.push(`unknown weather: ${v.weather}`);
  if (!THEMES.includes(v.theme)) issues.push(`unknown theme: ${v.theme}`);
  return issues;
}

/** Every table checked at once — used by the test as the config gate. */
export function validateTables() {
  const issues = [];
  for (const k of TIMES_OF_DAY) {
    const t = TIME_TABLE[k];
    if (!t) { issues.push(`TIME_TABLE missing ${k}`); continue; }
    if (!(t.fogNear > 0 && t.fogFar > t.fogNear)) issues.push(`${k}: bad fog range`);
    if (!(t.sunIntensity >= 0 && t.sunIntensity <= 3)) issues.push(`${k}: sun out of range`);
    if (!Array.isArray(t.sunPosition) || t.sunPosition.length !== 3) {
      issues.push(`${k}: bad sunPosition`);
    }
    for (const key of ['background', 'fog', 'hemiSky', 'hemiGround', 'sun', 'pylons']) {
      if (!(Number.isInteger(t[key]) && t[key] >= 0 && t[key] <= 0xffffff)) {
        issues.push(`${k}.${key} is not a colour`);
      }
    }
  }
  for (const k of WEATHERS) {
    const w = WEATHER_TABLE[k];
    if (!w) { issues.push(`WEATHER_TABLE missing ${k}`); continue; }
    if (!(w.particles >= 0 && w.particles <= 20000)) issues.push(`${k}: particle budget`);
    if (!(w.dimming > 0 && w.dimming <= 1)) issues.push(`${k}: bad dimming`);
  }
  for (const k of THEMES) {
    const t = THEME_TABLE[k];
    if (!t) { issues.push(`THEME_TABLE missing ${k}`); continue; }
    for (const key of ['stand', 'seat', 'board', 'accent', 'fogTint', 'grass']) {
      if (!(Number.isInteger(t[key]) && t[key] >= 0 && t[key] <= 0xffffff)) {
        issues.push(`${k}.${key} is not a colour`);
      }
    }
  }
  let prevScale = -1;
  for (const k of QUALITIES) {
    const q = QUALITY_TABLE[k];
    if (!q) { issues.push(`QUALITY_TABLE missing ${k}`); continue; }
    if (!(q.particleScale >= 0 && q.particleScale <= 1)) issues.push(`${k}: particleScale`);
    if (!(q.pixelRatio >= 1 && q.pixelRatio <= 3)) issues.push(`${k}: pixelRatio`);
    if (q.particleScale < prevScale) issues.push(`${k}: tiers must not decrease in cost`);
    prevScale = q.particleScale;
  }
  return issues;
}

/**
 * How many particles this combination actually spawns. The one number that
 * decides whether rain is free or a slideshow, so it is a function rather than
 * a multiplication scattered through sky.js.
 */
export function particleBudget(variant, quality) {
  const w = WEATHER_TABLE[variant?.weather] || WEATHER_TABLE.acik;
  const q = QUALITY_TABLE[quality] || QUALITY_TABLE.orta;
  return Math.round(w.particles * q.particleScale);
}

/**
 * Device heuristics. Mobile and low-core machines drop a tier automatically;
 * everything is overridable, because a heuristic that cannot be overruled is a
 * bug waiting for a device nobody tested.
 *
 * Deliberately conservative and deliberately cheap: no benchmark frame, no
 * WebGL probe that costs a context. Inputs are injected so the test can drive
 * every branch.
 *
 * @param {{userAgent?:string, deviceMemory?:number, hardwareConcurrency?:number,
 *          maxTouchPoints?:number, devicePixelRatio?:number,
 *          override?:string}} env
 * @returns {'dusuk'|'orta'|'yuksek'}
 */
export function detectQuality(env = {}) {
  if (QUALITIES.includes(env.override)) return env.override;
  const ua = String(env.userAgent || '');
  const mobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua) ||
    (env.maxTouchPoints > 0 && /Mac OS X/.test(ua) === false && !/Windows/i.test(ua));
  const mem = Number.isFinite(env.deviceMemory) ? env.deviceMemory : null;
  const cores = Number.isFinite(env.hardwareConcurrency) ? env.hardwareConcurrency : null;

  if (mem !== null && mem <= 2) return 'dusuk';
  if (cores !== null && cores <= 2) return 'dusuk';
  if (mobile) {
    if ((mem !== null && mem >= 6) || (cores !== null && cores >= 8)) return 'orta';
    return 'dusuk';
  }
  if ((mem !== null && mem <= 4) || (cores !== null && cores <= 4)) return 'orta';
  return 'yuksek';
}

/** The full, resolved description a renderer needs. Pure. */
export function resolveVariant(variant, quality) {
  const v = { ...DEFAULT_VARIANT, ...(variant || {}) };
  const issues = validateVariant(v);
  if (issues.length) throw new Error(`stadium: ${issues.join('; ')}`);
  const q = QUALITIES.includes(quality) ? quality : 'orta';
  const time = TIME_TABLE[v.time];
  const weather = WEATHER_TABLE[v.weather];
  const theme = THEME_TABLE[v.theme];
  const tier = QUALITY_TABLE[q];
  return {
    id: `${v.time}-${v.weather}-${v.theme}`,
    variant: v,
    quality: q,
    time,
    weather,
    theme,
    tier,
    particles: particleBudget(v, q),
    // rain darkens the sky as well as the lights
    hemiIntensity: time.hemiIntensity * weather.dimming,
    sunIntensity: time.sunIntensity * weather.dimming,
    shadowMap: tier.shadowMap,
    label: `${time.label} · ${weather.label} · ${theme.label}`,
  };
}

/** Every combination, for a screenshot sweep. 2 x 2 x 3 = 12. */
export function allVariants() {
  const out = [];
  for (const time of TIMES_OF_DAY) {
    for (const weather of WEATHERS) {
      for (const theme of THEMES) out.push({ time, weather, theme });
    }
  }
  return out;
}
