// #16, first half — the kick variants.
//
// Five poses that a viewer can tell apart at broadcast distance, chosen by a
// PURE function of the core's own numbers. Nothing here decides anything: the
// core already knows how long the shot was charged, how much curve it carries
// and whether it was a keeper clearance, so the animation only has to read
// those and pick.
//
// Selection is pure on purpose. A guest renders from an interpolated snapshot
// and a host renders from readState(), and both must show the same swing for
// the same shot or the two tabs disagree about what happened. A random or
// time-seeded choice would break that quietly.
//
// The timeline every variant shares, in normalised progress u:
//
//   0.00 .. windup   plant foot lands, kicking leg swings back, torso opens
//   windup           the contact frame — this is where the ball leaves
//   windup .. 1.00   follow-through, the leg crosses the body, weight settles
//
// The contact frame is per-variant because a toe-poke and a full drive do not
// take the same time to reach the ball, and lining every variant's contact up
// on the same instant is one of the things that makes canned kicks look wrong.

import { CH_PY, CH_RX, CH_RY, CH_RZ, ch } from './pose.js';

/** Curve magnitude (core units) at which a shot reads as a deliberate bender. */
export const CURVE_THRESHOLD = 0.18;
/** Normalised charge at or above which a shot reads as a full-blooded drive. */
export const DRIVEN_CHARGE = 0.66;

/**
 * The five variants. `contact` is the normalised progress at which the boot
 * meets the ball; `seconds` is how long the whole swing takes.
 */
export const KICKS = Object.freeze({
  // a flat instant pass: barely a backlift, side of the foot, quick recovery
  pass:   { id: 'pass',   seconds: 0.34, contact: 0.38, backlift: 0.55, follow: 0.9,  open: 0.10, plant: 0.30, arm: 0.5 },
  // a dinked chip: toe under the ball, body leaning back, short follow-through
  chip:   { id: 'chip',   seconds: 0.42, contact: 0.46, backlift: 0.80, follow: 0.6,  open: 0.05, plant: 0.45, arm: 0.7 },
  // the full drive: long backlift, hard plant, the leg finishes across the body
  driven: { id: 'driven', seconds: 0.56, contact: 0.44, backlift: 1.55, follow: 1.85, open: 0.22, plant: 0.85, arm: 1.0 },
  // the bender: body opens up, the foot wraps around the ball, hip rotates last
  curler: { id: 'curler', seconds: 0.54, contact: 0.47, backlift: 1.20, follow: 1.60, open: 0.62, plant: 0.70, arm: 0.9 },
  // the keeper's clearance: leaning right back, knee high, a punt not a pass
  clear:  { id: 'clear',  seconds: 0.62, contact: 0.45, backlift: 1.70, follow: 2.05, open: 0.16, plant: 0.95, arm: 1.2 },
});

export const KICK_IDS = Object.freeze(Object.keys(KICKS));

/**
 * Pick the variant. Pure: identical arguments always give an identical id.
 *
 * @param {object} ctx
 * @param {number} ctx.charge01 charge at release, 0..1 (0 for an instant kick)
 * @param {number} ctx.curve signed curve the core stamped on the ball
 * @param {boolean} ctx.clearing true for a keeper's foot clearance
 * @returns {string} a key of KICKS
 */
export function selectKick(ctx) {
  const charge01 = Number.isFinite(ctx?.charge01) ? ctx.charge01 : 0;
  const curve = Number.isFinite(ctx?.curve) ? ctx.curve : 0;
  if (ctx?.clearing) return 'clear';
  if (charge01 <= 0) return 'pass';
  if (Math.abs(curve) >= CURVE_THRESHOLD) return 'curler';
  if (charge01 >= DRIVEN_CHARGE) return 'driven';
  return 'chip';
}

/** Which foot strikes. Right-footed by default; a curler off the left when the
 *  curve says the ball was wrapped the other way. Pure, and stable per shot. */
export function kickFoot(id, curve) {
  if (id === 'curler') return curve < 0 ? -1 : 1;
  return 1;
}

