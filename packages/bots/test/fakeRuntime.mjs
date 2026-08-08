// A stand-in for onnxruntime-web.
//
// It is a real linear model — a fixed random weight matrix applied to the
// observation — which is enough to exercise everything the adapter is
// responsible for: feeds are built, the tensor shape is right, the output is
// read out of the named field, argmax or the axis split happens, and the action
// comes back rotated into the pitch frame. The only thing it does not do is
// play football, which is what the trained checkpoints in Phase 2 are for.
//
// Two modes, both of which the real deployment uses:
//
//   sync   run(feeds) returns the outputs. This is what a hypothetical
//          in-thread runtime looks like, and it is what the fixture is
//          recorded against.
//   async  run(feeds) returns undefined and parks the result. That is the Web
//          Worker path: the host thread gets nothing back this tick, the policy
//          holds its previous action, and `flush()` here plays the part of the
//          worker's onmessage handler calling policy.offerOutput().

import { OBS_SIZE, DISCRETE_SIZE, CONTINUOUS_SIZE, makePrng } from '../src/index.js';

/**
 * createFakeRuntime({ head, seed, async })
 *
 * The weight matrix is derived from `seed` alone, so two processes build the
 * same "model" and the recorded fixture is portable.
 */
export function createFakeRuntime(options = {}) {
  const head = options.head === 'continuous' ? 'continuous' : 'discrete';
  const outSize = head === 'discrete' ? DISCRETE_SIZE : CONTINUOUS_SIZE;
  const seed = options.seed == null ? 0x5eed : options.seed >>> 0;
  const isAsync = !!options.async;

  const rng = makePrng(seed);
  const weights = new Float32Array(outSize * OBS_SIZE);
  for (let i = 0; i < weights.length; i++) weights[i] = rng.signed();
  const bias = new Float32Array(outSize);
  for (let i = 0; i < outSize; i++) bias[i] = rng.signed() * 0.1;

  const pending = [];
  const stats = { sessions: 0, runs: 0, released: 0 };

  function forward(obs, out) {
    for (let j = 0; j < outSize; j++) {
      let acc = bias[j];
      const base = j * OBS_SIZE;
      for (let k = 0; k < OBS_SIZE; k++) acc += weights[base + k] * obs[k];
      out[j] = head === 'continuous' && j < 2 ? Math.max(-1, Math.min(1, acc)) : acc;
    }
    return out;
  }

  const runtime = {
    head,
    stats,
    createSession(bytes, opts) {
      stats.sessions++;
      const out = new Float32Array(outSize);
      return {
        bytes,
        options: opts,
        inputNames: ['obs'],
        outputNames: ['action'],
        run(feeds, meta) {
          stats.runs++;
          const tensor = feeds.obs;
          if (!tensor || !tensor.data || tensor.data.length !== OBS_SIZE) {
            throw new Error('fake runtime: bad feed shape');
          }
          if (!tensor.dims || tensor.dims[0] !== 1 || tensor.dims[1] !== OBS_SIZE) {
            throw new Error('fake runtime: bad dims');
          }
          forward(tensor.data, out);
          const result = { action: { data: Float32Array.from(out), dims: [1, outSize] } };
          if (isAsync) {
            pending.push({ result, requestId: meta && meta.requestId });
            return undefined;
          }
          return result;
        },
        release() {
          stats.released++;
        },
      };
    },
    /** Play the worker's onmessage handler: hand every parked result over. */
    flush(policy) {
      let n = 0;
      while (pending.length) {
        const p = pending.shift();
        if (policy.offerOutput(p.result, p.requestId)) n++;
      }
      return n;
    },
    pendingCount() {
      return pending.length;
    },
  };
  return runtime;
}
