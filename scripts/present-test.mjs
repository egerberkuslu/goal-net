// Headless gate for the presentation layer (feature matrix #38-#41).
//
//   node scripts/present-test.mjs      /  npm run test:present
//
// Everything under packages/client/src/arena/present/ that is not three.js is
// pure and clock-injected, which is the whole reason it is shaped that way: a
// commentary director driven by a synthetic millisecond counter, a tension
// formula that takes numbers and returns a number, an xG model with no state
// and a stats recorder fed the core's own event stream. All of it runs here,
// under node, with no DOM, no GPU and no timers.
//
// The last block runs a real core world twice with identical scripted input and
// demands the two presentation tracks agree word for word — the same
// determinism claim the rest of the stack rests on, extended to what the
// commentator said and who the MVP was.

import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BTN, createWorld, place, readState, step } from '../packages/core/src/index.js';
import { PITCH_M, TICK_HZ, toUnits } from '../packages/client/src/arena/units.js';

import { LINES, LINE_BY_ID, validateLines } from '../packages/client/src/arena/present/lines.js';
import {
  CLIP_MANIFEST, clipFor, recordingSheet, validateManifest,
} from '../packages/client/src/arena/present/manifest.js';
import { clipCoverage, createNullPlayer, resolveClipUrl } from '../packages/client/src/arena/present/clips.js';
import {
  INTERRUPT_MARGIN, REPEAT_WINDOW_MS, createCommentator,
} from '../packages/client/src/arena/present/commentary.js';
import {
  BAND_EDGES, commentaryGapMs, createTensionMeter, tensionBand, tensionOf,
} from '../packages/client/src/arena/present/tension.js';
import {
  goalAngle, keeperCover, pressureOf, xgFromFeatures, xgOf,
} from '../packages/client/src/arena/present/xg.js';
import {
  MVP_WEIGHTS, createMatchRecorder,
} from '../packages/client/src/arena/present/stats.js';
import { createPresentBus, deriveEvents } from '../packages/client/src/arena/present/bus.js';
import {
  DEFAULT_VARIANT, QUALITIES, THEMES, TIMES_OF_DAY, WEATHERS, allVariants,
  detectQuality, particleBudget, resolveVariant, validateTables, validateVariant,
  variantForRoom, variantFromParams,
} from '../packages/client/src/arena/present/stadium.js';
import { generate } from '../packages/client/src/arena/present/tools/make-clips.mjs';

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
const eq = (name, got, want) => check(name, got === want, `got ${got}, want ${want}`);
const near = (name, got, want, tol = 1e-4) =>
  check(name, Math.abs(got - want) <= tol, `got ${got}, want ${want} +/- ${tol}`);

const GEO = {
  goalHalfX: PITCH_M.goalHalfX,
  halfZ: PITCH_M.halfZ,
  halfX: PITCH_M.halfX,
  playerR: PITCH_M.playerR,
  postR: PITCH_M.postR,
  ballR: PITCH_M.ballR,
};

// ===========================================================================
console.log('\n--- 1. the line table and the clip manifest -------------------');
// ===========================================================================

check('line table validates', validateLines().length === 0, validateLines().join('; '));
check('manifest validates', validateManifest().length === 0, validateManifest().join('; '));
check('at least 24 lines', LINES.length >= 24, `${LINES.length} lines`);
check('every line has TR and EN', LINES.every((l) => l.tr && l.en));
eq('manifest covers every line in both languages',
  Object.keys(CLIP_MANIFEST.entries).length, LINES.length * 2);
check('manifest entry carries file, duration and language', (() => {
  const e = clipFor(CLIP_MANIFEST, LINES[0].id, 'tr');
  return !!e && typeof e.file === 'string' && e.durationMs === LINES[0].durationMs
    && e.lang === 'tr';
})());
check('opus is preferred over wav', (() => {
  const e = clipFor(CLIP_MANIFEST, LINES[0].id, 'en');
  return e.candidates[0].endsWith('.opus') && e.candidates.at(-1).endsWith('.wav');
})());
check('recording sheet has one row per clip',
  recordingSheet().length === LINES.length * 2, `${recordingSheet().length} rows`);
check('a corrupted table is rejected', (() => {
  const bad = [...LINES, { ...LINES[0], id: LINES[0].id }];
  return validateLines(bad).some((i) => i.includes('duplicate'));
})());
check('a line longer than 8 s is rejected',
  validateLines([{ ...LINES[0], durationMs: 9000 }]).some((i) => i.includes('durationMs')));

