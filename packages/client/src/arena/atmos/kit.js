// Matrix #24 — the kit system: one atlas, colour masks and a shirt number.
//
// presentation.md states the shape of it: "one base texture + grayscale colour
// masks -> team colour in the shader; number from an SDF font/atlas". That is
// what this is, with the SDF swapped for a crisp bitmap font because at the
// distance a shirt number is read a 5x7 glyph upscaled into a 128 px cell is
// indistinguishable from a distance field and costs no extra shader work.
//
// ONE atlas texture and ONE shader program serve every player on the pitch. A
// kit change at runtime — team colour, pattern, number, keeper or outfield —
// writes uniform floats and nothing else: no new material, no new texture, no
// shader recompile. scripts/atmos-test.mjs asserts exactly that by counting
// allocations across a hundred kit changes.
//
// The atlas itself is built with plain arithmetic into a Uint8Array. There is
// no canvas and no DOM anywhere in the build path, which is why the layout,
// the masks and the glyph coverage can all be asserted headlessly.
//
// Atlas layout, a 4x4 grid of 128 px cells in a 512 px square:
//   0..4    patterns   plain, stripes, hoops, sash, halves
//   5..14   digits     0 .. 9
//   15      keeper     the loud pattern reserved for the goalkeeper
//
// Pattern channels
//   R  baked fabric shading, 0..255, multiplied into the final colour
//   G  secondary-colour mask
//   B  trim mask (collar and cuffs)
//   A  255

import * as THREE from 'three';
import { deriveKeeperColor, shade } from '../../view/playerView.js';

export const ATLAS_SIZE = 512;
export const CELL_SIZE = 128;
export const ATLAS_COLS = ATLAS_SIZE / CELL_SIZE;

export const PATTERNS = Object.freeze(['plain', 'stripes', 'hoops', 'sash', 'halves']);
export const KEEPER_CELL = 15;
export const DIGIT_CELL_0 = 5;

/** @param {number} index 0..15 @returns {{x:number,y:number,w:number,h:number}} pixels */
export function cellRect(index) {
  const i = Math.max(0, Math.min(ATLAS_COLS * ATLAS_COLS - 1, index | 0));
  return {
    x: (i % ATLAS_COLS) * CELL_SIZE,
    y: Math.floor(i / ATLAS_COLS) * CELL_SIZE,
    w: CELL_SIZE,
    h: CELL_SIZE,
  };
}

/**
 * The same cell as a uv rectangle. Row 0 of the pixel buffer is the TOP of the
 * image and uv v = 0 is the BOTTOM, so the flip lives here and nowhere else.
 * @returns {number[]} [offsetU, offsetV, scaleU, scaleV]
 */
export function cellUv(index) {
  const r = cellRect(index);
  return [
    r.x / ATLAS_SIZE,
    1 - (r.y + r.h) / ATLAS_SIZE,
    r.w / ATLAS_SIZE,
    r.h / ATLAS_SIZE,
  ];
}

/** @param {string} name @returns {number} atlas cell of a pattern */
export function patternCell(name) {
  const i = PATTERNS.indexOf(name);
  return i < 0 ? 0 : i;
}

/** @param {number} d 0..9 @returns {number} atlas cell of a digit */
export function digitCell(d) {
  return DIGIT_CELL_0 + Math.max(0, Math.min(9, d | 0));
}

// ------------------------------------------------------------- the 5x7 font

const GLYPH_W = 5, GLYPH_H = 7;
const DIGITS = [
  '01110 10001 10011 10101 11001 10001 01110', // 0
  '00100 01100 00100 00100 00100 00100 01110', // 1
  '01110 10001 00001 00010 00100 01000 11111', // 2
  '11111 00010 00100 00010 00001 10001 01110', // 3
  '00010 00110 01010 10010 11111 00010 00010', // 4
  '11111 10000 11110 00001 00001 10001 01110', // 5
  '00110 01000 10000 11110 10001 10001 01110', // 6
  '11111 00001 00010 00100 01000 01000 01000', // 7
  '01110 10001 10001 01110 10001 10001 01110', // 8
  '01110 10001 10001 01111 00001 00010 01100', // 9
].map((s) => s.split(' '));

/** True when the 5x7 cell of `digit` at (gx, gy) is ink. Pure, for the tests. */
export function glyphPixel(digit, gx, gy) {
  const rows = DIGITS[Math.max(0, Math.min(9, digit | 0))];
  if (gx < 0 || gx >= GLYPH_W || gy < 0 || gy >= GLYPH_H) return false;
  return rows[gy][gx] === '1';
}

// ------------------------------------------------------------- atlas raster

function fillCell(data, index, fn) {
  const r = cellRect(index);
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const o = ((r.y + y) * ATLAS_SIZE + (r.x + x)) * 4;
      fn(x / r.w, y / r.h, o, data, x, y);
    }
  }
}

