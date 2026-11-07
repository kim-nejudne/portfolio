// The generation history (spec: Generation history `/admin/history`). Ported from Buzzr
// (buzzer/server/generate/history.ts): one JSON line per ended job (done, failed or cancelled) in
// `DATA_DIR/generation-history.jsonl`. Jobs arrive with F42, so `record` takes the finished entry;
// it never holds guidance, a note, a key or a place. Writing is best effort: a failed append logs a
// warning and the job ends as it would have. Reading skips a corrupt line, counting them in one
// warning, so one bad line never hides the rest.

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HISTORY_TEXT_MAX } from '#shared/constants.js';
import { generationHistoryEntrySchema } from '#shared/schemas.js';
import type { GenerationHistoryEntry, GenerationHistoryTotals } from '#shared/types.js';

export const HISTORY_FILE = 'generation-history.jsonl';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Today and the 29 days before it. */
const LAST_DAYS = 30;

export interface HistoryFs {
  appendFile: (path: string, data: string) => Promise<void>;
  /** Rejects with code ENOENT when the file is missing. */
  readFile: (path: string) => Promise<string>;
}

function nodeFs(dir: string): HistoryFs {
  return {
    appendFile: async (path, data) => {
      await mkdir(dir, { recursive: true });
      await appendFile(path, data, 'utf8');
    },
    readFile: (path) => readFile(path, 'utf8'),
  };
}

export interface GenerationHistory {
  /** Appends the ended job's line. Never rejects: a failure is a warning. */
  record(entry: GenerationHistoryEntry): Promise<void>;
  /** The newest `limit` entries first, and totals over the whole log, today by `now`'s UTC day. */
  read(
    limit: number,
    now: number,
  ): Promise<{ entries: GenerationHistoryEntry[]; totals: GenerationHistoryTotals }>;
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

/** The line as written: long texts trimmed, so it always reads back. */
function line(entry: GenerationHistoryEntry): string {
  const cut = (text: string) => text.slice(0, HISTORY_TEXT_MAX);
  const trimmed: GenerationHistoryEntry = {
    ...entry,
    dropped: entry.dropped.map(({ reason, count }) => ({ reason: cut(reason), count })),
    ...(entry.error === undefined ? {} : { error: cut(entry.error) }),
  };
  return `${JSON.stringify(trimmed)}\n`;
}

function isMissing(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === 'ENOENT';
}

export interface GenerationHistoryOptions {
  fs?: HistoryFs;
  warn?: (message: string) => void;
}

/** The log in `dir` (DATA_DIR). The folder and file are made on the first write. */
export function openGenerationHistory(
  dir: string,
  { fs = nodeFs(dir), warn = (message) => console.warn(message) }: GenerationHistoryOptions = {},
): GenerationHistory {
  const path = join(dir, HISTORY_FILE);
  // Appends run one at a time, in the order jobs ended, and a read waits for those before it.
  let pending: Promise<void> = Promise.resolve();

  return {
    record(entry) {
      pending = pending.then(async () => {
        try {
          await fs.appendFile(path, line(entry));
        } catch (err) {
          warn(`Could not add the ${entry.kind} job to ${path}: ${(err as Error).message}`);
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
        entries: entries.slice(Math.max(0, entries.length - limit)).reverse(),
        totals: historyTotals(entries, now),
      };
    },
  };
}
