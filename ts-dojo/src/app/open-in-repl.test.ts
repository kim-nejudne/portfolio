// Open in REPL (spec §1 Examples, §12 F5): the buffer a theory block's snippet lands in, named
// after the lesson when a usable name is given, otherwise `scratch`, never colliding, and made
// the last buffer so `/repl` opens it.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { listBuffers, readLastBuffer } from '@/store/buffers';
import { TsDojoDb } from '@/store/db';
import { baseName, createReplBuffer, openInRepl } from './open-in-repl';

let counter = 0;
const open: TsDojoDb[] = [];
const freshDb = (): TsDojoDb => {
  const db = new TsDojoDb(`ts-dojo-open-in-repl-${String(++counter)}`);
  open.push(db);
  return db;
};

afterEach(async () => {
  for (const db of open.splice(0)) await db.delete();
});

describe('baseName', () => {
  it('keeps a usable name without its .ts and falls back to scratch', () => {
    expect(baseName(undefined)).toBe('scratch');
    expect(baseName('')).toBe('scratch');
    expect(baseName('03-narrowing')).toBe('03-narrowing');
    expect(baseName('03-narrowing.ts')).toBe('03-narrowing');
    expect(baseName('m03-unions/03-narrowing')).toBe('scratch');
    expect(baseName('.hidden')).toBe('scratch');
  });
});

describe('createReplBuffer', () => {
  it('stores the snippet under scratch.ts, then scratch-2.ts, and records the last buffer', async () => {
    const db = freshDb();
    expect(await createReplBuffer({ snippet: 'const a = 1;' }, db)).toBe(
      'scratch.ts',
    );
    expect(await createReplBuffer({ snippet: 'const b = 2;' }, db)).toBe(
      'scratch-2.ts',
    );
    expect((await listBuffers(db)).map((row) => [row.name, row.text])).toEqual([
      ['scratch-2.ts', 'const b = 2;'],
      ['scratch.ts', 'const a = 1;'],
    ]);
    expect(await readLastBuffer(db)).toBe('scratch-2.ts');
  });

  it('names the buffer after the lesson when given one', async () => {
    const db = freshDb();
    expect(
      await createReplBuffer({ snippet: 'x', name: '03-narrowing' }, db),
    ).toBe('03-narrowing.ts');
    expect(
      await createReplBuffer({ snippet: 'y', name: '03-narrowing' }, db),
    ).toBe('03-narrowing-2.ts');
  });
});

describe('openInRepl', () => {
  it('creates the buffer, then navigates to /repl', async () => {
    const visited: string[] = [];
    const name = await openInRepl((to) => visited.push(to), {
      snippet: 'console.log(1);',
    });
    expect(name).toMatch(/^scratch(-\d+)?\.ts$/);
    expect(visited).toEqual(['/repl']);
  });
});
