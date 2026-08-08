// The peer half of the netcode. Runs in every tab that is not the host.
//
// It does four separable jobs and keeps them separable on purpose:
//
//   1. AUTHORITY   apply snapshots. Full ones land verbatim, deltas are
//      reconstructed against the tick they name, and every reconstruction is
//      re-checksummed against the host's own digest before it is believed.
//      Anything with a seq we have already passed is dropped: the game channel
//      is unordered and unreliable, so out-of-order arrival is normal, not an
//      error.
//
//   2. INTERPOLATION  hold roughly `interpolationMs` of authoritative history
//      and render from the past. Snapshot play time is derived from the
//      snapshot's own tick, not from its arrival time, so jitter moves the
//      buffer's fill level but never the rendered timeline. That is what makes
//      `sample()` monotone.
//
//   3. PREDICTION  re-simulate the local player forward from the newest
//      authoritative state using the inputs the host has not acknowledged yet,
//      with the same core `step`. Remote players are held at their last
//      authoritative input, which the client does not know, so prediction is
//      exact for the local slot while uncontested and self-corrects on contact.
//
//   4. RECONCILIATION  when a snapshot lands, compare what we had predicted for
//      that exact tick against what the host says. A mismatch is counted and
//      the prediction is rebuilt from authority, which is the correction.
//
// There is deliberately NO bot hook here. Bots run on the host only; a client
// authoring bot input would be authoring input for a slot it does not own, and
// the host would reject it as a spoof anyway.

import {
  step,
  deserialize,
  serialize,
  quantiseInput,
  readState,
  playerOffset,
  stateLength,
  HDR_TICK,
  HDR_PLAYER_COUNT,
  HDR_SCORE_0,
  HDR_SCORE_1,
  PLAYER_STRIDE,
  BALL_BASE,
  FIELD,
  TICK_RATE,
  BTN,
  fx,
} from '../../core/src/index.js';

// Named booleans -> the core's button bitmask. Kept here rather than in the
// protocol so the wire layer never has to know what a button means.
const BUTTON_BITS = [
  ['kick', BTN.KICK], ['charge', BTN.CHARGE], ['chargeCancel', BTN.CANCEL],
  ['tackle', BTN.TACKLE], ['catchBall', BTN.CATCH], ['throwBall', BTN.THROW],
  ['clearBall', BTN.CLEAR], ['dive', BTN.DIVE], ['touch', BTN.TOUCH],
];

function packButtons(input, kickBit) {
  let bits = kickBit ? BTN.KICK : 0;
  if (!input) return bits;
  for (const [name, bit] of BUTTON_BITS) if (input[name]) bits |= bit;
  return bits;
}

import {
  MSG_SNAPSHOT,
  MAX_MESSAGE_BYTES,
  ProtocolError,
  decodeMessage,
  applyDeltaWords,
  encodeHello,
  encodeInput,
  stateChecksumInt,
  checksumHex,
} from './protocol.js';

const FX_ONE = fx.FX_ONE;

/**
 * createClientSession(options)
 *
 *   localPlayerId   the slot this tab drives
 *   interpolationMs render delay, default 100 (netcode-p2p.md)
 *   tickRate        must match the host, default 60
 *   historyTicks    how far back a delta may base against, default 180
 *   maxMessageBytes wire ceiling, default 16000
 */
