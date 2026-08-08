// Print the JS state buffer at one tick of a recorded trace.
//
//   node python/tools/dump-state-at.mjs <trace.json> <tick>
//
// Only ever called by python/parity.py, and only after a checksum has already
// disagreed: this is what turns "tick 1743 diverged" into "tick 1743, player 2
// P_VZ, JS -1234 vs Python -1233". Keeping it out of the happy path means the
// parity run needs no node process at all when everything matches.

import { readFileSync } from 'node:fs';

import { createWorld, step } from '../../packages/core/src/index.js';

const [tracePath, tickArg] = process.argv.slice(2);
if (!tracePath || tickArg === undefined) {
  console.error('usage: node dump-state-at.mjs <trace.json> <tick>');
  process.exit(2);
}
const target = Number(tickArg);
const trace = JSON.parse(readFileSync(tracePath, 'utf8'));
const scn = trace.scenario;
const DIRS = trace.dirs;

const world = createWorld({ playerCount: scn.playerCount, roles: scn.roles });
const decode = (code) => ({
  moveXFx: DIRS[code & 15][0],
  moveZFx: DIRS[code & 15][1],
  buttons: code >>> 4,
});

// chain[t] is the state AFTER t steps, so tick 0 is the untouched world.
for (let t = 0; t < target; t++) step(world, trace.inputs[t].map(decode));

process.stdout.write(`${JSON.stringify({ tick: target, state: Array.from(world.buf) })}\n`);
