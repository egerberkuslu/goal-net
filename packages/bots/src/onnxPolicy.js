// An ONNX-backed BotPolicy with exactly the interface scripted.js has.
//
// This package does NOT depend on onnxruntime-web, and it never will. The
// runtime is injected:
//
//   const policy = createOnnxPolicy({
//     modelBytes,                 // Uint8Array of the .onnx file
//     runtime: {                  // anything with this shape
//       createSession(bytes, opts) -> {
//         inputNames?:  string[],
//         outputNames?: string[],
//         run(feeds) -> { [name]: { data: Float32Array } } | undefined,
//         release?(): void,
//       },
//       Tensor?: class,           // optional; a plain {data, dims, type} is
//     },                          // used when absent
//     head: 'discrete',
//     difficulty: 'zor',
//   });
//
// Why injection rather than a dependency. The core and the netcode are testable
// headlessly because nothing in them reaches for a platform; the bots have to
// keep that property. A fake runtime in the test gate proves the whole decode
// path — feeds built, output read, argmax taken, action rotated into the pitch
// frame — without a WASM binary or a network fetch, and it is the same code
// path the browser takes.
//
// ============================================================ PHASE 2 WIRING
//
// onnx-bots.md fixes the browser deployment: INT8 quantised checkpoints,
// onnxruntime-web on the WASM execution provider, inference in a Web Worker,
// decisions at ~10 Hz against a 60 Hz core. Here is exactly how that meets this
// file, and what each piece is for.
//
// 1. Assets. public/models/{kolay,orta,zor}.onnx, INT8 quantised (2-3x faster
//    than FP32 under WASM). One checkpoint per difficulty, per onnx-bots.md;
//    the difficulty is NOT a policy input, it is a different file.
//
// 2. Worker. inference.worker.js owns the session; the host thread owns this
//    policy. On boot:
//
//      import * as ort from 'onnxruntime-web';
//      ort.env.wasm.simd = true;
//      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 1;
//      const session = await ort.InferenceSession.create(bytes, {
//        executionProviders: ['wasm'],
//        graphOptimizationLevel: 'all',
//      });
//      // dummy warm-up so the first real decision is not the one that pays
//      // for lazy kernel compilation
//      await session.run({ obs: new ort.Tensor('float32', new Float32Array(OBS_SIZE), [1, OBS_SIZE]) });
//
//    CRITICAL, and the thing most likely to go wrong: numThreads > 1 needs
//    SharedArrayBuffer, which needs COOP/COEP response headers. Without them
//    onnxruntime-web silently falls back to a single thread and runs 3-4x
//    slower with no error anywhere. The headers are specified in
//    brain/20-tech-spec/netcode-p2p.md; `probeThreads()` below is the runtime
//    check that turns that silence into a log line.
//
// 3. Async meets a synchronous tick. `session.run` returns a Promise; `act()`
//    may not wait. The adapter therefore never awaits inside act:
//
//      const policy = createOnnxPolicy({ runtime: workerRuntime, head: 'discrete' });
//      worker.onmessage = (e) => policy.offerOutput(e.data.logits, e.data.requestId);
//
//    `runtime.createSession(...).run(feeds)` posts the observation to the worker
//    and returns undefined. `act()` sees no synchronous result, so it repeats
//    the action it is already holding; when the worker answers, offerOutput
//    installs the new one. A late answer is dropped by requestId, so a slow
//    frame can never make the bot act on a stale pitch.
//
// 4. Decision rate. decisionEvery defaults to 6 ticks = 10 Hz, matching
//    onnx-bots.md. Between decisions the action is held, which is also what the
//    core wants: an action is an input, and inputs persist until replaced.
//
// 5. Easy-tier latency. onnx-bots.md asks for +150-250 ms of observation delay
//    on easy. That is `observationDelayTicks`, applied here exactly as
//    scripted.js applies it, so both bot families age their view of the pitch
//    the same way and a difficulty means the same thing whoever is playing it.
//
// 6. Failure. A model that will not load, a worker that dies, a session that
//    throws: `fallback` (a scripted policy of the same difficulty) takes over
//    and `policy.stats.fallbackTicks` counts it. A match never stops because an
//    inference failed.

