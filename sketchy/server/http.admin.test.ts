// `/api/admin` sign-in (F80): status, setup once, reset, login, logout, the write guard, the shared
// rate limit, cookie flags, admin.env across a restart, and 404 when the admin isn't configured.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_SESSION_MS } from '../shared/constants.js';
import { AdminSessions, verifyAdminPassword } from './admin.js';
import { openAdminPassword } from './adminPassword.js';
import { ADMIN_ERRORS } from './adminRoutes.js';
import { createApp, type AppOptions } from './http.js';
import { testHash } from './test/admin.js';
import { testCategories } from './test/packs.js';

const CODE = 'pencil-moon-42';
const PASSWORD = 'a very long password';
const T0 = 1_800_000_000_000;

let dir: string;
let servers: Server[] = [];
let now = T0;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sketchy-admin-http-'));
  now = T0;
});

afterEach(async () => {
  await Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve))));
  servers = [];
  await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

interface Started {
  base: string;
  sessions: AdminSessions;
}

/** A server over `dir`, as `index.ts` starts one: the code from the env, the hash from admin.env. */
async function start(
  setupCode: string | null = CODE,
  more: Partial<AppOptions> = {},
): Promise<Started> {
  const { password } = await openAdminPassword(dir);
  const sessions = new AdminSessions();
  const server = createApp({
    categories: testCategories(),
    clock: () => now,
    admin: { setupCode, password, sessions, hash: testHash },
    ...more,
  }).listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, sessions };
}

interface PostOptions {
  cookie?: string;
  origin?: string | null;
  contentType?: string;
  headers?: Record<string, string>;
  raw?: string;
}

function post(base: string, path: string, body: unknown, options: PostOptions = {}) {
  const headers: Record<string, string> = {
    'content-type': options.contentType ?? 'application/json',
    ...options.headers,
  };
  if (options.origin !== null) headers.origin = options.origin ?? base;
  if (options.cookie) headers.cookie = options.cookie;
  return fetch(`${base}/api/admin${path}`, {
    method: 'POST',
    headers,
    body: options.raw ?? JSON.stringify(body),
  });
}

async function status(base: string, cookie?: string) {
  const res = await fetch(`${base}/api/admin/status`, { headers: cookie ? { cookie } : {} });
  return (await res.json()) as unknown;
}

/** `sketchy_admin=<token>` from a response, or undefined. */
function cookieOf(res: Response): string | undefined {
  const line = res.headers.getSetCookie().find((c) => c.startsWith('sketchy_admin='));
  return line?.split(';')[0];
}

async function setUp(base: string, password = PASSWORD): Promise<string> {
  const res = await post(base, '/setup', { setupCode: CODE, password });
  expect(res.status).toBe(200);
  return cookieOf(res)!;
}

describe('admin not configured (no setup code, no hash)', () => {
  it('status says so, and every other /api/admin route is 404', async () => {
    const { base } = await start(null);
    expect(await status(base)).toEqual({ configured: false, passwordSet: false, signedIn: false });
    for (const path of ['/setup', '/reset', '/login', '/logout', '/categories']) {
      const res = await post(base, path, { setupCode: CODE, password: PASSWORD });
      expect(res.status, path).toBe(404);
      expect(await res.json()).toEqual({ ok: false, error: 'Not found.' });
    }
    expect((await fetch(`${base}/api/admin/anything`)).status).toBe(404);
  });

  it('is the same when no admin is wired into the app at all', async () => {
    const server = createApp({ categories: testCategories() }).listen(0);
    servers.push(server);
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    expect(await status(base)).toEqual({ configured: false, passwordSet: false, signedIn: false });
    expect((await post(base, '/login', { password: PASSWORD })).status).toBe(404);
  });
});

