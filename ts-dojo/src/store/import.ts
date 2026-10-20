// The §7 import: "Import on `/progress` reads a file, shows what it would change (lessons,
// exercises, attempts, buffers, settings) and applies on confirmation. Rows merge by id and the
// newer `updatedAt` wins; attempts append; a passed exercise never becomes unpassed."
//
// - `parseImportFile` checks the text against the export shape (export.ts) with zod; a file
//   that is not JSON, has another shape or a newer `schemaVersion` is refused whole.
// - The renames (`renames.yaml`) are applied to the file's ids first, so an export from before
//   a rename lands on today's ids, the same way the store's own rows moved (content-update.ts).
// - `planImport` is the preview, read only; `applyImport` recomputes the same merge inside one
//   transaction, so a change made between the two is never overwritten by a stale plan.
// - Attempts append under new keys; one the store already has (same exercise, time and kind)
//   is skipped, so importing a file twice adds nothing; then each exercise keeps its newest
//   ATTEMPTS_KEPT by time (§7 "pruned on write").
// - Settings go through `parseSettings` and are written only when a value differs.
import { z } from 'zod';
import type { Rename } from '@/content/build-registry';
import { formatZodError } from '@/content/schema';
import { lessonOfExercise, renameId } from './content-update';
import {
  SCHEMA_VERSION,
  type AttemptRow,
  type BufferRow,
  type ExerciseRow,
  type LessonRow,
  type TsDojoDb,
} from './db';
import type { ExportFile, ExportedAttempt } from './export';
import { mergeBuffer, mergeExercise, mergeLesson } from './merge';
import { ATTEMPTS_KEPT } from './progress';
import {
  LAYOUT_MODES,
  parseSettings,
  writeSettings as writeStoredSettings,
  type Settings,
} from './settings';

export const IMPORTED_AT_KEY = 'importedAt';

const time = z.number().finite();
const count = z.number().int().nonnegative();
const files = z.record(z.string(), z.string());

const lessonRow = z.object({
  id: z.string().min(1),
  state: z.enum(['not-started', 'in-progress', 'complete']),
  theoryReadAt: time.exactOptional(),
  completedAt: time.exactOptional(),
  lastOpenedAt: time.exactOptional(),
  lastExerciseId: z.string().exactOptional(),
  layout: z.enum(LAYOUT_MODES).exactOptional(),
  questions: z
    .record(
      z.string(),
      z.object({ answerIndex: count, correct: z.boolean(), at: time }),
    )
    .exactOptional(),
});

const exerciseRow = z.object({
  id: z.string().min(1),
  lessonId: z.string().min(1),
  state: z.enum(['untouched', 'in-progress', 'passed']),
  passedAt: time.exactOptional(),
  attemptsToPass: count.exactOptional(),
  hintsUsed: count,
  solutionViewed: z.boolean(),
  files,
  updatedAt: time,
  predictAnswer: count.exactOptional(),
});

const group = z.object({ passed: z.boolean(), count });

const attemptRow = z.object({
  exerciseId: z.string().min(1),
  kind: z.enum(['run', 'test']).exactOptional(),
  at: time,
  passed: z.boolean(),
  groups: z.object({
    compiles: group,
    types: group,
    tests: group,
    rules: group,
  }),
  ms: z.number().nonnegative(),
  files,
});

const bufferRow = z.object({
  name: z.string().min(1),
  text: z.string(),
  updatedAt: time,
});

export const importFileSchema = z.object({
  schemaVersion: z.number().int().positive(),
  contentVersion: z.string(),
  exportedAt: z.string(),
  lessons: z.array(lessonRow),
  exercises: z.array(exerciseRow),
  attempts: z.array(attemptRow),
  buffers: z.array(bufferRow),
  settings: z.unknown(),
});

export type ImportFile = Omit<ExportFile, 'settings'> & { settings: unknown };

export type ParsedImport =
  { ok: true; file: ImportFile } | { ok: false; error: string };

