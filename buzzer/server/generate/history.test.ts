import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GenerateJob, GenerationHistoryEntry } from '../../shared/types.js';
import {
  HISTORY_FILE,
  historyEntry,
  historyTotals,
  noHistory,
  openGenerationHistory,
  parseHistory,
} from './history.js';
import { emptyUsage } from './pricing.js';

const DAY = 24 * 60 * 60 * 1000;
/** 2026-11-03T12:00:00Z. */
const NOON = Date.UTC(2026, 10, 3, 12);
const MIDNIGHT = Date.UTC(2026, 10, 3);

function job(overrides: Partial<GenerateJob> = {}): GenerateJob {
  return {
    id: 'j1',
    kind: 'generate',
    setId: null,
    category: 'Rivers',
    guidance: 'SECRET GUIDANCE',
    levels: [
      { difficulty: 'easy', count: 5 },
      { difficulty: 'hard', count: 10 },
    ],
    questionId: null,
    note: '',
    queuePosition: null,
    replaced: null,
    state: 'done',
    currentLevel: null,
    finished: [
      { difficulty: 'easy', setId: 's1', title: 'Rivers – Easy', questions: 5, count: 5 },
      { difficulty: 'hard', setId: 's2', title: 'Rivers – Hard', questions: 8, count: 10 },
    ],
    short: [],
    usage: { ...emptyUsage(), inputTokens: 900, costUsd: 0.25 },
    error: null,
    startedAt: NOON - 60_000,
    finishedAt: NOON,
    ...overrides,
  };
}

function entry(endedAt: number, costUsd: number): GenerationHistoryEntry {
  return {
    endedAt,
    startedAt: endedAt - 1000,
    kind: 'generate',
    category: 'C',
    levels: [{ difficulty: 'easy', count: 5 }],
    saved: 5,
    costUsd,
    outcome: 'done',
  };
}

describe('historyEntry', () => {
  it('records a done generate: levels asked for, questions saved, cost, no guidance', () => {
    expect(historyEntry(job())).toEqual({
      endedAt: NOON,
      startedAt: NOON - 60_000,
      kind: 'generate',
      category: 'Rivers',
      levels: [
        { difficulty: 'easy', count: 5 },
        { difficulty: 'hard', count: 10 },
      ],
      saved: 13,
      costUsd: 0.25,
      outcome: 'done',
    });
    expect(JSON.stringify(historyEntry(job()))).not.toContain('SECRET');
  });

  it('keeps the error of a failed job only, and the levels saved before it', () => {
    const failed = historyEntry(job({ state: 'failed', error: 'Boom.', finished: [] }));
    expect(failed).toMatchObject({ outcome: 'failed', error: 'Boom.', saved: 0 });
    const cancelled = historyEntry(job({ state: 'cancelled' }))!;
    expect(cancelled.outcome).toBe('cancelled');
    expect(cancelled).not.toHaveProperty('error');
  });

  it('counts a replace as 1 saved when it swapped a question in, and never logs its note', () => {
    const question = { id: 'q1', text: 'Q?', answer: 'A', points: 100 };
    const replace = job({
      kind: 'replace',
      setId: 's1',
      levels: [{ difficulty: 'easy', count: 1 }],
      note: 'SECRET NOTE',
      finished: [],
      replaced: { old: null, new: question },
    });
    expect(historyEntry(replace)).toMatchObject({ kind: 'replace', saved: 1 });
    expect(JSON.stringify(historyEntry(replace))).not.toMatch(/SECRET|setId|questionId/);
    expect(historyEntry({ ...replace, replaced: null, state: 'failed' })!.saved).toBe(0);
  });

  it('logs a free (GENERATE_FAKE) job at cost 0', () => {
    expect(historyEntry(job(), true)!.costUsd).toBe(0);
  });

  it('has no line for a job still queued or running', () => {
    for (const state of ['queued', 'writing', 'checking', 'topping up'] as const) {
      expect(historyEntry(job({ state, finishedAt: null }))).toBeUndefined();
    }
  });

  it('a queued job cancelled at once ends when it was cancelled', () => {
    const at = NOON + 5;
    expect(historyEntry(job({ state: 'cancelled', finishedAt: at, finished: [] }))).toMatchObject({
      endedAt: at,
      saved: 0,
    });
  });
});

describe('historyTotals', () => {
  it('splits spend by the UTC day each job ended', () => {
    const entries = [
      entry(MIDNIGHT, 1), // the first ms of today
      entry(MIDNIGHT - 1, 2), // the last ms of yesterday
      entry(MIDNIGHT - 29 * DAY, 4), // the 30th day back, the first ms
      entry(MIDNIGHT - 29 * DAY - 1, 8), // the 31st day back
      entry(MIDNIGHT - 400 * DAY, 16),
    ];
    // Late in the UTC day, so a rolling 24 hours would not match.
    expect(historyTotals(entries, MIDNIGHT + DAY - 1)).toEqual({
      todayUsd: 1,
      last30DaysUsd: 7,
      allTimeUsd: 31,
      jobs: 5,
    });
    // Just after midnight, yesterday's job is no longer today's.
    expect(historyTotals(entries, MIDNIGHT + DAY).todayUsd).toBe(0);
  });

  it('is all zero for an empty log', () => {
    expect(historyTotals([], NOON)).toEqual({
      todayUsd: 0,
      last30DaysUsd: 0,
      allTimeUsd: 0,
      jobs: 0,
    });
  });
});

