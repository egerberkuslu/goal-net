// Post-build smoke test for the static bundle. No browser, no network: it
// only proves that `vite build` produced a self-contained dist/ whose entry
// document really points at the emitted assets.
//   node deploy/check-dist.mjs [distDir]
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(process.argv[2] ?? join(root, 'dist'));

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

const indexPath = join(dist, 'index.html');
check('dist/index.html exists', existsSync(indexPath), dist);
if (!existsSync(indexPath)) {
  console.log('\nrun `npm run build` first');
  process.exit(1);
}

const html = readFileSync(indexPath, 'utf8');
check('index.html is not empty', html.length > 500, `${html.length} bytes`);
check('index.html keeps the mount point', html.includes('id="app"'));

// every local script/style/link the document references must be on disk
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((u) => !/^(https?:|data:|#|\/\/)/.test(u));
const missing = refs.filter((u) => !existsSync(join(dist, u.replace(/^\//, ''))));
check('every referenced local asset is emitted',
  refs.length > 0 && missing.length === 0,
  missing.length ? `missing: ${missing.join(', ')}` : `${refs.length} refs`);

const scripts = refs.filter((u) => u.endsWith('.js'));
check('a hashed js bundle is linked',
  scripts.some((u) => /assets\/.+-[A-Za-z0-9_-]{6,}\.js$/.test(u)),
  scripts.join(', ') || 'none');

for (const s of scripts) {
  const p = join(dist, s.replace(/^\//, ''));
  if (!existsSync(p)) continue;
  const bytes = statSync(p).size;
  check(`bundle ${s} has real content`, bytes > 50_000, `${(bytes / 1024).toFixed(0)} KiB`);
  const js = readFileSync(p, 'utf8');
  check(`bundle ${s} has no bare module specifiers`,
    !/\bfrom"(three|peerjs)"/.test(js));
}

// nothing may still point at the dev server or a bare source path
check('no /src/ references leak into the build', !/["'(]\/?src\//.test(html));

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
