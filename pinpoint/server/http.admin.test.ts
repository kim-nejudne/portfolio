import { execFile } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADMIN_COOKIE, ADMIN_SESSION_MS, RATE_LIMITS } from '#shared/constants.js';
import {
  ADMIN_RATE_LIMITED_ERROR,
  ADMIN_WRONG_PASSWORD_ERROR,
  AdminSessions,
  WIKIDATA_SEARCH_LIMITED_ERROR,
  PHOTOS_NOT_SET_UP_ERROR,
  verifyAdminPassword,
} from './admin.js';
import type {
  AdminCategoryResponse,
  AdminHistoryResponse,
  AdminJobResponse,
  AdminJobsResponse,
  AdminPublishResponse,
  AdminWikidataSearchResponse,
  Category,
  Place,
} from '#shared/types.js';
import { CategoryStore } from './categoryStore.js';
import { parseEnv } from './env.js';
import { createApp, type AppOptions } from './http.js';
import { GENERATION_OFF_NO_KEY, fakeGenerator } from './generate/fake.js';
import { HISTORY_FILE, openGenerationHistory } from './generate/history.js';
import { createFakeWikimediaClient } from './generate/fakeWikimedia.js';
import { createJobRunner, pipelineLevel, type LevelFn } from './generate/jobs.js';
import { WikimediaError } from './generate/wikimedia.js';
import { adminHashFor, adminPasswordFor } from './test/admin.js';

const PASSWORD = 'open sesame';
const ADMIN_PASSWORD = adminPasswordFor(PASSWORD);
const T0 = 1_000_000;

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

/** The app with an admin password (unless `options` says otherwise) and a clock the test moves. */
async function listen(options: AppOptions = {}) {
  let now = T0;
  server = createApp({
    log: () => {},
    adminPassword: ADMIN_PASSWORD,
    clock: () => now,
    ...options,
  }).listen(0);
  await new Promise<void>((resolve) => server!.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, advance: (ms: number) => (now += ms) };
}

/** A same-origin JSON POST, as the `/admin` page sends it. A header set to undefined is left out. */
function post(
  base: string,
  path: string,
  body: unknown = {},
  headers: Record<string, string | undefined> = {},
): Promise<Response> {
  const all = { origin: base, 'content-type': 'application/json', ...headers };
  return fetch(`${base}/api/admin${path}`, {
    method: 'POST',
    headers: Object.fromEntries(
      Object.entries(all).filter((e): e is [string, string] => e[1] !== undefined),
    ),
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Signs in and returns the `Cookie` header value for later requests. */
async function signIn(base: string): Promise<string> {
  const res = await post(base, '/login', { password: PASSWORD });
  expect(res.status).toBe(200);
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

const session = (base: string, cookie?: string) =>
  fetch(`${base}/api/admin/session`, { headers: cookie ? { cookie } : {} });

describe('ADMIN_PASSWORD_HASH', () => {
  it('parses a hash from admin:hash and refuses a malformed one, naming the variable', () => {
    const parsed = parseEnv({ ADMIN_PASSWORD_HASH: adminHashFor('x') }).adminPasswordHash;
    expect(parsed).toMatchObject({ N: 1024, r: 8, p: 1 });
    expect(parsed?.salt).toHaveLength(16);
    expect(parsed?.hash).toHaveLength(32);
    expect(() => parseEnv({ ADMIN_PASSWORD_HASH: 'hunter2' })).toThrow(/ADMIN_PASSWORD_HASH/);
    expect(() =>
      parseEnv({ ADMIN_PASSWORD_HASH: adminHashFor('x').replace('$1024$', '$1000$') }),
    ).toThrow(/power of 2/);
    expect(() =>
      parseEnv({ ADMIN_PASSWORD_HASH: adminHashFor('x').replace('$1024$', '$1048576$') }),
    ).toThrow(/64 MB/);
  });
});

describe('npm run admin:hash', () => {
  it('prints a hash the server parses and that verifies only the piped password', async () => {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = execFile('node', ['scripts/admin-hash.mjs'], (err, out) =>
        err ? reject(err) : resolve(out),
      );
      child.stdin!.end('correct horse\n');
    });
    expect(stdout.trim()).toMatch(/^scrypt\$32768\$8\$1\$[\w-]{22}\$[\w-]{43}$/);
    const parsed = parseEnv({ ADMIN_PASSWORD_HASH: stdout }).adminPasswordHash!;
    expect(await verifyAdminPassword('correct horse', parsed)).toBe(true);
    expect(await verifyAdminPassword('correct horse!', parsed)).toBe(false);
  });
});

describe('admin without a hash', () => {
  it('answers every /api/admin route with 404', async () => {
    const { base } = await listen({ adminPassword: null });
    expect((await post(base, '/login', { password: PASSWORD })).status).toBe(404);
    expect((await post(base, '/logout')).status).toBe(404);
    expect((await session(base)).status).toBe(404);
    expect((await fetch(`${base}/api/admin/categories`)).status).toBe(404);
  });

  it('is 404 when the variable is blank', async () => {
    const { base } = await listen({
      adminPassword: parseEnv({ ADMIN_PASSWORD_HASH: '  ' }).adminPasswordHash,
    });
    expect((await session(base)).status).toBe(404);
  });
});

describe('admin sign-in', () => {
  it('signs in, reports the session, and signs out', async () => {
    const { base } = await listen();
    expect((await session(base)).status).toBe(401);

    const res = await post(base, '/login', { password: PASSWORD });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ expiresAt: T0 + ADMIN_SESSION_MS });
    expect(res.headers.get('cache-control')).toBe('no-store');
    const cookie = res.headers.get('set-cookie')!.split(';')[0]!;

    const ok = await session(base, cookie);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ expiresAt: T0 + ADMIN_SESSION_MS });

    const out = await post(base, '/logout', {}, { cookie });
    expect(out.status).toBe(200);
    expect(out.headers.get('set-cookie')).toMatch(new RegExp(`^${ADMIN_COOKIE}=;`));
    expect((await session(base, cookie)).status).toBe(401);
    // Signing out again still answers ok.
    expect((await post(base, '/logout', {}, { cookie })).status).toBe(200);
  });

  it('sets the cookie HttpOnly, SameSite=Strict, on /api/admin, for 12 h, not Secure over HTTP', async () => {
    const { base } = await listen();
    const res = await post(base, '/login', { password: PASSWORD });
    const header = res.headers.get('set-cookie')!;
    expect(header).toMatch(new RegExp(`^${ADMIN_COOKIE}=[\\w-]{43};`));
    expect(header).toContain('Path=/api/admin');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain(`Max-Age=${ADMIN_SESSION_MS / 1000}`);
    expect(header).not.toContain('Secure');
  });

  it('sets Secure when the request came over HTTPS through a trusted proxy', async () => {
    const { base } = await listen({ trustProxy: true });
    const res = await post(
      base,
      '/login',
      { password: PASSWORD },
      { 'x-forwarded-proto': 'https', origin: base.replace('http:', 'https:') },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('Secure');
  });

  it('refuses a wrong password and a malformed body', async () => {
    const { base } = await listen();
    const wrong = await post(base, '/login', { password: 'open sesame!' });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: ADMIN_WRONG_PASSWORD_ERROR });
    expect(wrong.headers.get('set-cookie')).toBeNull();
    expect((await post(base, '/login', { password: '' })).status).toBe(400);
    expect((await post(base, '/login', '{not json')).status).toBe(400);
    expect((await post(base, '/login', { password: 'x'.repeat(9000) })).status).toBe(413);
  });

  it('allows 5 tries per IP per minute, right or wrong', async () => {
    const { base, advance } = await listen();
    for (let i = 0; i < RATE_LIMITS.adminLogin.max; i++) {
      expect((await post(base, '/login', { password: 'nope' })).status).toBe(401);
    }
    const limited = await post(base, '/login', { password: PASSWORD });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: ADMIN_RATE_LIMITED_ERROR });
    advance(RATE_LIMITS.adminLogin.windowMs);
    expect((await post(base, '/login', { password: PASSWORD })).status).toBe(200);
  });

  it('refuses a cross-origin or non-JSON write', async () => {
    const { base } = await listen();
    const cookie = await signIn(base);
    const cross = await post(
      base,
      '/login',
      { password: PASSWORD },
      { origin: 'https://evil.example' },
    );
    expect(cross.status).toBe(403);
    expect(cross.headers.get('set-cookie')).toBeNull();
    expect((await post(base, '/login', { password: PASSWORD }, { origin: undefined })).status).toBe(
      403,
    );
    const form = await post(base, '/logout', 'a=b', {
      cookie,
      'content-type': 'application/x-www-form-urlencoded',
    });
    expect(form.status).toBe(415);
    const crossOut = await post(base, '/logout', {}, { cookie, origin: 'https://evil.example' });
    expect(crossOut.status).toBe(403);
    // Neither refused sign-out ended the session.
    expect((await session(base, cookie)).status).toBe(200);
  });

  it('ends the session after 12 h on the fake clock', async () => {
    const { base, advance } = await listen();
    const cookie = await signIn(base);
    advance(ADMIN_SESSION_MS - 1);
    expect((await session(base, cookie)).status).toBe(200);
    advance(1);
    expect((await session(base, cookie)).status).toBe(401);
  });

  it('forgets every session with a new sessions store, as a restart does', async () => {
    const { base } = await listen();
    const cookie = await signIn(base);
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    const restarted = await listen({ adminSessions: new AdminSessions() });
    expect((await session(restarted.base, cookie)).status).toBe(401);
  });

  it('replaces an earlier session on a new sign-in', async () => {
    const { base } = await listen();
    const first = await signIn(base);
    const res = await post(base, '/login', { password: PASSWORD }, { cookie: first });
    expect(res.status).toBe(200);
    expect((await session(base, first)).status).toBe(401);
    expect((await session(base, res.headers.get('set-cookie')!.split(';')[0]!)).status).toBe(200);
  });
});

