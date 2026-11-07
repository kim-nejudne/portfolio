import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EMOJI, MAX_PLAYERS } from '#shared/constants.js';
import type { Category, Game, Place, Player } from '#shared/types.js';
import { CONTENT_SECURITY_POLICY, createApp, type AppOptions } from './http.js';
import { parseEnv } from './env.js';
import { createRoom, RoomStore } from './roomStore.js';
import { CategoryStore, loadCategoryStore } from './categoryStore.js';

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
    expect(res.headers.get('cache-control')).toBeNull(); // no browser keeps the 404
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
      easy: { city: 15, landmark: 15 },
      medium: { city: 15, landmark: 15 },
      hard: { city: 15, landmark: 15 },
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

describe('GET /api/config', () => {
  it('fills the CARTO template with the key and never logs it', async () => {
    const lines: string[] = [];
    const base = await start({ cartoKey: 'sekrit-key/1', log: (line) => lines.push(line) });
    const res = await fetch(`${base}/api/config?key=sekrit-key/1`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      tiles: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png?key=sekrit-key%2F1',
        attribution: '© OpenStreetMap contributors © CARTO',
        maxNativeZoom: 20,
      },
      fallbackTiles: {
        url: '/tiles/fallback/{z}/{x}/{y}.png',
        attribution: 'Made with Natural Earth',
        maxNativeZoom: 6,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20)); // the log line follows 'finish'
    expect(lines.some((line) => line.includes('/api/config'))).toBe(true);
    expect(lines.join('\n')).not.toMatch(/sekrit/);
  });

  it('returns tiles: null without a key', async () => {
    const base = await start();
    const res = await fetch(`${base}/api/config`);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.tiles).toBeNull();
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body.fallbackTiles).toMatchObject({ url: '/tiles/fallback/{z}/{x}/{y}.png' });
  });
});