export function createClientSession(options = {}) {
  const {
    localPlayerId = 0,
    interpolationMs = 100,
    tickRate = TICK_RATE,
    historyTicks = 180,
    maxMessageBytes = MAX_MESSAGE_BYTES,
    maxBufferedSnapshots = 64,
  } = options;

  const tickMs = 1000 / tickRate;

  let authState = null; // Int32Array, newest applied authoritative state
  let authTick = -1;
  let lastSeq = -1;
  let playerCount = 0;
  let needsFull = true;
  let clockOffsetMs = null;

  const stateRing = new Map(); // tick -> Int32Array
  const buffer = []; // [{ tick, state }] ascending, the interpolation window
  const chunks = new Map(); // seq -> { parts, received, meta }

  let predicted = null; // core world
  const predHistory = new Map(); // tick -> Int32Array(PLAYER_STRIDE) local slot
  const pending = []; // [{ seq, tick, input }] inputs the host has not acked
  let inputSeq = 0;
  let helloSeq = 0;

  const stats = {
    applied: 0,
    fullsApplied: 0,
    deltasApplied: 0,
    staleDropped: 0,
    malformed: 0,
    constantsRefused: 0,
    wrongType: 0,
    missingBase: 0,
    checksumMismatches: 0,
    chunksReceived: 0,
    incompleteDropped: 0,
    desyncs: 0,
    corrections: 0,
    inputsSent: 0,
    bytesReceived: 0,
  };

  let lastChecksumMismatch = null;
  let lastDesync = null;
  let lastReceiveMs = 0;

  // ------------------------------------------------------------- prediction

  function localSlot(state) {
    const o = playerOffset(localPlayerId);
    return state.slice(o, o + PLAYER_STRIDE);
  }

  function slotsEqual(a, b) {
    if (!a || !b) return false;
    for (let i = 0; i < PLAYER_STRIDE; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function recordPrediction() {
    if (!predicted) return;
    const t = predicted.buf[HDR_TICK];
    predHistory.set(t, localSlot(predicted.buf));
    const cutoff = t - historyTicks;
    for (const k of predHistory.keys()) if (k < cutoff) predHistory.delete(k);
  }

  function stepPredicted(input) {
    const inputs = new Array(predicted.playerCount).fill(null);
    inputs[localPlayerId] = input;
    step(predicted, inputs);
    recordPrediction();
  }

  /** Rebuild the predicted world from authority and replay unacked inputs. */
  function rebuildPrediction() {
    predicted = deserialize(authState);
    predHistory.clear();
    recordPrediction();
    for (const p of pending) stepPredicted(p.input);
  }

  // ------------------------------------------------------------ apply state

  function commit(state, seq, baseTick) {
    // deserialize re-validates magic, version and constantsHash on the state
    // itself, so a delta that reconstructed into nonsense dies here.
    const world = deserialize(state);
    authState = state;
    authTick = state[HDR_TICK];
    playerCount = world.playerCount;
    lastSeq = seq;
    needsFull = false;

    stateRing.set(authTick, state);
    for (const t of stateRing.keys()) if (t < authTick - historyTicks) stateRing.delete(t);

    if (clockOffsetMs === null) clockOffsetMs = lastReceiveMs - authTick * tickMs;

    buffer.push({ tick: authTick, state });
    buffer.sort((a, b) => a.tick - b.tick);
    while (buffer.length > maxBufferedSnapshots) buffer.shift();

    stats.applied++;
    if (baseTick === -1) stats.fullsApplied++;
    else stats.deltasApplied++;
  }

  function reconcile(ackedSeq) {
    // Everything the host has consumed is no longer ours to replay.
    while (pending.length && pending[0].seq <= ackedSeq) pending.shift();

    const predictedSlot = predHistory.get(authTick);
    const authoritativeSlot = localSlot(authState);
    if (predictedSlot && !slotsEqual(predictedSlot, authoritativeSlot)) {
      stats.desyncs++;
      lastDesync = {
        tick: authTick,
        predicted: Array.from(predictedSlot),
        authoritative: Array.from(authoritativeSlot),
        dx: (predictedSlot[FIELD.P_X] - authoritativeSlot[FIELD.P_X]) / FX_ONE,
        dz: (predictedSlot[FIELD.P_Z] - authoritativeSlot[FIELD.P_Z]) / FX_ONE,
      };
    }
    rebuildPrediction();
    stats.corrections++;
  }

  /**
   * Feed one raw inbound message. Never throws; returns
   * { applied, reason } and bumps the matching counter.
   */
  function receive(data, now = 0) {
    lastReceiveMs = now;
    let msg;
    try {
      msg = decodeMessage(data, { maxMessageBytes });
    } catch (err) {
      if (err instanceof ProtocolError) {
        if (err.code === 'constants-hash') {
          stats.constantsRefused++;
          return { applied: false, reason: 'constants-hash' };
        }
        stats.malformed++;
        return { applied: false, reason: err.code };
      }
      stats.malformed++;
      return { applied: false, reason: 'malformed' };
    }
    stats.bytesReceived += data.byteLength;

    if (msg.type !== MSG_SNAPSHOT) {
      stats.wrongType++;
      return { applied: false, reason: 'wrong-type' };
    }
    // Application-level sequencing is what turns an unordered channel into a
    // usable one: a snapshot older than the one we already believe is noise.
    if (msg.seq <= lastSeq) {
      stats.staleDropped++;
      return { applied: false, reason: 'stale' };
    }

    let payload = msg.payload;
    if (msg.chunkCount > 1) {
      stats.chunksReceived++;
      let entry = chunks.get(msg.seq);
      if (!entry) {
        for (const s of chunks.keys()) {
          if (s < msg.seq) {
            chunks.delete(s);
            stats.incompleteDropped++;
          }
        }
        entry = { parts: new Array(msg.chunkCount).fill(null), received: 0, msg };
        chunks.set(msg.seq, entry);
      }
      if (entry.parts[msg.chunkIndex] === null) {
        entry.parts[msg.chunkIndex] = msg.payload;
        entry.received++;
      }
      if (entry.received < msg.chunkCount) return { applied: false, reason: 'chunk-pending' };
      chunks.delete(msg.seq);
      const joined = new Int32Array(msg.totalPayloadWords);
      let at = 0;
      for (const part of entry.parts) {
        joined.set(part, at);
        at += part.length;
      }
      if (at !== msg.totalPayloadWords) {
        stats.malformed++;
        return { applied: false, reason: 'chunk-length' };
      }
      payload = joined;
    } else if (msg.payloadWords !== msg.totalPayloadWords) {
      stats.malformed++;
      return { applied: false, reason: 'chunk-length' };
    }

    let state;
    if (msg.baseTick === -1) {
      if (payload.length !== stateLength(msg.playerCount)) {
        stats.malformed++;
        return { applied: false, reason: 'full-length' };
      }
      state = Int32Array.from(payload);
    } else {
      const base = stateRing.get(msg.baseTick);
      if (!base) {
        stats.missingBase++;
        needsFull = true;
        return { applied: false, reason: 'missing-base' };
      }
      try {
        state = applyDeltaWords(base, payload);
      } catch (err) {
        stats.malformed++;
        needsFull = true;
        return { applied: false, reason: err instanceof ProtocolError ? err.code : 'delta' };
      }
    }

    const got = stateChecksumInt(state);
    if (got !== msg.checksum) {
      stats.checksumMismatches++;
      lastChecksumMismatch = {
        tick: msg.tick,
        expected: checksumHex(msg.checksum),
        got: checksumHex(got),
      };
      needsFull = true;
      return { applied: false, reason: 'checksum' };
    }
    if (state[HDR_TICK] !== msg.tick) {
      stats.malformed++;
      return { applied: false, reason: 'tick-mismatch' };
    }

    try {
      commit(state, msg.seq, msg.baseTick);
    } catch (err) {
      stats.malformed++;
      needsFull = true;
      return { applied: false, reason: 'state-rejected' };
    }
    reconcile(msg.ackSeqs[localPlayerId] >>> 0);
    return { applied: true, reason: msg.baseTick === -1 ? 'full' : 'delta', tick: authTick };
  }

  // ------------------------------------------------------------------ input

  /**
   * Quantise, stamp and frame one local input, and advance the prediction by
   * the tick that input belongs to. Returns { buffer, seq, tick }, or null
   * before the first snapshot has landed.
   *
   * Call this exactly once per 60 Hz tick: the host consumes one queued input
   * per tick, so one send per tick is what makes replay reproduce the host.
   *
   * Refusing to send before there is authority is deliberate. An input sent
   * during the join handshake would be queued by the host and consumed at a
   * tick the client cannot know, which is a guaranteed misprediction on the
   * very first snapshot for no gain: the player is not on the pitch yet.
   */
  function sendInput(input) {
    if (!predicted) return null;
    const q = quantiseInput(input);
    // Every button the core understands rides in one bitmask; `buttons` wins
    // when given, otherwise the named booleans are packed for the caller.
    const buttons = input?.buttons !== undefined
      ? (input.buttons | 0)
      : packButtons(input, q.kick);
    const wire = { moveXFx: q.mx, moveZFx: q.mz, kick: q.kick, buttons };
    const tick = predicted.buf[HDR_TICK];
    inputSeq = (inputSeq + 1) >>> 0;
    const buf = encodeInput({
      playerId: localPlayerId,
      seq: inputSeq,
      tick,
      moveXFx: wire.moveXFx,
      moveZFx: wire.moveZFx,
      buttons,
      ackTick: authTick,
    });
    pending.push({ seq: inputSeq, tick, input: wire });
    stepPredicted(wire);
    stats.inputsSent++;
    return { buffer: buf, seq: inputSeq, tick };
  }

  /** Join, or ask for a fresh full snapshot after a reconstruction failure. */
  function hello({ wantFull = true } = {}) {
    helloSeq = (helloSeq + 1) >>> 0;
    return encodeHello({ playerId: localPlayerId, seq: helloSeq, tick: authTick, wantFull });
  }

  // --------------------------------------------------------------- sampling

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function playTime(tick) {
    return tick * tickMs + (clockOffsetMs || 0);
  }

  /**
   * Interpolated render state at wall clock `renderTime`.
   *
   * Renders `interpolationMs` in the past so there is always a snapshot on
   * either side. Returns null until the first snapshot lands. Clamps to the
   * ends of the buffer, which keeps the rendered timeline non-decreasing when
   * the buffer starves.
   */
  function sample(renderTime, { predictLocal = true } = {}) {
    if (buffer.length === 0) return null;
    const target = renderTime - interpolationMs;

    let from = buffer[0];
    let to = buffer[0];
    let alpha = 0;
    if (target <= playTime(buffer[0].tick)) {
      from = to = buffer[0];
      alpha = 0;
    } else if (target >= playTime(buffer[buffer.length - 1].tick)) {
      from = to = buffer[buffer.length - 1];
      alpha = 0;
    } else {
      for (let i = 0; i < buffer.length - 1; i++) {
        const a = playTime(buffer[i].tick);
        const b = playTime(buffer[i + 1].tick);
        if (target >= a && target <= b) {
          from = buffer[i];
          to = buffer[i + 1];
          alpha = b === a ? 0 : (target - a) / (b - a);
          break;
        }
      }
    }

    const fs = from.state;
    const ts = to.state;
    const n = fs[HDR_PLAYER_COUNT];
    const players = [];
    for (let i = 0; i < n; i++) {
      const o = playerOffset(i);
      players.push({
        index: i,
        team: fs[o + FIELD.P_TEAM],
        x: lerp(fs[o + FIELD.P_X], ts[o + FIELD.P_X], alpha) / FX_ONE,
        z: lerp(fs[o + FIELD.P_Z], ts[o + FIELD.P_Z], alpha) / FX_ONE,
        predictedLocal: false,
      });
    }

    let predictedLocal = null;
    if (predicted) {
      const o = playerOffset(localPlayerId);
      predictedLocal = {
        index: localPlayerId,
        x: predicted.buf[o + FIELD.P_X] / FX_ONE,
        z: predicted.buf[o + FIELD.P_Z] / FX_ONE,
        tick: predicted.buf[HDR_TICK],
      };
      if (predictLocal && localPlayerId < n) {
        players[localPlayerId].x = predictedLocal.x;
        players[localPlayerId].z = predictedLocal.z;
        players[localPlayerId].predictedLocal = true;
      }
    }

    return {
      renderTick: from.tick + (to.tick - from.tick) * alpha,
      fromTick: from.tick,
      toTick: to.tick,
      alpha,
      interpolating: from !== to,
      ball: {
        x: lerp(fs[BALL_BASE], ts[BALL_BASE], alpha) / FX_ONE,
        z: lerp(fs[BALL_BASE + 1], ts[BALL_BASE + 1], alpha) / FX_ONE,
      },
      score: [fs[HDR_SCORE_0], fs[HDR_SCORE_1]],
      players,
      predictedLocal,
    };
  }

  // ------------------------------------------------------------------ facade

  return {
    localPlayerId,
    interpolationMs,
    stats,
    receive,
    sendInput,
    hello,
    sample,
    get tick() {
      return authTick;
    },
    get needsFull() {
      return needsFull;
    },
    get pendingInputs() {
      return pending.length;
    },
    get bufferedSnapshots() {
      return buffer.length;
    },
    get lastChecksumMismatch() {
      return lastChecksumMismatch;
    },
    get lastDesync() {
      return lastDesync;
    },
    get predictedTick() {
      return predicted ? predicted.buf[HDR_TICK] : -1;
    },
    authoritative() {
      return authState ? Int32Array.from(authState) : null;
    },
    authoritativeChecksum() {
      return authState ? stateChecksumInt(authState) : null;
    },
    authoritativeState() {
      return authState ? readState(deserialize(authState)) : null;
    },
    predictedState() {
      return predicted ? readState(predicted) : null;
    },
    predictedSlot() {
      return predicted ? localSlot(predicted.buf) : null;
    },
    authoritativeSlot() {
      return authState ? localSlot(authState) : null;
    },
    predictedSnapshot() {
      return predicted ? serialize(predicted) : null;
    },
    /** The prediction we held for `tick`, or null if it aged out. */
    predictionAt(tick) {
      const s = predHistory.get(tick);
      return s ? Int32Array.from(s) : null;
    },
  };
}
