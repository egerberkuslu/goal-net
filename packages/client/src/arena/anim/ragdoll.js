// The knockdown ragdoll: a fast ball (or a hard tackle) flattens a player,
// who tumbles, flails, and scrambles back up.
//
// This is NOT new choreography — view/playerView.js has done this since
// before arena/anim existed, as a hand-rolled transform on the Group and its
// individual limb meshes (see the `p.down > 0` branch there). What is new is
// expressing the same read as POSE CHANNELS, which is the only form
// riggedPlayerView.js can hand to a bound GLB skeleton. The shape below is
// deliberately the same curve family playerView.js already uses (fall, hang,
// scramble-up), so a rigged player and a primitive player knocked down by the
// same hit read as the same event, not two different animations.
//
// `t` follows the same convention as writeSlide/writeStumble: 0 the instant
// the player goes down, 1 once they are fully back on their feet. The caller
// computes it from whatever "seconds down" field its core exposes (1 minus
// the remaining fraction), exactly like slide reads tackleActive.

import { CH_PY, CH_RX, CH_RY, CH_RZ, ch } from './pose.js';

/**
 * @param {Float64Array} out pose to write
 * @param {number} t 0 (just knocked down) .. 1 (back on their feet)
 * @param {number} spin a per-knockdown constant, positive or negative, that
 *   scales how hard the tumble spins the whole body. Passed through rather
 *   than randomised here, so the pose stays a pure function of its inputs —
 *   the caller (view/riggedPlayerView.js) reads it once at the moment of the
 *   knockdown and holds it steady for the rest of the fall.
 */
export function writeRagdoll(out, t, spin = 0) {
  const u = Math.max(0, Math.min(1, t));
  const fall = Math.min(u / 0.2, 1);
  const rise = Math.max(0, (u - 0.72) / 0.28);
  const flat = fall * fall * (1 - rise * rise);
  const hop = Math.sin(Math.min(u / 0.3, 1) * Math.PI) * 0.3 * (1 - u);
  const flail = Math.sin(u * 26) * 0.45 * (1 - u);
  const wind = Math.sin(u * 32 + 1.3) * 0.9 * (1 - u);

  // the whole body topples backward and lifts clear of the ground while flat
  // (a body lying flat would otherwise sink its centre into the grass)
  out[ch('root', CH_RX)] += -flat * (Math.PI / 2) * 1.04;
  out[ch('root', CH_RY)] += spin * flat;
  out[ch('root', CH_RZ)] += flail * 0.4;
  out[ch('root', CH_PY)] += hop + flat * 0.3;

  out[ch('hips', CH_RX)] += flat * 0.10;
  out[ch('spine', CH_RX)] += flat * 0.06;
  out[ch('chest', CH_RY)] += flail * 0.12;
  out[ch('head', CH_RX)] += flat * 0.20;

  // legs kick during the fall, settle spread on the grass
  out[ch('thighL', CH_RX)] += flail + flat * 0.5;
  out[ch('thighR', CH_RX)] += -flail + flat * 0.7;
  out[ch('kneeL', CH_RX)] += Math.max(0, flail) * 0.6;
  out[ch('kneeR', CH_RX)] += Math.max(0, -flail) * 0.6;
  out[ch('thighL', CH_RZ)] += flat * 0.35;
  out[ch('thighR', CH_RZ)] += -flat * 0.35;

  // arms windmill going down, settle spread on landing
  out[ch('shoulderL', CH_RX)] += -2.4 * flat + wind;
  out[ch('shoulderR', CH_RX)] += -2.4 * flat - wind;
  out[ch('shoulderL', CH_RZ)] += 0.16 + flat * 1.1 + wind * 0.3;
  out[ch('shoulderR', CH_RZ)] += -0.16 - flat * 1.1 + wind * 0.3;
  return out;
}