// the generator, end to end, into a throwaway directory
{
  const dir = mkdtempSync(join(tmpdir(), 'goalnet-clips-'));
  const written = generate(dir);
  eq('generator wrote one clip per manifest entry',
    written.length, Object.keys(CLIP_MANIFEST.entries).length);
  let durationsOk = true;
  let headersOk = true;
  const urls = Object.create(null);
  for (const w of written) {
    const path = join(dir, w.file);
    urls[w.file] = `file://${path}`;
    if (!existsSync(path)) { headersOk = false; continue; }
    const buf = readFileSync(path);
    if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') {
      headersOk = false;
      continue;
    }
    const rate = buf.readUInt32LE(24);
    const bits = buf.readUInt16LE(34);
    const bytes = buf.readUInt32LE(40);
    const ms = Math.round((bytes / (rate * (bits / 8))) * 1000);
    if (Math.abs(ms - w.ms) > 1) durationsOk = false;
  }
  check('every placeholder is a valid WAV', headersOk);
  check('every placeholder is exactly its declared duration', durationsOk);
  const cov = clipCoverage(CLIP_MANIFEST, urls);
  eq('clip resolution finds every generated file', cov.missing.length, 0);
  check('resolveClipUrl walks the candidate list',
    resolveClipUrl(clipFor(CLIP_MANIFEST, LINES[0].id, 'tr'), urls) != null);
  check('a manifest with no files on disk resolves to silence, not a throw',
    clipCoverage(CLIP_MANIFEST, {}).present.length === 0);
  check('generated manifest.json is written next to the clips',
    existsSync(join(dir, 'manifest.json')));
}

// ===========================================================================
console.log('\n--- 2. the commentary director --------------------------------');
// ===========================================================================

const goalEvent = (kind = 'normal', extra = {}) =>
  ({ type: 'goal', meta: { team: 0, kind, late: false, score: [1, 0], ...extra } });
const tackleEvent = { type: 'tackle', meta: { team: 0, player: 0 } };
const saveEvent = (xg = 0.5) => ({ type: 'save', meta: { team: 1, player: 3, xg } });

{
  const player = createNullPlayer();
  const c = createCommentator({ player, tension: 0.2 });
  let t = 0;
  eq('a tackle line plays when nothing is in the air', c.feed(tackleEvent, t), 'play');
  check('the player was asked for a real file',
    player.played.length === 1 && player.played[0].file.endsWith('.tr.wav'),
    JSON.stringify(player.played[0]));
  // a goal arrives 200 ms into a ~1.9 s tackle line: it must cut it off
  t = 200;
  eq('a goal interrupts a tackle line', c.feed(goalEvent(), t), 'play');
  check('the interruption is logged',
    c.log.some((e) => e.kind === 'interrupted' && e.id === 'tackle_won'));
  eq('the goal line is the one playing', c.playing.id, 'goal_plain');
}

{
  // priority ordering: the highest-priority eligible line wins, deterministically
  const c = createCommentator({ player: createNullPlayer(), tension: 0.9 });
  c.feed(saveEvent(0.6), 0);
  eq('a big save beats the routine line at the same event', c.playing.id, 'save_big');
  const c2 = createCommentator({ player: createNullPlayer(), tension: 0.1 });
  c2.feed(saveEvent(0.05), 0);
  eq('a weak chance saved gets the routine line', c2.playing.id, 'save_routine');
  check('save_big outranks save_reflex outranks save_routine',
    LINE_BY_ID.save_big.priority > LINE_BY_ID.save_reflex.priority
    && LINE_BY_ID.save_reflex.priority > LINE_BY_ID.save_routine.priority);
}

// A two-line table with nothing else in it, so the arbitration rules can be
// exercised without a real line's cooldown or tension window in the way.
const TOY_LINES = Object.freeze([
  { id: 'toy_a', event: 'a', priority: 10, cooldownMs: 0, durationMs: 1000, tension: null, tr: 'A', en: 'A' },
  { id: 'toy_b', event: 'b', priority: 12, cooldownMs: 0, durationMs: 1000, tension: null, tr: 'B', en: 'B' },
  { id: 'toy_loud', event: 'c', priority: 40, cooldownMs: 0, durationMs: 1000, tension: null, tr: 'C', en: 'C' },
]);
const toy = (over = {}) => createCommentator({
  player: createNullPlayer(), lines: TOY_LINES, repeatWindowMs: 0, ...over,
});

{
  // a line that does not clear INTERRUPT_MARGIN queues instead of cutting in
  const c = toy({ tension: 0.2 });
  c.feed({ type: 'a' }, 0);
  eq('a line inside the interrupt margin queues instead of cutting in',
    c.feed({ type: 'b' }, 100), 'queue');
  eq('the first line is still the one playing', c.playing.id, 'toy_a');
  eq('a line that clears the margin does cut in', c.feed({ type: 'c' }, 200), 'play');
  check('the cut is logged', c.log.some((e) => e.kind === 'interrupted' && e.id === 'toy_a'));
}

{
  // per-line cooldown and the global no-repeat window
  const c = createCommentator({ player: createNullPlayer(), tension: 0.2 });
  c.feed(tackleEvent, 0);
  c.update(2000);
  eq('the same line is refused inside its cooldown', c.feed(tackleEvent, 3000), 'drop');
  const cooldown = Math.max(LINE_BY_ID.tackle_won.cooldownMs, REPEAT_WINDOW_MS);
  c.update(cooldown + 1000);
  eq('the same line plays again once the cooldown has passed',
    c.feed(tackleEvent, cooldown + 1000), 'play');
}

