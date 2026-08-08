// The BotPolicy interface, and the glue that puts one behind a host session.
//
//   interface BotPolicy {
//     id          string   stable name, goes into replays and match reports
//     difficulty  'kolay' | 'orta' | 'zor'
//     reset(seed) void     rewind to a known state; same seed => same run
//     act(observation, ctx) -> Action    synchronous, deterministic
//   }
//
// Rules the interface imposes, all of them load-bearing
//
//   synchronous  `act` runs inside the host's 60 Hz tick. A policy that needs
//                to wait for something (an ONNX session in a worker) must serve
//                the freshest answer it already has, never block. See
//                onnxPolicy.js for how that is arranged.
//
//   deterministic  the same (seed, observation sequence) must give the same
//                action sequence, forever, on any engine. That is what makes a
//                bot match replayable from a seed instead of a per-tick input
//                log, and it is what lets the tester compare two builds.
//
//   no Math.random  ever. A policy that wants randomness owns a seeded PRNG
//                from makePrng() and rewinds it in reset(). Math.random would
//                make replays unreproducible and would couple every bot on the
//                pitch to a single hidden global.
//
//   read-only    `act` receives an observation and a context and returns an
//                action. It never touches the world, never writes to the core
//                and never reads a clock; `ctx.tick` is the only time it has.
//
// Difficulty names are Turkish because they are the strings the lobby shows:
// kolay (easy) / orta (medium) / zor (hard).

import { neutralAction, normaliseAction, toCoreInput, BUTTONS } from './action.js';
import { OBS_SIZE, observe } from './observation.js';
import { attackSignOf, createScene } from './layout.js';

export const DIFFICULTIES = Object.freeze(['kolay', 'orta', 'zor']);

/** English aliases, because onnx-bots.md writes easy/medium/hard. */
const DIFFICULTY_ALIASES = Object.freeze({
  easy: 'kolay',
  medium: 'orta',
  hard: 'zor',
  kolay: 'kolay',
  orta: 'orta',
  zor: 'zor',
});

export function normaliseDifficulty(d) {
  const key = String(d == null ? 'orta' : d).toLowerCase();
  const hit = DIFFICULTY_ALIASES[key];
  if (!hit) throw new RangeError(`unknown difficulty ${JSON.stringify(d)}; expected one of ${DIFFICULTIES.join(', ')}`);
  return hit;
}

// ---------------------------------------------------------------------- prng

/**
 * xorshift32. Small, fast, no allocation, and identical on every engine because
 * it is pure 32-bit integer arithmetic. Good enough for aim jitter; nobody is
 * running Monte Carlo on it.
 *
 * Returns a callable with `.next()` (uint32), `.float()` ([0,1)),
 * `.signed()` ([-1,1)) and `.reset(seed)`.
 */
export function makePrng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  const step = () => {
    s ^= (s << 13) >>> 0;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= (s << 5) >>> 0;
    s >>>= 0;
    return s >>> 0;
  };
  const rng = () => step();
  rng.next = step;
  rng.float = () => step() / 4294967296;
  rng.signed = () => step() / 2147483648 - 1;
  rng.reset = (nextSeed) => {
    s = (nextSeed >>> 0) || 0x9e3779b9;
  };
  return rng;
}