// A cheap deterministic weave: two beats at right angles plus a hash speckle.
function fabric(u, v) {
  const weave = 0.5 + 0.5 * Math.sin(u * 260) * Math.sin(v * 260);
  const h = Math.sin(u * 421.13 + v * 733.7) * 43758.5453;
  const speck = h - Math.floor(h);
  return 0.78 + 0.14 * weave + 0.08 * speck;
}

function patternMask(kind, u, v) {
  switch (kind) {
    case 1: return (Math.floor(u * 8) % 2 === 0) ? 1 : 0;        // stripes
    case 2: return (Math.floor(v * 7) % 2 === 0) ? 1 : 0;        // hoops
    case 3: return Math.abs(u - v) < 0.16 ? 1 : 0;               // sash
    case 4: return u > 0.5 ? 1 : 0;                              // halves
    case 5: return (Math.floor(u * 6) + Math.floor(v * 6)) % 2 === 0 ? 1 : 0; // keeper
    default: return 0;                                           // plain
  }
}

function trimMask(u, v) {
  const collar = v < 0.085 && Math.abs(u - 0.5) < 0.3 ? 1 : 0;
  const cuffs = (u < 0.055 || u > 0.945) && v > 0.18 && v < 0.72 ? 1 : 0;
  const hem = v > 0.955 ? 1 : 0;
  return collar || cuffs || hem ? 1 : 0;
}

/**
 * Build the whole atlas. No canvas, no DOM, deterministic.
 * @returns {{data:Uint8Array, width:number, height:number}}
 */
export function buildKitAtlas() {
  const data = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4);

  const paintPattern = (cell, kind) => fillCell(data, cell, (u, v, o) => {
    data[o] = Math.round(Math.max(0, Math.min(1, fabric(u, v))) * 255);
    data[o + 1] = patternMask(kind, u, v) ? 255 : 0;
    data[o + 2] = trimMask(u, v) ? 255 : 0;
    data[o + 3] = 255;
  });
  for (let i = 0; i < PATTERNS.length; i++) paintPattern(i, i);
  paintPattern(KEEPER_CELL, 5);

  // Digits: R is the glyph coverage, everything else stays clear. The 5x7 grid
  // is supersampled 4x4 per texel, so the shirt number reads as a smooth
  // shape close up instead of a staircase of 25 px blocks.
  const pad = 0.12;
  const SS = 4;
  const cover = (d, u, v) => {
    const gu = (u - pad) / (1 - pad * 2);
    const gv = (v - pad) / (1 - pad * 2);
    if (gu < 0 || gu >= 1 || gv < 0 || gv >= 1) return 0;
    return glyphPixel(d, Math.floor(gu * GLYPH_W), Math.floor(gv * GLYPH_H)) ? 1 : 0;
  };
  for (let d = 0; d <= 9; d++) {
    fillCell(data, digitCell(d), (u, v, o) => {
      let sum = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          sum += cover(d, u + ((sx + 0.5) / SS - 0.5) / CELL_SIZE,
            v + ((sy + 0.5) / SS - 0.5) / CELL_SIZE);
        }
      }
      data[o] = Math.round((sum / (SS * SS)) * 255);
      data[o + 1] = 0;
      data[o + 2] = 0;
      data[o + 3] = 255;
    });
  }

  return { data, width: ATLAS_SIZE, height: ATLAS_SIZE };
}

/** Read one texel out of a built atlas. Test helper. */
export function atlasTexel(atlas, x, y) {
  const o = ((y | 0) * atlas.width + (x | 0)) * 4;
  return [atlas.data[o], atlas.data[o + 1], atlas.data[o + 2], atlas.data[o + 3]];
}

// ------------------------------------------------------------- kit resolving

export const DEFAULT_TEAM_COLORS = [0xe23b3b, 0x3b6de2];

/** Relative luminance of a packed hex colour, 0..1. */
export function luminance(hex) {
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >> 8) & 0xff) / 255;
  const b = (hex & 0xff) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Everything the shader needs for one player, from what a lobby knows.
 * Pure and total: bad input lands on a sane kit rather than throwing.
 *
 * @param {{team?:number, role?:string, pattern?:string, number?:number,
 *          colors?:number[]}} spec
 */
