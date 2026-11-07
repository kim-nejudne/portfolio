import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { loadCategoryStore } from './categoryStore.js';
import { parseEnv } from './env.js';
import { createApp } from './http.js';
import { RATE_LIMITS } from '#shared/constants.js';
import { createRateLimiter } from './rateLimit.js';
import { RoomStore, startRoomSweeper } from './roomStore.js';
import { attachSockets } from './sockets.js';

const env = parseEnv();
// dist/server/index.js serves dist/client in production; development uses Vite's dev server.
const clientDir = env.production ? fileURLToPath(new URL('../client', import.meta.url)) : undefined;

const rooms = new RoomStore();
// An invalid categories.json throws here, stopping the server with the file's name.
const categories = await loadCategoryStore({ dataDir: env.dataDir, production: env.production });
// One limiter for /exists, /credits and screen:join: 30 per IP per minute together.
const roomLookupLimiter = createRateLimiter(RATE_LIMITS.roomLookup, Date.now);

const app = createApp({
  clientDir,
  trustProxy: env.trustProxy,
  rooms,
  categories,
  roomLookupLimiter,
  cartoKey: env.cartoKey,
  devTools: !env.production,
});
const server = createServer(app);
const gateway = attachSockets(server, {
  rooms,
  publicUrl: env.publicUrl,
  categories,
  trustProxy: env.trustProxy,
  roomLookupLimiter,
});
startRoomSweeper(rooms, Date.now, gateway.closeRooms);

server.listen(env.port, () => {
  console.log(`Pinpoint listening on :${env.port}${env.production ? '' : ' (development)'}`);
});

// Stop quickly on SIGTERM (docker stop): rooms live in memory, so there is nothing to flush.
function shutdown(signal: string): void {
  console.log(`${signal}: shutting down`);
  server.close(() => process.exit(0));
  server.closeAllConnections();
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
