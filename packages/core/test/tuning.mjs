// Headless tuning harness for the Phase 1.2 gameplay rows.
//
//   node test/tuning.mjs           print every measurement as a table
//   node test/tuning.mjs --json    the same numbers as JSON
//
// Nothing in here is a pass/fail gate — run.mjs imports these functions and
// asserts the acceptance bands. This file exists so the bands can be re-measured
// after any constant moves, and so the grid searches that produced the current
// values are reproducible rather than remembered.
//
// Everything is integer-deterministic: the scripted dribblers and tacklers read
// fixed-point state and emit quantised inputs, exactly like a bot would.

import {
  createWorld,
  step,
  place,
  playerOffset,
  controlAdvice,
  chargePower,
  readState,
  BALL_BASE,
  FIELD,
  CONSTANTS,
  BTN,
  fx,
} from '../src/index.js';

const C = CONSTANTS;
const FX = fx.FX_ONE;
export const REACH = C.PLAYER_RADIUS + C.BALL_RADIUS;
export const TEN_METRES = 10 * C.UNITS_PER_METRE;
// "the ball got away": three contact radii is far enough that no touch and no
// corrective kick can reach it any more
const TURNOVER_GAP = 3 * REACH;

function ballGap(buf, o) {
  return fx.fxHypot(
    buf[BALL_BASE] - buf[o + FIELD.P_X],
    buf[BALL_BASE + 1] - buf[o + FIELD.P_Z],
  );
}

// ------------------------------------------------------- scripted dribbler

/**
 * The CMU-RoboCup close-control loop, written as a policy rather than as a
 * physics hack: the core has no magnet, so control is a decision about when to
 * run and when to let the ball roll.
 *
 *   ball still inside the control radius  -> it is mine, let it run
 *   ball reaching the control radius      -> close it down
 *   ball about to leave, still reachable  -> BTN.TOUCH, the small corrective kick
 *
 * The corrective touch is deliberately NOT the shot charge: the charge floor is
 * 0.3 x KICK_IMPULSE = 1.5, which sends the ball 148 units and turns dribbling
 * into a series of loose passes (measured: mean gap 45, control 19%). The
 * dedicated TOUCH impulse is an order of magnitude smaller.
 */
export function makeDribbler(world, index, opts = {}) {
  const radius = opts.radius == null ? C.CONTROL_RADIUS : opts.radius;
  // ball speed below which a redirect is not worth a touch (it is barely moving)
  const skew = opts.skew == null ? FX / 4 : opts.skew;
  // how far ahead the "spend a touch" decision looks
  const lead = opts.lead == null ? 4 : opts.lead;
  const o = playerOffset(index);
  let sprint = true;

  return function dribble(hx, hz, touchedLastTick) {
    const buf = world.buf;
    const gap = ballGap(buf, o);
    if (touchedLastTick) sprint = false;
    else if (gap >= radius) sprint = true;

    // stand behind the ball relative to where we want to go, not on top of it
    const tx = buf[BALL_BASE] - fx.fxMul(hx, REACH);
    const tz = buf[BALL_BASE + 1] - fx.fxMul(hz, REACH);
    const out = [0, 0];
    let mx = 0;
    let mz = 0;
    if (sprint && fx.fxNormalize(tx - buf[o + FIELD.P_X], tz - buf[o + FIELD.P_Z], out) > 0) {
      mx = out[0];
      mz = out[1];
    }

    // Two ways to lose the ball: it runs out of the control radius, or it keeps
    // rolling the way we no longer want to go. The second is what a turn costs,
    // and it is the case the corrective touch exists for.
    const bvx = buf[BALL_BASE + 2];
    const bvz = buf[BALL_BASE + 3];
    const bs = fx.fxHypot(bvx, bvz);
    const along = bs > skew ? fx.fxAdd(fx.fxMul(bvx, hx), fx.fxMul(bvz, hz)) : 0;
    const inRange = fx.fxSub(gap, REACH) < C.KICK_RANGE;
    // one tick ahead decides whether to run; a few ticks ahead decides whether
    // to spend a touch, because the release has to land while the ball is still
    // reachable
    const soon = controlAdvice(world, index, mx, mz, lead);

    let buttons = 0;
    if (inRange && !soon.keep && (along < 0 || opts.eager)) {
      buttons |= BTN.TOUCH; // the core rate-limits this, the policy need not
    }
    return { moveXFx: mx, moveZFx: mz, buttons };
  };
}