describe('admin category list', () => {
  const store = () =>
    new CategoryStore([
      {
        id: 'japan',
        name: 'Japan',
        emoji: '🗾',
        box: { south: 24, west: 122, north: 46, east: 146 },
        labelStyle: 'city',
        draftMeta: null,
        hidden: true,
        live: {},
        draft: { easy: { places: [], reviewed: false, updatedAt: 1 } },
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

  it('needs a session', async () => {
    const { base } = await listen({ categories: store() });
    const res = await fetch(`${base}/api/admin/categories`);
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('lists every category, drafts and hidden ones included, as rows', async () => {
    const { base } = await listen({ categories: store() });
    const cookie = await signIn(base);
    const res = await fetch(`${base}/api/admin/categories`, { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      categories: [
        {
          id: 'japan',
          name: 'Japan',
          emoji: '🗾',
          hidden: true,
          levels: {
            easy: { state: 'review', published: false, city: 0, landmark: 0 },
            medium: { state: 'missing', published: false, city: 0, landmark: 0 },
            hard: { state: 'missing', published: false, city: 0, landmark: 0 },
          },
        },
      ],
    });
  });
});

describe('admin category page', () => {
  const japan = {
    id: 'japan',
    name: 'Japan',
    emoji: '🗾',
    box: { south: 24, west: 122, north: 46, east: 146 },
    labelStyle: 'city' as const,
    draftMeta: null,
    hidden: false,
    live: { easy: { places: [], reviewed: true, updatedAt: 1 } },
    draft: {},
    createdAt: 1,
    updatedAt: 1,
  };

  function put(base: string, path: string, body: unknown, headers: Record<string, string>) {
    return fetch(`${base}/api/admin${path}`, {
      method: 'PUT',
      headers: { origin: base, 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  it('answers one category with its drafts, or 404, and needs a session', async () => {
    const store = new CategoryStore([structuredClone(japan)]);
    const { base } = await listen({ categories: store });
    expect((await fetch(`${base}/api/admin/categories/japan`)).status).toBe(401);
    const cookie = await signIn(base);
    const res = await fetch(`${base}/api/admin/categories/japan`, { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ category: japan });
    const missing = await fetch(`${base}/api/admin/categories/peru`, { headers: { cookie } });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'No such category' });
  });

  it('saves box and label style into the draft meta of a live category', async () => {
    const store = new CategoryStore([structuredClone(japan)]);
    const { base } = await listen({ categories: store });
    const cookie = await signIn(base);
    const box = { south: 30, west: 128, north: 42, east: 142 };
    const res = await put(
      base,
      '/categories/japan/meta',
      { box, labelStyle: 'cityCountry' },
      { cookie },
    );
    expect(res.status).toBe(200);
    const { category } = (await res.json()) as { category: typeof japan };
    expect(category.box).toEqual(japan.box);
    expect(category.draftMeta).toEqual({ box, labelStyle: 'cityCountry' });
    expect(store.find('japan')!.draftMeta).toEqual({ box, labelStyle: 'cityCountry' });
  });

  it('validates the meta body and refuses a box under 150 km', async () => {
    const store = new CategoryStore([structuredClone(japan)]);
    const { base } = await listen({ categories: store });
    const cookie = await signIn(base);
    const refusals: [unknown, number, string][] = [
      [{ box: { south: 40, west: 130, north: 35, east: 140 } }, 400, 'South must be below north'],
      [
        { box: { south: 30, west: 140, north: 35, east: 130 } },
        400,
        'East must be east of west, at most 360° away',
      ],
      [{ labelStyle: 'country' }, 400, ''],
      [
        { box: { south: 35, west: 139, north: 36, east: 140 } },
        400,
        'The box is too small: scale 100 km, at least 150 km',
      ],
      ['{not json', 400, 'Send the change as JSON.'],
    ];
    for (const [body, status, error] of refusals) {
      const res = await put(base, '/categories/japan/meta', body, { cookie });
      expect(res.status).toBe(status);
      const data = (await res.json()) as { error: string };
      if (error) expect(data.error).toBe(error);
      else expect(data.error).toBeTruthy();
    }
    expect(store.find('japan')!.draftMeta).toBeNull();
    const missing = await put(base, '/categories/peru/meta', { labelStyle: 'city' }, { cookie });
    expect(missing.status).toBe(404);
    const foreign = await put(
      base,
      '/categories/japan/meta',
      { labelStyle: 'city' },
      { cookie, origin: 'https://evil.test' },
    );
    expect(foreign.status).toBe(403);
    const signedOut = await put(base, '/categories/japan/meta', { labelStyle: 'city' }, {});
    expect(signedOut.status).toBe(401);
  });
});

describe('admin category actions', () => {
  const city = (id: string, lat: number, lng: number): Place => ({
    id,
    kind: 'city',
    name: id,
    displayName: id,
    autoDisplayName: true,
    fact: 'A fact.',
    lat,
    lng,
    coordsSource: 'wikidata',
    wikidataId: 'Q1',
    countryId: 'Q17',
    countryName: 'Japan',
  });
  const japan = (): Category => ({
    id: 'japan',
    name: 'Japan',
    emoji: '🗾',
    box: { south: 24, west: 122, north: 46, east: 146 },
    labelStyle: 'city',
    draftMeta: null,
    hidden: false,
    live: { easy: { places: [city('osaka', 34.69, 135.5)], reviewed: true, updatedAt: 1 } },
    draft: {},
    createdAt: 1,
    updatedAt: 1,
  });

  async function setUp(categories: Category[] = [japan()]) {
    const store = new CategoryStore(categories);
    const { base } = await listen({ categories: store });
    const cookie = await signIn(base);
    const send = (method: string, path: string, body: unknown = {}, headers = {}) =>
      fetch(`${base}/api/admin/categories/japan${path}`, {
        method,
        headers: { origin: base, 'content-type': 'application/json', cookie, ...headers },
        body: JSON.stringify(body),
      });
    const lobby = async () =>
      ((await (await fetch(`${base}/api/categories`)).json()) as { id: string }[]).map((c) => c.id);
    return { store, send, lobby };
  }

  it('refuses Publish with nothing to publish, an unreviewed draft or a place outside the box', async () => {
    let res = await (await setUp()).send('POST', '/publish');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Nothing to publish' });

    const c = japan();
    c.draft.medium = { places: [city('taipei', 25.03, 121.56)], reviewed: false, updatedAt: 1 };
    const { store, send } = await setUp([c]);
    res = await send('POST', '/publish');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'Review Medium first; taipei (Medium) lies outside the box',
    });
    expect(store.find('japan')!.live.medium).toBeUndefined();
    expect(store.find('japan')!.draft.medium).toBeDefined();
  });

  it('publishes once every draft is reviewed and valid; the lobby gets the new level', async () => {
    const c = japan();
    c.draft.medium = { places: [city('kyoto', 35.01, 135.77)], reviewed: true, updatedAt: 1 };
    const { store, send } = await setUp([c]);
    const res = await send('POST', '/publish');
    expect(res.status).toBe(200);
    const body = (await res.json()) as AdminPublishResponse;
    expect(body.levels).toBe(1);
    expect(body.category.draft).toEqual({});
    expect(Object.keys(store.get('japan')!.live)).toEqual(['easy', 'medium']);
  });

  it('hides a category from the lobby and shows it again', async () => {
    const { send, lobby } = await setUp();
    expect(await lobby()).toEqual(['japan']);
    const res = await send('PUT', '/hidden', { hidden: true });
    expect(res.status).toBe(200);
    expect(((await res.json()) as AdminCategoryResponse).category.hidden).toBe(true);
    expect(await lobby()).toEqual([]);
    expect((await send('PUT', '/hidden', { hidden: false })).status).toBe(200);
    expect(await lobby()).toEqual(['japan']);
    expect((await send('PUT', '/hidden', { hidden: 'yes' })).status).toBe(400);
  });

  it('sets or clears the emoji, refusing anything but one emoji', async () => {
    const { store, send } = await setUp();
    for (const emoji of ['🗺️', '🇯🇵', null]) {
      const res = await send('PUT', '/emoji', { emoji });
      expect(res.status).toBe(200);
      expect(((await res.json()) as AdminCategoryResponse).category.emoji).toBe(emoji);
    }
    for (const emoji of ['ab', '🗾🗾', '', 'x🗾']) {
      const res = await send('PUT', '/emoji', { emoji });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Must be a single emoji' });
    }
    expect(store.find('japan')!.emoji).toBeNull();
  });

  it('deletes a category, only from this site and once', async () => {
    const { store, send, lobby } = await setUp();
    expect((await send('DELETE', '', {}, { origin: 'https://evil.test' })).status).toBe(403);
    expect(store.find('japan')).toBeDefined();
    const res = await send('DELETE', '');
    expect(res.status).toBe(200);
    expect(store.find('japan')).toBeUndefined();
    expect(await lobby()).toEqual([]);
    const again = await send('DELETE', '');
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: 'No such category' });
  });
});

describe('admin place review', () => {
  const city = (id: string, lat: number, lng: number): Place => ({
    id,
    kind: 'city',
    name: id,
    displayName: id,
    autoDisplayName: true,
    fact: 'A fact.',
    lat,
    lng,
    coordsSource: 'wikidata',
    wikidataId: 'Q1',
    countryId: 'Q17',
    countryName: 'Japan',
  });
  const japan = (): Category => ({
    id: 'japan',
    name: 'Japan',
    emoji: null,
    box: { south: 24, west: 122, north: 46, east: 146 },
    labelStyle: 'city',
    draftMeta: null,
    hidden: false,
    live: { easy: { places: [city('osaka', 34.69, 135.5)], reviewed: true, updatedAt: 1 } },
    draft: {
      medium: {
        places: [city('kyoto', 35.01, 135.77), city('nara', 34.68, 135.8)],
        reviewed: false,
        updatedAt: 1,
      },
    },
    createdAt: 1,
    updatedAt: 1,
  });

  async function setUp() {
    const store = new CategoryStore([japan()]);
    const { base } = await listen({ categories: store });
    const cookie = await signIn(base);
    const send = (method: string, path: string, body: unknown = {}, headers = {}) =>
      fetch(`${base}/api/admin/categories/japan${path}`, {
        method,
        headers: { origin: base, 'content-type': 'application/json', cookie, ...headers },
        body: JSON.stringify(body),
      });
    return { store, send };
  }
  const medium = (store: CategoryStore) => store.find('japan')!.draft.medium!;

  it('edits a place: name, display name, fact, and a moved pin becomes the admin’s', async () => {
    const { store, send } = await setUp();
    const res = await send('PUT', '/levels/medium/places/kyoto', {
      name: 'Kyōto',
      displayName: 'Old capital',
      fact: '  Home to 1,600 temples.  ',
      lat: 35.1,
      lng: 135.7,
    });
    expect(res.status).toBe(200);
    const { category } = (await res.json()) as AdminCategoryResponse;
    expect(category.draft.medium!.places[0]).toMatchObject({
      name: 'Kyōto',
      displayName: 'Old capital',
      autoDisplayName: false,
      fact: 'Home to 1,600 temples.',
      lat: 35.1,
      lng: 135.7,
      coordsSource: 'admin',
    });
    expect(medium(store).places[0]!.coordsSource).toBe('admin');
  });

  it('edits a live-only level into a draft that keeps its reviewed mark', async () => {
    const { store, send } = await setUp();
    expect((await send('PUT', '/levels/easy/places/osaka', { fact: 'Kitchen.' })).status).toBe(200);
    expect(store.find('japan')!.draft.easy).toMatchObject({ reviewed: true });
    expect(store.find('japan')!.live.easy!.places[0]!.fact).toBe('A fact.');
  });

  it('validates the place edit and refuses a pin outside the box', async () => {
    const { store, send } = await setUp();
    const refusals: [string, unknown, number, string | null][] = [
      [
        '/levels/medium/places/kyoto',
        { lat: 10, lng: 135 },
        400,
        'The pin must stay inside the box',
      ],
      ['/levels/medium/places/kyoto', { lat: 35 }, 400, 'Send lat and lng together'],
      ['/levels/medium/places/kyoto', { fact: 'x'.repeat(91) }, 400, null],
      ['/levels/medium/places/kyoto', { name: '   ' }, 400, null],
      ['/levels/medium/places/kyoto', { lat: 95, lng: 135 }, 400, null],
      [
        '/levels/medium/places/kyoto',
        { photoCandidate: 'File:Kyoto.jpg' },
        400,
        'Swap photo is not available yet',
      ],
      ['/levels/medium/places/osaka', { fact: 'Kitchen.' }, 404, 'No such place'],
      ['/levels/hard/places/kyoto', { fact: 'Kitchen.' }, 404, 'Hard has no places'],
      ['/levels/extreme/places/kyoto', { fact: 'Kitchen.' }, 404, 'No such level or place'],
    ];
    for (const [path, body, status, error] of refusals) {
      const res = await send('PUT', path, body);
      expect(res.status, path + JSON.stringify(body)).toBe(status);
      const data = (await res.json()) as { error: string };
      if (error) expect(data.error).toBe(error);
      else expect(data.error).toBeTruthy();
    }
    expect(medium(store)).toEqual(japan().draft.medium);
    const foreign = await send(
      'PUT',
      '/levels/medium/places/kyoto',
      { fact: 'x.' },
      {
        origin: 'https://evil.test',
      },
    );
    expect(foreign.status).toBe(403);
  });

  it('removes a place, and a second remove is 404', async () => {
    const { store, send } = await setUp();
    const res = await send('DELETE', '/levels/medium/places/nara');
    expect(res.status).toBe(200);
    expect(medium(store).places.map((p) => p.id)).toEqual(['kyoto']);
    const again = await send('DELETE', '/levels/medium/places/nara');
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: 'No such place' });
    expect((await send('DELETE', '/levels/medium/places/kyoto', {}, { cookie: '' })).status).toBe(
      401,
    );
  });

  it('marks a draft level reviewed and back; a level without a draft is 404', async () => {
    const { store, send } = await setUp();
    let res = await send('POST', '/levels/medium/reviewed', { reviewed: true });
    expect(res.status).toBe(200);
    expect(((await res.json()) as AdminCategoryResponse).category.draft.medium!.reviewed).toBe(
      true,
    );
    expect((await send('PUT', '/levels/medium/places/kyoto', { fact: 'Later.' })).status).toBe(200);
    expect(medium(store).reviewed).toBe(true);
    expect((await send('POST', '/levels/medium/reviewed', { reviewed: false })).status).toBe(200);
    expect(medium(store).reviewed).toBe(false);
    res = await send('POST', '/levels/easy/reviewed', { reviewed: true });
    expect(res.status).toBe(404);
    expect((await send('POST', '/levels/medium/reviewed', { reviewed: 'yes' })).status).toBe(400);
  });
});

describe('admin Add by name', () => {
  const osaka: Place = {
    id: 'osaka',
    kind: 'city',
    name: 'Osaka',
    displayName: 'Osaka',
    autoDisplayName: true,
    fact: 'A fact.',
    lat: 34.69,
    lng: 135.5,
    coordsSource: 'wikidata',
    wikidataId: 'Q35765',
    countryId: 'Q17',
    countryName: 'Japan',
  };
  const japan = (): Category => ({
    id: 'japan',
    name: 'Japan',
    emoji: null,
    box: { south: 24, west: 122, north: 46, east: 146 },
    labelStyle: 'city',
    draftMeta: { box: { south: 33.5, west: 134, north: 36, east: 137 }, labelStyle: 'city' },
    hidden: false,
    live: { easy: { places: [osaka], reviewed: true, updatedAt: 1 } },
    draft: {},
    createdAt: 1,
    updatedAt: 1,
  });

  async function setUp(options: AppOptions = {}) {
    const store = new CategoryStore([japan()]);
    const client = createFakeWikimediaClient();
    const { base, advance } = await listen({
      categories: store,
      wikimedia: () => client,
      ...options,
    });
    const cookie = await signIn(base);
    const search = (
      q: string,
      categoryId = 'japan',
      headers: Record<string, string> = { cookie },
    ) =>
      fetch(
        `${base}/api/admin/wikidata/search?${new URLSearchParams({ q, categoryId }).toString()}`,
        { headers },
      );
    const add = (level: string, body: unknown) =>
      fetch(`${base}/api/admin/categories/japan/levels/${level}/places/add-by-id`, {
        method: 'POST',
        headers: { origin: base, 'content-type': 'application/json', cookie },
        body: JSON.stringify(body),
      });
    return { store, search, add, advance };
  }

  it('searches Wikidata: candidates with description, country and coordinates', async () => {
    const { search } = await setUp();
    const res = await search('Osaka');
    expect(res.status).toBe(200);
    const { candidates } = (await res.json()) as AdminWikidataSearchResponse;
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({
      wikidataId: 'Q35765',
      name: 'Osaka',
      description: 'designated city in Kansai, Japan',
      country: 'Japan',
      lat: 34.693889,
      lng: 135.502222,
    });
    expect((await search('', 'japan')).status).toBe(400);
    expect((await search('Osaka', 'nowhere')).status).toBe(404);
    expect((await search('Osaka', 'japan', {})).status).toBe(401);
  });

  it('allows 30 searches a minute, then answers 429 until the minute is up', async () => {
    const { search, advance } = await setUp();
    for (let i = 0; i < RATE_LIMITS.wikidataSearch.max; i++) {
      expect((await search('Osaka')).status).toBe(200);
    }
    const limited = await search('Osaka');
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: WIKIDATA_SEARCH_LIMITED_ERROR });
    advance(RATE_LIMITS.wikidataSearch.windowMs);
    expect((await search('Osaka')).status).toBe(200);
  });

  it('adds a pick with the typed fact to the level’s draft, forked from live', async () => {
    const { store, add } = await setUp();
    const res = await add('easy', { kind: 'city', wikidataId: 'Q34600', fact: ' Old capital. ' });
    expect(res.status).toBe(200);
    const { category } = (await res.json()) as AdminCategoryResponse;
    const added = category.draft.easy!.places[1]!;
    expect(added).toEqual({
      id: expect.stringMatching(/^[\w-]{20}$/),
      kind: 'city',
      name: 'Kyoto',
      displayName: 'Kyoto',
      autoDisplayName: true,
      fact: 'Old capital.',
      lat: 35.011667,
      lng: 135.768333,
      coordsSource: 'wikidata',
      wikidataId: 'Q34600',
      countryId: 'Q17',
      countryName: 'Japan',
    });
    expect(category.draft.easy!.reviewed).toBe(true);
    expect(store.find('japan')!.live.easy!.places).toHaveLength(1);
  });

  it('adds a landmark with its stored photo and the other usable candidates', async () => {
    const photoDir = mkdtempSync(join(tmpdir(), 'pinpoint-photos-'));
    const { add } = await setUp({ photoDir });
    const res = await add('easy', { kind: 'landmark', wikidataId: 'Q188754', fact: 'White.' });
    expect(res.status).toBe(200);
    const { category } = (await res.json()) as AdminCategoryResponse;
    const added = category.draft.easy!.places[1]!;
    expect(added).toMatchObject({ kind: 'landmark', name: 'Himeji Castle', fact: 'White.' });
    expect(added.photo).toMatchObject({
      author: 'Bernard Gagnon',
      licence: 'CC BY-SA 3.0',
      commonsFile: 'File:Himeji Castle The Keep Towers.jpg',
    });
    expect(added.photoCandidates!.map((c) => c.commonsFile)).toEqual([
      'File:Himeji castle in winter.jpg',
    ]);
    expect(readdirSync(photoDir).sort()).toEqual(
      [`${added.photo!.id}-thumb.webp`, `${added.photo!.id}.webp`].sort(),
    );
  });

  it('refuses a landmark with no usable photo, or with no photo folder', async () => {
    const client = createFakeWikimediaClient();
    const noFiles = await setUp({
      photoDir: mkdtempSync(join(tmpdir(), 'pinpoint-photos-')),
      wikimedia: () => ({ ...client, imageInfo: async () => ({ query: { pages: [] } }) }),
    });
    const res = await noFiles.add('easy', { kind: 'landmark', wikidataId: 'Q188754', fact: 'x.' });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'No usable photo' });
    expect(noFiles.store.find('japan')).toEqual(japan());

    const noDir = await setUp();
    const off = await noDir.add('easy', { kind: 'landmark', wikidataId: 'Q188754', fact: 'x.' });
    expect(off.status).toBe(502);
    expect(await off.json()).toEqual({ error: PHOTOS_NOT_SET_UP_ERROR });
  });

  it('refuses a pick that fails Locate’s checks, with the reason, and changes nothing', async () => {
    const { store, add } = await setUp();
    const refusals: [string, unknown, number, string | null][] = [
      ['easy', { kind: 'city', wikidataId: 'Q999999', fact: 'x.' }, 422, 'Not found on Wikidata'],
      ['easy', { kind: 'city', wikidataId: 'Q122723', fact: 'x.' }, 422, 'Not a city'],
      [
        'easy',
        { kind: 'landmark', wikidataId: 'Q35765', fact: 'x.' },
        422,
        'Is a settlement, not a landmark',
      ],
      // The draft box (Kansai) holds Kyoto but not Sapporo.
      ['easy', { kind: 'city', wikidataId: 'Q37951', fact: 'x.' }, 422, 'Outside the box'],
      ['easy', { kind: 'city', wikidataId: 'Q35765', fact: 'x.' }, 422, 'Already in the category'],
      ['hard', { kind: 'city', wikidataId: 'Q34600', fact: 'x.' }, 404, 'Hard has no places'],
      ['extreme', { kind: 'city', wikidataId: 'Q34600', fact: 'x.' }, 404, null],
      ['easy', { kind: 'city', wikidataId: 'Q34600', fact: 'x'.repeat(91) }, 400, null],
      ['easy', { kind: 'city', wikidataId: 'Kyoto', fact: 'x.' }, 400, null],
    ];
    for (const [level, body, status, error] of refusals) {
      const res = await add(level, body);
      expect(res.status, JSON.stringify(body)).toBe(status);
      const data = (await res.json()) as { error: string };
      if (error) expect(data.error).toBe(error);
      else expect(data.error).toBeTruthy();
    }
    expect(store.find('japan')).toEqual(japan());
  });

  it('answers 502 with the reason when Wikimedia is not set up', async () => {
    const { search, add } = await setUp({
      wikimedia: () => {
        throw new WikimediaError('Wikimedia requests need WIKIMEDIA_CONTACT, which is not set');
      },
    });
    const res = await search('Osaka');
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: 'Wikimedia requests need WIKIMEDIA_CONTACT, which is not set',
    });
    expect((await add('easy', { kind: 'city', wikidataId: 'Q34600', fact: 'x.' })).status).toBe(
      502,
    );
  });
});

