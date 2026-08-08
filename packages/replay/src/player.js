// Playback. Deterministic by construction: the core is a pure function of
// (state, inputs), so "watching a replay" is running the recorded inputs.
//
//   const p = createPlayer(container);      // refuses a foreign build here
//   p.seek(4200);
//   p.stateAt(4260).ball;
//   p.verify();                             // chain check, loud on divergence
//
// ------------------------------------------------------------- seek and cost
//
// A seek is "restore the newest keyframe at or before the target, then step".
// With the default 600-tick cadence (10 s) the worst case is 599 steps, i.e. one
// keyframe interval of simulation for any jump in the file. The tradeoff, for a
// 3-minute 4-player match:
//
//   cadence   keyframes   bytes (496 B each)   worst-case seek
//    300 t       37           18.4 kB            299 steps
//    600 t       19            9.4 kB            599 steps
//   1800 t        7            3.5 kB           1799 steps
//
// 600 was picked because 599 steps of a 4-player world is well under a frame on
// anything that can render the match at all (measured in the test: ~0.5 ms), so
// a coarser cadence would trade bytes for nothing a user can feel, while a
// finer one doubles the index for a seek nobody perceives as faster.
//
// Keyframes are an index, not content. A container with none (the share path
// strips them) plays and seeks exactly the same; the player fills the index in
// as it walks forward, so the FIRST backward seek in a stripped replay costs a
// replay from the start and every later one costs the same 599 steps.

import {
  HDR_TICK,
  checksumInts,
  createWorld,
  deserialize,
  fnv1aInts,
  readState,
  sameSettings,
  serialize,
  step,
  toHex32,
} from '../../core/src/index.js';

import {
  DEFAULT_KEYFRAME_INTERVAL,
  ReplayError,
  chainDigestOf,
  decode,
  inputsAt,
} from './format.js';

/**
 * createPlayer(containerOrBytes, { settings, keyframeInterval })
 *
 * Bytes are decoded (and therefore validated) here; a container object is
 * assumed to have come out of decode() or a recorder in this process. Passing
 * `settings` asserts the replay belongs to the room the caller is in — the same
 * refusal deserialize() makes for a snapshot.
 */
