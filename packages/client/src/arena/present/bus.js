// The presentation event bus (feature matrix #38).
//
// Core events are facts about physics; commentary needs facts about a football
// match. This module is the translation, and it is the only place the two
// vocabularies meet.
//
//   core / recorder      ->  presentation
//   goal                     goal        (+ kind: normal | equaliser | lead |
//                                          extend, + late)
//   goal by a defender       own-goal
//   keeper-save              save        (+ the xG of the shot it stopped)
//   keeper-catch             catch / save
//   keeper-whiff             keeper-error
//   tackle won               tackle
//   woodwork (derived)       woodwork
//   near-miss (derived)      near-miss
//   golden-goal              golden-goal
//   match-end                match-end   (+ winner, margin)
//   tick 0                   kickoff
//   N ticks after a goal     restart
//   (situational)            counter-attack, dominance, pressure
//
// SITUATIONS, all derived from the state sample and nothing else:
//
//   counter-attack  possession changes hands while the ball is in the winning
//                   side's OWN third, and within COUNTER_WINDOW_TICKS the ball
//                   has travelled COUNTER_ADVANCE of the pitch toward the other
//                   goal. That is what a break actually is: a turnover that
//                   turned into ground.
//
//   dominance       over a rolling DOMINANCE_WINDOW_TICKS, one side held the
//                   ball for DOMINANCE_SHARE or more of it. Announced at most
//                   once per DOMINANCE_COOLDOWN_TICKS, and never in the last
//                   few seconds, when nobody cares about possession any more.
//
//   pressure        tension at or above PRESSURE_TENSION for
//                   PRESSURE_HOLD_TICKS with the ball in the attacking third.
//                   This is the line that fills a tense lull.
//
// Nothing here writes to the world; the state object is read and dropped.

const TICK_HZ = 60;

export const RESTART_DELAY_TICKS = 90; // 1.5 s after a goal, "we go again"
export const COUNTER_WINDOW_TICKS = 150;
export const COUNTER_ADVANCE = 0.42; // share of the full pitch length
export const DOMINANCE_WINDOW_TICKS = 1800; // 30 s
export const DOMINANCE_SHARE = 0.68;
export const DOMINANCE_COOLDOWN_TICKS = 2400; // 40 s
export const PRESSURE_TENSION = 0.5;
export const PRESSURE_HOLD_TICKS = 480; // 8 s
export const PRESSURE_COOLDOWN_TICKS = 1200;
export const LATE_SECONDS = 15;

/**
 * @param {{geo:{halfZ:number}, totalSeconds?:number}} options
 */
