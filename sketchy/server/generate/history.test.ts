// The generation history and the monthly cap (F84): entries priced and written atomically to
// DATA_DIR/generation-history.json, read back after a restart, spend by UTC calendar month, the
// cap refusing a start with the month's spend and the cap, and a file that can't be read paused
// rather than written over.
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GENERATION_HISTORY_SHOWN } from '../../shared/constants.js';
import type { AdminGenerationJob, GenerationHistoryEntry } from '../../shared/types.js';
import type { RequestUsage } from './generator.js';
import {
  capRefusal,
  HISTORY_FILE,
  type HistoryFs,
  historyEntry,
  noHistory,
  openGenerationHistory,
  spendTotals,
  utcMonth,
} from './history.js';

const NOV_3 = Date.UTC(2026, 10, 3, 12);
const OCT_LAST_MS = Date.UTC(2026, 10, 1) - 1;
const NOV_FIRST_MS = Date.UTC(2026, 10, 1);

const job = (over: Partial<AdminGenerationJob> = {}): AdminGenerationJob => ({
  id: 'j1',
  kind: 'new',
  title: 'Kitchen',
  categoryId: null,
  count: 40,
  status: 'ready',
  stage: null,
  error: null,
  startedAt: NOV_3 - 60_000,
  draft: {
    emoji: '🍳',
    words: [
      { word: 'kettle', alt: [], difficulty: 1 },
      { word: 'frying pan', alt: ['skillet'], difficulty: 2 },
    ],
  },
  ...over,
});