/** Drive one dribble scenario and return its metrics. */
function dribbleRun({ name, heading, ticks = 900, stop = null, opts = {} }) {
  const world = createWorld({ playerCount: 1 });
  place(world, 0, 0, -300);
  place(world, 'ball', 0, -300 + 30);
  const o = playerOffset(0);
  const startX = world.buf[o + FIELD.P_X];
  const startZ = world.buf[o + FIELD.P_Z];
  const dribble = makeDribbler(world, 0, opts);

  let touches = 0;
  let taps = 0;
  let gapSum = 0;
  let samples = 0;
  let maxGap = 0;
  let controlTicks = 0;
  let turnovers = 0;
  let lost = false;
  let travelled = 0;
  let prevX = startX;
  let prevZ = startZ;
  let hit = false;

  for (let t = 0; t < ticks; t++) {
    const [hx, hz] = heading(t, world);
    const inp = dribble(hx, hz, hit);
    hit = false;
    for (const e of step(world, [inp])) {
      if (e.type === 'touch') {
        touches++;
        hit = true;
        if (e.kind === 'control') taps++;
      }
    }
    const buf = world.buf;
    const gap = ballGap(buf, o);
    gapSum += gap;
    samples++;
    if (gap > maxGap) maxGap = gap;
    if (gap <= C.CONTROL_RADIUS) controlTicks++;
    if (gap > TURNOVER_GAP) {
      if (!lost) {
        turnovers++;
        lost = true;
      }
    } else {
      lost = false;
    }
    travelled += fx.fxHypot(buf[o + FIELD.P_X] - prevX, buf[o + FIELD.P_Z] - prevZ);
    prevX = buf[o + FIELD.P_X];
    prevZ = buf[o + FIELD.P_Z];
    if (stop && stop(world, t, travelled)) break;
  }

  return {
    name,
    touches,
    taps,
    ticks: samples,
    meanGap: gapSum / samples / FX,
    maxGap: maxGap / FX,
    controlTicks,
    controlRatio: controlTicks / samples,
    turnovers,
    travelled: travelled / FX,
  };
}

/** Straight 10 m run: the matrix #7 acceptance. */
export function straightRun(opts = {}) {
  return dribbleRun({
    name: 'straight 10 m',
    heading: () => [0, FX],
    opts,
    stop: (w, t, travelled) => travelled >= TEN_METRES,
  });
}

/** Zigzag: the heading swings +/-45 degrees every `period` ticks. */
export function zigzagRun(opts = {}) {
  const period = opts.period == null ? 40 : opts.period;
  const D = 46341; // 1/sqrt(2) in Q16.16
  return dribbleRun({
    name: 'zigzag +/-45',
    heading: (t) => (Math.floor(t / period) % 2 === 0 ? [D, D] : [-D, D]),
    opts,
    ticks: 400,
  });
}

/** 180 degree turn halfway through, the hardest thing for close control. */
export function turnRun(opts = {}) {
  const half = opts.half == null ? 120 : opts.half;
  return dribbleRun({
    name: '180 turn',
    heading: (t) => (t < half ? [0, FX] : [0, -FX]),
    opts,
    ticks: 2 * half,
  });
}

// -------------------------------------------------------- scripted tackler

/**
 * Tackle scenario set. An attacker dribbles up the pitch on a fixed line and a
 * defender, standing `standoff` units away and `lateral` units off the line,
 * commits the slide when the attacker is `trigger` units away.
 *
 * A success is a `tackle` event with won: true — the slide reached the ball.
 * Anything else (a body check, or a slide that hit nothing at all) is a miss.
 * The grid below sweeps the timing and the geometry, which is the whole point:
 * a tackle that always works is a spam button, and one that never works is dead
 * weight. The design asks for 40-55%.
 */
export function tackleTrial({ standoff, lateral, trigger, evade = 0, chase = true }) {
  const world = createWorld({ players: [{ team: 0 }, { team: 1 }] });
  place(world, 0, 0, -200); // attacker, running +z
  place(world, 'ball', 0, -200 + 30);
  place(world, 1, lateral, -200 + standoff); // defender, facing him
  const od = playerOffset(1);
  // an evading attacker is an EAGER dribbler: he spends corrective touches to
  // drag the ball off the line, which is the only thing that actually beats a
  // committed slide (running around it leaves the ball where the slide is going)
  const dribble = makeDribbler(world, 0, { eager: evade !== 0 });
  let hit = false;
  let fired = false;
  let firedAt = -1;
  let result = 'none';

  for (let t = 0; t < 240; t++) {
    // evade: the attacker cuts square across, |evade| ticks after the commit.
    // 0 means he runs straight into it, which is what makes the easy trials easy.
    let hx = 0;
    let hz = FX;
    if (evade !== 0 && firedAt >= 0 && t >= firedAt + Math.abs(evade) - 1) {
      hx = evade > 0 ? FX : -FX;
      hz = 0;
    }
    const attacker = dribble(hx, hz, hit);
    hit = false;

    // defender: close the gap, then commit
    const dx = world.buf[BALL_BASE] - world.buf[od + FIELD.P_X];
    const dz = world.buf[BALL_BASE + 1] - world.buf[od + FIELD.P_Z];
    const dist = fx.fxHypot(dx, dz);
    const out = [0, 0];
    fx.fxNormalize(dx, dz, out);
    let buttons = 0;
    if (!fired && dist <= trigger) {
      buttons |= BTN.TACKLE;
      fired = true;
      firedAt = t;
    }
    const defender = {
      moveXFx: chase ? out[0] : 0,
      moveZFx: chase ? out[1] : 0,
      buttons,
    };

    for (const e of step(world, [attacker, defender])) {
      if (e.type === 'touch') hit = true;
      if (e.type === 'tackle' && e.player === 1) {
        result = e.won ? 'won' : 'body';
      }
    }
    if (fired && result !== 'none') break;
    if (fired && readState(world).players[1].tackleActive === 0 && result === 'none') {
      result = 'air';
      break;
    }
  }
  return result;
}

