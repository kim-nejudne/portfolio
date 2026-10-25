// The §7 progress rows the lesson page writes (spec §1 Completion, Hints/solutions/reset/attempts;
// §7 Store and Writes; §9 "an attempt row before the sandbox starts"). Dexie runs in Node over
// fake-indexeddb, one fresh database per test.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { ExerciseResult } from '@/verify/exercise';
import type { LessonShape } from './completion';
import { TsDojoDb } from './db';
import {
  ATTEMPTS_KEPT,
  answerQuestion,
  attemptGroups,
  clearExerciseFiles,
  finishAttempt,
  markExercisePassed,
  markTheoryRead,
  openLessonRow,
  recordHint,
  recordPredictAnswer,
  recordSolutionViewed,
  refreshLessonState,
  saveExerciseFile,
  setLessonLayout,
  startAttempt,
} from './progress';

let counter = 0;
const open: TsDojoDb[] = [];
const freshDb = (): TsDojoDb => {
  const db = new TsDojoDb(`ts-dojo-progress-${String(++counter)}`);
  open.push(db);
  return db;
};

afterEach(async () => {
  for (const db of open.splice(0)) await db.delete();
});

const LESSON: LessonShape = {
  id: 'm/l',
  questionIds: ['q1'],
  requiredExercises: ['m/l/01', 'm/l/02'],
};

const PASSED_RESULT: ExerciseResult = {
  compiles: { ok: true, diagnostics: [] },
  typeCases: {
    ok: true,
    cases: [{ name: 'case 1', ok: true, diagnostics: [] }],
  },
  runtime: { ok: true, tests: [{ name: 't', status: 'pass', ms: 1 }] },
  rules: { ok: true, hits: [] },
  passed: true,
};

describe('lessons', () => {
  it('opening marks the lesson in progress, remembers the exercise and the last lesson', async () => {
    const db = freshDb();
    await openLessonRow('m/l', 'm/l/02', db);
    const row = await db.lessons.get('m/l');
    expect(row).toMatchObject({
      id: 'm/l',
      state: 'in-progress',
      lastExerciseId: 'm/l/02',
    });
    expect(typeof row?.lastOpenedAt).toBe('number');
    expect((await db.meta.get('lastLessonId'))?.value).toBe('m/l');
  });

  it('remembers the lesson’s layout', async () => {
    const db = freshDb();
    await setLessonLayout('m/l', 'theory', db);
    expect(await db.lessons.get('m/l')).toMatchObject({
      state: 'not-started',
      layout: 'theory',
    });
  });

  it('opening a complete lesson keeps it complete', async () => {
    const db = freshDb();
    await db.lessons.put({ id: 'm/l', state: 'complete', completedAt: 1 });
    await openLessonRow('m/l', 'm/l/01', db);
    expect((await db.lessons.get('m/l'))?.state).toBe('complete');
  });

  it('records answers; theory read and both exercises passed complete the lesson', async () => {
    const db = freshDb();
    await answerQuestion('m/l', 'q1', 0, false, db);
    await answerQuestion('m/l', 'q1', 2, true, db);
    expect((await db.lessons.get('m/l'))?.questions).toEqual({
      q1: { answerIndex: 2, correct: true, at: expect.any(Number) as number },
    });
    await markTheoryRead('m/l', db);
    expect(await refreshLessonState(LESSON, db)).toBe('in-progress');
    await markExercisePassed('m/l/01', 'm/l', db);
    await recordPredictAnswer('m/l/02', 'm/l', 1, true, db);
    expect(await refreshLessonState(LESSON, db)).toBe('complete');
    const row = await db.lessons.get('m/l');
    expect(row?.state).toBe('complete');
    expect(typeof row?.completedAt).toBe('number');
    expect(typeof row?.theoryReadAt).toBe('number');
  });
});

