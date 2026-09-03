// Record the commentator, in the player's own voice.
//
//   npm run gen:voice                  # all lines -> view/voice/<id>.opus
//   npm run gen:voice -- --take 2      # a second take into view/voice/takes/2/
//   npm run gen:voice -- --only gol,tac
//   npm run gen:voice -- --keep        # leave the raw WAVs for auditioning
//   npm run gen:voice -- --engine piper   # the stock Turkish voice instead
//
// The lines come from packages/client/src/view/voiceLines.js — the same table
// the game plays from — so a line cannot be recorded that the game does not
// know, or known that was never recorded.
//
// The voice is Chatterbox (multilingual, Turkish supported) cloned from
// content/voices/ege.wav in the video-lab checkout next door. Nothing here
// leaves the machine: no API, no account. Chatterbox has no seed, so a take is
// simply a run; `--take N` writes to a side directory so two runs can be
// auditioned and the better line copied into place by hand.
//
// Every clip is then trimmed of the silence Chatterbox pads it with (a 400 ms
// lead makes "Taç!" land after the throw-in has already happened), loudness
// normalised so eleven separate renders sit at one level, and encoded as
// mono Opus at 48 kbit/s. Eleven of them come to about 80 KB.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOICE_LINES } from '../packages/client/src/view/voiceLines.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const VIDEO_LAB = process.env.VIDEO_LAB || resolve(REPO, '..', 'video-lab');

/** Where the game reads them from (see view/sfx.js). */
export const OUT_DIR = join(REPO, 'packages/client/src/view/voice');
export const REF_VOICE = join(VIDEO_LAB, 'content/voices/ege.wav');

const CHATTERBOX_PY = join(VIDEO_LAB, 'gen-tools/.venv/bin/python');
const CHATTERBOX = join(VIDEO_LAB, 'audio-tools/tts_chatterbox.py');
const PIPER_PY = join(VIDEO_LAB, 'audio-tools/.venv/bin/python');
const PIPER = join(VIDEO_LAB, 'audio-tools/tts.py');
const PIPER_VOICE = join(VIDEO_LAB, 'audio-tools/voices/tr_TR-fahrettin-medium.onnx');

// Shouted, not narrated: more expression and no slow-down than the video
// project's defaults (0.3 / 0.9), which are tuned for a calm voice-over.
const EXAGGERATION = '0.5';
const CFG_WEIGHT = '0.4';
const TEMPO = '1.0';

/**
 * The Chatterbox job list for a set of lines.
 *
 * Exported for the test, which checks its shape without running a model.
 *
 * @param {string} rawDir where the WAVs land
 * @param {string[]|null} only line ids to include, or all
 */
export function buildJobs(rawDir, only = null) {
  return VOICE_LINES
    .filter((l) => !only || only.includes(l.id))
    .map((l) => ({ text: l.text, out: join(rawDir, `${l.id}.wav`), ref: REF_VOICE }));
}

function parseArgs(argv) {
  const args = { take: null, only: null, keep: false, engine: 'chatterbox' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--take') args.take = Number(argv[++i]);
    else if (a === '--only') args.only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--keep') args.keep = true;
    else if (a === '--engine') args.engine = argv[++i];
  }
  return args;
}

function runChatterbox(jobsPath) {
  const r = spawnSync(CHATTERBOX_PY, [
    CHATTERBOX, jobsPath,
    '--ref', REF_VOICE, '--language', 'tr',
    '--exaggeration', EXAGGERATION, '--cfg-weight', CFG_WEIGHT, '--tempo', TEMPO,
  ], {
    cwd: VIDEO_LAB,
    // The video-lab venvs inherit a ROS site-packages through PYTHONPATH and
    // Chatterbox's own scripts blank it for the same reason.
    env: { ...process.env, PYTHONPATH: '', HF_HUB_DISABLE_XET: '1' },
    stdio: 'inherit',
  });
  if (r.status !== 0) throw new Error(`chatterbox exited ${r.status}`);
}

function runPiper(jobs) {
  // tts.py is script-driven; drive Piper directly instead, one line at a time.
  for (const job of jobs) {
    const r = spawnSync(PIPER_PY, ['-m', 'piper', '--model', PIPER_VOICE, '--output_file', job.out], {
      input: job.text, cwd: VIDEO_LAB,
      env: { ...process.env, PYTHONPATH: '' }, stdio: ['pipe', 'inherit', 'inherit'],
    });
    if (r.status !== 0) throw new Error(`piper exited ${r.status} on ${job.text}`);
  }
  void PIPER;
}

/** Trim, normalise, encode one clip. */
function finish(wav, opus) {
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', wav,
    '-af', [
      'silenceremove=start_periods=1:start_threshold=-45dB',
      'areverse',
      'silenceremove=start_periods=1:start_threshold=-45dB',
      'areverse',
      'loudnorm=I=-16:TP=-1.5',
    ].join(','),
    '-c:a', 'libopus', '-b:a', '48k', '-ac', '1', opus,
  ]);
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!existsSync(REF_VOICE)) {
    console.error(`no reference voice at ${REF_VOICE} (set VIDEO_LAB)`);
    process.exit(1);
  }
  const outDir = args.take ? join(OUT_DIR, 'takes', String(args.take)) : OUT_DIR;
  mkdirSync(outDir, { recursive: true });
  const rawDir = mkdtempSync(join(tmpdir(), 'goalnet-voice-'));
  const jobs = buildJobs(rawDir, args.only);
  if (!jobs.length) { console.error('no lines matched --only'); process.exit(1); }

  console.log(`${jobs.length} lines -> ${outDir} (${args.engine})`);
  if (args.engine === 'piper') {
    runPiper(jobs);
  } else {
    const jobsPath = join(rawDir, 'jobs.json');
    writeFileSync(jobsPath, JSON.stringify(jobs, null, 2));
    runChatterbox(jobsPath);
  }

  for (const job of jobs) {
    if (!existsSync(job.out)) { console.error(`missing ${job.out}`); continue; }
    const id = job.out.slice(job.out.lastIndexOf('/') + 1, -4);
    const opus = join(outDir, `${id}.opus`);
    finish(job.out, opus);
    console.log(`  ${id}.opus`);
  }
  if (args.keep) console.log(`raw WAVs kept in ${rawDir}`);
  else rmSync(rawDir, { recursive: true, force: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
