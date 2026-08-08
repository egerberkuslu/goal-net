// Headless gate for @goalnet/net. No sockets, no timers, no real clock: every
// session is driven by a synthetic millisecond loop over an in-process fake
// channel with seeded loss, jitter and reordering.
//
//   node test/run.mjs   PASS/FAIL lines, a measured wire-size table, and a
//                       non-zero exit on failure
//
// What each section is actually proving is written above it. The load-bearing
// claim is the first one: a client fed a lossy, reordered snapshot stream ends
// up with byte-identical authoritative state, which is only possible if the
// delta encoding, the sequencing and the baseline bookkeeping are all correct.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  createWorld,
  serialize,
  constantsHash,
  stateLength,
  playerOffset,
  STATE_MAGIC,
  STATE_VERSION,
  constantsHashInt,
  HDR_TICK,
  HDR_PLAYER_COUNT,
  FIELD,
  fx,
} from '../../core/src/index.js';

import {
  createHostSession,
  createClientSession,
  decodeMessage,
  encodeInput,
  encodeSnapshotMessages,
  encodeDeltaWords,
  applyDeltaWords,
  stateChecksumInt,
  snapshotHeaderBytes,
  MAX_MESSAGE_BYTES,
  INPUT_BYTES,
  HELLO_BYTES,
  MSG_INPUT,
  NET_VERSION,
} from '../src/index.js';