/**
 * Write a kick swing.
 *
 * @param {Float64Array} out pose to write
 * @param {string} id key of KICKS
 * @param {number} u normalised progress, 0..1
 * @param {number} foot -1 left, +1 right
 */
export function writeKick(out, id, u, foot = 1) {
  const k = KICKS[id] || KICKS.pass;
  const t = u < 0 ? 0 : u > 1 ? 1 : u;
  const c = k.contact;

  // swing: -1 fully wound back, 0 at contact, +1 at full follow-through
  let swing;
  if (t < c) {
    // ease OUT of neutral into the backlift, so the windup reads as loading
    const w = t / c;
    swing = -k.backlift * Math.sin(w * Math.PI * 0.5);
  } else {
    // ease IN through the ball: fastest exactly at contact
    const w = (t - c) / (1 - c);
    swing = k.follow * (1 - Math.cos(w * Math.PI * 0.72)) / (1 - Math.cos(Math.PI * 0.72));
  }

  const s = foot < 0 ? -1 : 1;
  const kickThigh = s < 0 ? 'thighL' : 'thighR';
  const kickKnee = s < 0 ? 'kneeL' : 'kneeR';
  const kickFootJ = s < 0 ? 'footL' : 'footR';
  const plantThigh = s < 0 ? 'thighR' : 'thighL';
  const plantKnee = s < 0 ? 'kneeR' : 'kneeL';
  const plantFootJ = s < 0 ? 'footR' : 'footL';

  // The kicking leg. rx<0 swings the leg forward in this rig, so the backlift
  // is a positive rotation and the strike is the negative sweep through it.
  out[ch(kickThigh, CH_RX)] += -swing;
  // the knee snaps straight AT contact and re-bends on the follow-through,
  // which is what actually sells the strike
  const straighten = Math.exp(-Math.pow((t - c) / 0.12, 2));
  out[ch(kickKnee, CH_RX)] += Math.max(0, swing * 0.75) + 0.55 * (1 - straighten) * (t > c ? 1 : 0.4);
  out[ch(kickFootJ, CH_RX)] += -swing * 0.28 + straighten * (id === 'chip' ? 0.55 : -0.30);
  // a curler wraps: the boot comes across the ball
  out[ch(kickThigh, CH_RZ)] += -s * k.open * (t < c ? t / c : 1) * 0.55;
  out[ch(kickFootJ, CH_RZ)] += -s * k.open * 0.8;

  // The plant leg takes the weight, bends, and holds the body up.
  const load = Math.sin(Math.min(1, t / c) * Math.PI * 0.5) * k.plant;
  out[ch(plantThigh, CH_RX)] += load * 0.28;
  out[ch(plantKnee, CH_RX)] += load * 0.42;
  out[ch(plantFootJ, CH_RX)] += -load * 0.30;
  out[ch('hips', CH_PY)] += -load * 0.055;

  // Torso: opens away from the strike on the windup, rotates through it after.
  const twist = (t < c ? -t / c : -1 + 2 * (t - c) / (1 - c)) * s;
  out[ch('hips', CH_RY)] += twist * 0.22;
  out[ch('chest', CH_RY)] += twist * 0.40;
  // a chip and a clearance both lean the body back off the ball
  const back = (id === 'chip' ? 0.30 : id === 'clear' ? 0.55 : -0.14);
  out[ch('spine', CH_RX)] += back * Math.sin(Math.min(1, t / c) * Math.PI * 0.5);
  out[ch('chest', CH_RX)] += back * 0.4;

  // Arms counterbalance: the opposite arm flies out, the near arm tucks.
  const a = k.arm;
  const nearShoulder = s < 0 ? 'shoulderL' : 'shoulderR';
  const farShoulder = s < 0 ? 'shoulderR' : 'shoulderL';
  const farElbow = s < 0 ? 'elbowR' : 'elbowL';
  out[ch(farShoulder, CH_RZ)] += -s * (0.55 + 0.35 * a) * Math.min(1, t / c);
  out[ch(farShoulder, CH_RX)] += -0.45 * a * twist;
  out[ch(farElbow, CH_RX)] += -0.5 * a;
  out[ch(nearShoulder, CH_RX)] += 0.35 * a * twist;
  out[ch(nearShoulder, CH_RZ)] += s * 0.12;
  return out;
}

