// The two textures the arena needs, drawn procedurally.
//
// Both are also produced OFFLINE by tools/build-assets.mjs, with sharp instead
// of a canvas, at the same sizes and from the same numbers — that is the pair
// that gets compressed to KTX2/ETC1S in the GLB. The canvas versions here are
// what the arena falls back to when the baked GLB has not been built, so the
// game never depends on an artefact being present.

/**
 * How many grain dots the turf gets.
 *
 * Kept deliberately low, and this is a compression decision rather than an
 * aesthetic one. ETC1S is a block codec: it stores two endpoint colours and a
 * two-bit selector per 4x4 block, so a texture of fine uncorrelated noise is
 * close to its worst case. The first version of this used 26 000 dots and the
 * KTX2 turf came out LARGER than the PNG it replaced — the whole pipeline
 * measured as a size regression. At 6 000 the grain still breaks up the mowing
 * stripes at ground level and the texture compresses like the flat art it
 * mostly is. tools/build-assets.mjs uses the same constant.
 */
export const GRAIN_DOTS = 6000;

/** Turf: mowing stripes down the long axis with a cheap deterministic grain. */
export function drawTurf(ctx, size, opts = {}) {
  const { stripes = 16, a = '#2c8a3c', b = '#33984a' } = opts;
  const h = size;
  const w = Math.round(size * (opts.aspect ?? 30 / 48));
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? a : b;
    ctx.fillRect(0, Math.floor(i * h / stripes), w, Math.ceil(h / stripes) + 1);
  }
  // Deterministic grain: a fixed LCG, so two runs of the build script produce
  // byte-identical textures and the GLB hash does not churn.
  let seed = 0x9e3779b9;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < GRAIN_DOTS; i++) {
    const x = (rand() * w) | 0;
    const y = (rand() * h) | 0;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(x, y, 2, 2);
  }
  return { width: w, height: h };
}

/** Hoardings: a four-panel atlas of flat brand blocks. */
export const BOARD_PANELS = Object.freeze([
  { bg: '#1c3f8f', fg: '#ffffff', text: 'GOAL·NET' },
  { bg: '#8f1c2e', fg: '#ffe9c0', text: 'ARENA' },
  { bg: '#1c8f5a', fg: '#04240f', text: 'HAXBALL 3D' },
  { bg: '#a8781c', fg: '#20160a', text: 'DETERMINISTIC' },
]);

export function drawBoards(ctx, width, height) {
  const panelW = width / BOARD_PANELS.length;
  BOARD_PANELS.forEach((p, i) => {
    ctx.fillStyle = p.bg;
    ctx.fillRect(i * panelW, 0, panelW, height);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(i * panelW, height * 0.62, panelW, height * 0.06);
    ctx.fillStyle = p.fg;
    ctx.font = `bold ${Math.round(height * 0.38)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.text, i * panelW + panelW / 2, height * 0.44, panelW * 0.9);
  });
  return { width, height };
}

/** Build both as canvases. Browser only; the build script uses sharp. */
export function createTextures(THREE, quality) {
  if (typeof document === 'undefined') return { turf: null, boards: null };
  const size = quality.textureSize || 1024;

  const turfCanvas = document.createElement('canvas');
  turfCanvas.height = size;
  turfCanvas.width = Math.round(size * (30 / 48));
  drawTurf(turfCanvas.getContext('2d'), size);
  const turf = new THREE.CanvasTexture(turfCanvas);
  turf.colorSpace = THREE.SRGBColorSpace;
  turf.anisotropy = quality.tier === 'low' ? 1 : 8;

  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = size;
  boardCanvas.height = Math.round(size / 8);
  drawBoards(boardCanvas.getContext('2d'), boardCanvas.width, boardCanvas.height);
  const boards = new THREE.CanvasTexture(boardCanvas);
  boards.colorSpace = THREE.SRGBColorSpace;
  boards.anisotropy = 1;

  return { turf, boards };
}