/**
 * The whole grid, so the success rate is a measured number and not a guess.
 *
 * The three axes are the three things a defender actually gets wrong: where he
 * started (standoff, lateral), when he committed (trigger), and whether the man
 * in front of him saw it coming (evade). Sweeping them uniformly is what makes
 * 40-55% mean "spam is punished, anticipation is rewarded" instead of "the
 * numbers happened to come out nice".
 */
export function tackleGrid() {
  const rows = [];
  for (const standoff of [80, 120, 160]) {
    for (const lateral of [-40, -20, 0, 20, 40].map((v) => v * FX)) {
      for (const trigger of [30, 60, 90, 120, 150].map((v) => v * FX)) {
        for (const evade of [0, 1, 5, -1, -5]) {
          rows.push({
            standoff: standoff * FX,
            lateral,
            trigger,
            evade,
            result: tackleTrial({ standoff: standoff * FX, lateral, trigger, evade }),
          });
        }
      }
    }
  }
  const won = rows.filter((r) => r.result === 'won').length;
  return { trials: rows.length, won, rate: won / rows.length, rows };
}

// ---------------------------------------------------------- charge curve

/** Power multiplier at a set of hold times, as plain numbers. */
export function chargeCurve(
  ticks = [0, 3, 6, 12, 18, 24, 30, 36, 42, 48, 60],
) {
  return ticks.map((t) => ({
    ticks: t,
    ms: Math.round((t * 1000) / 60),
    power: chargePower(t) / FX,
  }));
}

// ------------------------------------------------------------------ report

function pct(v) {
  return `${(v * 100).toFixed(1)}%`;
}

export function measureAll() {
  return {
    dribble: {
      straight: straightRun(),
      zigzag: zigzagRun(),
      turn: turnRun(),
      tenMetres: TEN_METRES / FX,
      controlRadius: C.CONTROL_RADIUS / FX,
      idealGap: REACH / FX,
    },
    charge: chargeCurve(),
    tackle: (() => {
      const g = tackleGrid();
      return { trials: g.trials, won: g.won, rate: g.rate };
    })(),
  };
}

const isMain =
  process.argv[1] && process.argv[1].endsWith('tuning.mjs');
if (isMain) {
  const m = measureAll();
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(m, null, 2));
    process.exit(0);
  }
  console.log('--- dribbling (row #7)');
  console.log(
    `10 m = ${m.dribble.tenMetres.toFixed(2)} units · control radius ${m.dribble.controlRadius} · ideal gap ${m.dribble.idealGap}`,
  );
  for (const k of ['straight', 'zigzag', 'turn']) {
    const r = m.dribble[k];
    console.log(
      `${r.name.padEnd(14)} touches ${String(r.touches).padStart(3)} (taps ${r.taps})  ` +
        `mean gap ${r.meanGap.toFixed(2)}  max ${r.maxGap.toFixed(1)}  ` +
        `control ${pct(r.controlRatio)}  turnovers ${r.turnovers}  ` +
        `travelled ${r.travelled.toFixed(1)}`,
    );
  }
  console.log('\n--- shot charge (row #8)');
  for (const p of m.charge) {
    console.log(
      `hold ${String(p.ticks).padStart(2)} ticks (${String(p.ms).padStart(4)} ms) -> ${p.power.toFixed(4)}x`,
    );
  }
  console.log('\n--- slide tackle (row #10)');
  console.log(
    `${m.tackle.won}/${m.tackle.trials} clean wins = ${pct(m.tackle.rate)} (target band 40-55%)`,
  );
}
