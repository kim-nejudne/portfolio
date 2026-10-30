import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ADMIN_COOKIE,
  ADMIN_LOGIN_RATE_LIMIT,
  ADMIN_RATE_LIMITED_ERROR,
  ADMIN_SESSION_MS,
  ADMIN_WRONG_PASSWORD_ERROR,
} from '../shared/constants.js';
import type { AdminSessionResponse, HttpErrorBody } from '../shared/types.js';
import { parseAdminPasswordHash } from './env.js';
import { createApp, type AppOptions } from './http.js';
import { adminHashFor } from './test/admin.js';
import { T0 } from './test/rooms.js';

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