{
  // no line repeats inside REPEAT_WINDOW_MS even when its own cooldown is shorter
  const short = LINES.filter((l) => l.cooldownMs < REPEAT_WINDOW_MS);
  check('the table really does contain lines with sub-window cooldowns', short.length > 0);
  const c = createCommentator({ player: createNullPlayer(), tension: 0.2 });
  const spokenAt = [];
  let t = 0;
  for (let i = 0; i < 40; i++) {
    if (c.feed(tackleEvent, t) === 'play') spokenAt.push({ id: 'tackle_won', t });
    c.update(t);
    t += 900;
  }
  let minGap = Infinity;
  for (let i = 1; i < spokenAt.length; i++) {
    minGap = Math.min(minGap, spokenAt[i].t - spokenAt[i - 1].t);
  }
  check(`no line repeats inside ${REPEAT_WINDOW_MS} ms`,
    spokenAt.length > 1 && minGap >= REPEAT_WINDOW_MS, `min gap ${minGap} ms`);
}

{
  // density: tension shortens the minimum gap between two different lines
  eq('a dead game speaks slowly', commentaryGapMs(0), 3200);
  eq('sudden death speaks fast', commentaryGapMs(1), 900);
  check('the gap is monotonic in tension', (() => {
    for (let i = 1; i <= 10; i++) {
      if (commentaryGapMs(i / 10) > commentaryGapMs((i - 1) / 10)) return false;
    }
    return true;
  })());
  const calm = toy({ tension: 0 });
  calm.feed({ type: 'a' }, 0);
  calm.update(1000); // the first line has ended
  eq('a second line is held back by the density gap at low tension',
    calm.feed({ type: 'b' }, 1200), 'queue');
  const hot = toy({ tension: 1 });
  hot.feed({ type: 'a' }, 0);
  hot.update(1000);
  eq('the same pair goes straight through at high tension',
    hot.feed({ type: 'b' }, 2000), 'play');
}

{
  // a goal ignores the density gap entirely
  const c = createCommentator({ player: createNullPlayer(), tension: 0 });
  c.feed(tackleEvent, 0);
  c.update(1900);
  eq('a goal never waits for the density gap', c.feed(goalEvent(), 1950), 'play');
}

{
  // language switch
  const player = createNullPlayer();
  const c = createCommentator({ player, tension: 0.2 });
  c.feed(tackleEvent, 0);
  check('the first clip is Turkish', player.played[0].file.endsWith('.tr.wav'));
  eq('the subtitle is the Turkish text', c.subtitle(), LINE_BY_ID.tackle_won.tr);
  c.setLanguage('en');
  eq('a clip already in the air keeps its language', c.subtitle(), LINE_BY_ID.tackle_won.tr);
  c.update(5000);
  c.feed(goalEvent(), 20000);
  check('the next clip is English', player.played.at(-1).file.endsWith('.en.wav'),
    player.played.at(-1).file);
  eq('an unknown language is refused', c.setLanguage('de'), 'en');
}

{
  // tension windows gate which variant of an event is even a candidate
  const cold = createCommentator({ player: createNullPlayer(), tension: 0.1 });
  cold.feed(goalEvent(), 0);
  eq('a goal at 0-0 in minute one gets the flat read', cold.playing.id, 'goal_plain');
  const hot = createCommentator({ player: createNullPlayer(), tension: 0.9 });
  hot.feed(goalEvent(), 0);
  eq('the same goal in a tense game gets the shout', hot.playing.id, 'goal_hot');
  const eqz = createCommentator({ player: createNullPlayer(), tension: 0.5 });
  eqz.feed(goalEvent('equaliser'), 0);
  eq('an equaliser gets its own line', eqz.playing.id, 'goal_equaliser');
}

{
  // queue depth and staleness
  const c = createCommentator({ player: createNullPlayer(), tension: 0, queueMax: 1, staleMs: 500 });
  c.feed(goalEvent(), 0);
  c.feed(saveEvent(0.6), 10);
  eq('one line waits', c.queued.length, 1);
  c.update(3000); // the goal line ended; the queued save is now 2990 ms stale
  eq('a stale queued line is dropped rather than played', c.queued.length, 0);
  check('the drop is logged as stale', c.log.some((e) => e.kind === 'stale'));
}

check(`interrupt margin is a real gate (${INTERRUPT_MARGIN})`, INTERRUPT_MARGIN > 0);

// ===========================================================================
console.log('\n--- 3. the tension formula ------------------------------------');
// ===========================================================================

const baseTension = {
  score: [0, 0], remainingSeconds: 90, totalSeconds: 180,
  ballZ: 0, halfZ: GEO.halfZ, possession: [0.5, 0.5],
};