describe('parseHistory', () => {
  it('skips and counts lines that are not JSON or not an entry, and ignores blank ones', () => {
    const good = entry(NOON, 1);
    const text = [
      JSON.stringify(good),
      '{"endedAt": 1, "trunc',
      '',
      JSON.stringify({ ...good, outcome: 'exploded' }),
      '   ',
      JSON.stringify({ ...good, costUsd: -1 }),
      '[]',
      JSON.stringify(good),
      '',
    ].join('\n');
    expect(parseHistory(text)).toEqual({ entries: [good, good], corrupt: 4 });
  });
});

describe('openGenerationHistory', () => {
  let dir: string;
  let warnings: string[];
  const warn = (message: string) => warnings.push(message);

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'buzzr-history-'));
    warnings = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads an empty log before the first job', async () => {
    const history = openGenerationHistory(dir, { warn });
    expect(await history.read(50, NOON)).toEqual({
      entries: [],
      totals: { todayUsd: 0, last30DaysUsd: 0, allTimeUsd: 0, jobs: 0 },
    });
    expect(warnings).toEqual([]);
  });

  it('appends one JSON line per ended job and reads them back newest first', async () => {
    const history = openGenerationHistory(dir, { warn });
    await history.record(job({ id: 'a', category: 'A', finishedAt: NOON - 2 * DAY }));
    await history.record(job({ id: 'b', category: 'B', finishedAt: NOON - 1 }));
    await history.record(job({ id: 'c', category: 'C', state: 'writing', finishedAt: null }));
    await history.record(job({ id: 'd', category: 'D', finishedAt: NOON }));
    const text = await readFile(join(dir, HISTORY_FILE), 'utf8');
    const lines = text.trimEnd().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => (JSON.parse(l) as GenerationHistoryEntry).category)).toEqual([
      'A',
      'B',
      'D',
    ]);
    expect(text).not.toContain('SECRET');
    const read = await history.read(50, NOON);
    expect(read.entries.map((e) => e.category)).toEqual(['D', 'B', 'A']);
    expect(read.totals).toEqual({ todayUsd: 0.5, last30DaysUsd: 0.75, allTimeUsd: 0.75, jobs: 3 });
  });

  it('answers the newest `limit` entries, with totals over the whole log', async () => {
    const history = openGenerationHistory(dir, { warn });
    for (const name of ['A', 'B', 'C']) await history.record(job({ category: name }));
    const read = await history.read(2, NOON);
    expect(read.entries.map((e) => e.category)).toEqual(['C', 'B']);
    expect(read.totals.jobs).toBe(3);
  });

  it('keeps the order jobs ended in when records are not awaited, and a read waits for them', async () => {
    const history = openGenerationHistory(dir, { warn });
    void history.record(job({ category: 'A' }));
    void history.record(job({ category: 'B' }));
    const read = await history.read(50, NOON);
    expect(read.entries.map((e) => e.category)).toEqual(['B', 'A']);
  });

  it('skips a corrupt line, counting them in one warning', async () => {
    const good = JSON.stringify(entry(NOON, 1));
    await writeFile(join(dir, HISTORY_FILE), `${good}\nnot json\n{"half":\n${good}\n`);
    const history = openGenerationHistory(dir, { warn });
    const read = await history.read(50, NOON);
    expect(read.entries).toHaveLength(2);
    expect(read.totals.jobs).toBe(2);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/skipped 2 corrupt lines/);
    // A job after a torn line still gets a line of its own.
    await history.record(job());
    expect((await history.read(50, NOON)).entries).toHaveLength(3);
  });

  it('warns on a failed write, never rejects, and writes the next job', async () => {
    let fail = true;
    const written: string[] = [];
    const history = openGenerationHistory(dir, {
      warn,
      fs: {
        appendFile: (_path, data) => {
          if (fail) return Promise.reject(new Error('disk full'));
          written.push(data);
          return Promise.resolve();
        },
        readFile: () => Promise.resolve(written.join('')),
      },
    });
    await expect(history.record(job({ category: 'Lost' }))).resolves.toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(
      /Could not add the generate job to .*generation-history\.jsonl: disk full/,
    );
    fail = false;
    await history.record(job({ category: 'Kept' }));
    expect((await history.read(50, NOON)).entries.map((e) => e.category)).toEqual(['Kept']);
  });

  it('rejects a read that fails for a reason other than a missing file', async () => {
    const history = openGenerationHistory(dir, {
      warn,
      fs: {
        appendFile: () => Promise.resolve(),
        readFile: () => Promise.reject(Object.assign(new Error('EACCES'), { code: 'EACCES' })),
      },
    });
    await expect(history.read(50, NOON)).rejects.toThrow('EACCES');
  });

  it('logs free jobs at cost 0', async () => {
    const history = openGenerationHistory(dir, { warn, free: true });
    await history.record(job());
    expect((await history.read(50, NOON)).totals.allTimeUsd).toBe(0);
  });
});

describe('noHistory', () => {
  it('records nothing and reads an empty log', async () => {
    await noHistory.record(job());
    expect((await noHistory.read(50, NOON)).entries).toEqual([]);
  });
});
