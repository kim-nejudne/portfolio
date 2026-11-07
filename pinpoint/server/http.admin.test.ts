import { execFile } from 'node:child_process';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { ADMIN_COOKIE, ADMIN_SESSION_MS, RATE_LIMITS } from '#shared/constants.js';
import {
  ADMIN_RATE_LIMITED_ERROR,
  ADMIN_WRONG_PASSWORD_ERROR,
  AdminSessions,
  verifyAdminPassword,
} from './admin.js';
import { CategoryStore } from './categoryStore.js';
import { parseEnv } from './env.js';
import { createApp, type AppOptions } from './http.js';
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
