// The commentary director (feature matrix #38).
//
// Events come in, at most one line comes out at a time. Everything about WHEN a
// line is allowed to speak lives here; everything about WHAT it says lives in
// lines.js and everything about how it is heard lives in clips.js.
//
// ------------------------------------------------------------------- policy
//
// SELECTION  every line whose `event` matches, whose tension window contains
//            the current tension and whose guard (LINE_GUARDS) accepts the
//            event's metadata is a candidate. Highest priority wins; ties are
//            broken by position in the table, never by insertion order, so the
//            choice is reproducible.
//
// COOLDOWN   a line that played less than its own `cooldownMs` ago is not a
//            candidate. On top of that a global REPEAT_WINDOW_MS forbids ANY
//            line from repeating inside that window even if its own cooldown is
//            shorter — the thing that makes canned commentary unbearable is
//            hearing the same clip twice in ten seconds, and per-line cooldowns
//            alone do not prevent it once the table grows.
//
// DENSITY    two lines never run closer together than commentaryGapMs(tension)
//            (3.2 s when nothing is happening, 0.9 s in sudden death). Lines at
//            or above URGENT_PRIORITY ignore the gap: a goal is never held back
//            because a throw-in line is still settling.
//
// INTERRUPT  an arriving line cuts the one playing only if it beats it by
//            INTERRUPT_MARGIN. Equal-priority events do not fight; the second
//            one queues. The cut clip is recorded in the log as `interrupted`
//            so a mix engineer can see which tails never played.
//
// QUEUE      at most QUEUE_MAX lines wait. A queued line that has been waiting
//            longer than STALE_MS is dropped instead of played: commentary
//            about a moment that has passed is worse than silence.
//
// The clock is injected. `update(nowMs)` is the only thing that advances state,
// so a test drives a whole match in a loop with no timers, and the browser
// drives it from the same render loop that draws the pitch.

import { LINES, LINES_BY_EVENT, LINE_BY_ID, LANGUAGES } from './lines.js';
import { CLIP_MANIFEST, clipFor } from './manifest.js';
import { commentaryGapMs } from './tension.js';

/** Priority a line needs to interrupt: it must beat the current one by this. */
export const INTERRUPT_MARGIN = 12;

/** At or above this, a line ignores the density gap. */
export const URGENT_PRIORITY = 85;

/** No line may repeat inside this window, whatever its own cooldown says. */
export const REPEAT_WINDOW_MS = 12000;

/** Queue depth and how long a queued line stays relevant. */
export const QUEUE_MAX = 2;
export const STALE_MS = 3500;

/**
 * Guards: extra conditions a line needs beyond its event and tension window.
 * Kept out of lines.js so that table stays pure data (it is serialised into the
 * clip manifest and handed to a recording engineer).
 *
 * Every guard takes the event's `meta` object and returns a boolean. A line
 * with no guard is unconditional.
 */
export const LINE_GUARDS = Object.freeze({
  goal_equaliser: (m) => m.kind === 'equaliser',
  goal_lead: (m) => m.kind === 'lead',
  goal_late: (m) => !!m.late,
  goal_plain: (m) => m.kind === 'normal' || m.kind === 'extend',
  goal_hot: (m) => m.kind === 'normal' || m.kind === 'extend',
  save_big: (m) => (m.xg || 0) >= 0.35,
  save_reflex: (m) => (m.xg || 0) >= 0.15,
  save_routine: (m) => (m.xg || 0) < 0.35,
  dominance_red: (m) => m.team === 0,
  dominance_blue: (m) => m.team === 1,
  half_time: (m) => m.half === 1,
  second_half: (m) => m.half === 2,
  final_whistle_win: (m) => m.winner !== -1 && (m.margin || 0) < 3,
  final_whistle_draw: (m) => m.winner === -1,
  final_whistle_rout: (m) => m.winner !== -1 && (m.margin || 0) >= 3,
});

const inWindow = (line, t) =>
  line.tension === null || (t >= line.tension[0] && t <= line.tension[1]);

/**
 * @param {{manifest?:object, player?:object, lang?:string, tension?:number,
 *          lines?:object[], repeatWindowMs?:number, interruptMargin?:number,
 *          queueMax?:number, staleMs?:number, gapMs?:(t:number)=>number}} options
 */
