// The §7 merge rules: "Rows merge by id and the newer `updatedAt` wins; attempts append; a
// passed exercise never becomes unpassed". Shared by the import and by a rename that lands on
// an id that already has rows. Lesson rows carry no `updatedAt`, so the newer is the one with
// the latest timestamp it holds, and completion never goes backwards (Spec questions).
import { describe, expect, it } from 'vitest';
import type { BufferRow, ExerciseRow, LessonRow } from './db';
import {
  lessonTouchedAt,
  mergeBuffer,
  mergeExercise,
  mergeLesson,
} from './merge';

function exercise(patch: Partial<ExerciseRow>): ExerciseRow {
  return {
    id: 'm/l/e',
    lessonId: 'm/l',
    state: 'in-progress',
    hintsUsed: 0,
    solutionViewed: false,
    files: {},
    updatedAt: 0,
    ...patch,
  };
}

describe('mergeExercise', () => {
  it('keeps the row with the newer updatedAt, whichever side it is on', () => {
    const older = exercise({ updatedAt: 10, files: { '/index.ts': 'old' } });
    const newer = exercise({ updatedAt: 20, files: { '/index.ts': 'new' } });
    expect(mergeExercise(older, newer).files).toEqual({ '/index.ts': 'new' });
    expect(mergeExercise(newer, older).files).toEqual({ '/index.ts': 'new' });
    expect(mergeExercise(newer, older).updatedAt).toBe(20);
  });

  it('keeps the current row on a tie', () => {
    const current = exercise({ updatedAt: 10, hintsUsed: 1 });
    const incoming = exercise({ updatedAt: 10, hintsUsed: 2 });
    expect(mergeExercise(current, incoming).hintsUsed).toBe(1);
  });

  it('never unpasses: an older passed row keeps the newer row passed, with the first pass', () => {
    const passed = exercise({
      updatedAt: 10,
      state: 'passed',
      passedAt: 5,
      attemptsToPass: 3,
    });
    const newerInProgress = exercise({ updatedAt: 20, hintsUsed: 2 });
    const merged = mergeExercise(passed, newerInProgress);
    expect(merged).toMatchObject({
      state: 'passed',
      passedAt: 5,
      attemptsToPass: 3,
      hintsUsed: 2,
      updatedAt: 20,
    });
    expect(mergeExercise(newerInProgress, passed).state).toBe('passed');
  });

  it('keeps the earlier pass when both rows passed', () => {
    const first = exercise({ state: 'passed', passedAt: 5, attemptsToPass: 2 });
    const second = exercise({
      updatedAt: 30,
      state: 'passed',
      passedAt: 25,
      attemptsToPass: 7,
    });
    expect(mergeExercise(second, first)).toMatchObject({
      passedAt: 5,
      attemptsToPass: 2,
      updatedAt: 30,
    });
  });
});

describe('mergeBuffer', () => {
  it('keeps the newer text', () => {
    const a: BufferRow = { name: 'notes.ts', text: 'a', updatedAt: 1 };
    const b: BufferRow = { name: 'notes.ts', text: 'b', updatedAt: 2 };
    expect(mergeBuffer(a, b).text).toBe('b');
    expect(mergeBuffer(b, a).text).toBe('b');
  });
});

describe('mergeLesson', () => {
  it('dates a row by the latest timestamp it carries', () => {
    expect(lessonTouchedAt({ id: 'm/l', state: 'not-started' })).toBe(0);
    expect(
      lessonTouchedAt({
        id: 'm/l',
        state: 'in-progress',
        lastOpenedAt: 10,
        theoryReadAt: 30,
        questions: { q: { answerIndex: 0, correct: true, at: 40 } },
      }),
    ).toBe(40);
  });

  it('takes the newer row and its last opened exercise', () => {
    const current: LessonRow = {
      id: 'm/l',
      state: 'in-progress',
      lastOpenedAt: 10,
      lastExerciseId: 'm/l/01',
      layout: 'split',
    };
    const incoming: LessonRow = {
      id: 'm/l',
      state: 'in-progress',
      lastOpenedAt: 20,
      lastExerciseId: 'm/l/02',
      layout: 'theory',
    };
    expect(mergeLesson(current, incoming)).toMatchObject({
      lastOpenedAt: 20,
      lastExerciseId: 'm/l/02',
      layout: 'theory',
    });
    expect(mergeLesson(incoming, current).lastExerciseId).toBe('m/l/02');
  });

  it('never goes backwards: complete stays complete and read theory stays read, with the first dates', () => {
    const complete: LessonRow = {
      id: 'm/l',
      state: 'complete',
      theoryReadAt: 5,
      completedAt: 6,
      lastOpenedAt: 6,
    };
    const newerOpen: LessonRow = {
      id: 'm/l',
      state: 'in-progress',
      lastOpenedAt: 50,
    };
    expect(mergeLesson(complete, newerOpen)).toMatchObject({
      state: 'complete',
      theoryReadAt: 5,
      completedAt: 6,
      lastOpenedAt: 50,
    });
    const notStarted: LessonRow = { id: 'm/l', state: 'not-started' };
    expect(mergeLesson(notStarted, newerOpen).state).toBe('in-progress');
  });

  it('merges the Check yourself answers per question, the newer answer winning', () => {
    const current: LessonRow = {
      id: 'm/l',
      state: 'in-progress',
      questions: {
        a: { answerIndex: 0, correct: false, at: 10 },
        b: { answerIndex: 1, correct: true, at: 30 },
      },
    };
    const incoming: LessonRow = {
      id: 'm/l',
      state: 'in-progress',
      questions: {
        a: { answerIndex: 2, correct: true, at: 20 },
        b: { answerIndex: 0, correct: false, at: 5 },
        c: { answerIndex: 1, correct: true, at: 1 },
      },
    };
    expect(mergeLesson(current, incoming).questions).toEqual({
      a: { answerIndex: 2, correct: true, at: 20 },
      b: { answerIndex: 1, correct: true, at: 30 },
      c: { answerIndex: 1, correct: true, at: 1 },
    });
  });
});
