// §7 "Reset scopes: one exercise (files only, by `:reset`), one lesson, one module, everything."
// `:reset` is F8's `clearExerciseFiles`; these are the other three. A lesson reset removes its
// row, its exercises' rows, their attempts and journal entries, and the Continue pointer if it
// was this lesson; a module reset does that for each lesson; everything clears the progress
// tables and the REPL buffers and keeps the version keys and the settings (F9 plan, decision
// F). Dexie over fake-indexeddb; the unsaved journal over a Map.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { TsDojoDb, type AttemptRow, type ExerciseRow } from './db';
import { LAST_LESSON_KEY } from './progress';
import { resetEverything, resetLesson, resetModule } from './reset';
import { UNSAVED_KEY, type UnsavedStorage } from './unsaved';

let count = 0;
const opened: TsDojoDb[] = [];
function fresh(): TsDojoDb {
  count += 1;
  const db = new TsDojoDb(`reset-${String(count)}`);
  opened.push(db);
  return db;
}

afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await db.delete();
  }
});

function memoryStorage(): UnsavedStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

function exercise(id: string): ExerciseRow {
  return {
    id,
    lessonId: id.split('/').slice(0, 2).join('/'),
    state: 'passed',
    hintsUsed: 1,
    solutionViewed: true,
    files: { '/index.ts': 'x' },
    updatedAt: 1,
  };
}

function attempt(exerciseId: string): AttemptRow {
  return {
    exerciseId,
    at: 1,
    passed: true,
    groups: {
      compiles: { passed: true, count: 0 },
      types: { passed: true, count: 0 },
      tests: { passed: true, count: 0 },
      rules: { passed: true, count: 0 },
    },
    ms: 1,
    files: {},
  };
}

async function seed(db: TsDojoDb, journal: UnsavedStorage): Promise<void> {
  await db.lessons.bulkPut([
    { id: 'm1/a', state: 'complete' },
    { id: 'm1/ab', state: 'in-progress' },
    { id: 'm1/b', state: 'in-progress' },
    { id: 'm2/c', state: 'in-progress' },
  ]);
  await db.exercises.bulkPut(
    ['m1/a/01', 'm1/a/02', 'm1/ab/01', 'm1/b/01', 'm2/c/01'].map(exercise),
  );
  await db.attempts.bulkAdd(
    ['m1/a/01', 'm1/a/02', 'm1/ab/01', 'm1/b/01', 'm2/c/01'].map(attempt),
  );
  await db.buffers.put({ name: 'notes.ts', text: 'n', updatedAt: 1 });
  await db.meta.bulkPut([
    { key: LAST_LESSON_KEY, value: 'm1/a' },
    { key: 'lastBuffer', value: 'notes.ts' },
    { key: 'schemaVersion', value: 1 },
    { key: 'contentVersion', value: 'hash' },
  ]);
  journal.setItem(
    UNSAVED_KEY,
    JSON.stringify({
      'm1/a/01': { '/index.ts': 'typed' },
      'm2/c/01': { '/index.ts': 'kept' },
    }),
  );
}

const ids = async (db: TsDojoDb) => ({
  lessons: (await db.lessons.toArray()).map((row) => row.id),
  exercises: (await db.exercises.toArray()).map((row) => row.id),
  attempts: (await db.attempts.toArray()).map((row) => row.exerciseId),
});

describe('resetLesson', () => {
  it('removes the lesson, its exercises, their attempts, its journal and the Continue pointer, nothing else', async () => {
    const db = fresh();
    const journal = memoryStorage();
    await seed(db, journal);
    await resetLesson(db, 'm1/a', journal);
    expect(await ids(db)).toEqual({
      lessons: ['m1/ab', 'm1/b', 'm2/c'],
      exercises: ['m1/ab/01', 'm1/b/01', 'm2/c/01'],
      attempts: ['m1/ab/01', 'm1/b/01', 'm2/c/01'],
    });
    expect(await db.meta.get(LAST_LESSON_KEY)).toBeUndefined();
    expect(JSON.parse(journal.map.get(UNSAVED_KEY) ?? '{}')).toEqual({
      'm2/c/01': { '/index.ts': 'kept' },
    });
  });

  it('keeps the Continue pointer when it names another lesson', async () => {
    const db = fresh();
    const journal = memoryStorage();
    await seed(db, journal);
    await resetLesson(db, 'm2/c', journal);
    expect((await db.meta.get(LAST_LESSON_KEY))?.value).toBe('m1/a');
  });
});

describe('resetModule', () => {
  it("resets each of the module's lessons", async () => {
    const db = fresh();
    const journal = memoryStorage();
    await seed(db, journal);
    await resetModule(db, ['m1/a', 'm1/ab', 'm1/b'], journal);
    expect(await ids(db)).toEqual({
      lessons: ['m2/c'],
      exercises: ['m2/c/01'],
      attempts: ['m2/c/01'],
    });
  });
});

describe('resetEverything', () => {
  it('clears progress, attempts, buffers and the journal, and keeps the version keys', async () => {
    const db = fresh();
    const journal = memoryStorage();
    await seed(db, journal);
    await resetEverything(db, journal);
    expect(await ids(db)).toEqual({ lessons: [], exercises: [], attempts: [] });
    expect(await db.buffers.count()).toBe(0);
    expect((await db.meta.toArray()).map((row) => row.key).sort()).toEqual([
      'contentVersion',
      'schemaVersion',
    ]);
    expect(journal.map.has(UNSAVED_KEY)).toBe(false);
  });
});
