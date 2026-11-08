// Memory probe (F59): the peak resident memory of the built server through a full 12-player
// Picture game (a VIP over a real WebSocket and 11 /dev/bots) plus one admin photo swap, which
// sets `mem_limit` in deploy/compose.deploy.yaml (DECISIONS 67).
//
//   npm run build && cp -r server/fixtures dist/server/ && cp -r server/generate/fixtures dist/server/generate/
//   npx tsx scripts/mem-probe.ts
//
// It starts `dist/server/index.js` with the compose file's heap cap (--max-old-space-size=192),
// NODE_ENV=development (the bots and the dev fixture need it), GENERATE_FAKE=1 (fake writer,
// checker and Wikimedia: no network) and a temp DATA_DIR. The bots run inside the server process,
// so the figure over-counts what production holds. It samples /proc (Linux only) every 50 ms.
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io } from 'socket.io-client';
import { ADMIN_COOKIE, PLAYER_KEY_LENGTH } from '../shared/constants.js';
import type { Category, PlayerView, ScreenView } from '../shared/types.js';

const PORT = 3029;
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'probe-password';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const dataDir = mkdtempSync(join(tmpdir(), 'pinpoint-probe-'));
const hash = execFileSync('node', ['scripts/admin-hash.mjs'], { input: `${PASSWORD}\n` })
  .toString()
  .trim();
function boot(env: Record<string, string>, port: number) {
  return spawn('node', ['--max-old-space-size=192', '--conditions=dist', 'dist/server/index.js'], {
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      DATA_DIR: dataDir,
      TRUST_PROXY: '1',
      ...env,
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}
const readRss = (pid: number | undefined) =>
  Number(/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))?.[1] ?? 0);

async function waitForHealth(base: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (
      await fetch(`${base}/healthz`).then(
        (r) => r.ok,
        () => false,
      )
    )
      return;
    await sleep(100);
  }
  throw new Error('the server never answered /healthz');
}

// Production at rest (no dev fixture, so no placeholder photos rendered at start), for comparison.
const prod = boot({ NODE_ENV: 'production' }, PORT + 1);
await waitForHealth(`http://127.0.0.1:${PORT + 1}`);
await sleep(1000);
const prodIdle = readRss(prod.pid);
prod.kill('SIGTERM');

const child = boot(
  {
    NODE_ENV: 'development',
    GENERATE_FAKE: '1',
    WIKIMEDIA_CONTACT: 'probe@example.invalid',
    ADMIN_PASSWORD_HASH: hash,
  },
  PORT,
);

const rssKb = () => readRss(child.pid);
let peak = 0;
let peakAt = 'start';
let stage = 'start';
const sampler = setInterval(() => {
  const kb = rssKb();
  if (kb > peak) [peak, peakAt] = [kb, stage];
}, 50);

async function http(path: string, init: RequestInit = {}, cookie = ''): Promise<Response> {
  const headers = { 'content-type': 'application/json', origin: BASE, cookie };
  return fetch(BASE + path, { ...init, headers: { ...headers, ...init.headers } });
}

