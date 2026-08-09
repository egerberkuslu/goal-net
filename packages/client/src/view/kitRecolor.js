// Putting a team's colours on a downloaded footballer.
//
// The conditioned character (vendor-assets/CREDITS.md) is 33 meshes sharing ONE
// material and ONE texture atlas: shirt, shorts, socks, gloves, boots, skin,
// hair and eyes are all painted into the same image. That single fact rules out
// every cheap way of putting two teams on the pitch:
//
//   - material.color tint      -> tints the face too; the whole man turns red
//   - per-mesh material swap   -> there are no per-part meshes to swap
//   - a second downloaded kit  -> a different model, a different rig, a
//                                 different skeleton to retarget
//
// So the recolour happens in the atlas, per pixel, and only where the kit is.
// The kit is found by hue: the shirt is the one large saturated region of the
// texture, and skin, hair, boots and grass-stained socks all sit at different
// hues. Which hue the kit occupies is MEASURED from the atlas rather than
// assumed, so a future model with a red kit needs no code change here.
//
// Lightness is preserved exactly and saturation is carried across as a ratio,
// which is what keeps the shading: every fold, seam, sponsor shadow and
// sleeve-hem highlight is a lightness variation, and only the hue moves. A
// naive fill would flatten the shirt into a paper cut-out.
//
// The result is cached per (atlas, colour), because a 4-a-side match asks for
// exactly two kits and would otherwise repaint a 1 K texture eleven times.

import * as THREE from 'three';

/** Pixels below this saturation are cloth-white, skin shadow or dirt: leave. */
const KIT_SAT_MIN = 0.16;
/** How far from the measured kit hue still counts as the kit, in degrees. */
const KIT_HUE_BAND = 42;
/** Longest edge of the repainted atlas; above this the cost stops paying. */
const MAX_SIDE = 1024;

const cache = new Map();

function rgbToHsl(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d < 1e-6) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, s, l];
}

function hue2rgb(p, q, t) {
  let x = t;
  if (x < 0) x += 1;
  if (x > 1) x -= 1;
  if (x < 1 / 6) return p + (q - p) * 6 * x;
  if (x < 1 / 2) return q;
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  if (s <= 1e-6) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const t = h / 360;
  return [hue2rgb(p, q, t + 1 / 3), hue2rgb(p, q, t), hue2rgb(p, q, t - 1 / 3)];
}

/** Shortest distance between two hues, in degrees. */
function hueGap(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Which hue this atlas's kit occupies, and how saturated it is.
 *
 * Found by histogram rather than by looking at the middle of the image: the
 * shirt is not in a known place, but it IS the largest saturated area, because
 * skin is barely saturated and hair, boots and eyes are small. Weighting each
 * bin by saturation keeps a wide, faintly-tinted skin region from outvoting the
 * shirt.
 *
 * @returns {{hue:number, sat:number}|null} null when nothing is coloured enough
 *   to be a kit, in which case the caller should leave the model alone.
 */
export function measureKitHue(data) {
  const bins = new Float64Array(36);        // 10 degrees each
  const sats = new Float64Array(36);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    const [h, s, l] = rgbToHsl(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    if (s < KIT_SAT_MIN || l < 0.06 || l > 0.94) continue;
    const b = Math.min(35, (h / 10) | 0);
    bins[b] += s;
    sats[b] += s;
  }
  let best = -1;
  let bestW = 0;
  for (let b = 0; b < 36; b++) {
    // A hue and its two neighbours, so a kit that straddles a bin edge is not
    // split in half and beaten by a narrower band of hair.
    const w = bins[(b + 35) % 36] + bins[b] + bins[(b + 1) % 36];
    if (w > bestW) { bestW = w; best = b; }
  }
  if (best < 0 || bestW <= 0) return null;
  let sum = 0;
  let n = 0;
  for (const b of [(best + 35) % 36, best, (best + 1) % 36]) {
    if (bins[b] <= 0) continue;
    sum += sats[b];
    n += bins[b];
  }
  return { hue: best * 10 + 5, sat: n > 0 ? sum / n : 0.5 };
}

/**
 * Repaint a character atlas into a team's colour.
 *
 * @param {object} map the model's own texture, left untouched
 * @param {object} color THREE.Color the kit should become
 * @returns {object|null} a texture to use in its place, or null if the atlas
 *   could not be read (a cross-origin image, no canvas, no kit-coloured pixels)
 */
export function recolorKit(map, color) {
  if (!map?.image || typeof document === 'undefined') return null;
  const key = `${map.uuid}|${color.getHexString()}`;
  if (cache.has(key)) return cache.get(key);

  const src = map.image;
  const w = src.width || src.videoWidth || 0;
  const h = src.height || src.videoHeight || 0;
  if (!w || !h) return null;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const chh = Math.max(1, Math.round(h * scale));

  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = chh;
  const g = cv.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  let img;
  try {
    g.drawImage(src, 0, 0, cw, chh);
    img = g.getImageData(0, 0, cw, chh);
  } catch {
    return null;                            // tainted canvas: keep the original
  }

  const kit = measureKitHue(img.data);
  if (!kit) { cache.set(key, null); return null; }
  const [th, ts] = rgbToHsl(color.r, color.g, color.b);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const [ph, ps, pl] = rgbToHsl(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
    if (ps < KIT_SAT_MIN || hueGap(ph, kit.hue) > KIT_HUE_BAND) continue;
    // Saturation travels as a RATIO so a washed-out fold stays washed out and
    // a deep crease stays deep; only the hue is replaced outright.
    const s = Math.min(1, ts * (ps / (kit.sat || ps)));
    const [r, gg, b] = hslToRgb(th, s, pl);
    d[i] = Math.round(r * 255);
    d[i + 1] = Math.round(gg * 255);
    d[i + 2] = Math.round(b * 255);
  }
  g.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  // Everything about how the texture is READ has to survive the repaint. glTF
  // textures are flipY:false, and getting this wrong turns a footballer into a
  // man wearing his own face on his back.
  tex.flipY = map.flipY;
  tex.colorSpace = map.colorSpace;
  tex.wrapS = map.wrapS;
  tex.wrapT = map.wrapT;
  tex.repeat.copy(map.repeat);
  tex.offset.copy(map.offset);
  tex.anisotropy = map.anisotropy;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}
