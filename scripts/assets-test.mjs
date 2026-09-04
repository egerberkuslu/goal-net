// The generated assets: does what the game expects match what is on disk?
//
//   npm run test:assets
//
// Headless, no browser, no model. The generators (tools/make-voice.mjs and
// friends) are slow and need a GPU; this checks their CONTRACT with the game
// instead: the line table is well-formed, the job list is what the generator
// will feed the model, the anti-spam rule behaves, and the files the game
// will glob are actually there.
//
// A checkout that has never run the generators is WARN, not FAIL — the game is
// designed to be silent without the clips. A checkout where SOME clips are
// missing is FAIL, because that is a generator run that broke half way.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  LINE_FOR_EVENT, MIN_GAP_MS, REPEAT_MS, VOICE_LINES, createVoiceState, pickVoice,
} from '../packages/client/src/view/voiceLines.js';
import { OUT_DIR, REF_VOICE, buildJobs } from '../tools/make-voice.mjs';
import { KIT_PRESETS, PATTERNS, defaultKitFor, kitImage } from '../packages/client/src/view/kitTexture.js';

let failures = 0;
let warnings = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};
const warn = (name, detail = '') => {
  console.log(`WARN ${name}${detail ? ' — ' + detail : ''}`);
  warnings++;
};
const section = (t) => console.log(`\n--- ${t}`);

// ---------------------------------------------------------------------------
section('1. the commentator: line table');

const ids = VOICE_LINES.map((l) => l.id);
check('every line has a unique id', new Set(ids).size === ids.length);
check('every line has text', VOICE_LINES.every((l) => typeof l.text === 'string' && l.text.trim()));
check('every line has a priority 0..2',
  VOICE_LINES.every((l) => Number.isInteger(l.priority) && l.priority >= 0 && l.priority <= 2));
const allEvents = VOICE_LINES.flatMap((l) => l.events);
check('no event is claimed by two lines', new Set(allEvents).size === allEvents.length,
  allEvents.join(','));
check('LINE_FOR_EVENT covers exactly the claimed events',
  Object.keys(LINE_FOR_EVENT).length === allEvents.length
  && allEvents.every((ev) => ids.includes(LINE_FOR_EVENT[ev])));
// The lines the game's own HUD prints, so ear and eye agree.
for (const [ev, word] of [['goal', 'Gooool!'], ['throwin', 'Taç!'], ['corner', 'Korner!'],
  ['goalkick', 'Kale vuruşu!'], ['foul', 'Faul!'], ['post', 'Direk!']]) {
  const line = VOICE_LINES.find((l) => l.id === LINE_FOR_EVENT[ev]);
  check(`${ev} says "${word}"`, line?.text === word, line?.text);
}
check('kick is deliberately silent', !LINE_FOR_EVENT.kick);

// ---------------------------------------------------------------------------
section('2. the commentator: what the generator will record');

const jobs = buildJobs('/tmp/x');
check('one job per line', jobs.length === VOICE_LINES.length, `${jobs.length}`);
check('jobs carry the exact text',
  jobs.every((j, i) => j.text === VOICE_LINES[i].text));
check('jobs write absolute wavs named by id',
  jobs.every((j, i) => j.out === `/tmp/x/${VOICE_LINES[i].id}.wav`));
check('jobs point at the reference voice', jobs.every((j) => j.ref === REF_VOICE));
const onlyTwo = buildJobs('/tmp/x', ['gol', 'tac']);
check('--only narrows the job list', onlyTwo.length === 2
  && onlyTwo.map((j) => j.text).join('|') === 'Gooool!|Taç!');

// ---------------------------------------------------------------------------
section('3. the commentator: anti-spam');

{
  const st = createVoiceState();
  check('a throw-in is spoken', pickVoice(st, 'throwin', 0) === 'tac');
  check('a second event inside the gap is not', pickVoice(st, 'corner', 300) === null);
  check('the same line inside the repeat window is not',
    pickVoice(st, 'throwin', MIN_GAP_MS + 500) === null);
  check('a different line after the gap is', pickVoice(st, 'corner', 2000) === 'korner');
  check('the same line after the repeat window is',
    pickVoice(st, 'corner', 2000 + REPEAT_MS + 1) === 'korner');
  st.busyUntil = 12000;
  check('nothing ordinary speaks over a line in flight',
    pickVoice(st, 'foul', 11000) === null);
  check('a goal speaks over everything', pickVoice(st, 'goal', 11000) === 'gol');
  check('a goal ignores the gap too', pickVoice(st, 'golden', 11050) === 'altin-gol');
  check('an unmapped event is silent', pickVoice(st, 'kick', 20000) === null);
  check('an unknown event is silent', pickVoice(st, 'nonsense', 20000) === null);
}

