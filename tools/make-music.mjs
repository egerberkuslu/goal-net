// The menu track, composed by ACE-Step and looped by ffmpeg.
//
//   npm run gen:music                # -> packages/client/src/view/music/menu.opus
//   npm run gen:music -- --seed 9 --duration 90
//   npm run gen:music -- --prompt "..."
//
// ACE-Step runs from the video-lab checkout next door, locally, on the GPU,
// no account. Its wrapper (gen-tools/music.py) writes the render into its own
// cache and ALSO copies it over video-lab/work/music.wav — the video
// project's current track — so this reads the cache entry it just made
// rather than that file, and puts work/music.wav back the way it found it.
//
// The loop: the render is not seamless, so the last three seconds of the
// body are cross-faded into the first three seconds of the head, and the
// result ends exactly where it starts. Then Opus at 64 kbit/s stereo: a
// 72-second track at 48 kHz f32 is 28 MB as WAV and about 600 KB this way.

import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const VIDEO_LAB = process.env.VIDEO_LAB || resolve(REPO, '..', 'video-lab');
const PY = join(VIDEO_LAB, 'audio-tools/.venv/bin/python');
const MUSIC_PY = join(VIDEO_LAB, 'gen-tools/music.py');
const CACHE = join(VIDEO_LAB, 'work/gen/music');
const WORK_WAV = join(VIDEO_LAB, 'work/music.wav');

export const OUT = join(REPO, 'packages/client/src/view/music/menu.opus');

const DEFAULT_PROMPT = 'stadium anthem ambience, warm analog synth pads, '
  + 'distant crowd hum, slow build, 84 bpm, cinematic, instrumental, no vocals';
const FADE_S = 3;

function parseArgs(argv) {
  const a = { prompt: DEFAULT_PROMPT, duration: 80, seed: 7, steps: 40, from: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--prompt') a.prompt = argv[++i];
    else if (k === '--duration') a.duration = Number(argv[++i]);
    else if (k === '--seed') a.seed = Number(argv[++i]);
    else if (k === '--steps') a.steps = Number(argv[++i]);
    else if (k === '--from') a.from = argv[++i];   // an existing render: skip the model
  }
  return a;
}

/** The newest wav in ACE-Step's cache, which is the one just rendered. */
function newestRender() {
  const wavs = readdirSync(CACHE).filter((f) => f.endsWith('.wav'))
    .map((f) => ({ f, t: statSync(join(CACHE, f)).mtimeMs }))
    .sort((x, y) => y.t - x.t);
  return wavs.length ? join(CACHE, wavs[0].f) : null;
}

export function main(argv = process.argv.slice(2)) {
  const a = parseArgs(argv);
  if (!existsSync(MUSIC_PY)) { console.error(`no ${MUSIC_PY} (set VIDEO_LAB)`); process.exit(1); }
  mkdirSync(dirname(OUT), { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'goalnet-music-'));

  // Keep the video project's own track safe from music.py's copy.
  const hadWork = existsSync(WORK_WAV);
  const keep = join(tmp, 'work-music.wav');
  if (hadWork) copyFileSync(WORK_WAV, keep);

  let wav = a.from;
  if (!wav) {
  console.log(`ACE-Step: ${a.duration}s, seed ${a.seed}, ${a.steps} steps`);
  const r = spawnSync(PY, [
    MUSIC_PY, '--prompt', a.prompt, '--duration', String(a.duration),
    '--seed', String(a.seed), '--steps', String(a.steps), '--force',
  ], {
    cwd: VIDEO_LAB,
    env: { ...process.env, PYTHONPATH: '', HF_HUB_DISABLE_XET: '1' },
    stdio: 'inherit',
  });
  if (hadWork) copyFileSync(keep, WORK_WAV);
  if (r.status !== 0) throw new Error(`music.py exited ${r.status}`);
  wav = newestRender();
  if (!wav) throw new Error(`nothing rendered into ${CACHE}`);
  }
  console.log(`render: ${wav}`);
  // The loop maths below assumes the render is `duration` long.
  const probed = Number(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav,
  ]).toString().trim());
  if (Number.isFinite(probed) && probed < a.duration) a.duration = Math.floor(probed);

  // Body = [FADE, duration - FADE); head = [0, FADE). Cross-fade the body's
  // tail into the head so the file loops on itself.
  const bodyEnd = a.duration - FADE_S;
  execFileSync('ffmpeg', [
    // The same file twice on purpose. acrossfade wants two independent
    // streams; feeding it one input split two ways (`[0]` twice, or asplit)
    // is not an error in ffmpeg, it is silence — "No filtered frames", exit
    // 0, and a 137-byte Opus header with nothing in it. Two -i's is the
    // recipe that actually produces frames.
    '-y', '-loglevel', 'error', '-i', wav, '-i', wav,
    '-filter_complex',
    `[0:a]atrim=${FADE_S}:${bodyEnd},asetpts=PTS-STARTPTS[body];`
    + `[1:a]atrim=0:${FADE_S},asetpts=PTS-STARTPTS[head];`
    + `[body][head]acrossfade=d=${FADE_S}:c1=tri:c2=tri,loudnorm=I=-18:TP=-2[out]`,
    '-map', '[out]', '-c:a', 'libopus', '-b:a', '64k', '-ac', '2', '-ar', '48000', OUT,
  ]);
  const kb = Math.round(statSync(OUT).size / 1024);
  if (kb < 50) throw new Error(`${OUT} is ${kb} KB — the loop filter produced nothing`);
  console.log(`wrote ${OUT} (${kb} KB)`);
  rmSync(tmp, { recursive: true, force: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
