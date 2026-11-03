import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_COOKIE,
  ADMIN_IMPORT_MAX_BYTES,
  ADMIN_LOGIN_RATE_LIMIT,
  ADMIN_RATE_LIMITED_ERROR,
  ADMIN_SESSION_MS,
  ADMIN_WRONG_PASSWORD_ERROR,
  ANSWER_MAX,
  BUILT_IN_SETS_MAX,
  HOST_NOTES_MAX,
  QUESTION_TEXT_MAX,
  SET_TITLE_MAX,
} from '../shared/constants.js';
import type {
  AdminCategoriesResponse,
  AdminDraftsResponse,
  AdminImportResponse,
  AdminPublishErrorBody,
  AdminSessionResponse,
  BuiltInSetsResponse,
  HttpErrorBody,
  QuestionSet,
} from '../shared/types.js';
import { BUILT_IN_FILE, openBuiltInStore, type BuiltInStore } from './builtInStore.js';
import { parseAdminPasswordHash } from './env.js';
import { createApp, type AppOptions } from './http.js';
import { adminHashFor } from './test/admin.js';
import { makeQuestion, makeSet, T0 } from './test/rooms.js';

const PASSWORD = 'open sesame';
const ADMIN_PASSWORD = parseAdminPasswordHash(adminHashFor(PASSWORD));

let server: Server | undefined;

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
});

/** The app with an admin password (unless `options` says otherwise) and a clock the test moves. */
async function listen(options: AppOptions = {}) {
  let now = T0;
  server = createApp({
    adminPassword: ADMIN_PASSWORD,
    clock: () => now,
    ...options,
  }).listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  return { base, advance: (ms: number) => (now += ms) };
}

/** A same-origin JSON POST, as the `/admin` page sends it. `headers` overrides any of them. */
function post(
  base: string,
  path: string,
  body: unknown = {},
  headers: Record<string, string | undefined> = {},
): Promise<Response> {
  const all: Record<string, string | undefined> = {
    origin: base,
    'content-type': 'application/json',
    ...headers,
  };
  return fetch(`${base}/api/admin${path}`, {
    method: 'POST',
    headers: Object.fromEntries(Object.entries(all).filter(([, v]) => v !== undefined)) as Record<
      string,
      string
    >,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function login(base: string, password = PASSWORD, headers = {}) {
  return post(base, '/login', { password }, headers);
}

function session(base: string, cookie?: string) {
  return fetch(`${base}/api/admin/session`, { headers: cookie ? { cookie } : {} });
}

/** `buzzr_admin=<token>` from a response's Set-Cookie, ready for a Cookie header. */
function cookieOf(res: Response): string {
  const header = res.headers.get('set-cookie') ?? '';
  return header.split(';')[0]!;
}

async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as HttpErrorBody).error;
}

describe('with no ADMIN_PASSWORD_HASH', () => {
  it('answers 404 on every /api/admin route, even the right password', async () => {
    const { base } = await listen({ adminPassword: null });
    const responses = [
      await login(base),
      await session(base),
      await post(base, '/logout'),
      await fetch(`${base}/api/admin`),
      await fetch(`${base}/api/admin/sets`),
    ];
    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(res.headers.get('set-cookie')).toBeNull();
    }
  });

  it('is the default when createApp gets no password', async () => {
    const { base } = await listen({ adminPassword: undefined });
    expect((await login(base)).status).toBe(404);
  });
});

describe('POST /api/admin/login', () => {
  it('signs in with the right password: 200 {expiresAt} 12 h on, and a session cookie', async () => {
    const { base } = await listen();
    const res = await login(base);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ expiresAt: T0 + ADMIN_SESSION_MS });
    expect(res.headers.get('cache-control')).toBe('no-store');
    const cookie = cookieOf(res);
    expect(cookie).toMatch(new RegExp(`^${ADMIN_COOKIE}=[\\w-]{43}$`));
    expect((await session(base, cookie)).status).toBe(200);
  });

  it('sets the cookie HttpOnly, SameSite=Strict, Path=/api/admin, Max-Age 12 h, not Secure over http', async () => {
    const { base } = await listen();
    const header = (await login(base)).headers.get('set-cookie')!;
    const attributes = header.split(';').map((a) => a.trim().toLowerCase());
    expect(attributes).toContain('httponly');
    expect(attributes).toContain('samesite=strict');
    expect(attributes).toContain('path=/api/admin');
    expect(attributes).toContain(`max-age=${ADMIN_SESSION_MS / 1000}`);
    expect(attributes).not.toContain('secure');
  });

  it('adds Secure when the request came over HTTPS through a trusted proxy', async () => {
    const { base } = await listen({ trustProxy: 1 });
    const res = await login(base, PASSWORD, {
      'x-forwarded-proto': 'https',
      origin: `https://${new URL(base).host}`,
    });
    expect(res.status).toBe(200);
    const attributes = res.headers
      .get('set-cookie')!
      .split(';')
      .map((a) => a.trim().toLowerCase());
    expect(attributes).toContain('secure');
  });

  it('refuses a wrong password with 401 and no cookie', async () => {
    const { base } = await listen();
    const res = await login(base, 'open sesame!');
    expect(res.status).toBe(401);
    expect(await errorOf(res)).toBe(ADMIN_WRONG_PASSWORD_ERROR);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('refuses a body with no password, an empty one, or one past 1024 characters', async () => {
    const { base } = await listen();
    for (const body of [{}, { password: '' }, { password: 42 }, { password: 'x'.repeat(1025) }]) {
      const res = await post(base, '/login', body);
      expect(res.status).toBe(400);
      expect(res.headers.get('set-cookie')).toBeNull();
    }
  });

  it('answers 413 for a body far too large to be a password', async () => {
    const { base } = await listen({ adminPassword: ADMIN_PASSWORD });
    const res = await post(base, '/login', { password: 'x'.repeat(20_000) });
    expect(res.status).toBe(413);
  });

  it('allows 5 tries per IP per minute, right or wrong, then 429 even for the right password', async () => {
    const { base, advance } = await listen();
    for (let i = 0; i < ADMIN_LOGIN_RATE_LIMIT.max; i++) {
      expect((await login(base, 'wrong')).status).toBe(401);
    }
    const limited = await login(base);
    expect(limited.status).toBe(429);
    expect(await errorOf(limited)).toBe(ADMIN_RATE_LIMITED_ERROR);
    expect(limited.headers.get('set-cookie')).toBeNull();

    advance(ADMIN_LOGIN_RATE_LIMIT.windowMs);
    expect((await login(base)).status).toBe(200);
  });

  it('counts refused Origins and bodies against the limit too', async () => {
    const { base } = await listen();
    for (let i = 0; i < ADMIN_LOGIN_RATE_LIMIT.max; i++) {
      await login(base, PASSWORD, { origin: 'https://evil.example' });
    }
    expect((await login(base)).status).toBe(429);
  });

  it('a second sign-in ends the session it was sent with', async () => {
    const { base } = await listen();
    const first = cookieOf(await login(base));
    const second = cookieOf(await login(base, PASSWORD, { cookie: first }));
    expect((await session(base, first)).status).toBe(401);
    expect((await session(base, second)).status).toBe(200);
  });
});