describe('setup', () => {
  it('is setup mode with a code and no hash, and setup signs in and writes admin.env', async () => {
    const { base } = await start();
    expect(await status(base)).toEqual({ configured: true, passwordSet: false, signedIn: false });

    const res = await post(base, '/setup', { setupCode: CODE, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const cookie = cookieOf(res)!;
    expect(await status(base, cookie)).toEqual({
      configured: true,
      passwordSet: true,
      signedIn: true,
    });
    expect(await readFile(join(dir, 'admin.env'), 'utf8')).toMatch(
      /^ADMIN_PASSWORD_HASH=scrypt\$1024\$8\$1\$[\w-]+\$[\w-]+\n$/,
    );
  });

  it('works only once: a second setup is refused, even with the right code', async () => {
    const { base } = await start();
    await setUp(base);
    const res = await post(base, '/setup', { setupCode: CODE, password: 'another long password' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: ADMIN_ERRORS.alreadySet });
    // The first password still signs in; the second never took.
    expect((await post(base, '/login', { password: PASSWORD })).status).toBe(200);
    expect((await post(base, '/login', { password: 'another long password' })).status).toBe(401);
  });

  it('refuses a wrong setup code and writes nothing', async () => {
    const { base } = await start();
    const res = await post(base, '/setup', { setupCode: 'pencil-moon-41', password: PASSWORD });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: ADMIN_ERRORS.wrongSetupCode });
    expect(cookieOf(res)).toBeUndefined();
    expect(await status(base)).toMatchObject({ passwordSet: false });
    await expect(readFile(join(dir, 'admin.env'))).rejects.toThrow();
  });

  it('needs a password of at least 12 characters', async () => {
    const { base } = await start();
    const res = await post(base, '/setup', { setupCode: CODE, password: '11 chars ok' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: ADMIN_ERRORS.shortPassword });
    expect((await post(base, '/setup', { setupCode: CODE, password: '12 chars ok!' })).status).toBe(
      200,
    );
  });

  it('zod-validates the body: missing fields, wrong types, extra keys, bad JSON, too large', async () => {
    const { base } = await start(CODE, { trustProxy: true });
    const ip = (n: number) => ({ headers: { 'x-forwarded-for': `10.0.0.${n}` } });
    const bodies: [unknown, PostOptions][] = [
      [{ setupCode: CODE }, ip(1)],
      [{ setupCode: 42, password: PASSWORD }, ip(2)],
      [{ setupCode: CODE, password: PASSWORD, admin: true }, ip(3)],
      [null, { ...ip(4), raw: '{"setupCode":' }],
      [{ setupCode: CODE, password: 'x'.repeat(20_000) }, ip(5)],
    ];
    for (const [body, options] of bodies) {
      const res = await post(base, '/setup', body, options);
      expect([400, 413]).toContain(res.status);
      expect(await res.json()).toEqual({ ok: false, error: ADMIN_ERRORS.setupBody });
    }
    expect(await status(base)).toMatchObject({ passwordSet: false });
  });

  it('is 404 when the admin is configured by a hash alone (no setup code)', async () => {
    await writeFile(join(dir, 'admin.env'), `ADMIN_PASSWORD_HASH=${await testHash(PASSWORD)}\n`);
    const { base } = await start(null);
    expect(await status(base)).toEqual({ configured: true, passwordSet: true, signedIn: false });
    expect((await post(base, '/setup', { setupCode: CODE, password: PASSWORD })).status).toBe(404);
    expect((await post(base, '/login', { password: PASSWORD })).status).toBe(200);
  });
});

