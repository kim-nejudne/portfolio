// The generation history and the monthly cap (F84; spec: Admin, Generation spend). Ported and
// adapted from Buzzr (buzzer/server/generate/history.ts): one JSON file, `DATA_DIR/generation-
// history.json`, rewritten whole and atomically (temp file, flush, rename, as categories.json is)
// instead of Buzzr's appended lines, and a cap per UTC calendar month instead of daily limits.
//
// An entry holds the title, the number asked for, the words the checker kept, the cost and the
// times; never a drafted word. The file is read once at start and kept in memory, so the cap is
// checked without touching the disk. A failed write keeps the entry in memory (it still counts
// against the cap) and the next write carries it. A file that can't be read or parsed is never
// written over: generation is paused, saying why, until it is fixed or removed and the server
// restarts. The game itself never depends on this file.

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { formatUsd, GENERATION_CAP_VAR, GENERATION_HISTORY_SHOWN } from '../../shared/constants.js';
import type {
  AdminGenerationJob,
  AdminGenerationSpend,
  GenerationHistoryEntry,
} from '../../shared/types.js';
import type { RequestUsage } from './generator.js';
import { usageCostUsd } from './pricing.js';

export const HISTORY_FILE = 'generation-history.json';

const time = z.number().int().nonnegative();

const entrySchema = z.strictObject({
  id: z.string().min(1).max(64),
  kind: z.enum(['new', 'more']),
  title: z.string().max(200),
  count: z.number().int().nonnegative(),
  kept: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative().finite(),
  startedAt: time,
  endedAt: time,
  outcome: z.enum(['ready', 'failed']),
}) satisfies z.ZodType<GenerationHistoryEntry>;

const fileSchema = z.strictObject({
  version: z.literal(1),
  entries: z.array(entrySchema),
});

/** The file system calls the history makes. Tests swap one to fail a write. */
export interface HistoryFs {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, data: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  mkdir: (path: string) => Promise<unknown>;
  /** Removes a file, and does nothing when it is missing. */
  remove: (path: string) => Promise<void>;
}

const nodeFs: HistoryFs = {
  readFile: (path) => readFile(path, 'utf8'),
  // `flush` fsyncs the bytes before the rename makes them the file.
  writeFile: (path, data) => writeFile(path, data, { encoding: 'utf8', flush: true }),
  rename,
  mkdir: (path) => mkdir(path, { recursive: true }),
  remove: (path) => rm(path, { force: true }),
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** The start of `now`'s UTC calendar month, and of the next one. */
export function utcMonth(now: number): { start: number; end: number } {
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return { start: Date.UTC(year, month, 1), end: Date.UTC(year, month + 1, 1) };
}

/** Spend in `now`'s UTC calendar month, by the time each generation ended, and in all. */
export function spendTotals(
  entries: readonly GenerationHistoryEntry[],
  now: number,
): { monthUsd: number; allTimeUsd: number } {
  const { start, end } = utcMonth(now);
  let monthUsd = 0;
  let allTimeUsd = 0;
  for (const { endedAt, costUsd } of entries) {
    allTimeUsd += costUsd;
    if (endedAt >= start && endedAt < end) monthUsd += costUsd;
  }
  return { monthUsd, allTimeUsd };
}

/**
 * Why a generation can't start now, or null. A generation's cost is only known once it ends, so a
 * start is refused once the month's spend has reached the cap; the last one under it may end a
 * little past it.
 */
// SPEC-QUESTION: the spec says a start "past the cap" is refused; a cost is only known at the end,
// so a start is refused once the month has reached the cap, and a generation counts in the UTC
// month it ended in (DECISIONS 110).
export function capRefusal(monthUsd: number, capUsd: number, now: number): string | null {
  if (monthUsd < capUsd) return null;
  const next = new Date(utcMonth(now).end);
  return (
    `This month’s generation spend is ${formatUsd(monthUsd)}, and the cap is ` +
    `${formatUsd(capUsd)} (${GENERATION_CAP_VAR}). Generation opens again on ` +
    `1 ${MONTHS[next.getUTCMonth()]} (UTC).`
  );
}

/** The ended job's entry: its cost priced from every request it made. */
export function historyEntry(
  job: AdminGenerationJob,
  usage: readonly RequestUsage[],
  endedAt: number,
): GenerationHistoryEntry {
  return {
    id: job.id,
    kind: job.kind,
    title: job.title,
    count: job.count,
    kept: job.status === 'ready' ? (job.draft?.words.length ?? 0) : 0,
    costUsd: usageCostUsd(usage),
    startedAt: job.startedAt,
    endedAt,
    outcome: job.status === 'ready' ? 'ready' : 'failed',
  };
}

export interface GenerationHistory {
  /** `DATA_DIR/generation-history.json`. */
  readonly path: string;
  /** Adds an ended job and writes the file. Never rejects: a failed write is a warning. */
  record(job: AdminGenerationJob, usage: readonly RequestUsage[], endedAt: number): Promise<void>;
  /** The tiles, the newest entries and the cap, as of `now`. */
  spend(now: number): AdminGenerationSpend;
  /** Why a generation can't start now (the cap, or a file that can't be read), or null. */
  refusal(now: number): string | null;
}

export interface OpenGenerationHistoryOptions {
  capUsd: number;
  fs?: HistoryFs;
  warn?: (message: string) => void;
}

function isMissing(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === 'ENOENT';
}

/** Why the file can't be used, never quoting its contents. */
function readProblem(text: string): { entries: GenerationHistoryEntry[] } | { problem: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { problem: 'it is not valid JSON' };
  }
  const parsed = fileSchema.safeParse(json);
  if (!parsed.success) {
    const where = parsed.error.issues[0]?.path.join('.') || '(file)';
    return { problem: `it is not a valid history (${where})` };
  }
  return { entries: parsed.data.entries };
}