export function parseImportFile(text: string): ParsedImport {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not a JSON file' };
  }
  const version =
    typeof json === 'object' && json !== null
      ? (json as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  if (typeof version === 'number' && version > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `made by a newer ts-dojo (schema ${String(version)}); this one reads schema ${String(SCHEMA_VERSION)}`,
    };
  }
  const parsed = importFileSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: `not a ts-dojo progress file: ${formatZodError(parsed.error)}`,
    };
  }
  return { ok: true, file: parsed.data };
}

export interface ImportOptions {
  renames: readonly Rename[];
  /** The app's `contentVersion`, to note a file from other content. */
  contentVersion: string;
  /** The settings now in force. */
  settings: Settings;
}

export interface RowChanges {
  added: string[];
  updated: string[];
  unchanged: number;
}

export interface ImportPlan {
  /** The file with the renames applied; what `applyImport` takes. */
  file: ImportFile;
  lessons: RowChanges;
  exercises: RowChanges & { newlyPassed: string[] };
  attempts: { appended: number; skipped: number };
  buffers: RowChanges;
  settings: { changed: (keyof Settings)[] };
  contentVersion: { file: string; app: string; matches: boolean };
}

/** The file's ids after the renames; rows that land on one id are merged. */
export function renameImport(
  file: ImportFile,
  renames: readonly Rename[],
): ImportFile {
  if (renames.length === 0) return file;
  const rename = (id: string): string => renameId(id, renames);
  const lessons = new Map<string, LessonRow>();
  for (const row of file.lessons) {
    const moved: LessonRow = { ...row, id: rename(row.id) };
    if (row.lastExerciseId !== undefined) {
      moved.lastExerciseId = rename(row.lastExerciseId);
    }
    const seen = lessons.get(moved.id);
    lessons.set(
      moved.id,
      seen === undefined ? moved : mergeLesson(seen, moved),
    );
  }
  const exercises = new Map<string, ExerciseRow>();
  for (const row of file.exercises) {
    const id = rename(row.id);
    const moved = { ...row, id, lessonId: lessonOfExercise(id) };
    const seen = exercises.get(id);
    exercises.set(id, seen === undefined ? moved : mergeExercise(seen, moved));
  }
  return {
    ...file,
    lessons: [...lessons.values()],
    exercises: [...exercises.values()],
    attempts: file.attempts.map((row) => ({
      ...row,
      exerciseId: rename(row.exerciseId),
    })),
  };
}

/** Key order does not matter: Dexie hands back structured clones. */
function sameRow(a: unknown, b: unknown): boolean {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
      );
    }
    return value;
  };
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}

function attemptKey(row: Pick<AttemptRow, 'exerciseId' | 'at' | 'kind'>) {
  return `${row.exerciseId}\u0000${String(row.at)}\u0000${row.kind ?? ''}`;
}

interface Merged<T> {
  changes: RowChanges;
  writes: T[];
}

async function mergeRows<T>(
  incoming: readonly T[],
  keyOf: (row: T) => string,
  current: (keys: string[]) => Promise<(T | undefined)[]>,
  merge: (current: T, incoming: T) => T,
): Promise<Merged<T>> {
  const keys = incoming.map(keyOf);
  const existing = await current(keys);
  const changes: RowChanges = { added: [], updated: [], unchanged: 0 };
  const writes: T[] = [];
  incoming.forEach((row, i) => {
    const mine = existing[i];
    const key = keys[i] as string;
    if (mine === undefined) {
      changes.added.push(key);
      writes.push(row);
      return;
    }
    const merged = merge(mine, row);
    if (sameRow(merged, mine)) {
      changes.unchanged += 1;
    } else {
      changes.updated.push(key);
      writes.push(merged);
    }
  });
  return { changes, writes };
}

interface Computed {
  plan: ImportPlan;
  lessons: LessonRow[];
  exercises: ExerciseRow[];
  buffers: BufferRow[];
  attempts: ExportedAttempt[];
  settings: Settings;
}

