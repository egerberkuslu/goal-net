// Emit python/fixtures/observation.json: JS observation vectors, bit for bit.
//
//   node python/tools/dump-observation-fixture.mjs > python/fixtures/observation.json
//
// The vectors are recorded as raw Float32 bit patterns (uint32), not as decimal
// strings, so the Python comparison is an integer comparison and cannot be
// fudged by a print format. observe() uses only +, -, *, / and Math.sqrt, all
// of which IEEE-754 pins down, so "close enough" is not the bar here: every one
// of the 100 features has to match exactly.
//
// Scenes come from three places:
//   1. the Phase 1.2 3000-tick scenario, sampled every 97 ticks (needs
//      python/fixtures/trace.json, i.e. the core's own --dump-trace output)
//   2. hand-placed situations on all three pitch presets, including a team-1
//      observer (the 180 degree attack-frame rotation) and coincident bodies
//   3. roster sizes 1v1 up to 6v6, so both the empty-slot padding and the full
//      mate/opponent tables are covered

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  createWorld,
  step,
  place,
  setCurve,
  playerOffset,
  BALL_BASE,
  FIELD,
} from '../../packages/core/src/index.js';
import { observe, OBSERVATION_SPEC, OBSERVATION_VERSION, checkBounds } from '../../packages/bots/src/observation.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TRACE = resolve(HERE, '../fixtures/trace.json');

const bits = new DataView(new ArrayBuffer(4));
/** Float32 -> its uint32 bit pattern. */
function f32bits(v) {
  bits.setFloat32(0, v, true);
  return bits.getUint32(0, true);
}

function sample(label, world) {
  const obs = [];
  for (let i = 0; i < world.playerCount; i++) {
    const v = observe(world, i);
    const bad = checkBounds(v);
    if (bad.length) throw new Error(`${label}: player ${i} out of declared bounds: ${JSON.stringify(bad)}`);
    obs.push(Array.from(v, f32bits));
  }
  return { label, playerCount: world.playerCount, state: Array.from(world.buf), obs };
}

const samples = [];

// --- 1. the Phase 1.2 scenario, replayed from its recorded input codes -------
{
  const trace = JSON.parse(readFileSync(TRACE, 'utf8'));
  const scn = trace.scenario;
  const DIRS = trace.dirs;
  const world = createWorld({ playerCount: scn.playerCount, roles: scn.roles });
  for (let t = 0; t < trace.inputs.length; t++) {
    if (t % 97 === 0) samples.push(sample(`trace@${t}`, world));
    step(
      world,
      trace.inputs[t].map((code) => ({
        moveXFx: DIRS[code & 15][0],
        moveZFx: DIRS[code & 15][1],
        buttons: code >>> 4,
      })),
    );
  }
  samples.push(sample('trace@end', world));
}

// --- 2. hand-placed situations, one per preset ------------------------------
for (const pitch of ['kucuk', 'orta', 'buyuk']) {
  const world = createWorld({
    players: [
      { team: 0, role: 'keeper' },
      { team: 1, role: 'keeper' },
      { team: 0 },
      { team: 1 },
    ],
    settings: { pitch, durationSeconds: 60, scoreLimit: 5 },
  });
  place(world, 'ball', 12.5, -33.25, 3.5, -1.25);
  place(world, 0, 0, -300, 0, 0);
  place(world, 1, 5, 300, -0.5, 0.25);
  place(world, 2, -40.5, -20.75, 1.5, 2.25);
  place(world, 3, 40.5, 20.75, -1.5, -2.25);
  setCurve(world, 0.5);
  world.buf[5] = 2; // score 2-1, so score_diff is non-zero for both sides
  world.buf[6] = 1;
  samples.push(sample(`placed-${pitch}`, world));

  // a player standing exactly on the ball: the bdist === 0 branch
  const stacked = createWorld({ players: [{ team: 0 }, { team: 1 }], settings: { pitch } });
  place(stacked, 'ball', 0, 0, 0, 0);
  place(stacked, 0, 0, 0, 0, 0);
  place(stacked, 1, 0, 0, 0, 0);
  samples.push(sample(`stacked-${pitch}`, stacked));
}

// --- 3. roster sizes, so slot padding and full tables both appear -----------
for (const perTeam of [1, 2, 3, 4, 5, 6]) {
  const players = [];
  for (let i = 0; i < perTeam; i++) {
    players.push({ team: 0, role: i === 0 ? 'keeper' : 0 });
    players.push({ team: 1, role: i === 0 ? 'keeper' : 0 });
  }
  if (players.length > 12) players.length = 12;
  const world = createWorld({ players });
  // a few ticks of everyone walking apart, so no two players sit on a spawn
  for (let t = 0; t < 25; t++) {
    step(
      world,
      players.map((_, i) => ({
        moveXFx: ((i % 3) - 1) * 65536,
        moveZFx: ((i % 5) - 2) * 16384,
        buttons: 0,
      })),
    );
  }
  samples.push(sample(`roster-${players.length}`, world));
}

process.stdout.write(
  `${JSON.stringify({
    generatedBy: 'python/tools/dump-observation-fixture.mjs',
    observationVersion: OBSERVATION_VERSION,
    obsSize: OBSERVATION_SPEC.length,
    names: OBSERVATION_SPEC.map((f) => f.name),
    encoding: 'float32-le-bits-as-uint32',
    samples,
  })}\n`,
);
