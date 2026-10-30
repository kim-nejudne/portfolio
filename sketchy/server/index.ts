import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT } from '../shared/constants.js';
import { devToolsEnabled, parseTrustProxy } from './env.js';
import { createApp } from './http.js';
import { attachInkGateway } from './inkGateway.js';
import { loadPacksForStart, packsDirFor } from './packs.js';
import { InMemoryRoomStore, startRoomSweeper } from './roomStore.js';
import { attachSockets, closeRooms } from './sockets.js';

const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || DEFAULT_PORT;
// Behind nginx in production: TRUST_PROXY=1 so rate limits key on the client's address.
const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);

// In development Vite serves the client; in production the compiled server sits in dist/server.
const clientDir = production ? fileURLToPath(new URL('../client', import.meta.url)) : undefined;

// Word packs are checked before anything listens: an invalid pack stops the server here.
const loaded = loadPacksForStart(packsDirFor(import.meta.url, production));
if (!loaded.ok) {
  console.error(loaded.message);
  process.exit(1);
}
console.log(loaded.summary);

const rooms = new InMemoryRoomStore();
const httpServer = createServer(
  createApp({
    // Every room deals from these, shared and frozen.
    packs: loaded.packs,
    clientDir,
    rooms,
    clock: Date.now,
    trustProxy,
    dev: devToolsEnabled(process.env.NODE_ENV),
  }),
);

// The ink gateway needs `io`, and `io` needs the ink effects handler. Effects only run once a
// socket acts, by which time `inkGateway` is set.
const { io, dispatch } = attachSockets(httpServer, {
  rooms,
  onInk: (code, effect) => inkGateway.onInk(code, effect),
});
const inkGateway = attachInkGateway(io, { rooms, dispatch });

const stopSweeper = startRoomSweeper(rooms, Date.now, undefined, (codes) => {
  for (const code of codes) inkGateway.forget(code);
  closeRooms(io, codes, 'expired');
});

httpServer.listen(port, () => {
  console.log(`Sketchy server listening on http://localhost:${port}`);
});

// In a container Node is PID 1, which ignores SIGTERM and SIGINT unless handled, so `docker stop` would wait 10 s.
const shutdown = (signal: NodeJS.Signals) => {
  console.log(`${signal}: shutting down`);
  stopSweeper();
  // Closes every socket and the HTTP server with it.
  void io.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
