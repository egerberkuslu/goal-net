// Entry point: node packages/server/src/index.mjs
import { loadConfig } from './config.mjs';
import { createServer } from './app.mjs';

const config = loadConfig();
const server = createServer(config);

server.listen(config.port, config.host, () => {
  console.log(`goalnet server on http://${config.host}:${config.port}`);
  console.log(`  static   ${config.distDir}${config.spaFallback ? ' (SPA fallback on)' : ''}`);
  console.log(`  turn     realm=${config.turn.realm} host=${config.turn.host} `
    + `secret=${config.turn.secret ? 'set' : 'MISSING'}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    // Docker gives us ten seconds; do not outlive that waiting on keep-alives.
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
