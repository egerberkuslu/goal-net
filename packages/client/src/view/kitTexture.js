// Kits: the pattern on a shirt, drawn once per team.
//
// The Blender-authored torso and sleeves carry a cylindrical UV whose U runs
// once around the body starting from the BACK seam, so a vertical stripe is a
// vertical band in U and lands symmetrically on the chest. That is the whole
// reason this can be a flat canvas rather than a shader.
//
// One texture serves every player wearing that kit: the number is NOT baked in
// here (it would mean a texture per player, and eleven 256 KB canvases per team
// is not a thing to do for a digit) — playerView keeps drawing the number as
// its own sprite.
//
// On the presets: these are colour-and-pattern schemes, not club kits. The
// game is published, and a real club's name, crest or shirt design is theirs;
// "sarı-kırmızı çubuklu" is not. So the table names the colours it draws.

import * as THREE from 'three';

export const PATTERNS = Object.freeze(['plain', 'stripes', 'hoops', 'halves', 'sash']);

/**
 * Ready-made schemes, keyed by what they look like.
 *
 * `base` is the shirt, `accent` is the pattern on it, `trim` is the collar and
 * cuffs. Anything can be handed to makeKitTexture directly; these are just the
 * combinations worth having on a menu.
 */
export const KIT_PRESETS = Object.freeze({
  'sari-kirmizi': { base: '#a4032c', accent: '#f7b512', trim: '#f7b512', pattern: 'stripes' },
  'sari-lacivert': { base: '#173163', accent: '#f5e02a', trim: '#f5e02a', pattern: 'stripes' },
  'siyah-beyaz': { base: '#101014', accent: '#f2f2f2', trim: '#f2f2f2', pattern: 'stripes' },
  'bordo-mavi': { base: '#6d1330', accent: '#2b5fae', trim: '#e8e8e8', pattern: 'halves' },
  'kirmizi-beyaz': { base: '#c8102e', accent: '#ffffff', trim: '#ffffff', pattern: 'hoops' },
  'mavi-beyaz': { base: '#1d4ed8', accent: '#ffffff', trim: '#ffffff', pattern: 'sash' },
  'yesil-beyaz': { base: '#0f7b3c', accent: '#ffffff', trim: '#ffffff', pattern: 'stripes' },
  'turuncu-lacivert': { base: '#e35205', accent: '#12224d', trim: '#12224d', pattern: 'hoops' },
});

const W = 256;
const H = 256;

/** Stripes this wide read as stripes; any more and it is halves. */
const STRIPE_COUNT = 6;
const HOOP_COUNT = 7;

function contrastFor(hex) {
  // Relative luminance, the sRGB one. A dark shirt takes white trim and a
  // light shirt takes near-black, which is what makes a number legible.
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? '#15171c' : '#f4f4f4';
}

/** @param {number|string} c a three.js colour or a css string @returns {string} */
function css(c) {
  if (typeof c === 'string') return c;
  return `#${(c >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
}

/**
 * Draw a kit.
 *
 * @param {{base:number|string, accent?:number|string, trim?:number|string,
 *          pattern?:string}} spec
 * @returns {THREE.CanvasTexture|null} null where there is no DOM
 */
export function makeKitTexture(spec) {
  if (typeof document === 'undefined') return null;
  const base = css(spec.base);
  const accent = css(spec.accent ?? contrastFor(base));
  const trim = css(spec.trim ?? accent);
  const pattern = PATTERNS.includes(spec.pattern) ? spec.pattern : 'plain';

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  // The headless suites stub the DOM with just enough canvas to build a name
  // tag, so a missing 2D method here is normal rather than exceptional: a
  // player in a flat shirt is the correct answer, not a crash.
  const NEEDS = ['fillRect', 'beginPath', 'moveTo', 'lineTo', 'closePath',
                 'fill', 'save', 'restore', 'createLinearGradient'];
  if (!g || NEEDS.some((fn) => typeof g[fn] !== 'function')) return null;

  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  g.fillStyle = accent;
  if (pattern === 'stripes') {
    const w = W / (STRIPE_COUNT * 2);
    for (let i = 0; i < STRIPE_COUNT * 2; i += 2) g.fillRect(i * w, 0, w, H);
  } else if (pattern === 'hoops') {
    const h = H / (HOOP_COUNT * 2);
    for (let i = 0; i < HOOP_COUNT * 2; i += 2) g.fillRect(0, i * h, W, h);
  } else if (pattern === 'halves') {
    // U starts at the back seam, so the half that shows on the chest is the
    // middle of the texture, not either edge
    g.fillRect(W * 0.25, 0, W * 0.5, H);
  } else if (pattern === 'sash') {
    g.save();
    g.beginPath();
    g.moveTo(W * 0.18, H);
    g.lineTo(W * 0.46, H);
    g.lineTo(W * 0.86, 0);
    g.lineTo(W * 0.58, 0);
    g.closePath();
    g.fill();
    g.restore();
  }

  // collar and cuffs: the top and bottom of V, which is the neck and the hem
  g.fillStyle = trim;
  g.fillRect(0, 0, W, H * 0.045);
  g.fillRect(0, H * 0.955, W, H * 0.045);

  // A soft vertical shade so a flat colour does not look like a paper cutout.
  // Optional on purpose: the headless stub owns a createLinearGradient that
  // returns undefined, and the kit is perfectly wearable without the shading.
  const shade = g.createLinearGradient(0, 0, 0, H);
  if (shade && typeof shade.addColorStop === 'function') {
    shade.addColorStop(0, 'rgba(255,255,255,0.10)');
    shade.addColorStop(0.55, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.16)');
    g.fillStyle = shade;
    g.fillRect(0, 0, W, H);
  }

  let tex;
  try {
    tex = new THREE.CanvasTexture(cv);
  } catch {
    return null;                  // a stub canvas three.js cannot upload
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * The kit a team wears when the lobby has not chosen one.
 *
 * Derived from the team's own colour so a red team still looks like the red
 * team, with the pattern doing the work of telling the sides apart at a glance.
 *
 * @param {number|string} teamColor
 * @param {number} team 0 or 1
 */
export function defaultKitFor(teamColor, team) {
  return {
    base: css(teamColor),
    accent: contrastFor(css(teamColor)),
    trim: contrastFor(css(teamColor)),
    pattern: team === 0 ? 'stripes' : 'hoops',
  };
}
