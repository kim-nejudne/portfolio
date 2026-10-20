// §7 Import: "Import on `/progress` reads a file, shows what it would change (lessons,
// exercises, attempts, buffers, settings) and applies on confirmation. Rows merge by id and the
// newer `updatedAt` wins; attempts append; a passed exercise never becomes unpassed." Plus the
// renames applied to an older file's ids, a mismatched `contentVersion` noted, a file the app
// cannot read refused with nothing changed, and attempts pruned to the newest 20 per exercise
// (§7 "pruned on write"). Dexie over fake-indexeddb.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, TsDojoDb, type ExerciseRow } from './db';
import type { ExportFile, ExportedAttempt } from './export';
import { applyImport, parseImportFile, planImport } from './import';
import { ATTEMPTS_KEPT } from './progress';
import type { Settings } from './settings';

let count = 0;
const opened: TsDojoDb[] = [];
function fresh(): TsDojoDb {
  count += 1;
  const db = new TsDojoDb(`import-${String(count)}`);
  opened.push(db);
  return db;
}

afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await db.delete();
  }
});

function exercise(id: string, patch: Partial<ExerciseRow> = {}): ExerciseRow {
  return {
    id,
    lessonId: id.split('/').slice(0, 2).join('/'),
    state: 'in-progress',
    hintsUsed: 0,
    solutionViewed: false,
    files: {},
    updatedAt: 10,
    ...patch,
  };
}

function attempt(exerciseId: string, at: number): ExportedAttempt {
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
    ms: 3,
    files: {},
  };
}

function file(patch: Partial<ExportFile> = {}): ExportFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: 'app-hash',
    exportedAt: '2026-10-20T10:00:00.000Z',
    lessons: [],
    exercises: [],
    attempts: [],
    buffers: [],
    settings: {},
    ...patch,
  };
}

const OPTIONS = { renames: [], contentVersion: 'app-hash', settings: {} };

describe('parseImportFile', () => {
  it('reads an export file', () => {
    const parsed = parseImportFile(
      JSON.stringify(file({ exercises: [exercise('m/a/01')] })),
    );
    expect(parsed.ok && parsed.file.exercises[0]?.id).toBe('m/a/01');
  });

  it('refuses text that is not JSON, a file of another shape, and a newer schema', () => {
    expect(parseImportFile('{nope')).toEqual({
      ok: false,
      error: 'not a JSON file',
    });
    const other = parseImportFile(JSON.stringify({ hello: 'world' }));
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.error).toMatch(/^not a ts-dojo progress file/);
    const newer = parseImportFile(
      JSON.stringify(file({ schemaVersion: SCHEMA_VERSION + 1 })),
    );
    expect(newer).toEqual({
      ok: false,
      error: `made by a newer ts-dojo (schema ${String(SCHEMA_VERSION + 1)}); this one reads schema ${String(SCHEMA_VERSION)}`,
    });
  });
});

describe('planImport', () => {
  it('previews what each category would gain, without writing anything', async () => {
    const db = fresh();
    await db.lessons.put({ id: 'm/a', state: 'in-progress', lastOpenedAt: 5 });
    await db.exercises.bulkPut([
      exercise('m/a/01', { updatedAt: 10, files: { '/index.ts': 'mine' } }),
      exercise('m/a/02', { updatedAt: 30, files: { '/index.ts': 'newer' } }),
    ]);
    await db.attempts.add({ ...attempt('m/a/01', 1) });
    await db.buffers.put({ name: 'notes.ts', text: 'mine', updatedAt: 5 });
    const before = {
      lessons: await db.lessons.toArray(),
      exercises: await db.exercises.toArray(),
      attempts: await db.attempts.toArray(),
      buffers: await db.buffers.toArray(),
    };

    const plan = await planImport(
      db,
      file({
        contentVersion: 'older-hash',
        lessons: [
          { id: 'm/a', state: 'complete', theoryReadAt: 20, completedAt: 21 },
          { id: 'm/b', state: 'in-progress', lastOpenedAt: 3 },
        ],
        exercises: [
          // Newer: wins, and passes.
          exercise('m/a/01', {
            updatedAt: 20,
            state: 'passed',
            passedAt: 20,
            files: { '/index.ts': 'theirs' },
          }),
          // Older: the current row stays as it is.
          exercise('m/a/02', { updatedAt: 15 }),
          exercise('m/b/01'),
        ],
        attempts: [attempt('m/a/01', 1), attempt('m/a/01', 2)],
        buffers: [
          { name: 'notes.ts', text: 'theirs', updatedAt: 9 },
          { name: 'scratch.ts', text: 's', updatedAt: 1 },
        ],
        settings: { theme: 'dark', relativeNumbers: false, vimrc: 3 } as never,
      }),
      { ...OPTIONS, settings: { theme: 'light', relativeNumbers: false } },
    );
    expect(plan.lessons).toEqual({
      added: ['m/b'],
      updated: ['m/a'],
      unchanged: 0,
    });
    expect(plan.exercises).toEqual({
      added: ['m/b/01'],
      updated: ['m/a/01'],
      unchanged: 1,
      newlyPassed: ['m/a/01'],
    });
    expect(plan.attempts).toEqual({ appended: 1, skipped: 1 });
    expect(plan.buffers).toEqual({
      added: ['scratch.ts'],
      updated: ['notes.ts'],
      unchanged: 0,
    });
    expect(plan.settings).toEqual({ changed: ['theme'] });
    expect(plan.contentVersion).toEqual({
      file: 'older-hash',
      app: 'app-hash',
      matches: false,
    });
    expect({
      lessons: await db.lessons.toArray(),
      exercises: await db.exercises.toArray(),
      attempts: await db.attempts.toArray(),
      buffers: await db.buffers.toArray(),
    }).toEqual(before);
  });

  it('applies the renames to an older file before comparing', async () => {
    const db = fresh();
    await db.lessons.put({ id: 'm/new', state: 'not-started' });
    const plan = await planImport(
      db,
      file({
        lessons: [
          {
            id: 'm/old',
            state: 'in-progress',
            lastOpenedAt: 4,
            lastExerciseId: 'm/old/01',
          },
        ],
        exercises: [exercise('m/old/01')],
        attempts: [attempt('m/old/01', 1)],
      }),
      { ...OPTIONS, renames: [{ from: 'm/old', to: 'm/new' }] },
    );
    expect(plan.lessons.updated).toEqual(['m/new']);
    expect(plan.exercises.added).toEqual(['m/new/01']);
    await applyImport(db, plan.file, {
      ...OPTIONS,
      renames: [{ from: 'm/old', to: 'm/new' }],
    });
    expect(await db.lessons.get('m/new')).toMatchObject({
      state: 'in-progress',
      lastExerciseId: 'm/new/01',
    });
    expect(await db.exercises.get('m/new/01')).toMatchObject({
      lessonId: 'm/new',
    });
    expect((await db.attempts.toArray()).map((a) => a.exerciseId)).toEqual([
      'm/new/01',
    ]);
    expect(await db.lessons.get('m/old')).toBeUndefined();
  });
});