/**
 * The windup held while a shot is CHARGING — a separate pose from the swing,
 * because the core lets a player hold a charge for up to CHARGE_MAX_TICKS and a
 * kick animation looping for a second and a half would look demented.
 *
 * @param {number} charge01 0..1
 */
export function writeWindup(out, charge01) {
  const c = Math.max(0, Math.min(1, charge01));
  out[ch('hips', CH_PY)] += -0.05 * c;
  out[ch('hips', CH_RX)] += 0.10 * c;
  out[ch('spine', CH_RX)] += 0.14 * c;
  out[ch('chest', CH_RY)] += -0.30 * c;
  out[ch('thighR', CH_RX)] += 0.30 * c;
  out[ch('kneeR', CH_RX)] += 0.55 * c;
  out[ch('thighL', CH_RX)] += 0.10 * c;
  out[ch('kneeL', CH_RX)] += 0.30 * c;
  out[ch('shoulderL', CH_RZ)] += 0.30 * c;
  out[ch('shoulderR', CH_RZ)] += -0.42 * c;
  out[ch('elbowL', CH_RX)] += -0.45 * c;
  out[ch('elbowR', CH_RX)] += -0.30 * c;
  return out;
}

/**
 * The slide tackle (#10's cosmetic half). One leg out straight, the body down
 * and leaning back, the trailing leg folded under.
 * @param {number} u normalised progress through the active window
 */
export function writeSlide(out, u) {
  const t = Math.max(0, Math.min(1, u));
  const down = Math.min(1, t / 0.18);          // drop fast
  const up = Math.max(0, (t - 0.72) / 0.28);   // scramble back up at the end
  const flat = down * (1 - up * up);
  out[ch('root', CH_PY)] += -0.52 * flat;
  out[ch('hips', CH_RX)] += 1.05 * flat;
  out[ch('spine', CH_RX)] += 0.25 * flat;
  out[ch('thighR', CH_RX)] += -1.45 * flat;   // tackling leg stretched out
  out[ch('kneeR', CH_RX)] += 0.08 * flat;
  out[ch('footR', CH_RX)] += -0.35 * flat;
  out[ch('thighL', CH_RX)] += 0.55 * flat;    // trailing leg folded under
  out[ch('kneeL', CH_RX)] += 1.35 * flat;
  out[ch('shoulderL', CH_RX)] += -1.5 * flat;
  out[ch('shoulderR', CH_RX)] += -0.7 * flat;
  out[ch('shoulderL', CH_RZ)] += 0.55 * flat;
  out[ch('shoulderR', CH_RZ)] += -0.35 * flat;
  return out;
}

/**
 * Stumble: the "sendeleme" the clip list asks for, played when a tackle lands
 * or a player is dispossessed. Recovers on its own, never leaves a pose behind.
 */
export function writeStumble(out, u) {
  const t = Math.max(0, Math.min(1, u));
  const env = Math.sin(t * Math.PI) * (1 - t * 0.35);
  const wob = Math.sin(t * Math.PI * 3.3);
  out[ch('root', CH_PY)] += -0.10 * env;
  out[ch('hips', CH_RX)] += 0.42 * env;
  out[ch('hips', CH_RZ)] += wob * 0.22 * env;
  out[ch('spine', CH_RX)] += 0.30 * env;
  out[ch('chest', CH_RZ)] += -wob * 0.20 * env;
  out[ch('head', CH_RX)] += 0.25 * env;
  out[ch('shoulderL', CH_RX)] += -1.1 * env + wob * 0.4 * env;
  out[ch('shoulderR', CH_RX)] += -1.1 * env - wob * 0.4 * env;
  out[ch('shoulderL', CH_RZ)] += 0.6 * env;
  out[ch('shoulderR', CH_RZ)] += -0.6 * env;
  out[ch('thighL', CH_RX)] += -0.5 * env;
  out[ch('kneeL', CH_RX)] += 0.8 * env;
  out[ch('thighR', CH_RX)] += 0.3 * env;
  out[ch('kneeR', CH_RX)] += 0.5 * env;
  return out;
}
