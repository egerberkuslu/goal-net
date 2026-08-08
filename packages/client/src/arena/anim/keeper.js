// #15 — the keeper set.
//
// brain/10-design/goalkeeper.md fixes the mechanics and the clip list:
// a set stance, lateral shuffling, four dives plus the get-up, the catch, and
// two ways of giving the ball back (a thrown roll-out and a booted clearance).
// Every one of them is driven by a field the core already owns, because the
// keeper's rules live in packages/core and this file is not allowed an opinion.
//
//   diveActive   ticks left in the dive's active window  -> which dive, how far
//   diveDir      0..3, the four directions the core supports
//   diveLock     the whiff penalty; the keeper is on the floor -> get-up
//   ball.holder  this player is holding the ball          -> catch / carry
//   throwBall    the hand roll-out                        -> throw
//   clearCharge  the foot clearance charging              -> punt windup
//
// THE FOUR DIVES
//
// The core's diveDir is a plain index into arena/view.js's DIVE_VECTORS, which
// is [-x, +x, -z, +z]. A keeper stands on their own goal line facing up the
// pitch, so -x and +x are the two SIDEWAYS dives and -z / +z are toward and
// away from the goal. That maps onto the design's "sol/sağ alçak, sol/sağ
// uzanma" as:
//
//   0  -x  low left      a fast, flat dive along the ground
//   1  +x  low right     the mirror
//   2  -z  high smother  coming out, arms first, on top of the ball
//   3  +z  high tip-over arching backwards to claw one over the bar
//
// which is four visibly different silhouettes rather than one dive mirrored.

import { CH_PX, CH_PY, CH_PZ, CH_RX, CH_RY, CH_RZ, ch } from './pose.js';

export const DIVE_IDS = Object.freeze(['lowLeft', 'lowRight', 'smother', 'tipOver']);

/** Core diveDir -> dive id. Exported so the test can assert all four are used. */
export function diveIdOf(diveDir) {
  return DIVE_IDS[(diveDir | 0) & 3] || DIVE_IDS[0];
}

/** How far each dive throws the body, metres, and how high it gets. */
const DIVE_SHAPE = Object.freeze({
  lowLeft:  { side: -1, reach: 0.95, height: 0.30, arch: -0.15, twist: -0.55 },
  lowRight: { side: 1,  reach: 0.95, height: 0.30, arch: -0.15, twist: 0.55 },
  smother:  { side: 0,  reach: 0.70, height: 0.16, arch: 0.85,  twist: 0 },
  tipOver:  { side: 0,  reach: 0.35, height: 0.95, arch: -1.05, twist: 0 },
});

/** The keeper's set position: knees bent, feet wide, hands up and ready. */
export function writeStance(out, t, alertness = 0) {
  const a = Math.max(0, Math.min(1, alertness));
  const shift = Math.sin(t * 1.9);          // the constant small weight-shift
  const crouch = 0.14 + a * 0.10;
  out[ch('root', CH_PY)] += -crouch;
  out[ch('hips', CH_RX)] += 0.28 + a * 0.14;
  out[ch('hips', CH_RZ)] += shift * 0.05;
  out[ch('spine', CH_RX)] += 0.16;
  out[ch('chest', CH_RX)] += -0.10;
  out[ch('head', CH_RX)] += -0.16;
  // feet planted wide, knees driven out
  for (const [thigh, knee, foot, s] of [
    ['thighL', 'kneeL', 'footL', -1], ['thighR', 'kneeR', 'footR', 1],
  ]) {
    out[ch(thigh, CH_RX)] += -0.42 - a * 0.18;
    out[ch(thigh, CH_RZ)] += s * (0.20 + a * 0.06);
    out[ch(knee, CH_RX)] += 0.86 + a * 0.30;
    out[ch(foot, CH_RX)] += -0.42 - a * 0.12;
  }
  // hands up, elbows out, palms forward
  for (const [sh, el, s] of [['shoulderL', 'elbowL', -1], ['shoulderR', 'elbowR', 1]]) {
    out[ch(sh, CH_RX)] += -0.75 - a * 0.35 + shift * s * 0.05;
    out[ch(sh, CH_RZ)] += s * (0.62 + a * 0.16);
    out[ch(el, CH_RX)] += -1.35 - a * 0.20;
  }
  return out;
}

