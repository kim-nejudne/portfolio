// `/api/admin/categories` (F81): the category and word routes on a real CategoryStore in a temp
// folder. Each action, its validation errors (which name the field), the session check, the write
// guard, bulk paste, and edits reaching the next lobby list and new rooms.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AdminBulkResponse,
  AdminCategoryResponse,
  CreateRoomResponse,
} from '../shared/types.js';
import { AdminSessions } from './admin.js';
import { openAdminPassword } from './adminPassword.js';
import { openCategoryStore, type CategoryFs, type CategoryStore } from './categoryStore.js';
import { createApp } from './http.js';
import { InMemoryRoomStore } from './roomStore.js';
import { buildSnapshot, lobbyCategories } from './snapshot.js';
import { testHash } from './test/admin.js';
import { EN_PACK, SPICY_PACK } from './test/packs.js';

const CODE = 'pencil-moon-42';
const PASSWORD = 'a very long password';

let dir: string;
let servers: Server[] = [];
let store: CategoryStore;
let base: string;
let cookie: string;
let rooms: InMemoryRoomStore;

/** A server over a fresh store seeded with the two test packs, signed in. */
async function start(fs?: CategoryFs): Promise<void> {
  store = await openCategoryStore(dir, { seed: [EN_PACK, SPICY_PACK], fs });
  const { password } = await openAdminPassword(dir);
  rooms = new InMemoryRoomStore();
  const server = createApp({
    rooms,
    categories: store,
    clock: Date.now,
    admin: {
      setupCode: CODE,
      password,
      sessions: new AdminSessions(),
      hash: testHash,
      categories: store,
    },
  }).listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const res = await send('POST', '/setup', { setupCode: CODE, password: PASSWORD }, { cookie: '' });
  cookie = res.headers.getSetCookie()[0]!.split(';')[0]!;
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sketchy-admin-categories-'));
});

afterEach(async () => {
  await Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve))));
  servers = [];
  await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

interface SendOptions {
  cookie?: string;
  origin?: string | null;
  contentType?: string;
}

