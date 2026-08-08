import { GOAL_W, GOAL_H, MATCH_TIME, MATCH_GOALS } from './constants.js';

// Runtime match settings: a lobby picks these before kickoff, so everything
// that used to read GOAL_W/GOAL_H/MATCH_* reads a config instance instead.
// Post radius, net depth/cell size and pitch dimensions stay fixed constants.

const GOAL_SCALE_MIN = 0.5;
const GOAL_SCALE_MAX = 1.6;
const MATCH_TIME_MIN = 10;
const MATCH_TIME_MAX = 3600;
const GOAL_LIMIT_MAX = 99;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v, fallback) =>
  (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

// Values arrive over the wire from other peers, so every field is validated
// and clamped rather than trusted.
// teamColors ([int,int], optional) rides through untouched for the views.
export function makeConfig(overrides = {}) {
  const o = overrides && typeof overrides === 'object' ? overrides : {};
  const goalScale = clamp(num(o.goalScale, 1), GOAL_SCALE_MIN, GOAL_SCALE_MAX);
  return {
    goalScale,
    goalW: GOAL_W * goalScale,
    goalH: GOAL_H * goalScale,
    matchTime: clamp(Math.round(num(o.matchTime, MATCH_TIME)),
      MATCH_TIME_MIN, MATCH_TIME_MAX),
    goalLimit: clamp(Math.round(num(o.goalLimit, MATCH_GOALS)), 0, GOAL_LIMIT_MAX),
    keepers: o.keepers === undefined ? true : !!o.keepers,
  };
}