export function createPresentBus(options = {}) {
  const geo = options.geo;
  const listeners = new Set();
  const ring = []; // rolling possession samples: team index per tick, -1 = none
  let ticks = 0;
  let started = false;
  let lastGoalTick = -Infinity;
  let restartDone = true;
  let counter = null; // { team, startZ, tick }
  let lastDominanceTick = -Infinity;
  let lastPressureTick = -Infinity;
  let pressureHeld = 0;
  let lastScore = [0, 0];

  function emit(out, event) {
    out.push(event);
    for (const fn of listeners) fn(event);
  }

  function goalKind(team, score) {
    const mine = score[team];
    const theirs = score[1 - team];
    if (mine === theirs) return 'equaliser';
    if (mine === theirs + 1 && lastScore[team] <= lastScore[1 - team]) return 'lead';
    if (mine - theirs >= 3) return 'extend';
    return 'normal';
  }

  return {
    /** @returns {() => void} unsubscribe */
    on(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Push an event the core cannot know about (half time, a mode's foul). */
    push(event) {
      const out = [];
      emit(out, event);
      return out;
    },

    /**
     * One tick.
     *
     * @param {object[]} statEvents what createMatchRecorder().feed() returned
     * @param {object} state readState(world), or a guest sample
     * @param {{tension:number, lastTouchTeam:number, possession:number[],
     *          secondsLeft:number, golden?:boolean}} ctx
     * @returns {object[]} presentation events, in emission order
     */
    feed(statEvents, state, ctx = {}) {
      ticks++;
      const out = [];
      const ballZ = state?.ball?.z ?? 0;
      const tension = ctx.tension || 0;
      const holder = ctx.lastTouchTeam ?? -1;
      const late = (ctx.secondsLeft ?? Infinity) <= LATE_SECONDS || !!ctx.golden;

      if (!started) {
        started = true;
        emit(out, { type: 'kickoff', meta: { tick: state?.tick ?? 0 } });
      }

      for (const e of statEvents || []) {
        switch (e.type) {
          case 'goal': {
            const score = e.score || state.score;
            emit(out, {
              type: 'goal',
              meta: {
                team: e.team, player: e.player, assist: e.assist,
                kind: goalKind(e.team, score), late, score,
              },
            });
            lastScore = [score[0], score[1]];
            lastGoalTick = ticks;
            restartDone = false;
            counter = null;
            break;
          }
          case 'own-goal':
            emit(out, { type: 'own-goal', meta: { team: e.team, player: e.player, late } });
            lastScore = [...(e.score || state.score)];
            lastGoalTick = ticks;
            restartDone = false;
            break;
          case 'save':
            emit(out, { type: 'save', meta: { team: e.team, player: e.player, xg: e.xg || 0 } });
            break;
          case 'catch':
            emit(out, { type: 'catch', meta: { team: e.team, player: e.player } });
            break;
          case 'keeper-error':
            emit(out, { type: 'keeper-error', meta: { team: e.team, player: e.player } });
            break;
          case 'woodwork':
            emit(out, { type: 'woodwork', meta: { team: e.team, player: e.player } });
            break;
          case 'near-miss':
            emit(out, { type: 'near-miss', meta: { team: e.team, player: e.player, xg: e.xg || 0 } });
            break;
          case 'tackle':
            emit(out, { type: 'tackle', meta: { team: e.team, player: e.player } });
            break;
          case 'golden-goal':
            emit(out, { type: 'golden-goal', meta: { score: e.score } });
            break;
          case 'match-end': {
            const score = e.score || state.score;
            emit(out, {
              type: 'match-end',
              meta: {
                winner: e.winner, reason: e.reason, score,
                margin: Math.abs((score[0] | 0) - (score[1] | 0)),
              },
            });
            break;
          }
          default:
            break;
        }
      }

      // restart, once, a beat after the goal
      if (!restartDone && ticks - lastGoalTick >= RESTART_DELAY_TICKS) {
        restartDone = true;
        emit(out, { type: 'restart', meta: {} });
      }

      // ---- counter-attack -------------------------------------------------
      if (holder === 0 || holder === 1) {
        const ownHalfDepth = -attackSign(holder) * ballZ; // + when deep at home
        if (!counter && ownHalfDepth > geo.halfZ / 3) {
          counter = { team: holder, startZ: ballZ, tick: ticks };
        } else if (counter && counter.team !== holder) {
          counter = ownHalfDepth > geo.halfZ / 3
            ? { team: holder, startZ: ballZ, tick: ticks }
            : null;
        } else if (counter) {
          const advanced = (ballZ - counter.startZ) * attackSign(counter.team);
          if (advanced >= COUNTER_ADVANCE * geo.halfZ * 2) {
            emit(out, { type: 'counter-attack', meta: { team: counter.team } });
            counter = null;
          } else if (ticks - counter.tick > COUNTER_WINDOW_TICKS) {
            counter = null;
          }
        }
      }

      // ---- dominance ------------------------------------------------------
      ring.push(holder);
      if (ring.length > DOMINANCE_WINDOW_TICKS) ring.shift();
      if (
        ring.length >= DOMINANCE_WINDOW_TICKS &&
        ticks - lastDominanceTick >= DOMINANCE_COOLDOWN_TICKS &&
        (ctx.secondsLeft ?? Infinity) > 20
      ) {
        let red = 0;
        let blue = 0;
        for (const t of ring) { if (t === 0) red++; else if (t === 1) blue++; }
        const total = red + blue;
        if (total > 0) {
          const share = [red / total, blue / total];
          const team = share[0] >= DOMINANCE_SHARE ? 0 : share[1] >= DOMINANCE_SHARE ? 1 : -1;
          if (team >= 0) {
            lastDominanceTick = ticks;
            emit(out, { type: 'dominance', meta: { team, share: share[team] } });
          }
        }
      }

      // ---- sustained pressure ---------------------------------------------
      const attackingThird = holder >= 0 && ballZ * attackSign(holder) > geo.halfZ / 3;
      pressureHeld = tension >= PRESSURE_TENSION && attackingThird ? pressureHeld + 1 : 0;
      if (
        pressureHeld >= PRESSURE_HOLD_TICKS &&
        ticks - lastPressureTick >= PRESSURE_COOLDOWN_TICKS
      ) {
        lastPressureTick = ticks;
        pressureHeld = 0;
        emit(out, { type: 'pressure', meta: { team: holder } });
      }

      return out;
    },

    reset() {
      ring.length = 0;
      ticks = 0;
      started = false;
      counter = null;
      pressureHeld = 0;
      lastScore = [0, 0];
    },
  };
}

const attackSign = (team) => (team === 0 ? 1 : -1);

/**
 * A guest owns no world and therefore sees no core events, so the loud half of
 * the commentary is derived from the authoritative numbers it DOES get. Exactly
 * the trick ArenaMatch._reactToState already uses for the goal flash, extracted
 * so both host and guest speak from one code path.
 *
 * @param {object|null} prev the previous sample
 * @param {object} state the current one
 * @returns {object[]} events shaped like createMatchRecorder().feed() output
 */
export function deriveEvents(prev, state) {
  const out = [];
  if (!state) return out;
  if (!prev) return out;
  const before = prev.score || [0, 0];
  const after = state.score || [0, 0];
  for (const team of [0, 1]) {
    if ((after[team] | 0) > (before[team] | 0)) {
      out.push({ type: 'goal', team, player: -1, assist: -1, score: [after[0], after[1]] });
    }
  }
  const wasOver = prev.match?.over;
  if (state.match?.over && !wasOver) {
    out.push({
      type: 'match-end',
      reason: state.match.reason,
      winner: state.match.winner,
      score: [after[0], after[1]],
    });
  }
  if (state.match?.phase === 'golden-goal' && prev.match?.phase !== 'golden-goal') {
    out.push({ type: 'golden-goal', score: [after[0], after[1]] });
  }
  void TICK_HZ;
  return out;
}
