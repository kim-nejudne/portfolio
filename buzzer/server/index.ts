import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT, ROOM_EXPIRED_REASON, ROOM_SWEEP_INTERVAL_MS } from '../shared/constants.js';
import { createApp } from './http.js';
import { InMemoryImageStore } from './imageStore.js';
import { InMemoryRoomStore, startRoomSweeper } from './roomStore.js';
import { attachSockets, closeRooms } from './sockets.js';

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

const rooms = new InMemoryRoomStore();
const images = new InMemoryImageStore();

const httpServer = createServer(
  createApp({ clientDir, rooms, images, clock: Date.now, trustProxy }),
);
const io = attachSockets(httpServer, { rooms, clock: Date.now, trustProxy });

// An expired room frees its images, and every device still in it shows "This game has ended".
startRoomSweeper(rooms, Date.now, ROOM_SWEEP_INTERVAL_MS, (codes) => {
  for (const code of codes) images.deleteRoom(code);
  closeRooms(io, codes, ROOM_EXPIRED_REASON);
});

httpServer.listen(port, () => {
  console.log(`Buzzr server listening on http://localhost:${port}`);
});