try {
  await waitForHealth(BASE);
  await sleep(500);
  const idle = rssKb();

  // ---- admin: sign in, generate a fake level, swap one landmark's photo
  stage = 'admin';
  const login = await http('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password: PASSWORD }),
  });
  const cookie = new RegExp(`${ADMIN_COOKIE}=[^;]+`).exec(login.headers.get('set-cookie') ?? '');
  if (!cookie) throw new Error(`admin login answered ${login.status}`);
  const gen = await http(
    '/api/admin/categories/generate',
    {
      method: 'POST',
      body: JSON.stringify({ name: 'Probe', guidance: '', levels: { easy: { count: 5 } } }),
    },
    cookie[0],
  );
  const { jobId } = (await gen.json()) as { jobId: string };
  let categoryId: string | null = null;
  for (let i = 0; i < 600 && !categoryId; i++) {
    await sleep(200);
    const { job } = (await (await http(`/api/admin/jobs/${jobId}`, {}, cookie[0])).json()) as {
      job: { state: string; categoryId: string | null };
    };
    if (job.state === 'done') categoryId = job.categoryId;
    else if (job.state !== 'running' && job.state !== 'queued') throw new Error(`job ${job.state}`);
  }
  if (!categoryId) throw new Error('the generation job never finished');
  stage = 'swap';
  const cat = (await (await http(`/api/admin/categories/${categoryId}`, {}, cookie[0])).json()) as {
    category: Category;
  };
  const places = cat.category.draft.easy?.places ?? [];
  const place = places.find((p) =>
    p.photoCandidates?.some((c) => c.commonsFile !== p.photo?.commonsFile),
  );
  const pick = place?.photoCandidates?.find((c) => c.commonsFile !== place.photo?.commonsFile);
  if (!place || !pick) throw new Error('no landmark with a second photo candidate');
  const swapped = await http(
    `/api/admin/categories/${categoryId}/levels/easy/places/${place.id}`,
    { method: 'PUT', body: JSON.stringify({ photoCandidate: pick.commonsFile }) },
    cookie[0],
  );
  if (!swapped.ok) throw new Error(`swap answered ${swapped.status} ${await swapped.text()}`);
  const afterAdmin = rssKb();

  // ---- game: Screen + VIP over WebSockets, 11 bots, 5 Picture rounds on World (dev)
  stage = 'game';
  const { code } = (await (await http('/api/rooms', { method: 'POST', body: '{}' })).json()) as {
    code: string;
  };
  const opts = { transports: ['websocket'], forceNew: true, reconnection: false };
  const screen = io(BASE, opts);
  const vip = io(BASE, opts);
  const photos = new Set<string>();
  screen.on('state', (v: ScreenView) => {
    const url = v.round?.prompt.kind === 'picture' ? v.round.prompt.photoUrl : null;
    if (url && !photos.has(url)) {
      photos.add(url);
      void fetch(BASE + url).then((r) => r.arrayBuffer());
    }
  });
  await screen.emitWithAck('screen:join', { code });
  const playerKey = randomBytes(16).toString('base64url').slice(0, PLAYER_KEY_LENGTH);
  const joined = await vip.emitWithAck('player:join', {
    code,
    playerKey,
    name: 'Probe',
    emoji: '🦊',
  });
  if (!joined.ok) throw new Error(`player:join ${JSON.stringify(joined)}`);
  const bots = await fetch(`${BASE}/dev/bots/${code}?count=11`);
  if (!bots.ok) throw new Error(`/dev/bots answered ${bots.status}`);
  const finished = new Promise<void>((resolve) => {
    vip.on('state', (v: PlayerView) => {
      if (v.phase === 'FINAL') resolve();
      if (v.phase === 'GUESSING' && v.round && !v.round.myLock && v.region) {
        const { south, north, west, east } = v.region.box;
        const at = { lat: (south + north) / 2, lng: Math.min(180, (west + east) / 2) };
        vip.emit('player:lockIn', at, () => {});
      }
      if (v.phase === 'REVEAL' || v.phase === 'SCOREBOARD') vip.emit('vip:next', {}, () => {});
    });
  });
  const categories = (await (await fetch(`${BASE}/api/categories`)).json()) as { id: string }[];
  const dev = categories.find((c) => c.id !== categoryId);
  if (!dev) throw new Error('no World (dev) category');
  const settings = {
    categoryId: dev.id,
    mode: 'picture',
    difficulty: 'easy',
    rounds: 5,
    timerSeconds: 20,
  };
  const set = await vip.emitWithAck('vip:settings', settings);
  const started = await vip.emitWithAck('vip:start', {});
  if (!set.ok || !started.ok) throw new Error(`start: ${JSON.stringify([set, started])}`);
  await Promise.race([
    finished,
    sleep(240_000).then(() => Promise.reject(new Error('the game never reached FINAL'))),
  ]);
  screen.close();
  vip.close();
  await sleep(500);

  const mb = (kb: number) => `${Math.round(kb / 1024)} MB`;
  console.log(
    `production idle ${mb(prodIdle)}, dev idle ${mb(idle)}, after admin ${mb(afterAdmin)}, end ${mb(rssKb())}`,
  );
  console.log(`peak ${mb(peak)} (during ${peakAt}), ${photos.size} photo(s) fetched`);
} finally {
  clearInterval(sampler);
  child.kill('SIGTERM');
  rmSync(dataDir, { recursive: true, force: true });
}
