// Human input for the deterministic arena: screen intent -> core BTN bitmask.
//
// The device layer is NOT rewritten here. game/input.js already merges keyboard,
// gamepad and the on-screen touch stick into one screen-space intent, and the
// camera rig already feeds it the world basis, so this module imports those
// primitives and only does the part the arena needs: deciding which of the
// core's nine buttons are down and packing them into one int.
//
// One int is the whole point. `BTN` is what `step()` reads, what the wire
// carries (protocol.js widened the kick word into the full mask) and what a
// replay would store, so the browser never invents its own button vocabulary.
//
// ------------------------------------------------------------------ bindings
//
//   move          WASD or the arrow keys, left stick, d-pad, touch stick
//   Space / A     CHARGE while held. Release fires: a tap is the 0.3x pass, a
//                 full 800 ms hold is the 1.0x shot. One button, whole range.
//   KeyF          KICK, the instant full-impulse ground pass
//   KeyQ          CANCEL, drop a charge without firing
//   ShiftLeft/B   TACKLE, the slide
//   KeyE          TOUCH, the close-control corrective kick
//
// Keeper only (the four are refused unless this tab drives a keeper slot; the
// core would ignore them anyway, but an honest client does not send them):
//
//   KeyG          CATCH
//   KeyH          THROW      hand throw, straight
//   KeyJ          CLEAR      hold to charge the foot clearance
//   KeyR          DIVE       direction comes from the movement axis

import { BTN } from '../../../core/src/index.js';
import {
  P1_KEYS,
  P1_ALT_KEYS,
  keyboardIntent,
  mergeIntents,
  padIntent,
  readPads,
  screenToWorld,
} from '../game/input.js';

/**
 * The binding table. `codes` are KeyboardEvent.code values; `keeper` marks the
 * four buttons that only exist inside a keeper's own box.
 */
export const ARENA_BINDINGS = Object.freeze([
  Object.freeze({ name: 'charge', bit: BTN.CHARGE, codes: Object.freeze(['Space']), keeper: false }),
  Object.freeze({ name: 'kick', bit: BTN.KICK, codes: Object.freeze(['KeyF']), keeper: false }),
  Object.freeze({ name: 'cancel', bit: BTN.CANCEL, codes: Object.freeze(['KeyQ']), keeper: false }),
  Object.freeze({ name: 'tackle', bit: BTN.TACKLE, codes: Object.freeze(['ShiftLeft', 'KeyC']), keeper: false }),
  Object.freeze({ name: 'touch', bit: BTN.TOUCH, codes: Object.freeze(['KeyE']), keeper: false }),
  Object.freeze({ name: 'catch', bit: BTN.CATCH, codes: Object.freeze(['KeyG']), keeper: true }),
  Object.freeze({ name: 'throw', bit: BTN.THROW, codes: Object.freeze(['KeyH']), keeper: true }),
  Object.freeze({ name: 'clear', bit: BTN.CLEAR, codes: Object.freeze(['KeyJ']), keeper: true }),
  Object.freeze({ name: 'dive', bit: BTN.DIVE, codes: Object.freeze(['KeyR']), keeper: true }),
]);

/** Button name -> bit, for tests and HUD readouts. */
export const BUTTON_BITS = Object.freeze(
  Object.fromEntries(ARENA_BINDINGS.map((b) => [b.name, b.bit])),
);

/** Gamepad face buttons that double for the two most-used bits. */
const PAD_CHARGE = 'kick'; // padIntent() names the A/Cross button `kick`
const PAD_TACKLE = 'slide';

/**
 * Pure: held key codes -> BTN mask.
 * @param {{has:(code:string)=>boolean}} held anything Set-like
 * @param {{isKeeper?:boolean}} [opts]
 * @returns {number} the bitmask `step()` reads
 */
export function buttonsFromHeld(held, opts = {}) {
  const isKeeper = opts.isKeeper === true;
  let bits = 0;
  for (const b of ARENA_BINDINGS) {
    if (b.keeper && !isKeeper) continue;
    for (const code of b.codes) {
      if (held.has(code)) {
        bits |= b.bit;
        break;
      }
    }
  }
  return bits;
}

/**
 * Pure: BTN mask -> `{ name: boolean }`. The exact inverse of the table above,
 * so a mask can be round-tripped in a test and shown in a debug overlay.
 */
export function unpackButtons(mask) {
  const out = {};
  for (const b of ARENA_BINDINGS) out[b.name] = (mask & b.bit) !== 0;
  return out;
}

/** Pure: `{ name: boolean }` -> BTN mask. Companion to unpackButtons. */
export function packButtons(flags, opts = {}) {
  const isKeeper = opts.isKeeper === true;
  let bits = 0;
  for (const b of ARENA_BINDINGS) {
    if (b.keeper && !isKeeper) continue;
    if (flags && flags[b.name]) bits |= b.bit;
  }
  return bits;
}

/**
 * Pure: one screen-space intent plus the held keys -> the core's input object.
 * Movement is rotated into world space by the camera basis game/input.js holds,
 * exactly like the shipping game, so "up" always means "away from the camera".
 */
export function intentToInput(intent, held, opts = {}) {
  const dir = screenToWorld(intent.right || 0, intent.up || 0);
  let bits = buttonsFromHeld(held, opts);
  if (intent.kick) bits |= BTN.CHARGE; // pad A charges, matching Space
  if (intent.slide) bits |= BTN.TACKLE;
  return { moveX: dir.x, moveZ: dir.z, buttons: bits };
}

/** Keys the browser must not act on while the arena has focus. */
const PREVENT = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter',
]);

/**
 * Own the held-key set rather than reaching into game/input.js's private one:
 * the arena needs nine buttons where the shipping game needs two, and a set it
 * owns is also a set a headless test can hand over as a plain `Set`.
 * @returns {Set<string>} live set of held KeyboardEvent.code values
 */
export function installArenaKeys(target = typeof window === 'undefined' ? null : window) {
  const held = new Set();
  if (!target || typeof target.addEventListener !== 'function') return held;
  target.addEventListener('keydown', (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    held.add(e.code);
  });
  target.addEventListener('keyup', (e) => held.delete(e.code));
  target.addEventListener('blur', () => held.clear());
  return held;
}

/**
 * The live reader. `held` is the set installArenaKeys() fills from the DOM; it
 * is passed in rather than imported so a headless harness can drive the same
 * code with a plain Set.
 */
export class ArenaInput {
  /**
   * @param {{held:{has:(c:string)=>boolean}, isKeeper?:()=>boolean,
   *          gamepad?:boolean}} options
   */
  constructor(options = {}) {
    this.held = options.held;
    this.isKeeper = options.isKeeper || (() => false);
    this.useGamepad = options.gamepad !== false;
    this.last = { moveX: 0, moveZ: 0, buttons: 0 };
  }

  /** @returns {{moveX:number, moveZ:number, buttons:number}} */
  read() {
    const sources = [keyboardIntent([P1_KEYS, P1_ALT_KEYS], this.held)];
    if (this.useGamepad) {
      const pad = padIntent(readPads()[0]);
      if (pad) sources.push({ ...pad, kick: pad[PAD_CHARGE], slide: pad[PAD_TACKLE] });
    }
    const merged = mergeIntents(sources);
    this.last = intentToInput(merged, this.held, { isKeeper: this.isKeeper() });
    return this.last;
  }
}