/**
 * The lateral shuffle. Feet never cross — that is the defining feature of a
 * keeper's side-step and the reason it is not just the strafe from
 * locomotion.js. The lead foot pushes out, the trail foot closes.
 *
 * @param {number} phase stride phase in turns, from the AnimClock
 * @param {number} dir -1 shuffling left, +1 shuffling right, 0 stationary
 * @param {number} intensity 0..1, scales the step size
 */
export function writeShuffle(out, phase, dir, intensity = 1) {
  const k = Math.max(0, Math.min(1, intensity));
  if (k === 0 || dir === 0) return out;
  const s = dir < 0 ? -1 : 1;
  const p = phase * Math.PI * 2;
  const push = Math.sin(p);        // lead leg drives out
  const close = Math.sin(p + Math.PI); // trail leg follows
  const lift = Math.max(0, Math.sin(p * 2));

  const leadT = s < 0 ? 'thighL' : 'thighR';
  const leadK = s < 0 ? 'kneeL' : 'kneeR';
  const leadF = s < 0 ? 'footL' : 'footR';
  const trailT = s < 0 ? 'thighR' : 'thighL';
  const trailK = s < 0 ? 'kneeR' : 'kneeL';
  const trailF = s < 0 ? 'footR' : 'footL';

  out[ch(leadT, CH_RZ)] += s * (0.14 + push * 0.24) * k;
  out[ch(leadK, CH_RX)] += (0.30 + Math.max(0, push) * 0.35) * k;
  out[ch(leadF, CH_RX)] += -0.20 * k;
  out[ch(trailT, CH_RZ)] += s * (0.02 + close * 0.20) * k;
  out[ch(trailK, CH_RX)] += (0.30 + Math.max(0, close) * 0.45) * k;
  out[ch(trailF, CH_RX)] += -0.20 * k;
  out[ch('hips', CH_PY)] += -lift * 0.035 * k;
  out[ch('hips', CH_RZ)] += -s * 0.07 * k;
  out[ch('chest', CH_RY)] += s * 0.10 * k;
  // hands stay up and travel with the body
  out[ch('shoulderL', CH_RZ)] += (0.10 - s * 0.05) * k;
  out[ch('shoulderR', CH_RZ)] += (-0.10 - s * 0.05) * k;
  return out;
}

/**
 * One of the four dives.
 * @param {string} id a DIVE_IDS entry
 * @param {number} u normalised progress through the active window, 0..1
 */