import { OBS_SIZE, OBSERVATION_VERSION } from './observation.js';
import {
  ACTION_VERSION,
  CONTINUOUS_SIZE,
  DISCRETE_SIZE,
  decodeAction,
  neutralAction,
  normaliseAction,
} from './action.js';
import { assertPolicy, makePrng, normaliseDifficulty } from './policy.js';

/** Ticks between inferences: 6 ticks of a 60 Hz core is the 10 Hz in the spec. */
export const DEFAULT_DECISION_EVERY = 6;

/** Observation staleness per difficulty, in ticks. Mirrors scripted.js. */
export const OBSERVATION_DELAY_TICKS = Object.freeze({ kolay: 13, orta: 6, zor: 1 });

/**
 * createOnnxPolicy(options) -> BotPolicy
 *
 *   runtime               required; { createSession(bytes, opts), Tensor? }
 *   modelBytes            passed straight to createSession
 *   head                  'discrete' (argmax over 18) | 'continuous' (7 floats)
 *   inputName/outputName  tensor names; taken from the session when it lists them
 *   decisionEvery         ticks between inferences, default 6 (10 Hz)
 *   observationDelayTicks default from the difficulty table
 *   fallback              a BotPolicy used when inference is unavailable
 *   seed                  only used by the fallback; this policy is not random
 */