describe('admin generation jobs', () => {
  const GENERATE = { name: 'Kansai', guidance: '', levels: { easy: { count: 5 } } };

  async function setUp(level?: LevelFn, dailyLimit = 1, replaceDailyLimit = 100) {
    const store = new CategoryStore([]);
    const client = createFakeWikimediaClient();
    const jobs = createJobRunner({
      level:
        level ??
        pipelineLevel(fakeGenerator(), () => client, mkdtempSync(join(tmpdir(), 'pinpoint-'))),
      store,
      clock: () => T0,
      dailyLimit,
      replaceDailyLimit,
    });
    const { base } = await listen({ categories: store, jobs });
    const cookie = await signIn(base);
    const get = (path: string) => fetch(`${base}/api/admin${path}`, { headers: { cookie } });
    const send = (path: string, body: unknown = {}) => post(base, path, body, { cookie });
    return { base, store, jobs, cookie, get, send };
  }

  /** Never answers until the job is cancelled. */
  const hanging: LevelFn = (_request, _hooks, signal) =>
    new Promise((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(new Error('x'))),
    );

  it('generates a new category on the fake generator and shows the job’s progress', async () => {
    const { store, jobs, get, send } = await setUp();
    const res = await send('/categories/generate', GENERATE);
    expect(res.status).toBe(200);
    const { jobId } = (await res.json()) as { jobId: string };
    await jobs.idle();
    const { job } = (await (await get(`/jobs/${jobId}`)).json()) as AdminJobResponse;
    expect(job).toMatchObject({
      kind: 'generate',
      state: 'done',
      categoryId: 'kansai',
      category: 'Kansai',
      levels: [{ level: 'easy', state: 'saved', kept: { city: 3, landmark: 2 } }],
    });
    const draft = store.find('kansai')!.draft.easy!;
    expect(draft.reviewed).toBe(false);
    expect(draft.places.map((p) => p.name)).toEqual([
      'Osaka',
      'Kyoto',
      'Sapporo',
      'Himeji Castle',
      'Tokyo Tower',
    ]);
  });

  it('lists jobs, one category’s when asked, with what is left of today’s limits', async () => {
    const { jobs, get, send } = await setUp();
    await send('/categories/generate', GENERATE);
    await jobs.idle();
    const all = (await (await get('/jobs')).json()) as AdminJobsResponse;
    expect(all).toMatchObject({ off: null, levelsLeft: 0, replacementsLeft: 100 });
    expect(all.jobs).toHaveLength(1);
    const other = (await (await get('/jobs?categoryId=japan')).json()) as AdminJobsResponse;
    expect(other.jobs).toEqual([]);
    expect((await get('/jobs?categoryId=..%2F')).status).toBe(400);
    expect((await get('/jobs/nope')).status).toBe(404);
  });

  it('refuses a level over the daily limit with 429', async () => {
    const { jobs, send } = await setUp();
    await send('/categories/generate', GENERATE);
    await jobs.idle();
    const res = await send('/categories/generate', { ...GENERATE, name: 'Kanto' });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: 'Daily limit reached: 1 levels a day. Try again tomorrow (UTC).',
    });
  });

  it('regenerates a level of a category, refusing an unknown category, level or count', async () => {
    const { store, jobs, send } = await setUp(undefined, 5);
    await send('/categories/generate', GENERATE);
    await jobs.idle();
    const res = await send('/categories/kansai/levels/hard/regenerate', { count: 6 });
    expect(res.status).toBe(200);
    const { jobId } = (await res.json()) as { jobId: string };
    await jobs.idle();
    // The fake writer knows five places, all already in the category, so it is avoided out.
    expect(jobs.get(jobId)).toMatchObject({
      kind: 'regenerate',
      categoryId: 'kansai',
      levels: [{ level: 'hard', count: 6 }],
      state: 'failed',
      error: 'No Hard place passed the checks. Try again.',
    });
    expect(store.find('kansai')!.draft.hard).toBeUndefined();
    expect((await send('/categories/nope/levels/easy/regenerate', { count: 5 })).status).toBe(404);
    expect((await send('/categories/kansai/levels/extreme/regenerate', { count: 5 })).status).toBe(
      404,
    );
    expect((await send('/categories/kansai/levels/easy/regenerate', { count: 4 })).status).toBe(
      400,
    );
  });

  it('generates more levels into an existing category', async () => {
    const { store, jobs, send } = await setUp(hanging, 5);
    await store.create({
      name: 'Japan',
      emoji: null,
      box: { south: 24, west: 122, north: 46, east: 146 },
      labelStyle: 'city',
    });
    const res = await send('/categories/japan/generate', {
      guidance: 'North',
      levels: { hard: { count: 5 } },
    });
    expect(res.status).toBe(200);
    const { jobId } = (await res.json()) as { jobId: string };
    expect(jobs.get(jobId)).toMatchObject({
      kind: 'generate',
      categoryId: 'japan',
      guidance: 'North',
      levels: [{ level: 'hard', count: 5 }],
    });
    jobs.cancel(jobId);
    await jobs.idle();
    const missing = await send('/categories/nope/generate', {
      guidance: '',
      levels: { easy: { count: 5 } },
    });
    expect(missing.status).toBe(404);
    expect((await send('/categories/japan/generate', { guidance: '', levels: {} })).status).toBe(
      400,
    );
  });

  it('refuses a generate with no level', async () => {
    const { send } = await setUp();
    const res = await send('/categories/generate', { ...GENERATE, levels: {} });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Pick at least one level' });
  });

  it('refuses a second generation while one runs, and cancels the running one', async () => {
    const { jobs, get, send } = await setUp(hanging);
    const { jobId } = (await (await send('/categories/generate', GENERATE)).json()) as {
      jobId: string;
    };
    expect((await send('/categories/generate', GENERATE)).status).toBe(409);
    expect((await send(`/jobs/${jobId}/cancel`)).status).toBe(200);
    await jobs.idle();
    const { job } = (await (await get(`/jobs/${jobId}`)).json()) as AdminJobResponse;
    expect(job.state).toBe('cancelled');
    expect((await send(`/jobs/${jobId}/cancel`)).status).toBe(409);
    expect((await send('/jobs/nope/cancel')).status).toBe(404);
  });

  it('answers 503 with the reason when generation is off', async () => {
    const { base } = await listen({ categories: new CategoryStore([]) });
    const cookie = await signIn(base);
    const res = await post(base, '/categories/generate', GENERATE, { cookie });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: GENERATION_OFF_NO_KEY });
    const list = await fetch(`${base}/api/admin/jobs`, { headers: { cookie } });
    expect(await list.json()).toMatchObject({ off: GENERATION_OFF_NO_KEY });
  });

  it('replaces a place under its id with a note, adds one, and undoes the replacement', async () => {
    const { store, jobs, get, send } = await setUp(undefined, 5);
    await send('/categories/generate', GENERATE);
    await jobs.idle();
    const easy = () => store.find('kansai')!.draft.easy!.places;
    const [osaka, kyoto, sapporo] = easy();
    // Leave the fake writer one city it can still write each time.
    await store.removePlace('kansai', 'easy', kyoto!.id);
    await store.removePlace('kansai', 'easy', sapporo!.id);

    const res = await send(`/categories/kansai/levels/easy/places/${osaka!.id}/replace`, {
      note: 'too famous',
    });
    expect(res.status).toBe(200);
    const { jobId } = (await res.json()) as { jobId: string };
    await jobs.idle();
    expect(jobs.get(jobId)).toMatchObject({
      kind: 'replace',
      state: 'done',
      replaced: { old: { name: 'Osaka' }, new: { id: osaka!.id, name: 'Kyoto' } },
    });
    expect(easy()[0]).toMatchObject({ id: osaka!.id, name: 'Kyoto' });
    expect((await get('/jobs')).ok).toBe(true);

    const undone = await send(`/jobs/${jobId}/undo`);
    expect(undone.status).toBe(200);
    expect(((await undone.json()) as AdminCategoryResponse).category.draft.easy!.places[0]).toEqual(
      osaka,
    );
    expect(easy()[0]).toEqual(osaka);
    // Once only: a repeat would overwrite later edits with the stale place.
    expect((await send(`/jobs/${jobId}/undo`)).status).toBe(409);

    const added = await send('/categories/kansai/levels/easy/places/add', { kind: 'city' });
    const { jobId: addId } = (await added.json()) as { jobId: string };
    await jobs.idle();
    expect(jobs.get(addId)).toMatchObject({ kind: 'add', state: 'done', placeKind: 'city' });
    expect(easy().at(-1)).toMatchObject({ name: 'Kyoto' });
    // Only a finished replacement can be undone.
    expect((await send(`/jobs/${addId}/undo`)).status).toBe(409);
    expect((await send('/jobs/nope/undo')).status).toBe(404);
  });

  it('has nothing to undo into once the replacement was removed', async () => {
    const { store, jobs, send } = await setUp(undefined, 5);
    await send('/categories/generate', GENERATE);
    await jobs.idle();
    const [osaka, kyoto, sapporo] = store.find('kansai')!.draft.easy!.places;
    await store.removePlace('kansai', 'easy', kyoto!.id);
    await store.removePlace('kansai', 'easy', sapporo!.id);
    const res = await send(`/categories/kansai/levels/easy/places/${osaka!.id}/replace`);
    const { jobId } = (await res.json()) as { jobId: string };
    await jobs.idle();
    await store.removePlace('kansai', 'easy', osaka!.id);
    expect((await send(`/jobs/${jobId}/undo`)).status).toBe(404);
  });

  it('refuses a replacement or an addition over the daily limit with 429', async () => {
    const { store, jobs, send } = await setUp(undefined, 5, 1);
    await send('/categories/generate', GENERATE);
    await jobs.idle();
    const osaka = store.find('kansai')!.draft.easy!.places[0]!;
    expect((await send(`/categories/kansai/levels/easy/places/${osaka.id}/replace`)).status).toBe(
      200,
    );
    const res = await send('/categories/kansai/levels/easy/places/add', { kind: 'city' });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: 'Daily limit reached: 1 replacements a day. Try again tomorrow (UTC).',
    });
    await jobs.idle();
  });

  it('refuses a replacement of an unknown place, a long note or an unknown kind', async () => {
    const { jobs, send } = await setUp(undefined, 5);
    await send('/categories/generate', GENERATE);
    await jobs.idle();
    expect((await send('/categories/kansai/levels/easy/places/nope/replace')).status).toBe(404);
    expect((await send('/categories/kansai/levels/hard/places/add', { kind: 'city' })).status).toBe(
      404,
    );
    const long = await send('/categories/kansai/levels/easy/places/add', {
      kind: 'city',
      note: 'x'.repeat(201),
    });
    expect(long.status).toBe(400);
    expect((await send('/categories/kansai/levels/easy/places/add', { kind: 'town' })).status).toBe(
      400,
    );
  });

  it('needs a session for every job route, and a same-origin write to start or cancel', async () => {
    const { base, cookie } = await setUp(hanging);
    expect((await fetch(`${base}/api/admin/jobs`)).status).toBe(401);
    expect((await fetch(`${base}/api/admin/jobs/x`)).status).toBe(401);
    expect((await post(base, '/categories/generate', GENERATE)).status).toBe(401);
    expect((await post(base, '/jobs/x/cancel')).status).toBe(401);
    expect((await post(base, '/jobs/x/undo')).status).toBe(401);
    expect(
      (await post(base, '/categories/k/levels/easy/places/add', { kind: 'city' })).status,
    ).toBe(401);
    const foreign = { cookie, origin: 'https://evil.example' };
    expect((await post(base, '/categories/generate', GENERATE, foreign)).status).toBe(403);
  });
});

