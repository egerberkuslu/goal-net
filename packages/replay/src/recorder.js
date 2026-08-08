// Recording a live match, from the host's chair.
//
// The host is the only peer that sees every input (netcode invariant: a peer
// authors axes and a button mask, nothing else), so the host is the only peer
// that can record. What it writes down is what it FED THE CORE — the quantised
// integers, after quantiseInput — never the floats a UI produced. A replay of
// the pre-quantisation floats would drift on the first tick where a rounding
// mode differed.
//
//   const rec = createRecorder({ world });
//   for (;;) {
//     rec.record(world.buf[HDR_TICK], inputs);   // before the step
//     const events = step(world, inputs);
//     rec.observe(events);                       // after the step
//   }
//   const container = rec.finish();
//
// `rec.tick(inputs)` does all three when the caller has nothing to add.
//
// Allocation
//   Everything per-tick lands in preallocated Int32Arrays that double when they
//   fill: three columns for the input stream (mx, mz, buttons), one for the
//   checksum chain, one flat 5-int record per mark. A 3-minute 4-player match
//   is 10800 ticks; the recorder allocates twice, not 10800 times.
//
// Keyframes
//   A serialize() snapshot every `keyframeInterval` ticks (default 600 = 10 s,
//   replay-format.md). Keyframes are an INDEX, not data: they are recomputable
//   from the inputs, so the share path drops them and the player rebuilds them
//   lazily. See player.js for the seek-cost arithmetic.
//
// Woodwork
//   The core emits goal, keeper-save and keeper-catch, but no woodwork event —
//   the posts are resolved as plain static discs. Rather than reach into the
//   core for it (out of scope, and a physics-adjacent change needs an ADR), the
//   recorder derives it here: the ball is inside post contact range and its
//   radial velocity flipped from approaching to receding across the tick. That
//   is exactly what a post bounce is, it costs four dot products a tick, and it
//   stays integer so two hosts derive the same marks.

import {
  BALL_BASE,
  CONSTANTS,
  FIELD,
  HDR_END_REASON,
  HDR_TICK,
  checksumInts,
  fnv1aInts,
  fx,
  pitchOf,
  playerOffset,
  quantiseInput,
  serialize,
  step as coreStep,
  worldSettings,
} from '../../core/src/index.js';

import {
  DEFAULT_KEYFRAME_INTERVAL,
  MARK,
  ReplayError,
  chainDigestOf,
} from './format.js';

const FX_ONE = fx.FX_ONE;
const MARK_WORDS = 5; // tick, kind, player, v0, v1

/**
 * A ball rattling along a post flips its radial sign several ticks running, and
 * a rebound off the far post half a second later is the same moment to a
 * viewer. One woodwork mark per half second is the whole of the debounce.
 */
const WOODWORK_DEBOUNCE_TICKS = 30;

/** Post contact distance plus 2 units of slack, in raw Q16.16. */
const POST_HIT_RANGE = CONSTANTS.BALL_RADIUS + CONSTANTS.POST_RADIUS + 2 * FX_ONE;

function speed100(vx, vz) {
  return Math.round((fx.fxHypot(vx, vz) * 100) / FX_ONE);
}

function units(raw) {
  return Math.round(raw / FX_ONE);
}

/**
 * createRecorder({ world, keyframeInterval, keyframes, checksums, capacityTicks })
 *
 *   world            the live world; its tick, roster and settings are the
 *                    replay header, read once at construction
 *   keyframeInterval ticks between snapshots (default 600)
 *   keyframes        false to record none (share-sized from the start)
 *   checksums        'digest' (default) folds the chain into one word;
 *                    'full' also keeps every tick, at 4 bytes each
 *   capacityTicks    initial allocation; growth is automatic
 */