describe('GET /api/admin/session', () => {
  it('is 401 with no cookie, or a cookie the server never issued', async () => {
    const { base } = await listen();
    expect((await session(base)).status).toBe(401);
    expect((await session(base, `${ADMIN_COOKIE}=${'A'.repeat(43)}`)).status).toBe(401);
  });

  it('answers {expiresAt} until 12 h after sign-in, then 401', async () => {
    const { base, advance } = await listen();
    const cookie = cookieOf(await login(base));
    advance(ADMIN_SESSION_MS - 1);
    const live = await session(base, cookie);
    expect(live.status).toBe(200);
    expect((await live.json()) as AdminSessionResponse).toEqual({
      expiresAt: T0 + ADMIN_SESSION_MS,
    });
    advance(1);
    expect((await session(base, cookie)).status).toBe(401);
  });

  it('does not survive a restart: a new app knows no session', async () => {
    const first = await listen();
    const cookie = cookieOf(await login(first.base));
    await new Promise((resolve) => server!.close(resolve));
    const second = await listen();
    expect((await session(second.base, cookie)).status).toBe(401);
  });
});

describe('POST /api/admin/logout', () => {
  it('ends the session and clears the cookie on its path', async () => {
    const { base } = await listen();
    const cookie = cookieOf(await login(base));
    const res = await post(base, '/logout', {}, { cookie });
    expect(res.status).toBe(200);
    const cleared = res.headers.get('set-cookie')!;
    expect(cleared).toMatch(new RegExp(`^${ADMIN_COOKIE}=;`));
    expect(cleared).toContain('Path=/api/admin');
    expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
    expect((await session(base, cookie)).status).toBe(401);
  });

  it('answers ok with no session', async () => {
    const { base } = await listen();
    expect((await post(base, '/logout')).status).toBe(200);
  });
});