export function createCommentator(options = {}) {
  const manifest = options.manifest || CLIP_MANIFEST;
  const player = options.player || null;
  const table = options.lines || LINES;
  const byEvent = options.lines
    ? groupByEvent(options.lines)
    : LINES_BY_EVENT;
  const order = new Map(table.map((l, i) => [l.id, i]));
  const repeatWindow = num(options.repeatWindowMs, REPEAT_WINDOW_MS);
  const margin = num(options.interruptMargin, INTERRUPT_MARGIN);
  const queueMax = Math.max(0, num(options.queueMax, QUEUE_MAX));
  const staleMs = num(options.staleMs, STALE_MS);
  const gapOf = options.gapMs || commentaryGapMs;

  let lang = LANGUAGES.includes(options.lang) ? options.lang : LANGUAGES[0];
  let tension = clamp01(num(options.tension, 0));
  let current = null; // { line, lang, startedMs, endsMs, handle, event }
  let lastEndMs = -Infinity;
  const lastPlayed = new Map(); // id -> ms the clip STARTED
  const queue = [];
  const log = []; // every decision, for the test and for a debug overlay

  function record(kind, entry) {
    log.push({ kind, ...entry });
    if (log.length > 400) log.splice(0, log.length - 400);
  }

  function candidatesFor(type, meta, nowMs) {
    const out = [];
    for (const line of byEvent[type] || []) {
      if (!inWindow(line, tension)) continue;
      const guard = LINE_GUARDS[line.id];
      if (guard && !guard(meta || {})) continue;
      const last = lastPlayed.get(line.id);
      if (last != null && nowMs - last < Math.max(line.cooldownMs, repeatWindow)) continue;
      out.push(line);
    }
    out.sort((a, b) => (b.priority - a.priority) || (order.get(a.id) - order.get(b.id)));
    return out;
  }

  function start(line, event, nowMs) {
    const entry = clipFor(manifest, line.id, lang);
    if (current) stopCurrent(nowMs, 'interrupted');
    const handle = player && entry ? player.play(entry, line) : null;
    current = {
      line, lang, event, handle,
      startedMs: nowMs,
      endsMs: nowMs + line.durationMs,
    };
    lastPlayed.set(line.id, nowMs);
    record('play', { id: line.id, lang, atMs: nowMs, event: event.type, priority: line.priority });
    return current;
  }

  function stopCurrent(nowMs, why) {
    if (!current) return;
    if (player && current.handle) player.stop(current.handle);
    record(why, { id: current.line.id, lang: current.lang, atMs: nowMs });
    lastEndMs = nowMs;
    current = null;
  }

  function drain(nowMs) {
    if (current || queue.length === 0) return;
    // stale first, in arrival order
    while (queue.length && nowMs - queue[0].queuedMs > staleMs) {
      const dead = queue.shift();
      record('stale', { id: dead.line.id, atMs: nowMs, event: dead.event.type });
    }
    if (!queue.length) return;
    const next = queue[0];
    if (!allowedNow(next.line, nowMs)) return;
    queue.shift();
    start(next.line, next.event, nowMs);
  }

  function allowedNow(line, nowMs) {
    if (line.priority >= URGENT_PRIORITY) return true;
    return nowMs - lastEndMs >= gapOf(tension);
  }

  return {
    get language() { return lang; },
    get tension() { return tension; },
    get playing() {
      return current ? { id: current.line.id, lang: current.lang, endsMs: current.endsMs } : null;
    },
    get queued() { return queue.map((q) => q.line.id); },
    get log() { return log; },
    /** Ids spoken so far, in order. */
    spoken() { return log.filter((e) => e.kind === 'play').map((e) => e.id); },

    /**
     * Switch language. A clip already in the air finishes in the language it
     * started in — cutting a sentence in half to change accent is worse than
     * one late line — and everything after it resolves in the new one.
     */
    setLanguage(next) {
      if (LANGUAGES.includes(next)) lang = next;
      return lang;
    },

    setTension(t) {
      tension = clamp01(num(t, tension));
      return tension;
    },

    /**
     * Offer one presentation event.
     * @param {{type:string, meta?:object}} event
     * @param {number} nowMs
     * @returns {'play'|'queue'|'drop'} what happened
     */
    feed(event, nowMs) {
      if (!event || typeof event.type !== 'string') return 'drop';
      const meta = event.meta || {};
      const list = candidatesFor(event.type, meta, nowMs);
      if (!list.length) {
        record('nothing', { atMs: nowMs, event: event.type });
        return 'drop';
      }
      const line = list[0];
      const ev = { type: event.type, meta };

      if (current) {
        if (line.priority >= current.line.priority + margin) {
          start(line, ev, nowMs);
          return 'play';
        }
        return enqueue(line, ev, nowMs);
      }
      if (allowedNow(line, nowMs)) {
        start(line, ev, nowMs);
        return 'play';
      }
      return enqueue(line, ev, nowMs);
    },

    /** Advance playback and the queue. Call every frame. */
    update(nowMs) {
      if (current && nowMs >= current.endsMs) stopCurrent(nowMs, 'end');
      drain(nowMs);
      return current ? current.line.id : null;
    },

    /** Text of the line playing right now, for a subtitle strip. */
    subtitle() {
      if (!current) return '';
      return LINE_BY_ID[current.line.id]?.[current.lang] || current.line[current.lang] || '';
    },

    reset() {
      if (current && player && current.handle) player.stop(current.handle);
      current = null;
      queue.length = 0;
      log.length = 0;
      lastPlayed.clear();
      lastEndMs = -Infinity;
    },
  };

  function enqueue(line, event, nowMs) {
    if (queue.length >= queueMax) {
      // keep the loudest: drop the weakest waiting line, or this one
      let worst = 0;
      for (let i = 1; i < queue.length; i++) {
        if (queue[i].line.priority < queue[worst].line.priority) worst = i;
      }
      if (queue[worst].line.priority >= line.priority) {
        record('drop', { id: line.id, atMs: nowMs, event: event.type });
        return 'drop';
      }
      const dropped = queue.splice(worst, 1)[0];
      record('drop', { id: dropped.line.id, atMs: nowMs, event: dropped.event.type });
    }
    queue.push({ line, event, queuedMs: nowMs });
    record('queue', { id: line.id, atMs: nowMs, event: event.type, priority: line.priority });
    return 'queue';
  }
}

function groupByEvent(lines) {
  const m = Object.create(null);
  for (const line of lines) (m[line.event] ||= []).push(line);
  return m;
}

const clamp01 = (v) => (v > 1 ? 1 : v < 0 ? 0 : v);
const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);
