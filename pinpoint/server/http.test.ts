import { mkdtemp, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EMOJI, MAX_PLAYERS } from '#shared/constants.js';
import type { Player } from '#shared/types.js';
import { CONTENT_SECURITY_POLICY, createApp, type AppOptions } from './http.js';
import { RoomStore } from './roomStore.js';
import { loadCategoryStore } from './categoryStore.js';

let server: Server | undefined;

async function start(options: AppOptions = {}): Promise<string> {
  server = createApp({ log: () => {}, ...options }).listen(0);
  await new Promise<void>((resolve) => server!.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

describe('createApp', () => {
  it('answers /healthz with {ok: true}', async () => {
    const base = await start();
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('keeps an unknown API path a 404', async () => {
    const base = await start();
    const res = await fetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found.' });
  });

  it('serves the client for client routes but never for /api', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pinpoint-client-'));
    await writeFile(join(dir, 'index.html'), '<!doctype html><title>Pinpoint</title>');
    const base = await start({ clientDir: dir });

    const page = await fetch(`${base}/play/ABCD`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<title>Pinpoint</title>');

    expect((await fetch(`${base}/api/rooms/ABCD/missing`)).status).toBe(404);
  });

  it('does not advertise Express', async () => {
    const base = await start();
    const res = await fetch(`${base}/healthz`);
    expect(res.headers.get('x-powered-by')).toBeNull();
  });
});

describe('GET /api/categories', () => {
  it('lists live categories with counts but never places or drafts', async () => {
    // The dev fixture (no categories.json in an empty dir, outside production).
    const dir = await mkdtemp(join(tmpdir(), 'pinpoint-data-'));
    const base = await start({
      categories: await loadCategoryStore({ dataDir: dir, production: false }),
    });
    const res = await fetch(`${base}/api/categories`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body).toHaveLength(1);
    expect(Object.keys(body[0]!).sort()).toEqual([
      'box',
      'counts',
      'emoji',
      'id',
      'labelStyle',
      'name',
    ]);
    expect(body[0]!.counts).toEqual({
      easy: { city: 15, landmark: 0 },
      medium: { city: 15, landmark: 0 },
      hard: { city: 15, landmark: 0 },
    });
    const text = JSON.stringify(body);
    for (const leak of ['Tokyo', 'places', 'draft', 'lat', 'Q9']) expect(text).not.toContain(leak);
  });

  it('is an empty list without a store', async () => {
    const base = await start();
    expect(await (await fetch(`${base}/api/categories`)).json()).toEqual([]);
  });
});

describe('rooms', () => {
  it('creates a room with a fresh 4-letter code and stores it in LOBBY', async () => {
    const rooms = new RoomStore();
    const base = await start({ rooms, clock: () => 5000 });
    const res = await fetch(`${base}/api/rooms`, { method: 'POST' });
    expect(res.status).toBe(201);
    const { code } = (await res.json()) as { code: string };
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    expect(rooms.get(code)).toMatchObject({ phase: 'LOBBY', createdAt: 5000 });
  });

  it('refuses the 11th room from one IP within an hour with 429, then allows it after', async () => {
    let now = 0;
    const base = await start({ clock: () => now });
    const create = () => fetch(`${base}/api/rooms`, { method: 'POST' });
    for (let i = 0; i < 10; i++) expect((await create()).status).toBe(201);
    const refused = await create();
    expect(refused.status).toBe(429);
    expect(await refused.json()).toHaveProperty('error');
    now = 60 * 60_000;
    expect((await create()).status).toBe(201);
  });

  it('reports exists, phase, full and the taken emoji for any case of the code', async () => {
    const rooms = new RoomStore();
    const base = await start({ rooms });
    const { code } = (await (await fetch(`${base}/api/rooms`, { method: 'POST' })).json()) as {
      code: string;
    };

    const check = async (c: string) => (await fetch(`${base}/api/rooms/${c}/exists`)).json();
    expect(await check(code.toLowerCase())).toEqual({
      exists: true,
      phase: 'LOBBY',
      full: false,
      takenEmoji: [],
    });
    expect(await check(code === 'ZZZZ' ? 'YYYY' : 'ZZZZ')).toEqual({
      exists: false,
      phase: null,
      full: false,
      takenEmoji: [],
    });
    expect(await check('nope!')).toEqual({
      exists: false,
      phase: null,
      full: false,
      takenEmoji: [],
    });

    const room = rooms.get(code)!;
    for (let i = 0; i < MAX_PLAYERS; i++)
      room.players[`p${i}`] = { id: `p${i}`, emoji: EMOJI[i] } as Player;
    expect(await check(code)).toEqual({
      exists: true,
      phase: 'LOBBY',
      full: true,
      takenEmoji: EMOJI.slice(0, MAX_PLAYERS),
    });
  });

  it('limits exists checks to 30 per IP per minute with the shared lookup limiter', async () => {
    let now = 0;
    const base = await start({ clock: () => now });
    const check = () => fetch(`${base}/api/rooms/ABCD/exists`);
    for (let i = 0; i < 30; i++) expect((await check()).status).toBe(200);
    expect((await check()).status).toBe(429);
    now = 60_000;
    expect((await check()).status).toBe(200);
  });
});

describe('client IP', () => {
  const createFrom = (base: string, ip: string) =>
    fetch(`${base}/api/rooms`, { method: 'POST', headers: { 'X-Forwarded-For': ip } });

  it('keys limits on X-Forwarded-For only with TRUST_PROXY', async () => {
    const base = await start({ trustProxy: 1 });
    for (let i = 0; i < 10; i++) expect((await createFrom(base, '203.0.113.1')).status).toBe(201);
    expect((await createFrom(base, '203.0.113.1')).status).toBe(429);
    expect((await createFrom(base, '203.0.113.2')).status).toBe(201);
  });

  it('ignores X-Forwarded-For without TRUST_PROXY', async () => {
    const base = await start();
    for (let i = 0; i < 10; i++)
      expect((await createFrom(base, `203.0.113.${i}`)).status).toBe(201);
    expect((await createFrom(base, '203.0.113.99')).status).toBe(429);
  });
});

describe('security headers and logging', () => {
  it('turns an Express error into a JSON reply and a redacted log line', async () => {
    const lines: string[] = [];
    const empty = await mkdtemp(join(tmpdir(), 'pinpoint-empty-'));
    const base = await start({ clientDir: empty, log: (line) => lines.push(line) });
    const res = await fetch(`${base}/play/ABCD?key=sk-secret`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found.' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(lines.some((l) => l.startsWith('ERROR GET /play/ABCD?key=[redacted]'))).toBe(true);
    expect(lines.join()).not.toContain('sk-secret');
  });

  it('sends the CSP and Referrer-Policy on every response', async () => {
    const base = await start();
    for (const res of [
      await fetch(`${base}/healthz`),
      await fetch(`${base}/api/nope`),
      await fetch(`${base}/api/rooms`, { method: 'POST' }),
    ]) {
      expect(res.headers.get('content-security-policy')).toBe(CONTENT_SECURITY_POLICY);
      expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    }
    expect(CONTENT_SECURITY_POLICY).toContain(
      "img-src 'self' https://*.basemaps.cartocdn.com https://upload.wikimedia.org data:",
    );
    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'self'");
  });

  it('logs each request with every key= value redacted', async () => {
    const lines: string[] = [];
    const base = await start({ log: (line) => lines.push(line) });
    await (await fetch(`${base}/api/nope?key=sk-secret-1&x=1&KEY=sk-secret-2`)).text();
    await new Promise((resolve) => setImmediate(resolve));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^GET \/api\/nope\?key=\[redacted\]&x=1&KEY=\[redacted\] 404 \d+ms$/);
    expect(lines.join()).not.toContain('sk-secret');
  });
});