export function resolveKit(spec = {}) {
  const team = spec.team === 1 ? 1 : 0;
  const keeper = spec.role === 'keeper';
  const colors = Array.isArray(spec.colors) ? spec.colors : DEFAULT_TEAM_COLORS;
  const raw = Number.isFinite(colors[team]) ? (colors[team] >>> 0) & 0xffffff
    : DEFAULT_TEAM_COLORS[team];
  const primary = keeper ? deriveKeeperColor(raw) : raw;
  const secondary = shade(primary, keeper ? 0.2 : -0.3);
  const trim = shade(primary, luminance(primary) > 0.5 ? -0.35 : 0.38);
  const pattern = keeper ? 'keeper'
    : (PATTERNS.includes(spec.pattern) ? spec.pattern : 'stripes');
  const cell = keeper ? KEEPER_CELL : patternCell(pattern);

  let number = Number.isFinite(spec.number) ? Math.round(spec.number) : 0;
  number = Math.max(0, Math.min(99, number));
  const digits = number >= 10
    ? [digitCell(Math.floor(number / 10)), digitCell(number % 10)]
    : [digitCell(number)];

  return {
    team,
    role: keeper ? 'keeper' : 'field',
    pattern,
    patternCell: cell,
    primary,
    secondary,
    trim,
    number,
    digits,
    numberColor: luminance(primary) > 0.52 ? 0x14181f : 0xf4f7ff,
    patternUv: cellUv(cell),
    digitUv: digits.map(cellUv),
  };
}

// --------------------------------------------------------------- the shader

const KIT_VERT_DECL = /* glsl */`
varying vec2 vKitUv;
`;
const KIT_VERT_BODY = /* glsl */`
vKitUv = uv;
`;

const KIT_FRAG_DECL = /* glsl */`
varying vec2 vKitUv;
uniform sampler2D uKitAtlas;
uniform vec4 uKitPattern;
uniform vec3 uKitPrimary;
uniform vec3 uKitSecondary;
uniform vec3 uKitTrim;
uniform vec3 uKitNumberColor;
uniform vec4 uKitDigit0;
uniform vec4 uKitDigit1;
uniform vec4 uKitNumberBox;  // centreU, centreV, halfW, halfH
uniform float uKitNumberOn;  // 0 none, 1 one digit, 2 two digits

float kitGlyph(vec4 cell, vec2 local) {
  if (local.x < 0.0 || local.x > 1.0 || local.y < 0.0 || local.y > 1.0) return 0.0;
  return texture2D(uKitAtlas, cell.xy + local * cell.zw).r;
}
`;

const KIT_FRAG_BODY = /* glsl */`
{
  vec2 kuv = uKitPattern.xy + fract(vKitUv) * uKitPattern.zw;
  vec4 kitTex = texture2D(uKitAtlas, kuv);
  vec3 kitCol = mix(uKitPrimary, uKitSecondary, kitTex.g);
  kitCol = mix(kitCol, uKitTrim, kitTex.b);
  kitCol *= 0.82 + 0.22 * kitTex.r;

  if (uKitNumberOn > 0.5) {
    vec2 rel = (vKitUv - uKitNumberBox.xy) / uKitNumberBox.zw * 0.5 + 0.5;
    float ink = 0.0;
    if (uKitNumberOn > 1.5) {
      ink = max(kitGlyph(uKitDigit0, vec2(rel.x * 2.0, 1.0 - rel.y)),
                kitGlyph(uKitDigit1, vec2(rel.x * 2.0 - 1.0, 1.0 - rel.y)));
    } else {
      ink = kitGlyph(uKitDigit0, vec2(rel.x, 1.0 - rel.y));
    }
    kitCol = mix(kitCol, uKitNumberColor, clamp(ink, 0.0, 1.0));
  }
  diffuseColor.rgb *= kitCol;
}
`;

/** Uniform values for one kit. Pure, so a test can compare it to the atlas. */
export function kitUniformValues(kit, { number = true } = {}) {
  const on = !number || kit.number <= 0 ? 0 : kit.digits.length;
  return {
    pattern: kit.patternUv.slice(),
    primary: kit.primary,
    secondary: kit.secondary,
    trim: kit.trim,
    numberColor: kit.numberColor,
    digit0: (kit.digitUv[0] || kit.patternUv).slice(),
    digit1: (kit.digitUv[1] || kit.digitUv[0] || kit.patternUv).slice(),
    numberOn: on,
  };
}

// Where the number sits in the torso's own uv. The body is a capsule, so u
// runs once around the chest: 0.5 is the back, and a half-width of 0.055 is
// about a hand's span of shirt rather than a third of the way round it.
const NUMBER_BOX_SHIRT = [0.5, 0.66, 0.055, 0.075];
const NUMBER_BOX_NONE = [0.5, 0.66, 0.0001, 0.0001];

/**
 * One atlas, one program, a pool of materials that only ever have their
 * uniforms rewritten.
 */
export class KitSystem {
  constructor() {
    const atlas = buildKitAtlas();
    this.atlas = atlas;
    this.texture = new THREE.DataTexture(
      atlas.data, atlas.width, atlas.height, THREE.RGBAFormat, THREE.UnsignedByteType,
    );
    this.texture.colorSpace = THREE.NoColorSpace; // masks, not colours
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;

    this.materialsCreated = 0;
    this.applied = 0;
    this.sets = [];
  }

