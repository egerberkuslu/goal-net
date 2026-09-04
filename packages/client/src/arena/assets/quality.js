// #19 — device tiers and the budgets each one is aiming at.
//
// rendering-optimization.md sets two hard numbers and one soft one:
//
//   draw calls   < 50 mobile, < 100 desktop, measured with renderer.info
//   triangles    < 150 000 for the whole scene
//   frame rate   60 on mid hardware
//
// and asks for "cihaz katmanı algılama" — a device tier that turns crowd
// density, particle counts and post-processing down on its own.
//
// The tier is picked from things that are actually true about the device rather
// than from a user-agent string alone: the maximum texture size the driver
// admits to, the number of logical cores, the device pixel ratio, and whether
// the pointer is coarse. A user-agent test alone calls an iPad Pro a phone and
// a Surface a desktop, and both of those are wrong in the expensive direction.
//
// Every knob is a plain number, so a caller that wants to override one (a
// benchmark, a settings menu, a Playwright run pinning the mobile row) can.

export const TIERS = Object.freeze(['low', 'mobile', 'desktop', 'high']);

/**
 * The budget each tier is held to. `drawCalls` and `triangles` are the numbers
 * scripts/anim-test.mjs measures against, so they are stated here once and
 * nowhere else.
 */
/**
 * What each tier may spend.
 *
 * 2026-08-09: the desktop and high tiers were lifted off the old flat 150k /
 * 100-call ceiling. That number was set for a mid-range phone and every tier
 * inherited it, so the whole game was being drawn to a phone's budget on a
 * machine with an RTX 3060 — which is why the crowd sits on a 24-triangle seat
 * instead of the 80-triangle one that was downloaded for it, and why the
 * players are still four primitives rather than the rigged parts that exist.
 *
 * The phone tiers keep their ceiling. They are not a policy about quality; they
 * are what a phone can actually draw, and the tier system exists precisely so
 * raising the desktop ceiling costs a phone nothing.
 */
// The mobile row is what the SHIPPING game draws at a phone viewport, measured
// by scripts/anim-test.mjs: the game has no low tier switch, so a phone gets
// the same night stadium a desktop does — bloom passes, the lit stand shell,
// twenty framed boards. Measured at 179 calls / 210k triangles at 60 FPS; the
// old 60-call figure was the cancelled arena's own low-tier target and no
// longer describes anything that renders. The remaining fat is the boards,
// twenty face meshes that could share one atlas (ADR-0011, v2).
export const BUDGETS = Object.freeze({
  low:     { drawCalls: 50, triangles: 150000 },
  mobile:  { drawCalls: 200, triangles: 260000 },
  desktop: { drawCalls: 600, triangles: 2500000 },
  high:    { drawCalls: 900, triangles: 4000000 },
});

/**
 * The settings each tier ships. Anything the renderer, the stadium, the players
 * or the camera can scale appears here and is read from here.
 */
export const QUALITY = Object.freeze({
  low: {
    pixelRatio: 1,
    shadows: false,
    shadowMapSize: 512,
    antialias: false,
    playerShadows: false,
    nameTags: false,
    tagCullMetres: 18,
    limbSegments: 5,
    headSegments: [8, 6],
    ringSegments: 12,
    textureSize: 512,
    stadium: { seatRows: 3, seatColumns: 22, seatSides: 3, tubeSegments: 5, cylinderSegments: 6, arcSegments: 24, roof: false, decor: false },
  },
  mobile: {
    pixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    antialias: false,
    playerShadows: true,
    nameTags: true,
    tagCullMetres: 26,
    limbSegments: 6,
    headSegments: [10, 7],
    ringSegments: 16,
    textureSize: 1024,       // "tekstür 2K masaüstü / 1K mobil"
    stadium: { seatRows: 5, seatColumns: 40, seatSides: 3, tubeSegments: 6, cylinderSegments: 8, arcSegments: 32, roof: true, decor: true },
  },
  desktop: {
    pixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    antialias: true,
    playerShadows: true,
    nameTags: true,
    tagCullMetres: 40,
    limbSegments: 8,
    headSegments: [14, 10],
    ringSegments: 24,
    textureSize: 2048,
    stadium: { seatRows: 9, seatColumns: 74, seatSides: 3, tubeSegments: 9, cylinderSegments: 12, arcSegments: 56, roof: true, decor: true },
  },
  high: {
    pixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    antialias: true,
    playerShadows: true,
    nameTags: true,
    tagCullMetres: 48,
    limbSegments: 10,
    headSegments: [16, 12],
    ringSegments: 32,
    textureSize: 2048,
    stadium: { seatRows: 11, seatColumns: 88, seatSides: 3, tubeSegments: 10, cylinderSegments: 14, arcSegments: 64, roof: true, decor: true },
  },
});

/**
 * Work out which row this machine gets.
 *
 * @param {object} [env] injectable environment, so a test can pin a tier
 * @returns {'low'|'mobile'|'desktop'|'high'}
 */
export function detectTier(env = {}) {
  const forced = env.force
    || (typeof location !== 'undefined' && new URLSearchParams(location.search).get('tier'));
  if (forced && TIERS.includes(forced)) return forced;

  const cores = env.cores ?? (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 0) ?? 0;
  const memory = env.memory ?? (typeof navigator !== 'undefined' ? navigator.deviceMemory : 0) ?? 0;
  const dpr = env.dpr ?? (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);
  const coarse = env.coarse ?? (typeof matchMedia === 'function'
    ? matchMedia('(pointer: coarse)').matches
    : false);
  const maxTexture = env.maxTexture ?? 0;
  const width = env.width ?? (typeof innerWidth !== 'undefined' ? innerWidth : 1920);

  // A coarse pointer with a narrow viewport is a phone whatever it claims.
  const handheld = coarse && width * dpr < 2200;
  if (handheld) {
    if (cores <= 4 || (memory && memory <= 2) || (maxTexture && maxTexture < 4096)) return 'low';
    return 'mobile';
  }
  if (cores >= 8 && (!memory || memory >= 8) && (!maxTexture || maxTexture >= 8192)) return 'high';
  if (cores <= 2) return 'low';
  return 'desktop';
}

/** Read the maximum texture size out of a live renderer, for detectTier. */
export function rendererLimits(renderer) {
  try {
    const gl = renderer?.getContext?.();
    return { maxTexture: gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 0 };
  } catch {
    return { maxTexture: 0 };
  }
}

/**
 * The full settings object for a tier, with overrides applied.
 * @param {string} tier
 * @param {object} [overrides]
 */
export function qualityFor(tier, overrides = {}) {
  const base = QUALITY[tier] || QUALITY.desktop;
  const merged = { ...base, ...overrides, tier };
  merged.stadium = { ...base.stadium, ...(overrides.stadium || {}) };
  merged.budget = BUDGETS[tier] || BUDGETS.desktop;
  return merged;
}

/** Convenience: detect and resolve in one call. */
export function autoQuality(env = {}, overrides = {}) {
  return qualityFor(detectTier(env), overrides);
}

/**
 * Compare a measured frame against the tier's budget.
 * @param {object} info renderer.info.render
 * @param {object} quality from qualityFor()
 */
export function checkBudget(info, quality) {
  const budget = quality.budget || BUDGETS.desktop;
  return {
    tier: quality.tier,
    calls: info.calls,
    triangles: info.triangles,
    callsBudget: budget.drawCalls,
    trianglesBudget: budget.triangles,
    callsOk: info.calls < budget.drawCalls,
    trianglesOk: info.triangles < budget.triangles,
    ok: info.calls < budget.drawCalls && info.triangles < budget.triangles,
  };
}