async function compute(
  db: TsDojoDb,
  raw: ImportFile,
  options: ImportOptions,
): Promise<Computed> {
  const file = renameImport(raw, options.renames);
  const lessons = await mergeRows(
    file.lessons,
    (row) => row.id,
    (keys) => db.lessons.bulkGet(keys),
    mergeLesson,
  );
  const currentExercises = new Map(
    (await db.exercises.bulkGet(file.exercises.map((row) => row.id))).flatMap(
      (row) => (row === undefined ? [] : [[row.id, row] as const]),
    ),
  );
  const exercises = await mergeRows(
    file.exercises,
    (row) => row.id,
    (keys) => Promise.resolve(keys.map((key) => currentExercises.get(key))),
    mergeExercise,
  );
  const newlyPassed = exercises.writes
    .filter(
      (row) =>
        row.state === 'passed' &&
        currentExercises.get(row.id)?.state !== 'passed',
    )
    .map((row) => row.id);
  const buffers = await mergeRows(
    file.buffers,
    (row) => row.name,
    (keys) => db.buffers.bulkGet(keys),
    mergeBuffer,
  );

  const exerciseIds = [...new Set(file.attempts.map((a) => a.exerciseId))];
  const known = new Set(
    (await db.attempts.where('exerciseId').anyOf(exerciseIds).toArray()).map(
      attemptKey,
    ),
  );
  const attempts: ExportedAttempt[] = [];
  let skipped = 0;
  for (const row of file.attempts) {
    const key = attemptKey(row);
    if (known.has(key)) {
      skipped += 1;
      continue;
    }
    known.add(key);
    attempts.push(row);
  }

  const settings = parseSettings(file.settings);
  const changed = (Object.keys(settings) as (keyof Settings)[]).filter(
    (key) => settings[key] !== options.settings[key],
  );

  return {
    plan: {
      file,
      lessons: lessons.changes,
      exercises: { ...exercises.changes, newlyPassed },
      attempts: { appended: attempts.length, skipped },
      buffers: buffers.changes,
      settings: { changed },
      contentVersion: {
        file: file.contentVersion,
        app: options.contentVersion,
        matches: file.contentVersion === options.contentVersion,
      },
    },
    lessons: lessons.writes,
    exercises: exercises.writes,
    buffers: buffers.writes,
    attempts,
    settings: changed.length > 0 ? settings : {},
  };
}

/** What the file would change; writes nothing. */
export async function planImport(
  db: TsDojoDb,
  file: ImportFile,
  options: ImportOptions,
): Promise<ImportPlan> {
  return (
    await db.transaction(
      'r',
      [db.lessons, db.exercises, db.attempts, db.buffers],
      () => compute(db, file, options),
    )
  ).plan;
}

export interface ApplyOptions extends ImportOptions {
  /** Where the settings go; the app's own store by default. */
  writeSettings?: (settings: Settings) => void;
  now?: number;
}

export async function applyImport(
  db: TsDojoDb,
  file: ImportFile,
  options: ApplyOptions,
): Promise<ImportPlan> {
  const computed = await db.transaction(
    'rw',
    [db.lessons, db.exercises, db.attempts, db.buffers, db.meta],
    async () => {
      const result = await compute(db, file, options);
      await db.lessons.bulkPut(result.lessons);
      await db.exercises.bulkPut(result.exercises);
      await db.buffers.bulkPut(result.buffers);
      if (result.attempts.length > 0) {
        await db.attempts.bulkAdd(result.attempts);
      }
      // §7 "rows beyond the newest 20 per exercise are pruned on write", by time.
      for (const exerciseId of new Set(
        result.attempts.map((a) => a.exerciseId),
      )) {
        const rows = await db.attempts
          .where('exerciseId')
          .equals(exerciseId)
          .toArray();
        const excess = rows
          .sort((a, b) => b.at - a.at || (b.id ?? 0) - (a.id ?? 0))
          .slice(ATTEMPTS_KEPT)
          .flatMap((row) => (row.id === undefined ? [] : [row.id]));
        if (excess.length > 0) await db.attempts.bulkDelete(excess);
      }
      await db.meta.put({
        key: IMPORTED_AT_KEY,
        value: options.now ?? Date.now(),
      });
      return result;
    },
  );
  if (computed.plan.settings.changed.length > 0) {
    (options.writeSettings ?? ((s) => void writeStoredSettings(s)))(
      computed.settings,
    );
  }
  return computed.plan;
}
