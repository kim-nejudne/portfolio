// The §7 merge rules, for an import and for a rename that lands on an id that already has rows:
// "Rows merge by id and the newer `updatedAt` wins; attempts append; a passed exercise never
// becomes unpassed". Exercises and buffers carry `updatedAt`; a lesson row does not, so the
// newer lesson row is the one with the latest timestamp it holds (`lessonTouchedAt`), and, like
// a passed exercise, a complete lesson stays complete and read theory stays read (Spec
// questions in docs/progress.md). On a tie the current row stays. Pure.
import type { BufferRow, ExerciseRow, LessonRow, LessonState } from './db';

function earliest(a: number | undefined, b: number | undefined) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}

export function mergeExercise(
  current: ExerciseRow,
  incoming: ExerciseRow,
): ExerciseRow {
  const base = incoming.updatedAt > current.updatedAt ? incoming : current;
  const passes = [current, incoming].filter((row) => row.state === 'passed');
  if (passes.length === 0) return base;
  // The first pass: its date and the attempts it took.
  const first = passes.reduce((a, b) =>
    (b.passedAt ?? Infinity) < (a.passedAt ?? Infinity) ? b : a,
  );
  const merged: ExerciseRow = { ...base, state: 'passed' };
  const passedAt = earliest(current.passedAt, incoming.passedAt);
  if (passedAt !== undefined) merged.passedAt = passedAt;
  if (first.attemptsToPass !== undefined) {
    merged.attemptsToPass = first.attemptsToPass;
  } else {
    delete merged.attemptsToPass;
  }
  return merged;
}

export function mergeBuffer(
  current: BufferRow,
  incoming: BufferRow,
): BufferRow {
  return incoming.updatedAt > current.updatedAt ? incoming : current;
}

/** The latest moment a lesson row records: opened, theory read, completed or a question answered. */
export function lessonTouchedAt(row: LessonRow): number {
  const answers = Object.values(row.questions ?? {}).map((answer) => answer.at);
  return Math.max(
    0,
    row.lastOpenedAt ?? 0,
    row.theoryReadAt ?? 0,
    row.completedAt ?? 0,
    ...answers,
  );
}

const STATE_RANK: Record<LessonState, number> = {
  'not-started': 0,
  'in-progress': 1,
  complete: 2,
};

export function mergeLesson(
  current: LessonRow,
  incoming: LessonRow,
): LessonRow {
  const base =
    lessonTouchedAt(incoming) > lessonTouchedAt(current) ? incoming : current;
  const merged: LessonRow = { ...base };
  merged.state =
    STATE_RANK[incoming.state] > STATE_RANK[current.state]
      ? incoming.state
      : current.state;
  const theoryReadAt = earliest(current.theoryReadAt, incoming.theoryReadAt);
  if (theoryReadAt !== undefined) merged.theoryReadAt = theoryReadAt;
  const completedAt = earliest(current.completedAt, incoming.completedAt);
  if (completedAt !== undefined) merged.completedAt = completedAt;
  // The last opened exercise goes with the later opening.
  const opened =
    (incoming.lastOpenedAt ?? 0) > (current.lastOpenedAt ?? 0)
      ? incoming
      : current;
  if (opened.lastOpenedAt !== undefined) {
    merged.lastOpenedAt = opened.lastOpenedAt;
  }
  if (opened.lastExerciseId !== undefined) {
    merged.lastExerciseId = opened.lastExerciseId;
  }
  if (current.questions !== undefined || incoming.questions !== undefined) {
    const questions = { ...current.questions };
    for (const [id, answer] of Object.entries(incoming.questions ?? {})) {
      const mine = questions[id];
      if (mine === undefined || answer.at > mine.at) questions[id] = answer;
    }
    merged.questions = questions;
  }
  return merged;
}
