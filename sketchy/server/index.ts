import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT } from '../shared/constants.js';
import { createApp } from './http.js';

const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || DEFAULT_PORT;

// In development Vite serves the client; in production the compiled server sits in dist/server.
const clientDir = production ? fileURLToPath(new URL('../client', import.meta.url)) : undefined;

const httpServer = createServer(createApp({ clientDir }));

httpServer.listen(port, () => {
  console.log(`Sketchy server listening on http://localhost:${port}`);
});

// In a container Node is PID 1, which ignores SIGTERM and SIGINT unless handled, so `docker stop` would wait 10 s.
const shutdown = (signal: NodeJS.Signals) => {
  console.log(`${signal}: shutting down`);
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
