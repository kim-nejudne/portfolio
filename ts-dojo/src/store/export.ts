// The §7 export file: "`schemaVersion`, `contentVersion`, `exportedAt`, every row of `lessons`,
// `exercises` and `buffers`, the newest 5 attempts per exercise, and `settings`", named
// `ts-dojo-progress-<date>.json` (the local date). Attempts leave their local `++id` key
// behind: an import appends them under new keys. `exportedAt` is an ISO 8601 string (Spec
// questions); the rows keep the store's own millisecond timestamps.
import {
  SCHEMA_VERSION,
  type AttemptRow,
  type BufferRow,
  type ExerciseRow,
  type LessonRow,
  type TsDojoDb,
} from './db';
import type { Settings } from './settings';

export const EXPORT_ATTEMPTS_KEPT = 5;

export type ExportedAttempt = Omit<AttemptRow, 'id'>;

export interface ExportFile {
  schemaVersion: number;
  contentVersion: string;
  exportedAt: string;
  lessons: LessonRow[];
  exercises: ExerciseRow[];
  attempts: ExportedAttempt[];
  buffers: BufferRow[];
  settings: Settings;
}

/** Per exercise, the newest `keep` attempts in the order they were made. */
export function newestAttempts(
  rows: readonly AttemptRow[],
  keep: number,
): ExportedAttempt[] {
  const byExercise = new Map<string, AttemptRow[]>();
  for (const row of rows) {
    const list = byExercise.get(row.exerciseId) ?? [];
    list.push(row);
    byExercise.set(row.exerciseId, list);
  }
  return [...byExercise.keys()].sort().flatMap((exerciseId) =>
    (byExercise.get(exerciseId) ?? [])
      .sort((a, b) => a.at - b.at || (a.id ?? 0) - (b.id ?? 0))
      .slice(-keep)
      .map((row) => {
        const attempt: ExportedAttempt & { id?: number } = { ...row };
        delete attempt.id;
        return attempt;
      }),
  );
}

export async function buildExport(
  db: TsDojoDb,
  settings: Settings,
  contentVersion: string,
  now: Date = new Date(),
): Promise<ExportFile> {
  const [lessons, exercises, attempts, buffers] = await db.transaction(
    'r',
    [db.lessons, db.exercises, db.attempts, db.buffers],
    () =>
      Promise.all([
        db.lessons.toArray(),
        db.exercises.toArray(),
        db.attempts.toArray(),
        db.buffers.toArray(),
      ]),
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion,
    exportedAt: now.toISOString(),
    lessons,
    exercises,
    attempts: newestAttempts(attempts, EXPORT_ATTEMPTS_KEPT),
    buffers,
    settings,
  };
}

export function exportJson(file: ExportFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** `ts-dojo-progress-2026-10-21.json`, the date where Kim is. */
export function exportFileName(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `ts-dojo-progress-${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
