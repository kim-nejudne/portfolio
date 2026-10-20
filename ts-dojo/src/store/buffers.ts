// The `/repl` scratch buffers (spec §4 "What REPL means here", §7 `buffers`). The pure part:
// what `:e <name>` accepts (a file name, `.ts` appended when missing), how a name becomes the
// virtual-FS path the editor and ts-ls use, and the name Open in REPL allocates. The stored
// part: the §7 table (`name`, `text`, `updatedAt`) and the `lastBuffer` meta key `/repl` opens
// first (logged under "Spec questions": §7's meta list does not name it).
import { getDb, type BufferRow, type TsDojoDb } from './db';

export const DEFAULT_BUFFER_BASE = 'scratch';
export const LAST_BUFFER_KEY = 'lastBuffer';

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** `notes` → `notes.ts`; a path, whitespace, a leading `.` or `-`, or nothing → null. */
export function normalizeBufferName(input: string): string | null {
  const trimmed = input.trim();
  if (!NAME.test(trimmed)) return null;
  return trimmed.endsWith('.ts') ? trimmed : `${trimmed}.ts`;
}

export function bufferPath(name: string): string {
  return `/${name}`;
}

export function nameOfPath(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path;
}

/** The existing buffer `:e name` means, or null when it would create one (or is invalid). */
export function resolveBufferName(
  input: string,
  existing: readonly string[],
): string | null {
  const name = normalizeBufferName(input);
  if (name === null) return null;
  return existing.includes(name) ? name : null;
}

/** `scratch.ts`, then `scratch-2.ts`, `scratch-3.ts`, … skipping names in use. */
export function allocateBufferName(
  existing: Iterable<string>,
  base: string = DEFAULT_BUFFER_BASE,
): string {
  const taken = new Set(existing);
  const first = `${base}.ts`;
  if (!taken.has(first)) return first;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${String(n)}.ts`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Every buffer in name order (the tab order). */
export async function listBuffers(
  db: TsDojoDb = getDb(),
): Promise<BufferRow[]> {
  return db.buffers.orderBy('name').toArray();
}

export async function putBuffer(
  name: string,
  text: string,
  db: TsDojoDb = getDb(),
): Promise<void> {
  await db.buffers.put({ name, text, updatedAt: Date.now() });
}

export async function deleteBuffer(
  name: string,
  db: TsDojoDb = getDb(),
): Promise<void> {
  await db.buffers.delete(name);
}

/** Seeds `seed` when the table is empty (the first visit), then returns the list. */
export async function ensureBuffers(
  seed: readonly { name: string; text: string }[],
  db: TsDojoDb = getDb(),
): Promise<BufferRow[]> {
  return db.transaction('rw', db.buffers, async () => {
    if ((await db.buffers.count()) === 0) {
      const updatedAt = Date.now();
      await db.buffers.bulkPut(seed.map((row) => ({ ...row, updatedAt })));
    }
    return db.buffers.orderBy('name').toArray();
  });
}

export async function readLastBuffer(
  db: TsDojoDb = getDb(),
): Promise<string | null> {
  const row = await db.meta.get(LAST_BUFFER_KEY);
  return typeof row?.value === 'string' ? row.value : null;
}

export async function writeLastBuffer(
  name: string,
  db: TsDojoDb = getDb(),
): Promise<void> {
  await db.meta.put({ key: LAST_BUFFER_KEY, value: name });
}