// ---------------------------------------------------------------------------
section('4. the commentator: clips on disk');

{
  const dir = resolve(OUT_DIR);
  const present = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.opus')).map((f) => f.slice(0, -5))
    : [];
  if (present.length === 0) {
    warn('no clips recorded yet', `run: npm run gen:voice  (${dir})`);
  } else {
    const missing = ids.filter((id) => !present.includes(id));
    const extra = present.filter((f) => !ids.includes(f));
    check('every line has a clip', missing.length === 0, missing.join(',') || `${present.length} clips`);
    check('no clip without a line', extra.length === 0, extra.join(','));
  }
}

// ---------------------------------------------------------------------------
section('5. the ad boards: banners on disk');

{
  const dir = resolve('packages/client/src/view/boards');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.webp')) : [];
  if (files.length === 0) {
    warn('no banners generated yet', `run: npm run gen:boards  (${dir})`);
  } else {
    check('between 1 and 12 banners', files.length >= 1 && files.length <= 12, `${files.length}`);
    const big = files.filter((f) => statSync(resolve(dir, f)).size > 60 * 1024);
    check('every banner is under 60 KB', big.length === 0, big.join(','));
    const stray = readdirSync(dir).filter((f) => !f.endsWith('.webp') && !f.startsWith('.'));
    check('nothing but webp in the folder (png is gitignored and would vanish)',
      stray.length === 0, stray.join(','));
  }
}

// ---------------------------------------------------------------------------
section('6. the menu music: track on disk');

{
  const f = resolve('packages/client/src/view/music/menu.opus');
  if (!existsSync(f)) {
    warn('no menu track yet', 'run: npm run gen:music');
  } else {
    const kb = statSync(f).size / 1024;
    // Under 50 KB is the empty-Opus-header failure the generator now guards
    // against; over 1.5 MB means someone shipped the WAV.
    check('the track is a real file (50 KB - 1.5 MB)', kb > 50 && kb < 1536, `${Math.round(kb)} KB`);
  }
}

// ---------------------------------------------------------------------------
section('7. the kits: generated patterns');

{
  const dir = resolve('packages/client/src/view/kits');
  const imageKits = Object.entries(KIT_PRESETS).filter(([, v]) => v.image);
  check('image kits name their file by their own key',
    imageKits.every(([k, v]) => v.image === k), imageKits.map(([k]) => k).join(','));
  check('image kits keep a procedural fallback pattern',
    imageKits.every(([, v]) => PATTERNS.includes(v.pattern)));
  check('kitImage() of an unknown key is null', kitImage('yok-boyle-bir-sey') === null);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.webp')) : [];
  if (files.length === 0) {
    warn('no kit patterns generated yet', `run: npm run gen:kits  (${dir})`);
  } else {
    const missing = imageKits.filter(([k]) => !files.includes(`${k}.webp`)).map(([k]) => k);
    check('every image kit has its file', missing.length === 0, missing.join(',') || `${files.length}`);
    const motifs = [0, 1].map((t) => defaultKitFor('#ffffff', t).motif);
    check('both default kits name a motif', motifs.every((m) => typeof m === 'string'), motifs.join(','));
    const noMotif = motifs.filter((m) => !files.includes(`${m}.webp`));
    check('every default motif has its swatch', noMotif.length === 0, noMotif.join(',') || motifs.join(','));
    const orphan = files.filter((f) => !KIT_PRESETS[f.slice(0, -5)] && !motifs.includes(f.slice(0, -5)));
    check('no file without a preset or a motif', orphan.length === 0, orphan.join(','));
  }
}

console.log(failures === 0
  ? `\nALL PASS${warnings ? ` (${warnings} warning${warnings > 1 ? 's' : ''})` : ''}`
  : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