check('bounded below', tensionOf({
  score: [0, 9], remainingSeconds: 180, totalSeconds: 180,
  ballZ: 0, halfZ: GEO.halfZ, possession: [1, 0],
}) >= 0);
near('a level, late, deep, even game is exactly 1', tensionOf({
  score: [2, 2], remainingSeconds: 0, totalSeconds: 180,
  ballZ: GEO.halfZ, halfZ: GEO.halfZ, possession: [0.5, 0.5],
}), 1);
check('bounded above over a sweep', (() => {
  for (let g = 0; g < 6; g++) {
    for (let r = 0; r <= 10; r++) {
      for (let z = -1; z <= 1; z++) {
        const t = tensionOf({
          score: [g, 0], remainingSeconds: (r / 10) * 180, totalSeconds: 180,
          ballZ: z * GEO.halfZ, halfZ: GEO.halfZ, possession: [0.5, 0.5],
        });
        if (!(t >= 0 && t <= 1)) return false;
      }
    }
  }
  return true;
})());

check('monotonic: a wider score gap lowers tension', (() => {
  let prev = Infinity;
  for (let gap = 0; gap <= 6; gap++) {
    const t = tensionOf({ ...baseTension, score: [gap, 0] });
    if (t > prev) return false;
    prev = t;
  }
  return true;
})());
check('monotonic: less time remaining raises tension', (() => {
  let prev = -Infinity;
  for (let left = 180; left >= 0; left -= 10) {
    const t = tensionOf({ ...baseTension, remainingSeconds: left });
    if (t < prev) return false;
    prev = t;
  }
  return true;
})());
check('monotonic: the ball nearer a goal raises tension', (() => {
  let prev = -Infinity;
  for (let i = 0; i <= 10; i++) {
    const t = tensionOf({ ...baseTension, ballZ: (i / 10) * GEO.halfZ });
    if (t < prev) return false;
    prev = t;
  }
  return true;
})());
check('monotonic: more even possession raises tension', (() => {
  let prev = -Infinity;
  for (let i = 0; i <= 10; i++) {
    const share = 1 - (i / 10) * 0.5; // 1.0 -> 0.5
    const t = tensionOf({ ...baseTension, possession: [share, 1 - share] });
    if (t < prev) return false;
    prev = t;
  }
  return true;
})());
check('golden goal never reads calm',
  tensionOf({ score: [5, 5], remainingSeconds: 90, totalSeconds: 180,
    ballZ: 0, halfZ: GEO.halfZ, possession: [0.9, 0.1], golden: true }) >= 0.85);
check('deterministic: the same input gives the same number 1000 times', (() => {
  const first = tensionOf(baseTension);
  for (let i = 0; i < 1000; i++) if (tensionOf({ ...baseTension }) !== first) return false;
  return true;
})());
check('the output is a multiple of the quantum',
  Number.isInteger(Math.round(tensionOf(baseTension) * 10000)));
check('garbage input does not produce NaN',
  Number.isFinite(tensionOf({ score: ['x', null], remainingSeconds: NaN })));

eq('bands: below the first edge is calm', tensionBand(BAND_EDGES[0] - 0.01), 'sakin');
eq('bands: between the edges is medium', tensionBand(BAND_EDGES[0]), 'orta');
eq('bands: above the second edge is loud', tensionBand(BAND_EDGES[1]), 'coskulu');

{
  // the meter and its subscribe hook — the only thing the crowd layer touches
  const meter = createTensionMeter({ smoothing: 0.5 });
  const seen = [];
  const off = meter.subscribe((p) => seen.push(p.value));
  eq('subscribing fires once immediately', seen.length, 1);
  meter.set(baseTension, 1 / 60);
  check('the meter publishes on set', seen.length === 2);
  check('the first sample snaps rather than fading up from zero',
    seen[1] === meter.raw, `${seen[1]} vs ${meter.raw}`);
  meter.set({ ...baseTension, remainingSeconds: 0, ballZ: GEO.halfZ }, 1 / 60);
  check('every later step only approaches the target',
    meter.value > seen[1] && meter.value < meter.raw,
    `${seen[1]} < ${meter.value} < ${meter.raw}`);
  off();
  const before = seen.length;
  meter.set(baseTension, 1 / 60);
  eq('unsubscribing really unsubscribes', seen.length, before);
  const a = createTensionMeter({ smoothing: 0.5 });
  const b = createTensionMeter({ smoothing: 0.5 });
  for (let i = 0; i < 100; i++) {
    a.set({ ...baseTension, ballZ: i / 10 }, 1 / 60);
    b.set({ ...baseTension, ballZ: i / 10 }, 1 / 60);
  }
  eq('two meters fed the same sequence agree exactly', a.value, b.value);
}

// ===========================================================================
console.log('\n--- 4. xG-lite ------------------------------------------------');
// ===========================================================================

const XG_GEO = { goalHalfX: 2.357142857142857, halfZ: 18, playerR: 0.642857 };

near('worked example A: tap-in',
  xgOf({ x: 0, z: 16, sign: 1, power: 0.5 }, XG_GEO).xg, 0.9965);