describe('applyImport', () => {
  it('merges by the §7 rules, appends attempts once, writes the settings and importedAt', async () => {
    const db = fresh();
    await db.exercises.bulkPut([
      exercise('m/a/01', {
        state: 'passed',
        passedAt: 5,
        attemptsToPass: 2,
        updatedAt: 10,
      }),
      exercise('m/a/02', { updatedAt: 30, files: { '/index.ts': 'newer' } }),
    ]);
    await db.attempts.add({ ...attempt('m/a/01', 1) });
    const written: Settings[] = [];
    const incoming = file({
      exercises: [
        // Newer but unpassed: the files come in, the pass stays.
        exercise('m/a/01', { updatedAt: 40, files: { '/index.ts': 'later' } }),
        exercise('m/a/02', { updatedAt: 15, files: { '/index.ts': 'older' } }),
      ],
      attempts: [attempt('m/a/01', 1), attempt('m/a/01', 2)],
      settings: { theme: 'dark' },
    });
    const options = {
      ...OPTIONS,
      writeSettings: (settings: Settings) => void written.push(settings),
      now: 1234,
    };
    await applyImport(db, incoming, options);
    expect(await db.exercises.get('m/a/01')).toMatchObject({
      state: 'passed',
      passedAt: 5,
      attemptsToPass: 2,
      files: { '/index.ts': 'later' },
      updatedAt: 40,
    });
    expect((await db.exercises.get('m/a/02'))?.files).toEqual({
      '/index.ts': 'newer',
    });
    expect((await db.attempts.toArray()).map((a) => a.at)).toEqual([1, 2]);
    expect(written).toEqual([{ theme: 'dark' }]);
    expect((await db.meta.get('importedAt'))?.value).toBe(1234);

    // The same file again adds nothing.
    await applyImport(db, incoming, options);
    expect(await db.attempts.count()).toBe(2);
  });

  it('prunes an exercise to its newest attempts after appending', async () => {
    const db = fresh();
    await db.attempts.bulkAdd(
      Array.from({ length: ATTEMPTS_KEPT }, (_, i) => ({
        ...attempt('m/a/01', 100 + i),
      })),
    );
    await applyImport(
      db,
      file({ attempts: [1, 2, 3].map((at) => attempt('m/a/01', at)) }),
      OPTIONS,
    );
    const ats = (await db.attempts.toArray())
      .map((a) => a.at)
      .sort((a, b) => a - b);
    expect(ats).toHaveLength(ATTEMPTS_KEPT);
    // The imported attempts are older than every kept one, so none of them survives.
    expect(ats[0]).toBe(100);
  });

  it('does not write the settings when the file changes none', async () => {
    const db = fresh();
    const written: Settings[] = [];
    await applyImport(db, file({ settings: { theme: 'dark' } }), {
      ...OPTIONS,
      settings: { theme: 'dark' },
      writeSettings: (settings) => void written.push(settings),
    });
    expect(written).toEqual([]);
  });
});
