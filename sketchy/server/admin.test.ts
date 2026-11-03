// Admin sign-in pieces (F80). The verify and session tests are ported from Buzzr
// (buzzer/server/admin.test.ts).
import { describe, expect, it } from 'vitest';
import { ADMIN_COOKIE, ADMIN_SESSION_MS } from '../shared/constants.js';
import {
  adminCookie,
  AdminSessions,
  hashAdminPassword,
  sameSecret,
  SCRYPT_COSTS,
  verifyAdminPassword,
} from './admin.js';
import { parseAdminPasswordHash } from './env.js';
import { testHash, TEST_SCRYPT } from './test/admin.js';

const T0 = 1_800_000_000_000;

describe('hashAdminPassword', () => {
  it('writes scrypt$N$r$p$salt$hash that parseAdminPasswordHash reads back', async () => {
    const text = await testHash('correct horse battery');
    expect(text).toMatch(/^scrypt\$1024\$8\$1\$[\w-]{22}\$[\w-]{43}$/);
    const parsed = parseAdminPasswordHash(text)!;
    expect(parsed.salt).toHaveLength(16);
    expect(parsed.hash).toHaveLength(32);
  });

  it('salts every hash, so the same password hashes differently', async () => {
    expect(await testHash('same password')).not.toBe(await testHash('same password'));
  });

  it('uses 2^15, 8, 1 by default (32 MB, under the 64 MB cap parseAdminPasswordHash allows)', async () => {
    expect(SCRYPT_COSTS).toEqual({ N: 32768, r: 8, p: 1 });
    const text = await hashAdminPassword('a real default-cost password');
    expect(text).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(parseAdminPasswordHash(text)).not.toBeNull();
  });
});

describe('verifyAdminPassword', () => {
  it('accepts the password the hash was made from', async () => {
    const stored = parseAdminPasswordHash(await testHash('correct horse'))!;
    await expect(verifyAdminPassword('correct horse', stored)).resolves.toBe(true);
  });

  it('refuses any other password, including a case or space change', async () => {
    const stored = parseAdminPasswordHash(await testHash('correct horse'))!;
    for (const wrong of ['Correct horse', 'correct horse ', 'correct', '']) {
      await expect(verifyAdminPassword(wrong, stored)).resolves.toBe(false);
    }
  });

  it('treats composed and decomposed accents as the same password', async () => {
    const stored = parseAdminPasswordHash(await hashAdminPassword('café', TEST_SCRYPT))!;
    await expect(verifyAdminPassword('café', stored)).resolves.toBe(true);
  });
});

describe('sameSecret (setup code, constant time)', () => {
  it('is true only for the same string', () => {
    expect(sameSecret('pencil-moon-42', 'pencil-moon-42')).toBe(true);
    expect(sameSecret('pencil-moon-43', 'pencil-moon-42')).toBe(false);
    expect(sameSecret('PENCIL-MOON-42', 'pencil-moon-42')).toBe(false);
  });

  it('compares strings of any length without throwing (both are hashed to 32 bytes)', () => {
    // timingSafeEqual throws on different lengths; hashing first keeps the length secret too.
    expect(sameSecret('', 'pencil-moon-42')).toBe(false);
    expect(sameSecret('p', 'pencil-moon-42')).toBe(false);
    expect(sameSecret('x'.repeat(1024), 'pencil-moon-42')).toBe(false);
  });
});

describe('AdminSessions (ported from Buzzr)', () => {
  it('makes a 32-byte base64url token that checks until it expires 12 h later', () => {
    const sessions = new AdminSessions();
    const { token, expiresAt } = sessions.create(T0);
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(expiresAt).toBe(T0 + ADMIN_SESSION_MS);
    expect(sessions.check(token, T0 + ADMIN_SESSION_MS - 1)).toBe(expiresAt);
    expect(sessions.check(token, T0 + ADMIN_SESSION_MS)).toBeNull();
    // Gone for good once seen expired.
    expect(sessions.check(token, T0)).toBeNull();
  });

  it('refuses unknown tokens and ends a session on sign-out', () => {
    const sessions = new AdminSessions();
    const { token } = sessions.create(T0);
    expect(sessions.check('not-a-token', T0)).toBeNull();
    sessions.end(token);
    expect(sessions.check(token, T0)).toBeNull();
    sessions.end('unknown');
  });

  it('ends every session at once (a new password)', () => {
    const sessions = new AdminSessions();
    const a = sessions.create(T0).token;
    const b = sessions.create(T0).token;
    sessions.endAll();
    expect(sessions.check(a, T0)).toBeNull();
    expect(sessions.check(b, T0)).toBeNull();
    expect(sessions.size).toBe(0);
  });

  it('prunes expired sessions on the next sign-in', () => {
    const sessions = new AdminSessions(1000);
    sessions.create(T0);
    sessions.create(T0);
    sessions.create(T0 + 1000);
    expect(sessions.size).toBe(1);
  });
});

describe('adminCookie', () => {
  it(`reads ${ADMIN_COOKIE} from a Cookie header`, () => {
    expect(adminCookie(`a=1; ${ADMIN_COOKIE}=tok-en_1; b=2`)).toBe('tok-en_1');
    expect(adminCookie(`${ADMIN_COOKIE}=x`)).toBe('x');
  });

  it('is undefined without one, or for a look-alike name', () => {
    expect(adminCookie(undefined)).toBeUndefined();
    expect(adminCookie('')).toBeUndefined();
    expect(adminCookie('buzzr_admin=x; sketchy_admin_old=y')).toBeUndefined();
  });
});
