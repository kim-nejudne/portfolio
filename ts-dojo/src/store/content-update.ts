// §7 Content versions, applied every time the store opens (Dexie's `ready` event, which holds
// every other query until it is done): each `renames.yaml` entry in file order, then
// `schemaVersion` and `contentVersion` recorded. A lesson rename moves the lesson row, the
// exercise rows under it (id and `lessonId`), their attempts, any `lastExerciseId` and
// `meta.lastLessonId` pointing into it, and the unsaved journal's entries; an exercise rename
// moves one exercise the same way. A rename onto an id that already has rows merges them by the
// §7 rules (merge.ts). No row is ever deleted: a lesson the content no longer has keeps its rows
// and /progress lists them as orphaned. Running again finds no old rows, so it is idempotent.
import type { Rename } from '@/content/build-registry';
import { SCHEMA_VERSION, type TsDojoDb } from './db';
import { mergeExercise, mergeLesson } from './merge';
import { LAST_LESSON_KEY } from './progress';
import { renameUnsaved, unsavedStorage, type UnsavedStorage } from './unsaved';

export const SCHEMA_VERSION_KEY = 'schemaVersion';
export const CONTENT_VERSION_KEY = 'contentVersion';

export interface ContentUpdate {
  renames: readonly Rename[];
  contentVersion: string;
}

function renames(id: string, rename: Rename): boolean {
  return id === rename.from || id.startsWith(`${rename.from}/`);
}

/** The id after every rename in order: a lesson rename carries the exercises under it along. */
export function renameId(id: string, list: readonly Rename[]): string {
  let current = id;
  for (const rename of list) {
    if (renames(current, rename)) {
      current = rename.to + current.slice(rename.from.length);
    }
  }
  return current;
}

/** `m/l/e` → `m/l`. */
export function lessonOfExercise(exerciseId: string): string {
  return exerciseId.split('/').slice(0, 2).join('/');
}

async function applyRename(db: TsDojoDb, rename: Rename): Promise<void> {
  const to = (id: string): string => rename.to + id.slice(rename.from.length);

  const lesson = await db.lessons.get(rename.from);
  if (lesson !== undefined) {
    const moved = { ...lesson, id: rename.to };
    const existing = await db.lessons.get(rename.to);
    await db.lessons.put(
      existing === undefined ? moved : mergeLesson(existing, moved),
    );
    await db.lessons.delete(rename.from);
  }

  const exercises = (
    await db.exercises.where('id').startsWith(rename.from).toArray()
  ).filter((row) => renames(row.id, rename));
  for (const row of exercises) {
    const id = to(row.id);
    const moved = { ...row, id, lessonId: lessonOfExercise(id) };
    const existing = await db.exercises.get(id);
    await db.exercises.put(
      existing === undefined ? moved : mergeExercise(existing, moved),
    );
    await db.exercises.delete(row.id);
  }

  await db.attempts
    .where('exerciseId')
    .startsWith(rename.from)
    .filter((row) => renames(row.exerciseId, rename))
    .modify((row) => {
      row.exerciseId = to(row.exerciseId);
    });

  await db.lessons
    .filter(
      (row) =>
        row.lastExerciseId !== undefined && renames(row.lastExerciseId, rename),
    )
    .modify((row) => {
      if (row.lastExerciseId !== undefined) {
        row.lastExerciseId = to(row.lastExerciseId);
      }
    });

  const last = await db.meta.get(LAST_LESSON_KEY);
  if (typeof last?.value === 'string' && renames(last.value, rename)) {
    await db.meta.put({ key: LAST_LESSON_KEY, value: to(last.value) });
  }
}

export async function applyContentUpdate(
  db: TsDojoDb,
  update: ContentUpdate,
  journal: UnsavedStorage | null = unsavedStorage(),
): Promise<void> {
  // One transaction: the renames and the versions land together or not at all.
  await db.transaction(
    'rw',
    [db.lessons, db.exercises, db.attempts, db.meta],
    async () => {
      for (const rename of update.renames) await applyRename(db, rename);
      await db.meta.bulkPut([
        { key: SCHEMA_VERSION_KEY, value: SCHEMA_VERSION },
        { key: CONTENT_VERSION_KEY, value: update.contentVersion },
      ]);
    },
  );
  if (update.renames.length > 0) {
    renameUnsaved((id) => renameId(id, update.renames), journal);
  }
}

/**
 * Runs the update on every open of `db`, before any other query reads it. A failure is logged
 * and the store opens anyway: the renames' transaction rolls back whole, so the rows stay as
 * they were, and the next open tries again.
 */
export function installContentUpdate(
  db: TsDojoDb,
  update: ContentUpdate,
): void {
  db.on(
    'ready',
    (vip) =>
      applyContentUpdate(vip as TsDojoDb, update).catch((error: unknown) => {
        console.error('[store] content update failed', error);
      }),
    true,
  );
}
