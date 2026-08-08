// Automatic "best 3 moments" (matrix #32).
//
// Pure functions over the recorded marks. No world, no simulation, no clock —
// the same container gives the same three clips on every machine and in every
// process, which is what makes a highlight reel shareable as three tick ranges
// instead of a video.
//
// Scores are replay-format.md's, unchanged:
//
//   goal              100
//   keeper save        70
//   woodwork           50
//   long-range strike  30      (a shot from beyond LONG_RANGE units)
//   x1.5               anything in the last 60 seconds
//
// Window: [tick - 300, tick + 180], i.e. 5 s of build-up and 3 s of aftermath.
// The build-up is the longer half on purpose: the interesting part of a goal is
// the move that produced it, and the 3 s after a goal is a kickoff.
//
// Ranking, in order:
//   1. every goal is in. A late save scores 105 and would otherwise outrank a
//      first-minute goal, and a reel of a 2-1 match that omits a goal is wrong
//      no matter what the arithmetic says. With more than `count` goals the
//      highest-scoring ones win, which after the late multiplier means the
//      decisive ones.
//   2. the remaining slots go to the best of the rest, skipping anything whose
//      window overlaps a clip already taken.
//   3. windows that still overlap (two goals inside five seconds) are split at
//      the midpoint rather than dropped, so "contains every goal" survives.
//
// Ties break on tick, ascending. Nothing here reads a float.

import { MARK, MARK_NAMES } from './format.js';

export const CLIP_PRE_TICKS = 300; // 5 s of build-up
export const CLIP_POST_TICKS = 180; // 3 s after
export const LATE_WINDOW_TICKS = 3600; // the last 60 s
export const LATE_MULTIPLIER_NUM = 3; // x1.5, as a fraction so scores stay integer
export const LATE_MULTIPLIER_DEN = 2;

export const BASE_SCORES = Object.freeze({
  [MARK.GOAL]: 100,
  [MARK.SAVE]: 70,
  [MARK.WOODWORK]: 50,
  [MARK.SHOT]: 30,
});

/**
 * How far out a shot has to be taken to count as a long-range strike, in pitch
 * units. 300 on the medium preset: the penalty area is 105 deep, so this is a
 * shot from clearly outside it and about a third of the pitch's length. Scaled
 * with the preset so the same shot is "long" on all three arenas.
 */
export const LONG_RANGE_UNITS = 300;

function longRangeFor(settings) {
  // preset scale: kucuk 3/4, orta 1/1, buyuk 5/4 (matchRules.js)
  const scale = settings && settings.pitch === 'kucuk' ? 3 / 4 : settings && settings.pitch === 'buyuk' ? 5 / 4 : 1;
  return Math.round(LONG_RANGE_UNITS * scale);
}

/**
 * candidates(container) -> [{ tick, kind, name, player, score, ... }]
 *
 * Every mark that could be a clip, scored but not yet ranked. Exported because
 * a debug overlay wants to see what was considered, not just what won.
 */
export function candidates(container, options = {}) {
  const lastTick = container.startTick + container.tickCount;
  // "the last 60 seconds" is measured against the match clock when there is
  // one, not against the length of the recording: a 60-second clip of a
  // 3-minute match is not three minutes of stoppage time.
  const scheduledEnd =
    container.settings && container.settings.durationSeconds > 0
      ? container.startTick + container.settings.durationSeconds * container.tickRate
      : lastTick;
  const lateFrom = options.lateFrom == null ? scheduledEnd - LATE_WINDOW_TICKS : options.lateFrom;
  const longRange = options.longRange == null ? longRangeFor(container.settings) : options.longRange;
  const out = [];
  for (const mark of container.marks) {
    let base = BASE_SCORES[mark.kind];
    if (base === undefined) continue;
    if (mark.kind === MARK.SHOT) {
      if (mark.v1 < longRange) continue; // an ordinary shot is not a moment
    }
    let score = base;
    if (mark.tick >= lateFrom) {
      score = Math.round((score * LATE_MULTIPLIER_NUM) / LATE_MULTIPLIER_DEN);
    }
    out.push({
      tick: mark.tick,
      kind: mark.kind,
      name: MARK_NAMES[mark.kind],
      player: mark.player,
      team: mark.kind === MARK.GOAL ? mark.v0 : -1,
      distance: mark.kind === MARK.SHOT || mark.kind === MARK.WOODWORK ? mark.v1 : -1,
      speed: mark.kind === MARK.SAVE || mark.kind === MARK.WOODWORK ? mark.v0 : -1,
      base,
      late: mark.tick >= lateFrom,
      score,
    });
  }
  return out;
}

function byScoreThenTick(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  return a.tick - b.tick;
}

function windowFor(c, container, pre, post) {
  const first = container.startTick;
  const last = container.startTick + container.tickCount;
  return {
    ...c,
    startTick: Math.max(first, c.tick - pre),
    endTick: Math.min(last, c.tick + post),
  };
}

function overlaps(a, b) {
  return a.startTick <= b.endTick && b.startTick <= a.endTick;
}

/**
 * highlights(container, { count, pre, post }) -> clips in playback order
 *
 * Each clip is `{ startTick, endTick, kind, name, score, rank, tick, player }`.
 * `rank` is the ranking position (0 is the best moment); the array itself is
 * sorted by startTick so a player can walk it front to back.
 */
export function highlights(container, options = {}) {
  const count = options.count == null ? 3 : options.count;
  const pre = options.pre == null ? CLIP_PRE_TICKS : options.pre;
  const post = options.post == null ? CLIP_POST_TICKS : options.post;

  const scored = candidates(container, options).sort(byScoreThenTick);
  const goals = scored.filter((c) => c.kind === MARK.GOAL);
  const rest = scored.filter((c) => c.kind !== MARK.GOAL);

  const taken = [];
  for (const g of goals) {
    if (taken.length >= count) break;
    taken.push(windowFor(g, container, pre, post));
  }
  for (const c of rest) {
    if (taken.length >= count) break;
    const clip = windowFor(c, container, pre, post);
    if (taken.some((t) => overlaps(t, clip))) continue;
    taken.push(clip);
  }

  // Goals are never dropped for overlapping each other, so split the seam.
  taken.sort((a, b) => a.tick - b.tick);
  for (let i = 1; i < taken.length; i++) {
    const prev = taken[i - 1];
    const cur = taken[i];
    if (prev.endTick >= cur.startTick) {
      const mid = Math.floor((prev.tick + cur.tick) / 2);
      prev.endTick = Math.min(prev.endTick, mid);
      cur.startTick = Math.max(cur.startTick, mid + 1);
    }
  }

  const ranked = taken.slice().sort(byScoreThenTick);
  for (let i = 0; i < ranked.length; i++) ranked[i].rank = i;
  return taken;
}

/** One-line summaries, for a log or a test's eyes. */
export function describeHighlights(clips) {
  return clips.map(
    (c) =>
      `#${c.rank} ${c.name} tick ${c.tick} [${c.startTick}..${c.endTick}] score ${c.score}${
        c.late ? ' (late)' : ''
      }`,
  );
}
