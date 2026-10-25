// §7 Content versions, applied when the store opens: "A rename goes into content/renames.yaml
// (`old: new`) and the store applies it when it opens"; "A removed lesson keeps its rows";
// `contentVersion` recorded. A lesson rename moves the lesson row and everything under it, an
// exercise rename one exercise; a rename onto an id that already has rows merges them by the
// §7 rules. Dexie over fake-indexeddb, one database per test; the unsaved journal over a Map.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyContentUpdate,
  installContentUpdate,
  renameId,
} from './content-update';
import { SCHEMA_VERSION, TsDojoDb, type ExerciseRow } from './db';
import { LAST_LESSON_KEY } from './progress';
import { peekUnsaved, UNSAVED_KEY, type UnsavedStorage } from './unsaved';

const OLD_LESSON = 'm99-fixtures/00-first-fix';
const NEW_LESSON = 'm99-fixtures/01-fix';
const LESSON_RENAME = { from: OLD_LESSON, to: NEW_LESSON };
const OLD_EXERCISE = 'm99-fixtures/02-implement/00-biggest-shape';
const NEW_EXERCISE = 'm99-fixtures/02-implement/01-largest-shape';
const EXERCISE_RENAME = { from: OLD_EXERCISE, to: NEW_EXERCISE };

let count = 0;
const opened: TsDojoDb[] = [];
function freshName(): string {
  count += 1;
  return `content-update-${String(count)}`;
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

function exercise(id: string, patch: Partial<ExerciseRow> = {}): ExerciseRow {
  return {
    id,
    lessonId: id.split('/').slice(0, 2).join('/'),
    state: 'in-progress',
    hintsUsed: 0,
    solutionViewed: false,
    files: {},
    updatedAt: 1,
    ...patch,
  };
}

/** A database with rows under the old lesson id, as a store from before the rename has. */
async function seeded(name: string): Promise<void> {
  const db = new TsDojoDb(name);
  await db.lessons.bulkPut([
    {
      id: OLD_LESSON,
      state: 'complete',
      theoryReadAt: 5,
      completedAt: 6,
      lastOpenedAt: 6,
      lastExerciseId: `${OLD_LESSON}/01-handle-the-new-shape`,
    },
    // Another lesson whose Continue pointer is the renamed exercise.
    {
      id: 'm99-fixtures/02-implement',
      state: 'in-progress',
      lastOpenedAt: 7,
      lastExerciseId: OLD_EXERCISE,
    },
    // A removed lesson: never renamed, never deleted.
    { id: 'm99-fixtures/09-removed', state: 'in-progress', lastOpenedAt: 2 },
  ]);
  await db.exercises.bulkPut([
    exercise(`${OLD_LESSON}/01-handle-the-new-shape`, {
      state: 'passed',
      passedAt: 6,
      hintsUsed: 2,
    }),
    exercise(`${OLD_LESSON}/02-what-is-left`, { predictAnswer: 1 }),
    exercise(OLD_EXERCISE, { hintsUsed: 1, files: { '/index.ts': 'mine' } }),
    // Shares the prefix as text but is not under the old lesson.
    exercise('m99-fixtures/00-first-fixture/01-x'),
  ]);
  await db.attempts.bulkAdd([
    {
      exerciseId: `${OLD_LESSON}/01-handle-the-new-shape`,
      at: 3,
      passed: true,
      groups: {
        compiles: { passed: true, count: 0 },
        types: { passed: true, count: 0 },
        tests: { passed: true, count: 2 },
        rules: { passed: true, count: 0 },
      },
      ms: 10,
      files: {},
    },
    {
      exerciseId: OLD_EXERCISE,
      at: 4,
      passed: false,
      groups: {
        compiles: { passed: false, count: 1 },
        types: { passed: false, count: 0 },
        tests: { passed: false, count: 0 },
        rules: { passed: false, count: 0 },
      },
      ms: 10,
      files: {},
    },
  ]);
  await db.meta.bulkPut([
    { key: LAST_LESSON_KEY, value: OLD_LESSON },
    { key: 'contentVersion', value: 'old-hash' },
  ]);
  db.close();
}

describe('renameId', () => {
  it('maps an id, and an exercise under a renamed lesson, in file order', () => {
    const renames = [LESSON_RENAME, EXERCISE_RENAME];
    expect(renameId(OLD_LESSON, renames)).toBe(NEW_LESSON);
    expect(renameId(`${OLD_LESSON}/02-what-is-left`, renames)).toBe(
      `${NEW_LESSON}/02-what-is-left`,
    );
    expect(renameId(OLD_EXERCISE, renames)).toBe(NEW_EXERCISE);
    expect(renameId('m99-fixtures/00-first-fixture/01-x', renames)).toBe(
      'm99-fixtures/00-first-fixture/01-x',
    );
    // A chain a → b, b → c lands on c.
    expect(
      renameId('m/a', [
        { from: 'm/a', to: 'm/b' },
        { from: 'm/b', to: 'm/c' },
      ]),
    ).toBe('m/c');
  });
});

describe('applyContentUpdate', () => {
  it('moves a renamed lesson with its exercises, attempts, Continue pointers and journal, and records the versions', async () => {
    const name = freshName();
    await seeded(name);
    const journal = memoryStorage();
    journal.setItem(
      UNSAVED_KEY,
      JSON.stringify({
        [`${OLD_LESSON}/01-handle-the-new-shape`]: { '/index.ts': 'typed' },
      }),
    );
    const db = new TsDojoDb(name);
    opened.push(db);
    await applyContentUpdate(
      db,
      { renames: [LESSON_RENAME, EXERCISE_RENAME], contentVersion: 'new-hash' },
      journal,
    );

    expect(await db.lessons.get(OLD_LESSON)).toBeUndefined();
    expect(await db.lessons.get(NEW_LESSON)).toMatchObject({
      state: 'complete',
      theoryReadAt: 5,
      lastExerciseId: `${NEW_LESSON}/01-handle-the-new-shape`,
    });
    expect((await db.exercises.toArray()).map((row) => row.id).sort()).toEqual(
      [
        'm99-fixtures/00-first-fixture/01-x',
        `${NEW_LESSON}/01-handle-the-new-shape`,
        `${NEW_LESSON}/02-what-is-left`,
        NEW_EXERCISE,
      ].sort(),
    );
    expect(
      await db.exercises.get(`${NEW_LESSON}/01-handle-the-new-shape`),
    ).toMatchObject({
      lessonId: NEW_LESSON,
      state: 'passed',
      hintsUsed: 2,
    });
    expect(await db.exercises.get(NEW_EXERCISE)).toMatchObject({
      lessonId: 'm99-fixtures/02-implement',
      hintsUsed: 1,
      files: { '/index.ts': 'mine' },
    });
    expect(
      (await db.attempts.toArray()).map((row) => row.exerciseId).sort(),
    ).toEqual([`${NEW_LESSON}/01-handle-the-new-shape`, NEW_EXERCISE].sort());
    expect(
      (await db.lessons.get('m99-fixtures/02-implement'))?.lastExerciseId,
    ).toBe(NEW_EXERCISE);
    expect((await db.meta.get(LAST_LESSON_KEY))?.value).toBe(NEW_LESSON);
    expect(
      peekUnsaved(`${NEW_LESSON}/01-handle-the-new-shape`, journal),
    ).toEqual({ '/index.ts': 'typed' });
    expect(
      peekUnsaved(`${OLD_LESSON}/01-handle-the-new-shape`, journal),
    ).toEqual({});
    // A removed lesson keeps its rows (§7 "orphaned").
    expect(await db.lessons.get('m99-fixtures/09-removed')).toBeDefined();
    expect((await db.meta.get('contentVersion'))?.value).toBe('new-hash');
    expect((await db.meta.get('schemaVersion'))?.value).toBe(SCHEMA_VERSION);
  });

  it('merges into rows the new id already has, by the §7 rules', async () => {
    const name = freshName();
    await seeded(name);
    const before = new TsDojoDb(name);
    // Since the rename shipped, the new lesson was opened and its first exercise edited.
    await before.lessons.put({
      id: NEW_LESSON,
      state: 'in-progress',
      lastOpenedAt: 50,
      lastExerciseId: `${NEW_LESSON}/02-what-is-left`,
    });
    await before.exercises.put(
      exercise(`${NEW_LESSON}/01-handle-the-new-shape`, {
        updatedAt: 50,
        files: { '/index.ts': 'newer' },
      }),
    );
    before.close();
    const db = new TsDojoDb(name);
    opened.push(db);
    await applyContentUpdate(
      db,
      { renames: [LESSON_RENAME], contentVersion: 'h' },
      memoryStorage(),
    );
    expect(await db.lessons.get(NEW_LESSON)).toMatchObject({
      state: 'complete',
      completedAt: 6,
      lastOpenedAt: 50,
      lastExerciseId: `${NEW_LESSON}/02-what-is-left`,
    });
    expect(
      await db.exercises.get(`${NEW_LESSON}/01-handle-the-new-shape`),
    ).toMatchObject({
      state: 'passed',
      passedAt: 6,
      files: { '/index.ts': 'newer' },
    });
  });

  it('is idempotent: a second open changes nothing', async () => {
    const name = freshName();
    await seeded(name);
    const db = new TsDojoDb(name);
    opened.push(db);
    const update = {
      renames: [LESSON_RENAME, EXERCISE_RENAME],
      contentVersion: 'h',
    };
    await applyContentUpdate(db, update, memoryStorage());
    const snapshot = async () => ({
      lessons: await db.lessons.toArray(),
      exercises: await db.exercises.toArray(),
      attempts: await db.attempts.toArray(),
      meta: await db.meta.toArray(),
    });
    const once = await snapshot();
    await applyContentUpdate(db, update, memoryStorage());
    expect(await snapshot()).toEqual(once);
  });
});

describe('installContentUpdate', () => {
  it('runs on open, before a query issued while the database is opening', async () => {
    const name = freshName();
    await seeded(name);
    const db = new TsDojoDb(name);
    opened.push(db);
    installContentUpdate(db, {
      renames: [LESSON_RENAME],
      contentVersion: 'installed',
    });
    // The first query opens the database; the renames have run by the time it reads.
    expect(await db.lessons.get(NEW_LESSON)).toMatchObject({
      state: 'complete',
    });
    expect((await db.meta.get('contentVersion'))?.value).toBe('installed');
  });
});

describe('installContentUpdate when the update fails', () => {
  it('logs, opens the store anyway and leaves the rows as they were', async () => {
    const name = freshName();
    await seeded(name);
    const db = new TsDojoDb(name);
    opened.push(db);
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => void errors.push(args);
    try {
      // A validated renames file cannot make the update fail, so the failure is forced: reading
      // the content version throws after the rename ran, inside the same transaction.
      const failing = {
        renames: [LESSON_RENAME],
        get contentVersion(): string {
          throw new Error('boom');
        },
      };
      installContentUpdate(db, failing);
      expect(await db.lessons.get(OLD_LESSON)).toMatchObject({
        state: 'complete',
      });
      expect(errors).toHaveLength(1);
    } finally {
      console.error = original;
    }
  });
});
