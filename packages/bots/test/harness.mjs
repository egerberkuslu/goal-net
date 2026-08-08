// A headless pitch that any BotPolicy can be dropped onto.
//
// The same harness runs the scripted policy and the ONNX policy, which is how
// "interchangeable" stops being a claim and becomes a measurement: if one of
// them needed a different call, a different argument or a different frame, it
// would not fit through here.

import { createWorld, step, place, checksum } from '../../core/src/index.js';

import {
  assertAction,
  createBotRunner,
  createScene,
  createScriptedPolicy,
  PITCH,
  readScene,
  toCoreInput,
} from '../src/index.js';

const CONTACT = PITCH.PLAYER_RADIUS + PITCH.BALL_RADIUS;
/** A touch counts when the surfaces come within this much of each other. */
const CONTACT_SLACK = 1.5;

/**
 * playMatch({ policies, roles, teams, ticks, seed, scenario }) -> stats
 *
 *   policies  index -> BotPolicy. Slots without one send no input at all.
 *   roles     index -> 'field' | 'keeper'
 *   scenario  optional (world) => void, run after createWorld to set a position
 */
export function playMatch(options = {}) {
  const {
    policies = {},
    roles = {},
    teams = [0, 1],
    ticks = 1800,
    seed = 1,
    scenario = null,
  } = options;

  const world = createWorld({ teams });
  if (scenario) scenario(world);

  const runners = new Map();
  for (const key of Object.keys(policies)) {
    const i = key | 0;
    runners.set(
      i,
      createBotRunner({
        policy: policies[key],
        playerIndex: i,
        role: roles[i] || 'field',
        seed,
      }),
    );
  }

  const n = teams.length;
  const scene = createScene(n);
  const inputs = new Array(n).fill(null);
  const touching = new Array(n).fill(false);
  const stats = {
    ticks,
    goals: [0, 0],
    goalTicks: [],
    contacts: 0,
    contactsBy: new Array(n).fill(0),
    kicks: 0,
    kicksBy: new Array(n).fill(0),
    checksum: null,
    maxBallSpeed: 0,
    firstContactTick: -1,
  };

  for (let t = 0; t < ticks; t++) {
    for (let i = 0; i < n; i++) {
      const r = runners.get(i);
      inputs[i] = r ? toCoreInput(assertAction(r.step(world), `slot ${i}`)) : null;
    }
    for (const e of step(world, inputs)) {
      if (e.type === 'goal') {
        stats.goals[e.team]++;
        stats.goalTicks.push(e.tick);
      } else if (e.type === 'kick') {
        stats.kicks++;
        stats.kicksBy[e.player]++;
      }
    }

    // Rising-edge touch detection, read through the same layout module the
    // bots use so this cannot drift from what they see.
    readScene(world, scene);
    const bs = Math.sqrt(scene.ball.vx * scene.ball.vx + scene.ball.vz * scene.ball.vz);
    if (bs > stats.maxBallSpeed) stats.maxBallSpeed = bs;
    for (let i = 0; i < n; i++) {
      const p = scene.players[i];
      const dx = p.x - scene.ball.x;
      const dz = p.z - scene.ball.z;
      const near = Math.sqrt(dx * dx + dz * dz) <= CONTACT + CONTACT_SLACK;
      if (near && !touching[i]) {
        stats.contacts++;
        stats.contactsBy[i]++;
        if (stats.firstContactTick < 0) stats.firstContactTick = t;
      }
      touching[i] = near;
    }
  }

  stats.checksum = checksum(world);
  stats.world = world;
  return stats;
}

/**
 * Drive one policy through a fixed observation script and collect the actions.
 * No physics involved, so a difference between two runs can only come from the
 * policy itself.
 */
export function runObservationScript(policy, script, opts = {}) {
  const { seed = 1, attackSign = 1, role = 'field', playerIndex = 0, team = 0 } = opts;
  policy.reset(seed);
  const out = [];
  for (let t = 0; t < script.length; t++) {
    const ctx = { tick: t, playerIndex, team, attackSign, role, playerCount: 2 };
    const a = policy.act(script[t], ctx);
    assertAction(a, `${policy.id} tick ${t}`);
    out.push({ moveX: a.moveX, moveZ: a.moveZ, kick: !!a.kick });
  }
  return out;
}

/**
 * A reproducible sequence of real observations: a short 1v1 between two `orta`
 * bots, recording what slot `playerIndex` saw on every tick.
 *
 * Generated rather than stored so the ONNX fixture stays honest — if the
 * observation spec changes, the script changes with it and the fixture fails,
 * which is exactly the alarm that should ring.
 */
export function buildObservationScript(opts = {}) {
  const { ticks = 120, seed = 7, playerIndex = 0 } = opts;
  const world = createWorld({ teams: [0, 1] });
  const runners = [0, 1].map((i) =>
    createBotRunner({
      policy: createScriptedPolicy({ difficulty: 'orta', seed: seed + i * 37 }),
      playerIndex: i,
      seed,
    }),
  );
  const script = [];
  for (let t = 0; t < ticks; t++) {
    const inputs = runners.map((r) => toCoreInput(r.step(world)));
    script.push(Float32Array.from(runners[playerIndex].observation));
    step(world, inputs);
  }
  return script;
}

/** Compact, comparable string form of an action stream. */
export function digestActions(actions) {
  return actions
    .map((a) => `${a.moveX.toFixed(6)},${a.moveZ.toFixed(6)},${a.kick ? 1 : 0}`)
    .join('|');
}

export { createWorld, place, step };
