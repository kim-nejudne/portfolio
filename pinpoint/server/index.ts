import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { parseEnv } from './env.js';
import { createApp } from './http.js';
import { RoomStore, startRoomSweeper } from './roomStore.js';

const env = parseEnv();
// dist/server/index.js serves dist/client in production; development uses Vite's dev server.
const clientDir = env.production ? fileURLToPath(new URL('../client', import.meta.url)) : undefined;

const rooms = new RoomStore();
startRoomSweeper(rooms, Date.now);

const app = createApp({ clientDir, trustProxy: env.trustProxy, rooms });
const server = createServer(app);

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
