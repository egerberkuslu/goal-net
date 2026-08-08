import { defineConfig } from 'vite';

// The client is a workspace package; the repo root stays the place you run
// commands from, so point vite at the package and emit to the root dist/.
export default defineConfig({
  root: 'packages/client',
  publicDir: false,
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5199,
  },
});
