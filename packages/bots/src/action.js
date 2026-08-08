// The action space: how a policy's raw output becomes a core input.
//
// Two heads, one action object, one core input. A discrete head (argmax over
// DISCRETE_ACTIONS) and a continuous head (two movement axes plus one logit per
// button) both decode to the same `Action`, and the same `toCoreInput` turns
// that into `{ moveX, moveZ, kick }` for `step()`.
//
// ------------------------------------------------------------------- frames
//
// Decoding produces an ATTACK-FRAME action, matching the observation: +z is
// always "toward the opponent goal". `egoToWorld(action, attackSign)` rotates it
// back into pitch coordinates before it reaches the core. A policy therefore
// never learns which end it is playing on, and the same weights serve both
// halves. The rotation is a 180 degree yaw, (x, z) -> (-x, -z) for team 1, the
// exact inverse of what observation.js applied.
//
// ------------------------------------------------------------------ buttons
//
// BUTTONS is deliberately longer than what packages/core reads today. Core
// currently consumes `kick` and ignores everything else; Phase 1.2 adds shot
// charge, slide tackle and the keeper's catch / clear. Those fields already
// exist on the action object and already have a slot in the continuous head and
// a place in the discrete table's modifier, so gaining them in core is a
// no-interface-change event: the bots keep emitting the same objects and the
// core simply starts reading more of them.
//
// -------------------------------------------------------- discrete table
//
// 18 actions = 1 idle + 8 directions + 1 kick-in-place + 8 direction-with-kick.
// Directions start at "forward" (toward the opponent goal) and advance
// clockwise seen from above, one octant at a time.
//
//   idx  move                 kick   note
//     0  -                    no     stand still
//     1  forward       ( 0,+1) no
//     2  forward-right (+d,+d) no    d = sqrt(1/2)
//     3  right         (+1, 0) no
//     4  back-right    (+d,-d) no
//     5  back          ( 0,-1) no
//     6  back-left     (-d,-d) no
//     7  left          (-1, 0) no
//     8  forward-left  (-d,+d) no
//     9  -                    YES    kick without moving
//    10  forward              YES
//    11  forward-right        YES
//    12  right                YES
//    13  back-right           YES
//    14  back                 YES
//    15  back-left            YES
//    16  left                 YES
//    17  forward-left         YES
//
// The table is intentionally free of charge/slide entries: mixing them in would
// multiply the head size by four for mechanics the core cannot yet execute.
// When Phase 1.2 lands they arrive as a separate small discrete head (see
// DISCRETE_MODIFIERS) rather than by renumbering these 18, so no checkpoint
// trained against this table is ever invalidated.

/** Buttons the action object can carry. Core reads `kick`; the rest are Phase 1.2. */
export const BUTTONS = Object.freeze(['kick', 'charge', 'slide', 'catch', 'clear']);

/** Optional secondary discrete head, reserved for Phase 1.2. */
export const DISCRETE_MODIFIERS = Object.freeze(['none', 'charge', 'slide', 'catch']);

const D = Math.sqrt(0.5); // 0.7071..., exact in IEEE for this input

/** The 8 compass directions in the attack frame, index 0 = forward (+z). */
export const DIRECTIONS = Object.freeze([
  Object.freeze({ name: 'forward', x: 0, z: 1 }),
  Object.freeze({ name: 'forward-right', x: D, z: D }),
  Object.freeze({ name: 'right', x: 1, z: 0 }),
  Object.freeze({ name: 'back-right', x: D, z: -D }),
  Object.freeze({ name: 'back', x: 0, z: -1 }),
  Object.freeze({ name: 'back-left', x: -D, z: -D }),
  Object.freeze({ name: 'left', x: -1, z: 0 }),
  Object.freeze({ name: 'forward-left', x: -D, z: D }),
]);

/** The canonical discrete action table, index === array position. */
export const DISCRETE_ACTIONS = Object.freeze(
  (() => {
    const table = [];
    for (const kick of [false, true]) {
      table.push(
        Object.freeze({
          index: table.length,
          label: kick ? 'kick' : 'idle',
          moveX: 0,
          moveZ: 0,
          kick,
        }),
      );
      for (const d of DIRECTIONS) {
        table.push(
          Object.freeze({
            index: table.length,
            label: kick ? `${d.name}+kick` : d.name,
            moveX: d.x,
            moveZ: d.z,
            kick,
          }),
        );
      }
    }
    return table.map(Object.freeze);
  })(),
);