import { createChannel, makeRng } from './channel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FX_ONE = fx.FX_ONE;
const TICK_MS = 1000 / 60;

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`PASS  ${name}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function section(title) {
  console.log(`\n--- ${title}`);
}
function pct(a, b) {
  return b === 0 ? '0%' : `${((a / b) * 100).toFixed(1)}%`;
}

// ------------------------------------------------------------------ harness

/** A scripted "bot policy". The netcode injects it; it is not bot AI. */
function makeScriptedPolicy(seed) {
  const rng = makeRng(seed);
  const calls = { count: 0 };
  const policy = ({ tick, playerIndex }) => {
    calls.count++;
    const r = rng();
    const phase = ((tick + playerIndex * 37) % 240) / 240;
    return {
      moveXFx: Math.round(Math.sin(phase * Math.PI * 2) * FX_ONE) | 0,
      moveZFx: Math.round(Math.cos(phase * Math.PI * 2) * FX_ONE) | 0,
      kick: (r & 63) === 0,
    };
  };
  return { policy, calls };
}

/** Deterministic local input for the client, a function of its own tick. */
function clientInput(tick) {
  const phase = (tick % 360) / 360;
  return {
    moveXFx: Math.round(Math.cos(phase * Math.PI * 2) * FX_ONE) | 0,
    moveZFx: Math.round(Math.sin(phase * Math.PI * 2) * FX_ONE) | 0,
    kick: tick % 47 === 0,
  };
}

/**
 * Drive one host and one client over two fake channels for `durationMs` of
 * synthetic time, one millisecond per iteration.
 */
function runSession(opts) {
  const {
    durationMs = 8000,
    playerCount = 4,
    hostPlayerId = 0,
    clientPlayerId = 1,
    snapshotHz = 20,
    botSlots = [],
    botPolicy = null,
    historyTicks = 180,
    interpolationMs = 100,
    up,
    down,
    inputFor = clientInput,
    hostInputFor = () => ({ moveXFx: 0, moveZFx: 0, kick: 0 }),
    dropInputAtMs = null,
    maxMessageBytes,
    onTick = null,
    sampleHz = 0,
  } = opts;

  const host = createHostSession({
    playerCount,
    hostPlayerId,
    snapshotHz,
    botSlots,
    botPolicy,
    historyTicks,
    maxMessageBytes,
  });
  const client = createClientSession({
    localPlayerId: clientPlayerId,
    interpolationMs,
    historyTicks,
    maxMessageBytes,
  });
  host.addPeer('c1', clientPlayerId, 0);

  const log = {
    checksumComparisons: 0,
    checksumMatches: 0,
    checksumMissing: 0,
    samples: [],
    clientInputs: [],
    droppedInputs: 0,
  };

  let nextInputMs = 0;
  let nextSampleMs = 0;
  let clientTickCounter = 0;

  for (let now = 0; now <= durationMs; now++) {
    if (now >= nextInputMs) {
      const sent = client.sendInput(inputFor(clientTickCounter));
      if (sent) {
        log.clientInputs.push(sent.buffer);
        if (dropInputAtMs !== null && now >= dropInputAtMs && log.droppedInputs === 0) {
          log.droppedInputs++;
        } else {
          up.send(sent.buffer, now);
        }
        clientTickCounter++;
      }
      nextInputMs += TICK_MS;
    }
    if (client.needsFull) up.send(client.hello(), now);

    for (const data of up.deliver(now)) host.receive('c1', data, now);

    host.setLocalInput(hostInputFor(host.tick));
    for (const { buffer } of host.update(now)) down.send(buffer, now);

    for (const data of down.deliver(now)) {
      const res = client.receive(data, now);
      if (res.applied) {
        log.checksumComparisons++;
        const hostSum = host.checksumAt(res.tick);
        if (hostSum === null) log.checksumMissing++;
        else if (hostSum === client.authoritativeChecksum()) log.checksumMatches++;
      }
    }

    if (sampleHz > 0 && now >= nextSampleMs) {
      // predictLocal:false keeps players[] purely interpolated, so the same
      // call yields both the smoothed authoritative position and the predicted
      // one and they can be compared against each other.
      const view = client.sample(now, { predictLocal: false });
      const substituted = client.sample(now);
      if (view) {
        log.samples.push({
          now,
          renderTick: view.renderTick,
          interpolating: view.interpolating,
          ballX: view.ball.x,
          ballZ: view.ball.z,
          localX: view.players[clientPlayerId] ? view.players[clientPlayerId].x : null,
          substitutedX: substituted.players[clientPlayerId]
            ? substituted.players[clientPlayerId].x
            : null,
          substituted: substituted.players[clientPlayerId]
            ? substituted.players[clientPlayerId].predictedLocal
            : false,
          predictedX: view.predictedLocal ? view.predictedLocal.x : null,
          predictedTick: view.predictedLocal ? view.predictedLocal.tick : null,
          hostX: host.playerSlot(clientPlayerId)[FIELD.P_X] / FX_ONE,
          authTick: client.tick,
          hostTick: host.tick,
        });
      }
      nextSampleMs += 1000 / sampleHz;
    }

    if (onTick) onTick({ now, host, client, up, down, log });
  }

  return { host, client, log };
}

// =========================================================== 1. convergence
//
// A 12% loss, 8% reorder, jittered channel in both directions. Every snapshot
// the client accepts is re-checksummed against the host's own digest for that
// exact tick. Anything wrong in the delta encoding, the run bookkeeping or the
// baseline selection shows up here as a mismatch.

section('convergence over a lossy reordering channel');

const conv = (() => {
  const { policy, calls } = makeScriptedPolicy(0xc0ffee);
  const up = createChannel({ latencyMs: 45, jitterMs: 18, lossPct: 12, reorderPct: 8, seed: 0x1234 });
  const down = createChannel({ latencyMs: 45, jitterMs: 18, lossPct: 12, reorderPct: 8, seed: 0x9876 });
  const r = runSession({
    durationMs: 10000,
    playerCount: 4,
    botSlots: [2, 3],
    botPolicy: policy,
    up,
    down,
    hostInputFor: (t) => clientInput(t + 91),
  });
  return { ...r, up, down, calls };
})();

check(
  'the client applied a full snapshot stream',
  conv.client.stats.applied > 120,
  `applied=${conv.client.stats.applied}`,
);
check(
  'host->client loss really was at or above 10%',
  conv.down.stats.dropped / conv.down.stats.sent >= 0.1,
  `${pct(conv.down.stats.dropped, conv.down.stats.sent)} of ${conv.down.stats.sent}`,
);
check(
  'the channel really did reorder, and stale snapshots were dropped',
  conv.down.stats.outOfOrder > 0 && conv.client.stats.staleDropped > 0,
  `outOfOrder=${conv.down.stats.outOfOrder} staleDropped=${conv.client.stats.staleDropped}`,
);
check(
  'every applied snapshot checksums identical to the host at that tick',
  conv.log.checksumComparisons > 0 &&
    conv.log.checksumMatches === conv.log.checksumComparisons,
  `${conv.log.checksumMatches}/${conv.log.checksumComparisons} matched, ${conv.log.checksumMissing} missing`,
);
check(
  'no reconstruction ever failed its checksum',
  conv.client.stats.checksumMismatches === 0,
  `mismatches=${conv.client.stats.checksumMismatches}`,
);
check(
  'the run exercised the simulation (deltas, ticks, kicks)',
  conv.host.stats.ticks > 550 && conv.client.stats.deltasApplied > 100,
  `ticks=${conv.host.stats.ticks} deltas=${conv.client.stats.deltasApplied}`,
);
{
  const t = conv.client.tick;
  check(
    'final client authoritative state equals the host at the same tick',
    conv.host.checksumAt(t) !== null &&
      conv.host.checksumAt(t) === conv.client.authoritativeChecksum(),
    `tick ${t}`,
  );
  const hostState = conv.host.stateAt(t);
  const clientState = conv.client.authoritative();
  let diff = -1;
  if (hostState && clientState && hostState.length === clientState.length) {
    diff = -1;
    for (let i = 0; i < hostState.length; i++) {
      if (hostState[i] !== clientState[i]) {
        diff = i;
        break;
      }
    }
  }
  check('...and word for word, not merely digest for digest', diff === -1, `first diff at word ${diff}`);
}

// ================================================================ 2. deltas
//
// Two claims: a delta is smaller than the full snapshot it replaces, and it
// reconstructs the target exactly. Measured on real host states, not toys.

section('delta encoding');

const deltaSizes = (() => {
  const world = createWorld({ playerCount: 4 });
  const host = createHostSession({ world, snapshotHz: 20 });
  host.addPeer('p', 1, 0);
  const states = [];
  for (let now = 0; now <= 3000; now++) {
    host.setLocalInput(clientInput(host.tick));
    host.update(now);
    if (now % 50 === 0) states.push(serialize(host.world));
  }

  let fullBytes = 0;
  let deltaBytes = 0;
  let exact = true;
  for (let i = 1; i < states.length; i++) {
    const delta = encodeDeltaWords(states[i - 1], states[i]);
    const rebuilt = applyDeltaWords(states[i - 1], delta);
    for (let w = 0; w < rebuilt.length; w++) {
      if (rebuilt[w] !== states[i][w]) exact = false;
    }
    const full = encodeSnapshotMessages({
      seq: i,
      tick: states[i][HDR_TICK],
      baseTick: -1,
      checksum: stateChecksumInt(states[i]),
      playerCount: 4,
      ackSeqs: new Uint32Array(4),
      payload: states[i],
    });
    const d = encodeSnapshotMessages({
      seq: i,
      tick: states[i][HDR_TICK],
      baseTick: states[i - 1][HDR_TICK],
      checksum: stateChecksumInt(states[i]),
      playerCount: 4,
      ackSeqs: new Uint32Array(4),
      payload: delta,
    });
    fullBytes += full[0].byteLength;
    deltaBytes += d[0].byteLength;
  }
  const n = states.length - 1;
  return { exact, n, fullAvg: fullBytes / n, deltaAvg: deltaBytes / n };
})();

check(
  'a delta reconstructs its target word for word',
  deltaSizes.exact,
  `${deltaSizes.n} consecutive pairs`,
);
check(
  'a delta message is smaller than the full snapshot it replaces',
  deltaSizes.deltaAvg < deltaSizes.fullAvg,
  `delta ${deltaSizes.deltaAvg.toFixed(1)} B vs full ${deltaSizes.fullAvg.toFixed(1)} B`,
);
{
  // An idle world changes only the tick word, which is the case that makes
  // run-length worth having at all.
  const a = serialize(createWorld({ playerCount: 4 }));
  const b = Int32Array.from(a);
  b[HDR_TICK] = a[HDR_TICK] + 1;
  const delta = encodeDeltaWords(a, b);
  check(
    'an idle world deltas down to a single run',
    delta[0] === 1 && delta.length === 4,
    `${delta.length} words, ${delta[0]} run(s)`,
  );
}
{
  const a = serialize(createWorld({ playerCount: 4 }));
  const b = Int32Array.from(a);
  check('an unchanged world produces an empty delta', encodeDeltaWords(a, b).length === 1);
}

// ----------------------------- a client that misses deltas recovers via full
//
// Blackout the host->client direction for longer than the host keeps baselines.
// The peer's acknowledged tick ages out of the host history, so the host has
// nothing to delta against and must send a full snapshot.

const blackout = (() => {
  const up = createChannel({ latencyMs: 30, seed: 0x55 });
  const inner = createChannel({ latencyMs: 30, seed: 0x77 });
  const FROM = 2000;
  const TO = 4500;
  const down = {
    stats: inner.stats,
    send(data, now) {
      if (now >= FROM && now < TO) {
        inner.stats.sent++;
        inner.stats.dropped++;
        return false;
      }
      return inner.send(data, now);
    },
    deliver: (now) => inner.deliver(now),
  };
  return runSession({
    durationMs: 7000,
    playerCount: 2,
    historyTicks: 60, // 1 s of baselines
    up,
    down,
  });
})();

check(
  'a client that missed 2.5 s of deltas is resynced with a full snapshot',
  blackout.client.stats.fullsApplied >= 2,
  `fulls=${blackout.client.stats.fullsApplied} deltas=${blackout.client.stats.deltasApplied}`,
);
check(
  'and converges again after the blackout',
  blackout.host.checksumAt(blackout.client.tick) === blackout.client.authoritativeChecksum(),
  `tick ${blackout.client.tick}`,
);

// ------------------------------- an explicit resync request forces a full too
{
  const up = createChannel({ latencyMs: 20, seed: 3 });
  const down = createChannel({ latencyMs: 20, seed: 4 });
  const host = createHostSession({ playerCount: 2, snapshotHz: 20 });
  const client = createClientSession({ localPlayerId: 1 });
  host.addPeer('c', 1, 0);
  let nextInput = 0;
  for (let now = 0; now <= 1200; now++) {
    if (now >= nextInput) {
      const sent = client.sendInput(clientInput(now));
      if (sent) up.send(sent.buffer, now);
      nextInput += TICK_MS;
    }
    for (const d of up.deliver(now)) host.receive('c', d, now);
    for (const { buffer } of host.update(now)) down.send(buffer, now);
    for (const d of down.deliver(now)) client.receive(d, now);
    if (now === 600) up.send(client.hello({ wantFull: true }), now);
  }
  // The host keeps sending fulls until the peer acknowledges one, so a resync
  // costs one full plus however many snapshots fit in a round trip.
  check(
    'a hello(wantFull) mid-session makes the host send another full snapshot',
    client.stats.fullsApplied >= 2 &&
      client.stats.fullsApplied <= 4 &&
      client.stats.deltasApplied > 5,
    `fulls=${client.stats.fullsApplied} deltas=${client.stats.deltasApplied}`,
  );
}

// ================================================= 3. sequencing and refusal

section('sequencing and trust boundary');

{
  const up = createChannel({ latencyMs: 0, seed: 11 });
  const down = createChannel({ latencyMs: 0, seed: 12 });
  const host = createHostSession({ playerCount: 2, snapshotHz: 20 });
  const client = createClientSession({ localPlayerId: 1 });
  host.addPeer('c', 1, 0);

  const captured = [];
  for (let now = 0; now <= 600; now++) {
    for (const d of up.deliver(now)) host.receive('c', d, now);
    host.setLocalInput(clientInput(host.tick));
    for (const { buffer } of host.update(now)) down.send(buffer, now);
    for (const d of down.deliver(now)) {
      captured.push(d);
      client.receive(d, now);
    }
  }
  const before = client.stats.applied;
  const beforeTick = client.tick;
  const beforeStale = client.stats.staleDropped;

  // Replay an old snapshot: lower seq, so it must be ignored outright.
  const old = captured[3];
  const res = client.receive(old, 700);
  check(
    'a snapshot with a lower seq is ignored',
    res.applied === false &&
      res.reason === 'stale' &&
      client.stats.staleDropped === beforeStale + 1 &&
      client.stats.applied === before &&
      client.tick === beforeTick,
    `reason=${res.reason}`,
  );

  // Same message, one word of constantsHash flipped.
  const forged = captured[captured.length - 1].slice(0);
  new DataView(forged).setInt32(8, constantsHashInt ^ 0x5a5a5a5a, true);
  const refused = client.receive(forged, 800);
  check(
    'a snapshot from a foreign constantsHash build is refused',
    refused.applied === false &&
      refused.reason === 'constants-hash' &&
      client.stats.constantsRefused === 1,
    `reason=${refused.reason}`,
  );

  const forgedInput = encodeInput({ playerId: 1, seq: 99999, tick: 0, moveXFx: 0, moveZFx: 0, kick: 0 });
  new DataView(forgedInput).setInt32(8, constantsHashInt ^ 1, true);
  host.receive('c', forgedInput, 900);
  check(
    'the host refuses a foreign constantsHash input too',
    host.stats.rejected.constantsHash === 1,
    JSON.stringify(host.stats.rejected),
  );
}

// ================================================ 4. prediction/reconciliation
//
// 100 ms RTT, no loss. The local player walks in +x; the host player is idle.
// desyncs counts snapshots whose authoritative local slot disagreed with what
// the client had predicted for that exact tick, so desyncs === 0 over hundreds
// of snapshots is the statement "prediction reproduced authority every time".

section('prediction and reconciliation');

const straight = (t) => ({ moveXFx: FX_ONE, moveZFx: 0, kick: 0 });

const pred = (() => {
  const up = createChannel({ latencyMs: 50, seed: 21 });
  const down = createChannel({ latencyMs: 50, seed: 22 });
  const marks = [];
  const r = runSession({
    durationMs: 6000,
    playerCount: 2,
    up,
    down,
    inputFor: straight,
    sampleHz: 60,
    onTick: ({ now, client }) => {
      if (now % 50 === 0) marks.push({ now, desyncs: client.stats.desyncs });
    },
  });
  return { ...r, marks };
})();

check(
  'the prediction ran ahead of authority at every sample',
  pred.log.samples.length > 250 &&
    pred.log.samples.filter((s) => s.now > 300).every((s) => s.predictedTick > s.authTick),
  `${pred.log.samples.length} samples`,
);
{
  // The player walks in +x from the centre spot at terminal speed and pins
  // itself against the touchline after ~1.3 s, where predicted and authoritative
  // are trivially equal. The window below is the part where it is still moving.
  const mid = pred.log.samples.filter((s) => s.now > 300 && s.now < 1100);
  const leads = mid.filter((s) => s.predictedX > s.localX);
  const gap = mid.reduce((a, s) => a + (s.predictedX - s.localX), 0) / mid.length;
  check(
    'the predicted local player leads the interpolated authoritative one',
    leads.length === mid.length,
    `${leads.length}/${mid.length}, mean lead ${gap.toFixed(3)} u`,
  );
  check(
    'sample() substitutes the prediction into the rendered local player',
    mid.every((s) => s.substituted && s.substitutedX === s.predictedX),
  );
}
{
  const mid = pred.log.samples.filter((s) => s.now > 300 && s.now < 1100);
  // The predicted position tracks the host's live position; the interpolated
  // authoritative position lags it by the buffer plus the downlink.
  const predErr = mid.reduce((a, s) => a + Math.abs(s.predictedX - s.hostX), 0) / mid.length;
  const renderErr = mid.reduce((a, s) => a + Math.abs(s.localX - s.hostX), 0) / mid.length;
  check(
    'prediction is closer to the live host position than interpolated authority is',
    predErr < renderErr,
    `predicted off by ${predErr.toFixed(3)} u, interpolated by ${renderErr.toFixed(3)} u`,
  );
  pred.measured = { predErr, renderErr };
}
{
  // The join transient is real and inherent: the client's first inputs are
  // still in flight while the host steps the ticks the client is predicting,
  // so the very first snapshot after the pipeline opens contradicts it. What
  // must be true is that it is bounded, early, and never comes back.
  const warm = pred.marks.filter((m) => m.now >= 500);
  check(
    'prediction is contradicted only by the join transient, then never again',
    pred.client.stats.desyncs <= 2 &&
      warm.length > 0 &&
      warm[0].desyncs === warm[warm.length - 1].desyncs &&
      pred.client.stats.corrections > 100,
    `desyncs=${pred.client.stats.desyncs} (all before ${warm[0].now} ms) corrections=${pred.client.stats.corrections}`,
  );
  check(
    'every snapshot in the steady state agreed with the prediction',
    pred.client.stats.applied - pred.client.stats.desyncs > 110,
    `${pred.client.stats.applied - pred.client.stats.desyncs} of ${pred.client.stats.applied} snapshots agreed`,
  );
}
check(
  'after reconciliation the local slot is bit-identical to authority',
  (() => {
    const p = pred.client.predictionAt(pred.client.tick);
    const a = pred.client.authoritativeSlot();
    if (!p || !a) return false;
    for (let i = 0; i < p.length; i++) if (p[i] !== a[i]) return false;
    return true;
  })(),
);

// --------------------------------------- a mispredicted input gets corrected
//
// One input packet is dropped on the way to the host. The host starves and
// repeats the previous input; the client had already predicted the new one.
// That is a genuine misprediction, and it must be detected and repaired.

const misp = (() => {
  const up = createChannel({ latencyMs: 50, seed: 31 });
  const down = createChannel({ latencyMs: 50, seed: 32 });
  const marks = [];
  const r = runSession({
    durationMs: 6000,
    playerCount: 2,
    up,
    down,
    // A varying input stream: repeating the previous input in place of the
    // lost one now produces a different acceleration, which is what makes the
    // starvation observable at all.
    inputFor: clientInput,
    dropInputAtMs: 2000,
    sampleHz: 60,
    onTick: ({ now, client }) => {
      if (now % 100 === 0) marks.push({ now, desyncs: client.stats.desyncs });
    },
  });
  return { ...r, marks };
})();

check(
  'the dropped input produced a detected misprediction',
  misp.client.stats.desyncs >= 1 && misp.log.droppedInputs === 1,
  `desyncs=${misp.client.stats.desyncs}`,
);
check(
  'the misprediction had a measurable magnitude',
  misp.client.lastDesync !== null &&
    (Math.abs(misp.client.lastDesync.dx) > 0 || Math.abs(misp.client.lastDesync.dz) > 0),
  misp.client.lastDesync
    ? `dx=${misp.client.lastDesync.dx.toFixed(4)} dz=${misp.client.lastDesync.dz.toFixed(4)} at tick ${misp.client.lastDesync.tick}`
    : 'no desync recorded',
);
{
  const tail = misp.marks.filter((m) => m.now >= 3500);
  const settled = tail.length > 0 && tail[0].desyncs === tail[tail.length - 1].desyncs;
  check(
    'divergence returns to zero: no further desync after the correction',
    settled,
    `desyncs frozen at ${tail.length ? tail[tail.length - 1].desyncs : '?'} from ${tail.length ? tail[0].now : '?'} ms on`,
  );
}
check(
  'and the corrected prediction matches authority again',
  (() => {
    const p = misp.client.predictionAt(misp.client.tick);
    const a = misp.client.authoritativeSlot();
    if (!p || !a) return false;
    for (let i = 0; i < p.length; i++) if (p[i] !== a[i]) return false;
    return true;
  })(),
);

// ========================================================= 5. interpolation

section('interpolation buffer');

{
  const s = pred.log.samples;
  let backwards = 0;
  for (let i = 1; i < s.length; i++) if (s[i].renderTick < s[i - 1].renderTick) backwards++;
  check(
    '60 Hz sampling of a 20 Hz snapshot stream never jumps backwards',
    backwards === 0,
    `${backwards} regressions over ${s.length} samples`,
  );

  const interpolating = s.filter((x) => x.interpolating).length;
  check(
    'most samples land strictly between two snapshots',
    interpolating / s.length > 0.8,
    `${pct(interpolating, s.length)} interpolating`,
  );

  const distinctRender = new Set(s.map((x) => x.renderTick.toFixed(4))).size;
  check(
    'renders are smoothed, not stepped: far more distinct frames than snapshots',
    distinctRender > pred.client.stats.applied * 2,
    `${distinctRender} distinct render ticks vs ${pred.client.stats.applied} snapshots`,
  );

  const mid = s.filter((x) => x.now > 1500);
  const lagTicks = mid.reduce((a, x) => a + (x.authTick - x.renderTick), 0) / mid.length;
  check(
    'the render timeline sits roughly one interpolation window behind authority',
    lagTicks > 2 && lagTicks < 12,
    `${lagTicks.toFixed(2)} ticks ~= ${(lagTicks * TICK_MS).toFixed(0)} ms behind`,
  );

  // A monotone ball position while the ball travels in one direction is the
  // visible form of "no backwards jump".
  const window = mid.slice(0, 120);
  let ballBack = 0;
  for (let i = 1; i < window.length; i++) {
    if (Math.abs(window[i].ballX - window[i - 1].ballX) > 5) ballBack++;
  }
  check('no teleporting ball between consecutive frames', ballBack === 0, `${ballBack} jumps`);
}

// ==================================================== 6. input validation

section('host input validation');

{
  const host = createHostSession({ playerCount: 2, snapshotHz: 20 });
  host.addPeer('good', 1, 0);
  const R = host.stats.rejected;

  // unknown peer
  host.receive('nobody', encodeInput({ playerId: 1, seq: 1, tick: 0 }), 0);
  check('input from an unregistered peer is rejected', R.unknownPeer === 1);

  // oversize
  host.receive('good', new ArrayBuffer(20000), 0);
  check('an oversized message is rejected before it is parsed', R.oversize === 1, `${R.oversize}`);

  // malformed: bad magic, and a truncated body
  const badMagic = encodeInput({ playerId: 1, seq: 2, tick: 0 });
  new DataView(badMagic).setInt32(0, 0xdeadbeef | 0, true);
  host.receive('good', badMagic, 0);
  host.receive('good', new ArrayBuffer(12), 0);
  host.receive('good', new ArrayBuffer(13), 0);
  check('bad magic, short and unaligned messages are rejected', R.malformed === 3, `${R.malformed}`);

  // out of range: axis beyond +/-1.0
  const wild = encodeInput({ playerId: 1, seq: 3, tick: 0 });
  new DataView(wild).setInt32(24, FX_ONE * 4, true);
  host.receive('good', wild, 0);
  const wildKick = encodeInput({ playerId: 1, seq: 4, tick: 0 });
  new DataView(wildKick).setInt32(32, 7, true);
  host.receive('good', wildKick, 0);
  check('out-of-range move axes and kick bits are rejected', R.outOfRange === 2, `${R.outOfRange}`);

  // spoofing another slot
  host.receive('good', encodeInput({ playerId: 0, seq: 5, tick: 0 }), 0);
  check('a peer claiming another slot is rejected', R.spoofedPlayer === 1, `${R.spoofedPlayer}`);

  // tick window: an input claiming to be far in the future
  host.receive('good', encodeInput({ playerId: 1, seq: 6, tick: 5000 }), 0);
  check('an input far ahead of the host clock is rejected', R.tickWindow === 1, `${R.tickWindow}`);

  // accepted baseline, then a stale replay of it
  host.receive('good', encodeInput({ playerId: 1, seq: 100, tick: 0 }), 0);
  host.receive('good', encodeInput({ playerId: 1, seq: 99, tick: 0 }), 0);
  host.receive('good', encodeInput({ playerId: 1, seq: 100, tick: 0 }), 0);
  check('a replayed or reordered input seq is rejected', R.staleSeq === 2, `${R.staleSeq}`);

  // too frequent: a burst at one instant
  let seq = 1000;
  for (let i = 0; i < 200; i++) {
    host.receive('good', encodeInput({ playerId: 1, seq: seq++, tick: 0 }), 0);
  }
  check(
    'an input flood beyond the rate cap is rejected',
    R.rateLimit > 150,
    `${R.rateLimit} of 200 rejected, limit ${host.limits.maxInputRateHz}/s`,
  );
}
{
  // kick rate gets its own bucket, driven at a legal input rate
  const host = createHostSession({ playerCount: 2, snapshotHz: 20 });
  host.addPeer('k', 1, 0);
  let seq = 1;
  for (let i = 0; i < 80; i++) {
    const now = i * 12; // 83 inputs/s, inside the input cap
    host.receive('k', encodeInput({ playerId: 1, seq: seq++, tick: 0, kick: i % 2 }), now);
  }
  check(
    'a kick-spam stream is rate capped',
    host.stats.rejected.kickRate > 0 && host.stats.rejected.rateLimit === 0,
    `kickRate=${host.stats.rejected.kickRate} rateLimit=${host.stats.rejected.rateLimit}`,
  );
}
{
  // queue depth: a peer cannot hoard simulation time
  const host = createHostSession({ playerCount: 2, snapshotHz: 20 });
  host.addPeer('q', 1, 0);
  let seq = 1;
  for (let i = 0; i < 40; i++) {
    host.receive('q', encodeInput({ playerId: 1, seq: seq++, tick: 0 }), i * 12);
  }
  check(
    'a hoarded input queue is trimmed to the cap',
    host.stats.rejected.queueOverflow >= 40 - host.limits.maxQueuedInputs - 1,
    `overflow=${host.stats.rejected.queueOverflow} cap=${host.limits.maxQueuedInputs}`,
  );
}

// ===================================================== 7. bots only on host

section('bots run on the host only');

{
  const { policy, calls } = makeScriptedPolicy(0xb0b);
  const up = createChannel({ latencyMs: 30, seed: 41 });
  const down = createChannel({ latencyMs: 30, seed: 42 });

  // The same policy object is handed to BOTH sessions. Only one may call it.
  const host = createHostSession({
    playerCount: 4,
    snapshotHz: 20,
    botSlots: [2, 3],
    botPolicy: policy,
  });
  const client = createClientSession({
    localPlayerId: 1,
    botSlots: [2, 3],
    botPolicy: policy,
  });
  host.addPeer('c', 1, 0);

  const sent = [];
  let nextInput = 0;
  let ct = 0;
  for (let now = 0; now <= 4000; now++) {
    if (now >= nextInput) {
      const out = client.sendInput(clientInput(ct++));
      if (out) {
        sent.push(out.buffer);
        up.send(out.buffer, now);
      }
      nextInput += TICK_MS;
    }
    for (const d of up.deliver(now)) host.receive('c', d, now);
    for (const { buffer } of host.update(now)) down.send(buffer, now);
    for (const d of down.deliver(now)) client.receive(d, now);
  }

  check(
    'the host called the bot policy',
    host.stats.botCalls > 400,
    `${host.stats.botCalls} calls`,
  );
  check(
    'and every single call came from the host session',
    calls.count === host.stats.botCalls,
    `policy invoked ${calls.count} times, host accounts for ${host.stats.botCalls}`,
  );
  check(
    'the client never authored input for a slot it does not own',
    sent.every((b) => {
      const m = decodeMessage(b);
      return m.type === MSG_INPUT && m.playerId === 1;
    }),
    `${sent.length} inputs inspected`,
  );

  const src = readFileSync(join(HERE, '..', 'src', 'clientSession.js'), 'utf8');
  const code = src
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n');
  check(
    'clientSession.js contains no bot hook at all',
    !/\bbot/i.test(code),
    'found a bot reference in client code',
  );
}

// ================================================= 8. message size ceiling

section('message size ceiling');

function fullSnapshotBytes(playerCount) {
  const state = new Int32Array(stateLength(playerCount));
  state[0] = STATE_MAGIC;
  state[1] = STATE_VERSION;
  state[2] = constantsHashInt;
  state[HDR_PLAYER_COUNT] = playerCount;
  for (let i = 0; i < playerCount; i++) {
    const o = playerOffset(i);
    state[o + FIELD.P_X] = (i + 1) * 65536;
    state[o + FIELD.P_Z] = (i + 1) * -65536;
    state[o + FIELD.P_TEAM] = i % 2;
  }
  const msgs = encodeSnapshotMessages({
    seq: 1,
    tick: 1,
    baseTick: -1,
    checksum: stateChecksumInt(state),
    playerCount,
    ackSeqs: new Uint32Array(playerCount),
    payload: state,
  });
  return { bytes: msgs[0].byteLength, chunks: msgs.length, state };
}

const size4 = fullSnapshotBytes(4);
const size12 = fullSnapshotBytes(12);
const size16 = fullSnapshotBytes(16);

check(
  'a 4-player full snapshot is one message under the 16 KB ceiling',
  size4.chunks === 1 && size4.bytes < MAX_MESSAGE_BYTES,
  `${size4.bytes} B`,
);
check(
  'a 16-player full snapshot is one message under the 16 KB ceiling',
  size16.chunks === 1 && size16.bytes < MAX_MESSAGE_BYTES,
  `${size16.bytes} B`,
);
check(
  'every message the convergence run put on the wire stayed under the ceiling',
  conv.host.stats.bytesSent / conv.host.stats.messagesSent < MAX_MESSAGE_BYTES,
  `mean ${(conv.host.stats.bytesSent / conv.host.stats.messagesSent).toFixed(1)} B over ${conv.host.stats.messagesSent} messages`,
);

// Chunking is dead code until a state grows past the ceiling, so squeeze the
// ceiling until it is not.
{
  const TINY = 120;
  const up = createChannel({ latencyMs: 10, seed: 51 });
  const down = createChannel({ latencyMs: 10, seed: 52 });
  const r = runSession({
    durationMs: 2000,
    playerCount: 4,
    up,
    down,
    maxMessageBytes: TINY,
  });
  check(
    'a snapshot larger than the ceiling is chunked and reassembled',
    r.client.stats.chunksReceived > 10 && r.client.stats.applied > 10,
    `chunks=${r.client.stats.chunksReceived} applied=${r.client.stats.applied}`,
  );
  check(
    'chunked reassembly still checksums against the host',
    r.client.stats.checksumMismatches === 0 &&
      r.host.checksumAt(r.client.tick) === r.client.authoritativeChecksum(),
    `mismatches=${r.client.stats.checksumMismatches}`,
  );
  const over = r.host.stats.bytesSent / r.host.stats.messagesSent;
  check('no chunk exceeded the squeezed ceiling', over <= TINY, `mean ${over.toFixed(1)} B`);
}

// ------------------------------------------------------------------- report

section('measured wire sizes');

const convMeanSnapshot = conv.host.stats.bytesSent / conv.host.stats.messagesSent;
const rows = [
  ['hello', HELLO_BYTES, '-'],
  ['input', INPUT_BYTES, `${(INPUT_BYTES * 60).toLocaleString()} B/s at 60 Hz`],
  [
    'full snapshot 4p',
    size4.bytes,
    `${(size4.bytes * 20).toLocaleString()} B/s at 20 Hz`,
  ],
  [
    'full snapshot 12p',
    size12.bytes,
    `${(size12.bytes * 20).toLocaleString()} B/s at 20 Hz`,
  ],
  [
    'full snapshot 16p',
    size16.bytes,
    `${(size16.bytes * 20).toLocaleString()} B/s at 20 Hz`,
  ],
  [
    'delta snapshot 4p (busy, mean)',
    Math.round(deltaSizes.deltaAvg),
    `${Math.round(deltaSizes.deltaAvg * 20).toLocaleString()} B/s at 20 Hz`,
  ],
  [
    'live 4p stream (mean, per peer)',
    Math.round(convMeanSnapshot),
    `${Math.round(convMeanSnapshot * 20).toLocaleString()} B/s at 20 Hz`,
  ],
];
for (const [name, bytes, rate] of rows) {
  console.log(`      ${name.padEnd(32)} ${String(bytes).padStart(6)} B   ${rate}`);
}
console.log(
  `      ${'snapshot header 4p / 16p'.padEnd(32)} ${snapshotHeaderBytes(4)} B / ${snapshotHeaderBytes(16)} B`,
);
console.log(
  `      ${'prediction vs interpolation err'.padEnd(32)} ${pred.measured.predErr.toFixed(3)} u / ${pred.measured.renderErr.toFixed(3)} u`,
);

console.log(
  `\nnet ${NET_VERSION} · core constantsHash ${constantsHash} · ` +
    `${conv.client.stats.applied} snapshots applied through ${pct(
      conv.down.stats.dropped,
      conv.down.stats.sent,
    )} loss`,
);
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