describe('login and logout', () => {
  it('login is refused before a password is set', async () => {
    const { base } = await start();
    const res = await post(base, '/login', { password: PASSWORD });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: ADMIN_ERRORS.noPassword });
  });

  it('refuses a wrong password and signs in with the right one; logout ends the session', async () => {
    const { base } = await start();
    await setUp(base);
    const wrong = await post(base, '/login', { password: 'not the password' });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ ok: false, error: ADMIN_ERRORS.wrongPassword });
    expect(cookieOf(wrong)).toBeUndefined();

    const res = await post(base, '/login', { password: PASSWORD });
    expect(res.status).toBe(200);
    const cookie = cookieOf(res)!;
    expect(await status(base, cookie)).toMatchObject({ signedIn: true });

    const out = await post(base, '/logout', {}, { cookie });
    expect(out.status).toBe(200);
    expect(res.headers.getSetCookie().length).toBe(1);
    expect(out.headers.getSetCookie()[0]).toMatch(/^sketchy_admin=;.*Expires=Thu, 01 Jan 1970/);
    expect(await status(base, cookie)).toMatchObject({ signedIn: false });
    // Twice, or with no cookie, is still ok.
    expect((await post(base, '/logout', {})).status).toBe(200);
  });

  it('a session ends after 12 hours', async () => {
    const { base } = await start();
    const cookie = await setUp(base);
    now = T0 + ADMIN_SESSION_MS - 1;
    expect(await status(base, cookie)).toMatchObject({ signedIn: true });
    now = T0 + ADMIN_SESSION_MS;
    expect(await status(base, cookie)).toMatchObject({ signedIn: false });
  });

  it('a made-up cookie is not signed in', async () => {
    const { base } = await start();
    await setUp(base);
    expect(await status(base, 'sketchy_admin=made-up')).toMatchObject({ signedIn: false });
  });
});

describe('cookie flags', () => {
  it('is httpOnly, SameSite=Strict, path /api/admin, 12 h, and not Secure over plain http', async () => {
    const { base } = await start();
    const res = await post(base, '/setup', { setupCode: CODE, password: PASSWORD });
    const line = res.headers.getSetCookie()[0]!;
    expect(line).toMatch(/^sketchy_admin=[\w-]{43};/);
    expect(line).toContain('Path=/api/admin');
    expect(line).toContain('HttpOnly');
    expect(line).toContain('SameSite=Strict');
    expect(line).toContain(`Max-Age=${ADMIN_SESSION_MS / 1000}`);
    expect(line).not.toContain('Secure');
  });

  it('is Secure when the request came over HTTPS (nginx sets X-Forwarded-Proto)', async () => {
    const { base } = await start(CODE, { trustProxy: 1 });
    // Over HTTPS the browser's Origin is https://host.
    const origin = base.replace('http:', 'https:');
    const res = await post(
      base,
      '/setup',
      { setupCode: CODE, password: PASSWORD },
      { origin, headers: { 'x-forwarded-proto': 'https' } },
    );
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie()[0]).toContain('Secure');
  });
});

