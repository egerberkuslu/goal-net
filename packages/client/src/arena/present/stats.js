// Match statistics and MVP (feature matrix #41).
//
// Everything is derived from the core's own event stream plus one sample of
// readState() per tick. The recorder never writes to the world, never steps it
// and never guesses: given the same (events, state) sequence it produces the
// same table, which is what "deterministic from the recorded match data" means
// — a replay reproduces the stats screen exactly, MVP included.
//
// The shipping game's src/game/stats.js is the reference for what a row means
// (shot, on target, save, possession, foul). This is the arena's version of the
// same idea against a 2D integer core: no y axis, no fouls in the ruleset, and
// an event stream instead of a per-frame physics peek.
//
// ---------------------------------------------------------------- the rows
//
//   Şut            a kick or a charged shot that leaves the boot with goalward
//                  pace (>= SHOT_SPEED_MS) from inside the pitch
//   İsabetli şut   that shot reaches the goal line inside the mouth, is saved,
//                  is caught, or goes in
//   Gol            core `goal` events, credited to the last touch
//   Kurtarış       `keeper-save`, plus a `keeper-catch` that stopped a live shot
//   Top kazanma    `tackle` with won = true
//   Pas            a touch by a team-mate following a touch by this player,
//                  with no opponent touch in between
//   Direk          derived: the ball reverses across a post inside the post's
//                  own radius (the core has no woodwork event)
//   Topa sahip     ticks in which the last touch belonged to this side
//   Faul           the arena ruleset has no fouls; the counter exists so the
//                  same screen can show them when a mode does
//
// ----------------------------------------------------------------- the MVP
//
// A weighted sum, printed on the screen next to the name so nobody has to take
// it on faith:
//
//   MVP = 3.0 * goals
//       + 2.0 * assists
//       + 2.0 * saves
//       + 1.5 * xG          (the quality of the chances he actually created)
//       + 1.0 * tacklesWon
//       + 0.5 * shotsOnTarget
//       + 0.15 * passes
//       - 0.75 * fouls
//       - 2.0 * ownGoals
//
// Justification, weight by weight:
//   goals 3      the only act that changes the scoreboard, so it must dominate
//                any amount of tidy midfield work
//   assists 2    the pass that made the goal is worth two thirds of the goal;
//                the standard football-media split, and it stops a striker
//                from being the MVP of a game his team-mate created
//   saves 2      a save is a goal prevented; symmetrical with a goal scored,
//                minus a third because a keeper faces more chances than a
//                striker gets
//   xG 1.5       rewards getting into good positions even when the finish went
//                wide, and is what stops "one lucky 30-metre goal" from beating
//                a striker who made five real chances. It is scaled small
//                enough that xG can never outrank an actual goal (a goal is
//                worth 3 plus its own xG, which is at most 1.5 more).
//   tackles 1    one clean tackle is worth a third of a goal
//   on target .5 an attempt that made the keeper work
//   passes .15   volume work, deliberately near-zero per pass: a hundred passes
//                is worth one and a half goals, which is about right
//   fouls -.75   cheap enough not to erase a good game, real enough to notice
//   own goals -2 an own goal is worse for the team than a goal is good for it
//
// Ties break deterministically: higher MVP score, then more goals, then higher
// xG, then the lower player index. Never by iteration order.

import { TICK_HZ, toMetres } from '../units.js';
import { xgOf, round4 } from './xg.js';

/** Goalward pace, in m/s, a kick needs before it counts as a shot. */
export const SHOT_SPEED_MS = 6;

/** How long a shot stays live for the on-target / woodwork tests, in ticks. */
export const SHOT_LIFE_TICKS = 150; // 2.5 s

/** One keeper contact is one save, not twenty. */
export const SAVE_COOLDOWN_TICKS = 30;

/** MVP weights. Exported so the screen can print the formula it used. */
export const MVP_WEIGHTS = Object.freeze({
  goals: 3,
  assists: 2,
  saves: 2,
  xg: 1.5,
  tacklesWon: 1,
  onTarget: 0.5,
  passes: 0.15,
  fouls: -0.75,
  ownGoals: -2,
});

/** A team-mate touch this many ticks after a kick still counts as that pass. */
export const PASS_WINDOW_TICKS = 180;

/** An assist is the previous team-mate touch inside this window before a goal. */
export const ASSIST_WINDOW_TICKS = 300;

