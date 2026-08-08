// arena/assets — the procedural stadium set and the quality tiers.
//
// Feature matrix rows #18 (stadium and decor, scene under 150k triangles, GLB
// with Draco + KTX2) and #19 (draw calls under 50 on mobile and 100 on desktop,
// 60 FPS on mid hardware), against brain/20-tech-spec/rendering-optimization.md.
//
//   geometry.js     a THREE-free triangle builder: boxes, terraces, tubes, arcs
//   stadiumSpec.js  the set itself, as pure typed arrays and instance tables
//   textures.js     turf and hoarding atlas, drawn the same way in both worlds
//   stadium.js      the spec, wrapped in three, in six draw calls
//   scene.js        the arena's renderer, lights, turf and stadium
//   quality.js      device tiers and the budgets each is held to
//   glb.js          load the baked GLB in place of the runtime geometry
//
// The offline half is tools/build-assets.mjs, which imports stadiumSpec.js —
// the very same module — and writes dist-assets/stadium.glb through Draco and
// KTX2/ETC1S. There is exactly one description of this stadium in the repo.

export {
  box, createMeshBuilder, cylinder, groundArc, groundLine, rgb, terrace, tube,
} from './geometry.js';

export {
  DEFAULT_DETAIL, DEFAULT_LAYOUT, PALETTE, buildStadiumSpec,
} from './stadiumSpec.js';

export { BOARD_PANELS, createTextures, drawBoards, drawTurf } from './textures.js';

export { buildStadium, toBufferGeometry } from './stadium.js';

export { createArenaScene } from './scene.js';

export {
  BUDGETS, QUALITY, TIERS, autoQuality, checkBudget, detectTier, qualityFor,
  rendererLimits,
} from './quality.js';

export { GLB_URL, loadBakedStadium } from './glb.js';
