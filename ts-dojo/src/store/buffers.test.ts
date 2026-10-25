// The `/repl` scratch buffers (spec §4 "What REPL means here", §7 `buffers`): the name rules
// behind `:e <name>`, the allocation Open in REPL uses, and the Dexie queries over the §7 table
// and the `lastBuffer` meta key. Dexie runs in Node over fake-indexeddb.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  allocateBufferName,
  bufferPath,
  deleteBuffer,
  ensureBuffers,
  listBuffers,
  nameOfPath,
  normalizeBufferName,
  putBuffer,
  readLastBuffer,
  resolveBufferName,
  writeLastBuffer,
} from './buffers';
import { TsDojoDb } from './db';

let counter = 0;
const open: TsDojoDb[] = [];
const freshDb = (): TsDojoDb => {
  const db = new TsDojoDb(`ts-dojo-test-${String(++counter)}`);
  open.push(db);
  return db;
};

afterEach(async () => {
  for (const db of open.splice(0)) await db.delete();
});

describe('normalizeBufferName (:e <name>)', () => {
  it('appends .ts when the name has no .ts ending', () => {
    expect(normalizeBufferName('notes')).toBe('notes.ts');
    expect(normalizeBufferName('notes.ts')).toBe('notes.ts');
    expect(normalizeBufferName('types.d.ts')).toBe('types.d.ts');
    expect(normalizeBufferName('  notes  ')).toBe('notes.ts');
  });

  it('refuses an empty name, a path, whitespace and a leading dot or dash', () => {
    for (const bad of [
      '',
      '   ',
      'a/b',
      '../x',
      'a b',
      '.hidden',
      '-x',
      'a\\b',
    ])
      expect(normalizeBufferName(bad), bad).toBeNull();
  });
});

describe('bufferPath and nameOfPath', () => {
  it('maps a name to its virtual-FS path and back', () => {
    expect(bufferPath('notes.ts')).toBe('/notes.ts');
    expect(nameOfPath('/notes.ts')).toBe('notes.ts');
  });
});

describe('resolveBufferName', () => {
  it('finds an existing buffer by its name, with or without .ts', () => {
    const existing = ['index.ts', 'shapes.ts', 'types.d.ts'];
    expect(resolveBufferName('index', existing)).toBe('index.ts');
    expect(resolveBufferName('index.ts', existing)).toBe('index.ts');
    expect(resolveBufferName('types.d', existing)).toBe('types.d.ts');
    expect(resolveBufferName('types.d.ts', existing)).toBe('types.d.ts');
    expect(resolveBufferName('notes', existing)).toBeNull();
    expect(resolveBufferName('a/b', existing)).toBeNull();
  });
});

describe('allocateBufferName (Open in REPL)', () => {
  it('takes scratch.ts first, then scratch-2.ts and up', () => {
    expect(allocateBufferName([])).toBe('scratch.ts');
    expect(allocateBufferName(['scratch.ts'])).toBe('scratch-2.ts');
    expect(allocateBufferName(['scratch.ts', 'scratch-2.ts'])).toBe(
      'scratch-3.ts',
    );
    expect(allocateBufferName(['scratch-2.ts'])).toBe('scratch.ts');
  });

  it('uses a different base when given one', () => {
    expect(allocateBufferName(['index.ts'], 'narrowing')).toBe('narrowing.ts');
    expect(allocateBufferName(['narrowing.ts'], 'narrowing')).toBe(
      'narrowing-2.ts',
    );
  });
});

describe('the buffers table (§7)', () => {
  it('puts, lists in name order with updatedAt, and deletes', async () => {
    const db = freshDb();
    const before = Date.now();
    await putBuffer('shapes.ts', 'export {}', db);
    await putBuffer('index.ts', 'console.log(1)', db);
    const rows = await listBuffers(db);
    expect(rows.map((r) => r.name)).toEqual(['index.ts', 'shapes.ts']);
    expect(rows[0]?.text).toBe('console.log(1)');
    expect(rows[0]?.updatedAt).toBeGreaterThanOrEqual(before);
    await putBuffer('index.ts', 'console.log(2)', db);
    expect((await listBuffers(db)).map((r) => r.text)).toEqual([
      'console.log(2)',
      'export {}',
    ]);
    await deleteBuffer('index.ts', db);
    expect((await listBuffers(db)).map((r) => r.name)).toEqual(['shapes.ts']);
  });

  it('seeds the given buffers only when the table is empty', async () => {
    const db = freshDb();
    const seed = [
      { name: 'index.ts', text: 'a' },
      { name: 'shapes.ts', text: 'b' },
    ];
    const first = await ensureBuffers(seed, db);
    expect(first.map((r) => [r.name, r.text])).toEqual([
      ['index.ts', 'a'],
      ['shapes.ts', 'b'],
    ]);
    await putBuffer('index.ts', 'edited', db);
    await deleteBuffer('shapes.ts', db);
    const again = await ensureBuffers(seed, db);
    expect(again.map((r) => [r.name, r.text])).toEqual([
      ['index.ts', 'edited'],
    ]);
  });

  it('remembers the last buffer in meta.lastBuffer', async () => {
    const db = freshDb();
    expect(await readLastBuffer(db)).toBeNull();
    await writeLastBuffer('notes.ts', db);
    expect(await readLastBuffer(db)).toBe('notes.ts');
    await writeLastBuffer('index.ts', db);
    expect(await readLastBuffer(db)).toBe('index.ts');
    expect(await db.meta.get('lastBuffer')).toEqual({
      key: 'lastBuffer',
      value: 'index.ts',
    });
  });

  it('declares the five §7 tables in version 1', () => {
    const db = freshDb();
    expect(db.verno).toBe(1);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'attempts',
      'buffers',
      'exercises',
      'lessons',
      'meta',
    ]);
    expect(db.buffers.schema.primKey.keyPath).toBe('name');
    expect(db.meta.schema.primKey.keyPath).toBe('key');
    expect(db.attempts.schema.primKey.auto).toBe(true);
    expect(db.attempts.schema.indexes.map((i) => i.keyPath)).toEqual([
      'exerciseId',
    ]);
  });
});
