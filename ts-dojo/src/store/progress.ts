// The §7 progress rows the lesson page writes (spec §1 Completion; Hints, solutions, reset,
// attempts; §7 Store and Writes; §9 Staleness and failure). Lessons: opened, Check yourself
// answers, theory read, complete. Exercises: the autosaved files, hints used, solution viewed,
// the `predict` answer, passed (never unpassed). Attempts: a row written before the sandbox
// starts and completed with the verdict, the newest ATTEMPTS_KEPT per exercise kept. Each
// function takes the database last so the tests run on a fresh one (fake-indexeddb).
import type { ExerciseResult } from '@/verify/exercise';
import { isLessonComplete, type LessonShape } from './completion';
import {
  getDb,
  type AttemptGroups,
  type AttemptKind,
  type ExerciseRow,
  type LayoutMode,
  type LessonRow,
  type LessonState,
  type TsDojoDb,
} from './db';

/** §7: "rows beyond the newest 20 per exercise are pruned on write". */
export const ATTEMPTS_KEPT = 20;

/** §7 `meta` key F9's Continue and the roadmap read. */
export const LAST_LESSON_KEY = 'lastLessonId';

function newLesson(id: string): LessonRow {
  return { id, state: 'not-started' };
}

function newExercise(id: string, lessonId: string): ExerciseRow {
  return {
    id,
    lessonId,
    state: 'untouched',
    hintsUsed: 0,
    solutionViewed: false,
    files: {},
    updatedAt: Date.now(),
  };
}

async function updateLesson(
  id: string,
  change: (row: LessonRow) => LessonRow,
  db: TsDojoDb,
): Promise<LessonRow> {
  return db.transaction('rw', db.lessons, async () => {
    const next = change((await db.lessons.get(id)) ?? newLesson(id));
    await db.lessons.put(next);
    return next;
  });
}

async function updateExercise(
  id: string,
  lessonId: string,
  change: (row: ExerciseRow) => ExerciseRow,
  db: TsDojoDb,
): Promise<ExerciseRow> {
  return db.transaction('rw', db.exercises, async () => {
    const next = change(
      (await db.exercises.get(id)) ?? newExercise(id, lessonId),
    );
    await db.exercises.put({ ...next, updatedAt: Date.now() });
    return next;
  });
}

/** Untouched becomes in progress; passed stays passed. */
function touched(row: ExerciseRow): ExerciseRow {
  return row.state === 'untouched' ? { ...row, state: 'in-progress' } : row;
}

/** Opening a lesson page on an exercise. */
export async function openLessonRow(
  lessonId: string,
  exerciseId: string | null,
  db: TsDojoDb = getDb(),
): Promise<void> {
  await updateLesson(
    lessonId,
    (row) => ({
      ...row,
      state: row.state === 'complete' ? 'complete' : 'in-progress',
      lastOpenedAt: Date.now(),
      ...(exerciseId === null ? {} : { lastExerciseId: exerciseId }),
    }),
    db,
  );
  await db.meta.put({ key: LAST_LESSON_KEY, value: lessonId });
}

/** A Check yourself answer (§1: retries allowed; the latest answer is kept). */
export async function answerQuestion(
  lessonId: string,
  questionId: string,
  answerIndex: number,
  correct: boolean,
  db: TsDojoDb = getDb(),
): Promise<void> {
  await updateLesson(
    lessonId,
    (row) => ({
      ...row,
      questions: {
        ...row.questions,
        [questionId]: { answerIndex, correct, at: Date.now() },
      },
    }),
    db,
  );
}

export async function markTheoryRead(
  lessonId: string,
  db: TsDojoDb = getDb(),
): Promise<void> {
  await updateLesson(
    lessonId,
    (row) => ({
      ...row,
      state: row.state === 'not-started' ? 'in-progress' : row.state,
      theoryReadAt: row.theoryReadAt ?? Date.now(),
    }),
    db,
  );
}

/** `:layout` on this lesson (§6 "the layout choice is remembered"). */
export async function setLessonLayout(
  lessonId: string,
  layout: LayoutMode,
  db: TsDojoDb = getDb(),
): Promise<void> {
  await updateLesson(lessonId, (row) => ({ ...row, layout }), db);
}

/** Re-checks §1 completion and writes `complete` (with `completedAt`) the first time it holds. */
export async function refreshLessonState(
  lesson: LessonShape,
  db: TsDojoDb = getDb(),
): Promise<LessonState> {
  return db.transaction('rw', db.lessons, db.exercises, async () => {
    const row = (await db.lessons.get(lesson.id)) ?? newLesson(lesson.id);
    const rows = await db.exercises.bulkGet([...lesson.requiredExercises]);
    const exercises = Object.fromEntries(
      lesson.requiredExercises.map((id, i) => [id, rows[i]]),
    );
    if (row.state !== 'complete' && isLessonComplete(lesson, row, exercises)) {
      await db.lessons.put({
        ...row,
        state: 'complete',
        completedAt: Date.now(),
      });
      return 'complete';
    }
    return row.state;
  });
}

/** Autosave (§7: 500 ms after the last keystroke): one file of the working copy. */
export async function saveExerciseFile(
  exerciseId: string,
  lessonId: string,
  path: string,
  text: string,
  db: TsDojoDb = getDb(),
): Promise<void> {
  await updateExercise(
    exerciseId,
    lessonId,
    (row) => touched({ ...row, files: { ...row.files, [path]: text } }),
    db,
  );
}

