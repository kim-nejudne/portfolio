import { describe, expect, it, vi } from 'vitest';
import { GENERATE_DRAFT_TTL_MS, GENERATE_DRAFTS_MAX } from '../../shared/constants.js';
import type { AdminGenerateStage } from '../../shared/types.js';
import { packWordSchema } from '../packs.js';
import { FAKE_EMOJI, FAKE_FAIL, fakeGenerator } from './fake.js';
import { type GenerationResult, type WordRequest, GenerationError } from './generator.js';
import {
  type GenerateFn,
  createGenerationRunner,
  DRAFT_NOT_READY,
  DRAFT_SAVING,
  GENERATION_BUSY,
  NOTHING_KEPT,
  NO_DRAFT,
  STILL_RUNNING,
  TOO_MANY_DRAFTS,
} from './jobs.js';
import { GENERATION_OFF, setUpGeneration } from './setup.js';

/** A generator held open until the test settles it, recording each request. */
function heldGenerator() {
  const requests: WordRequest[] = [];
  const pending: {
    resolve: (r: GenerationResult) => void;
    reject: (e: unknown) => void;
    stage: (s: AdminGenerateStage) => void;
  }[] = [];
  const generate: GenerateFn = (request, onStage) => {
    requests.push(request);
    return new Promise((resolve, reject) => pending.push({ resolve, reject, stage: onStage }));
  };
  return { generate, requests, pending };
}

