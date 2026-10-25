// What the roadmap's Continue bar opens (§6 Roadmap: "names the last touched exercise and
// opens it with `c` or `Enter`"): the exercise the last opened lesson was on, from the rows the
// lesson page writes on every open (§7 `meta.lastLessonId`, `lessons.lastExerciseId`). Ids are
// checked against the content: an exercise it no longer has falls back to its lesson, a lesson
// it no longer has to the newest opened lesson it still has, and with nothing opened the bar
// offers the course's first exercise as "Start" (a decision in the F9 plan).
import { lessonOrder, type NavRegistry } from '@/pages/lesson/navigation';
import type { TsDojoDb } from './db';
import { LAST_LESSON_KEY } from './progress';

export interface ContinueRegistry extends NavRegistry {
  lesson(
    id: string,
  ): { title: string; exercises: readonly string[] } | undefined;
  exercise(id: string): { folder: string; title: string } | undefined;
}

export interface ContinueTarget {
  /** `start` when nothing has been opened yet. */
  kind: 'continue' | 'start';
  lesson: string;
  lessonTitle: string;
  /** The exercise folder, or null to open the lesson's own route. */
  exercise: string | null;
  exerciseTitle: string | null;
}

function target(
  registry: ContinueRegistry,
  kind: ContinueTarget['kind'],
  lessonId: string,
  exerciseId: string | undefined,
): ContinueTarget | null {
  const lesson = registry.lesson(lessonId);
  if (lesson === undefined) return null;
  const exercise =
    exerciseId !== undefined && lesson.exercises.includes(exerciseId)
      ? registry.exercise(exerciseId)
      : undefined;
  return {
    kind,
    lesson: lessonId,
    lessonTitle: lesson.title,
    exercise: exercise?.folder ?? null,
    exerciseTitle: exercise?.title ?? null,
  };
}

export async function continueTarget(
  db: TsDojoDb,
  registry: ContinueRegistry,
): Promise<ContinueTarget | null> {
  const [last, rows] = await Promise.all([
    db.meta.get(LAST_LESSON_KEY),
    db.lessons.toArray(),
  ]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const lastId = typeof last?.value === 'string' ? last.value : undefined;
  const lastRow = lastId === undefined ? undefined : byId.get(lastId);
  if (lastRow !== undefined && registry.lesson(lastRow.id) !== undefined) {
    return target(registry, 'continue', lastRow.id, lastRow.lastExerciseId);
  }
  const newest = rows
    .filter(
      (row) =>
        row.lastOpenedAt !== undefined && registry.lesson(row.id) !== undefined,
    )
    .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))[0];
  if (newest !== undefined) {
    return target(registry, 'continue', newest.id, newest.lastExerciseId);
  }
  const first = lessonOrder(registry)[0];
  if (first === undefined) return null;
  return target(registry, 'start', first, registry.lesson(first)?.exercises[0]);
}
