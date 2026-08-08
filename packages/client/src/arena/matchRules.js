// When a match is over, decided from the authoritative state alone.
//
// Host and guest both call this with the same (tick, score) pair, so nobody has
// to broadcast "the match ended" for the two screens to agree — the end screen
// is a function of state, not a message. The host still sends one, but only so
// a guest whose snapshot stream died still leaves the pitch.
//
// Rules come from 10-design/modes-rules.md:
//   * time limit and goal limit are room settings
//   * a draw at full time ends the match unless golden goal is on, in which case
//     the next goal wins (capped, so a stalemate cannot run forever)
//   * mercy rule, on by default: a four-goal gap ends it early

import { TICK_HZ } from './units.js';

export const DEFAULT_SETTINGS = Object.freeze({
  mode: '3v3',
  difficulty: 'orta',
  matchSeconds: 180,
  goalLimit: 5,
  goldenGoal: true,
  mercyGap: 4,
  goldenGoalSeconds: 90,
});

/**
 * matchStatus(tick, score, settings) -> {
 *   over, reason, winner, secondsLeft, golden
 * }
 * `winner` is 0, 1 or -1 for a draw. `reason` is one of
 * 'goal-limit' | 'mercy' | 'time' | 'golden' | null.
 */
export function matchStatus(tick, score, settings = DEFAULT_SETTINGS) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const red = score[0] | 0;
  const blue = score[1] | 0;
  const gap = Math.abs(red - blue);
  const leader = red === blue ? -1 : (red > blue ? 0 : 1);
  const fullTicks = Math.max(0, Math.round(s.matchSeconds * TICK_HZ));
  const secondsLeft = Math.max(0, (fullTicks - tick) / TICK_HZ);

  if (s.goalLimit > 0 && (red >= s.goalLimit || blue >= s.goalLimit)) {
    return done('goal-limit', leader, secondsLeft, false);
  }
  if (s.mercyGap > 0 && gap >= s.mercyGap) {
    return done('mercy', leader, secondsLeft, false);
  }
  if (tick < fullTicks) {
    return { over: false, reason: null, winner: -1, secondsLeft, golden: false };
  }

  // full time
  if (leader !== -1) {
    const inGolden = s.goldenGoal && tick > fullTicks;
    return done(inGolden ? 'golden' : 'time', leader, 0, inGolden);
  }
  if (!s.goldenGoal) return done('time', -1, 0, false);

  const goldenTicks = Math.max(0, Math.round(s.goldenGoalSeconds * TICK_HZ));
  if (tick >= fullTicks + goldenTicks) return done('golden', -1, 0, true);
  return {
    over: false,
    reason: null,
    winner: -1,
    secondsLeft: (fullTicks + goldenTicks - tick) / TICK_HZ,
    golden: true,
  };
}

function done(reason, winner, secondsLeft, golden) {
  return { over: true, reason, winner, secondsLeft, golden };
}

/** mm:ss for the HUD. */
export function clockText(secondsLeft) {
  const s = Math.max(0, Math.ceil(secondsLeft));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
