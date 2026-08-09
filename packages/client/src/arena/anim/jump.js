// The vertical leap, for headers and for a keeper punching a high ball clear.
//
// The layer had jump/header FIELDS all along — playerView.js's ragdoll-era
// procedural code read p.jumpY and p.headerAnim directly off the core player —
// but arena/anim itself had no pose for either, so wiring a rigged character
// through PlayerAnimator lost both. This file is that pose.
//
// Two independent signals drive it, because they are independent events:
//
//   heightM   the leap itself, in metres, straight off the jumping player's
//             own vertical position. Written into the pose's root PY channel
//             at full scale (not normalised) — the same channel writeDive and
//             writeCatch already use for a small vertical offset, so a caller
//             composing the root transform (view/riggedPlayerView.js) treats
//             a jump exactly like it treats a dive: add root's PY to the
//             player's ground height, nothing more.
//   headerU   0..1 progress of the head snapping at the ball, independent of
//             how high the jump got — a header can happen near the top of a
//             standing leap or barely off the ground on a near-post flick.

import { CH_PY, CH_RX, CH_RZ, ch } from './pose.js';

/** A standing header leap reaches roughly this high; only used to shape the
 *  tuck (how much the knees pull up), never to clamp `heightM` itself. */
export const JUMP_REFERENCE_HEIGHT = 1.0;

/**
 * @param {Float64Array} out pose to write
 * @param {number} heightM current leap height, metres, 0 at the ground
 * @param {number} headerU 0..1 progress of the head-snap, 0 when not heading
 */
export function writeJump(out, heightM, headerU = 0) {
  const h = heightM > 0 ? heightM : 0;
  const lift = Math.max(0, Math.min(1, h / JUMP_REFERENCE_HEIGHT));
  const u = Math.max(0, Math.min(1, headerU));
  // one snap, fastest right at the moment the head meets the ball
  const nod = Math.sin(u * Math.PI);

  out[ch('root', CH_PY)] += h;
  // a small forward lean into the leap, more pronounced while heading
  out[ch('hips', CH_RX)] += -0.12 * lift - 0.10 * nod;
  out[ch('spine', CH_RX)] += -0.08 * lift + 0.20 * nod;
  out[ch('chest', CH_RX)] += 0.10 * nod;
  out[ch('head', CH_RX)] += 0.55 * nod;
  // both knees pull up under the body as the leap climbs, then extend to
  // meet the ball, and land with the legs ready to absorb the drop
  out[ch('thighL', CH_RX)] += -0.85 * lift * (1 - nod * 0.4);
  out[ch('kneeL', CH_RX)] += 1.15 * lift * (1 - nod * 0.5);
  out[ch('thighR', CH_RX)] += -0.55 * lift * (1 - nod * 0.4);
  out[ch('kneeR', CH_RX)] += 0.85 * lift * (1 - nod * 0.5);
  // arms drive up for balance and to protect the header
  out[ch('shoulderL', CH_RX)] += -1.35 * lift - 0.55 * nod;
  out[ch('shoulderR', CH_RX)] += -1.35 * lift - 0.55 * nod;
  out[ch('shoulderL', CH_RZ)] += 0.18 * lift;
  out[ch('shoulderR', CH_RZ)] += -0.18 * lift;
  out[ch('elbowL', CH_RX)] += -0.35 * lift;
  out[ch('elbowR', CH_RX)] += -0.35 * lift;
  return out;
}
