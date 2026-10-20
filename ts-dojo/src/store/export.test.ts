// §7 Export: "`:export` or the button on `/progress` downloads `ts-dojo-progress-<date>.json`:
// `schemaVersion`, `contentVersion`, `exportedAt`, every row of `lessons`, `exercises` and
// `buffers`, the newest 5 attempts per exercise, and `settings`." Dexie over fake-indexeddb.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, TsDojoDb, type AttemptRow } from './db';
import {
  buildExport,
  EXPORT_ATTEMPTS_KEPT,
  exportFileName,
  exportJson,
} from './export';

let count = 0;
const opened: TsDojoDb[] = [];
function fresh(): TsDojoDb {
  count += 1;
  const db = new TsDojoDb(`export-${String(count)}`);
  opened.push(db);
  return db;
}

afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await db.delete();
  }
});

function attempt(exerciseId: string, at: number): AttemptRow {
  return {
    exerciseId,
    kind: 'test',
    at,
    passed: false,
    groups: {
      compiles: { passed: true, count: 0 },
      types: { passed: true, count: 0 },
      tests: { passed: false, count: 1 },
      rules: { passed: true, count: 0 },
    },
    ms: 5,
    files: { '/index.ts': `at ${String(at)}` },
  };
}

describe('buildExport', () => {
  it('holds the §7 fields, every lessons/exercises/buffers row and the settings', async () => {
    const db = fresh();
    await db.lessons.bulkPut([
      { id: 'm/a', state: 'complete', theoryReadAt: 1, completedAt: 2 },
      { id: 'm/gone', state: 'in-progress' },
    ]);
    await db.exercises.put({
      id: 'm/a/01',
      lessonId: 'm/a',
      state: 'passed',
      passedAt: 2,
      attemptsToPass: 1,
      hintsUsed: 1,
      solutionViewed: false,
      files: { '/index.ts': 'x' },
      updatedAt: 2,
    });
    await db.buffers.put({ name: 'notes.ts', text: 'n', updatedAt: 3 });
    const file = await buildExport(
      db,
      { theme: 'dark', relativeNumbers: true },
      'hash',
      new Date('2026-10-21T08:30:00Z'),
    );
    expect(Object.keys(file)).toEqual([
      'schemaVersion',
      'contentVersion',
      'exportedAt',
      'lessons',
      'exercises',
      'attempts',
      'buffers',
      'settings',
    ]);
    expect(file.schemaVersion).toBe(SCHEMA_VERSION);
    expect(file.contentVersion).toBe('hash');
    expect(file.exportedAt).toBe('2026-10-21T08:30:00.000Z');
    expect(file.lessons.map((row) => row.id)).toEqual(['m/a', 'm/gone']);
    expect(file.exercises).toEqual([await db.exercises.get('m/a/01')]);
    expect(file.buffers).toEqual([
      { name: 'notes.ts', text: 'n', updatedAt: 3 },
    ]);
    expect(file.settings).toEqual({ theme: 'dark', relativeNumbers: true });
    expect(JSON.parse(exportJson(file))).toEqual(file);
  });

  it('keeps the newest 5 attempts per exercise, oldest first, without the local key', async () => {
    const db = fresh();
    await db.attempts.bulkAdd([
      ...[1, 2, 3, 4, 5, 6, 7].map((at) => attempt('m/a/01', at)),
      attempt('m/a/02', 10),
      attempt('m/a/02', 11),
    ]);
    const file = await buildExport(db, {}, 'hash');
    expect(EXPORT_ATTEMPTS_KEPT).toBe(5);
    expect(file.attempts.map((row) => [row.exerciseId, row.at])).toEqual([
      ['m/a/01', 3],
      ['m/a/01', 4],
      ['m/a/01', 5],
      ['m/a/01', 6],
      ['m/a/01', 7],
      ['m/a/02', 10],
      ['m/a/02', 11],
    ]);
    expect(file.attempts.every((row) => !('id' in row))).toBe(true);
    expect(file.attempts[4]?.files).toEqual({ '/index.ts': 'at 7' });
  });
});

describe('exportFileName', () => {
  it('is ts-dojo-progress-<local date>.json', () => {
    expect(exportFileName(new Date(2026, 9, 21, 23, 59))).toBe(
      'ts-dojo-progress-2026-10-21.json',
    );
    expect(exportFileName(new Date(2027, 0, 5))).toBe(
      'ts-dojo-progress-2027-01-05.json',
    );
  });
});
