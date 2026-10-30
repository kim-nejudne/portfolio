import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT } from '../shared/constants.js';
import { parseTrustProxy } from './env.js';
import { createApp } from './http.js';
import { InMemoryRoomStore, startRoomSweeper } from './roomStore.js';

const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || DEFAULT_PORT;
// Behind nginx in production: TRUST_PROXY=1 so rate limits key on the client's address.
const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);

// In development Vite serves the client; in production the compiled server sits in dist/server.
const clientDir = production ? fileURLToPath(new URL('../client', import.meta.url)) : undefined;

const rooms = new InMemoryRoomStore();
const httpServer = createServer(createApp({ clientDir, rooms, clock: Date.now, trustProxy }));

const stopSweeper = startRoomSweeper(rooms, Date.now);

httpServer.listen(port, () => {
  console.log(`Sketchy server listening on http://localhost:${port}`);
});

// In a container Node is PID 1, which ignores SIGTERM and SIGINT unless handled, so `docker stop` would wait 10 s.
const shutdown = (signal: NodeJS.Signals) => {
  console.log(`${signal}: shutting down`);
  stopSweeper();
  httpServer.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
