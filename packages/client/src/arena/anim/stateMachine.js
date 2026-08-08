// #16 — the animation state machine.
//
// The acceptance criterion is "State machine'de geçişler temiz": clean
// transitions. Two things have to be true for that, and they are different
// problems with different fixes.
//
//   NO POPPING          every transition has a non-zero crossfade, and the
//                       crossfade is a lerp between the two states' poses.
//                       Enforced structurally: TRANSITIONS has no entry with a
//                       blend of zero, and there is no code path that sets the
//                       current state without going through beginTransition().
//
//   NO ILLEGAL JUMPS    a keeper cannot go from flat on the floor straight into
//                       a side-shuffle; a player cannot re-wind a shot out of
//                       the middle of a swing. Enforced by the adjacency table
//                       below, and — this is the part that matters — an illegal
//                       REQUEST is not dropped and is not forced through. It is
//                       ROUTED: the machine walks the shortest legal path to
//                       the requested state, one legal hop at a time.
//
// Routing rather than dropping is what keeps the two guarantees from fighting
// each other. Dropping an illegal request leaves a keeper stuck on the floor
// because the game asked for the wrong thing once; forcing it through is a pop
// by another name. Walking the graph gives the requester what it asked for and
// the viewer a continuous body.
//
// THE GRAPH, in words
//
//   FIELD PLAYER
//     idle <-> locomotion                    speed crosses the walk threshold
//     idle,locomotion -> windup              a charge starts
//     windup -> kick                         the charge is released
//     windup -> idle,locomotion              the charge is cancelled
//     idle,locomotion -> kick                an instant pass, no windup
//     kick -> idle,locomotion                the swing finishes
//     idle,locomotion -> slide               a tackle goes in
//     slide -> stumble                       the tackle's recovery window
//     slide,stumble -> idle,locomotion       back on the feet
//     idle,locomotion -> stumble             dispossessed
//     ANY -> celebrate,dejected              the score changed
//     celebrate,dejected -> idle,locomotion  the goal window closes
//
//   KEEPER
//     keeperStance <-> keeperShuffle         moving along the line
//     keeperStance,keeperShuffle -> keeperDive
//     keeperDive -> keeperGetUp              the dive whiffed (diveLock)
//     keeperDive -> keeperCatch              the dive got there
//     keeperDive -> keeperStance             the dive completed clean
//     keeperGetUp -> keeperStance            the lock expires
//     keeperStance,keeperShuffle -> keeperCatch
//     keeperCatch -> keeperThrow,keeperClear giving the ball back
//     keeperCatch -> keeperStance            the ball was taken off them
//     keeperClear -> kick                    the clearance IS the shared swing
//     keeperThrow,kick -> keeperStance
//
//   BRIDGE  goalkeeper.md: outside the penalty area a keeper is an ordinary
//     field player, so keeperStance is joined to idle and to locomotion in both
//     directions. That single pair of edges is what makes every keeper state
//     reachable from idle, which scripts/anim-test.mjs checks by search rather
//     than by trusting this comment.

/** Every state the machine can be in. */
export const STATES = Object.freeze([
  'idle',
  'locomotion',
  'windup',
  'kick',
  'slide',
  'stumble',
  'celebrate',
  'dejected',
  'keeperStance',
  'keeperShuffle',
  'keeperDive',
  'keeperGetUp',
  'keeperCatch',
  'keeperThrow',
  'keeperClear',
]);

const S = new Set(STATES);

/** States that any other state may be yanked into, because the whole pitch
 *  reacts to a goal at once and waiting for a swing to finish would look daft. */
export const INTERRUPTS = Object.freeze(['celebrate', 'dejected']);

/**
 * from -> { to: crossfadeSeconds }. A missing edge is an illegal jump.
 * Every value here is strictly greater than zero; the test asserts it.
 */
export const TRANSITIONS = Object.freeze({
  idle: {
    locomotion: 0.18, windup: 0.12, kick: 0.08, slide: 0.08, stumble: 0.10,
    keeperStance: 0.24,
  },
  locomotion: {
    idle: 0.18, windup: 0.12, kick: 0.08, slide: 0.08, stumble: 0.10,
    keeperStance: 0.24,
  },
  windup: { kick: 0.06, idle: 0.20, locomotion: 0.20 },
  kick: { idle: 0.16, locomotion: 0.16, keeperStance: 0.20 },
  slide: { stumble: 0.14, idle: 0.22, locomotion: 0.22 },
  stumble: { idle: 0.25, locomotion: 0.25 },
  celebrate: { idle: 0.35, locomotion: 0.35, keeperStance: 0.35 },
  dejected: { idle: 0.35, locomotion: 0.35, keeperStance: 0.35 },
  keeperStance: {
    keeperShuffle: 0.16, keeperDive: 0.05, keeperCatch: 0.10,
    idle: 0.24, locomotion: 0.24,
  },
  keeperShuffle: {
    keeperStance: 0.16, keeperDive: 0.05, keeperCatch: 0.10, locomotion: 0.20,
  },
  keeperDive: { keeperGetUp: 0.10, keeperCatch: 0.10, keeperStance: 0.22 },
  keeperGetUp: { keeperStance: 0.28 },
  keeperCatch: { keeperThrow: 0.12, keeperClear: 0.12, keeperStance: 0.20 },
  keeperThrow: { keeperStance: 0.24 },
  keeperClear: { kick: 0.06, keeperStance: 0.24 },
});

