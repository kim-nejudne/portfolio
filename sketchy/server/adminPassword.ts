// The admin password hash in `DATA_DIR/admin.env` (F80, Admin access). The server reads the
// `ADMIN_PASSWORD_HASH=` line at start and rewrites it on setup and reset, atomically (temp file,
// fsync, rename, as `categoryStore.ts` does). Other lines in the file are kept as they are.
// Deleting the line and restarting returns `/admin` to setup mode.
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ADMIN_ENV_FILE } from '../shared/constants.js';
import { parseAdminPasswordHash, type AdminPasswordHash } from './env.js';

const KEY = 'ADMIN_PASSWORD_HASH';
const LINE = new RegExp(`^\\s*(?:export\\s+)?${KEY}\\s*=`);

/** The file system calls the file makes. Tests swap one to fail a write. */
export interface AdminFileFs {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, data: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  mkdir: (path: string) => Promise<unknown>;
  remove: (path: string) => Promise<void>;
}

const nodeFs: AdminFileFs = {
  readFile: (path) => readFile(path, 'utf8'),
  // Owner-only: the hash is not the password, but nobody else on the box needs to read it.
  // `flush` fsyncs the bytes before the rename makes them the file.
  writeFile: async (path, data) => {
    await writeFile(path, data, { encoding: 'utf8', flush: true, mode: 0o600 });
    await chmod(path, 0o600);
  },
  rename,
  mkdir: (path) => mkdir(path, { recursive: true }),
  remove: (path) => rm(path, { force: true }),
};

/** The value after `ADMIN_PASSWORD_HASH=` on its last line in `text`, quotes removed, or undefined. */
export function hashLine(text: string): string | undefined {
  let value: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    if (!LINE.test(line)) continue;
    value = line
      .slice(line.indexOf('=') + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
  }
  return value;
}

/** `text` with every `ADMIN_PASSWORD_HASH=` line replaced by one holding `hash`. */
export function withHashLine(text: string, hash: string): string {
  const kept = text.split(/\r?\n/).filter((line) => !LINE.test(line));
  while (kept.length > 0 && kept[kept.length - 1] === '') kept.pop();
  return [...kept, `${KEY}=${hash}`, ''].join('\n');
}

export interface AdminPassword {
  /** `DATA_DIR/admin.env`. */
  readonly path: string;
  /** The current hash, or null in setup mode. */
  current(): AdminPasswordHash | null;
  /**
   * Writes `hash` (a `scrypt$…` string) to the file, then makes it current. One write at a time.
   * With `onlyIfUnset`, does nothing and returns false when a hash is already set by the time
   * this write's turn comes, so two setups at once can't both win. A failed write throws and
   * leaves the file and the current hash as they were.
   */
  save(hash: string, options?: { onlyIfUnset?: boolean }): Promise<boolean>;
}

export interface OpenAdminPasswordResult {
  password: AdminPassword;
  /** A problem worth a warning at start (a hash line that doesn't parse), never quoting the hash. */
  warning: string | null;
}

function isMissing(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === 'ENOENT';
}

/**
 * Reads `DATA_DIR/admin.env`. A missing file or no hash line is setup mode. A file that can't be
 * read, or a hash line that doesn't parse, is treated as no password, with a warning: the game must not go down over the
 * admin, and setup still needs the setup code, which can reset the password anyway.
 */
export async function openAdminPassword(
  dir: string,
  fs: AdminFileFs = nodeFs,
): Promise<OpenAdminPasswordResult> {
  const path = join(dir, ADMIN_ENV_FILE);
  let text = '';
  let warning: string | null = null;
  try {
    text = await fs.readFile(path);
  } catch (err) {
    // Unreadable (a volume permission slip): warn with the error code only, and carry on in
    // setup mode rather than take the game down. A save will fail the same way, with a 500.
    if (!isMissing(err)) {
      const code = (err as { code?: unknown } | null)?.code;
      warning = `${path} can't be read (${typeof code === 'string' ? code : 'error'}). Ignoring it: /admin is in setup mode.`;
    }
  }

  let current: AdminPasswordHash | null = null;
  try {
    current = parseAdminPasswordHash(hashLine(text));
  } catch (err) {
    warning = `${path}: ${(err as Error).message}. Ignoring it: /admin is in setup mode.`;
  }

  let queue: Promise<unknown> = Promise.resolve();
  let temps = 0;

  async function write(hash: string): Promise<void> {
    const parsed = parseAdminPasswordHash(hash);
    if (parsed === null) throw new Error('An empty hash cannot be saved.');
    let existing = '';
    try {
      existing = await fs.readFile(path);
    } catch (err) {
      if (!isMissing(err)) throw err;
    }
    await fs.mkdir(dir);
    const temp = `${path}.${process.pid}-${++temps}.tmp`;
    try {
      await fs.writeFile(temp, withHashLine(existing, hash));
      await fs.rename(temp, path);
    } catch (err) {
      await fs.remove(temp).catch(() => undefined);
      throw err;
    }
    current = parsed;
  }

  const password: AdminPassword = {
    path,
    current: () => current,
    save(hash, { onlyIfUnset = false } = {}) {
      const run = queue.then(async () => {
        if (onlyIfUnset && current !== null) return false;
        await write(hash);
        return true;
      });
      queue = run.catch(() => undefined);
      return run;
    },
  };
  return { password, warning };
}
