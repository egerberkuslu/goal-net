// Kits: the pattern on a shirt, drawn once per team.
//
// The Blender-authored torso and sleeves carry a cylindrical UV whose U runs
// once around the body from the player's LEFT side, so the back sits at u=0.25
// and the chest at u=0.75, with the seam under the arm. That is the whole
// reason this can be a flat canvas rather than a shader — and the reason the
// seam is at the side rather than down the spine, which would have cut every
// squad number in half.
//
// The number IS baked in, because it has to be: it belongs on one player's
// back and nowhere else. A kit canvas is 256x256, which is 256 KB in memory
// per player before mipmaps — for a full 4v4 that is under 2 MB, and the
// alternative (a sprite floating behind the shoulders) does not follow the
// shirt when a player turns.
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
  // Where the back is in U. The wrap runs the way a viewer outside the body
  // reads it (make-view-parts.py), which puts the chest at 0.25 and the back
  // at 0.75 — reversing that winding to un-mirror the digits also swapped
  // these two, and the number spent one build on the player's chest.
  const backCentre = W * 0.75;

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

  // the squad number, on the back, above the mid-back
  if (spec.number != null && typeof g.strokeText === 'function') {
    const text = String(spec.number).slice(0, 2);
    g.save();
    // Flip the glyph vertically.
    //
    // Blender's UV origin, glTF's flip on export and three.js's flip on a
    // canvas texture compose into exactly one vertical flip on the shirt, so a
    // 9 arrived as a 6. That was worked out by measurement rather than from the
    // conventions: drawing it plain gave a 6, adding a horizontal flip still
    // gave a 6, and adding both gave a mirrored 9 — three observations that
    // only fit a pipeline doing a single vertical flip. Cancelling it here is
    // the one place the result is visible on screen.
    g.translate(0, H);
    g.scale(1, -1);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `bold ${Math.round(H * 0.34)}px "Segoe UI", system-ui, sans-serif`;
    // outline first so the digit survives a shirt whose stripes run under it
    g.lineWidth = Math.max(3, H * 0.022);
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.strokeText(text, backCentre, H * 0.62);
    g.fillStyle = numberInk(base, accent, pattern);
    g.fillText(text, backCentre, H * 0.62);
    g.restore();
  }

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
  // flipY stays at three.js's default for a canvas: with the UV wound the way
  // a viewer outside the body reads it (see make-view-parts.py), the default
  // is what puts the number upright. Turning it off was an attempt to fix a
  // mirror that was actually coming from the U direction.
  return tex;
}

/**
 * Ink that stays legible on this shirt.
 *
 * A striped shirt is two colours, so the number has to beat the lighter of the
 * two rather than the base alone — a white 9 on red-and-white hoops disappears
 * every second hoop.
 */
function numberInk(base, accent, pattern) {
  const lum = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255)
      + 0.0722 * (n & 255)) / 255;
  };
  const lightest = pattern === 'plain' ? lum(base) : Math.max(lum(base), lum(accent));
  return lightest > 0.45 ? '#15171c' : '#f6f8fb';
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