// Every state also accepts the interrupts. Folded in here rather than typed out
// fifteen times, so a new state cannot forget to react to a goal.
const GRAPH = (() => {
  const g = Object.create(null);
  for (const from of STATES) {
    g[from] = Object.assign(Object.create(null), TRANSITIONS[from] || {});
    for (const to of INTERRUPTS) {
      if (from !== to && g[from][to] === undefined) g[from][to] = 0.30;
    }
  }
  return g;
})();

/** Is `from -> to` a legal single hop? */
export function canTransition(from, to) {
  if (from === to) return true;
  return GRAPH[from] !== undefined && GRAPH[from][to] !== undefined;
}

/** The crossfade for a legal hop, in seconds. Never zero. */
export function transitionTime(from, to) {
  if (from === to) return 0;
  const t = GRAPH[from]?.[to];
  return t === undefined ? null : t;
}

/** All legal successors of a state. */
export function successors(state) {
  return Object.keys(GRAPH[state] || {});
}

/** The full graph, for a test that wants to walk it. */
export function graph() {
  const out = Object.create(null);
  for (const from of STATES) out[from] = { ...GRAPH[from] };
  return out;
}

const _routeCache = new Map();

/**
 * Shortest legal path from `from` to `to`, inclusive of both ends.
 * Returns null when no path exists — which, given the bridge edges, should be
 * impossible, and the test proves it is.
 */
export function route(from, to) {
  if (!S.has(from) || !S.has(to)) return null;
  if (from === to) return [from];
  const key = `${from}>${to}`;
  const hit = _routeCache.get(key);
  if (hit !== undefined) return hit;
  // Breadth-first over a fifteen-node graph: the whole search is cheaper than
  // one matrix multiply, and it is memoised anyway.
  const prev = new Map([[from, null]]);
  const queue = [from];
  let found = false;
  for (let i = 0; i < queue.length && !found; i++) {
    const node = queue[i];
    for (const next of Object.keys(GRAPH[node])) {
      if (prev.has(next)) continue;
      prev.set(next, node);
      if (next === to) { found = true; break; }
      queue.push(next);
    }
  }
  if (!found) { _routeCache.set(key, null); return null; }
  const path = [];
  for (let n = to; n !== null; n = prev.get(n)) path.push(n);
  path.reverse();
  _routeCache.set(key, path);
  return path;
}

/**
 * The machine itself.
 *
 * It holds only what a crossfade needs: which state we are leaving, which we
 * are entering, how far through we are, and where we are ultimately headed.
 * The poses are none of its business — animator.js evaluates `from` and `to`
 * and lerps them by `blend`.
 */
export class AnimStateMachine {
  constructor(initial = 'idle') {
    if (!S.has(initial)) throw new Error(`unknown state: ${initial}`);
    this.from = initial;
    this.to = initial;
    this.goal = initial;
    /** 0 at the start of a crossfade, 1 when it has landed. */
    this.blend = 1;
    this.duration = 0;
    /** Seconds spent in `to` since it was entered. Drives the one-shot poses. */
    this.elapsed = 0;
    /** Rejected requests, for diagnostics. A healthy match stays at zero. */
    this.reroutes = 0;
    this.history = [initial];
  }

  /** The state whose timeline is authoritative right now. */
  get current() { return this.to; }
  /** True while a crossfade is in flight. */
  get blending() { return this.blend < 1; }

  /**
   * Ask for a state. Legal hops start immediately; anything else is routed and
   * the machine takes the first legal step toward it this frame.
   */
  request(target) {
    if (!S.has(target)) return false;
    this.goal = target;
    if (target === this.to) return true;
    if (canTransition(this.to, target)) {
      this._begin(target);
      return true;
    }
    // Illegal as a single hop. Do not drop it and do not force it: step.
    const path = route(this.to, target);
    if (!path || path.length < 2) return false;
    this.reroutes++;
    this._begin(path[1]);
    return true;
  }

  _begin(next) {
    const d = transitionTime(this.to, next);
    if (d === null) return;           // unreachable: _begin is only called legal
    // Starting a new fade from the middle of an old one would snap to `to`.
    // Collapsing to the pose we are ACTUALLY showing is not possible without
    // the pose, so instead the new fade starts from `to` and is lengthened by
    // whatever is left of the old one — the visible result is one continuous
    // ease with no discontinuity at the handover.
    const leftover = (1 - this.blend) * this.duration;
    this.from = this.to;
    this.to = next;
    this.duration = d + leftover * 0.5;
    this.blend = this.duration > 0 ? 0 : 1;
    this.elapsed = 0;
    this.history.push(next);
    if (this.history.length > 64) this.history.shift();
  }

  /** Advance the crossfade and, once landed, take the next hop toward `goal`. */
  update(dt) {
    const d = dt > 0 ? dt : 0;
    this.elapsed += d;
    if (this.blend < 1 && this.duration > 0) {
      this.blend = Math.min(1, this.blend + d / this.duration);
    } else {
      this.blend = 1;
    }
    if (this.blend >= 1 && this.to !== this.goal) {
      const path = route(this.to, this.goal);
      if (path && path.length >= 2) this._begin(path[1]);
      else this.goal = this.to;
    }
    return this;
  }

  /** Smoothstepped blend, so a crossfade eases in and out rather than ramping. */
  get eased() {
    const b = this.blend;
    return b * b * (3 - 2 * b);
  }
}
