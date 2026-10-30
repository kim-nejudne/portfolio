import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ADMIN_COOKIE, ADMIN_SESSION_MS } from '../shared/constants.js';
import { adminCookie, AdminSessions, verifyAdminPassword } from './admin.js';
import { parseAdminPasswordHash } from './env.js';
import { adminHashFor } from './test/admin.js';
import { T0 } from './test/rooms.js';

const SCRIPT = fileURLToPath(new URL('../scripts/admin-hash.mjs', import.meta.url));

/** Runs `npm run admin:hash`'s script with `input` piped in. */
function runAdminHash(input: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [SCRIPT], (error, stdout, stderr) =>
      resolve({ code: error ? (error.code as number) : 0, stdout, stderr }),
    );
    child.stdin!.end(input);
  });
}

describe('verifyAdminPassword', () => {
  const stored = parseAdminPasswordHash(adminHashFor('correct horse'))!;

  it('accepts the password the hash was made from', async () => {
    await expect(verifyAdminPassword('correct horse', stored)).resolves.toBe(true);
  });

  it('refuses any other password, including a case or space change', async () => {
    for (const wrong of ['Correct horse', 'correct horse ', 'correct', '']) {
      await expect(verifyAdminPassword(wrong, stored)).resolves.toBe(false);
    }
  });

  it('treats composed and decomposed accents as the same password', async () => {
    const accented = parseAdminPasswordHash(adminHashFor('café'))!;
    await expect(verifyAdminPassword('café', accented)).resolves.toBe(true);
  });
});

describe('scripts/admin-hash.mjs', () => {
  it('prints only a hash the server parses and that verifies the piped password', async () => {
    const { code, stdout } = await runAdminHash('s3cret pass\nignored second line\n');
    expect(code).toBe(0);
    expect(stdout).toMatch(/^scrypt\$32768\$8\$1\$[\w-]+\$[\w-]+\n$/);
    const stored = parseAdminPasswordHash(stdout)!;
    expect(stored.salt).toHaveLength(16);
    expect(stored.hash).toHaveLength(32);
    await expect(verifyAdminPassword('s3cret pass', stored)).resolves.toBe(true);
    await expect(verifyAdminPassword('ignored second line', stored)).resolves.toBe(false);
  });

  it('draws a new salt each time', async () => {
    const [a, b] = await Promise.all([runAdminHash('same\n'), runAdminHash('same\n')]);
    expect(a.stdout).not.toBe(b.stdout);
  });

  it('refuses an empty password, printing no hash', async () => {
    const { code, stdout, stderr } = await runAdminHash('\n');
    expect(code).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('The password is empty.');
  });
});

describe('AdminSessions', () => {
  it('knows a new session until it expires 12 h later', () => {
    const sessions = new AdminSessions();
    const { token, expiresAt } = sessions.create(T0);
    expect(expiresAt).toBe(T0 + ADMIN_SESSION_MS);
    expect(sessions.check(token, T0 + ADMIN_SESSION_MS - 1)).toBe(expiresAt);
    expect(sessions.check(token, T0 + ADMIN_SESSION_MS)).toBeNull();
    // Once expired, it stays gone.
    expect(sessions.check(token, T0)).toBeNull();
  });

  it('hands out 32 random bytes as base64url, different each time', () => {
    const sessions = new AdminSessions();
    const a = sessions.create(T0).token;
    const b = sessions.create(T0).token;
    expect(a).toMatch(/^[\w-]{43}$/);
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
    expect(a).not.toBe(b);
  });

  it('holds only SHA-256 hashes of the tokens', () => {
    const sessions = new AdminSessions();
    const { token } = sessions.create(T0);
    const held = JSON.stringify([
      ...(sessions as unknown as { sessions: Map<string, number> }).sessions,
    ]);
    expect(held).not.toContain(token);
    expect(held).toMatch(/"[0-9a-f]{64}"/);
  });

  it('refuses an unknown token and ends a session on sign-out', () => {
    const sessions = new AdminSessions();
    const { token } = sessions.create(T0);
    expect(sessions.check('not-a-token', T0)).toBeNull();
    sessions.end(token);
    expect(sessions.check(token, T0)).toBeNull();
  });

  it('a new instance (a restart) knows none of the old sessions', () => {
    const { token } = new AdminSessions().create(T0);
    expect(new AdminSessions().check(token, T0)).toBeNull();
  });
});

describe('adminCookie', () => {
  it(`reads ${ADMIN_COOKIE} among other cookies`, () => {
    expect(adminCookie(`a=1; ${ADMIN_COOKIE}=tok-en_1; b=2`)).toBe('tok-en_1');
    expect(adminCookie(`${ADMIN_COOKIE}=x`)).toBe('x');
  });

  it('is undefined without the cookie, or for a cookie that only ends in the name', () => {
    expect(adminCookie(undefined)).toBeUndefined();
    expect(adminCookie('a=1')).toBeUndefined();
    expect(adminCookie(`x${ADMIN_COOKIE}=1`)).toBeUndefined();
  });
});
