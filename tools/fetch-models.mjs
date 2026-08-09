// Downloading the third-party models, with their licences attached.
//
//   SKETCHFAB_TOKEN=... node tools/fetch-models.mjs          (npm run fetch:models)
//   node tools/fetch-models.mjs --list                       what is in the manifest
//
// The token
// ---------
// Sketchfab gates downloads behind OAuth, so this needs a personal API token
// from https://sketchfab.com/settings/password. It is read from SKETCHFAB_TOKEN
// or from .env, which is gitignored. It is never written to any file this
// script produces, and never printed.
//
// The licences
// ------------
// This is the part that matters. Every model here is downloaded WITH its
// licence record, and the licence is written into vendor-assets/CREDITS.md
// before the geometry is usable. The rules, from brain/20-tech-spec/asset-sources.md:
//
//   CC0            fine, no obligation
//   CC-BY, CC-BY-SA fine, attribution REQUIRED — that is what CREDITS.md is
//   NC or ND       refused: this game is published and these models get edited
//
// A model whose licence changes between the manifest and the API is refused
// too, loudly. An uploader can relicense at any time and a stale note in this
// repo is not a defence.
//
// What this does NOT check is whether a model is someone else's work that the
// uploader had no right to publish — a "football kit" on a model site is very
// often ripped from a commercial game. No API can answer that; a human looks at
// the model. Nothing here goes into a build without that look.

import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'vendor-assets');

/** Licences that may be shipped. Anything else is refused. */
const ALLOWED = new Set([
  'CC0 Public Domain',
  'CC Attribution',
  'CC Attribution-ShareAlike',
]);

/**
 * What to fetch, and what each is for.
 *
 * Chosen off the search in brain/20-tech-spec/asset-sources.md: low face counts
 * first, because the whole scene has a 150k triangle budget and the stands are
 * already spending 45k of it.
 */
const MANIFEST = [
  {
    uid: 'c509bd62becc44cdaeec5855fa923950',
    as: 'stadium-lowpoly',
    use: 'reference for the stand geometry: rake angle, tier depth, roof line',
  },
  {
    uid: '6e0e88fa79c84ae082ef06908ca77650',
    as: 'bleacher-seating',
    use: 'a real seating block, to replace the extruded boxes the stands use',
  },
  {
    uid: '80b94ea2406c4ff28b4120995764c6ed',
    as: 'soccer-ball',
    use: 'a panelled ball, instead of a sphere with a drawn texture',
  },
  {
    uid: '5ae4bf9d6a324cfda79ce1298ea2d333',
    as: 'player-rig',
    use: 'the outfield player: his mesh and SKELETON. His five animation clips '
      + 'are not used — arena/anim poses the bones, so ragdoll, the aim stance '
      + 'and the shot charge survive',
  },
  {
    uid: '7de86f9c36f84152a777f27a73646ada',
    as: 'keeper-rig',
    use: 'the goalkeeper, rigged; same deal — we drive the bones',
  },
  {
    uid: 'ea5d32f3dbc94d26a0ae1c73b1ae604c',
    as: 'floodlight',
    use: 'the pylon heads, instead of a box on a stick',
  },
  {
    uid: '679ffd65b3fd4e6498d28a47048c2f24',
    as: 'substitute',
    use: 'substitutes sitting on the dugout benches — a static mesh is right '
      + 'here, where the pitch players need separately animated limbs',
  },
  {
    uid: 'b0607a5e412043e399745703be24a33a',
    as: 'stadium-seat',
    use: 'the chair every spectator sits in — 80 faces x 1387 seats',
  },
  {
    uid: '096d4f915819409f9739326118bd5aa7',
    as: 'bench',
    use: 'the substitutes\' benches, on the camera side where real dugouts are',
  },
  // NOT the goal. The best-licensed goal on Sketchfab (Football Goal Post,
  // 968 faces) turned out to be a 0.9 m toy frame whose net is four flat
  // textured quads — two triangles each. Taking it would have swapped a net
  // this project simulates on an XPBD solver for a picture of one, which is
  // the opposite of the point. The frame stays procedural in view/scene.js,
  // where it is already sized from the goal width.
  {
    uid: '8101bb9f568e4bf2802b51e9749de21e',
    as: 'scoreboard',
    use: 'a scoreboard over the far stand — 40 faces for a lot of stadium',
  },
];