describe('exercises', () => {
  it('autosave merges one file at a time and moves untouched to in progress', async () => {
    const db = freshDb();
    await saveExerciseFile('m/l/01', 'm/l', '/index.ts', 'a', db);
    await saveExerciseFile('m/l/01', 'm/l', '/tests.ts', 'b', db);
    await saveExerciseFile('m/l/01', 'm/l', '/index.ts', 'c', db);
    expect(await db.exercises.get('m/l/01')).toMatchObject({
      lessonId: 'm/l',
      state: 'in-progress',
      files: { '/index.ts': 'c', '/tests.ts': 'b' },
      hintsUsed: 0,
      solutionViewed: false,
    });
  });

  it('counts hints up to the number the exercise has', async () => {
    const db = freshDb();
    expect(await recordHint('m/l/01', 'm/l', 2, db)).toBe(1);
    expect(await recordHint('m/l/01', 'm/l', 2, db)).toBe(2);
    expect(await recordHint('m/l/01', 'm/l', 2, db)).toBe(2);
    expect((await db.exercises.get('m/l/01'))?.hintsUsed).toBe(2);
  });

  it('records the solution viewed, and a reset clears the files but keeps the attempts', async () => {
    const db = freshDb();
    await saveExerciseFile('m/l/01', 'm/l', '/index.ts', 'edited', db);
    await recordSolutionViewed('m/l/01', 'm/l', db);
    await startAttempt('m/l/01', 'm/l', 'test', { '/index.ts': 'edited' }, db);
    await clearExerciseFiles('m/l/01', 'm/l', db);
    expect(await db.exercises.get('m/l/01')).toMatchObject({
      files: {},
      solutionViewed: true,
    });
    expect(await db.attempts.where('exerciseId').equals('m/l/01').count()).toBe(
      1,
    );
  });

  it('a predict answer passes when correct and never unpasses; a wrong first answer is in progress', async () => {
    const db = freshDb();
    await recordPredictAnswer('m/l/02', 'm/l', 0, false, db);
    expect(await db.exercises.get('m/l/02')).toMatchObject({
      state: 'in-progress',
      predictAnswer: 0,
    });
    await recordPredictAnswer('m/l/02', 'm/l', 1, true, db);
    await recordPredictAnswer('m/l/02', 'm/l', 0, false, db);
    const row = await db.exercises.get('m/l/02');
    expect(row).toMatchObject({ state: 'passed', predictAnswer: 0 });
    expect(typeof row?.passedAt).toBe('number');
  });
});

describe('attempts', () => {
  it('writes the row before the run and completes it with the verdict per group', async () => {
    const db = freshDb();
    const id = await startAttempt(
      'm/l/01',
      'm/l',
      'test',
      { '/index.ts': 'x' },
      db,
    );
    const pending = await db.attempts.get(id);
    expect(pending).toMatchObject({
      exerciseId: 'm/l/01',
      kind: 'test',
      passed: false,
      ms: 0,
      files: { '/index.ts': 'x' },
    });
    await finishAttempt(
      id,
      { passed: true, groups: attemptGroups(PASSED_RESULT), ms: 42 },
      db,
    );
    expect(await db.attempts.get(id)).toMatchObject({
      passed: true,
      ms: 42,
      groups: {
        compiles: { passed: true, count: 0 },
        types: { passed: true, count: 1 },
        tests: { passed: true, count: 1 },
        rules: { passed: true, count: 0 },
      },
    });
    expect((await db.exercises.get('m/l/01'))?.state).toBe('in-progress');
  });

  it(`keeps the newest ${String(ATTEMPTS_KEPT)} attempts per exercise`, async () => {
    const db = freshDb();
    for (let i = 0; i < ATTEMPTS_KEPT + 3; i++) {
      await startAttempt(
        'm/l/01',
        'm/l',
        'run',
        { '/index.ts': String(i) },
        db,
      );
    }
    await startAttempt('m/l/02', 'm/l', 'run', {}, db);
    const kept = await db.attempts
      .where('exerciseId')
      .equals('m/l/01')
      .sortBy('id');
    expect(kept).toHaveLength(ATTEMPTS_KEPT);
    expect(kept[0]?.files['/index.ts']).toBe('3');
    expect(kept.at(-1)?.files['/index.ts']).toBe(String(ATTEMPTS_KEPT + 2));
    expect(await db.attempts.where('exerciseId').equals('m/l/02').count()).toBe(
      1,
    );
  });

  it('passing records passedAt and the attempts it took, once', async () => {
    const db = freshDb();
    await startAttempt('m/l/01', 'm/l', 'test', {}, db);
    await startAttempt('m/l/01', 'm/l', 'run', {}, db);
    await startAttempt('m/l/01', 'm/l', 'test', {}, db);
    expect(await markExercisePassed('m/l/01', 'm/l', db)).toBe(true);
    const first = await db.exercises.get('m/l/01');
    expect(first).toMatchObject({ state: 'passed', attemptsToPass: 3 });
    await startAttempt('m/l/01', 'm/l', 'test', {}, db);
    expect(await markExercisePassed('m/l/01', 'm/l', db)).toBe(false);
    expect(await db.exercises.get('m/l/01')).toMatchObject({
      attemptsToPass: 3,
      passedAt: first?.passedAt,
    });
  });
});