export function writeDive(out, id, u) {
  const shape = DIVE_SHAPE[id] || DIVE_SHAPE.lowLeft;
  const t = Math.max(0, Math.min(1, u));
  // launch fast, hang, then land: a sine gives the hang for free
  const launch = Math.min(1, t / 0.16);
  const air = Math.sin(Math.min(1, t) * Math.PI);
  const extend = Math.min(1, t / 0.30);
  const s = shape.side;

  out[ch('root', CH_PX)] += s * shape.reach * launch;
  out[ch('root', CH_PY)] += air * shape.height + (id === 'smother' ? -0.30 * launch : 0);
  out[ch('root', CH_PZ)] += (id === 'smother' ? shape.reach : id === 'tipOver' ? -0.25 : 0) * launch;
  // the body itself: sideways dives roll onto the flank, the smother goes flat
  // forward, the tip-over arches backwards
  out[ch('root', CH_RZ)] += -s * 1.25 * launch;
  out[ch('hips', CH_RX)] += shape.arch * launch;
  out[ch('spine', CH_RX)] += shape.arch * 0.45;
  out[ch('chest', CH_RY)] += shape.twist * extend;
  out[ch('head', CH_RX)] += -0.25 * extend;

  // both arms reach for the ball; the top arm reaches further
  const topSh = s < 0 ? 'shoulderL' : 'shoulderR';
  const botSh = s < 0 ? 'shoulderR' : 'shoulderL';
  const topEl = s < 0 ? 'elbowL' : 'elbowR';
  const botEl = s < 0 ? 'elbowR' : 'elbowL';
  if (id === 'tipOver') {
    out[ch('shoulderL', CH_RX)] += -2.95 * extend;
    out[ch('shoulderR', CH_RX)] += -2.95 * extend;
    out[ch('elbowL', CH_RX)] += -0.10 * extend;
    out[ch('elbowR', CH_RX)] += -0.10 * extend;
  } else if (id === 'smother') {
    out[ch('shoulderL', CH_RX)] += -2.55 * extend;
    out[ch('shoulderR', CH_RX)] += -2.55 * extend;
    out[ch('shoulderL', CH_RZ)] += 0.30 * extend;
    out[ch('shoulderR', CH_RZ)] += -0.30 * extend;
  } else {
    out[ch(topSh, CH_RX)] += -2.70 * extend;
    out[ch(topSh, CH_RZ)] += s * 0.30 * extend;
    out[ch(topEl, CH_RX)] += -0.12 * extend;
    out[ch(botSh, CH_RX)] += -1.60 * extend;
    out[ch(botEl, CH_RX)] += -0.55 * extend;
  }
  // trailing legs: the lower one tucks, the upper one scissors out
  const upT = s < 0 ? 'thighL' : 'thighR';
  const upK = s < 0 ? 'kneeL' : 'kneeR';
  const loT = s < 0 ? 'thighR' : 'thighL';
  const loK = s < 0 ? 'kneeR' : 'kneeL';
  out[ch(upT, CH_RX)] += -0.35 * extend;
  out[ch(upK, CH_RX)] += 0.25 * extend;
  out[ch(loT, CH_RX)] += 0.30 * extend;
  out[ch(loK, CH_RX)] += 1.05 * extend;
  return out;
}

/**
 * The get-up. Runs off diveLock, which the core sets for ~60 ticks when a dive
 * whiffs, so the keeper is visibly out of the play for exactly as long as the
 * simulation says they are — not a frame more, which would be a lie, and not a
 * frame less, which would be worse.
 *
 * @param {number} u 1 at the moment of landing, 0 when the lock expires
 */
export function writeGetUp(out, u) {
  const t = Math.max(0, Math.min(1, u));   // 1 = flat out, 0 = back on the feet
  const down = t;
  const push = Math.max(0, Math.min(1, (0.55 - t) / 0.55)); // arms drive down
  out[ch('root', CH_PY)] += -0.62 * down;
  out[ch('root', CH_RZ)] += -1.25 * down;
  out[ch('hips', CH_RX)] += 0.55 * down + push * 0.30;
  out[ch('spine', CH_RX)] += 0.30 * down;
  out[ch('head', CH_RX)] += -0.30 * down;
  out[ch('shoulderL', CH_RX)] += -1.5 * down + push * 1.1;
  out[ch('shoulderR', CH_RX)] += -1.5 * down + push * 1.1;
  out[ch('elbowL', CH_RX)] += -0.9 * down;
  out[ch('elbowR', CH_RX)] += -0.9 * down;
  out[ch('thighL', CH_RX)] += 0.4 * down - push * 0.7;
  out[ch('kneeL', CH_RX)] += 1.2 * down + push * 0.8;
  out[ch('thighR', CH_RX)] += 0.2 * down - push * 0.3;
  out[ch('kneeR', CH_RX)] += 0.9 * down + push * 0.5;
  return out;
}

/**
 * The catch, and the carry that follows it.
 *
 * The core pins the ball to the keeper for up to CATCH_MAX_TICKS and then
 * forces a clearance, so this pose has two halves: the gather (arms wrap the
 * ball in), and the hold (ball at the chest, body turned to survey the pitch).
 *
 * @param {number} holdSeconds seconds the ball has been held
 */