// SPEC-QUESTION: the spec doesn't say what an unreadable history does; generation pauses rather
// than starting a fresh file that would forget the month's spend (DECISIONS 110).
/**
 * Opens `<dir>/generation-history.json`. A missing file is an empty history, made on the first
 * write. One that can't be read or parsed pauses generation and is left as it is.
 */
export async function openGenerationHistory(
  dir: string,
  { capUsd, fs = nodeFs, warn = (message) => console.warn(message) }: OpenGenerationHistoryOptions,
): Promise<GenerationHistory> {
  const path = join(dir, HISTORY_FILE);
  let entries: GenerationHistoryEntry[] = [];
  let paused: string | null = null;

  let text: string | null = null;
  try {
    text = await fs.readFile(path);
  } catch (err) {
    if (!isMissing(err)) {
      const code = (err as NodeJS.ErrnoException).code ?? 'an error';
      paused = `it can't be read (${code})`;
    }
  }
  if (text !== null) {
    const read = readProblem(text);
    if ('problem' in read) paused = read.problem;
    else entries = read.entries;
  }
  const pausedMessage =
    paused === null
      ? null
      : `Generation is paused: ${path} can't be used, because ${paused}. Fix or remove the file, then restart the server.`;
  if (pausedMessage !== null) warn(pausedMessage);

  let temps = 0;
  // Writes run one at a time, each writing every entry held when it runs.
  let pending: Promise<void> = Promise.resolve();

  async function save(): Promise<void> {
    const temp = `${path}.${process.pid}-${++temps}.tmp`;
    try {
      await fs.mkdir(dir);
      await fs.writeFile(temp, `${JSON.stringify({ version: 1, entries }, null, 2)}\n`);
      await fs.rename(temp, path);
    } catch (err) {
      await fs.remove(temp).catch(() => undefined);
      const code = (err as NodeJS.ErrnoException).code ?? 'an error';
      warn(
        `Could not write ${path} (${code}). The generation still counts against the cap, and the next write tries again.`,
      );
    }
  }

  const refusal = (now: number) =>
    pausedMessage ?? capRefusal(spendTotals(entries, now).monthUsd, capUsd, now);

  return {
    path,

    record(job, usage, endedAt) {
      // Never write over a file that couldn't be read: it may hold the month's spend.
      if (pausedMessage !== null) return pending;
      entries = [...entries, historyEntry(job, usage, endedAt)];
      pending = pending.then(save);
      return pending;
    },

    spend(now) {
      const { monthUsd, allTimeUsd } = spendTotals(entries, now);
      return {
        capUsd,
        monthUsd,
        allTimeUsd,
        last: entries.at(-1) ?? null,
        history: entries.slice(-GENERATION_HISTORY_SHOWN).reverse(),
        total: entries.length,
        refused: refusal(now),
      };
    },

    refusal,
  };
}

/** No history and no spend, for an admin built without one (tests): the default cap, nothing spent. */
export function noHistory(capUsd: number): GenerationHistory {
  return {
    path: '',
    record: () => Promise.resolve(),
    spend: (now) => ({
      capUsd,
      monthUsd: 0,
      allTimeUsd: 0,
      last: null,
      history: [],
      total: 0,
      refused: capRefusal(0, capUsd, now),
    }),
    refusal: (now) => capRefusal(0, capUsd, now),
  };
}
