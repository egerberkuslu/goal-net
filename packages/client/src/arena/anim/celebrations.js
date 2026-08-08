// #16, second half — the celebrations.
//
// Five for the side that scored, two for the side that conceded, and a choice
// that is DERIVED rather than drawn.
//
// Why derived: the arena has no event channel for "who celebrates how". Every
// peer works out that a goal happened by watching the score change on state it
// already has (see arena/match.js _reactToState), so if the celebration were
// picked with Math.random the four tabs watching the same goal would each show
// a different one, and the replay would show a fifth. Hashing the facts every
// peer already agrees on — who scored, on which tick, at what score, and which
// player is reacting — gives every viewer the same answer for free, forever,
// including a replay watched a year later.
//
// The hash is the core's own fnv1a over integers, so it is the same arithmetic
// the checksum chain uses and cannot drift between engines.

import { fnv1aInts } from '../../../../core/src/index.js';
import { CH_PY, CH_PZ, CH_RX, CH_RY, CH_RZ, ch } from './pose.js';

/**
 * The scorer-side set. `seconds` is how long the whole thing runs; `loop` marks
 * the ones that read fine when the tail is repeated, which matters because the
 * arena's goal window is a fixed 2.6 s and some of these are shorter.
 */
export const CELEBRATIONS = Object.freeze([
  { id: 'armsUp',   seconds: 2.2, loop: true },  // both arms overhead, bouncing
  { id: 'kneeSlide', seconds: 2.6, loop: false }, // the classic corner-flag slide
  { id: 'pointToCrowd', seconds: 2.0, loop: true }, // one arm out, chest open
  { id: 'aeroplane', seconds: 2.4, loop: true },  // arms wide, banking run
  { id: 'fistPump', seconds: 1.8, loop: true },   // tight, furious, both fists
]);
export const CELEBRATION_IDS = Object.freeze(CELEBRATIONS.map((c) => c.id));

/** The conceding side. Two is enough: nobody watches these. */
export const DEJECTIONS = Object.freeze([
  { id: 'handsOnHips', seconds: 2.6, loop: true },
  { id: 'handsOnHead', seconds: 2.6, loop: true },
]);
export const DEJECTION_IDS = Object.freeze(DEJECTIONS.map((d) => d.id));

/**
 * Pick a celebration. Pure, and identical on every peer that saw the same goal.
 *
 * @param {object} ctx
 * @param {number} ctx.playerIndex the reacting player's slot
 * @param {number} ctx.tick the tick the score changed on
 * @param {number} ctx.scoreRed
 * @param {number} ctx.scoreBlue
 * @param {number} ctx.team the team that scored
 * @returns {string} a CELEBRATION_IDS entry
 */
export function selectCelebration(ctx) {
  const h = celebrationHash(ctx);
  return CELEBRATION_IDS[h % CELEBRATION_IDS.length];
}

/** Same contract, for the side that just conceded. */
export function selectDejection(ctx) {
  const h = celebrationHash(ctx);
  return DEJECTION_IDS[(h >>> 8) % DEJECTION_IDS.length];
}

const _seed = new Int32Array(5);

/** The shared hash. Exported so a test can prove two callers agree. */
export function celebrationHash(ctx) {
  _seed[0] = ctx?.playerIndex | 0;
  _seed[1] = ctx?.tick | 0;
  _seed[2] = ctx?.scoreRed | 0;
  _seed[3] = ctx?.scoreBlue | 0;
  _seed[4] = ctx?.team | 0;
  return fnv1aInts(_seed) >>> 0;
}

/**
 * Write a celebration pose.
 * @param {string} id one of CELEBRATION_IDS
 * @param {number} t seconds since the celebration started
 */
export function writeCelebration(out, id, t) {
  const time = t > 0 ? t : 0;
  switch (id) {
    case 'kneeSlide': return slide(out, time);
    case 'pointToCrowd': return point(out, time);
    case 'aeroplane': return aeroplane(out, time);
    case 'fistPump': return fistPump(out, time);
    case 'armsUp':
    default: return armsUp(out, time);
  }
}