/** $1.00 of Sonnet output: 100 000 tokens at $10 per million. */
const DOLLAR: RequestUsage[] = [
  {
    model: 'claude-sonnet-5-5',
    inputTokens: 0,
    outputTokens: 100_000,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
];

const entry = (endedAt: number, costUsd: number): GenerationHistoryEntry => ({
  id: `e${endedAt}`,
  kind: 'new',
  title: 'T',
  count: 40,
  kept: 30,
  costUsd,
  startedAt: endedAt,
  endedAt,
  outcome: 'ready',
});

let dir: string;
let warnings: string[];
const warn = (m: string) => warnings.push(m);

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sketchy-history-'));
  warnings = [];
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('UTC months', () => {
  it('a month runs from its first UTC midnight to the next month’s', () => {
    expect(utcMonth(NOV_3)).toEqual({ start: NOV_FIRST_MS, end: Date.UTC(2026, 11, 1) });
    // December rolls into the next year.
    expect(utcMonth(Date.UTC(2026, 11, 31, 23, 59))).toEqual({
      start: Date.UTC(2026, 11, 1),
      end: Date.UTC(2027, 0, 1),
    });
    // The last millisecond of October is October, whatever the server's time zone.
    expect(utcMonth(OCT_LAST_MS).start).toBe(Date.UTC(2026, 9, 1));
  });

  it('spend rolls over at UTC midnight on the 1st: last month counts in all time only', () => {
    const entries = [entry(OCT_LAST_MS, 4), entry(NOV_FIRST_MS, 0.5), entry(NOV_3, 0.25)];
    expect(spendTotals(entries, NOV_3)).toEqual({ monthUsd: 0.75, allTimeUsd: 4.75 });
    expect(spendTotals(entries, OCT_LAST_MS)).toEqual({ monthUsd: 4, allTimeUsd: 4.75 });
    // A month with nothing spent yet.
    expect(spendTotals(entries, Date.UTC(2026, 11, 1)).monthUsd).toBe(0);
  });
});

describe('the cap', () => {
  it('lets a start through under the cap, and refuses it once the month reaches it', () => {
    expect(capRefusal(4.99, 5, NOV_3)).toBeNull();
    expect(capRefusal(5, 5, NOV_3)).toBe(
      'This month’s generation spend is $5.00, and the cap is $5.00 (SKETCHY_GENERATION_CAP_USD). Generation opens again on 1 December (UTC).',
    );
    expect(capRefusal(7.5, 5, Date.UTC(2026, 11, 20))).toContain(
      'spend is $7.50, and the cap is $5.00',
    );
    expect(capRefusal(7.5, 5, Date.UTC(2026, 11, 20))).toContain('1 January (UTC)');
  });

  it('a cap of 0 refuses every start, with or without a history', () => {
    expect(capRefusal(0, 0, NOV_3)).toContain('spend is $0.0000, and the cap is $0.0000');
    expect(noHistory(0).refusal(NOV_3)).toContain('the cap is $0.0000');
    expect(noHistory(0).spend(NOV_3).refused).toContain('the cap is $0.0000');
    expect(noHistory(5).refusal(NOV_3)).toBeNull();
  });
});

describe('historyEntry', () => {
  it('holds the title, N, words kept, cost and times, and never a drafted word', () => {
    const e = historyEntry(job(), DOLLAR, NOV_3);
    expect(e).toEqual({
      id: 'j1',
      kind: 'new',
      title: 'Kitchen',
      count: 40,
      kept: 2,
      costUsd: 1,
      startedAt: NOV_3 - 60_000,
      endedAt: NOV_3,
      outcome: 'ready',
    });
    expect(JSON.stringify(e)).not.toMatch(/kettle|frying|skillet|🍳/);
  });

  it('a failed generation keeps nothing but still costs what it spent', () => {
    const e = historyEntry(
      job({ status: 'failed', draft: null, error: 'Claude declined.' }),
      DOLLAR,
      NOV_3,
    );
    expect(e).toMatchObject({ kept: 0, costUsd: 1, outcome: 'failed' });
    expect(JSON.stringify(e)).not.toContain('declined');
  });
});

describe('the history file', () => {
  it('starts empty with no file, and writes none until a generation ends', async () => {
    const history = await openGenerationHistory(dir, { capUsd: 5, warn });
    expect(history.spend(NOV_3)).toEqual({
      capUsd: 5,
      monthUsd: 0,
      allTimeUsd: 0,
      last: null,
      history: [],
      total: 0,
      refused: null,
    });
    expect(await readdir(dir)).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('survives a restart: the entries, the month’s spend and the cap', async () => {
    const first = await openGenerationHistory(dir, { capUsd: 5, warn });
    await first.record(job({ id: 'a' }), DOLLAR, OCT_LAST_MS);
    await first.record(job({ id: 'b', title: 'Zoo' }), [...DOLLAR, ...DOLLAR], NOV_FIRST_MS);
    await first.record(job({ id: 'c', kind: 'more', categoryId: 'en-food' }), DOLLAR, NOV_3);

    const file = JSON.parse(await readFile(join(dir, HISTORY_FILE), 'utf8')) as {
      version: number;
      entries: GenerationHistoryEntry[];
    };
    expect(file.version).toBe(1);
    expect(file.entries.map((e) => e.id)).toEqual(['a', 'b', 'c']);

    // A new process reads it back.
    const second = await openGenerationHistory(dir, { capUsd: 3, warn });
    const spend = second.spend(NOV_3);
    expect(spend.monthUsd).toBeCloseTo(3);
    expect(spend.allTimeUsd).toBeCloseTo(4);
    expect(spend.total).toBe(3);
    expect(spend.last?.id).toBe('c');
    expect(spend.history.map((e) => e.id)).toEqual(['c', 'b', 'a']);
    // $3 this month against a $3 cap.
    expect(second.refusal(NOV_3)).toContain('spend is $3.00, and the cap is $3.00');
    // In December the month starts over.
    expect(second.refusal(Date.UTC(2026, 11, 1))).toBeNull();
    expect(warnings).toEqual([]);
  });

  it('counts a generation against the cap as soon as it is recorded', async () => {
    const history = await openGenerationHistory(dir, { capUsd: 1, warn });
    expect(history.refusal(NOV_3)).toBeNull();
    const written = history.record(job(), DOLLAR, NOV_3);
    expect(history.refusal(NOV_3)).toContain('the cap is $1.00');
    await written;
  });

  it('shows the newest 50, and counts all of them', async () => {
    const history = await openGenerationHistory(dir, { capUsd: 100, warn });
    for (let i = 0; i < GENERATION_HISTORY_SHOWN + 5; i++) {
      await history.record(job({ id: `j${i}` }), [], NOV_3 + i);
    }
    const spend = history.spend(NOV_3);
    expect(spend.total).toBe(GENERATION_HISTORY_SHOWN + 5);
    expect(spend.history).toHaveLength(GENERATION_HISTORY_SHOWN);
    expect(spend.history[0]!.id).toBe(`j${GENERATION_HISTORY_SHOWN + 4}`);
  });

  it('writes atomically: a temp file renamed over the old one, never a half-written file', async () => {
    const calls: string[] = [];
    const real: HistoryFs = {
      readFile: (p) => readFile(p, 'utf8'),
      writeFile: async (p, d) => {
        calls.push(`write ${p.slice(dir.length + 1)}`);
        await writeFile(p, d);
      },
      rename: async (from, to) => {
        calls.push(`rename ${from.slice(dir.length + 1)} → ${to.slice(dir.length + 1)}`);
        const { rename } = await import('node:fs/promises');
        await rename(from, to);
      },
      mkdir: () => Promise.resolve(),
      remove: (p) => rm(p, { force: true }),
    };
    const history = await openGenerationHistory(dir, { capUsd: 5, fs: real, warn });
    await history.record(job(), DOLLAR, NOV_3);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatch(/^write generation-history\.json\.\d+-1\.tmp$/);
    expect(calls[1]).toMatch(
      /^rename generation-history\.json\.\d+-1\.tmp → generation-history\.json$/,
    );
    expect(await readdir(dir)).toEqual([HISTORY_FILE]);
  });

  it('a failed write keeps the old file whole, warns, still counts, and the next write carries it', async () => {
    const first = await openGenerationHistory(dir, { capUsd: 5, warn });
    await first.record(job({ id: 'a' }), DOLLAR, NOV_3);
    const before = await readFile(join(dir, HISTORY_FILE), 'utf8');

    let fail = true;
    const { rename } = await import('node:fs/promises');
    const flaky: HistoryFs = {
      readFile: (p) => readFile(p, 'utf8'),
      writeFile: (p, d) => writeFile(p, d),
      rename: (from, to) =>
        fail
          ? Promise.reject(Object.assign(new Error('disk full'), { code: 'ENOSPC' }))
          : rename(from, to),
      mkdir: () => Promise.resolve(),
      remove: (p) => rm(p, { force: true }),
    };
    const second = await openGenerationHistory(dir, { capUsd: 5, fs: flaky, warn });
    await second.record(job({ id: 'b' }), DOLLAR, NOV_3);
    expect(await readFile(join(dir, HISTORY_FILE), 'utf8')).toBe(before);
    expect(await readdir(dir)).toEqual([HISTORY_FILE]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('ENOSPC');
    expect(warnings[0]).not.toContain('Kitchen');
    expect(second.spend(NOV_3).monthUsd).toBeCloseTo(2);

    fail = false;
    await second.record(job({ id: 'c' }), DOLLAR, NOV_3);
    const third = await openGenerationHistory(dir, { capUsd: 5, warn });
    expect(third.spend(NOV_3).history.map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('a file that is not JSON or not a history pauses generation and is never written over', async () => {
    for (const text of ['{ not json', JSON.stringify({ version: 1, entries: [{ id: 'x' }] })]) {
      warnings = [];
      await writeFile(join(dir, HISTORY_FILE), text);
      const history = await openGenerationHistory(dir, { capUsd: 5, warn });
      const refused = history.refusal(NOV_3);
      expect(refused).toMatch(/^Generation is paused: .*generation-history\.json can't be used/);
      expect(refused).toContain('Fix or remove the file, then restart the server.');
      expect(history.spend(NOV_3).refused).toBe(refused);
      expect(warnings).toEqual([refused]);
      await history.record(job(), DOLLAR, NOV_3);
      expect(await readFile(join(dir, HISTORY_FILE), 'utf8')).toBe(text);
    }
  });

  it('a file that cannot be read pauses generation, naming the error code only', async () => {
    const denied: HistoryFs = {
      readFile: () => Promise.reject(Object.assign(new Error('nope'), { code: 'EACCES' })),
      writeFile: () => Promise.reject(new Error('must not write')),
      rename: () => Promise.reject(new Error('must not write')),
      mkdir: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    };
    const history = await openGenerationHistory(dir, { capUsd: 5, fs: denied, warn });
    expect(history.refusal(NOV_3)).toContain("can't be read (EACCES)");
    await history.record(job(), DOLLAR, NOV_3);
    expect(warnings).toHaveLength(1);
  });
});
