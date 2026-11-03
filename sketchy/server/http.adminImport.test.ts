// `/api/admin/export` and `/api/admin/import` (F82) on a real CategoryStore in a temp folder:
// downloads with their file names, the export then import round trip, a repo pack importing, the
// id clash (409, then rename or replace), and invalid or oversized files refused with nothing
// written.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type {
  AdminCategoryResponse,
  AdminImportErrorBody,
  AdminImportResponse,
  AdminPackFile,
} from '../shared/types.js';
import { AdminSessions } from './admin.js';
import { openAdminPassword } from './adminPassword.js';
import { openCategoryStore, type CategoryFs, type CategoryStore } from './categoryStore.js';
import { createApp } from './http.js';
import { InMemoryRoomStore } from './roomStore.js';
import { packsDirFor } from './packs.js';
import { lobbyCategories } from './snapshot.js';
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
  dir = await mkdtemp(join(tmpdir(), 'sketchy-admin-import-'));
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
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
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

const REPO_PACKS = packsDirFor(import.meta.url, false);
const repoPackText = (id: string) => readFileSync(`${REPO_PACKS}/${id}.json`, 'utf8');

/** The file's bytes on disk, to prove a refused import wrote nothing. */
const fileBytes = () => readFile(store.path, 'utf8');

async function exported(id: string): Promise<{ res: Response; text: string }> {
  const res = await get(`/export/${id}`);
  return { res, text: await res.text() };
}

describe('session and write guard', () => {
  it('export and import need a session (401)', async () => {
    await start();
    for (const path of ['/export', '/export/test-en']) {
      const res = await get(path, '');
      expect(res.status, path).toBe(401);
    }
    const res = await send('POST', '/import', repoPackText('en-food'), { cookie: '' });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: 'Sign in as admin first.' });
    expect((await onDisk()).categories).toHaveLength(2);
  });

  it('import needs this site’s Origin and a JSON body', async () => {
    await start();
    const before = await fileBytes();
    const cross = await send('POST', '/import', repoPackText('en-food'), {
      origin: 'https://evil.example',
    });
    expect(cross.status).toBe(403);
    const form = await send('POST', '/import', repoPackText('en-food'), {
      contentType: 'text/plain',
    });
    expect(form.status).toBe(415);
    expect(await fileBytes()).toBe(before);
  });
});

describe('export', () => {
  it('downloads one category as pack-format JSON named sketchy-category-<id>.json', async () => {
    await start();
    const id = await created('Space', '🚀');
    await send('POST', `/categories/${id}/words`, { word: 'rocket', difficulty: 1 });
    await send('POST', `/categories/${id}/words`, { word: 'astronaut', alt: ['spaceman'] });
    const { res, text } = await exported(id);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    expect(res.headers.get('content-disposition')).toMatch(
      /^attachment; filename="?sketchy-category-space\.json"?$/,
    );
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(JSON.parse(text)).toEqual({
      schemaVersion: 1,
      id: 'space',
      title: 'Space',
      language: 'en',
      words: [
        { id: 'rocket', word: 'rocket', difficulty: 1 },
        { id: 'astronaut', word: 'astronaut', alt: ['spaceman'], difficulty: 2 },
      ],
    } satisfies AdminPackFile);
    // Pretty, like the seed packs, so it diffs well.
    expect(text).toContain('\n  "schemaVersion": 1,');
  });

  it('Export all downloads every category, hidden ones too, in one file', async () => {
    await start();
    await send('PATCH', '/categories/test-spicy', { hidden: true });
    const res = await get('/export');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(
      /^attachment; filename="?sketchy-categories\.json"?$/,
    );
    const packs = (await res.json()) as AdminPackFile[];
    expect(packs.map((p) => p.id)).toEqual(['test-en', 'test-spicy']);
    expect(packs[0]!.words.length).toBeGreaterThan(0);
  });

  it('404s an unknown or malformed id', async () => {
    await start();
    expect((await get('/export/nope')).status).toBe(404);
    expect((await get('/export/Bad!Id')).status).toBe(404);
  });

  it('a category named "export" or "import" still opens', async () => {
    await start();
    const id = await created('Export', '📦');
    expect(id).toBe('export');
    expect((await get('/categories/export')).status).toBe(200);
  });
});

