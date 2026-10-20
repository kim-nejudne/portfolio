// §1 Completion: theory is read once every Check yourself question has been answered correctly
// and `:done` ran; a lesson is complete when theory is read and every non-challenge exercise is
// passed; a module is complete when its lessons are; states everywhere are not started, in
// progress and complete.
import { describe, expect, it } from 'vitest';
import {
  doneOutcome,
  isLessonComplete,
  lessonShape,
  lessonStateOf,
  moduleState,
  remainingMessage,
  unansweredQuestions,
  type LessonShape,
} from './completion';
import type { ExerciseRow, LessonRow } from './db';

const LESSON: LessonShape = {
  id: 'm/l',
  questionIds: ['q1', 'q2'],
  requiredExercises: ['m/l/01', 'm/l/02'],
};

function exercise(id: string, state: ExerciseRow['state']): ExerciseRow {
  return {
    id,
    lessonId: 'm/l',
    state,
    hintsUsed: 0,
    solutionViewed: false,
    files: {},
    updatedAt: 1,
  };
}

describe('unansweredQuestions', () => {
  it('lists the questions not yet answered correctly, in document order', () => {
    expect(unansweredQuestions(LESSON, undefined)).toEqual(['q1', 'q2']);
    const row: LessonRow = {
      id: 'm/l',
      state: 'in-progress',
      questions: {
        q2: { answerIndex: 1, correct: true, at: 1 },
        q1: { answerIndex: 0, correct: false, at: 2 },
      },
    };
    expect(unansweredQuestions(LESSON, row)).toEqual(['q1']);
  });
});

describe('isLessonComplete', () => {
  const read: LessonRow = { id: 'm/l', state: 'in-progress', theoryReadAt: 5 };
  it('needs theory read and every required exercise passed', () => {
    const passed = {
      'm/l/01': exercise('m/l/01', 'passed'),
      'm/l/02': exercise('m/l/02', 'passed'),
    };
    expect(isLessonComplete(LESSON, read, passed)).toBe(true);
    expect(
      isLessonComplete(LESSON, { id: 'm/l', state: 'in-progress' }, passed),
    ).toBe(false);
    expect(
      isLessonComplete(LESSON, read, {
        ...passed,
        'm/l/02': exercise('m/l/02', 'in-progress'),
      }),
    ).toBe(false);
    expect(isLessonComplete(LESSON, read, { 'm/l/01': passed['m/l/01'] })).toBe(
      false,
    );
  });
});

describe('lessonStateOf and moduleState', () => {
  it('a lesson without a row is not started', () => {
    expect(lessonStateOf(undefined)).toBe('not-started');
    expect(lessonStateOf({ id: 'x', state: 'complete' })).toBe('complete');
  });

  it('a module is complete when its lessons are, in progress when any is touched', () => {
    expect(moduleState(['complete', 'complete'])).toBe('complete');
    expect(moduleState(['complete', 'not-started'])).toBe('in-progress');
    expect(moduleState(['in-progress', 'not-started'])).toBe('in-progress');
    expect(moduleState(['not-started', 'not-started'])).toBe('not-started');
    expect(moduleState([])).toBe('not-started');
  });
});

// §12 F8 criterion 3: "`:done` with Check yourself questions unanswered jumps to the first one
// and says how many remain". The lesson page acts on this outcome (src/pages/lesson.tsx).
describe('§12 F8: :done jumps to the first unanswered question and says how many remain', () => {
  const THREE = { questionIds: ['q1', 'q2', 'q3'] };
  const answered = (answers: Record<string, boolean>): LessonRow => ({
    id: 'm/l',
    state: 'in-progress',
    questions: Object.fromEntries(
      Object.entries(answers).map(([id, correct]) => [
        id,
        { answerIndex: 0, correct, at: 1 },
      ]),
    ),
  });

  it('names the first question still open and counts only the open ones', () => {
    expect(doneOutcome(THREE, answered({ q1: true }))).toEqual({
      kind: 'questions',
      first: 'q2',
      remaining: 2,
    });
    expect(
      doneOutcome(THREE, answered({ q1: true, q2: false, q3: true })),
    ).toEqual({ kind: 'questions', first: 'q2', remaining: 1 });
    expect(doneOutcome(THREE, undefined)).toEqual({
      kind: 'questions',
      first: 'q1',
      remaining: 3,
    });
  });

  it('marks theory read once every question is answered correctly, or when there are none', () => {
    expect(
      doneOutcome(THREE, answered({ q1: true, q2: true, q3: true })),
    ).toEqual({ kind: 'read' });
    expect(doneOutcome({ questionIds: [] }, undefined)).toEqual({
      kind: 'read',
    });
  });

  it('says how many remain in words', () => {
    expect(remainingMessage(1)).toBe(
      '1 question remains: answer it correctly, then :done',
    );
    expect(remainingMessage(2)).toBe(
      '2 questions remain: answer them correctly, then :done',
    );
  });
});

// §1 Completion: "every non-challenge exercise is passed"; `challenge: true` never blocks.
describe('lessonShape', () => {
  it('leaves a challenge exercise out of the required ones, so the lesson completes without it', () => {
    const challenge = { challenge: true };
    const core = { challenge: false };
    const shape = lessonShape(
      {
        id: 'm/l',
        checks: [{ id: 'q1' }, { id: 'q2' }],
        exercises: ['m/l/01', 'm/l/02', 'm/l/03'],
      },
      {
        exercise: (id: string) => (id === 'm/l/03' ? challenge : core),
      },
    );
    expect(shape).toEqual({
      id: 'm/l',
      questionIds: ['q1', 'q2'],
      requiredExercises: ['m/l/01', 'm/l/02'],
    });
    const read: LessonRow = {
      id: 'm/l',
      state: 'in-progress',
      theoryReadAt: 1,
    };
    expect(
      isLessonComplete(shape, read, {
        'm/l/01': exercise('m/l/01', 'passed'),
        'm/l/02': exercise('m/l/02', 'passed'),
      }),
    ).toBe(true);
  });
});
