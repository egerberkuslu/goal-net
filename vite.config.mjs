import { resolve } from 'node:path';
import { defineConfig } from 'vite';

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
  publicDir: false,
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'packages/client/index.html'),
        arena: resolve(import.meta.dirname, 'packages/client/arena.html'),
      },
    },
  },
  server: {
    port: 5199,
  },
});
