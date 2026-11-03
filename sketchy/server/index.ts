import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT } from '../shared/constants.js';
import { openCategoryStoreForStart } from './categoryStore.js';
import { openAdminPassword } from './adminPassword.js';
import {
  ADMIN_SETUP_CODE_ADVISED,
  devToolsEnabled,
  parseAdminSetupCode,
  parseDataDir,
  parseTrustProxy,
} from './env.js';
import { createApp } from './http.js';
import { attachInkGateway } from './inkGateway.js';
import { loadPacksForStart, packsDirFor } from './packs.js';
import { InMemoryRoomStore, startRoomSweeper } from './roomStore.js';
import { attachSockets, closeRooms } from './sockets.js';

const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || DEFAULT_PORT;
// Behind nginx in production: TRUST_PROXY=1 so rate limits key on the client's address.
const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
if (production && trustProxy === false) {
  // Behind nginx every phone would share one address, and with it 10 new joins a minute for the site.
  console.warn('TRUST_PROXY is not set: behind a proxy, every player shares one rate limit.');
}

// In development Vite serves the client; in production the compiled server sits in dist/server.
const clientDir = production ? fileURLToPath(new URL('../client', import.meta.url)) : undefined;

// Word packs are checked before anything listens: an invalid pack stops the server here.
const loaded = loadPacksForStart(packsDirFor(import.meta.url, production));
if (!loaded.ok) {
  console.error(loaded.message);
  process.exit(1);
}
console.log(loaded.summary);

// The CategoryStore in DATA_DIR, seeded from the packs only when categories.json is missing. A
// malformed file stops the server here rather than being replaced, so edits are never lost.
// Rooms read it for the lobby's picker and snapshot it when a game starts (F78).
const dataDir = parseDataDir(process.env.DATA_DIR);
const opened = await openCategoryStoreForStart(dataDir, loaded.packs);
if (!opened.ok) {
  console.error(opened.message);
  process.exit(1);
}
console.log(opened.summary);

// The admin (F80): the setup code from the environment, the password hash from DATA_DIR/admin.env.
// Neither is ever logged; only which mode /admin is in.
const adminSetupCode = parseAdminSetupCode(process.env.SKETCHY_ADMIN_SETUP_CODE);
if (adminSetupCode !== null && adminSetupCode.length < ADMIN_SETUP_CODE_ADVISED) {
  // It also resets the password, for good: a short one can be guessed, 5 tries a minute per IP.
  console.warn(
    `SKETCHY_ADMIN_SETUP_CODE is shorter than ${ADMIN_SETUP_CODE_ADVISED} characters: use a long random one.`,
  );
}
const adminPassword = await openAdminPassword(dataDir);
if (adminPassword.warning) console.warn(adminPassword.warning);
console.log(
  adminPassword.password.current() !== null
    ? 'Admin: password set.'
    : adminSetupCode !== null
      ? 'Admin: setup mode (no password yet).'
      : 'Admin: not configured (no SKETCHY_ADMIN_SETUP_CODE and no password).',
);

const rooms = new InMemoryRoomStore();
const httpServer = createServer(
  createApp({
    // A new room's default categories come from the store.
    categories: opened.store,
    clientDir,
    rooms,
    clock: Date.now,
    trustProxy,
    dev: devToolsEnabled(process.env.NODE_ENV),
    admin: { setupCode: adminSetupCode, password: adminPassword.password },
  }),
);

// The ink gateway needs `io`, and `io` needs the ink effects handler. Effects only run once a
// socket acts, by which time `inkGateway` is set.
const { io } = attachSockets(httpServer, {
  rooms,
  categories: opened.store,
  trustProxy,
  onInk: (code, effect) => inkGateway.onInk(code, effect),
});
const inkGateway = attachInkGateway(io, { rooms });

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