describe('GET /tiles/fallback/:z/:x/:y.png', () => {
  // Three tiles: two land tiles and the shared water tile.
  async function tilesDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'pinpoint-tiles-'));
    await mkdir(join(dir, '0', '0'), { recursive: true });
    await mkdir(join(dir, '6', '33'), { recursive: true });
    await writeFile(join(dir, '0', '0', '0.png'), 'zoom0');
    await writeFile(join(dir, '6', '33', '21.png'), 'zoom6');
    await writeFile(join(dir, 'water.png'), 'water');
    return dir;
  }

  it('serves a rendered tile with long-lived cache headers', async () => {
    const base = await start({ fallbackTilesDir: await tilesDir() });
    for (const [path, body] of [
      ['0/0/0', 'zoom0'],
      ['6/33/21', 'zoom6'],
    ]) {
      const res = await fetch(`${base}/tiles/fallback/${path}.png`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/png');
      expect(res.headers.get('cache-control')).toBe('public, max-age=2592000, immutable');
      expect(await res.text()).toBe(body);
    }
  });

  it('serves the water tile for an address with no file', async () => {
    const base = await start({ fallbackTilesDir: await tilesDir() });
    const res = await fetch(`${base}/tiles/fallback/6/0/0.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=2592000, immutable');
    expect(await res.text()).toBe('water');
  });

  it('is 404 outside zoom 0–6 and the zoom grid', async () => {
    const base = await start({ fallbackTilesDir: await tilesDir() });
    for (const path of ['7/0/0', '0/1/0', '0/0/1', '3/8/0', '-1/0/0', 'a/0/0', '1/0/0.5']) {
      expect((await fetch(`${base}/tiles/fallback/${path}.png`)).status, path).toBe(404);
    }
  });

  it('is 404 when the tiles were never rendered', async () => {
    const base = await start({ fallbackTilesDir: join(tmpdir(), 'pinpoint-no-tiles') });
    expect((await fetch(`${base}/tiles/fallback/0/0/0.png`)).status).toBe(404);
  });
});

describe('dev tools (spec: Dev tools)', () => {
  it('in production, /dev/bots is 404 (not the client) and the dev fixture is not loaded', async () => {
    const env = parseEnv({ NODE_ENV: 'production' });
    const clientDir = await mkdtemp(join(tmpdir(), 'pinpoint-client-'));
    await writeFile(join(clientDir, 'index.html'), '<!doctype html><title>Pinpoint</title>');
    const rooms = new RoomStore();
    rooms.set(createRoom('ABCD', 0, 1));
    // As server/index.ts wires it.
    const base = await start({
      rooms,
      clientDir,
      devTools: !env.production,
      categories: await loadCategoryStore({
        dataDir: await mkdtemp(join(tmpdir(), 'pinpoint-data-')),
        production: env.production,
      }),
    });

    const res = await fetch(`${base}/dev/bots/ABCD`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found.' });
    expect((await fetch(`${base}/dev/anything`)).status).toBe(404);
    expect(await (await fetch(`${base}/api/categories`)).json()).toEqual([]);
  });

  it('outside production, /dev/bots is mounted and the dev fixture is served', async () => {
    const env = parseEnv({ NODE_ENV: 'development' });
    const base = await start({
      devTools: !env.production,
      categories: await loadCategoryStore({
        dataDir: await mkdtemp(join(tmpdir(), 'pinpoint-data-')),
        production: env.production,
      }),
    });

    const res = await fetch(`${base}/dev/bots/ABCD`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'No such room.' });
    expect(await (await fetch(`${base}/api/categories`)).json()).toEqual([
      expect.objectContaining({ id: 'world-dev' }),
    ]);
  });
});

describe('GET /api/photos/:token', () => {
  const TOKEN_A = 'aaaaaaaaaaaaaaaaaaaaaa';
  const TOKEN_B = 'bbbbbbbbbbbbbbbbbbbbbb';

  /** Rooms ABCD and EFGH, each with one photographed round, and their files on disk. */
  async function photoRooms() {
    const dir = await mkdtemp(join(tmpdir(), 'pinpoint-photos-'));
    for (const id of ['photo-a', 'photo-b']) {
      await writeFile(join(dir, `${id}.webp`), `full ${id}`);
      await writeFile(join(dir, `${id}-thumb.webp`), `thumb ${id}`);
    }
    const rooms = new RoomStore();
    const withPhoto = (code: string, token: string, photoId: string) => {
      const room = createRoom(code, 0, 1);
      room.game = { photoTokens: { [token]: { photoId, revealed: false } } } as unknown as Game;
      rooms.set(room);
    };
    withPhoto('ABCD', TOKEN_A, 'photo-a');
    withPhoto('EFGH', TOKEN_B, 'photo-b');
    return { dir, rooms };
  }

  it("serves the round's photo and thumbnail as private WebP that names nothing", async () => {
    const { dir, rooms } = await photoRooms();
    const base = await start({ rooms, photoDir: dir });
    for (const [path, body] of [
      [`/api/photos/${TOKEN_A}`, 'full photo-a'],
      [`/api/photos/${TOKEN_A}/thumb`, 'thumb photo-a'],
      [`/api/photos/${TOKEN_B}`, 'full photo-b'],
    ] as const) {
      const res = await fetch(`${base}${path}`);
      expect(res.status, path).toBe(200);
      expect(await res.text()).toBe(body);
      expect(res.headers.get('content-type')).toBe('image/webp');
      expect(res.headers.get('cache-control')).toBe('private, max-age=600');
      for (const h of ['etag', 'last-modified', 'content-disposition'])
        expect(res.headers.get(h), `${path} ${h}`).toBeNull();
    }
  });

  it("404s an unknown token, a photo id, a closed room's token and a missing file", async () => {
    const { dir, rooms } = await photoRooms();
    const base = await start({ rooms, photoDir: dir });
    const status = async (path: string) => (await fetch(`${base}${path}`)).status;
    expect(await status('/api/photos/cccccccccccccccccccccc')).toBe(404);
    expect(await status('/api/photos/photo-a')).toBe(404); // the photo id is not a token
    expect(await status('/api/photos/constructor')).toBe(404);
    expect(await status('/api/photos/__proto__/thumb')).toBe(404);
    // Room ABCD's token belongs to ABCD alone: once that room is gone it no longer serves.
    rooms.delete('ABCD');
    expect(await status(`/api/photos/${TOKEN_A}`)).toBe(404);
    expect(await status(`/api/photos/${TOKEN_B}`)).toBe(200);
    // A new game starts with no tokens, so the last game's 404.
    rooms.get('EFGH')!.game = { photoTokens: {} } as unknown as Game;
    expect(await status(`/api/photos/${TOKEN_B}`)).toBe(404);
    // A file gone from disk mid-game.
    rooms.get('EFGH')!.game = {
      photoTokens: { [TOKEN_B]: { photoId: 'gone', revealed: false } },
    } as unknown as Game;
    const res = await fetch(`${base}/api/photos/${TOKEN_B}`);
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBeNull(); // no browser keeps the 404
    expect(await res.json()).toEqual({ error: 'Not found.' });
  });

  it('keeps the token out of the request log', async () => {
    const lines: string[] = [];
    const { dir, rooms } = await photoRooms();
    const base = await start({ rooms, photoDir: dir, log: (l) => lines.push(l) });
    await (await fetch(`${base}/api/photos/${TOKEN_A}/thumb`)).text();
    expect(lines).toEqual([
      expect.stringMatching(/^GET \/api\/photos\/\[token\]\/thumb 200 \d+ms$/),
    ]);
  });

  it('allows 120 photo requests per IP per minute', async () => {
    let now = 0;
    const { dir, rooms } = await photoRooms();
    const base = await start({ rooms, photoDir: dir, clock: () => now });
    for (let i = 0; i < 120; i++) await (await fetch(`${base}/api/photos/${TOKEN_A}/thumb`)).text();
    expect((await fetch(`${base}/api/photos/${TOKEN_A}`)).status).toBe(429);
    now += 60_000;
    expect((await fetch(`${base}/api/photos/${TOKEN_A}`)).status).toBe(200);
  });
});

describe('GET /api/credits/:code', () => {
  const photo = (id: string) => ({
    id,
    width: 800,
    height: 600,
    author: `Author ${id}`,
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    commonsFile: `File:${id}.jpg`,
    sourceUrl: `https://commons.wikimedia.org/wiki/File:${id}.jpg`,
  });
  const place = (id: string, name: string) =>
    ({ id: `place-${id}`, kind: 'landmark', name, photo: photo(id) }) as unknown as Place;

  /**
   * Room ABCD: game 1 revealed old-1 (its place is only in a category now); game 2 has revealed
   * cur-1 and has cur-2 on screen, unrevealed. Every thumbnail is on disk.
   */
  async function creditRoom() {
    const dir = await mkdtemp(join(tmpdir(), 'pinpoint-credits-'));
    for (const id of ['old-1', 'cur-1', 'cur-2']) {
      await writeFile(join(dir, `${id}.webp`), `full ${id}`);
      await writeFile(join(dir, `${id}-thumb.webp`), `thumb ${id}`);
    }
    const categories = new CategoryStore([
      {
        id: 'old',
        live: { easy: { places: [place('old-1', 'Old Tower')] } },
        draft: {},
      } as unknown as Category,
      {
        id: 'drafted',
        live: {},
        draft: { hard: { places: [place('draft-1', 'Draft Fort')] } },
      } as unknown as Category,
    ]);
    const room = createRoom('ABCD', 0, 1);
    room.previousGames = [{ number: 1, revealedPhotoIds: ['old-1'] }];
    room.game = {
      pool: { easy: [place('cur-1', 'Current Bridge'), place('cur-2', 'Secret Temple')] },
      photoTokens: {
        aaaaaaaaaaaaaaaaaaaaaa: { photoId: 'cur-1', revealed: true },
        bbbbbbbbbbbbbbbbbbbbbb: { photoId: 'cur-2', revealed: false },
      },
    } as unknown as Game;
    const rooms = new RoomStore();
    rooms.set(room);
    return { dir, rooms, categories, room };
  }

  it("lists the previous and current games' revealed photos, never an unrevealed one", async () => {
    const { dir, rooms, categories } = await creditRoom();
    const base = await start({ rooms, categories, photoDir: dir });
    const res = await fetch(`${base}/api/credits/abcd`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({
      credits: [
        {
          name: 'Old Tower',
          author: 'Author old-1',
          licence: 'CC BY-SA 4.0',
          licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
          commonsFile: 'File:old-1.jpg',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:old-1.jpg',
          thumbUrl: '/api/credits/ABCD/0/thumb',
        },
        expect.objectContaining({ name: 'Current Bridge', thumbUrl: '/api/credits/ABCD/1/thumb' }),
      ],
    });
    for (const secret of ['cur-2', 'Secret Temple']) expect(text).not.toContain(secret);
  });

  it('serves only revealed thumbnails, by position', async () => {
    const { dir, rooms, categories } = await creditRoom();
    const base = await start({ rooms, categories, photoDir: dir });
    const get = (path: string) => fetch(`${base}${path}`);
    const first = await get('/api/credits/ABCD/0/thumb');
    expect(first.status).toBe(200);
    expect(first.headers.get('content-type')).toBe('image/webp');
    expect(first.headers.get('etag')).toBeNull();
    expect(await first.text()).toBe('thumb old-1');
    expect(await (await get('/api/credits/ABCD/1/thumb')).text()).toBe('thumb cur-1');
    // Position 2 would be cur-2, which is not revealed.
    for (const path of ['2', '-1', 'cur-2', 'constructor', '1.5'])
      expect((await get(`/api/credits/ABCD/${path}/thumb`)).status, path).toBe(404);
    expect((await get('/api/credits/WXYZ/0/thumb')).status).toBe(404);
  });

  it('lists a photo once revealed, finds one only in a draft, and leaves out one in no category', async () => {
    const { dir, rooms, categories, room } = await creditRoom();
    const base = await start({ rooms, categories, photoDir: dir });
    room.game!.photoTokens.bbbbbbbbbbbbbbbbbbbbbb!.revealed = true;
    room.previousGames.push({ number: 2, revealedPhotoIds: ['deleted', 'draft-1'] });
    const { credits } = (await (await fetch(`${base}/api/credits/ABCD`)).json()) as {
      credits: { name: string; thumbUrl: string }[];
    };
    // 'deleted' takes position 1, so the current game's photos keep their thumbnail positions.
    expect(credits.map((c) => [c.name, c.thumbUrl])).toEqual([
      ['Old Tower', '/api/credits/ABCD/0/thumb'],
      ['Draft Fort', '/api/credits/ABCD/2/thumb'], // now only in a draft
      ['Current Bridge', '/api/credits/ABCD/3/thumb'],
      ['Secret Temple', '/api/credits/ABCD/4/thumb'],
    ]);
  });

  it('answers an empty list before any reveal and 404 for an unknown room', async () => {
    const rooms = new RoomStore();
    rooms.set(createRoom('ABCD', 0, 1));
    const base = await start({ rooms });
    expect(await (await fetch(`${base}/api/credits/ABCD`)).json()).toEqual({ credits: [] });
    const res = await fetch(`${base}/api/credits/WXYZ`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'No such game.' });
    expect((await fetch(`${base}/api/credits/not-a-code`)).status).toBe(404);
  });

  it('shares the 30-per-minute lookup limit with exists checks', async () => {
    let now = 0;
    const rooms = new RoomStore();
    rooms.set(createRoom('ABCD', 0, 1));
    const base = await start({ rooms, clock: () => now });
    for (let i = 0; i < 15; i++) await (await fetch(`${base}/api/rooms/ABCD/exists`)).text();
    for (let i = 0; i < 15; i++) expect((await fetch(`${base}/api/credits/ABCD`)).status).toBe(200);
    const limited = await fetch(`${base}/api/credits/ABCD`);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'Too many tries. Wait a minute and try again.' });
    now += 60_000;
    expect((await fetch(`${base}/api/credits/ABCD`)).status).toBe(200);
  });
});
