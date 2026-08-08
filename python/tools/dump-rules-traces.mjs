// Emit python/fixtures/rules-traces.json: checksum chains for the match-rule
// and pitch-preset code paths that the Phase 1.2 trace never reaches.
//
//   node python/tools/dump-rules-traces.mjs > python/fixtures/rules-traces.json
//
// packages/core/test/run.mjs --dump-trace covers one scenario: the medium
// pitch, no clock, no score limit, keepers on, and it happens to score once.
// The Python port also has to mirror golden goal, the mercy rule, the score
// limit, full time, the frozen world after a match ends, keepers switched off
// and the small/large presets. Those branches are driven here.
//
// The file records, per scenario: the world config, the per-tick input codes
// that were actually fed to step(), the RAW ball writes used to force a goal
// (raw ints, so the replay never crosses the float boundary) and the full
// per-tick checksum chain. The Python side replays the codes and the raw
// writes; it never has to reimplement the steering policy below.

import {
  createWorld,
  step,
  checksum,
  readState,
  playerOffset,
  BALL_BASE,
  FIELD,
  CONSTANTS,
  constantsHash,
  fnv1aString,
  toHex32,
  fx,
  HDR_BALL_HOLDER,
  HDR_BALL_HOLD_TICKS,
  HDR_GRIEF_TEAM,
  HDR_GRIEF_TICKS,
  HDR_MATCH_STATE,
  MATCH_FINISHED,
  BTN,
  pitchOf,
} from '../../packages/core/src/index.js';

const CARD = 65536;
const DIAG = 46341; // round(sqrt(0.5) * 65536), the same value quantiseAxis gives
const DIRS = [
  [0, 0],
  [CARD, 0],
  [-CARD, 0],
  [0, CARD],
  [0, -CARD],
  [DIAG, DIAG],
  [DIAG, -DIAG],
  [-DIAG, DIAG],
  [-DIAG, -DIAG],
];

function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= (s << 13) >>> 0;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= (s << 5) >>> 0;
    s >>>= 0;
    return s;
  };
}

const REACH = CONSTANTS.PLAYER_RADIUS + CONSTANTS.BALL_RADIUS;

function dirTowardBall(buf, p) {
  const o = playerOffset(p);
  const dx = buf[BALL_BASE] - buf[o + FIELD.P_X];
  const dz = buf[BALL_BASE + 1] - buf[o + FIELD.P_Z];
  const adx = dx < 0 ? -dx : dx;
  const adz = dz < 0 ? -dz : dz;
  if (adx === 0 && adz === 0) return 0;
  if (adx > 2 * adz) return dx > 0 ? 1 : 2;
  if (adz > 2 * adx) return dz > 0 ? 3 : 4;
  return dx > 0 ? (dz > 0 ? 5 : 6) : dz > 0 ? 7 : 8;
}

function wantsButtons(buf, p, t, keepers) {
  const o = playerOffset(p);
  const dx = buf[BALL_BASE] - buf[o + FIELD.P_X];
  const dz = buf[BALL_BASE + 1] - buf[o + FIELD.P_Z];
  const gap = fx.fxHypot(dx, dz) - REACH;
  const near = gap < CONSTANTS.KICK_RANGE * 3;
  const reachable = gap < CONSTANTS.KICK_RANGE;
  let b = 0;
  if (near && t % 9 <= 1) b |= BTN.KICK;
  if (near && (t + p * 3) % 7 <= 1) b |= BTN.TOUCH;
  if (!reachable && (t + p * 23) % 50 < 20) b |= BTN.CHARGE;
  if ((t + p * 31) % 271 === 0) b |= BTN.CANCEL;
  if ((t + p * 5) % 149 === 0) b |= BTN.TACKLE;
  if (keepers && p < 2) {
    b |= BTN.CATCH;
    if ((t + p * 11) % 61 === 0) b |= BTN.DIVE;
    if ((t + p * 17) % 97 < 15) b |= BTN.CLEAR;
    if ((t + p * 29) % 211 === 0) b |= BTN.THROW;
  }
  return b;
}

function wanderScript(scn) {
  const rng = makeRng(scn.seed);
  const script = [];
  const dir = new Array(scn.playerCount).fill(-1);
  const hold = new Array(scn.playerCount).fill(0);
  for (let t = 0; t < scn.ticks; t++) {
    const frame = [];
    for (let p = 0; p < scn.playerCount; p++) {
      if (hold[p] <= 0) {
        dir[p] = rng() % 4 === 0 ? rng() % DIRS.length : -1;
        hold[p] = 5 + (rng() % 25);
      }
      hold[p]--;
      frame.push(dir[p]);
    }
    script.push(frame);
  }
  return script;
}