/** Mix a base seed with a slot index so two bots never share a stream. */
export function seedFor(seed, salt) {
  let h = ((seed >>> 0) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (salt >>> 0), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0 || 1;
}

// --------------------------------------------------------------- conformance

/**
 * Throw unless `p` satisfies the BotPolicy interface. Cheap enough to run at
 * wiring time; the test gate runs it on every policy in the package.
 */
export function assertPolicy(p, label = 'policy') {
  const fail = (why) => {
    throw new TypeError(`${label} does not satisfy BotPolicy: ${why}`);
  };
  if (!p || typeof p !== 'object') fail('not an object');
  if (typeof p.id !== 'string' || !p.id) fail('missing id');
  if (!DIFFICULTIES.includes(p.difficulty)) fail(`difficulty ${JSON.stringify(p.difficulty)} is not one of ${DIFFICULTIES.join(', ')}`);
  if (typeof p.reset !== 'function') fail('missing reset(seed)');
  if (typeof p.act !== 'function') fail('missing act(observation, ctx)');
  if (p.act.length > 2) fail('act takes more than (observation, ctx)');
  return p;
}

/** Throw unless `a` is something the core can be fed. */
export function assertAction(a, label = 'action') {
  if (!a || typeof a !== 'object') throw new TypeError(`${label} is not an object`);
  for (const k of ['moveX', 'moveZ']) {
    if (!Number.isFinite(a[k])) throw new TypeError(`${label}.${k} is not finite`);
    if (a[k] < -1 || a[k] > 1) throw new RangeError(`${label}.${k} = ${a[k]} outside [-1, 1]`);
  }
  const len = Math.sqrt(a.moveX * a.moveX + a.moveZ * a.moveZ);
  if (len > 1 + 1e-6) throw new RangeError(`${label} movement length ${len} exceeds 1`);
  for (const b of BUTTONS) {
    if (a[b] !== undefined && typeof a[b] !== 'boolean') {
      throw new TypeError(`${label}.${b} is ${typeof a[b]}, expected boolean`);
    }
  }
  return a;
}

// ------------------------------------------------------------------ runner

/**
 * createBotRunner({ policy, playerIndex, role, seed }) -> runner
 *
 * Owns the observation buffer and the scene scratch for one bot, so the host
 * allocates nothing per tick. `runner.step(world)` observes, calls the policy
 * and returns a pitch-frame action.
 */
export function createBotRunner(options = {}) {
  const { policy, playerIndex = 0, role = 'field', seed = 1 } = options;
  assertPolicy(policy, `policy for slot ${playerIndex}`);

  const obs = new Float32Array(OBS_SIZE);
  let scene = null;
  let lastAction = neutralAction();

  function ensureScene(world) {
    if (!scene || scene.playerCount !== world.playerCount) {
      scene = createScene(world.playerCount);
    }
    return scene;
  }

  policy.reset(seedFor(seed, playerIndex));

  return {
    policy,
    playerIndex,
    role,
    get observation() {
      return obs;
    },
    get lastAction() {
      return lastAction;
    },
    reset(nextSeed = seed) {
      policy.reset(seedFor(nextSeed, playerIndex));
      lastAction = neutralAction();
    },
    /** Observe the world and produce a pitch-frame action for this slot. */
    step(world, ctxExtra) {
      const s = ensureScene(world);
      observe(world, playerIndex, { out: obs, scene: s, role });
      const team = s.players[playerIndex].team;
      const ctx = {
        tick: s.tick,
        playerIndex,
        team,
        attackSign: attackSignOf(team),
        role,
        playerCount: s.playerCount,
        ...(ctxExtra || {}),
      };
      lastAction = normaliseAction(policy.act(obs, ctx));
      return lastAction;
    },
  };
}

/**
 * makeBotPolicy({ policy | policies, roles, seed }) -> hostBotPolicy
 *
 * Adapts one or more BotPolicy objects to the exact function
 * `createHostSession({ botPolicy })` calls:
 *
 *   botPolicy({ world, tick, playerIndex }) -> { moveX, moveZ, kick }
 *
 * `policies` maps a player index to a policy (or to a factory) so a 3v3 can mix
 * a keeper, a hard bot and an easy bot. `policy` is the shorthand for "this
 * brain in every bot slot".
 *
 * One instance, one slot. A BotPolicy owns per-tick state — a reaction ring, a
 * held target, a PRNG cursor — so handing the SAME object to two slots would
 * have two bots share one memory and one random stream. That is rejected here
 * rather than debugged later; to fill several slots from one configuration,
 * pass a factory `(playerIndex) => createScriptedPolicy(...)`.
 */
export function makeBotPolicy(options = {}) {
  const { policy = null, policies = null, roles = {}, seed = 1 } = options;
  if (!policy && !policies) throw new TypeError('makeBotPolicy needs `policy` or `policies`');
  const runners = new Map();
  const claimed = new Set();

  function resolve(candidate, playerIndex) {
    if (typeof candidate === 'function') return candidate(playerIndex);
    if (claimed.has(candidate)) {
      throw new TypeError(
        `policy ${candidate.id} is already driving another slot; a BotPolicy owns per-tick state, so pass a factory (playerIndex) => policy or one instance per slot`,
      );
    }
    claimed.add(candidate);
    return candidate;
  }

  function runnerFor(playerIndex) {
    let r = runners.get(playerIndex);
    if (!r) {
      const mapped =
        policies == null
          ? null
          : policies instanceof Map
            ? policies.get(playerIndex)
            : policies[playerIndex];
      const chosen = mapped || policy;
      if (!chosen) throw new RangeError(`no policy configured for slot ${playerIndex}`);
      r = createBotRunner({
        policy: resolve(chosen, playerIndex),
        playerIndex,
        role: roles[playerIndex] || 'field',
        seed,
      });
      runners.set(playerIndex, r);
    }
    return r;
  }

  const hostBotPolicy = ({ world, playerIndex }) => toCoreInput(runnerFor(playerIndex).step(world));
  hostBotPolicy.runners = runners;
  hostBotPolicy.reset = (nextSeed = seed) => {
    for (const r of runners.values()) r.reset(nextSeed);
  };
  return hostBotPolicy;
}