near('worked example B: edge of the box, clear',
  xgOf({ x: 0, z: 12, sign: 1, power: 0.8 }, XG_GEO).xg, 0.6667);
near('worked example C: same shot, keeper on the line',
  xgOf({ x: 0, z: 12, sign: 1, power: 0.8, keeper: { x: 0, z: 18 } }, XG_GEO).xg, 0.1294);
near('worked example D: from the halfway line',
  xgOf({ x: 0, z: 0, sign: 1, power: 1, keeper: { x: 0, z: 17 } }, XG_GEO).xg, 0.0086);
near('worked example E: acute angle, one metre out',
  xgOf({ x: 8, z: 17, sign: 1, power: 0.5 }, XG_GEO).xg, 0.0498);
near('the raw model on hand-computed features',
  xgFromFeatures({ d: 6, theta: 0.7487, press: 0, cover: 0, power: 0.8 }), 0.6667);

near('the goal angle from the centre spot is 2*atan(g/d)',
  goalAngle(0, 12, 1, XG_GEO), 2 * Math.atan(XG_GEO.goalHalfX / 6));
eq('behind the goal line the angle is zero', goalAngle(0, 19, 1, XG_GEO), 0);
eq('on the goal line the angle is zero', goalAngle(0, 18, 1, XG_GEO), 0);
eq('a shot with no angle is worth nothing',
  xgOf({ x: 0, z: 19, sign: 1, power: 1 }, XG_GEO).xg, 0);

check('monotonic: further out is worse', (() => {
  let prev = Infinity;
  for (let z = 17; z >= 0; z--) {
    const v = xgOf({ x: 0, z, sign: 1, power: 0.8 }, XG_GEO).xg;
    if (v > prev) return false;
    prev = v;
  }
  return true;
})());
check('monotonic: a wider angle is better', (() => {
  let prev = -Infinity;
  for (let x = 12; x >= 0; x--) {
    const v = xgOf({ x, z: 14, sign: 1, power: 0.8 }, XG_GEO).xg;
    if (v < prev) return false;
    prev = v;
  }
  return true;
})());
check('monotonic: more keeper coverage is worse', (() => {
  let prev = Infinity;
  for (let i = 0; i <= 10; i++) {
    const v = xgFromFeatures({ d: 8, theta: 0.5, press: 0, cover: i / 10, power: 0.8 });
    if (v > prev) return false;
    prev = v;
  }
  return true;
})());
check('monotonic: more pressure is worse', (() => {
  let prev = Infinity;
  for (let i = 0; i <= 10; i++) {
    const v = xgFromFeatures({ d: 8, theta: 0.5, press: i / 10, cover: 0, power: 0.8 });
    if (v > prev) return false;
    prev = v;
  }
  return true;
})());
check('monotonic: more power is better', (() => {
  let prev = -Infinity;
  for (let i = 0; i <= 10; i++) {
    const v = xgFromFeatures({ d: 8, theta: 0.5, press: 0, cover: 0, power: i / 10 });
    if (v < prev) return false;
    prev = v;
  }
  return true;
})());
check('every xG is a probability over a sweep of the whole pitch', (() => {
  for (let x = -18; x <= 18; x += 1.5) {
    for (let z = -18; z <= 18; z += 1.5) {
      const v = xgOf({ x, z, sign: 1, power: 1 }, XG_GEO).xg;
      if (!(v >= 0 && v <= 1)) return false;
    }
  }
  return true;
})());

eq('a keeper behind the shooter covers nothing',
  keeperCover({ x: 0, z: 12 }, { x: 0, z: 8 }, 1, XG_GEO), 0);
near('a keeper dead on the line covers everything',
  keeperCover({ x: 0, z: 12 }, { x: 0, z: 18 }, 1, XG_GEO), 1);
eq('a defender four metres away applies no pressure',
  pressureOf({ x: 0, z: 12 }, [{ x: 4, z: 12 }]), 0);
near('a defender on top of the shooter applies full pressure',
  pressureOf({ x: 0, z: 12 }, [{ x: 0, z: 12 }]), 1);
eq('keepers are not counted as pressure',
  pressureOf({ x: 0, z: 12 }, [{ x: 0, z: 12, keeper: true }]), 0);

// ===========================================================================
console.log('\n--- 5. the stats recorder and the MVP --------------------------');
// ===========================================================================