/** Write a dejection pose. */
export function writeDejection(out, id, t) {
  const time = t > 0 ? t : 0;
  return id === 'handsOnHead' ? handsOnHead(out, time) : handsOnHips(out, time);
}

// ------------------------------------------------------------------ poses ---

function armsUp(out, t) {
  const hop = Math.abs(Math.sin(t * 6.2));
  const sway = Math.sin(t * 3.1);
  out[ch('root', CH_PY)] += hop * 0.26;
  out[ch('hips', CH_RZ)] += sway * 0.08;
  out[ch('spine', CH_RX)] += -0.16;
  out[ch('chest', CH_RX)] += -0.22;
  out[ch('head', CH_RX)] += -0.30;
  out[ch('shoulderL', CH_RX)] += -2.75 + sway * 0.22;
  out[ch('shoulderR', CH_RX)] += -2.75 - sway * 0.22;
  out[ch('shoulderL', CH_RZ)] += 0.34;
  out[ch('shoulderR', CH_RZ)] += -0.34;
  out[ch('elbowL', CH_RX)] += -0.25;
  out[ch('elbowR', CH_RX)] += -0.25;
  out[ch('thighL', CH_RX)] += -hop * 0.5;
  out[ch('kneeL', CH_RX)] += hop * 0.8;
  out[ch('thighR', CH_RX)] += hop * 0.3;
  out[ch('kneeR', CH_RX)] += hop * 0.5;
  return out;
}

function slide(out, t) {
  // three beats: a short run, the drop, the long skid with arms wide
  const run = Math.min(1, t / 0.45);
  const drop = Math.max(0, Math.min(1, (t - 0.45) / 0.28));
  const skid = Math.max(0, Math.min(1, (t - 0.73) / 1.2));
  const settle = 1 - skid * 0.35;
  out[ch('root', CH_PY)] += -0.46 * drop * settle;
  out[ch('root', CH_PZ)] += run * 0.4 + drop * 0.5;
  out[ch('hips', CH_RX)] += -0.55 * drop;       // leaning back onto the knees
  out[ch('spine', CH_RX)] += -0.28 * drop;
  out[ch('head', CH_RX)] += -0.35 * drop;
  out[ch('thighL', CH_RX)] += 0.35 * drop;
  out[ch('kneeL', CH_RX)] += 2.05 * drop;       // knees folded right under
  out[ch('thighR', CH_RX)] += 0.30 * drop;
  out[ch('kneeR', CH_RX)] += 1.95 * drop;
  const wide = drop * (1 - skid * 0.25);
  out[ch('shoulderL', CH_RZ)] += 1.35 * wide;
  out[ch('shoulderR', CH_RZ)] += -1.35 * wide;
  out[ch('shoulderL', CH_RX)] += -0.55 * wide;
  out[ch('shoulderR', CH_RX)] += -0.55 * wide;
  return out;
}

function point(out, t) {
  const beat = Math.sin(t * 4.4);
  out[ch('hips', CH_RY)] += 0.22;
  out[ch('chest', CH_RY)] += 0.34;
  out[ch('chest', CH_RX)] += -0.20;
  out[ch('head', CH_RY)] += 0.30;
  out[ch('head', CH_RX)] += -0.12;
  out[ch('shoulderR', CH_RX)] += -1.55 + beat * 0.30; // jabbing at the stand
  out[ch('shoulderR', CH_RZ)] += -0.55;
  out[ch('elbowR', CH_RX)] += -0.12;
  out[ch('shoulderL', CH_RX)] += 0.25;
  out[ch('shoulderL', CH_RZ)] += 0.42;
  out[ch('elbowL', CH_RX)] += -1.25;
  out[ch('root', CH_PY)] += Math.abs(beat) * 0.05;
  return out;
}

