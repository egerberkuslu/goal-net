// Fetching the CC0 textures the pitch is made of.
//
//   node tools/fetch-textures.mjs          (or: npm run fetch:textures)
//
// Why only CC0
// ------------
// Everything here comes from ambientCG, which publishes under CC0: no account,
// no attribution obligation, no commercial restriction, no per-model licence to
// read. That matters because this game is published — a CC-BY model needs a
// credits screen, an NC model cannot ship at all, and a model ripped from a
// commercial football game cannot ship under any licence. CC0 is the only
// category that is safe to fetch and use without a human reading the terms
// first.
//
// A CREDITS file is written anyway. CC0 does not require it; saying where the
// pixels came from is just honest, and it is the thing that lets someone audit
// this later.
//
// The download is optional at runtime. dist-assets/ is gitignored and every
// loader falls back to what it drew before, so a checkout that never runs this
// still gets a game — with the procedural grass instead of the photographed
// one.

import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const OUT = resolve(import.meta.dirname, '..', 'dist-assets', 'textures');

/**
 * What the pitch needs, and what each one is for.
 *
 * `maps` lists the ambientCG suffixes worth keeping — the packs ship six or
 * seven and most of them (displacement, AO, the DirectX-handed normal) are
 * either unused by this renderer or a duplicate of one that is.
 */
const WANTED = [
  {
    id: 'Grass005',
    res: '1K-JPG',
    use: 'the pitch surface: blade detail the mown stripes sit on top of',
    maps: ['Color', 'NormalGL', 'Roughness'],
  },
  {
    id: 'Ground037',
    res: '1K-JPG',
    use: 'worn earth in front of goal and along the centre circle',
    maps: ['Color', 'NormalGL'],
  },
  {
    id: 'Snow010A',
    res: '1K-JPG',
    use: 'snow cover, for the winter variant',
    maps: ['Color', 'NormalGL'],
  },
];

const url = (a) => `https://ambientcg.com/get?file=${a.id}_${a.res}.zip`;

async function fetchOne(asset) {
  const dir = join(OUT, asset.id);
  await mkdir(dir, { recursive: true });
  const zip = join(dir, 'pack.zip');

  process.stdout.write(`  ${asset.id} … `);
  const res = await fetch(url(asset));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await pipeline(res.body, createWriteStream(zip));

  // unzip with the system tool rather than a dependency: this script runs on a
  // developer machine, not in the browser, and adding a node_modules entry to
  // unpack three files is not a trade worth making
  await run('unzip', ['-o', '-q', zip, '-d', dir]);
  await rm(zip);

  // keep only the maps the renderer reads
  let kept = 0;
  for (const name of await readdir(dir)) {
    const wanted = asset.maps.some((m) => name.endsWith(`_${m}.jpg`));
    if (wanted) { kept++; continue; }
    await rm(join(dir, name), { force: true });
  }
  console.log(`${kept} map`);
  return kept;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log('CC0 textures from ambientCG\n');
  let total = 0;
  for (const asset of WANTED) {
    try {
      total += await fetchOne(asset);
    } catch (err) {
      console.log(`FAILED (${err.message}) — the game falls back to procedural`);
    }
  }

  const credits = [
    '# Texture credits',
    '',
    'Every texture in this directory is CC0 (public domain dedication) from',
    'ambientCG — https://ambientcg.com. CC0 asks for nothing in return; this',
    'file exists so the provenance is auditable rather than because it is owed.',
    '',
    ...WANTED.map((a) => `- **${a.id}** — ${a.use}\n  https://ambientcg.com/view?id=${a.id}`),
    '',
    'Nothing here came from a source that requires an account, attribution or a',
    'per-model licence check. See tools/fetch-textures.mjs for why.',
    '',
  ].join('\n');
  await writeFile(join(OUT, 'CREDITS.md'), credits);

  console.log(`\n${total} maps in dist-assets/textures/`);
  console.log('credits: dist-assets/textures/CREDITS.md');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
