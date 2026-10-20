// The Dexie database `ts-dojo`, version 1 (spec §7 Store): the five tables with the keys §7
// gives them, declared together so a later feature never needs a schema version for a table
// the spec already names. F5 reads and writes `buffers` and `meta` (the `lastBuffer` key);
// F7–F9 fill `lessons`, `exercises` and `attempts` and may refine their row types (Dexie
// indexes only the keys, so a type change needs no version bump). Fields are `declare`d: with
// `useDefineForClassFields` a plain field would shadow the table Dexie sets in `super()`.
import Dexie, { type EntityTable } from 'dexie';

export const DB_NAME = 'ts-dojo';
export const SCHEMA_VERSION = 1;

export type LessonState = 'not-started' | 'in-progress' | 'complete';
export type ExerciseState = 'untouched' | 'in-progress' | 'passed';
export type LayoutMode = 'split' | 'theory' | 'practice';

export interface LessonRow {
  id: string;
  state: LessonState;
  theoryReadAt?: number;
  completedAt?: number;
  lastOpenedAt?: number;
  lastExerciseId?: string;
  layout?: LayoutMode;
  /** Question id → the answer given (§1 Check yourself). */
  questions?: Record<
    string,
    { answerIndex: number; correct: boolean; at: number }
  >;
}

export interface ExerciseRow {
  id: string;
  lessonId: string;
  state: ExerciseState;
  passedAt?: number;
  attemptsToPass?: number;
  hintsUsed: number;
  solutionViewed: boolean;
  /** File name → text, the autosaved working copy. */
  files: Record<string, string>;
  updatedAt: number;
  predictAnswer?: number;
}

/** The §5 groups: whether each passed and how many cases it had. */
export type AttemptGroups = Record<
  'compiles' | 'types' | 'tests' | 'rules',
  { passed: boolean; count: number }
>;

export interface AttemptRow {
  id?: number;
  exerciseId: string;
  at: number;
  passed: boolean;
  groups: AttemptGroups;
  ms: number;
  files: Record<string, string>;
}

/** A `/repl` scratch buffer (§4 "named scratch buffers"). */
export interface BufferRow {
  name: string;
  text: string;
  updatedAt: number;
}

/** `schemaVersion`, `contentVersion`, `lastLessonId`, `importedAt` (§7), plus `lastBuffer` (F5). */
export interface MetaRow {
  key: string;
  value: unknown;
}

export class TsDojoDb extends Dexie {
  declare lessons: EntityTable<LessonRow, 'id'>;
  declare exercises: EntityTable<ExerciseRow, 'id'>;
  declare attempts: EntityTable<AttemptRow, 'id'>;
  declare buffers: EntityTable<BufferRow, 'name'>;
  declare meta: EntityTable<MetaRow, 'key'>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(SCHEMA_VERSION).stores({
      lessons: 'id',
      exercises: 'id',
      attempts: '++id, exerciseId',
      buffers: 'name',
      meta: 'key',
    });
  }
}

let db: TsDojoDb | null = null;

/** The app's one database, opened on first use. */
export function getDb(): TsDojoDb {
  db ??= new TsDojoDb();
  return db;
}
