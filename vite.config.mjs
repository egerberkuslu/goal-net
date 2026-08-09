import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Serve the built assets at /dist-assets.
 *
 * The build pipeline (tools/build-assets.mjs, tools/blender/*.py) writes to
 * dist-assets/ at the repo root, but vite's root is packages/client, so those
 * files were outside the served tree. Vite answers an unknown path with
 * index.html and a 200, so every loader's "is it there?" HEAD check said yes
 * and then choked on HTML — silently, by design, since a missing asset is
 * supposed to fall back. The baked stadium had never once loaded.
 */
function serveDistAssets(dir) {
  const TYPES = { '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2', '.json': 'application/json' };
  return {
    name: 'serve-dist-assets',
    configureServer(server) {
      server.middlewares.use('/dist-assets', (req, res, next) => {
        const rel = normalize(decodeURIComponent(req.url.split('?')[0]));
        if (rel.includes('..')) { res.statusCode = 403; res.end(); return; }
        const file = join(dir, rel);
        let stat;
        try {
          stat = statSync(file);
        } catch {
          res.statusCode = 404;      // a real 404, so a loader can fall back
          res.end('not built');
          return;
        }
        if (!stat.isFile()) { next(); return; }
        res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
        res.setHeader('Content-Length', stat.size);
        createReadStream(file).pipe(res);
      });
    },
  };
}

// The client is a workspace package; the repo root stays the place you run
// commands from, so point vite at the package and emit to the root dist/.
//
// Two entry documents, deliberately:
//   index.html   the shipping game (float physics, its own JSON protocol)
//   arena.html   the deterministic stack (packages/core + net + bots)
// They share the view layer and the PeerJS transport and nothing else, so both
// can be served from the same build while the new one is proven.
export default defineConfig({
  root: 'packages/client',
  plugins: [serveDistAssets(resolve(import.meta.dirname, 'dist-assets'))],
  publicDir: false,
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      // One entry document. arena.html is retired (2026-08-09): the two games
      // are one game now, and shipping a second door to a second stack was the
      // thing that made the project feel like two projects. The arena sources
      // stay in the tree — the deterministic core, the netcode, the bots and
      // the replay format are what the single game is being built onto — but
      // nothing links to that page and the build no longer emits it.
      input: {
        main: resolve(import.meta.dirname, 'packages/client/index.html'),
      },
    },
  },
  server: {
    port: 5199,
  },
});
