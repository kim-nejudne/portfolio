// §1 Completion as pure rules over the §7 rows: which Check yourself questions still need a
// correct answer, whether a lesson is complete (theory read and every non-challenge exercise
// passed), and the not started / in progress / complete state of a lesson and of a module. A
// module's completion ignores its optional lessons (`optional: true`, pre-F13 fixes).
import type { Lesson, Registry } from '@/content/build-registry';
import type { ExerciseRow, LessonRow, LessonState } from './db';

/** What completion needs to know about a lesson. */
export interface LessonShape {
  id: string;
  /** The Check yourself question ids, in document order. */
  questionIds: readonly string[];
  /** The exercise ids that are not `challenge: true`. */
  requiredExercises: readonly string[];
}

export function lessonShape(
  lesson: Pick<Lesson, 'id' | 'exercises'> & {
    checks: readonly Pick<Lesson['checks'][number], 'id'>[];
  },
  registry: {
    exercise(
      id: string,
    ):
      | Pick<NonNullable<ReturnType<Registry['exercise']>>, 'challenge'>
      | undefined;
  },
): LessonShape {
  return {
    id: lesson.id,
    questionIds: lesson.checks.map((check) => check.id),
    requiredExercises: lesson.exercises.filter(
      (id) => registry.exercise(id)?.challenge !== true,
    ),
  };
}

export function unansweredQuestions(
  lesson: Pick<LessonShape, 'questionIds'>,
  row: LessonRow | undefined,
): string[] {
  return lesson.questionIds.filter(
    (id) => row?.questions?.[id]?.correct !== true,
  );
}

/** What `:done` does (§1): point at the first open question, or mark the theory read. */
export type DoneOutcome =
  { kind: 'questions'; first: string; remaining: number } | { kind: 'read' };

export function doneOutcome(
  lesson: Pick<LessonShape, 'questionIds'>,
  row: LessonRow | undefined,
): DoneOutcome {
  const open = unansweredQuestions(lesson, row);
  const first = open[0];
  return first === undefined
    ? { kind: 'read' }
    : { kind: 'questions', first, remaining: open.length };
}

/** §1: `:done` "says how many remain". */
export function remainingMessage(remaining: number): string {
  return remaining === 1
    ? '1 question remains: answer it correctly, then :done'
    : `${String(remaining)} questions remain: answer them correctly, then :done`;
}

export function isLessonComplete(
  lesson: LessonShape,
  row: LessonRow | undefined,
  exercises: Readonly<Record<string, ExerciseRow | undefined>>,
): boolean {
  return (
    row?.theoryReadAt !== undefined &&
    lesson.requiredExercises.every((id) => exercises[id]?.state === 'passed')
  );
}

export function lessonStateOf(row: LessonRow | undefined): LessonState {
  return row?.state ?? 'not-started';
}

/** A module's lessons split by the frontmatter's `optional`, each part in module order. */
export function partitionLessons<T>(
  lessons: readonly T[],
  isOptional: (lesson: T) => boolean,
): { core: T[]; optional: T[] } {
  return {
    core: lessons.filter((lesson) => !isOptional(lesson)),
    optional: lessons.filter((lesson) => isOptional(lesson)),
  };
}

/**
 * Complete when every core lesson is (every lesson, for a module with no core ones); not
 * started when no lesson at all is; in progress otherwise.
 */
export function moduleState(
  core: readonly LessonState[],
  optional: readonly LessonState[] = [],
): LessonState {
  const required = core.length > 0 ? core : optional;
  if (required.length > 0 && required.every((state) => state === 'complete')) {
    return 'complete';
  }
  return [...core, ...optional].some((state) => state !== 'not-started')
    ? 'in-progress'
    : 'not-started';
}