function blankPlayer(slot, index) {
  return {
    index,
    team: slot?.team ?? 0,
    role: slot?.role ?? 'field',
    name: slot?.name || (slot?.kind === 'bot' ? `Bot ${index + 1}` : `Oyuncu ${index + 1}`),
    kind: slot?.kind || 'human',
    goals: 0,
    ownGoals: 0,
    assists: 0,
    shots: 0,
    onTarget: 0,
    saves: 0,
    catches: 0,
    tackles: 0,
    tacklesWon: 0,
    passes: 0,
    touches: 0,
    woodwork: 0,
    fouls: 0,
    xg: 0,
  };
}

/**
 * @param {{slots:object[], geo:{goalHalfX:number, halfZ:number, playerR:number,
 *          postR:number, ballR:number}}} options
 */
export function createMatchRecorder(options = {}) {
  const slots = options.slots || [];
  const geo = options.geo;
  const players = slots.map((s, i) => blankPlayer(s, i));
  const teams = [blankTeam(), blankTeam()];
  const possessionTicks = [0, 0];

  let lastTouch = -1; // player index
  let lastTouchTick = -1;
  let prevTouch = -1; // the touch before lastTouch
  let prevTouchTick = -1;
  let pending = null; // the shot in flight
  let saveCool = 0;
  let ticks = 0;
  let lastBall = null;
  const timeline = []; // every scoring act, for the screen and for a replay

  /** Which way team `t` attacks: team 0 -> +z, team 1 -> -z. */
  const attackSign = (t) => (t === 0 ? 1 : -1);

  function teamOf(index) {
    return players[index]?.team ?? 0;
  }

  function metres(state) {
    return {
      x: toMetres(state.ball.x),
      z: toMetres(state.ball.z),
      vx: toMetres(state.ball.vx || 0) * TICK_HZ,
      vz: toMetres(state.ball.vz || 0) * TICK_HZ,
    };
  }

  function playersInMetres(state) {
    return state.players.map((p, i) => ({
      index: i,
      team: players[i]?.team ?? p.team,
      keeper: (players[i]?.role ?? p.role) === 'keeper' || p.role === 1,
      x: toMetres(p.x),
      z: toMetres(p.z),
    }));
  }

  function openShot(shooter, state, power) {
    const ball = metres(state);
    const sign = attackSign(teamOf(shooter));
    const bodies = playersInMetres(state);
    const defending = bodies.filter((b) => b.team !== teamOf(shooter));
    const keeper = defending.find((b) => b.keeper) || null;
    const chance = xgOf(
      {
        x: ball.x, z: ball.z, sign, power,
        keeper: keeper ? { x: keeper.x, z: keeper.z } : null,
        opponents: defending,
      },
      geo,
    );
    players[shooter].shots++;
    teams[teamOf(shooter)].shots++;
    players[shooter].xg = round4(players[shooter].xg + chance.xg);
    teams[teamOf(shooter)].xg = round4(teams[teamOf(shooter)].xg + chance.xg);
    pending = {
      shooter, sign, tick: ticks, onTarget: false,
      xg: chance.xg, features: chance,
    };
    timeline.push({ tick: ticks, type: 'shot', player: shooter, xg: chance.xg });
    return pending;
  }

  function markOnTarget(shooter) {
    if (!pending || pending.shooter !== shooter || pending.onTarget) return false;
    pending.onTarget = true;
    players[shooter].onTarget++;
    teams[teamOf(shooter)].onTarget++;
    return true;
  }

  function creditGoal(scoringTeam) {
    // The scorer is whoever touched it last. If that was a defender, it is an
    // own goal and the scoring team gets the goal with nobody's name on it.
    const toucher = lastTouch;
    const scorerTeam = toucher >= 0 ? teamOf(toucher) : scoringTeam;
    const own = toucher >= 0 && scorerTeam !== scoringTeam;
    teams[scoringTeam].goals++;
    let assist = -1;
    if (own) {
      players[toucher].ownGoals++;
      timeline.push({ tick: ticks, type: 'own-goal', player: toucher, team: scoringTeam });
    } else if (toucher >= 0) {
      players[toucher].goals++;
      if (!markOnTarget(toucher)) {
        // a scramble with no shot on the books: a goal is always an attempt
        players[toucher].shots++;
        teams[scoringTeam].shots++;
        players[toucher].onTarget++;
        teams[scoringTeam].onTarget++;
      }
      if (
        prevTouch >= 0 && prevTouch !== toucher &&
        teamOf(prevTouch) === scorerTeam &&
        ticks - prevTouchTick <= ASSIST_WINDOW_TICKS
      ) {
        assist = prevTouch;
        players[assist].assists++;
      }
      timeline.push({ tick: ticks, type: 'goal', player: toucher, assist, team: scoringTeam });
    } else {
      timeline.push({ tick: ticks, type: 'goal', player: -1, assist: -1, team: scoringTeam });
    }
    pending = null;
    return { scorer: own ? -1 : toucher, assist, ownGoalBy: own ? toucher : -1 };
  }

  function onTouch(index) {
    if (!(index >= 0 && index < players.length)) return;
    players[index].touches++;
    if (lastTouch >= 0 && lastTouch !== index) {
      // a pass is a team-mate receiving inside the window
      if (teamOf(lastTouch) === teamOf(index) && ticks - lastTouchTick <= PASS_WINDOW_TICKS) {
        players[lastTouch].passes++;
        teams[teamOf(lastTouch)].passes++;
      }
      prevTouch = lastTouch;
      prevTouchTick = lastTouchTick;
    }
    lastTouch = index;
    lastTouchTick = ticks;
  }

  /** Woodwork: the ball reversed across a post while inside the post's reach. */
  function detectWoodwork(ball) {
    if (!lastBall) return null;
    const flipped = Math.sign(ball.vz) !== 0 && Math.sign(lastBall.vz) !== 0 &&
      Math.sign(ball.vz) !== Math.sign(lastBall.vz);
    const flippedX = Math.sign(ball.vx) !== 0 && Math.sign(lastBall.vx) !== 0 &&
      Math.sign(ball.vx) !== Math.sign(lastBall.vx);
    if (!flipped && !flippedX) return null;
    const reach = (geo.postR || 0) + (geo.ballR || 0) + 0.05;
    for (const sz of [-1, 1]) {
      for (const sx of [-1, 1]) {
        const d = Math.hypot(ball.x - sx * geo.goalHalfX, ball.z - sz * geo.halfZ);
        if (d <= reach) return { x: sx * geo.goalHalfX, z: sz * geo.halfZ };
      }
    }
    return null;
  }

  return {
    players,
    teams,
    timeline,
    get ticks() { return ticks; },
    get lastTouch() { return lastTouch; },
    get pendingShot() { return pending; },

    /**
     * One tick of match data.
     *
     * @param {object[]} events the array step() returned this tick
     * @param {object} state readState(world) AFTER that step
     * @returns {object[]} statistical facts the presentation bus can react to:
     *   {type:'shot'|'goal'|'own-goal'|'save'|'catch'|'woodwork'|'tackle'|
     *          'near-miss'|'keeper-error', ...}
     */
    feed(events, state) {
      ticks++;
      const ball = metres(state);
      const out = [];

      if (saveCool > 0) saveCool--;

      for (const e of events || []) {
        switch (e.type) {
          case 'touch':
            onTouch(e.player);
            break;
          case 'shot': {
            onTouch(e.player);
            const power = Number.isFinite(e.power) ? e.power / 65536 : 1;
            const sign = attackSign(teamOf(e.player));
            if (ball.vz * sign >= SHOT_SPEED_MS && Math.abs(ball.z) <= geo.halfZ) {
              const shot = openShot(e.player, state, power);
              out.push({ type: 'shot', player: e.player, team: teamOf(e.player), xg: shot.xg });
            }
            break;
          }
          case 'kick': {
            onTouch(e.player);
            const sign = attackSign(teamOf(e.player));
            if (ball.vz * sign >= SHOT_SPEED_MS && Math.abs(ball.z) <= geo.halfZ) {
              const shot = openShot(e.player, state, 1);
              out.push({ type: 'shot', player: e.player, team: teamOf(e.player), xg: shot.xg });
            }
            break;
          }
          case 'tackle': {
            players[e.player].tackles++;
            if (e.won) {
              players[e.player].tacklesWon++;
              teams[teamOf(e.player)].tacklesWon++;
              out.push({ type: 'tackle', player: e.player, team: teamOf(e.player), won: true });
            }
            break;
          }
          case 'keeper-save': {
            if (saveCool === 0) {
              players[e.player].saves++;
              teams[teamOf(e.player)].saves++;
              saveCool = SAVE_COOLDOWN_TICKS;
              const xg = pending ? pending.xg : 0;
              if (pending) markOnTarget(pending.shooter);
              out.push({ type: 'save', player: e.player, team: teamOf(e.player), xg });
              timeline.push({ tick: ticks, type: 'save', player: e.player, xg });
              pending = null;
            }
            break;
          }
          case 'keeper-catch': {
            players[e.player].catches++;
            teams[teamOf(e.player)].catches++;
            const live = pending && teamOf(pending.shooter) !== teamOf(e.player);
            if (live) {
              players[e.player].saves++;
              teams[teamOf(e.player)].saves++;
              markOnTarget(pending.shooter);
              out.push({ type: 'save', player: e.player, team: teamOf(e.player), xg: pending.xg });
              pending = null;
            } else {
              out.push({ type: 'catch', player: e.player, team: teamOf(e.player) });
            }
            break;
          }
          case 'keeper-whiff':
            out.push({ type: 'keeper-error', player: e.player, team: teamOf(e.player) });
            break;
          case 'goal': {
            const credit = creditGoal(e.team);
            out.push({
              type: credit.ownGoalBy >= 0 ? 'own-goal' : 'goal',
              team: e.team,
              player: credit.ownGoalBy >= 0 ? credit.ownGoalBy : credit.scorer,
              assist: credit.assist,
              score: [state.score[0], state.score[1]],
            });
            break;
          }
          case 'golden-goal':
            out.push({ type: 'golden-goal', score: e.score });
            break;
          case 'match-end':
            out.push({ type: 'match-end', reason: e.reason, winner: e.winner, score: e.score });
            break;
          default:
            break;
        }
      }

      // possession: the side that touched it last owns this tick
      if (lastTouch >= 0) possessionTicks[teamOf(lastTouch)]++;

      // woodwork, from geometry (the core has no such event)
      const post = detectWoodwork(ball);
      if (post) {
        const team = lastTouch >= 0 ? teamOf(lastTouch) : -1;
        if (team >= 0) players[lastTouch].woodwork++;
        out.push({ type: 'woodwork', team, player: lastTouch, x: post.x, z: post.z });
        if (pending) markOnTarget(pending.shooter);
        timeline.push({ tick: ticks, type: 'woodwork', player: lastTouch });
      }

      // a live shot reaching the goal line: on target, or just wide
      if (pending) {
        const sign = pending.sign;
        const reached = (sign * geo.halfZ - ball.z) * sign <= 0.35;
        if (reached && ball.vz * sign > 0) {
          if (Math.abs(ball.x) <= geo.goalHalfX) {
            markOnTarget(pending.shooter);
          } else if (Math.abs(ball.x) <= geo.goalHalfX + 1.4) {
            out.push({
              type: 'near-miss', player: pending.shooter,
              team: teamOf(pending.shooter), xg: pending.xg,
            });
            pending = null;
          }
        }
        if (pending && ticks - pending.tick > SHOT_LIFE_TICKS) pending = null;
      }

      lastBall = ball;
      return out;
    },

    /** Possession as a share per team, summing to 1. [0.5, 0.5] before a touch. */
    possessionShare() {
      const total = possessionTicks[0] + possessionTicks[1];
      if (total <= 0) return [0.5, 0.5];
      const a = possessionTicks[0] / total;
      return [round4(a), round4(1 - a)];
    },

    /** Whole percentages that always add to 100, for the screen. */
    possessionPct() {
      const [a] = this.possessionShare();
      const red = Math.round(a * 100);
      return [red, 100 - red];
    },

    /** Report a foul from a mode that has them. The arena core does not. */
    foul(playerIndex) {
      if (players[playerIndex]) {
        players[playerIndex].fouls++;
        teams[players[playerIndex].team].fouls++;
      }
    },

    /** The MVP weighted sum for one player row. */
    mvpScore(p) {
      const W = MVP_WEIGHTS;
      return round4(
        W.goals * p.goals +
        W.assists * p.assists +
        W.saves * p.saves +
        W.xg * p.xg +
        W.tacklesWon * p.tacklesWon +
        W.onTarget * p.onTarget +
        W.passes * p.passes +
        W.fouls * p.fouls +
        W.ownGoals * p.ownGoals,
      );
    },

    /**
     * Every player with a score, best first. Deterministic tie-break:
     * score, goals, xG, then the lower index.
     */
    ranking() {
      return players
        .map((p) => ({ ...p, mvp: this.mvpScore(p) }))
        .sort((a, b) =>
          (b.mvp - a.mvp) ||
          (b.goals - a.goals) ||
          (b.xg - a.xg) ||
          (a.index - b.index));
    },

    /** The single MVP, or null in a match where nobody did anything. */
    mvp() {
      const best = this.ranking()[0];
      return best && best.mvp > 0 ? best : null;
    },

    /** Everything the end screen draws. Plain data, safe to serialise. */
    summary() {
      const pct = this.possessionPct();
      return {
        ticks,
        seconds: round4(ticks / TICK_HZ),
        possessionPct: pct,
        possessionShare: this.possessionShare(),
        teams: teams.map((t, i) => ({ ...t, possessionPct: pct[i] })),
        players: this.ranking(),
        mvp: this.mvp(),
        weights: MVP_WEIGHTS,
        timeline: timeline.slice(),
      };
    },
  };
}

function blankTeam() {
  return {
    goals: 0, shots: 0, onTarget: 0, saves: 0, catches: 0,
    tacklesWon: 0, passes: 0, fouls: 0, xg: 0,
  };
}