export function writeCatch(out, holdSeconds) {
  const gather = Math.max(0, Math.min(1, holdSeconds / 0.30));
  const scan = Math.sin(holdSeconds * 1.3);
  out[ch('root', CH_PY)] += -0.16 * (1 - gather * 0.55);
  out[ch('hips', CH_RX)] += 0.30 - gather * 0.14;
  out[ch('spine', CH_RX)] += 0.24 - gather * 0.10;
  out[ch('chest', CH_RX)] += 0.16;
  out[ch('chest', CH_RY)] += scan * 0.16 * gather;
  out[ch('head', CH_RX)] += 0.20 - gather * 0.32;
  out[ch('head', CH_RY)] += scan * 0.30 * gather;
  // arms wrap in around the chest
  for (const [sh, el, s] of [['shoulderL', 'elbowL', -1], ['shoulderR', 'elbowR', 1]]) {
    out[ch(sh, CH_RX)] += -1.05 - gather * 0.25;
    out[ch(sh, CH_RZ)] += s * (0.55 - gather * 0.34);
    out[ch(el, CH_RX)] += -1.75 - gather * 0.35;
  }
  out[ch('thighL', CH_RX)] += -0.30 + gather * 0.16;
  out[ch('kneeL', CH_RX)] += 0.62 - gather * 0.30;
  out[ch('thighR', CH_RX)] += -0.30 + gather * 0.16;
  out[ch('kneeR', CH_RX)] += 0.62 - gather * 0.30;
  return out;
}

/**
 * The hand roll-out: a low overarm throw. Contact at u = 0.55, which is where
 * the core releases the ball.
 */
export function writeThrow(out, u) {
  const t = Math.max(0, Math.min(1, u));
  const wind = Math.min(1, t / 0.55);
  const release = Math.max(0, (t - 0.55) / 0.45);
  const step = Math.sin(Math.min(1, t / 0.7) * Math.PI);
  out[ch('root', CH_PY)] += -0.10 * step;
  out[ch('hips', CH_RY)] += 0.34 * wind - 0.45 * release;
  out[ch('chest', CH_RY)] += 0.55 * wind - 0.85 * release;
  out[ch('spine', CH_RX)] += -0.20 * wind + 0.30 * release;
  out[ch('head', CH_RY)] += -0.25 * wind + 0.10 * release;
  // throwing arm goes back and over
  out[ch('shoulderR', CH_RX)] += -2.55 * wind + 2.4 * release;
  out[ch('shoulderR', CH_RZ)] += -0.35 * wind;
  out[ch('elbowR', CH_RX)] += -1.15 * wind + 1.0 * release;
  // lead arm points where it is going
  out[ch('shoulderL', CH_RX)] += -1.35 * wind - 0.2 * release;
  out[ch('shoulderL', CH_RZ)] += 0.55 * wind;
  out[ch('elbowL', CH_RX)] += -0.35;
  // a stride into the throw
  out[ch('thighL', CH_RX)] += -0.55 * step;
  out[ch('kneeL', CH_RX)] += 0.35 * step;
  out[ch('thighR', CH_RX)] += 0.35 * step;
  out[ch('kneeR', CH_RX)] += 0.65 * step;
  return out;
}

/**
 * The clearance windup, held while the core's clearCharge climbs. The strike
 * itself is the 'clear' entry in kicks.js, so the two halves are the same swing
 * a field player gets, wound up from a keeper's stance.
 */
export function writeClearWindup(out, charge01) {
  const c = Math.max(0, Math.min(1, charge01));
  out[ch('root', CH_PY)] += -0.06 * c;
  out[ch('hips', CH_RY)] += -0.24 * c;
  out[ch('chest', CH_RY)] += -0.42 * c;
  out[ch('spine', CH_RX)] += -0.22 * c;
  out[ch('head', CH_RX)] += 0.14 * c;
  out[ch('thighR', CH_RX)] += 0.55 * c;
  out[ch('kneeR', CH_RX)] += 0.95 * c;
  out[ch('thighL', CH_RX)] += -0.10 * c;
  out[ch('kneeL', CH_RX)] += 0.35 * c;
  // the ball is still in the hands, out in front, about to be dropped
  out[ch('shoulderL', CH_RX)] += -1.15 * c;
  out[ch('shoulderR', CH_RX)] += -1.15 * c;
  out[ch('shoulderL', CH_RZ)] += 0.28 * c;
  out[ch('shoulderR', CH_RZ)] += -0.28 * c;
  out[ch('elbowL', CH_RX)] += -0.75 * c;
  out[ch('elbowR', CH_RX)] += -0.75 * c;
  return out;
}
