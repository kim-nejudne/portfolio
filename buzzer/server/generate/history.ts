// The generation history (F127): one JSON line per ended job (done, failed or cancelled) in
// `DATA_DIR/generation-history.jsonl`, so the admin can see what was generated and what it cost
// after a restart has forgotten the jobs. A line holds what was asked for, what was saved, the cost
// and the outcome; never the guidance, a replace's note or a key. Writing is best effort: a failed
// append logs a warning and the job ends as it would have. Reading skips a corrupt line, counting
// them in one warning, so one bad line never hides the rest.

import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generationHistoryEntrySchema } from '../../shared/schemas.js';
import type {
  AdminHistoryResponse,
  GenerateJob,
  GenerationHistoryEntry,
  GenerationHistoryTotals,
} from '../../shared/types.js';

export const HISTORY_FILE = 'generation-history.jsonl';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Today and the 29 days before it. */
const LAST_DAYS = 30;

export interface HistoryFs {
  appendFile: (path: string, data: string) => Promise<void>;
  /** Rejects with code ENOENT when the file is missing. */
  readFile: (path: string) => Promise<string>;
}

const nodeFs: HistoryFs = {
  appendFile: (path, data) => appendFile(path, data, 'utf8'),
  readFile: (path) => readFile(path, 'utf8'),
};

export interface GenerationHistory {
  /** Appends the ended job's line. Never rejects: a failure is a warning. */
  record(job: GenerateJob): Promise<void>;
  /** The newest `limit` entries first, and totals over the whole log, today by `now`'s UTC day. */
  read(limit: number, now: number): Promise<AdminHistoryResponse>;
}

export interface GenerationHistoryOptions {
  fs?: HistoryFs;
  warn?: (message: string) => void;
  /** `GENERATE_FAKE=1`: the fake generator spends nothing, so its jobs are logged at cost 0. */
  free?: boolean;
}

/** The ended job's line. Undefined while the job is still queued or running. */
export function historyEntry(job: GenerateJob, free = false): GenerationHistoryEntry | undefined {
  const { state } = job;
  if (state !== 'done' && state !== 'failed' && state !== 'cancelled') return undefined;
  const saved =
    job.kind === 'replace'
      ? job.replaced
        ? 1
        : 0
      : job.finished.reduce((sum, level) => sum + level.questions, 0);
  return {
    endedAt: job.finishedAt ?? job.startedAt,
    startedAt: job.startedAt,
    kind: job.kind,
    category: job.category,
    levels: job.levels.map(({ difficulty, count }) => ({ difficulty, count })),
    saved,
    costUsd: free ? 0 : job.usage.costUsd,
    outcome: state,
    ...(state === 'failed' && job.error ? { error: job.error } : {}),
  };
}

/** Spend today, over today and the 29 UTC days before, and in all; by the day each job ended. */
export function historyTotals(
  entries: readonly GenerationHistoryEntry[],
  now: number,
): GenerationHistoryTotals {
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  const tomorrow = today + DAY_MS;
  const from = today - (LAST_DAYS - 1) * DAY_MS;
  const totals: GenerationHistoryTotals = {
    todayUsd: 0,
    last30DaysUsd: 0,
    allTimeUsd: 0,
    jobs: entries.length,
  };
  for (const { endedAt, costUsd } of entries) {
    totals.allTimeUsd += costUsd;
    if (endedAt >= from && endedAt < tomorrow) totals.last30DaysUsd += costUsd;
    if (endedAt >= today && endedAt < tomorrow) totals.todayUsd += costUsd;
  }
  return totals;
}

/** The log's entries in file order (oldest first), and how many lines were corrupt. */
export function parseHistory(text: string): {
  entries: GenerationHistoryEntry[];
  corrupt: number;
} {
  const entries: GenerationHistoryEntry[] = [];
  let corrupt = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      corrupt++;
      continue;
    }
    const parsed = generationHistoryEntrySchema.safeParse(json);
    if (parsed.success) entries.push(parsed.data);
    else corrupt++;
  }
  return { entries, corrupt };
}

function isMissing(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === 'ENOENT';
}

/** The log in `dir`, which the built-in store has already created. The file is made on first write. */
export function openGenerationHistory(
  dir: string,
  {
    fs = nodeFs,
    warn = (message) => console.warn(message),
    free = false,
  }: GenerationHistoryOptions = {},
): GenerationHistory {
  const path = join(dir, HISTORY_FILE);
  // Appends run one at a time, in the order jobs ended, and a read waits for those before it.
  let pending: Promise<void> = Promise.resolve();

  return {
    record(job) {
      const entry = historyEntry(job, free);
      if (!entry) return pending;
      pending = pending.then(async () => {
        try {
          await fs.appendFile(path, `${JSON.stringify(entry)}\n`);
        } catch (err) {
          warn(`Could not add the ${job.kind} job to ${path}: ${(err as Error).message}`);
        }
      });
      return pending;
    },
    async read(limit, now) {
      await pending;
      let text = '';
      try {
        text = await fs.readFile(path);
      } catch (err) {
        if (!isMissing(err)) throw err;
      }
      const { entries, corrupt } = parseHistory(text);
      if (corrupt > 0) {
        warn(`${path}: skipped ${corrupt} corrupt ${corrupt === 1 ? 'line' : 'lines'}.`);
      }
      return {
        entries: entries.slice(-limit).reverse(),
        totals: historyTotals(entries, now),
      };
    },
  };
}

/** No log at all, for an app built without one (tests, or no data folder wired in). */
export const noHistory: GenerationHistory = {
  record: () => Promise.resolve(),
  read: (_limit, now) => Promise.resolve({ entries: [], totals: historyTotals([], now) }),
};
