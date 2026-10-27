import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT } from '../shared/constants.js';
import { createApp } from './http.js';
import { InMemoryRoomStore, startRoomSweeper } from './roomStore.js';
import { attachSockets } from './sockets.js';

const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || DEFAULT_PORT;

// In development Vite serves the client; in production the compiled server sits in dist/server.
const clientDir = production ? fileURLToPath(new URL('../client', import.meta.url)) : undefined;

// Behind a reverse proxy, set TRUST_PROXY (e.g. `1` for one hop) so rate limits see the client's IP.
const trustProxyEnv = process.env.TRUST_PROXY;
const trustProxy =
  trustProxyEnv === undefined || trustProxyEnv === ''
    ? false
    : /^\d+$/.test(trustProxyEnv)
      ? Number(trustProxyEnv)
      : trustProxyEnv;

// TODO(F07): pass the store to the socket layer when joining lands.
const rooms = new InMemoryRoomStore();
startRoomSweeper(rooms, Date.now);

const httpServer = createServer(createApp({ clientDir, rooms, clock: Date.now, trustProxy }));
attachSockets(httpServer);

httpServer.listen(port, () => {
  console.log(`Buzzr server listening on http://localhost:${port}`);
});