describe('admin writes', () => {
  it('refuse a missing or cross-site Origin with 403', async () => {
    const { base } = await listen();
    const other = base.replace('127.0.0.1', 'localhost');
    for (const origin of [undefined, 'https://evil.example', other, 'null', `${base}/`]) {
      const res = await login(base, PASSWORD, { origin });
      expect(res.status).toBe(403);
      expect(res.headers.get('set-cookie')).toBeNull();
    }
  });

  it('refuse an https Origin when the request came over http', async () => {
    const { base } = await listen();
    const res = await login(base, PASSWORD, { origin: base.replace('http:', 'https:') });
    expect(res.status).toBe(403);
  });

  it('refuse a body that is not JSON with 415: a cross-site form cannot sign in', async () => {
    const { base } = await listen();
    for (const type of ['application/x-www-form-urlencoded', 'text/plain', undefined]) {
      const res = await post(base, '/login', `password=${PASSWORD}`, { 'content-type': type });
      expect(res.status).toBe(415);
    }
  });

  it('accept a JSON type with a charset', async () => {
    const { base } = await listen();
    const res = await login(base, PASSWORD, { 'content-type': 'application/json; charset=utf-8' });
    expect(res.status).toBe(200);
  });

  it('apply to logout: a cross-site logout leaves the session alone', async () => {
    const { base } = await listen();
    const cookie = cookieOf(await login(base));
    const res = await post(base, '/logout', {}, { cookie, origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect((await session(base, cookie)).status).toBe(200);
  });
});

it('answers 404 for an admin path that does not exist', async () => {
  const { base } = await listen();
  expect((await fetch(`${base}/api/admin/nope`)).status).toBe(404);
});

describe('built-in set admin (F106)', () => {
  let dir: string;
  let builtIns: BuiltInStore;
  const set = (id: string, title = `Set ${id}`): QuestionSet => ({ ...makeSet(2), id, title });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'buzzr-http-admin-'));
    builtIns = await openBuiltInStore(dir, { seed: [set('a', 'Old A'), set('b')] });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  /** The app with the store, signed in: `cookie` goes on every admin call. */
  async function signedIn() {
    const app = await listen({ builtIns });
    return { ...app, cookie: cookieOf(await login(app.base)) };
  }

  /** A same-origin JSON write with any method, as the Built-in tab sends it. */
  function write(
    base: string,
    method: string,
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    return fetch(`${base}/api/admin${path}`, {
      method,
      headers: { origin: base, 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  const importFile = (base: string, cookie: string, file: unknown) =>
    write(base, 'POST', '/built-in-sets/import', file, { cookie });

  async function publicList(base: string): Promise<BuiltInSetsResponse> {
    return (await (await fetch(`${base}/api/built-in-sets`)).json()) as BuiltInSetsResponse;
  }

  const ids = async (base: string) => (await publicList(base)).sets.map((s) => s.id);

  describe('POST /api/admin/built-in-sets/import', () => {
    it('adds a new id and replaces a live one, live on the next public fetch and on disk', async () => {
      const { base, cookie } = await signedIn();
      const res = await importFile(base, cookie, { sets: [set('c'), set('a', 'New A')] });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ added: 1, replaced: 1, rejected: [] });
      const { sets } = await publicList(base);
      expect(sets.map((s) => [s.id, s.title])).toEqual([
        ['a', 'New A'],
        ['b', 'Set b'],
        ['c', 'Set c'],
      ]);
      const onDisk = JSON.parse(await readFile(join(dir, BUILT_IN_FILE), 'utf8')) as {
        sets: QuestionSet[];
      };
      expect(onDisk.sets.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    });

    it('takes a single set and a bare array too', async () => {
      const { base, cookie } = await signedIn();
      expect(await (await importFile(base, cookie, set('c'))).json()).toMatchObject({ added: 1 });
      expect(await (await importFile(base, cookie, [set('d')])).json()).toMatchObject({ added: 1 });
      expect(await ids(base)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('rejects a set with a picture and imports the rest', async () => {
      const { base, cookie } = await signedIn();
      const pictured = {
        ...set('p', 'Pictures'),
        questions: [makeQuestion(1, { imageId: 'img-1' })],
      };
      const body = (await (
        await importFile(base, cookie, [pictured, set('c')])
      ).json()) as AdminImportResponse;
      expect(body).toEqual({
        added: 1,
        replaced: 0,
        rejected: [
          {
            label: 'Set 1 “Pictures”',
            errors: ['Built-in sets cannot have pictures (question 1)'],
          },
        ],
      });
      expect(await ids(base)).toEqual(['a', 'b', 'c']);
    });

    it(`rejects a new set past ${BUILT_IN_SETS_MAX} built-ins`, async () => {
      builtIns = await openBuiltInStore(join(dir, 'full'), {
        seed: Array.from({ length: BUILT_IN_SETS_MAX }, (_, i) => set(`s${i}`)),
      });
      const { base, cookie } = await signedIn();
      const body = (await (
        await importFile(base, cookie, set('new', 'One more'))
      ).json()) as AdminImportResponse;
      expect(body.added).toBe(0);
      expect(body.rejected).toEqual([
        {
          label: 'Set 1 “One more”',
          errors: [`The built-ins are full (${BUILT_IN_SETS_MAX} sets). Delete some first.`],
        },
      ]);
      expect((await publicList(base)).sets).toHaveLength(BUILT_IN_SETS_MAX);
    });

    it('refuses a file with no sets, or one that is not JSON, with 400', async () => {
      const { base, cookie } = await signedIn();
      const empty = await importFile(base, cookie, { sets: [] });
      expect(empty.status).toBe(400);
      expect(await errorOf(empty)).toBe('The file has no sets');
      const broken = await importFile(base, cookie, '{"sets": [');
      expect(broken.status).toBe(400);
      expect(await errorOf(broken)).toBe("This file isn't valid JSON.");
    });

    it(`refuses a body over ${ADMIN_IMPORT_MAX_BYTES / 1024 / 1024} MB with 413 and changes nothing`, async () => {
      const { base, cookie } = await signedIn();
      const huge = { ...set('c'), title: 'x'.repeat(ADMIN_IMPORT_MAX_BYTES) };
      const res = await importFile(base, cookie, huge);
      expect(res.status).toBe(413);
      expect(await errorOf(res)).toBe('The file is larger than 2 MB.');
      expect(await ids(base)).toEqual(['a', 'b']);
    });
  });

  describe('DELETE /api/admin/built-in-sets/:id', () => {
    it('removes the live set and its draft', async () => {
      await builtIns.update((data) => ({
        ...data,
        drafts: { a: set('a', 'draft'), b: set('b', 'draft') },
      }));
      const { base, cookie } = await signedIn();
      const res = await write(base, 'DELETE', '/built-in-sets/a', {}, { cookie });
      expect(res.status).toBe(200);
      expect(await ids(base)).toEqual(['b']);
      expect(builtIns.read().drafts).toEqual({ b: set('b', 'draft') });
    });

    it('is 404 for an id that is neither live nor a draft', async () => {
      const { base, cookie } = await signedIn();
      const res = await write(base, 'DELETE', '/built-in-sets/nope', {}, { cookie });
      expect(res.status).toBe(404);
      expect(await ids(base)).toEqual(['a', 'b']);
    });
  });

  describe('PUT /api/admin/sample-hidden', () => {
    it('hides and shows the sample on the public list', async () => {
      const { base, cookie } = await signedIn();
      const hide = await write(base, 'PUT', '/sample-hidden', { hidden: true }, { cookie });
      expect(await hide.json()).toEqual({ sampleHidden: true });
      expect((await publicList(base)).sampleHidden).toBe(true);
      await write(base, 'PUT', '/sample-hidden', { hidden: false }, { cookie });
      expect((await publicList(base)).sampleHidden).toBe(false);
    });

    it('refuses a body without a boolean with 400', async () => {
      const { base, cookie } = await signedIn();
      const res = await write(base, 'PUT', '/sample-hidden', { hidden: 'yes' }, { cookie });
      expect(res.status).toBe(400);
      expect((await publicList(base)).sampleHidden).toBe(false);
    });
  });

  describe('PUT /api/admin/categories/:name/hidden (F126)', () => {
    const inCategory = (id: string, category: string): QuestionSet => ({ ...set(id), category });

    /** Rivers (two live sets), Moons (one) and the uncategorised a and b. */
    async function seedCategories() {
      await builtIns.update((data) => ({
        ...data,
        sets: [
          ...data.sets,
          inCategory('r1', 'Rivers'),
          inCategory('r2', 'rivers '),
          inCategory('m1', 'Moons'),
        ],
      }));
    }

    const hide = (base: string, cookie: string, name: string, body: unknown) =>
      write(base, 'PUT', `/categories/${encodeURIComponent(name)}/hidden`, body, { cookie });

    async function adminCategories(base: string, cookie: string) {
      const res = await fetch(`${base}/api/admin/categories`, { headers: { cookie } });
      return ((await res.json()) as AdminCategoriesResponse).categories;
    }

    it('hides a category from the public list and shows it again, reported on the admin list', async () => {
      await seedCategories();
      const { base, cookie } = await signedIn();
      const hidden = await hide(base, cookie, 'RIVERS', { hidden: true });
      expect(hidden.status).toBe(200);
      expect(await hidden.json()).toEqual({ name: 'Rivers', hidden: true });
      expect(await ids(base)).toEqual(['a', 'b', 'm1']);
      expect(builtIns.read().hiddenCategories).toEqual(['rivers']);
      expect(
        (await adminCategories(base, cookie)).map((c) => [c.name, c.hidden, c.levels.length]),
      ).toEqual([
        ['Moons', false, 1],
        ['Rivers', true, 2],
      ]);
      // Hiding again changes nothing.
      await hide(base, cookie, 'Rivers', { hidden: true });
      expect(builtIns.read().hiddenCategories).toEqual(['rivers']);

      const shown = await hide(base, cookie, 'Rivers', { hidden: false });
      expect(await shown.json()).toEqual({ name: 'Rivers', hidden: false });
      expect(await ids(base)).toEqual(['a', 'b', 'r1', 'r2', 'm1']);
      expect((await adminCategories(base, cookie)).every((c) => !c.hidden)).toBe(true);
    });

    it('refuses a body without a boolean, or not JSON, with 400 and changes nothing', async () => {
      await seedCategories();
      const { base, cookie } = await signedIn();
      for (const body of [{ hidden: 'yes' }, {}, '{not json']) {
        const res = await hide(base, cookie, 'Rivers', body);
        expect(res.status).toBe(400);
        expect(await errorOf(res)).toMatch(/hidden/);
      }
      expect(builtIns.read().hiddenCategories).toEqual([]);
    });

    it('answers 404 for a category no set has', async () => {
      await seedCategories();
      const { base, cookie } = await signedIn();
      const res = await hide(base, cookie, 'Comets', { hidden: true });
      expect(res.status).toBe(404);
      expect(builtIns.read().hiddenCategories).toEqual([]);
    });

    it('is 401 without a session and 403 from another origin, and hides nothing', async () => {
      await seedCategories();
      const { base, cookie } = await signedIn();
      const anonymous = await write(base, 'PUT', '/categories/Rivers/hidden', { hidden: true });
      const foreign = await write(
        base,
        'PUT',
        '/categories/Rivers/hidden',
        { hidden: true },
        { cookie, origin: 'https://evil.example' },
      );
      expect([anonymous.status, foreign.status]).toEqual([401, 403]);
      expect(await ids(base)).toEqual(['a', 'b', 'r1', 'r2', 'm1']);
    });

    it('leaves drafts alone, and publishing a hidden category keeps it hidden', async () => {
      await seedCategories();
      // A new draft of the category, as a generation would leave it (reviewed).
      await builtIns.update((data) => ({
        ...data,
        drafts: { r3: inCategory('r3', 'Rivers') },
      }));
      const { base, cookie } = await signedIn();
      await hide(base, cookie, 'Rivers', { hidden: true });
      const rivers = (await adminCategories(base, cookie)).find((c) => c.name === 'Rivers')!;
      expect(rivers.levels.map((l) => [l.setId, l.status])).toEqual([
        ['r1', 'live'],
        ['r2', 'live'],
        ['r3', 'new'],
      ]);

      const published = await write(base, 'POST', '/categories/Rivers/publish', {}, { cookie });
      expect(published.status).toBe(200);
      expect(builtIns.read().sets.map((s) => s.id)).toContain('r3');
      expect(await ids(base)).toEqual(['a', 'b', 'm1']);
      expect((await adminCategories(base, cookie)).find((c) => c.name === 'Rivers')!.hidden).toBe(
        true,
      );
    });

    it('deleting a hidden category drops its key, so a new category of that name is shown', async () => {
      await seedCategories();
      const { base, cookie } = await signedIn();
      await hide(base, cookie, 'Rivers', { hidden: true });
      const deleted = await write(base, 'DELETE', '/categories/Rivers', {}, { cookie });
      expect(deleted.status).toBe(200);
      expect(builtIns.read().hiddenCategories).toEqual([]);
      expect(JSON.parse(await readFile(join(dir, BUILT_IN_FILE), 'utf8'))).toMatchObject({
        hiddenCategories: [],
      });
      await builtIns.update((data) => ({
        ...data,
        sets: [...data.sets, inCategory('r9', 'Rivers')],
      }));
      expect(await ids(base)).toEqual(['a', 'b', 'm1', 'r9']);
    });
  });

  describe('GET /api/admin/built-in-sets/export', () => {
    it('downloads buzzr-built-ins-<date>.json as {sets}, which re-imports as is', async () => {
      const { base, cookie } = await signedIn();
      await builtIns.update((data) => ({ ...data, drafts: { a: set('a', 'draft') } }));
      const res = await fetch(`${base}/api/admin/built-in-sets/export`, { headers: { cookie } });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/^application\/json/);
      const date = new Date(T0).toISOString().slice(0, 10);
      expect(res.headers.get('content-disposition')).toBe(
        `attachment; filename=buzzr-built-ins-${date}.json`,
      );
      const text = await res.text();
      // The live sets only: no drafts, no sampleHidden.
      expect(JSON.parse(text)).toEqual({ sets: builtIns.read().sets });

      const before = builtIns.read().sets;
      const again = await importFile(base, cookie, text);
      expect(await again.json()).toEqual({ added: 0, replaced: 2, rejected: [] });
      expect(builtIns.read().sets).toEqual(before);
    });
  });

  describe('drafts and publish (F107)', () => {
    const draftPath = (id: string) => `/built-in-sets/${id}/draft`;
    const getDraft = (base: string, cookie: string, id = 'a') =>
      fetch(`${base}/api/admin${draftPath(id)}`, { headers: { cookie } });
    const putDraft = (base: string, cookie: string, draft: unknown, id = 'a') =>
      write(base, 'PUT', draftPath(id), draft, { cookie });
    const publish = (base: string, cookie: string, id = 'a') =>
      write(base, 'POST', `/built-in-sets/${id}/publish`, {}, { cookie });
    const drafts = async (base: string, cookie: string) =>
      (await (
        await fetch(`${base}/api/admin/built-in-sets/drafts`, { headers: { cookie } })
      ).json()) as AdminDraftsResponse;
    const draftIds = async (base: string, cookie: string) => (await drafts(base, cookie)).ids;

    /** Set a, retitled and with its first answer blanked: a draft that cannot be published. */
    const unplayable = (): QuestionSet => {
      const live = set('a', 'Old A');
      return {
        ...live,
        title: '  ',
        questions: [{ ...live.questions[0]!, answer: '' }, live.questions[1]!],
      };
    };

    it('GET falls back to the live set when there is no draft', async () => {
      const { base, cookie } = await signedIn();
      const res = await getDraft(base, cookie);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ set: set('a', 'Old A'), draft: false, live: true });
      expect(await draftIds(base, cookie)).toEqual([]);
    });

    it('round-trips an unplayable draft, stamped, and never shows it on the public list', async () => {
      const { base, cookie, advance } = await signedIn();
      advance(5000);
      const res = await putDraft(base, cookie, unplayable());
      expect(res.status).toBe(200);
      const saved = { ...unplayable(), updatedAt: T0 + 5000 };
      expect(await res.json()).toEqual({ set: saved, draft: true, live: true });
      expect(await (await getDraft(base, cookie)).json()).toEqual({
        set: saved,
        draft: true,
        live: true,
      });
      expect(await draftIds(base, cookie)).toEqual(['a']);
      // Untouched where everyone else reads, and on disk beside the live set.
      expect((await publicList(base)).sets).toEqual([set('a', 'Old A'), set('b')]);
      const file = JSON.parse(await readFile(join(dir, BUILT_IN_FILE), 'utf8')) as {
        drafts: unknown;
      };
      expect(file.drafts).toEqual({ a: saved });
    });

    it('refuses a draft with a picture, past a limit, of another id, or for an unknown set', async () => {
      const { base, cookie } = await signedIn();
      const live = set('a');
      const pictured = { ...live, questions: [{ ...live.questions[0]!, imageId: 'img-1' }] };
      const long = { ...live, title: 'x'.repeat(SET_TITLE_MAX + 1) };
      const responses = [
        await putDraft(base, cookie, pictured),
        await putDraft(base, cookie, long),
        await putDraft(base, cookie, set('b')),
        await putDraft(base, cookie, { ...live, id: 'nope' }, 'nope'),
        await putDraft(base, cookie, '{"id": ', 'a'),
      ];
      expect(responses.map((r) => r.status)).toEqual([400, 400, 400, 404, 400]);
      expect(await errorOf(responses[0]!)).toBe(
        'Question 1 › imageId: Built-in sets cannot have pictures',
      );
      expect(await errorOf(responses[1]!)).toMatch(/^Title: /);
      expect(await draftIds(base, cookie)).toEqual([]);
    });

    it('a refused publish names the bad fields and changes nothing', async () => {
      const { base, cookie } = await signedIn();
      await putDraft(base, cookie, unplayable());
      const res = await publish(base, cookie);
      expect(res.status).toBe(400);
      const body = (await res.json()) as AdminPublishErrorBody;
      expect(body.error).toBe('The draft cannot be published yet.');
      expect(body.problems).toEqual([
        expect.stringMatching(/^Title: /),
        'Question 1 › answer: The answer is required',
      ]);
      expect((await publicList(base)).sets[0]).toEqual(set('a', 'Old A'));
      expect(await draftIds(base, cookie)).toEqual(['a']);
    });

    it('publish makes the draft the live set in place and drops the draft', async () => {
      const { base, cookie, advance } = await signedIn();
      const edited = { ...set('a', '  New A  '), category: 'Science' };
      await putDraft(base, cookie, edited);
      advance(9000);
      const res = await publish(base, cookie);
      expect(res.status).toBe(200);
      // Trimmed and stamped as an import would leave it.
      const live = { ...edited, title: 'New A', updatedAt: T0 + 9000 };
      expect(await res.json()).toEqual({ set: live, draft: false, live: true });
      expect((await publicList(base)).sets).toEqual([live, set('b')]);
      expect(await draftIds(base, cookie)).toEqual([]);
      expect(await (await getDraft(base, cookie)).json()).toEqual({
        set: live,
        draft: false,
        live: true,
      });
    });

    it('publish without a draft is 409, and for an unknown set 404', async () => {
      const { base, cookie } = await signedIn();
      expect((await publish(base, cookie)).status).toBe(409);
      expect((await publish(base, cookie, 'nope')).status).toBe(404);
    });

    it('discard drops the draft and answers the live set; the live set is untouched', async () => {
      const { base, cookie } = await signedIn();
      await putDraft(base, cookie, unplayable());
      const res = await write(base, 'DELETE', draftPath('a'), {}, { cookie });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ set: set('a', 'Old A'), draft: false, live: true });
      expect(await draftIds(base, cookie)).toEqual([]);
      expect(builtIns.read().sets[0]).toEqual(set('a', 'Old A'));
      // Again, with nothing to drop, is still fine; an unknown set is 404.
      expect((await write(base, 'DELETE', draftPath('a'), {}, { cookie })).status).toBe(200);
      expect((await write(base, 'DELETE', draftPath('nope'), {}, { cookie })).status).toBe(404);
    });

    /**
     * Holds each admin write at the store's door until `release`, so a change can land between a
     * route's first check and its write, as a second request could.
     */
    function holdWrites() {
      const real = builtIns;
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      let held = 0;
      builtIns = {
        read: () => real.read(),
        update: async (change) => {
          held += 1;
          await gate;
          return real.update(change);
        },
      };
      return { real, release, held: () => held };
    }

    it('a draft saved just as its set is deleted is refused, not left behind', async () => {
      const hold = holdWrites();
      const { base, cookie } = await signedIn();
      const put = putDraft(base, cookie, set('a', 'Late'));
      await vi.waitFor(() => expect(hold.held()).toBe(1));
      await hold.real.update((data) => ({ ...data, sets: data.sets.filter((s) => s.id !== 'a') }));
      hold.release();
      expect((await put).status).toBe(404);
      expect(hold.real.read().drafts).toEqual({});
    });

    it('a publish whose draft was saved again meanwhile is refused, and the newer draft kept', async () => {
      await builtIns.update((data) => ({ ...data, drafts: { a: set('a', 'First') } }));
      const hold = holdWrites();
      const { base, cookie } = await signedIn();
      const published = publish(base, cookie);
      await vi.waitFor(() => expect(hold.held()).toBe(1));
      await hold.real.update((data) => ({ ...data, drafts: { a: set('a', 'Second') } }));
      hold.release();
      const res = await published;
      expect(res.status).toBe(409);
      expect(await errorOf(res)).toBe('The draft changed while publishing. Publish again.');
      expect(hold.real.read().sets[0]).toEqual(set('a', 'Old A'));
      expect(hold.real.read().drafts).toEqual({ a: set('a', 'Second') });
    });

    it('every draft route is 401 without a session, and the writes need the Origin', async () => {
      const { base, cookie } = await signedIn();
      const responses = [
        await getDraft(base, ''),
        await putDraft(base, '', set('a')),
        await write(base, 'DELETE', draftPath('a'), {}),
        await publish(base, ''),
        await fetch(`${base}/api/admin/built-in-sets/drafts`),
      ];
      expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
      const crossSite = await write(base, 'PUT', draftPath('a'), set('a'), {
        cookie,
        origin: 'https://evil.example',
      });
      expect(crossSite.status).toBe(403);
      expect(await draftIds(base, cookie)).toEqual([]);
    });

    describe('a new built-in, a draft with no live set (F108)', () => {
      /** Stands a new draft `n` in the store, as the generator will (F109). */
      const seedNew = (draft: QuestionSet = set('n', 'New N')) =>
        builtIns.update((data) => ({ ...data, drafts: { ...data.drafts, [draft.id]: draft } }));

      it('round-trips through GET and PUT, marked not live, and never on the public list', async () => {
        await seedNew();
        const { base, cookie, advance } = await signedIn();
        const got = await getDraft(base, cookie, 'n');
        expect(got.status).toBe(200);
        expect(await got.json()).toEqual({ set: set('n', 'New N'), draft: true, live: false });

        advance(3000);
        const edited = { ...set('n', 'Edited'), questions: [] };
        const put = await putDraft(base, cookie, edited, 'n');
        expect(put.status).toBe(200);
        const saved = { ...edited, updatedAt: T0 + 3000 };
        expect(await put.json()).toEqual({ set: saved, draft: true, live: false });
        expect(await (await getDraft(base, cookie, 'n')).json()).toEqual({
          set: saved,
          draft: true,
          live: false,
        });
        expect(await ids(base)).toEqual(['a', 'b']);
      });

      it('the drafts list names it and gives it in full as new; a draft over a live set is not new', async () => {
        await seedNew();
        await builtIns.update((data) => ({
          ...data,
          drafts: { ...data.drafts, a: set('a', 'Draft A') },
        }));
        const { base, cookie } = await signedIn();
        expect(await drafts(base, cookie)).toEqual({
          ids: ['n', 'a'],
          newDrafts: [set('n', 'New N')],
        });
      });

      it('publish adds it as a live set, last, and drops the draft', async () => {
        await seedNew({ ...set('n', '  New N  '), category: 'Space' });
        const { base, cookie, advance } = await signedIn();
        advance(7000);
        const res = await publish(base, cookie, 'n');
        expect(res.status).toBe(200);
        const live = { ...set('n', 'New N'), category: 'Space', updatedAt: T0 + 7000 };
        expect(await res.json()).toEqual({ set: live, draft: false, live: true });
        expect((await publicList(base)).sets).toEqual([set('a', 'Old A'), set('b'), live]);
        expect(await drafts(base, cookie)).toEqual({ ids: [], newDrafts: [] });
        expect(await (await getDraft(base, cookie, 'n')).json()).toEqual({
          set: live,
          draft: false,
          live: true,
        });
      });

      it('an unplayable one is refused with its problems and stays a draft', async () => {
        await seedNew({ ...set('n'), title: '' });
        const { base, cookie } = await signedIn();
        const res = await publish(base, cookie, 'n');
        expect(res.status).toBe(400);
        expect(((await res.json()) as AdminPublishErrorBody).problems).toEqual([
          expect.stringMatching(/^Title: /),
        ]);
        expect(await ids(base)).toEqual(['a', 'b']);
        expect(await draftIds(base, cookie)).toEqual(['n']);
      });

      it(`publish is 409 when the built-ins are full (${BUILT_IN_SETS_MAX} sets)`, async () => {
        builtIns = await openBuiltInStore(join(dir, 'full'), {
          seed: Array.from({ length: BUILT_IN_SETS_MAX }, (_, i) => set(`s${i}`)),
        });
        await seedNew();
        const { base, cookie } = await signedIn();
        const res = await publish(base, cookie, 'n');
        expect(res.status).toBe(409);
        expect(await errorOf(res)).toBe(
          `The built-ins are full (${BUILT_IN_SETS_MAX} sets). Delete some first.`,
        );
        expect(builtIns.read().sets).toHaveLength(BUILT_IN_SETS_MAX);
        expect(await draftIds(base, cookie)).toEqual(['n']);
      });

      it('discard removes it and answers no set; after that every draft route is 404', async () => {
        await seedNew();
        const { base, cookie } = await signedIn();
        const res = await write(base, 'DELETE', draftPath('n'), {}, { cookie });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ set: null, draft: false, live: false });
        expect(builtIns.read().drafts).toEqual({});
        expect(await ids(base)).toEqual(['a', 'b']);
        const after = [
          await getDraft(base, cookie, 'n'),
          await putDraft(base, cookie, set('n'), 'n'),
          await write(base, 'DELETE', draftPath('n'), {}, { cookie }),
          await publish(base, cookie, 'n'),
        ];
        expect(after.map((r) => r.status)).toEqual([404, 404, 404, 404]);
        expect(builtIns.read().drafts).toEqual({});
      });

      it('the built-in delete removes it too', async () => {
        await seedNew();
        const { base, cookie } = await signedIn();
        expect((await write(base, 'DELETE', '/built-in-sets/n', {}, { cookie })).status).toBe(200);
        expect(builtIns.read().drafts).toEqual({});
      });

      it('a save just after it is discarded is refused, not brought back', async () => {
        await seedNew();
        const hold = holdWrites();
        const { base, cookie } = await signedIn();
        const put = putDraft(base, cookie, set('n', 'Late'), 'n');
        await vi.waitFor(() => expect(hold.held()).toBe(1));
        await hold.real.update((data) => ({ ...data, drafts: {} }));
        hold.release();
        expect((await put).status).toBe(404);
        expect(hold.real.read().drafts).toEqual({});
      });

      it('a publish just after it is discarded is 409 and adds nothing', async () => {
        await seedNew();
        const hold = holdWrites();
        const { base, cookie } = await signedIn();
        const published = publish(base, cookie, 'n');
        await vi.waitFor(() => expect(hold.held()).toBe(1));
        await hold.real.update((data) => ({ ...data, drafts: {} }));
        hold.release();
        expect((await published).status).toBe(409);
        expect(hold.real.read().sets.map((s) => s.id)).toEqual(['a', 'b']);
      });
    });
  });

  it('every built-in route is 401 without a session, and changes nothing', async () => {
    const { base } = await listen({ builtIns });
    const responses = [
      await importFile(base, '', set('c')),
      await write(base, 'DELETE', '/built-in-sets/a', {}),
      await write(base, 'PUT', '/sample-hidden', { hidden: true }),
      await fetch(`${base}/api/admin/built-in-sets/export`),
    ];
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401]);
    expect(await publicList(base)).toMatchObject({ sampleHidden: false });
    expect(await ids(base)).toEqual(['a', 'b']);
  });

  describe('one question of a draft, and the reviewed mark (F114)', () => {
    const questionPath = (qid: string, id = 'a') => `/built-in-sets/${id}/questions/${qid}`;
    const putQuestion = (base: string, cookie: string, qid: string, body: unknown, id = 'a') =>
      write(base, 'PUT', questionPath(qid, id), body, { cookie });
    const deleteQuestion = (base: string, cookie: string, qid: string, id = 'a') =>
      write(base, 'DELETE', questionPath(qid, id), {}, { cookie });
    const markReviewed = (base: string, cookie: string, id = 'a') =>
      write(base, 'POST', `/built-in-sets/${id}/reviewed`, {}, { cookie });

    /** A generated draft of set a, waiting for review. */
    async function seedDraft(): Promise<QuestionSet> {
      const draft = { ...set('a', 'Draft A'), questions: [makeQuestion(1), makeQuestion(2)] };
      await builtIns.update((data) => ({
        ...data,
        drafts: { ...data.drafts, a: draft },
        unreviewed: ['a'],
      }));
      return draft;
    }

    it('PUT changes the text, answer and notes of one question in the draft, keeping the rest', async () => {
      const draft = await seedDraft();
      const { base, cookie, advance } = await signedIn();
      advance(4000);
      const res = await putQuestion(base, cookie, 'q2', {
        text: '  Longest river?  ',
        answer: ' Nile ',
        hostNotes: 'Also: the Nile River',
      });
      expect(res.status).toBe(200);
      const edited = {
        ...makeQuestion(2),
        text: 'Longest river?',
        answer: 'Nile',
        hostNotes: 'Also: the Nile River',
      };
      const saved = { ...draft, questions: [makeQuestion(1), edited], updatedAt: T0 + 4000 };
      expect(await res.json()).toEqual({ set: saved, draft: true, live: true });
      expect(builtIns.read().drafts.a).toEqual(saved);
      // The live set is untouched, and an edit keeps the draft waiting for review as it was.
      expect(builtIns.read().sets[0]).toEqual(set('a', 'Old A'));
      expect(builtIns.read().unreviewed).toEqual(['a']);
    });

    it('PUT with no notes, or blank ones, drops them: Undo puts back a question that had none', async () => {
      await seedDraft();
      const { base, cookie } = await signedIn();
      expect((await putQuestion(base, cookie, 'q1', { text: 'T', answer: 'A' })).status).toBe(200);
      expect(builtIns.read().drafts.a!.questions[0]).toEqual({
        id: 'q1',
        text: 'T',
        answer: 'A',
        points: 100,
      });
      const blank = { text: 'T2', answer: 'A2', hostNotes: '   ' };
      expect((await putQuestion(base, cookie, 'q2', blank)).status).toBe(200);
      expect(builtIns.read().drafts.a!.questions[1]).not.toHaveProperty('hostNotes');
    });

    it('PUT edits the draft as it is now, so a question changed meanwhile keeps that change', async () => {
      await seedDraft();
      const { base, cookie } = await signedIn();
      // A replacement lands on q1 after the review list loaded.
      await builtIns.update((data) => ({
        ...data,
        drafts: {
          ...data.drafts,
          a: {
            ...data.drafts.a!,
            questions: [makeQuestion(1, { text: 'Replaced' }), makeQuestion(2)],
          },
        },
      }));
      await putQuestion(base, cookie, 'q2', { text: 'Edited', answer: 'B' });
      expect(builtIns.read().drafts.a!.questions.map((q) => q.text)).toEqual([
        'Replaced',
        'Edited',
      ]);
    });

    it('PUT refuses a body past the question limits, or not a question, with 400', async () => {
      const draft = await seedDraft();
      const { base, cookie } = await signedIn();
      const bodies: unknown[] = [
        { text: 'x'.repeat(QUESTION_TEXT_MAX + 1), answer: 'A' },
        { text: 'T', answer: 'x'.repeat(ANSWER_MAX + 1) },
        { text: 'T', answer: 'A', hostNotes: 'x'.repeat(HOST_NOTES_MAX + 1) },
        { text: 'T' },
        { text: 1, answer: 'A' },
        '{"text": ',
      ];
      for (const body of bodies) {
        const res = await putQuestion(base, cookie, 'q1', body);
        expect(res.status).toBe(400);
        expect(await errorOf(res)).toMatch(/^Send the question as/);
      }
      expect(builtIns.read().drafts.a).toEqual(draft);
    });

    it('PUT and DELETE are 404 for an unknown draft or question, a live set with no draft included', async () => {
      await seedDraft();
      const { base, cookie } = await signedIn();
      const body = { text: 'T', answer: 'A' };
      const responses = [
        await putQuestion(base, cookie, 'q1', body, 'b'),
        await putQuestion(base, cookie, 'q1', body, 'nope'),
        await putQuestion(base, cookie, 'q9', body),
        await putQuestion(base, cookie, 'bad id', body),
        await deleteQuestion(base, cookie, 'q1', 'b'),
        await deleteQuestion(base, cookie, 'q9'),
      ];
      expect(responses.map((r) => r.status)).toEqual([404, 404, 404, 404, 404, 404]);
      expect(await errorOf(responses[0]!)).toBe('There is no draft with that id.');
      expect(await errorOf(responses[2]!)).toBe('The draft has no question with that id.');
      expect(builtIns.read().drafts).not.toHaveProperty('b');
    });

    it('DELETE removes one question from the draft and answers with the draft', async () => {
      const draft = await seedDraft();
      const { base, cookie, advance } = await signedIn();
      advance(2000);
      const res = await deleteQuestion(base, cookie, 'q1');
      expect(res.status).toBe(200);
      const saved = { ...draft, questions: [makeQuestion(2)], updatedAt: T0 + 2000 };
      expect(await res.json()).toEqual({ set: saved, draft: true, live: true });
      expect(builtIns.read().drafts.a).toEqual(saved);
      expect((await deleteQuestion(base, cookie, 'q1')).status).toBe(404);
    });

    it('the question and reviewed routes are 401 without a session, and change nothing', async () => {
      const draft = await seedDraft();
      const { base } = await listen({ builtIns });
      const responses = [
        await putQuestion(base, '', 'q1', { text: 'T', answer: 'A' }),
        await deleteQuestion(base, '', 'q1'),
        await markReviewed(base, ''),
      ];
      expect(responses.map((r) => r.status)).toEqual([401, 401, 401]);
      expect(builtIns.read().drafts.a).toEqual(draft);
      expect(builtIns.read().unreviewed).toEqual(['a']);
    });

    it("the question routes need this site's Origin, like every admin write", async () => {
      await seedDraft();
      const { base, cookie } = await signedIn();
      const res = await write(
        base,
        'DELETE',
        questionPath('q1'),
        {},
        { cookie, origin: 'https://evil.example' },
      );
      expect(res.status).toBe(403);
      expect(builtIns.read().drafts.a!.questions).toHaveLength(2);
    });

    it('POST reviewed takes the draft off the unreviewed list, and is 404 without a draft', async () => {
      await seedDraft();
      const { base, cookie } = await signedIn();
      const res = await markReviewed(base, cookie);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ setId: 'a', reviewed: true });
      expect(builtIns.read().unreviewed).toEqual([]);
      const file = JSON.parse(await readFile(join(dir, BUILT_IN_FILE), 'utf8')) as {
        unreviewed: string[];
      };
      expect(file.unreviewed).toEqual([]);
      // Again is fine; a live set with no draft, or no set, is not.
      expect((await markReviewed(base, cookie)).status).toBe(200);
      expect((await markReviewed(base, cookie, 'b')).status).toBe(404);
      expect((await markReviewed(base, cookie, 'nope')).status).toBe(404);
    });

    it('an editor save leaves the mark as it is, and a draft the editor starts is never unreviewed', async () => {
      const draft = await seedDraft();
      const { base, cookie } = await signedIn();
      await write(base, 'PUT', '/built-in-sets/a/draft', { ...draft, title: 'Edited' }, { cookie });
      expect(builtIns.read().unreviewed).toEqual(['a']);
      await write(base, 'PUT', '/built-in-sets/b/draft', set('b', 'Edited B'), { cookie });
      expect(Object.keys(builtIns.read().drafts)).toEqual(['a', 'b']);
      expect(builtIns.read().unreviewed).toEqual(['a']);
    });

    it.each([
      ['publishing it', 'POST', '/built-in-sets/a/publish'],
      ['discarding it', 'DELETE', '/built-in-sets/a/draft'],
      ['deleting the set', 'DELETE', '/built-in-sets/a'],
    ])('%s takes the draft off the unreviewed list', async (_what, method, path) => {
      await seedDraft();
      const { base, cookie } = await signedIn();
      expect((await write(base, method, path, {}, { cookie })).status).toBe(200);
      expect(builtIns.read().unreviewed).toEqual([]);
    });
  });

  it("writes need this site's Origin and a JSON type, even signed in", async () => {
    const { base, cookie } = await signedIn();
    const crossSite = await write(
      base,
      'DELETE',
      '/built-in-sets/a',
      {},
      {
        cookie,
        origin: 'https://evil.example',
      },
    );
    expect(crossSite.status).toBe(403);
    const form = await write(base, 'POST', '/built-in-sets/import', 'x=1', {
      cookie,
      'content-type': 'application/x-www-form-urlencoded',
    });
    expect(form.status).toBe(415);
    expect(await ids(base)).toEqual(['a', 'b']);
  });

  it('without the store, the built-in routes are 404', async () => {
    const { base } = await listen();
    const cookie = cookieOf(await login(base));
    const res = await fetch(`${base}/api/admin/built-in-sets/export`, { headers: { cookie } });
    expect(res.status).toBe(404);
  });
});