/** Number of logits a discrete head must emit. */
export const DISCRETE_SIZE = DISCRETE_ACTIONS.length; // 18

/** Layout of a continuous head: 2 axes then one logit per button. */
export const CONTINUOUS_SIZE = 2 + BUTTONS.length; // 7
export const CONTINUOUS_LAYOUT = Object.freeze([
  'moveX',
  'moveZ',
  ...BUTTONS.map((b) => `${b}_logit`),
]);

/** Version tag for the action space. Bump on any table change; models pin it. */
export const ACTION_VERSION = 1;

// ------------------------------------------------------------------ actions

/** A fresh, fully-populated, all-false action. */
export function neutralAction() {
  const a = { moveX: 0, moveZ: 0 };
  for (const b of BUTTONS) a[b] = false;
  return a;
}

/**
 * Coerce anything action-shaped into a clean action: finite axes clamped to the
 * unit disc, every button a boolean, no stray keys dropped.
 */
export function normaliseAction(raw, out) {
  const a = out || neutralAction();
  let x = raw && Number.isFinite(raw.moveX) ? raw.moveX : 0;
  let z = raw && Number.isFinite(raw.moveZ) ? raw.moveZ : 0;
  if (x > 1) x = 1;
  else if (x < -1) x = -1;
  if (z > 1) z = 1;
  else if (z < -1) z = -1;
  const len = Math.sqrt(x * x + z * z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  a.moveX = x;
  a.moveZ = z;
  for (const b of BUTTONS) a[b] = !!(raw && raw[b]);
  if (raw && Number.isFinite(raw.chargeLevel)) a.chargeLevel = clamp01(raw.chargeLevel);
  return a;
}

function clamp01(v) {
  if (!(v === v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ------------------------------------------------------------------ discrete

/** Index of the largest logit; ties go to the lowest index, always. */
export function argmax(logits) {
  let best = 0;
  let bestV = -Infinity;
  for (let i = 0; i < logits.length; i++) {
    const v = logits[i];
    if (v > bestV) {
      bestV = v;
      best = i;
    }
  }
  return best;
}

/** Discrete index -> attack-frame action. */
export function decodeDiscrete(index, out) {
  const i = index | 0;
  if (!(i >= 0 && i < DISCRETE_SIZE)) {
    throw new RangeError(`decodeDiscrete: ${index} outside 0..${DISCRETE_SIZE - 1}`);
  }
  const row = DISCRETE_ACTIONS[i];
  const a = out || neutralAction();
  a.moveX = row.moveX;
  a.moveZ = row.moveZ;
  for (const b of BUTTONS) a[b] = false;
  a.kick = row.kick;
  return a;
}

/**
 * Attack-frame action -> the discrete index that decodes back to it.
 *
 * Movement snaps to the nearest of the nine cells (idle plus eight octants) by
 * dot product; anything shorter than DEADZONE counts as idle. This is exact for
 * the table's own entries, which is what makes decode/encode a round trip.
 */
export const DEADZONE = 0.25;

export function encodeDiscrete(action) {
  const x = action && Number.isFinite(action.moveX) ? action.moveX : 0;
  const z = action && Number.isFinite(action.moveZ) ? action.moveZ : 0;
  const kick = !!(action && action.kick);
  const base = kick ? 1 + DIRECTIONS.length : 0;
  const len = Math.sqrt(x * x + z * z);
  if (len < DEADZONE) return base;
  let best = 0;
  let bestDot = -Infinity;
  for (let d = 0; d < DIRECTIONS.length; d++) {
    const dot = (x * DIRECTIONS[d].x + z * DIRECTIONS[d].z) / len;
    if (dot > bestDot) {
      bestDot = dot;
      best = d;
    }
  }
  return base + 1 + best;
}

// ---------------------------------------------------------------- continuous

/**
 * Continuous head -> attack-frame action.
 * out[0], out[1] are movement axes already in [-1, 1] (a tanh head); the rest
 * are logits, pressed when strictly greater than `threshold` (0 by default,
 * i.e. sigmoid(logit) > 0.5).
 */
export function decodeContinuous(vec, opts = {}) {
  if (!vec || vec.length < CONTINUOUS_SIZE) {
    throw new RangeError(`decodeContinuous: expected ${CONTINUOUS_SIZE} values, got ${vec ? vec.length : 0}`);
  }
  const threshold = opts.threshold == null ? 0 : opts.threshold;
  const a = opts.out || neutralAction();
  normaliseAction({ moveX: vec[0], moveZ: vec[1] }, a);
  for (let b = 0; b < BUTTONS.length; b++) a[BUTTONS[b]] = vec[2 + b] > threshold;
  return a;
}

/**
 * Attack-frame action -> a canonical continuous head. Buttons become +1 / -1
 * logits, which is the representative point of each half-space and makes
 * decode(encode(a)) === a for every action the decoder can produce.
 */
export function encodeContinuous(action, out) {
  const vec = out || new Float32Array(CONTINUOUS_SIZE);
  const a = normaliseAction(action);
  vec[0] = a.moveX;
  vec[1] = a.moveZ;
  for (let b = 0; b < BUTTONS.length; b++) vec[2 + b] = a[BUTTONS[b]] ? 1 : -1;
  return vec;
}

// -------------------------------------------------------------------- frames

/**
 * Attack frame -> pitch frame. `attackSign` is +1 for team 0 (attacking +z) and
 * -1 for team 1; the transform is its own inverse.
 */
export function egoToWorld(action, attackSign, out) {
  const a = out || neutralAction();
  const s = attackSign < 0 ? -1 : 1;
  const src = action || a;
  a.moveX = s * (Number.isFinite(src.moveX) ? src.moveX : 0);
  a.moveZ = s * (Number.isFinite(src.moveZ) ? src.moveZ : 0);
  for (const b of BUTTONS) a[b] = !!src[b];
  if (Number.isFinite(src.chargeLevel)) a.chargeLevel = src.chargeLevel;
  return a;
}

/** Pitch frame -> attack frame. Same rotation, hence the same function. */
export function worldToEgo(action, attackSign, out) {
  return egoToWorld(action, attackSign, out);
}

// --------------------------------------------------------------- core input

/**
 * Action -> the object `@goalnet/core`'s `step()` / `quantiseInput()` wants.
 *
 * The extra buttons ride along untouched. `quantiseInput` reads moveX, moveZ
 * and kick and ignores the rest today; when the core learns about charge and
 * slide it will find them already present, and no call site changes.
 */
export function toCoreInput(action) {
  const a = normaliseAction(action);
  const input = { moveX: a.moveX, moveZ: a.moveZ, kick: a.kick };
  for (const b of BUTTONS) {
    if (b !== 'kick' && a[b]) input[b] = true;
  }
  if (Number.isFinite(a.chargeLevel)) input.chargeLevel = a.chargeLevel;
  return input;
}

/**
 * decodeAction(output, { head, attackSign }) -> pitch-frame action.
 * The one call a policy needs: argmax or axes, then the rotation home.
 */
export function decodeAction(output, opts = {}) {
  const head = opts.head || (output && output.length === DISCRETE_SIZE ? 'discrete' : 'continuous');
  const ego =
    head === 'discrete'
      ? decodeDiscrete(argmax(output))
      : decodeContinuous(output, { threshold: opts.threshold });
  return egoToWorld(ego, opts.attackSign == null ? 1 : opts.attackSign, opts.out);
}

/**
 * Are two actions the same to the core?
 *
 * `epsilon` defaults to exact, which is what a determinism check wants. A round
 * trip through a Float32 head is lossy by about 1e-8 on the diagonals — the
 * value the network emits is a float32 and the value the table holds is a
 * float64 — so comparisons across that boundary should pass 1e-6.
 */
export function actionsEqual(a, b, epsilon = 0) {
  if (!a || !b) return false;
  if (Math.abs(a.moveX - b.moveX) > epsilon || Math.abs(a.moveZ - b.moveZ) > epsilon) return false;
  for (const btn of BUTTONS) if (!!a[btn] !== !!b[btn]) return false;
  return true;
}