describe('admin generation history', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const line = (endedAt: number, category: string, costUsd: number) =>
    JSON.stringify({
      startedAt: endedAt - 1000,
      endedAt,
      kind: 'generate',
      categoryId: category.toLowerCase(),
      category,
      levels: ['easy'],
      saved: { city: 15, landmark: 12 },
      dropped: [{ reason: 'Not on Wikidata', count: 3 }],
      costUsd,
      outcome: 'done',
    });

  /** The app on an in-memory log: one job 40 days ago, one 2 days ago, one today. */
  async function setUp(text?: string) {
    const files = new Map<string, string>();
    const history = openGenerationHistory('/data', {
      fs: {
        appendFile: async (path, data) => void files.set(path, (files.get(path) ?? '') + data),
        readFile: async (path) => {
          const found = files.get(path);
          if (found === undefined) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
          return found;
        },
      },
      warn: () => {},
    });
    const { base, advance } = await listen({ history });
    advance(40 * DAY);
    const now = T0 + 40 * DAY;
    files.set(
      `/data/${HISTORY_FILE}`,
      text ??
        [line(T0, 'Old', 1), line(now - 2 * DAY, 'Chile', 0.5), line(now, 'Japan', 0.25), ''].join(
          '\n',
        ),
    );
    return { base, cookie: await signIn(base) };
  }

  const get = (base: string, path: string, cookie?: string) =>
    fetch(`${base}/api/admin${path}`, { headers: cookie ? { cookie } : {} });

  it('lists every ended job newest first with spend today, over 30 days and in all', async () => {
    const { base, cookie } = await setUp();
    const res = await get(base, '/history', cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as AdminHistoryResponse;
    expect(body.entries.map((e) => e.category)).toEqual(['Japan', 'Chile', 'Old']);
    expect(body.entries[0]).toMatchObject({
      saved: { city: 15, landmark: 12 },
      dropped: [{ reason: 'Not on Wikidata', count: 3 }],
      costUsd: 0.25,
      outcome: 'done',
    });
    expect(body.totals).toEqual({ todayUsd: 0.25, last30DaysUsd: 0.75, allTimeUsd: 1.75, jobs: 3 });
  });

  it('answers the newest `limit` entries, 0 for the totals alone, and 400 outside 0–500', async () => {
    const { base, cookie } = await setUp();
    const one = (await (
      await get(base, '/history?limit=1', cookie)
    ).json()) as AdminHistoryResponse;
    expect(one.entries.map((e) => e.category)).toEqual(['Japan']);
    expect(one.totals.jobs).toBe(3);
    const none = (await (
      await get(base, '/history?limit=0', cookie)
    ).json()) as AdminHistoryResponse;
    expect(none.entries).toEqual([]);
    expect(none.totals.allTimeUsd).toBe(1.75);
    for (const bad of ['501', '-1', 'x', '1.5']) {
      expect((await get(base, `/history?limit=${bad}`, cookie)).status).toBe(400);
    }
  });

  it('is empty with no log yet, and needs a session', async () => {
    const { base, cookie } = await setUp('');
    const body = (await (await get(base, '/history', cookie)).json()) as AdminHistoryResponse;
    expect(body).toEqual({
      entries: [],
      totals: { todayUsd: 0, last30DaysUsd: 0, allTimeUsd: 0, jobs: 0 },
    });
    expect((await get(base, '/history')).status).toBe(401);
  });
});

describe('AdminSessions', () => {
  it('stores only SHA-256 hashes of the tokens', () => {
    const sessions = new AdminSessions();
    const { token } = sessions.create(T0);
    const keys = [...(sessions as unknown as { sessions: Map<string, number> }).sessions.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(keys[0]).not.toContain(token);
  });
});