function aeroplane(out, t) {
  const bank = Math.sin(t * 2.3);
  out[ch('root', CH_PY)] += Math.abs(Math.sin(t * 5.0)) * 0.10;
  out[ch('hips', CH_RZ)] += bank * 0.20;
  out[ch('spine', CH_RX)] += -0.10;
  out[ch('chest', CH_RZ)] += bank * 0.16;
  out[ch('head', CH_RX)] += -0.22;
  out[ch('shoulderL', CH_RZ)] += 1.48;
  out[ch('shoulderR', CH_RZ)] += -1.48;
  out[ch('shoulderL', CH_RX)] += -0.20 + bank * 0.16;
  out[ch('shoulderR', CH_RX)] += -0.20 - bank * 0.16;
  const stride = Math.sin(t * 7.0);
  out[ch('thighL', CH_RX)] += -stride * 0.55;
  out[ch('thighR', CH_RX)] += stride * 0.55;
  out[ch('kneeL', CH_RX)] += Math.max(0, -stride) * 0.9;
  out[ch('kneeR', CH_RX)] += Math.max(0, stride) * 0.9;
  return out;
}

function fistPump(out, t) {
  const pump = Math.max(0, Math.sin(t * 8.4));
  out[ch('root', CH_PY)] += pump * 0.07;
  out[ch('hips', CH_RX)] += 0.16;
  out[ch('spine', CH_RX)] += 0.22;      // hunched over, coiled
  out[ch('chest', CH_RX)] += 0.10;
  out[ch('head', CH_RX)] += -0.18;
  out[ch('shoulderL', CH_RX)] += -1.05 - pump * 0.55;
  out[ch('shoulderR', CH_RX)] += -1.05 - pump * 0.55;
  out[ch('shoulderL', CH_RZ)] += 0.55;
  out[ch('shoulderR', CH_RZ)] += -0.55;
  out[ch('elbowL', CH_RX)] += -2.05;
  out[ch('elbowR', CH_RX)] += -2.05;
  out[ch('thighL', CH_RX)] += -0.20;
  out[ch('kneeL', CH_RX)] += 0.45;
  out[ch('thighR', CH_RX)] += -0.20;
  out[ch('kneeR', CH_RX)] += 0.45;
  return out;
}

function handsOnHips(out, t) {
  const breath = Math.sin(t * 1.6);
  out[ch('hips', CH_RX)] += 0.12;
  out[ch('spine', CH_RX)] += 0.26 + breath * 0.03;
  out[ch('chest', CH_RX)] += 0.16;
  out[ch('head', CH_RX)] += 0.34;      // head down
  out[ch('shoulderL', CH_RX)] += 0.30;
  out[ch('shoulderR', CH_RX)] += 0.30;
  out[ch('shoulderL', CH_RZ)] += 0.62;
  out[ch('shoulderR', CH_RZ)] += -0.62;
  out[ch('elbowL', CH_RX)] += -1.55;
  out[ch('elbowR', CH_RX)] += -1.55;
  out[ch('thighL', CH_RX)] += -0.06;
  out[ch('thighR', CH_RX)] += 0.06;
  return out;
}

function handsOnHead(out, t) {
  const breath = Math.sin(t * 1.4);
  out[ch('hips', CH_RX)] += 0.08;
  out[ch('spine', CH_RX)] += 0.14;
  out[ch('chest', CH_RX)] += 0.10 + breath * 0.03;
  out[ch('head', CH_RX)] += 0.42;
  out[ch('shoulderL', CH_RX)] += -2.35;
  out[ch('shoulderR', CH_RX)] += -2.35;
  out[ch('shoulderL', CH_RZ)] += 0.40;
  out[ch('shoulderR', CH_RZ)] += -0.40;
  out[ch('elbowL', CH_RX)] += -1.85;
  out[ch('elbowR', CH_RX)] += -1.85;
  return out;
}