describe('write guard (CSRF)', () => {
  it('refuses a missing or foreign Origin, and a body that is not JSON', async () => {
    const { base } = await start(CODE, { trustProxy: true });
    const ip = (n: number) => ({ 'x-forwarded-for': `10.1.0.${n}` });
    for (const path of ['/setup', '/reset', '/login', '/logout']) {
      const body = { setupCode: CODE, password: PASSWORD };
      const none = await post(base, path, body, { origin: null, headers: ip(1) });
      expect(none.status, path).toBe(403);
      expect(await none.json()).toEqual({ ok: false, error: ADMIN_ERRORS.fromThisSite });
      const foreign = await post(base, path, body, {
        origin: 'https://evil.example',
        headers: ip(2),
      });
      expect(foreign.status, path).toBe(403);
      const form = await post(base, path, body, {
        contentType: 'application/x-www-form-urlencoded',
        headers: ip(3),
      });
      expect(form.status, path).toBe(415);
      expect(await form.json()).toEqual({ ok: false, error: ADMIN_ERRORS.asJson });
    }
    expect(await status(base)).toMatchObject({ passwordSet: false });
  });

  it('a logout from another site leaves the session alone', async () => {
    const { base } = await start();
    const cookie = await setUp(base);
    const res = await post(base, '/logout', {}, { cookie, origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(await status(base, cookie)).toMatchObject({ signedIn: true });
  });
});

describe('reset ("Forgot password")', () => {
  it('refuses a wrong code and keeps the old password', async () => {
    const { base } = await start();
    await setUp(base);
    const res = await post(base, '/reset', {
      setupCode: 'wrong code',
      password: 'brand new password',
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: ADMIN_ERRORS.wrongSetupCode });
    expect((await post(base, '/login', { password: PASSWORD })).status).toBe(200);
    expect((await post(base, '/login', { password: 'brand new password' })).status).toBe(401);
  });

  it('sets a new password, signs out every other session, and signs this browser in', async () => {
    const { base, sessions } = await start();
    const other = await setUp(base);
    const res = await post(base, '/reset', { setupCode: CODE, password: 'brand new password' });
    expect(res.status).toBe(200);
    const mine = cookieOf(res)!;
    expect(await status(base, other)).toMatchObject({ signedIn: false });
    expect(await status(base, mine)).toMatchObject({ signedIn: true });
    expect(sessions.size).toBe(1);
    expect((await post(base, '/login', { password: PASSWORD })).status).toBe(401);
    expect((await post(base, '/login', { password: 'brand new password' })).status).toBe(200);
  });

  it('also works before any password is set, and needs 12 characters', async () => {
    const { base } = await start();
    expect((await post(base, '/reset', { setupCode: CODE, password: 'too short' })).status).toBe(
      400,
    );
    expect((await post(base, '/reset', { setupCode: CODE, password: PASSWORD })).status).toBe(200);
    expect(await status(base)).toMatchObject({ passwordSet: true });
  });

  it('a sign-in still checking the old password when a reset lands gets no session', async () => {
    // The first check after `hold` is set signals `entered`, then waits for `release`.
    let hold = false;
    let entered!: () => void;
    const checking = new Promise<void>((resolve) => (entered = resolve));
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    const { base } = await start(CODE, {
      admin: {
        setupCode: CODE,
        password: (await openAdminPassword(dir)).password,
        hash: testHash,
        verify: async (password, stored) => {
          const ok = await verifyAdminPassword(password, stored);
          if (hold) {
            hold = false;
            entered();
            await released;
          }
          return ok;
        },
      },
    });
    await setUp(base);
    hold = true;
    const login = post(base, '/login', { password: PASSWORD });
    await checking;
    const reset = await post(base, '/reset', { setupCode: CODE, password: 'brand new password' });
    expect(reset.status).toBe(200);
    release();
    const res = await login;
    expect(res.status).toBe(401);
    expect(cookieOf(res)).toBeUndefined();
  });

  it('is refused without a setup code on the server', async () => {
    await writeFile(join(dir, 'admin.env'), `ADMIN_PASSWORD_HASH=${await testHash(PASSWORD)}\n`);
    const { base } = await start(null);
    const res = await post(base, '/reset', { setupCode: CODE, password: 'brand new password' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: ADMIN_ERRORS.noSetupCode });
    expect((await post(base, '/login', { password: PASSWORD })).status).toBe(200);
  });

  it('signs out every signed-in browser, not just one', async () => {
    // Setup ends sessions too, but none can exist before a password does.
    const { base } = await start();
    const first = await setUp(base);
    const second = cookieOf(await post(base, '/login', { password: PASSWORD }))!;
    expect(await status(base, first)).toMatchObject({ signedIn: true });
    expect(await status(base, second)).toMatchObject({ signedIn: true });
    await post(base, '/reset', { setupCode: CODE, password: 'brand new password' });
    expect(await status(base, first)).toMatchObject({ signedIn: false });
    expect(await status(base, second)).toMatchObject({ signedIn: false });
  });
});

describe('rate limit', () => {
  it('setup, reset and login share 5 tries per IP per minute, right or wrong', async () => {
    const { base } = await start();
    await setUp(base); // 1
    expect((await post(base, '/login', { password: 'wrong password!' })).status).toBe(401); // 2
    expect((await post(base, '/reset', { setupCode: 'nope', password: PASSWORD })).status).toBe(
      401,
    ); // 3
    expect((await post(base, '/setup', { setupCode: CODE, password: PASSWORD })).status).toBe(409); // 4
    expect((await post(base, '/login', { password: PASSWORD })).status).toBe(200); // 5
    for (const path of ['/login', '/reset', '/setup']) {
      const res = await post(base, path, { setupCode: CODE, password: PASSWORD });
      expect(res.status, path).toBe(429);
      expect(await res.json()).toEqual({ ok: false, error: ADMIN_ERRORS.rateLimited });
    }
    // Logout and status are not limited.
    expect((await post(base, '/logout', {})).status).toBe(200);
    now = T0 + 60_000;
    expect((await post(base, '/login', { password: PASSWORD })).status).toBe(200);
  });

  it('counts per IP behind the proxy', async () => {
    const { base } = await start(CODE, { trustProxy: 1 });
    const from = (ip: string) => ({ headers: { 'x-forwarded-for': ip } });
    for (let i = 0; i < 5; i++) {
      await post(base, '/login', { password: 'x' }, from('203.0.113.1'));
    }
    expect((await post(base, '/login', { password: 'x' }, from('203.0.113.1'))).status).toBe(429);
    expect((await post(base, '/login', { password: 'x' }, from('203.0.113.2'))).status).toBe(409);
  });
});

describe('admin.env across restarts', () => {
  it('a restart keeps the password and signs the admin out', async () => {
    const first = await start();
    const cookie = await setUp(first.base);
    const second = await start();
    expect(await status(second.base, cookie)).toEqual({
      configured: true,
      passwordSet: true,
      signedIn: false,
    });
    expect((await post(second.base, '/login', { password: PASSWORD })).status).toBe(200);
  });

  it('deleting the ADMIN_PASSWORD_HASH line and restarting returns to setup mode', async () => {
    const first = await start();
    await setUp(first.base);
    const path = join(dir, 'admin.env');
    await writeFile(path, (await readFile(path, 'utf8')).replace(/^ADMIN_PASSWORD_HASH=.*$/m, ''));
    const second = await start();
    expect(await status(second.base)).toEqual({
      configured: true,
      passwordSet: false,
      signedIn: false,
    });
    expect(
      (await post(second.base, '/setup', { setupCode: CODE, password: 'brand new password' }))
        .status,
    ).toBe(200);
  });
});

describe('secrets', () => {
  it('no response or log line carries the setup code, a password, the hash or a session token', async () => {
    const logged: string[] = [];
    for (const method of ['log', 'warn', 'error', 'info'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(' '));
      });
    }
    const { base } = await start();
    const bodies: string[] = [];
    const record = async (res: Response) => {
      bodies.push(await res.clone().text());
      return res;
    };
    await record(await fetch(`${base}/api/admin/status`));
    const setup = await record(await post(base, '/setup', { setupCode: CODE, password: PASSWORD }));
    const token = cookieOf(setup)!.split('=')[1]!;
    await record(await post(base, '/login', { password: 'wrong password!' }));
    await record(await post(base, '/login', { password: PASSWORD }));
    await record(await post(base, '/reset', { setupCode: CODE, password: 'brand new password' }));
    await record(
      await fetch(`${base}/api/admin/status`, { headers: { cookie: `sketchy_admin=${token}` } }),
    );
    const hash = (await readFile(join(dir, 'admin.env'), 'utf8')).split('=')[1]!.trim();
    const salt = hash.split('$')[4]!;

    const everything = [...bodies, ...logged].join('\n');
    for (const secret of [CODE, PASSWORD, 'brand new password', hash, salt, token]) {
      expect(everything).not.toContain(secret);
    }
    expect(logged.some((line) => /Admin password reset/.test(line))).toBe(true);
  });

  it('marks every admin answer no-store', async () => {
    const { base } = await start();
    expect((await fetch(`${base}/api/admin/status`)).headers.get('cache-control')).toBe('no-store');
    expect((await post(base, '/login', { password: PASSWORD })).headers.get('cache-control')).toBe(
      'no-store',
    );
  });
});
