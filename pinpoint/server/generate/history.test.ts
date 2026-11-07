import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_TEXT_MAX } from '#shared/constants.js';
import type { GenerationHistoryEntry } from '#shared/types.js';
import { HISTORY_FILE, historyTotals, openGenerationHistory, parseHistory } from './history.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 8, 15, 0);
const TODAY = Date.UTC(2026, 10, 8);

function entry(over: Partial<GenerationHistoryEntry> = {}): GenerationHistoryEntry {
  return {
    startedAt: NOW - 60_000,
    endedAt: NOW,
    kind: 'generate',
    categoryId: 'japan',
    category: 'Japan',
    levels: ['easy'],
    saved: { city: 15, landmark: 12 },
    dropped: [{ reason: 'Not a city', count: 2 }],
    costUsd: 0.25,
    outcome: 'done',
    ...over,
  };
}

describe('generation history', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pinpoint-history-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('appends one JSON line per ended job, making the folder, and reads them newest first', async () => {
    const dataDir = join(dir, 'data');
    const history = openGenerationHistory(dataDir);
    const first = entry({ category: 'First' });
    const second = entry({ category: 'Second', outcome: 'failed', error: 'Wikidata is down.' });
    const third = entry({ category: 'Third', kind: 'add', outcome: 'cancelled' });
    void history.record(first);
    void history.record(second);
    await history.record(third);

    const lines = (await readFile(join(dataDir, HISTORY_FILE), 'utf8')).trimEnd().split('\n');
    expect(lines.map((l) => JSON.parse(l) as GenerationHistoryEntry)).toEqual([
      first,
      second,
      third,
    ]);

    const read = await history.read(2, NOW);
    expect(read.entries.map((e) => e.category)).toEqual(['Third', 'Second']);
    expect(read.totals.jobs).toBe(3);
    expect((await history.read(0, NOW)).entries).toEqual([]);
  });

  it('reads a missing file as empty', async () => {
    const read = await openGenerationHistory(dir).read(50, NOW);
    expect(read).toEqual({
      entries: [],
      totals: { todayUsd: 0, last30DaysUsd: 0, allTimeUsd: 0, jobs: 0 },
    });
  });

  it('trims long drop reasons and errors so every line reads back', async () => {
    const history = openGenerationHistory(dir);
    const long = 'x'.repeat(HISTORY_TEXT_MAX + 50);
    await history.record(
      entry({ dropped: [{ reason: long, count: 1 }], error: long, outcome: 'failed' }),
    );
    const [read] = (await history.read(1, NOW)).entries;
    expect(read!.dropped[0]!.reason).toHaveLength(HISTORY_TEXT_MAX);
    expect(read!.error).toHaveLength(HISTORY_TEXT_MAX);
  });

  it('skips corrupt lines with one warning', async () => {
    const good = entry();
    await writeFile(
      join(dir, HISTORY_FILE),
      `${JSON.stringify(good)}\nnot json\n${JSON.stringify({ ...good, costUsd: -1 })}\n\n`,
    );
    const warn = vi.fn();
    const read = await openGenerationHistory(dir, { warn }).read(10, NOW);
    expect(read.entries).toEqual([good]);
    expect(warn).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/skipped 2 corrupt lines/));
  });

  it('warns and carries on when an append fails', async () => {
    const warn = vi.fn();
    const history = openGenerationHistory(dir, {
      warn,
      fs: {
        appendFile: () => Promise.reject(new Error('EACCES')),
        readFile: () => Promise.resolve(''),
      },
    });
    await expect(history.record(entry())).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/Could not add the generate job.*EACCES/),
    );
  });
});

describe('historyTotals', () => {
  it('sums today, today and the 29 days before, and all time, by the UTC day a job ended', () => {
    const totals = historyTotals(
      [
        entry({ endedAt: TODAY, costUsd: 1 }), // midnight today
        entry({ endedAt: TODAY - 1, costUsd: 2 }), // a millisecond before: yesterday
        entry({ endedAt: TODAY - 29 * DAY, costUsd: 4 }), // the 30th day back
        entry({ endedAt: TODAY - 29 * DAY - 1, costUsd: 8 }), // past it
        entry({ endedAt: TODAY + DAY, costUsd: 16 }), // tomorrow (a clock change): all time only
      ],
      NOW,
    );
    expect(totals).toEqual({ todayUsd: 1, last30DaysUsd: 7, allTimeUsd: 31, jobs: 5 });
  });

  it('parses an empty log', () => {
    expect(parseHistory('')).toEqual({ entries: [], corrupt: 0 });
  });
});