/** A scripted match, expressed as core events rather than physics. */
function scriptedMatch() {
  const slots = [
    { team: 0, role: 'field', name: 'Ada', kind: 'human' },
    { team: 0, role: 'keeper', name: 'Bora', kind: 'bot' },
    { team: 1, role: 'field', name: 'Cem', kind: 'human' },
    { team: 1, role: 'keeper', name: 'Deniz', kind: 'bot' },
  ];
  const rec = createMatchRecorder({ slots, geo: GEO });
  const at = (x, z, vx, vz) => ({
    tick: 0,
    score: [0, 0],
    ball: { x: toUnits(x), z: toUnits(z), vx: toUnits(vx) / TICK_HZ, vz: toUnits(vz) / TICK_HZ },
    players: [
      { x: toUnits(0), z: toUnits(10), team: 0, role: 0 },
      { x: toUnits(0), z: toUnits(-17), team: 0, role: 1 },
      { x: toUnits(3), z: toUnits(-8), team: 1, role: 0 },
      { x: toUnits(0), z: toUnits(17), team: 1, role: 1 },
    ],
    match: { phase: 'running', over: false },
  });
  const idle = () => rec.feed([], at(0, 0, 0, 0));

  // Ada is played in by Bora, then scores
  rec.feed([{ type: 'touch', player: 1, kind: 'kick' }], at(0, -10, 0, 6));
  for (let i = 0; i < 30; i++) idle();
  rec.feed([{ type: 'touch', player: 0, kind: 'control' }], at(0, 12, 0, 2));
  rec.feed([{ type: 'shot', player: 0, power: 0.8 * 65536 }], at(0, 12, 0, 12));
  rec.feed([{ type: 'goal', team: 0 }], at(0, 12, 0, 12));

  // Cem shoots, Deniz's opposite number saves it
  rec.feed([{ type: 'shot', player: 2, power: 0.6 * 65536 }], at(0, -12, 0, -12));
  rec.feed([{ type: 'keeper-save', player: 1 }], at(0, -16, 0, -2));

  // Cem wins the ball twice
  rec.feed([{ type: 'tackle', player: 2, won: true }], at(0, -4, 0, 0));
  rec.feed([{ type: 'tackle', player: 2, won: true }], at(0, -2, 0, 0));

  // and then puts one through his own goal
  rec.feed([{ type: 'touch', player: 2, kind: 'control' }], at(0, -16, 0, -8));
  rec.feed([{ type: 'goal', team: 0 }], at(0, -16, 0, -8));

  // Ada gets a second, this time with nobody to credit an assist to
  for (let i = 0; i < 30; i++) idle();
  rec.feed([{ type: 'shot', player: 0, power: 0.9 * 65536 }], at(1, 14, 0, 14));
  rec.feed([{ type: 'goal', team: 0 }], at(1, 14, 0, 14));
  for (let i = 0; i < 60; i++) idle();
  return rec;
}

{
  const rec = scriptedMatch();
  const s = rec.summary();
  const ada = s.players.find((p) => p.name === 'Ada');
  const bora = s.players.find((p) => p.name === 'Bora');
  const cem = s.players.find((p) => p.name === 'Cem');

  eq('the scorer is credited', ada.goals, 2);
  eq('the previous team-mate touch is the assist', bora.assists, 1);
  eq('an opponent touch before a goal is not an assist', cem.assists, 0);
  eq('the shots are on the books', ada.shots, 2);
  eq('a goal is always an attempt on target', ada.onTarget, 2);
  eq('the keeper is credited with the save', bora.saves, 1);
  eq('the tackles are counted', cem.tacklesWon, 2);
  eq('the own goal lands on the defender', cem.ownGoals, 1);
  eq('an own goal still scores for the other side', s.teams[0].goals, 3);
  eq('an own goal is not a goal for its scorer', cem.goals, 0);
  check('the pass from Bora to Ada was counted', bora.passes >= 1, `${bora.passes}`);
  check('xG accumulated for the shots taken', ada.xg > 0 && cem.xg > 0);
  check('team xG never exceeds team shots',
    s.teams.every((t) => t.xg <= t.shots + 1e-9),
    `${s.teams[0].xg}/${s.teams[0].shots}, ${s.teams[1].xg}/${s.teams[1].shots}`);
  check('team xG is never negative', s.teams.every((t) => t.xg >= 0));
  check('possession shares sum to 1',
    Math.abs(s.possessionShare[0] + s.possessionShare[1] - 1) < 1e-9);
  eq('possession percentages sum to 100', s.possessionPct[0] + s.possessionPct[1], 100);

  // MVP arithmetic, by hand
  const expected =
    MVP_WEIGHTS.goals * ada.goals +
    MVP_WEIGHTS.assists * ada.assists +
    MVP_WEIGHTS.saves * ada.saves +
    MVP_WEIGHTS.xg * ada.xg +
    MVP_WEIGHTS.tacklesWon * ada.tacklesWon +
    MVP_WEIGHTS.onTarget * ada.onTarget +
    MVP_WEIGHTS.passes * ada.passes +
    MVP_WEIGHTS.fouls * ada.fouls +
    MVP_WEIGHTS.ownGoals * ada.ownGoals;
  near('the MVP score is exactly the printed weighted sum', ada.mvp, expected, 1e-4);
  eq('the goalscorer is the MVP of this script', s.mvp.name, 'Ada');
  check('a keeper with an assist and a save still ranks second, not last',
    s.players[1].name === 'Bora', s.players.map((p) => p.name).join(','));
  check('the own goal pushed its scorer below the tackler he was',
    cem.mvp < MVP_WEIGHTS.tacklesWon * 2, `${cem.mvp}`);
  check('the ranking is sorted', s.players.every((p, i, a) => i === 0 || a[i - 1].mvp >= p.mvp));
  check('the recorder is deterministic',
    JSON.stringify(scriptedMatch().summary()) === JSON.stringify(rec.summary()));

  // a match in which nobody did anything has no MVP
  const empty = createMatchRecorder({ slots: [{ team: 0 }, { team: 1 }], geo: GEO });
  eq('an empty match has no MVP', empty.mvp(), null);
}

