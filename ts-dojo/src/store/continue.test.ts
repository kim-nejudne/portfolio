// §6 Roadmap "A Continue bar at the top names the last touched exercise and opens it": the
// exercise the last opened lesson was on (F8 records `meta.lastLessonId` and the lesson's
// `lastExerciseId` on every open). A removed exercise falls back to its lesson, a removed
// lesson to the newest opened lesson the content still has, and no progress to the first
// exercise of the course ("Start", a decision in the F9 plan).
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { continueTarget, type ContinueRegistry } from './continue';
import { TsDojoDb } from './db';
import { LAST_LESSON_KEY } from './progress';

const REGISTRY: ContinueRegistry = {
  tiers: [{ id: 't', title: 'T', modules: ['m'] }],
  module: (id) => (id === 'm' ? { lessons: ['m/a', 'm/b'] } : undefined),
  lesson: (id) =>
    ({
      'm/a': { title: 'Lesson A', exercises: ['m/a/01-x', 'm/a/02-y'] },
      'm/b': { title: 'Lesson B', exercises: ['m/b/01-z'] },
    })[id],
  exercise: (id) =>
    ({
      'm/a/01-x': { folder: '01-x', title: 'X' },
      'm/a/02-y': { folder: '02-y', title: 'Y' },
      'm/b/01-z': { folder: '01-z', title: 'Z' },
    })[id],
};

let count = 0;
const opened: TsDojoDb[] = [];
function fresh(): TsDojoDb {
  count += 1;
  const db = new TsDojoDb(`continue-${String(count)}`);
  opened.push(db);
  return db;
}

afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await db.delete();
  }
});

describe('continueTarget', () => {
  it('starts at the first exercise of the course when nothing was opened', async () => {
    expect(await continueTarget(fresh(), REGISTRY)).toEqual({
      kind: 'start',
      lesson: 'm/a',
      lessonTitle: 'Lesson A',
      exercise: '01-x',
      exerciseTitle: 'X',
    });
  });

  it('names the exercise the last opened lesson was on', async () => {
    const db = fresh();
    await db.lessons.bulkPut([
      {
        id: 'm/a',
        state: 'in-progress',
        lastOpenedAt: 1,
        lastExerciseId: 'm/a/02-y',
      },
      {
        id: 'm/b',
        state: 'in-progress',
        lastOpenedAt: 2,
        lastExerciseId: 'm/b/01-z',
      },
    ]);
    await db.meta.put({ key: LAST_LESSON_KEY, value: 'm/a' });
    expect(await continueTarget(db, REGISTRY)).toEqual({
      kind: 'continue',
      lesson: 'm/a',
      lessonTitle: 'Lesson A',
      exercise: '02-y',
      exerciseTitle: 'Y',
    });
  });

  it('falls back to the lesson when its exercise is gone', async () => {
    const db = fresh();
    await db.lessons.put({
      id: 'm/a',
      state: 'in-progress',
      lastOpenedAt: 1,
      lastExerciseId: 'm/a/09-removed',
    });
    await db.meta.put({ key: LAST_LESSON_KEY, value: 'm/a' });
    expect(await continueTarget(db, REGISTRY)).toEqual({
      kind: 'continue',
      lesson: 'm/a',
      lessonTitle: 'Lesson A',
      exercise: null,
      exerciseTitle: null,
    });
  });

  it('falls back to the newest opened lesson the content has when the last one is gone', async () => {
    const db = fresh();
    await db.lessons.bulkPut([
      { id: 'm/gone', state: 'in-progress', lastOpenedAt: 9 },
      {
        id: 'm/a',
        state: 'in-progress',
        lastOpenedAt: 3,
        lastExerciseId: 'm/a/01-x',
      },
      {
        id: 'm/b',
        state: 'in-progress',
        lastOpenedAt: 5,
        lastExerciseId: 'm/b/01-z',
      },
    ]);
    await db.meta.put({ key: LAST_LESSON_KEY, value: 'm/gone' });
    expect(await continueTarget(db, REGISTRY)).toMatchObject({
      kind: 'continue',
      lesson: 'm/b',
      exercise: '01-z',
    });
  });

  it('is null for a course with no exercise at all', async () => {
    expect(
      await continueTarget(fresh(), {
        ...REGISTRY,
        tiers: [],
      }),
    ).toBeNull();
  });
});