export function createPlayer(source, options = {}) {
  const container =
    source && source.inputs && source.inputs.mx ? source : decode(source, options);

  if (options.settings !== undefined && !sameSettings(options.settings, container.settings)) {
    // a container handed in as a live object skipped decode()'s room check
    throw new ReplayError(
      'settings-hash',
      'this replay was recorded in a different room — refusing to play it',
    );
  }

  const { startTick, tickCount, playerCount } = container;
  const endTick = startTick + tickCount;
  const cadence = options.keyframeInterval || container.keyframeInterval || DEFAULT_KEYFRAME_INTERVAL;

  // tick -> Int32Array state, seeded from the file and filled in as we walk
  const index = new Map();
  const fromFile = new Map();
  for (const kf of container.keyframes) {
    index.set(kf.tick, kf.state);
    fromFile.set(kf.tick, kf.state);
  }
  if (!index.has(startTick)) {
    if (startTick !== 0) {
      throw new ReplayError(
        'no-origin',
        `replay starts at tick ${startTick} but carries no keyframe for it`,
      );
    }
    index.set(startTick, null); // null = "build a fresh kickoff world"
  }

  const scratch = new Array(playerCount);
  let world = null;

  function build(state) {
    if (state === null) {
      const w = createWorld({ players: container.roster, settings: container.settings });
      if (w.buf[HDR_TICK] !== startTick) {
        throw new ReplayError('no-origin', 'a fresh world does not start on the recorded tick');
      }
      return w;
    }
    return deserialize(state, { settings: container.settings });
  }

  function nearestKeyframe(target) {
    let best = startTick;
    for (const tick of index.keys()) {
      if (tick <= target && tick > best) best = tick;
    }
    return best;
  }

  function ensureWorld() {
    if (!world) world = build(index.get(startTick));
    return world;
  }

  const api = {
    container,
    get tick() {
      return ensureWorld().buf[HDR_TICK];
    },
    get world() {
      return ensureWorld();
    },
    get startTick() {
      return startTick;
    },
    get endTick() {
      return endTick;
    },
    get keyframeTicks() {
      return [...index.keys()].sort((a, b) => a - b);
    },

    /** Restart at the first recorded tick. */
    reset() {
      world = build(index.get(startTick));
      return api;
    },

    /**
     * Advance one tick with the recorded inputs. Returns the core's events, or
     * null once the recording runs out — playback never invents a tick.
     */
    step() {
      const w = ensureWorld();
      const t = w.buf[HDR_TICK];
      const inputs = inputsAt(container, t, scratch);
      if (inputs === null) return null;
      const events = step(w, inputs);
      const next = w.buf[HDR_TICK];
      if (next - startTick > 0 && (next - startTick) % cadence === 0 && !index.has(next)) {
        index.set(next, serialize(w));
      }
      return events;
    },

    /**
     * Move to `tick`: restore the newest keyframe at or before it and simulate
     * the remainder. Forward seeks that are already ahead of the cursor keep
     * stepping instead of rewinding.
     */
    seek(tick) {
      if (tick < startTick || tick > endTick) {
        throw new ReplayError('seek-range', `tick ${tick} is outside ${startTick}..${endTick}`);
      }
      const w = ensureWorld();
      const from = nearestKeyframe(tick);
      if (w.buf[HDR_TICK] > tick || from > w.buf[HDR_TICK]) {
        world = build(index.get(from));
      }
      let steps = 0;
      while (world.buf[HDR_TICK] < tick) {
        if (api.step() === null) break;
        steps++;
      }
      api.lastSeekSteps = steps;
      return api;
    },

    /** readState() at `tick`. Seeks first; the world is left sitting there. */
    stateAt(tick) {
      api.seek(tick);
      return readState(world);
    },

    /** Hex checksum of the state at `tick`. */
    checksumAt(tick) {
      api.seek(tick);
      return checksumInts(world.buf);
    },

    /**
     * Replay the whole recording and compare against what was recorded.
     *
     * With a full chain in the file the comparison is tick-for-tick and the
     * first divergence is named. With the default digest it is one comparison
     * at the end plus one per keyframe, which still cannot be fooled by a
     * single altered tick — it just says "somewhere at or before tick N".
     */
    verify() {
      api.reset();
      const chain = new Int32Array(tickCount);
      for (let i = 0; i < tickCount; i++) {
        if (api.step() === null) {
          return { ok: false, reason: 'short', tick: startTick + i };
        }
        chain[i] = fnv1aInts(world.buf) | 0;
        if (container.checksums && chain[i] !== container.checksums[i]) {
          return {
            ok: false,
            reason: 'checksum',
            tick: startTick + i,
            expected: toHex32(container.checksums[i] >>> 0),
            actual: toHex32(chain[i] >>> 0),
          };
        }
        const t = startTick + i + 1;
        const kf = fromFile.get(t);
        if (kf) {
          const recorded = checksumInts(kf);
          const actual = checksumInts(world.buf);
          if (recorded !== actual) {
            return { ok: false, reason: 'keyframe', tick: t, expected: recorded, actual };
          }
        }
      }
      const digest = chainDigestOf(chain, tickCount);
      if ((digest | 0) !== (container.chainDigest | 0)) {
        return {
          ok: false,
          reason: 'digest',
          tick: endTick,
          expected: toHex32(container.chainDigest >>> 0),
          actual: toHex32(digest >>> 0),
        };
      }
      return { ok: true, ticks: tickCount, digest: toHex32(digest >>> 0), chain };
    },

    /** The per-tick chain this playback produces. Allocates one Int32Array. */
    chain() {
      api.reset();
      const out = new Int32Array(tickCount);
      for (let i = 0; i < tickCount; i++) {
        api.step();
        out[i] = fnv1aInts(world.buf) | 0;
      }
      return out;
    },
  };

  api.lastSeekSteps = 0;
  return api;
}