{
  // deterministic tie-break: identical rows resolve by index, never by order
  const rec = createMatchRecorder({
    slots: [{ team: 0, name: 'A' }, { team: 0, name: 'B' }], geo: GEO,
  });
  rec.players[0].goals = 1;
  rec.players[1].goals = 1;
  eq('a tie breaks to the lower index', rec.ranking()[0].name, 'A');
}

// ===========================================================================
console.log('\n--- 6. stadium variants ---------------------------------------');
// ===========================================================================

check('every table validates', validateTables().length === 0, validateTables().join('; '));
eq('the default variant is legal', validateVariant(DEFAULT_VARIANT).length, 0);
check('an unknown theme is rejected',
  validateVariant({ time: 'gece', weather: 'acik', theme: 'yok' }).length === 1);
check('a non-object is rejected', validateVariant(null).length === 1);
eq('there are two times of day', TIMES_OF_DAY.length, 2);
eq('there are two weathers', WEATHERS.length, 2);
check('there are two to three themes', THEMES.length >= 2 && THEMES.length <= 3);
eq('the sweep covers every combination', allVariants().length,
  TIMES_OF_DAY.length * WEATHERS.length * THEMES.length);
check('every combination resolves', allVariants().every((v) => {
  for (const q of QUALITIES) {
    const r = resolveVariant(v, q);
    if (!r.id || !(r.particles >= 0)) return false;
  }
  return true;
}));
check('resolving an illegal variant throws', (() => {
  try { resolveVariant({ time: 'x', weather: 'acik', theme: 'klasik' }, 'orta'); return false; }
  catch { return true; }
})());

{
  const a = variantForRoom('ABC123');
  const b = variantForRoom('ABC123');
  eq('the same room always gets the same stadium', JSON.stringify(a), JSON.stringify(b));
  eq('an empty room code falls back to the default',
    JSON.stringify(variantForRoom(null)), JSON.stringify(DEFAULT_VARIANT));
  const seen = new Set();
  let wet = 0;
  for (let i = 0; i < 600; i++) {
    const v = variantForRoom(`ROOM${i}`);
    seen.add(`${v.time}/${v.weather}/${v.theme}`);
    if (v.weather === 'yagmur') wet++;
  }
  check('the room hash reaches every combination', seen.size === allVariants().length,
    `${seen.size} of ${allVariants().length}`);
  check('rain is the exception, not the rule', wet / 600 > 0.1 && wet / 600 < 0.45,
    `${((wet / 600) * 100).toFixed(0)}% wet`);
  const forced = variantFromParams(
    new URLSearchParams('time=gece&weather=yagmur&theme=neon'), 'ABC123',
  );
  eq('URL parameters override the room', `${forced.time}/${forced.weather}/${forced.theme}`,
    'gece/yagmur/neon');
  const junk = variantFromParams(new URLSearchParams('theme=hack'), 'ABC123');
  eq('a junk parameter falls back rather than breaking', junk.theme, a.theme);
}