const usage = [
  { model: 'm', inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
];
const words = [
  { word: 'kettle', alt: [], difficulty: 1 as const },
  { word: 'frying pan', alt: ['skillet'], difficulty: 2 as const },
];

let now = 1000;

function runner(generate: GenerateFn | null = heldGenerator().generate) {
  let n = 0;
  now = 1000;
  const logs: string[] = [];
  const ended: unknown[] = [];
  const r = createGenerationRunner({
    generate,
    mode: generate === null ? 'off' : 'claude',
    offMessage: GENERATION_OFF,
    clock: () => now,
    newId: () => `job${++n}`,
    log: (m) => logs.push(m),
    onEnded: (job, u) => ended.push({ status: job.status, usage: u }),
  });
  return { r, logs, ended };
}

const food = {
  id: 'en-food',
  title: 'Food',
  emoji: '🍔',
  words: [
    { word: 'doughnut', alt: ['donut'] },
    { word: 'pizza', alt: [] },
  ],
};

describe('the generation runner', () => {
  it('is off without a generator, saying why', () => {
    const { r } = runner(null);
    expect(r.start({ kind: 'new', title: 'Kitchen', count: 40 })).toEqual({
      ok: false,
      status: 503,
      error: 'Generation is off: the server has no SKETCHY_ANTHROPIC_API_KEY.',
    });
    expect(r.list()).toEqual([]);
  });

  it('runs a new category in the background: running with its stage, then a ready draft', async () => {
    const held = heldGenerator();
    const { r, ended } = runner(held.generate);
    const started = r.start({ kind: 'new', title: 'Kitchen', count: 40 });
    expect(started).toMatchObject({
      ok: true,
      job: {
        id: 'job1',
        kind: 'new',
        title: 'Kitchen',
        categoryId: null,
        count: 40,
        status: 'running',
      },
    });
    expect(held.requests[0]).toEqual({ title: 'Kitchen', count: 40, avoid: [], wantEmoji: true });
    held.pending[0]!.stage('checking');
    expect(r.get('job1')!.stage).toBe('checking');
    held.pending[0]!.resolve({ words, emoji: '🍳', usage });
    await r.idle();
    expect(r.get('job1')).toMatchObject({
      status: 'ready',
      stage: null,
      draft: { emoji: '🍳', words },
    });
    expect(ended).toEqual([{ status: 'ready', usage }]);
  });

  it('“more” avoids the category’s words and alternates, and asks for no emoji', () => {
    const held = heldGenerator();
    const { r } = runner(held.generate);
    const started = r.start({ kind: 'more', category: food, count: 10 });
    expect(started).toMatchObject({
      ok: true,
      job: { kind: 'more', title: 'Food', categoryId: 'en-food' },
    });
    expect(held.requests[0]).toEqual({
      title: 'Food',
      count: 10,
      avoid: ['doughnut', 'donut', 'pizza'],
      wantEmoji: false,
    });
  });

  it('runs one job at a time', () => {
    const { r } = runner();
    r.start({ kind: 'new', title: 'Kitchen', count: 40 });
    expect(r.start({ kind: 'new', title: 'Garden', count: 40 })).toEqual({
      ok: false,
      status: 409,
      error: GENERATION_BUSY,
    });
  });

  it('a failure shows its message only, and the next start replaces it', async () => {
    const held = heldGenerator();
    const { r, logs } = runner(held.generate);
    r.start({ kind: 'new', title: 'Kitchen', count: 40 });
    held.pending[0]!.reject(
      new GenerationError('Claude declined.', usage, { cause: new Error('secret API text') }),
    );
    await r.idle();
    expect(r.get('job1')).toMatchObject({
      status: 'failed',
      error: 'Claude declined.',
      draft: null,
    });
    expect(logs.join('\n')).not.toContain('secret API text');
    r.start({ kind: 'new', title: 'Garden', count: 40 });
    expect(r.list().map((j) => j.id)).toEqual(['job2']);
  });

  it('a draft with no word left fails with a message', async () => {
    const held = heldGenerator();
    const { r } = runner(held.generate);
    r.start({ kind: 'new', title: 'Kitchen', count: 40 });
    held.pending[0]!.resolve({ words: [], usage });
    await r.idle();
    expect(r.get('job1')).toMatchObject({ status: 'failed', error: NOTHING_KEPT });
  });

  it('holds at most 10 drafts', async () => {
    const held = heldGenerator();
    const { r } = runner(held.generate);
    for (let i = 0; i < GENERATE_DRAFTS_MAX; i++) {
      r.start({ kind: 'new', title: `Set ${i}`, count: 10 });
      held.pending[i]!.resolve({ words, usage });
      await r.idle();
    }
    expect(r.start({ kind: 'new', title: 'One more', count: 10 })).toEqual({
      ok: false,
      status: 409,
      error: TOO_MANY_DRAFTS,
    });
    expect(r.discard('job1')).toEqual({ ok: true });
    expect(r.start({ kind: 'new', title: 'One more', count: 10 }).ok).toBe(true);
  });

  it('take holds a ready draft for one save; release frees it; finish forgets it', async () => {
    const held = heldGenerator();
    const { r } = runner(held.generate);
    r.start({ kind: 'new', title: 'Kitchen', count: 40 });
    expect(r.take('job1')).toEqual({ ok: false, status: 409, error: DRAFT_NOT_READY });
    expect(r.discard('job1')).toEqual({ ok: false, status: 409, error: STILL_RUNNING });
    held.pending[0]!.resolve({ words, usage });
    await r.idle();
    expect(r.take('job1').ok).toBe(true);
    expect(r.take('job1')).toEqual({ ok: false, status: 409, error: DRAFT_SAVING });
    expect(r.discard('job1')).toEqual({ ok: false, status: 409, error: DRAFT_SAVING });
    r.release('job1');
    expect(r.take('job1').ok).toBe(true);
    r.finish('job1');
    expect(r.get('job1')).toBeUndefined();
    expect(r.take('job1')).toEqual({ ok: false, status: 404, error: NO_DRAFT });
  });

  it('never logs a drafted word or the title', async () => {
    const held = heldGenerator();
    const { r, logs } = runner(held.generate);
    r.start({ kind: 'new', title: 'Kitchen', count: 40 });
    held.pending[0]!.resolve({ words, usage });
    await r.idle();
    const all = logs.join('\n');
    expect(all).toContain('kept 2 of 40 words');
    for (const secret of ['Kitchen', 'kettle', 'frying pan', 'skillet']) {
      expect(all).not.toContain(secret);
    }
  });

  it('forgets a draft 24 hours after it was ready, unless it is being saved', async () => {
    const held = heldGenerator();
    const { r } = runner(held.generate);
    r.start({ kind: 'new', title: 'Kitchen', count: 40 });
    held.pending[0]!.resolve({ words, usage });
    await r.idle();
    r.start({ kind: 'new', title: 'Garden', count: 40 });
    held.pending[1]!.resolve({ words, usage });
    await r.idle();
    expect(r.take('job2').ok).toBe(true);
    now += GENERATE_DRAFT_TTL_MS - 1;
    expect(r.list().map((j) => j.id)).toEqual(['job2', 'job1']);
    now += 1;
    expect(r.get('job1')).toBeUndefined();
    expect(r.list().map((j) => j.id)).toEqual(['job2']);
  });

  it('hands out copies, so a page can’t change a held draft', async () => {
    const held = heldGenerator();
    const { r } = runner(held.generate);
    r.start({ kind: 'new', title: 'Kitchen', count: 40 });
    held.pending[0]!.resolve({ words, usage });
    await r.idle();
    r.get('job1')!.draft!.words.pop();
    expect(r.get('job1')!.draft!.words).toHaveLength(2);
  });
});

describe('setUpGeneration', () => {
  const make = {
    fake: () => 'fake' as unknown as GenerateFn,
    real: (key: string) => key as unknown as GenerateFn,
  };

  it('uses Claude with SKETCHY_ANTHROPIC_API_KEY, and never logs the key', () => {
    const lines: string[] = [];
    const setup = setUpGeneration(
      { SKETCHY_ANTHROPIC_API_KEY: ' sk-ant-secret ' },
      false,
      { log: (m) => lines.push(m) },
      make,
    );
    expect(setup).toEqual({ generate: 'sk-ant-secret', mode: 'claude' });
    expect(lines.join('\n')).not.toContain('sk-ant-secret');
  });

  it('is off in production without the key, and fake only in development', () => {
    const quiet = { log: () => undefined };
    expect(setUpGeneration({}, false, quiet, make)).toEqual({ generate: null, mode: 'off' });
    expect(setUpGeneration({ SKETCHY_ANTHROPIC_API_KEY: '  ' }, false, quiet, make).mode).toBe(
      'off',
    );
    expect(setUpGeneration({}, true, quiet, make)).toEqual({ generate: 'fake', mode: 'fake' });
  });

  it('reads no other variable: ANTHROPIC_API_KEY leaves generation off', () => {
    const env = { ANTHROPIC_API_KEY: 'sk-ant-other' } as { SKETCHY_ANTHROPIC_API_KEY?: string };
    expect(setUpGeneration(env, false, { log: () => undefined }, make).mode).toBe('off');
  });
});

describe('the fake generator', () => {
  const instant = { stepMs: 0, wait: () => Promise.resolve() };

  it('drafts everyday words that pass the pack rules, skipping the avoid list, with its emoji', async () => {
    const stages: string[] = [];
    const result = await fakeGenerator(instant)(
      { title: 'Things', count: 12, avoid: ['apple', 'bike'], wantEmoji: true },
      (s) => stages.push(s),
    );
    expect(stages).toEqual(['writing', 'checking']);
    expect(result.words).toHaveLength(12);
    expect(result.emoji).toBe(FAKE_EMOJI);
    const all = result.words.flatMap((w) => [w.word, ...w.alt]);
    expect(all).not.toContain('apple');
    expect(all).not.toContain('bicycle');
  });

  it('every word in its vocabulary is one the store would accept', async () => {
    const result = await fakeGenerator(instant)(
      { title: 'Things', count: 100, avoid: [], wantEmoji: false },
      () => undefined,
    );
    expect(result.words.length).toBeGreaterThanOrEqual(GENERATE_DRAFTS_MAX * 5);
    for (const w of result.words) {
      expect(packWordSchema.safeParse({ id: 'x', ...w }).success, w.word).toBe(true);
    }
  });

  it('waits in each stage so the progress shows, and fails a title holding “fail”', async () => {
    const wait = vi.fn(() => Promise.resolve());
    await expect(
      fakeGenerator({ stepMs: 1200, wait })(
        { title: 'Fail me', count: 10, avoid: [], wantEmoji: false },
        () => undefined,
      ),
    ).rejects.toThrow(FAKE_FAIL);
    expect(wait.mock.calls).toEqual([[1200], [1200]]);
  });
});
