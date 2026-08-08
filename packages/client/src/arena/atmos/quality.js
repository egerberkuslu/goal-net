// Device tiers for the cosmetic layer.
//
// rendering-optimization.md fixes the budget (scene < 150k triangles, draw
// calls < 50 mobile / < 100 desktop) and asks for a device tier that turns
// crowd density, cloth iterations and particles down on its own. That tier is
// one plain object per level so every subsystem reads the same numbers and a
// headless test can assert against them without a GPU.
//
// Nothing here reads or writes core state; these are render knobs only.

/** @typedef {'low'|'medium'|'high'} Tier */

export const TIERS = Object.freeze({
  low: Object.freeze({
    name: 'low',
    // crowd
    crowdSeatPitch: 1.05,   // metres between spectators along a row
    crowdRows: 1,           // rows populated across each tier's depth
    crowdEmptyChance: 0.22,
    // net cloth
    netSubsteps: 3,
    netIters: 1,
    netIdleSubsteps: 1,
    netFarNet: false,       // only the net the ball is near gets solved
    netStitchCords: false,  // draw the structural cords only
    // flags
    flagIters: 2,
    flagGrid: [7, 5],
    // ball boys
    ballBoys: 2,
  }),
  medium: Object.freeze({
    name: 'medium',
    crowdSeatPitch: 0.78,
    crowdRows: 2,
    crowdEmptyChance: 0.12,
    netSubsteps: 5,
    netIters: 2,
    netIdleSubsteps: 2,
    netFarNet: true,
    netStitchCords: false,
    flagIters: 3,
    flagGrid: [9, 6],
    ballBoys: 3,
  }),
  high: Object.freeze({
    name: 'high',
    crowdSeatPitch: 0.62,
    crowdRows: 3,
    crowdEmptyChance: 0.08,
    netSubsteps: 6,
    netIters: 2,
    netIdleSubsteps: 2,
    netFarNet: true,
    netStitchCords: true,
    flagIters: 4,
    flagGrid: [10, 8],
    ballBoys: 4,
  }),
});

/**
 * Pick a tier from what the browser will admit to. Deliberately conservative:
 * a phone that lies about its core count still lands on `medium` at worst
 * because the pointer test catches it first.
 *
 * @param {object} [env] injectable for tests: {maxTouchPoints, deviceMemory,
 *   hardwareConcurrency, matchMedia}
 * @returns {Tier}
 */
export function detectTier(env = globalThis.navigator || {}) {
  const touch = Number(env.maxTouchPoints || 0) > 1;
  const mem = Number(env.deviceMemory || 0);
  const cores = Number(env.hardwareConcurrency || 0);
  if (touch && (mem === 0 || mem <= 4)) return 'low';
  if (touch) return 'medium';
  if (mem > 0 && mem < 4) return 'low';
  if (cores > 0 && cores < 4) return 'medium';
  return 'high';
}

/** @param {Tier|object} [tier] @returns {object} a frozen tier record */
export function resolveTier(tier) {
  if (tier && typeof tier === 'object' && tier.name) return tier;
  if (typeof tier === 'string' && TIERS[tier]) return TIERS[tier];
  return TIERS[detectTier()];
}
