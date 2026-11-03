// DATA_DIR/admin.env (F80): the round trip, setup mode, a removed line, kept lines, atomic writes.
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyAdminPassword } from './admin.js';
import { hashLine, openAdminPassword, withHashLine, type AdminFileFs } from './adminPassword.js';
import { testHash } from './test/admin.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sketchy-admin-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const file = () => join(dir, 'admin.env');

describe('hashLine and withHashLine', () => {
  it('reads the last ADMIN_PASSWORD_HASH line, with or without quotes or export', () => {
    expect(hashLine('')).toBeUndefined();
    expect(hashLine('# nothing\nOTHER=1\n')).toBeUndefined();
    expect(hashLine('ADMIN_PASSWORD_HASH=scrypt$a\n')).toBe('scrypt$a');
    expect(hashLine('ADMIN_PASSWORD_HASH="scrypt$b"')).toBe('scrypt$b');
    expect(hashLine("export ADMIN_PASSWORD_HASH='scrypt$c'\r\n")).toBe('scrypt$c');
    expect(hashLine('ADMIN_PASSWORD_HASH=one\nADMIN_PASSWORD_HASH=two\n')).toBe('two');
    expect(hashLine('# ADMIN_PASSWORD_HASH=commented\n')).toBeUndefined();
  });

  it('replaces the line and keeps every other one', () => {
    expect(withHashLine('', 'scrypt$x')).toBe('ADMIN_PASSWORD_HASH=scrypt$x\n');
    expect(withHashLine('# note\nADMIN_PASSWORD_HASH=old\nOTHER=1\n\n', 'scrypt$x')).toBe(
      '# note\nOTHER=1\nADMIN_PASSWORD_HASH=scrypt$x\n',
    );
  });
});

describe('openAdminPassword', () => {
  it('is in setup mode with no file, writes the hash, and a restart reads it back', async () => {
    const opened = await openAdminPassword(dir);
    expect(opened.warning).toBeNull();
    expect(opened.password.current()).toBeNull();

    const hash = await testHash('a long enough password');
    await expect(opened.password.save(hash)).resolves.toBe(true);
    expect(await readFile(file(), 'utf8')).toBe(`ADMIN_PASSWORD_HASH=${hash}\n`);
    expect((await stat(file())).mode & 0o777).toBe(0o600);
    expect(opened.password.current()).not.toBeNull();

    // A restart.
    const again = await openAdminPassword(dir);
    expect(again.warning).toBeNull();
    await expect(
      verifyAdminPassword('a long enough password', again.password.current()!),
    ).resolves.toBe(true);
  });

  it('creates DATA_DIR when it is missing', async () => {
    const nested = join(dir, 'new', 'data');
    const opened = await openAdminPassword(nested);
    await opened.password.save(await testHash('a long enough password'));
    expect(await readFile(join(nested, 'admin.env'), 'utf8')).toMatch(
      /^ADMIN_PASSWORD_HASH=scrypt/,
    );
  });

  it('is back in setup mode after the line is deleted and the server restarts', async () => {
    const opened = await openAdminPassword(dir);
    await opened.password.save(await testHash('a long enough password'));
    const text = await readFile(file(), 'utf8');
    await writeFile(file(), text.replace(/^ADMIN_PASSWORD_HASH=.*\n/m, '# reset by hand\n'));
    const again = await openAdminPassword(dir);
    expect(again.password.current()).toBeNull();
    expect(again.warning).toBeNull();
  });

  it('keeps other lines in admin.env when it saves', async () => {
    await writeFile(file(), '# Sketchy admin\nADMIN_PASSWORD_HASH=\n');
    const opened = await openAdminPassword(dir);
    expect(opened.password.current()).toBeNull();
    const hash = await testHash('a long enough password');
    await opened.password.save(hash);
    expect(await readFile(file(), 'utf8')).toBe(`# Sketchy admin\nADMIN_PASSWORD_HASH=${hash}\n`);
  });

  it('ignores a hash line that does not parse, with a warning that never quotes it', async () => {
    await writeFile(file(), 'ADMIN_PASSWORD_HASH=scrypt$1000$8$1$secretsalt$secrethash\n');
    const opened = await openAdminPassword(dir);
    expect(opened.password.current()).toBeNull();
    expect(opened.warning).toMatch(/admin\.env: ADMIN_PASSWORD_HASH must be .*setup mode/);
    expect(opened.warning).not.toContain('secret');
  });

  it('carries on in setup mode when admin.env cannot be read, warning with the error code only', async () => {
    await writeFile(file(), `ADMIN_PASSWORD_HASH=${await testHash('a long enough password')}\n`);
    const unreadable: AdminFileFs = {
      readFile: () =>
        Promise.reject(Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })),
      writeFile: (path, data) => writeFile(path, data),
      rename: () => Promise.resolve(),
      mkdir: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    };
    const opened = await openAdminPassword(dir, unreadable);
    expect(opened.password.current()).toBeNull();
    expect(opened.warning).toMatch(/admin\.env can't be read \(EACCES\)\. Ignoring it/);
    expect(opened.warning).not.toContain('scrypt');
  });

  it('lets only the first of two setups at once win (onlyIfUnset)', async () => {
    const opened = await openAdminPassword(dir);
    const [a, b] = await Promise.all([
      opened.password.save(await testHash('first password here'), { onlyIfUnset: true }),
      opened.password.save(await testHash('second password here'), { onlyIfUnset: true }),
    ]);
    expect([a, b]).toEqual([true, false]);
    await expect(
      verifyAdminPassword('first password here', opened.password.current()!),
    ).resolves.toBe(true);
    // A reset (no onlyIfUnset) always writes.
    await expect(opened.password.save(await testHash('third password here'))).resolves.toBe(true);
  });

  it('leaves the file and the current hash alone when a write fails, with no temp file', async () => {
    const opened0 = await openAdminPassword(dir);
    const first = await testHash('the first password');
    await opened0.password.save(first);

    const failing: AdminFileFs = {
      readFile: (path) => readFile(path, 'utf8'),
      writeFile: (path, data) => writeFile(path, data),
      rename: () => Promise.reject(new Error('disk full')),
      mkdir: () => Promise.resolve(),
      remove: (path) => rm(path, { force: true }),
    };
    const opened = await openAdminPassword(dir, failing);
    const before = opened.password.current();
    await expect(opened.password.save(await testHash('the second password'))).rejects.toThrow(
      'disk full',
    );
    expect(opened.password.current()).toBe(before);
    expect(await readFile(file(), 'utf8')).toBe(`ADMIN_PASSWORD_HASH=${first}\n`);
    expect(await readdir(dir)).toEqual(['admin.env']);
    // The queue carries on after a failure.
    await expect(opened.password.save(await testHash('the third password'))).rejects.toThrow();
  });

  it('refuses to save something that is not a hash', async () => {
    const opened = await openAdminPassword(dir);
    await expect(opened.password.save('hunter2')).rejects.toThrow(/ADMIN_PASSWORD_HASH must be/);
    await expect(opened.password.save('')).rejects.toThrow();
    expect(await readdir(dir)).toEqual([]);
  });
});
