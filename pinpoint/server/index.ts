import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { loadCategoryStore } from './categoryStore.js';
import { parseEnv } from './env.js';
import { createChecker, createSignChecker } from './generate/checker.js';
import { generatorFor } from './generate/fake.js';
import { wikimediaClientFor } from './generate/fakeWikimedia.js';
import { openGenerationHistory } from './generate/history.js';
import { createJobRunner, photosOver, pipelineLevel } from './generate/jobs.js';
import { createWriter } from './generate/writer.js';
import type { WikimediaClient } from './generate/wikimedia.js';
import { createApp } from './http.js';
import { RATE_LIMITS } from '#shared/constants.js';
import { createRateLimiter } from './rateLimit.js';
import { RoomStore, startRoomSweeper } from './roomStore.js';
import { attachSockets } from './sockets.js';
import { photosDir, writeDevPhotos } from './photos.js';

const env = parseEnv();
// Built (dist/server/index.js) it serves dist/client, also outside production for the e2e smoke
// (dev fixture, GENERATE_FAKE); under tsx in development, Vite's dev server serves the client.
const built = import.meta.url.endsWith('.js');
const clientDir = built ? fileURLToPath(new URL('../client', import.meta.url)) : undefined;

if (env.adminPasswordHash !== null && env.production && env.trustProxy === false) {
  // Behind a proxy every visitor shares one IP, and req.protocol reads http while Origin says https.
  console.warn(
    'ADMIN_PASSWORD_HASH is set but TRUST_PROXY is not: behind a proxy, admin sign-in tries share one limit and admin writes (sign-in included) are refused with 403.',
  );
}

const rooms = new RoomStore();
// An invalid categories.json throws here, stopping the server with the file's name.
const categories = await loadCategoryStore({ dataDir: env.dataDir, production: env.production });
const photoDir = photosDir(env.dataDir);
if (!env.production) {
  const places = categories.list().flatMap((c) => Object.values(c.live).flatMap((l) => l.places));
  const written = await writeDevPhotos(photoDir, places);
  if (written) console.log(`Photos: rendered ${written} dev placeholder photo(s)`);
}
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
  signChecker: createSignChecker(client),
  fake: false,
}));
const history = openGenerationHistory(env.dataDir);
const photosFull = photosOver(photoDir, env.photosMaxMb);
const jobs = createJobRunner({
  level: generation.generator && pipelineLevel(generation.generator, wikimedia, photoDir),
  ...(generation.off ? { off: generation.off } : {}),
  store: categories,
  clock: Date.now,
  dailyLimit: env.generateDailyLimit,
  replaceDailyLimit: env.generateReplaceDailyLimit,
  photosFull,
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
  photoDir,
  jobs,
  history,
  signChecker: generation.generator?.signChecker ?? null,
  photosFull,
});
const server = createServer(app);
const gateway = attachSockets(server, {
  rooms,
  publicUrl: env.publicUrl,
  categories,
  trustProxy: env.trustProxy,
  roomLookupLimiter,
  photoDir,
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