/** `:reset`: the working copy goes back to the starter; attempts stay (§1). */
export async function clearExerciseFiles(
  exerciseId: string,
  lessonId: string,
  db: TsDojoDb = getDb(),
): Promise<void> {
  await updateExercise(
    exerciseId,
    lessonId,
    (row) => ({ ...row, files: {} }),
    db,
  );
}

/** `:hint`: one more hint, up to the number the exercise has; returns the count now shown. */
export async function recordHint(
  exerciseId: string,
  lessonId: string,
  total: number,
  db: TsDojoDb = getDb(),
): Promise<number> {
  const row = await updateExercise(
    exerciseId,
    lessonId,
    (row) => touched({ ...row, hintsUsed: Math.min(total, row.hintsUsed + 1) }),
    db,
  );
  return row.hintsUsed;
}

/** `:sol`: "marks the exercise solution viewed" (§1). */
export async function recordSolutionViewed(
  exerciseId: string,
  lessonId: string,
  db: TsDojoDb = getDb(),
): Promise<void> {
  await updateExercise(
    exerciseId,
    lessonId,
    (row) => touched({ ...row, solutionViewed: true }),
    db,
  );
}

/** A `predict` exercise's answer: passed when correct, and a passed exercise stays passed. */
export async function recordPredictAnswer(
  exerciseId: string,
  lessonId: string,
  answerIndex: number,
  correct: boolean,
  db: TsDojoDb = getDb(),
): Promise<void> {
  await updateExercise(
    exerciseId,
    lessonId,
    (row) => {
      const answered = { ...row, predictAnswer: answerIndex };
      if (row.state === 'passed') return answered;
      return correct
        ? { ...answered, state: 'passed', passedAt: Date.now() }
        : { ...answered, state: 'in-progress' };
    },
    db,
  );
}

const NOT_CHECKED = { passed: false, count: 0 } as const;

/** The §7 attempt groups of a verdict: whether each group passed and how many items it had. */
export function attemptGroups(result: ExerciseResult): AttemptGroups {
  return {
    compiles: {
      passed: result.compiles.ok,
      count: result.compiles.diagnostics.length,
    },
    types: {
      passed: result.compiles.ok && result.typeCases.ok,
      count: result.typeCases.cases.length,
    },
    tests: {
      passed: result.compiles.ok && result.runtime.ok,
      count: result.runtime.tests.length,
    },
    rules: {
      passed: result.compiles.ok && result.rules.ok,
      count: result.rules.hits.length,
    },
  };
}

/** A `:run` checks no group but Compiles, from the diagnostics the editor shows. */
export function runGroups(diagnosticCount: number): AttemptGroups {
  return {
    compiles: { passed: diagnosticCount === 0, count: diagnosticCount },
    types: NOT_CHECKED,
    tests: NOT_CHECKED,
    rules: NOT_CHECKED,
  };
}

/**
 * §9: "an attempt row before the sandbox starts". The row holds the files; `finishAttempt`
 * adds the verdict. Older rows beyond ATTEMPTS_KEPT for the exercise are pruned here.
 */
export async function startAttempt(
  exerciseId: string,
  lessonId: string,
  kind: AttemptKind,
  files: Record<string, string>,
  db: TsDojoDb = getDb(),
): Promise<number> {
  const id = await db.transaction('rw', db.attempts, async () => {
    const added = await db.attempts.add({
      exerciseId,
      kind,
      at: Date.now(),
      passed: false,
      groups: {
        compiles: NOT_CHECKED,
        types: NOT_CHECKED,
        tests: NOT_CHECKED,
        rules: NOT_CHECKED,
      },
      ms: 0,
      files,
    });
    // `++id` keys only grow, so the lowest keys are the oldest attempts.
    const ids = (
      await db.attempts.where('exerciseId').equals(exerciseId).primaryKeys()
    )
      .filter((key) => key !== undefined)
      .sort((a, b) => a - b);
    const excess = ids.slice(0, Math.max(0, ids.length - ATTEMPTS_KEPT));
    if (excess.length > 0) await db.attempts.bulkDelete(excess);
    if (added === undefined) throw new Error('the attempt row has no key');
    return added;
  });
  await updateExercise(exerciseId, lessonId, touched, db);
  return id;
}

export async function finishAttempt(
  id: number,
  outcome: { passed: boolean; groups: AttemptGroups; ms: number },
  db: TsDojoDb = getDb(),
): Promise<void> {
  await db.attempts.update(id, outcome);
}

/**
 * A passing `:test`: passed with `passedAt` and `attemptsToPass` (the attempts kept for the
 * exercise, so at most ATTEMPTS_KEPT), the first time only. True when it newly passed.
 */
export async function markExercisePassed(
  exerciseId: string,
  lessonId: string,
  db: TsDojoDb = getDb(),
): Promise<boolean> {
  return db.transaction('rw', db.exercises, db.attempts, async () => {
    const row =
      (await db.exercises.get(exerciseId)) ?? newExercise(exerciseId, lessonId);
    if (row.state === 'passed') return false;
    const attempts = await db.attempts
      .where('exerciseId')
      .equals(exerciseId)
      .count();
    await db.exercises.put({
      ...row,
      state: 'passed',
      passedAt: Date.now(),
      attemptsToPass: attempts,
      updatedAt: Date.now(),
    });
    return true;
  });
}
