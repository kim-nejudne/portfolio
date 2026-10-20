// The §7 reset scopes past `:reset` (one exercise's files, F8's `clearExerciseFiles`): one
// lesson, one module, everything. `/progress` asks for the confirmation; these do the work. A
// lesson goes with its exercise rows, their attempts, their unsaved journal entries and the
// Continue pointer if it named this lesson; "everything" clears every progress table and the
// REPL buffers (the REPL seeds its welcome buffers again) and keeps the version keys, which the
// next open writes anyway, and the settings, which belong to `/settings` (F9 plan, decision F).
import type { TsDojoDb } from './db';
import { CONTENT_VERSION_KEY, SCHEMA_VERSION_KEY } from './content-update';
import { LAST_LESSON_KEY } from './progress';
import {
  dropUnsavedWhere,
  unsavedStorage,
  type UnsavedStorage,
} from './unsaved';

const KEPT_META = new Set([SCHEMA_VERSION_KEY, CONTENT_VERSION_KEY]);

async function removeLessons(
  db: TsDojoDb,
  lessonIds: readonly string[],
): Promise<void> {
  await db.transaction(
    'rw',
    [db.lessons, db.exercises, db.attempts, db.meta],
    async () => {
      for (const lessonId of lessonIds) {
        const prefix = `${lessonId}/`;
        await db.exercises.where('id').startsWith(prefix).delete();
        await db.attempts.where('exerciseId').startsWith(prefix).delete();
        await db.lessons.delete(lessonId);
      }
      const last = await db.meta.get(LAST_LESSON_KEY);
      if (typeof last?.value === 'string' && lessonIds.includes(last.value)) {
        await db.meta.delete(LAST_LESSON_KEY);
      }
    },
  );
}

function under(lessonIds: readonly string[]) {
  return (exerciseId: string): boolean =>
    lessonIds.some((lessonId) => exerciseId.startsWith(`${lessonId}/`));
}

export async function resetLesson(
  db: TsDojoDb,
  lessonId: string,
  journal: UnsavedStorage | null = unsavedStorage(),
): Promise<void> {
  await removeLessons(db, [lessonId]);
  dropUnsavedWhere(under([lessonId]), journal);
}

export async function resetModule(
  db: TsDojoDb,
  lessonIds: readonly string[],
  journal: UnsavedStorage | null = unsavedStorage(),
): Promise<void> {
  await removeLessons(db, lessonIds);
  dropUnsavedWhere(under(lessonIds), journal);
}

export async function resetEverything(
  db: TsDojoDb,
  journal: UnsavedStorage | null = unsavedStorage(),
): Promise<void> {
  await db.transaction(
    'rw',
    [db.lessons, db.exercises, db.attempts, db.buffers, db.meta],
    async () => {
      await Promise.all([
        db.lessons.clear(),
        db.exercises.clear(),
        db.attempts.clear(),
        db.buffers.clear(),
      ]);
      const keys = (await db.meta.toCollection().primaryKeys()).filter(
        (key) => !KEPT_META.has(key),
      );
      await db.meta.bulkDelete(keys);
    },
  );
  dropUnsavedWhere(() => true, journal);
}
