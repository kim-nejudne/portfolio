import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCategoryStore } from './categoryStore.js';
import { parseEnv } from './env.js';
import { createChecker } from './generate/checker.js';
import { generatorFor } from './generate/fake.js';
import { wikimediaClientFor } from './generate/fakeWikimedia.js';
import { GenerationError } from './generate/generator.js';
import { openGenerationHistory } from './generate/history.js';
import { createJobRunner, photosOver, pipelineLevel } from './generate/jobs.js';
import { emptyUsage } from './generate/pricing.js';
import { createWriter } from './generate/writer.js';
import type { WikimediaClient } from './generate/wikimedia.js';
import { createApp } from './http.js';
import { RATE_LIMITS } from '#shared/constants.js';
import { createRateLimiter } from './rateLimit.js';
import { RoomStore, startRoomSweeper } from './roomStore.js';
import { attachSockets } from './sockets.js';

const env = parseEnv();
// dist/server/index.js serves dist/client in production; development uses Vite's dev server.
const clientDir = env.production ? fileURLToPath(new URL('../client', import.meta.url)) : undefined;

if (env.adminPasswordHash !== null && env.production && env.trustProxy === false) {
  // Behind a proxy every visitor shares one IP, and req.protocol reads http while Origin says https.
  console.warn(
    'ADMIN_PASSWORD_HASH is set but TRUST_PROXY is not: behind a proxy, admin sign-in tries share one limit and admin writes (sign-in included) are refused with 403.',
  );
}

const rooms = new RoomStore();
// An invalid categories.json throws here, stopping the server with the file's name.
const categories = await loadCategoryStore({ dataDir: env.dataDir, production: env.production });
// One limiter for /exists, /credits and screen:join: 30 per IP per minute together.
const roomLookupLimiter = createRateLimiter(RATE_LIMITS.roomLookup, Date.now);

// One Wikimedia client for the whole server, so its one-at-a-time queue covers every request.
// Made on first use: without WIKIMEDIA_CONTACT it throws, and the admin sees why.
let wikimediaClient: WikimediaClient | undefined;
const wikimedia = () => (wikimediaClient ??= wikimediaClientFor(env));

// The fake generator under GENERATE_FAKE=1, the real one with PINPOINT_ANTHROPIC_API_KEY, else off.
const generation = generatorFor(env, (client) => ({
  writer: createWriter(client),
  checker: createChecker(client),
  // shortcut: no sign checker yet; the photo step that calls it arrives with F47.
  signChecker: {
    check: () =>
      Promise.reject(new GenerationError('The sign check is not built yet.', emptyUsage())),
  },
  fake: false,
}));
const history = openGenerationHistory(env.dataDir);
const jobs = createJobRunner({
  level: generation.generator && pipelineLevel(generation.generator, wikimedia),
  ...(generation.off ? { off: generation.off } : {}),
  store: categories,
  clock: Date.now,
  dailyLimit: env.generateDailyLimit,
  replaceDailyLimit: env.generateReplaceDailyLimit,
  photosFull: photosOver(join(env.dataDir, 'photos'), env.photosMaxMb),
  onEnded: (entry) => void history.record(entry),
});

const app = createApp({
  clientDir,
  trustProxy: env.trustProxy,
  rooms,
  categories,
  roomLookupLimiter,
  cartoKey: env.cartoKey,
  devTools: !env.production,
  adminPassword: env.adminPasswordHash,
  wikimedia,
  jobs,
  history,
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
