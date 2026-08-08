// Record test/fixtures/onnx-actions.json.
//
//   node packages/bots/test/make-fixture.mjs
//
// Run this ONLY when the observation spec, the action space or the fake model
// deliberately change, and commit the diff with the change that caused it. The
// gate in run.mjs compares against the committed file, so an accidental drift
// in any of the three shows up as a failing test rather than as a bot that
// quietly plays differently.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACTION_VERSION,
  OBSERVATION_VERSION,
  OBS_SIZE,
  createOnnxPolicy,
} from '../src/index.js';
import { buildObservationScript, runObservationScript } from './harness.mjs';
import { createFakeRuntime } from './fakeRuntime.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_PATH = join(HERE, 'fixtures', 'onnx-actions.json');

/** The exact configuration the fixture is recorded under. */
export const FIXTURE_CONFIG = Object.freeze({
  scriptTicks: 120,
  scriptSeed: 7,
  modelSeed: 0x5eed,
  policySeed: 4242,
  decisionEvery: 6,
  difficulty: 'zor',
  attackSign: -1, // team 1, so the frame rotation is exercised too
});

export function recordFixture() {
  const cfg = FIXTURE_CONFIG;
  const script = buildObservationScript({ ticks: cfg.scriptTicks, seed: cfg.scriptSeed });

  const discrete = runObservationScript(
    createOnnxPolicy({
      difficulty: cfg.difficulty,
      head: 'discrete',
      runtime: createFakeRuntime({ head: 'discrete', seed: cfg.modelSeed }),
      modelBytes: new Uint8Array([0]),
      decisionEvery: cfg.decisionEvery,
      seed: cfg.policySeed,
    }),
    script,
    { seed: cfg.policySeed, attackSign: cfg.attackSign, team: 1 },
  );

  const continuous = runObservationScript(
    createOnnxPolicy({
      difficulty: cfg.difficulty,
      head: 'continuous',
      runtime: createFakeRuntime({ head: 'continuous', seed: cfg.modelSeed }),
      modelBytes: new Uint8Array([0]),
      decisionEvery: cfg.decisionEvery,
      seed: cfg.policySeed,
    }),
    script,
    { seed: cfg.policySeed, attackSign: cfg.attackSign, team: 1 },
  );

  return {
    observationVersion: OBSERVATION_VERSION,
    actionVersion: ACTION_VERSION,
    obsSize: OBS_SIZE,
    config: cfg,
    discrete: discrete.map((a) => [round(a.moveX), round(a.moveZ), a.kick ? 1 : 0]),
    continuous: continuous.map((a) => [round(a.moveX), round(a.moveZ), a.kick ? 1 : 0]),
  };
}

function round(v) {
  return Number(v.toFixed(6));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const data = recordFixture();
  mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
  writeFileSync(FIXTURE_PATH, `${JSON.stringify(data, null, 2)}\n`);
  console.log(
    `wrote ${FIXTURE_PATH}: ${data.discrete.length} discrete + ${data.continuous.length} continuous actions`,
  );
}