function send(method: string, path: string, body?: unknown, options: SendOptions = {}) {
  const headers: Record<string, string> = {
    'content-type': options.contentType ?? 'application/json',
  };
  if (options.origin !== null) headers.origin = options.origin ?? base;
  const c = options.cookie ?? cookie;
  if (c) headers.cookie = c;
  return fetch(`${base}/api/admin${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const get = (path: string, c = cookie) =>
  fetch(`${base}/api/admin${path}`, { headers: c ? { cookie: c } : {} });

/** The category file on disk, as the next start would read it. */
async function onDisk() {
  return JSON.parse(await readFile(store.path, 'utf8')) as {
    categories: { id: string; title: string; words: { word: string }[] }[];
  };
}

async function created(title = 'Space', emoji = '🚀'): Promise<string> {
  const res = await send('POST', '/categories', { title, emoji });
  expect(res.status).toBe(200);
  return ((await res.json()) as AdminCategoryResponse).category.id;
}

describe('session and write guard', () => {
  it('every category route needs a session (401)', async () => {
    await start();
    for (const [method, path] of [
      ['GET', '/categories'],
      ['GET', '/categories/test-en'],
      ['POST', '/categories'],
      ['PATCH', '/categories/test-en'],
      ['DELETE', '/categories/test-en'],
      ['POST', '/categories/test-en/words'],
      ['POST', '/categories/test-en/words/bulk'],
      ['PATCH', '/categories/test-en/words/apple'],
      ['DELETE', '/categories/test-en/words/apple'],
    ] as const) {
      const res =
        method === 'GET' ? await get(path, '') : await send(method, path, {}, { cookie: '' });
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(await res.json()).toEqual({ ok: false, error: 'Sign in as admin first.' });
    }
    expect((await onDisk()).categories).toHaveLength(2);
  });

  it('writes need this site’s Origin and a JSON body', async () => {
    await start();
    const cross = await send(
      'POST',
      '/categories',
      { title: 'X', emoji: '🚀' },
      {
        origin: 'https://evil.example',
      },
    );
    expect(cross.status).toBe(403);
    const form = await send('DELETE', '/categories/test-en', undefined, {
      contentType: 'application/x-www-form-urlencoded',
    });
    expect(form.status).toBe(415);
    const noOrigin = await send('PATCH', '/categories/test-en', { hidden: true }, { origin: null });
    expect(noOrigin.status).toBe(403);
    expect(store.read().map((c) => c.id)).toEqual(['test-en', 'test-spicy']);
  });

  it('a bad JSON body answers with a readable JSON error', async () => {
    await start();
    const res = await fetch(`${base}/api/admin/categories`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base, cookie },
      body: '{"title":',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Send the change as JSON.' });
    const big = await send('POST', '/categories', { title: 'x'.repeat(5000), emoji: '🚀' });
    expect([big.status, await big.json()]).toEqual([
      413,
      { ok: false, error: 'That is too much at once.' },
    ]);
  });
});

describe('categories', () => {
  it('lists every category in title order with emoji, word count and badges', async () => {
    await start();
    const res = await get('/categories');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const { categories } = (await res.json()) as { categories: unknown[] };
    expect(categories).toEqual(
      [
        {
          id: 'test-en',
          title: EN_PACK.title,
          emoji: '🎨',
          defaultOn: true,
          hidden: false,
          wordCount: EN_PACK.words.length,
        },
        {
          id: 'test-spicy',
          title: SPICY_PACK.title,
          emoji: '🎨',
          defaultOn: true,
          hidden: false,
          wordCount: SPICY_PACK.words.length,
        },
      ].sort((a, b) => a.title.localeCompare(b.title, 'en')),
    );
  });

  it('opens one category with its words, and 404s an unknown or malformed id', async () => {
    await start();
    const res = await get('/categories/test-en');
    const { category } = (await res.json()) as AdminCategoryResponse;
    expect(category.words.map((w) => w.word)).toEqual(EN_PACK.words.map((w) => w.word));
    expect(category.words[0]!.id).not.toContain('/');
    expect((await get('/categories/nope')).status).toBe(404);
    expect((await get('/categories/Bad%20Id')).status).toBe(404);
  });

  it('creates an empty category, off by default, and saves it to disk', async () => {
    await start();
    const res = await send('POST', '/categories', { title: '  Outer Space ', emoji: '🚀' });
    expect(await res.json()).toEqual({
      category: {
        id: 'outer-space',
        title: 'Outer Space',
        emoji: '🚀',
        defaultOn: false,
        hidden: false,
        words: [],
      },
    });
    expect((await onDisk()).categories.map((c) => c.id)).toContain('outer-space');
  });

  it('refuses a bad title or emoji, naming the field, and writes nothing', async () => {
    await start();
    for (const [body, field, error] of [
      [{ title: '', emoji: '🚀' }, 'title', 'Title is required'],
      [{ title: 'x'.repeat(41), emoji: '🚀' }, 'title', 'Title must be at most 40 characters'],
      [{ title: 'Space', emoji: 'ab' }, 'emoji', 'Emoji must be a single emoji'],
      [{ title: 'Space', emoji: '🚀🌙' }, 'emoji', 'Emoji must be a single emoji'],
      [{ title: 'Space' }, 'emoji', expect.stringMatching(/^Emoji /) as string],
      [{ title: 'Space', emoji: '🚀', id: 'x' }, 'id', 'Unknown field "id"'],
    ] as const) {
      const res = await send('POST', '/categories', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error, field });
    }
    expect((await onDisk()).categories).toHaveLength(2);
  });

  it('accepts emoji sequences, flags and keycaps', async () => {
    await start();
    for (const emoji of ['👩‍🔬', '🇯🇵', '🌶️', '#️⃣']) {
      expect((await send('POST', '/categories', { title: 'T', emoji })).status, emoji).toBe(200);
    }
  });

  it('renames, sets the emoji, defaultOn and hidden; the id stays', async () => {
    await start();
    const res = await send('PATCH', '/categories/test-en', {
      title: 'Starter',
      emoji: '⭐',
      defaultOn: false,
      hidden: true,
    });
    const { category } = (await res.json()) as AdminCategoryResponse;
    expect([
      category.id,
      category.title,
      category.emoji,
      category.defaultOn,
      category.hidden,
    ]).toEqual(['test-en', 'Starter', '⭐', false, true]);
    expect((await onDisk()).categories[0]!.title).toBe('Starter');
  });

  it('refuses an empty patch, a bad field, and an unknown category', async () => {
    await start();
    expect(await (await send('PATCH', '/categories/test-en', {})).json()).toEqual({
      ok: false,
      error: 'Send at least one change.',
    });
    expect(
      await (await send('PATCH', '/categories/test-en', { hidden: 'yes' })).json(),
    ).toMatchObject({
      field: 'hidden',
    });
    const missing = await send('PATCH', '/categories/nope', { hidden: true });
    expect([missing.status, await missing.json()]).toEqual([
      404,
      { ok: false, error: 'There is no such category.' },
    ]);
  });

  it('deletes a category', async () => {
    await start();
    const res = await send('DELETE', '/categories/test-spicy');
    expect(await res.json()).toEqual({ ok: true });
    expect((await onDisk()).categories.map((c) => c.id)).toEqual(['test-en']);
    expect((await send('DELETE', '/categories/test-spicy')).status).toBe(404);
  });
});

describe('words', () => {
  it('adds a word, medium with no alternates by default', async () => {
    await start();
    const id = await created();
    const res = await send('POST', `/categories/${id}/words`, { word: ' Rocket ' });
    const { category } = (await res.json()) as AdminCategoryResponse;
    expect(category.words).toEqual([{ id: 'rocket', word: 'Rocket', alt: [], difficulty: 2 }]);
  });

  it('adds a word with a level and up to 6 alternates', async () => {
    await start();
    const id = await created();
    const res = await send('POST', `/categories/${id}/words`, {
      word: 'spaceship',
      difficulty: 3,
      alt: ['space ship', 'rocket ship', 'ufo craft'],
    });
    expect(((await res.json()) as AdminCategoryResponse).category.words[0]).toEqual({
      id: 'spaceship',
      word: 'spaceship',
      alt: ['rocket ship', 'ufo craft'],
      difficulty: 3,
    });
  });

  it('refuses bad words with the field named, and writes nothing', async () => {
    await start();
    const id = await created();
    const before = await readFile(store.path, 'utf8');
    for (const [body, field, error, status] of [
      [{ word: '' }, 'word', 'Word is required', 400],
      [{ word: 'x'.repeat(31) }, 'word', 'Word must be at most 30 characters', 400],
      [{ word: 'ab' }, 'word', expect.stringMatching(/^Word must keep at least 3 letters/), 400],
      [{ word: 'moon', difficulty: 4 }, 'difficulty', 'Level must be easy, medium or hard', 400],
      [
        { word: 'moon', alt: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
        'alt',
        'Alternates can be at most 6',
        400,
      ],
      [
        { word: 'moon', alt: ['luna', '!!'] },
        'alt',
        expect.stringMatching(/^Alternate 2 must keep/),
        400,
      ],
      [{ word: 'moon', gloss: 'x' }, 'gloss', 'Unknown field "gloss"', 400],
    ] as const) {
      const res = await send('POST', `/categories/${id}/words`, body);
      expect(res.status, JSON.stringify(body)).toBe(status);
      expect(await res.json()).toEqual({ ok: false, error, field });
    }
    expect(await readFile(store.path, 'utf8')).toBe(before);
  });

  it('refuses a duplicate within the category (409) but allows one from another category', async () => {
    await start();
    const word = EN_PACK.words[0]!.word;
    const dup = await send('POST', '/categories/test-en/words', { word: word.toUpperCase() });
    expect(dup.status).toBe(409);
    expect(await dup.json()).toMatchObject({ field: 'word' });
    const id = await created();
    expect((await send('POST', `/categories/${id}/words`, { word })).status).toBe(200);
  });

  it('edits a word’s text, level and alternates, keeping its id', async () => {
    await start();
    const first = EN_PACK.words[0]!;
    const wordId = first.id.split('/')[1]!;
    const res = await send('PATCH', `/categories/test-en/words/${wordId}`, {
      word: 'greenhouse',
      difficulty: 3,
      alt: ['glasshouse'],
    });
    const { category } = (await res.json()) as AdminCategoryResponse;
    expect(category.words[0]).toEqual({
      id: wordId,
      word: 'greenhouse',
      alt: ['glasshouse'],
      difficulty: 3,
    });
    expect((await send('PATCH', '/categories/test-en/words/nope', { difficulty: 1 })).status).toBe(
      404,
    );
    const bad = await send('PATCH', `/categories/test-en/words/${wordId}`, { alt: ['?'] });
    expect(await bad.json()).toMatchObject({ ok: false, field: 'alt' });
  });

  it('deletes a word', async () => {
    await start();
    const wordId = EN_PACK.words[0]!.id.split('/')[1]!;
    const res = await send('DELETE', `/categories/test-en/words/${wordId}`);
    const { category } = (await res.json()) as AdminCategoryResponse;
    expect(category.words).toHaveLength(EN_PACK.words.length - 1);
    expect((await send('DELETE', `/categories/test-en/words/${wordId}`)).status).toBe(404);
  });

  it('404s a word route on an unknown category', async () => {
    await start();
    expect((await send('POST', '/categories/nope/words', { word: 'moon' })).status).toBe(404);
  });
});

describe('bulk paste', () => {
  it('adds the good lines, lists bad ones with the reason, and counts duplicates', async () => {
    await start();
    const id = await created();
    await send('POST', `/categories/${id}/words`, { word: 'moon' });
    const res = await send('POST', `/categories/${id}/words/bulk`, {
      text: [
        'rocket | easy',
        'astronaut | hard | spaceman, cosmonaut',
        'Moon',
        'comet | soon',
        'planet || world',
        'rocket',
        'ab',
      ].join('\n'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AdminBulkResponse;
    expect([body.added, body.duplicates]).toEqual([3, 2]);
    expect(body.errors).toEqual([
      { line: 4, text: 'comet | soon', reason: 'Level must be easy, medium or hard' },
      { line: 7, text: 'ab', reason: expect.stringMatching(/^Word must keep at least 3 letters/) },
    ]);
    expect(body.category.words.map((w) => [w.word, w.difficulty, w.alt])).toEqual([
      ['moon', 2, []],
      ['rocket', 1, []],
      ['astronaut', 3, ['spaceman', 'cosmonaut']],
      ['planet', 2, ['world']],
    ]);
    expect((await onDisk()).categories.at(-1)!.words).toHaveLength(4);
  });

  it('allows words other categories have', async () => {
    await start();
    const id = await created();
    const res = await send('POST', `/categories/${id}/words/bulk`, {
      text: EN_PACK.words.map((w) => w.word).join('\n'),
    });
    expect(((await res.json()) as AdminBulkResponse).added).toBe(EN_PACK.words.length);
  });

  it('refuses too many lines or a missing text, and an unknown category', async () => {
    await start();
    const many = Array.from({ length: 1001 }, (_, i) => `word${i}`).join('\n');
    const tooMany = await send('POST', '/categories/test-en/words/bulk', { text: many });
    expect([tooMany.status, await tooMany.json()]).toEqual([
      400,
      { ok: false, error: 'Paste at most 1000 lines at a time.', field: 'text' },
    ]);
    expect(await (await send('POST', '/categories/test-en/words/bulk', {})).json()).toMatchObject({
      field: 'text',
    });
    expect((await send('POST', '/categories/nope/words/bulk', { text: 'moon' })).status).toBe(404);
  });
});

describe('a failed write', () => {
  it('answers 500, keeps file and memory as they were, and logs no word', async () => {
    const real = (await import('node:fs/promises')).writeFile;
    let fail = false;
    await start({
      readFile: (p) => readFile(p, 'utf8'),
      writeFile: async (p, data) => {
        if (fail) throw new Error('disk full');
        await real(p, data, 'utf8');
      },
      rename: (await import('node:fs/promises')).rename,
      mkdir: (p) => import('node:fs/promises').then((fs) => fs.mkdir(p, { recursive: true })),
      remove: (p) => rm(p, { force: true }),
    });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fail = true;
    const res = await send('POST', '/categories/test-en/words', { word: 'zeppelin' });
    expect([res.status, await res.json()]).toEqual([
      500,
      { ok: false, error: 'Could not save the change. Try again.' },
    ]);
    expect(store.read()[0]!.words.some((w) => w.word === 'zeppelin')).toBe(false);
    expect(JSON.stringify(errors.mock.calls)).not.toContain('zeppelin');
  });
});

describe('edits reach the lobby and new games', () => {
  it('the next lobby list and a new snapshot see a new, picked category; a taken snapshot does not change', async () => {
    await start();
    const running = buildSnapshot(store.read(), ['test-en']);
    const id = await created('Space', '🚀');
    await send('POST', `/categories/${id}/words/bulk`, { text: 'rocket\nastronaut\nplanet' });
    expect(lobbyCategories(store.read()).find((c) => c.id === id)).toEqual({
      id,
      title: 'Space',
      emoji: '🚀',
      wordCount: 3,
      defaultOn: false,
    });
    const next = buildSnapshot(store.read(), [id]);
    expect(next.words.map((w) => w.id)).toEqual([
      `${id}/rocket`,
      `${id}/astronaut`,
      `${id}/planet`,
    ]);
    expect(running.categories.map((c) => c.id)).toEqual(['test-en']);

    // Hidden: gone from the lobby list and from a new game.
    await send('PATCH', `/categories/${id}`, { hidden: true });
    expect(lobbyCategories(store.read()).some((c) => c.id === id)).toBe(false);
    expect(buildSnapshot(store.read(), [id]).words).toEqual([]);
  });

  it('a new room can start with a category made in the admin (POST /api/rooms keeps the pick)', async () => {
    await start();
    const id = await created();
    const res = await fetch(`${base}/api/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ settings: { categories: [id] } }),
    });
    expect(res.status).toBe(201);
    const { code } = (await res.json()) as CreateRoomResponse;
    expect(rooms.get(code)!.settings.categories).toEqual([id]);
  });
});