export function createRecorder(options = {}) {
  const {
    world,
    keyframeInterval = DEFAULT_KEYFRAME_INTERVAL,
    keyframes: wantKeyframes = true,
    checksums: checksumMode = 'digest',
    capacityTicks = 3600,
  } = options;

  if (!world || !world.buf) throw new TypeError('createRecorder needs a live world');
  if (checksumMode !== 'digest' && checksumMode !== 'full') {
    throw new TypeError(`unknown checksum mode ${checksumMode}`);
  }
  if (keyframeInterval < 1) throw new RangeError('keyframeInterval must be at least 1 tick');

  const n = world.playerCount;
  const settings = worldSettings(world);
  const pitch = pitchOf(world);
  const startTick = world.buf[HDR_TICK];

  const roster = [];
  for (let i = 0; i < n; i++) {
    const o = playerOffset(i);
    roster.push({ team: world.buf[o + FIELD.P_TEAM], role: world.buf[o + FIELD.P_ROLE] });
  }

  let cap = Math.max(64, capacityTicks | 0);
  let mx = new Int32Array(cap * n);
  let mz = new Int32Array(cap * n);
  let btn = new Int32Array(cap * n);
  let chain = new Int32Array(cap);
  let markCap = 64;
  let markBuf = new Int32Array(markCap * MARK_WORDS);
  let markCount = 0;
  let count = 0; // ticks whose inputs are recorded
  let observed = 0; // ticks whose outcome is recorded
  const keyframes = [];

  // post geometry, raw Q16.16
  const posts = [
    [-pitch.goalHalfX, -pitch.halfZ],
    [pitch.goalHalfX, -pitch.halfZ],
    [-pitch.goalHalfX, pitch.halfZ],
    [pitch.goalHalfX, pitch.halfZ],
  ];
  let prevBx = world.buf[BALL_BASE];
  let prevBz = world.buf[BALL_BASE + 1];
  let prevVx = world.buf[BALL_BASE + 2];
  let prevVz = world.buf[BALL_BASE + 3];
  let lastToucher = -1;
  let lastWoodworkTick = -WOODWORK_DEBOUNCE_TICKS;

  function growTicks() {
    const next = cap * 2;
    const gx = new Int32Array(next * n);
    const gz = new Int32Array(next * n);
    const gb = new Int32Array(next * n);
    const gc = new Int32Array(next);
    gx.set(mx);
    gz.set(mz);
    gb.set(btn);
    gc.set(chain);
    mx = gx;
    mz = gz;
    btn = gb;
    chain = gc;
    cap = next;
  }

  function pushMark(tick, kind, player, v0 = 0, v1 = 0) {
    if (markCount === markCap) {
      markCap *= 2;
      const grown = new Int32Array(markCap * MARK_WORDS);
      grown.set(markBuf);
      markBuf = grown;
    }
    const o = markCount * MARK_WORDS;
    markBuf[o] = tick;
    markBuf[o + 1] = kind;
    markBuf[o + 2] = player;
    markBuf[o + 3] = v0 | 0;
    markBuf[o + 4] = v1 | 0;
    markCount++;
  }

  /** Distance from (x, z) to the goal `team` attacks, in whole units. */
  function distanceToGoal(x, z, team) {
    const gz = team === 0 ? pitch.halfZ : -pitch.halfZ;
    return units(fx.fxHypot(x, gz - z));
  }

  /**
   * A post bounce, derived from the ball's own numbers: close enough to touch a
   * post, approaching it before the step and leaving it after. Integer only, so
   * it is the same verdict on every machine.
   */
  function detectWoodwork(tick, buf) {
    if (tick - lastWoodworkTick < WOODWORK_DEBOUNCE_TICKS) return;
    const bx = buf[BALL_BASE];
    const bz = buf[BALL_BASE + 1];
    const vx = buf[BALL_BASE + 2];
    const vz = buf[BALL_BASE + 3];
    for (let p = 0; p < posts.length; p++) {
      const px = posts[p][0];
      const pz = posts[p][1];
      const dx = bx - px;
      const dz = bz - pz;
      if (dx > POST_HIT_RANGE || dx < -POST_HIT_RANGE) continue;
      if (dz > POST_HIT_RANGE || dz < -POST_HIT_RANGE) continue;
      if (dx * dx + dz * dz > POST_HIT_RANGE * POST_HIT_RANGE) continue;
      const before = prevVx * (prevBx - px) + prevVz * (prevBz - pz);
      const after = vx * dx + vz * dz;
      if (before < 0 && after > 0) {
        const team = lastToucher >= 0 ? roster[lastToucher].team : 0;
        pushMark(
          tick,
          MARK.WOODWORK,
          lastToucher,
          speed100(vx, vz),
          distanceToGoal(prevBx, prevBz, team),
        );
        lastWoodworkTick = tick;
        return;
      }
    }
  }

  const api = {
    get tickCount() {
      return count;
    },
    get markCount() {
      return markCount;
    },
    get keyframeCount() {
      return keyframes.length;
    },
    get startTick() {
      return startTick;
    },

    /**
     * Record the inputs about to be applied to `tick`. Must be called before
     * the step, with the tick the world is actually on: the mismatch check is
     * cheap and it turns "the host skipped a tick" into an error here instead
     * of a desync at playback.
     */
    record(tick, inputs) {
      if (tick !== world.buf[HDR_TICK]) {
        throw new ReplayError(
          'tick-order',
          `recorder was handed tick ${tick} while the world is on ${world.buf[HDR_TICK]}`,
        );
      }
      if (tick !== startTick + count) {
        throw new ReplayError(
          'tick-order',
          `recorder expected tick ${startTick + count}, got ${tick}`,
        );
      }
      if (count === cap) growTicks();
      if (wantKeyframes && (tick - startTick) % keyframeInterval === 0) {
        keyframes.push({ tick, state: serialize(world) });
      }
      const base = count * n;
      for (let i = 0; i < n; i++) {
        const q = quantiseInput(inputs && inputs[i]);
        mx[base + i] = q.mx;
        mz[base + i] = q.mz;
        btn[base + i] = q.buttons;
      }
      count++;
      return count;
    },

    /**
     * Record the outcome of the step that just ran: the checksum of the new
     * state, the marks the events imply, and the derived woodwork bounce.
     */
    observe(events) {
      if (observed >= count) {
        throw new ReplayError('tick-order', 'observe() called without a matching record()');
      }
      const buf = world.buf;
      const tick = startTick + observed; // the tick whose step just finished
      chain[observed] = fnv1aInts(buf) | 0;
      observed++;

      if (events) {
        for (let i = 0; i < events.length; i++) {
          const e = events[i];
          switch (e.type) {
            case 'touch':
              lastToucher = e.player;
              break;
            case 'goal':
              pushMark(tick, MARK.GOAL, lastToucher, e.team, 0);
              break;
            case 'keeper-save':
              pushMark(tick, MARK.SAVE, e.player, speed100(prevVx, prevVz), 0);
              break;
            case 'keeper-catch':
              pushMark(tick, MARK.CATCH, e.player, speed100(prevVx, prevVz), 0);
              break;
            case 'shot': {
              const team = roster[e.player].team;
              const o = playerOffset(e.player);
              pushMark(
                tick,
                MARK.SHOT,
                e.player,
                Math.round((e.power * 100) / FX_ONE),
                distanceToGoal(buf[o + FIELD.P_X], buf[o + FIELD.P_Z], team),
              );
              break;
            }
            case 'match-end':
              // the event carries the reason as a name; the header carries it
              // as the code, and the code is what survives a round trip
              pushMark(tick, MARK.MATCH_END, -1, buf[HDR_END_REASON], e.winner | 0);
              break;
            default:
              break;
          }
        }
      }
      detectWoodwork(tick, buf);
      prevBx = buf[BALL_BASE];
      prevBz = buf[BALL_BASE + 1];
      prevVx = buf[BALL_BASE + 2];
      prevVz = buf[BALL_BASE + 3];
      return observed;
    },

    /** record + core step + observe, for a host with nothing to interleave. */
    tick(inputs) {
      api.record(world.buf[HDR_TICK], inputs);
      const events = coreStep(world, inputs);
      api.observe(events);
      return events;
    },

    /** The per-tick checksum chain so far, as a view. Do not keep past finish(). */
    chain() {
      return chain.subarray(0, observed);
    },

    /** Hex checksum of the live world, the same digest the chain stores. */
    checksum() {
      return checksumInts(world.buf);
    },

    /** The finished container. Safe to call once; the arrays are trimmed copies. */
    finish() {
      if (observed !== count) {
        throw new ReplayError(
          'tick-order',
          `recorder holds ${count} inputs but only ${observed} outcomes; finish after the step`,
        );
      }
      const marks = [];
      for (let i = 0; i < markCount; i++) {
        const o = i * MARK_WORDS;
        marks.push({
          tick: markBuf[o],
          kind: markBuf[o + 1],
          player: markBuf[o + 2],
          v0: markBuf[o + 3],
          v1: markBuf[o + 4],
        });
      }
      return {
        settings,
        startTick,
        tickRate: CONSTANTS.TICK_RATE,
        playerCount: n,
        tickCount: count,
        roster,
        inputs: {
          mx: mx.slice(0, count * n),
          mz: mz.slice(0, count * n),
          buttons: btn.slice(0, count * n),
        },
        marks,
        keyframes: keyframes.slice(),
        keyframeInterval: wantKeyframes ? keyframeInterval : 0,
        checksums: checksumMode === 'full' ? chain.slice(0, count) : null,
        chainDigest: chainDigestOf(chain, count),
      };
    },
  };

  return api;
}