  _material(numberBox) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });
    const uniforms = {
      uKitAtlas: { value: this.texture },
      uKitPattern: { value: new THREE.Vector4(0, 0, 1, 1) },
      uKitPrimary: { value: new THREE.Color(0xffffff) },
      uKitSecondary: { value: new THREE.Color(0xffffff) },
      uKitTrim: { value: new THREE.Color(0xffffff) },
      uKitNumberColor: { value: new THREE.Color(0xffffff) },
      uKitDigit0: { value: new THREE.Vector4(0, 0, 1, 1) },
      uKitDigit1: { value: new THREE.Vector4(0, 0, 1, 1) },
      uKitNumberBox: { value: new THREE.Vector4(...numberBox) },
      uKitNumberOn: { value: 0 },
    };
    mat.userData.kitUniforms = uniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = KIT_VERT_DECL + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>', `#include <begin_vertex>\n${KIT_VERT_BODY}`,
      );
      shader.fragmentShader = KIT_FRAG_DECL + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>', `#include <color_fragment>\n${KIT_FRAG_BODY}`,
      );
    };
    // Every kit material compiles the identical program, so three keeps one
    // entry in its shader cache no matter how many players are on the pitch.
    mat.customProgramCacheKey = () => 'arenaKit';
    this.materialsCreated++;
    return mat;
  }

  /**
   * The three materials one player needs. Created once, at build time.
   * Sleeves are a separate material from the torso for one reason: the number
   * box is in mesh uv space, and an arm cylinder's uv covers the same range as
   * the torso's, so a single jersey material stamps the shirt number down both
   * sleeves as well.
   *
   * @returns {{jersey:THREE.Material, sleeve:THREE.Material, shorts:THREE.Material}}
   */
  createSet() {
    const set = {
      jersey: this._material(NUMBER_BOX_SHIRT),
      sleeve: this._material(NUMBER_BOX_NONE),
      shorts: this._material(NUMBER_BOX_NONE),
    };
    this.sets.push(set);
    return set;
  }

  /**
   * Re-dress a player. Uniform writes only: no material, no texture, no
   * program is created here, whatever the kit says.
   *
   * @param {{jersey:THREE.Material, sleeve:THREE.Material, shorts:THREE.Material}} set
   * @param {ReturnType<typeof resolveKit>} kit
   */
  apply(set, kit) {
    const shirt = kitUniformValues(kit, { number: true });
    const plain = kitUniformValues(kit, { number: false });
    write(set.jersey, shirt, kit.primary, kit.secondary, kit.trim);
    write(set.sleeve, plain, kit.primary, kit.secondary, kit.trim);
    write(set.shorts, plain, shade(kit.primary, -0.24), shade(kit.secondary, -0.24), kit.trim);
    this.applied++;
    return this;
  }

  stats() {
    return {
      materials: this.materialsCreated,
      textures: 1,
      atlasBytes: this.atlas.data.length,
      sets: this.sets.length,
      applied: this.applied,
    };
  }

  dispose() {
    for (const set of this.sets) {
      set.jersey.dispose(); set.sleeve.dispose(); set.shorts.dispose();
    }
    this.sets.length = 0;
    this.texture.dispose();
  }
}

function write(material, values, primary, secondary, trim) {
  const u = material.userData.kitUniforms;
  u.uKitPattern.value.set(...values.pattern);
  u.uKitPrimary.value.setHex(primary);
  u.uKitSecondary.value.setHex(secondary);
  u.uKitTrim.value.setHex(trim);
  u.uKitNumberColor.value.setHex(values.numberColor);
  u.uKitDigit0.value.set(...values.digit0);
  u.uKitDigit1.value.set(...values.digit1);
  u.uKitNumberOn.value = values.numberOn;
}

/**
 * Put a kit on a PlayerView. The view's own materials are disposed and
 * replaced once, at build time; after that the kit changes through uniforms.
 *
 * @param {object} view a view/playerView.js PlayerView
 * @param {{jersey:THREE.Material, sleeve:THREE.Material, shorts:THREE.Material}} set
 */
export function dressPlayerView(view, set) {
  const body = view.body || view.group?.children?.[0];
  const replaced = [];
  if (body && body.isMesh) replaced.push([body, set.jersey]);
  for (const arm of view.arms || []) replaced.push([arm, set.sleeve || set.jersey]);
  for (const leg of view.legs || []) replaced.push([leg, set.shorts]);
  const old = new Set();
  for (const [mesh, mat] of replaced) {
    if (mesh.material && mesh.material !== mat) old.add(mesh.material);
    mesh.material = mat;
  }
  for (const mat of old) mat.dispose();
  return replaced.length;
}