export function createOnnxPolicy(options = {}) {
  const difficulty = normaliseDifficulty(options.difficulty);
  const head = options.head === 'continuous' ? 'continuous' : 'discrete';
  const expectedOutput = head === 'discrete' ? DISCRETE_SIZE : CONTINUOUS_SIZE;
  const decisionEvery = Math.max(1, options.decisionEvery == null ? DEFAULT_DECISION_EVERY : options.decisionEvery | 0);
  const delayTicks = Math.max(
    0,
    options.observationDelayTicks == null
      ? OBSERVATION_DELAY_TICKS[difficulty]
      : options.observationDelayTicks | 0,
  );
  const fallback = options.fallback || null;
  const baseSeed = options.seed == null ? 1 : options.seed >>> 0;
  const rng = makePrng(baseSeed);

  const runtime = options.runtime || null;
  let session = null;
  let sessionError = null;
  if (runtime && typeof runtime.createSession === 'function') {
    try {
      session = runtime.createSession(options.modelBytes, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
        ...(options.sessionOptions || {}),
      });
    } catch (err) {
      sessionError = err;
    }
  } else if (!fallback) {
    throw new TypeError('createOnnxPolicy needs a `runtime` with createSession(bytes) or a `fallback` policy');
  }

  const inputName =
    options.inputName || (session && session.inputNames && session.inputNames[0]) || 'obs';
  const outputName =
    options.outputName || (session && session.outputNames && session.outputNames[0]) || 'action';

  // Reusable feed buffers: an inference per bot per 6 ticks must not allocate.
  const feedData = new Float32Array(OBS_SIZE);
  const dims = [1, OBS_SIZE];

  const ringLength = delayTicks + 1;
  const ring = [];
  for (let i = 0; i < ringLength; i++) ring.push(new Float32Array(OBS_SIZE));
  let ringHead = -1;
  let ringFilled = 0;

  let held = neutralAction();
  let heldEgoValid = false;
  let countdown = 0;
  let requestId = 0;
  let pendingId = -1;
  let lastAttackSign = 1;

  const stats = {
    inferences: 0,
    decisions: 0,
    heldTicks: 0,
    fallbackTicks: 0,
    asyncPending: 0,
    droppedLate: 0,
    errors: 0,
  };

  function reset(seed) {
    rng.reset(seed == null ? baseSeed : seed >>> 0);
    ringHead = -1;
    ringFilled = 0;
    for (const r of ring) r.fill(0);
    held = neutralAction();
    heldEgoValid = false;
    countdown = 0;
    requestId = 0;
    pendingId = -1;
    stats.inferences = 0;
    stats.decisions = 0;
    stats.heldTicks = 0;
    stats.fallbackTicks = 0;
    stats.asyncPending = 0;
    stats.droppedLate = 0;
    stats.errors = 0;
    if (fallback) fallback.reset(seed == null ? baseSeed : seed);
  }

  function delayed(obs) {
    ringHead = (ringHead + 1) % ringLength;
    ring[ringHead].set(obs);
    if (ringFilled < ringLength) ringFilled++;
    const back = Math.min(delayTicks, ringFilled - 1);
    return ring[(ringHead - back + ringLength) % ringLength];
  }

  function makeTensor() {
    if (runtime && typeof runtime.Tensor === 'function') {
      return new runtime.Tensor('float32', feedData, dims);
    }
    return { type: 'float32', data: feedData, dims };
  }

  function readOutput(result) {
    if (!result) return null;
    const raw = result[outputName] !== undefined ? result[outputName] : result;
    const data = raw && raw.data !== undefined ? raw.data : raw;
    if (!data || data.length < expectedOutput) return null;
    return data;
  }

  /**
   * Install an output produced elsewhere (the worker path). `id` is the
   * requestId the runtime was given; anything older is a late answer for a
   * pitch that has moved on and is dropped.
   */
  function offerOutput(output, id) {
    if (id != null && id !== pendingId) {
      stats.droppedLate++;
      return false;
    }
    const data = readOutput(output);
    if (!data) return false;
    held = decodeAction(data, { head, attackSign: lastAttackSign });
    heldEgoValid = true;
    pendingId = -1;
    stats.decisions++;
    return true;
  }

  function infer(view) {
    if (!session || typeof session.run !== 'function') return false;
    feedData.set(view);
    requestId = (requestId + 1) | 0;
    pendingId = requestId;
    let result;
    try {
      stats.inferences++;
      result = session.run({ [inputName]: makeTensor() }, { requestId });
    } catch (err) {
      stats.errors++;
      sessionError = err;
      pendingId = -1;
      return false;
    }
    if (result === undefined) {
      // Async runtime: the worker will call offerOutput later.
      stats.asyncPending++;
      return false;
    }
    return offerOutput(result, requestId);
  }

  function act(obs, ctx) {
    lastAttackSign = ctx && ctx.attackSign != null ? ctx.attackSign : 1;
    const view = delayed(obs);

    if (countdown <= 0) {
      countdown = decisionEvery;
      infer(view);
    }
    countdown--;

    if (!heldEgoValid) {
      if (fallback) {
        stats.fallbackTicks++;
        return normaliseAction(fallback.act(obs, ctx));
      }
      // No output yet and nothing to fall back on: stand still rather than
      // invent an action.
      return held;
    }
    stats.heldTicks++;
    return held;
  }

  const policy = {
    id: options.id || `onnx-${difficulty}`,
    kind: 'onnx',
    difficulty,
    head,
    decisionEvery,
    observationDelayTicks: delayTicks,
    obsSize: OBS_SIZE,
    observationVersion: OBSERVATION_VERSION,
    actionVersion: ACTION_VERSION,
    stats,
    offerOutput,
    get ready() {
      return !!session && !sessionError;
    },
    get error() {
      return sessionError;
    },
    release() {
      if (session && typeof session.release === 'function') session.release();
      session = null;
    },
    reset,
    act,
  };
  reset(baseSeed);
  return assertPolicy(policy, `onnx(${difficulty})`);
}

/**
 * Is multi-threaded WASM actually available? Call this once at boot and log the
 * answer: a false here means COOP/COEP headers are missing and every bot is
 * about to run 3-4x slower with no other symptom.
 */
export function probeThreads(globalScope = globalThis) {
  const crossOriginIsolated = !!globalScope.crossOriginIsolated;
  const sharedArrayBuffer = typeof globalScope.SharedArrayBuffer === 'function';
  return {
    crossOriginIsolated,
    sharedArrayBuffer,
    threadsAvailable: crossOriginIsolated && sharedArrayBuffer,
    hardwareConcurrency:
      (globalScope.navigator && globalScope.navigator.hardwareConcurrency) || 1,
  };
}