function tokenFrom(env, dotenv) {
  if (env.SKETCHFAB_TOKEN) return env.SKETCHFAB_TOKEN.trim();
  const line = dotenv.split('\n').find((l) => l.startsWith('SKETCHFAB_TOKEN='));
  return line ? line.slice('SKETCHFAB_TOKEN='.length).trim() : null;
}

async function api(path, token) {
  const res = await fetch(`https://api.sketchfab.com/v3${path}`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

async function fetchOne(entry, token, credits) {
  const meta = await api(`/models/${entry.uid}`, token);
  const licence = (meta.license || {}).label || 'unknown';
  const author = (meta.user || {}).displayName || 'unknown';

  if (!ALLOWED.has(licence)) {
    console.log(`  ${entry.as}: REFUSED — licence is "${licence}"`);
    return false;
  }

  const links = await api(`/models/${entry.uid}/download`, token);
  const glb = links.glb || links.gltf;
  if (!glb || !glb.url) {
    console.log(`  ${entry.as}: no glb/gltf offered`);
    return false;
  }

  const dir = join(OUT, entry.as);
  await mkdir(dir, { recursive: true });
  const isZip = !links.glb;
  const file = join(dir, isZip ? 'model.zip' : 'model.glb');
  const res = await fetch(glb.url);
  if (!res.ok) throw new Error(`download -> HTTP ${res.status}`);
  await pipeline(res.body, createWriteStream(file));
  if (isZip) {
    await run('unzip', ['-o', '-q', file, '-d', dir]);
    await rm(file);
  }

  credits.push({
    as: entry.as,
    name: meta.name,
    author,
    licence,
    url: meta.viewerUrl || `https://sketchfab.com/3d-models/${entry.uid}`,
    use: entry.use,
    faces: meta.faceCount,
  });
  console.log(`  ${entry.as}: "${meta.name}" by ${author} — ${licence}, `
    + `${meta.faceCount} faces`);
  return true;
}

async function main() {
  if (process.argv.includes('--list')) {
    for (const m of MANIFEST) console.log(`${m.as}  ${m.uid}  — ${m.use}`);
    return;
  }
  let dotenv = '';
  try {
    dotenv = await readFile(join(ROOT, '.env'), 'utf8');
  } catch { /* no .env is fine if the variable is exported */ }
  const token = tokenFrom(process.env, dotenv);
  if (!token) {
    console.log('SKIP — no SKETCHFAB_TOKEN (env or .env)');
    console.log('  get one at https://sketchfab.com/settings/password');
    return;
  }

  await mkdir(OUT, { recursive: true });
  console.log('sketchfab models\n');
  const credits = [];
  for (const entry of MANIFEST) {
    try {
      await fetchOne(entry, token, credits);
    } catch (err) {
      console.log(`  ${entry.as}: FAILED — ${err.message}`);
    }
  }

  const body = [
    '# Third-party model credits',
    '',
    'These models are NOT ours. Each is used under the licence named against',
    'it, and CC Attribution REQUIRES this notice to travel with the build —',
    'removing a line here is a licence breach, not a tidy-up.',
    '',
    'Written by tools/fetch-models.mjs. Do not edit by hand.',
    '',
    ...credits.flatMap((c) => [
      `## ${c.name}`,
      '',
      `- **Author:** ${c.author}`,
      `- **Licence:** ${c.licence}`,
      `- **Source:** ${c.url}`,
      `- **Used for:** ${c.use}`,
      `- **Local:** \`vendor-assets/${c.as}/\` (${c.faces} faces as downloaded)`,
      '',
    ]),
  ].join('\n');
  await writeFile(join(OUT, 'CREDITS.md'), body);

  console.log(`\n${credits.length} of ${MANIFEST.length} downloaded`);
  console.log('credits: vendor-assets/CREDITS.md — this ships with the build');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