/**
 * Put the ball over `team`'s target line, clear of every player and both posts,
 * and record the raw ints written so the Python replay can repeat the write
 * without going anywhere near fxFromNumber.
 */
function forceGoal(world, team) {
  const buf = world.buf;
  buf[HDR_BALL_HOLDER] = -1;
  buf[HDR_BALL_HOLD_TICKS] = 0;
  buf[HDR_GRIEF_TEAM] = -1;
  buf[HDR_GRIEF_TICKS] = 0;
  const P = pitchOf(world);
  const beyond = P.halfZ + 20 * fx.FX_ONE;
  buf[BALL_BASE] = 0;
  buf[BALL_BASE + 1] = team === 0 ? beyond : -beyond;
  buf[BALL_BASE + 2] = 0;
  buf[BALL_BASE + 3] = 0;
  return {
    ballHolder: -1,
    ballHoldTicks: 0,
    griefTeam: -1,
    griefTicks: 0,
    ball: [buf[BALL_BASE], buf[BALL_BASE + 1], 0, 0],
  };
}

const SCENARIOS = [
  {
    name: 'golden-goal-kucuk',
    seed: 0x5eed1234,
    ticks: 1200,
    playerCount: 4,
    roles: [1, 1, 0, 0],
    settings: {
      durationSeconds: 10,
      scoreLimit: 0,
      pitch: 'kucuk',
      goldenGoal: true,
      mercyRule: true,
      keepers: true,
    },
    forced: [[100, 0], [220, 1], [340, 0], [460, 1], [700, 0]],
  },
  {
    name: 'mercy-buyuk-nokeepers',
    seed: 0x0dd1e,
    ticks: 900,
    playerCount: 4,
    roles: [0, 0, 0, 0],
    settings: {
      durationSeconds: 0,
      scoreLimit: 0,
      pitch: 'buyuk',
      goldenGoal: false,
      mercyRule: true,
      keepers: false,
    },
    forced: [[80, 0], [160, 0], [240, 0], [320, 0]],
  },
  {
    name: 'score-limit-orta',
    seed: 0x11223344,
    ticks: 700,
    playerCount: 6,
    roles: [1, 1, 0, 0, 0, 0],
    settings: {
      durationSeconds: 0,
      scoreLimit: 3,
      pitch: 'orta',
      goldenGoal: false,
      mercyRule: false,
      keepers: true,
    },
    forced: [[60, 1], [140, 1], [400, 1]],
  },
  {
    name: 'full-time-kucuk-1v1',
    seed: 0x7ac71e,
    ticks: 500,
    playerCount: 2,
    roles: [0, 0],
    settings: {
      durationSeconds: 5, // 300 ticks: the world freezes for the last 200
      scoreLimit: 0,
      pitch: 'kucuk',
      goldenGoal: false,
      mercyRule: false,
      keepers: false,
    },
    forced: [[50, 0]],
  },
];

function runScenario(scn) {
  const wander = wanderScript(scn);
  const world = createWorld({
    playerCount: scn.playerCount,
    roles: scn.roles,
    settings: scn.settings,
  });
  const chain = [checksum(world)];
  const codes = [];
  const writes = [];
  const tally = { goal: 0, 'golden-goal': 0, 'match-end': 0, kick: 0, touch: 0, tackle: 0 };
  const keepers = scn.settings.keepers !== false;
  let end = null;
  for (let t = 0; t < scn.ticks; t++) {
    if (world.buf[HDR_MATCH_STATE] !== MATCH_FINISHED) {
      for (const [at, team] of scn.forced) {
        if (at === t) writes.push({ tick: t, ...forceGoal(world, team) });
      }
    }
    const frame = [];
    const inputs = [];
    for (let p = 0; p < scn.playerCount; p++) {
      const d = wander[t][p] >= 0 ? wander[t][p] : dirTowardBall(world.buf, p);
      const code = d | (wantsButtons(world.buf, p, t, keepers) << 4);
      frame.push(code);
      inputs.push({ moveXFx: DIRS[code & 15][0], moveZFx: DIRS[code & 15][1], buttons: code >>> 4 });
    }
    codes.push(frame);
    for (const e of step(world, inputs)) {
      if (tally[e.type] != null) tally[e.type]++;
      if (e.type === 'match-end') end = e;
    }
    chain.push(checksum(world));
  }
  return {
    name: scn.name,
    scenario: scn,
    codes,
    writes,
    tally,
    end,
    chain,
    chainDigest: toHex32(fnv1aString(chain.join(''))),
    final: readState(world),
    finalState: Array.from(world.buf),
  };
}

process.stdout.write(
  `${JSON.stringify({
    generatedBy: 'python/tools/dump-rules-traces.mjs',
    constantsHash,
    dirs: DIRS,
    scenarios: SCENARIOS.map(runScenario),
  })}\n`,
);