describe('import', () => {
  it('export then import round trip: the same words, saved to disk', async () => {
    await start();
    const { text } = await exported('test-en');
    await send('DELETE', '/categories/test-en', {});
    const res = await send('POST', '/import', text);
    expect(res.status).toBe(200);
    const body = (await res.json()) as AdminImportResponse;
    expect(body.replaced).toBe(false);
    expect(body.category).toMatchObject({ id: 'test-en', emoji: '🎨', defaultOn: false });
    expect((await exported('test-en')).text).toBe(text);
    const disk = (await onDisk()).categories.find((c) => c.id === 'test-en');
    expect(disk?.words.length).toBe(body.category.words.length);
  });

  it('a repo pack imports, its rating ignored', async () => {
    await start();
    const text = repoPackText('en-food');
    expect(JSON.parse(text)).toHaveProperty('rating', 'family');
    const res = await send('POST', '/import', text);
    expect(res.status).toBe(200);
    const { category } = (await res.json()) as AdminImportResponse;
    expect(category).toMatchObject({ id: 'en-food', emoji: '🍔', hidden: false });
    expect(category).not.toHaveProperty('rating');
    expect(lobbyCategories(store.read()).map((c) => c.id)).toContain('en-food');
  });

  it('an id clash asks first (409 naming the category), then renames or replaces', async () => {
    await start();
    const { text } = await exported('test-en');
    await send('PATCH', '/categories/test-en', { emoji: '🍎', defaultOn: true });
    const before = await fileBytes();

    const asked = await send('POST', '/import', text);
    expect(asked.status).toBe(409);
    const clash = (await asked.json()) as AdminImportErrorBody;
    expect(clash).toMatchObject({ ok: false, field: 'id', clash: { id: 'test-en' } });
    expect(await fileBytes()).toBe(before);

    const renamed = await send('POST', '/import?onClash=rename', text);
    expect(renamed.status).toBe(200);
    expect(((await renamed.json()) as AdminImportResponse).category.id).toBe('test-en-2');
    expect((await onDisk()).categories.map((c) => c.id)).toEqual([
      'test-en',
      'test-spicy',
      'test-en-2',
    ]);

    const edited = { ...(JSON.parse(text) as AdminPackFile), title: 'Fresh words' };
    edited.words = edited.words.slice(0, 3);
    const replaced = await send('POST', '/import?onClash=replace', edited);
    expect(replaced.status).toBe(200);
    const body = (await replaced.json()) as AdminImportResponse;
    expect(body.replaced).toBe(true);
    expect(body.category).toMatchObject({
      id: 'test-en',
      title: 'Fresh words',
      emoji: '🍎',
      defaultOn: true,
    });
    expect(body.category.words).toHaveLength(3);
    expect((await onDisk()).categories.map((c) => c.id)).toEqual([
      'test-en',
      'test-spicy',
      'test-en-2',
    ]);
  });

  it('refuses an unknown or repeated onClash', async () => {
    await start();
    const res = await send('POST', '/import?onClash=merge', repoPackText('en-food'));
    expect(res.status).toBe(400);
    expect((await res.json()) as AdminImportErrorBody).toMatchObject({ field: 'onClash' });
    const twice = await send(
      'POST',
      '/import?onClash=rename&onClash=replace',
      repoPackText('en-food'),
    );
    expect(twice.status).toBe(400);
    expect(store.read().map((c) => c.id)).toEqual(['test-en', 'test-spicy']);
  });

  it('refuses an invalid file with the store’s messages, and writes nothing', async () => {
    await start();
    const before = await fileBytes();
    const pack = JSON.parse(repoPackText('en-food')) as AdminPackFile & Record<string, unknown>;
    pack.language = 'sv' as 'en';
    (pack.words[1] as Record<string, unknown>).gloss = 'a fruit';
    pack.words[2]!.word = 'ab';
    const res = await send('POST', '/import', pack);
    expect(res.status).toBe(400);
    const body = (await res.json()) as AdminImportErrorBody;
    expect(body.error).toBe('This file is not a valid category.');
    expect(body.issues).toHaveLength(3);
    expect(body.issues!.join('\n')).toMatch(/^language: /m);
    expect(body.issues!.join('\n')).toMatch(/^words\.1: .*gloss/m);
    expect(body.issues!.join('\n')).toMatch(/^words\.2\.word: must keep at least 3 letters/m);
    expect(await fileBytes()).toBe(before);
    expect(store.read().map((c) => c.id)).toEqual(['test-en', 'test-spicy']);
  });

  it('refuses a file that is not JSON, or an Export all file', async () => {
    await start();
    const before = await fileBytes();
    const broken = await send('POST', '/import', '{"schemaVersion": 1, "id": ');
    expect(broken.status).toBe(400);
    expect(await broken.json()).toEqual({ ok: false, error: 'This file is not valid JSON.' });
    const all = await (await get('/export')).text();
    const several = await send('POST', '/import', all);
    expect(several.status).toBe(400);
    expect(((await several.json()) as AdminImportErrorBody).error).toMatch(/Export all/);
    expect(await fileBytes()).toBe(before);
  });

  it('caps the file at 256 KB (413), and writes nothing', async () => {
    await start();
    const before = await fileBytes();
    const pack = JSON.parse(repoPackText('en-food')) as AdminPackFile;
    const text = JSON.stringify(pack);
    // Just over: padded with whitespace, which JSON allows.
    const over = text.replace(/}$/, `${' '.repeat(256 * 1024 - text.length + 1)}}`);
    expect(Buffer.byteLength(over)).toBe(256 * 1024 + 1);
    const res = await send('POST', '/import', over);
    expect(res.status).toBe(413);
    expect(((await res.json()) as AdminImportErrorBody).error).toMatch(/over 256 KB/);
    expect(await fileBytes()).toBe(before);
    // Exactly at the cap is fine.
    const at = text.replace(/}$/, `${' '.repeat(256 * 1024 - text.length)}}`);
    expect((await send('POST', '/import', at)).status).toBe(200);
  });

  it('a failed write keeps the file and memory, and logs no word', async () => {
    let fail = false;
    const fs: CategoryFs = {
      readFile: (p) => readFile(p, 'utf8'),
      writeFile: async (p, d) => {
        if (fail) throw new Error('disk full: banana');
        const { writeFile } = await import('node:fs/promises');
        await writeFile(p, d);
      },
      rename: async (a, b) => (await import('node:fs/promises')).rename(a, b),
      mkdir: async (p) => (await import('node:fs/promises')).mkdir(p, { recursive: true }),
      remove: async (p) => (await import('node:fs/promises')).rm(p, { force: true }),
    };
    await start(fs);
    fail = true;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await send('POST', '/import', repoPackText('en-food'));
    expect(res.status).toBe(500);
    expect(store.read().map((c) => c.id)).toEqual(['test-en', 'test-spicy']);
    expect(JSON.stringify(errors.mock.calls)).not.toMatch(/banana/);
  });
});