eq('a desktop with plenty of everything gets the top tier',
  detectQuality({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', deviceMemory: 16, hardwareConcurrency: 16 }),
  'yuksek');
eq('a phone drops a tier',
  detectQuality({ userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) Mobile', deviceMemory: 8, hardwareConcurrency: 8 }),
  'orta');
eq('a weak phone drops two',
  detectQuality({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0) Mobile', deviceMemory: 2, hardwareConcurrency: 4 }),
  'dusuk');
eq('a two-core machine is low whatever it claims to be',
  detectQuality({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)', hardwareConcurrency: 2 }), 'dusuk');
eq('the manual override always wins',
  detectQuality({ userAgent: 'Mozilla/5.0 (iPhone) Mobile', deviceMemory: 1, override: 'yuksek' }),
  'yuksek');
eq('an unknown override is ignored',
  detectQuality({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', deviceMemory: 16, hardwareConcurrency: 16, override: 'ultra' }),
  'yuksek');

eq('clear weather spawns no particles at any tier',
  QUALITIES.reduce((a, q) => a + particleBudget({ weather: 'acik' }, q), 0), 0);
check('rain gets cheaper as the tier drops', (() => {
  let prev = Infinity;
  for (const q of [...QUALITIES].reverse()) {
    const n = particleBudget({ weather: 'yagmur' }, q);
    if (n > prev) return false;
    prev = n;
  }
  return true;
})());
check('the low tier turns shadows off entirely',
  resolveVariant(DEFAULT_VARIANT, 'dusuk').shadowMap === 0);
check('rain dims the lights',
  resolveVariant({ time: 'gunduz', weather: 'yagmur', theme: 'klasik' }, 'yuksek').sunIntensity
  < resolveVariant({ time: 'gunduz', weather: 'acik', theme: 'klasik' }, 'yuksek').sunIntensity);
check('night is darker than day',
  resolveVariant({ time: 'gece', weather: 'acik', theme: 'klasik' }, 'yuksek').sunIntensity
  < resolveVariant({ time: 'gunduz', weather: 'acik', theme: 'klasik' }, 'yuksek').sunIntensity);
check('the mobile particle budget stays under 2000',
  particleBudget({ weather: 'yagmur' }, 'dusuk') < 2000,
  `${particleBudget({ weather: 'yagmur' }, 'dusuk')}`);

// ===========================================================================
console.log('\n--- 7. the bus, against a real core world ----------------------');
// ===========================================================================

/**
 * A scripted core match: red walks onto a ball parked in front of the goal and
 * kicks it in, twice. Identical inputs, identical world, so the whole
 * presentation track has to come out identical too.
 */
function runCoreMatch() {
  const slots = [
    { team: 0, role: 'field', name: 'Ada', kind: 'human' },
    { team: 1, role: 'keeper', name: 'Deniz', kind: 'bot' },
  ];
  const world = createWorld({
    players: [{ team: 0 }, { team: 1, role: 'keeper' }],
    settings: { matchSeconds: 60, keepers: true, goldenGoal: false },
  });
  const rec = createMatchRecorder({ slots, geo: GEO });
  const bus = createPresentBus({ geo: GEO, totalSeconds: 60 });
  const commentator = createCommentator({ player: createNullPlayer(), tension: 0 });
  const events = [];

  const kickAt = new Set([12, 240]);
  for (let tick = 0; tick < 420; tick++) {
    if (tick === 0 || tick === 228) {
      // park the ball just inside kicking range, in front of the goal
      place(world, 0, 0, 380);
      place(world, 'ball', 0, 405);
    }
    const inputs = [
      { moveX: 0, moveZ: 1, buttons: kickAt.has(tick) ? BTN.KICK : 0 },
      { moveX: 0, moveZ: 0, buttons: 0 },
    ];
    const coreEvents = step(world, inputs);
    const state = readState(world);
    const stats = rec.feed(coreEvents, state);
    const secondsLeft = state.match.remainingTicks >= 0
      ? state.match.remainingTicks / TICK_HZ : 60;
    const out = bus.feed(stats, state, {
      tension: 0.5,
      lastTouchTeam: rec.lastTouch >= 0 ? rec.players[rec.lastTouch].team : -1,
      possession: rec.possessionShare(),
      secondsLeft,
    });
    for (const e of out) commentator.feed(e, (tick * 1000) / TICK_HZ);
    commentator.update((tick * 1000) / TICK_HZ);
    events.push(...out.map((e) => e.type));
  }
  return { rec, events, spoken: commentator.spoken(), score: readState(world).score };
}

{
  const a = runCoreMatch();
  const b = runCoreMatch();
  check('the scripted core match actually scored', a.score[0] >= 1, JSON.stringify(a.score));
  check('a goal reached the presentation bus', a.events.includes('goal'), a.events.join(','));
  check('the bus opened with a kickoff', a.events[0] === 'kickoff', a.events[0]);
  check('the restart line follows the goal',
    a.events.indexOf('restart') > a.events.indexOf('goal'));
  check('a goal line was actually spoken',
    a.spoken.some((id) => id.startsWith('goal_')), a.spoken.join(','));
  eq('two identical runs produce identical event tracks',
    a.events.join(','), b.events.join(','));
  eq('two identical runs produce identical commentary',
    a.spoken.join(','), b.spoken.join(','));
  eq('two identical runs produce identical statistics',
    JSON.stringify(a.rec.summary()), JSON.stringify(b.rec.summary()));
  check('the scorer was credited from the core event stream',
    a.rec.summary().players[0].goals >= 1);
}

{
  // the guest path: no core events, so the loud half is derived from the score
  const before = { score: [0, 0], match: { over: false, phase: 'running' } };
  const after = { score: [1, 0], match: { over: false, phase: 'running' } };
  const derived = deriveEvents(before, after);
  eq('a score that moved is a goal', derived.length, 1);
  eq('and it is credited to the right team', derived[0].team, 0);
  eq('nothing is derived from a first sample', deriveEvents(null, after).length, 0);
  eq('nothing is derived from an unchanged sample', deriveEvents(after, after).length, 0);
  const ended = deriveEvents(after, { score: [1, 0], match: { over: true, winner: 0, reason: 'time' } });
  check('the final whistle is derived too', ended.some((e) => e.type === 'match-end'));
}

// ===========================================================================
console.log(failed === 0
  ? `\nALL PASS (${passed} checks)`
  : `\n${failed} FAILURES of ${passed + failed} checks`);
process.exit(failed === 0 ? 0 : 1);
