// A real match to record: scripted bots on every slot, no human in the loop.
//
// The point of driving the recording with @goalnet/bots rather than with a
// synthetic input pattern is that a bot match has the input statistics a real
// one has — axes that change most ticks, buttons that latch for a while, a ball
// that actually reaches both goals — so the encoder's size numbers mean
// something and the highlight heuristics have goals and saves to find.

import { HDR_TICK, createWorld, step as stepWorld } from '../../core/src/index.js';
import { createScriptedPolicy, makeBotPolicy } from '../../bots/src/index.js';

import { createRecorder } from '../src/recorder.js';

/** 2v2 with keepers: slots 0/1 keep, 2/3 play out. Slot i is on team i % 2. */
export const FOUR = Object.freeze({
  teams: [0, 1, 0, 1],
  roles: { 0: 'keeper', 1: 'keeper' },
  difficulty: { 0: 'zor', 1: 'orta', 2: 'zor', 3: 'orta' },
});

/** 3v3: one keeper each, two outfield. */
export const SIX = Object.freeze({
  teams: [0, 1, 0, 1, 0, 1],
  roles: { 0: 'keeper', 1: 'keeper' },
  difficulty: { 0: 'zor', 1: 'orta', 2: 'zor', 3: 'orta', 4: 'orta', 5: 'zor' },
});

/**
 * playAndRecord({ shape, ticks, seed, settings, recorder }) -> { world, rec, container, stats }
 *
 * One host loop: collect the bot inputs, record them, step, observe. Exactly
 * the call order a real host uses.
 */
export function playAndRecord(options = {}) {
  const {
    shape = FOUR,
    ticks = 3600,
    seed = 1337,
    settings = { durationSeconds: 180, scoreLimit: 0, pitch: 'orta', mercyRule: false },
    recorder: recorderOptions = {},
  } = options;

  const players = shape.teams.map((team, i) => ({ team, role: shape.roles[i] || 'field' }));
  const world = createWorld({ players, settings });

  const policies = {};
  for (let i = 0; i < shape.teams.length; i++) {
    policies[i] = createScriptedPolicy({ difficulty: shape.difficulty[i] || 'orta', seed: seed + i });
  }
  const botPolicy = makeBotPolicy({ policies, roles: shape.roles, seed });

  const rec = createRecorder({ world, ...recorderOptions });
  const inputs = new Array(shape.teams.length).fill(null);
  const stats = { goals: [0, 0], goalTicks: [], saves: 0, shots: 0, catches: 0 };

  for (let t = 0; t < ticks; t++) {
    const tick = world.buf[HDR_TICK];
    for (let i = 0; i < inputs.length; i++) inputs[i] = botPolicy({ world, tick, playerIndex: i });
    rec.record(tick, inputs);
    const events = stepWorld(world, inputs);
    rec.observe(events);
    for (const e of events) {
      if (e.type === 'goal') {
        stats.goals[e.team]++;
        stats.goalTicks.push(e.tick);
      } else if (e.type === 'keeper-save') stats.saves++;
      else if (e.type === 'keeper-catch') stats.catches++;
      else if (e.type === 'shot') stats.shots++;
    }
  }

  return { world, rec, container: rec.finish(), stats };
}
