import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  AdminCategoriesResponse,
  AdminJobsResponse,
  AdminPublishAllErrorBody,
  AdminPublishUnreviewedBody,
  BuiltInSetsResponse,
  Difficulty,
  GenerateJob,
  HttpErrorBody,
  QuestionSet,
} from '../shared/types.js';
import { openBuiltInStore, type BuiltInStore } from './builtInStore.js';
import { parseAdminPasswordHash } from './env.js';
import { GenerationError, type LevelRequest, type LevelResult } from './generate/generator.js';
import { createJobRunner, type GenerateLevelFn, type JobRunner } from './generate/jobs.js';
import { pricedUsage } from './generate/pricing.js';
import { createApp } from './http.js';
import { adminHashFor } from './test/admin.js';
import { makeQuestion, T0 } from './test/rooms.js';

const PASSWORD = 'open sesame';
const ADMIN_PASSWORD = parseAdminPasswordHash(adminHashFor(PASSWORD));
const HOUR = 60 * 60 * 1000;

const usage = () =>
  pricedUsage('claude-sonnet-5-5', {
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    searches: 2,
  });

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

type Answer = (request: LevelRequest) => LevelResult | Error;

/**
 * A generator that writes `count` questions per level unless `answers` says otherwise, and can be
 * held between writing and checking so a test can look at a running job.
 */
function fakeGenerator() {
  const calls: LevelRequest[] = [];
  const answers: Answer[] = [];
  let hold: Deferred | null = null;
  const generate: GenerateLevelFn = async (request, onStage) => {
    calls.push(structuredClone(request));
    onStage('writing');
    const gate = hold;
    if (gate) await gate.promise;
    onStage('checking');
    const answer = answers.shift();
    const result = answer
      ? answer(request)
      : {
          questions: Array.from({ length: request.count }, (_, i) => ({
            text: `${request.category} ${request.difficulty} question ${calls.length}.${i + 1}?`,
            answer: `Answer ${i + 1}`,
            ...(i === 0 ? { hostNotes: 'Also accept: A1' } : {}),
          })),
          short: false,
          usage: usage(),
        };
    if (result instanceof Error) throw result;
    return result;
  };
  return {
    generate,
    calls,
    answers,
    /** Holds every later level after its writing stage until `release`. */
    hold() {
      hold = deferred();
      return hold;
    },
  };
}

const live = (id: string, overrides: Partial<QuestionSet> = {}): QuestionSet => ({
  id,
  title: `Set ${id}`,
  questions: [makeQuestion(1), makeQuestion(2)],
  createdAt: T0,
  updatedAt: T0,
  schemaVersion: 1,
  ...overrides,
});

let server: Server | undefined;
let dir: string;
let builtIns: BuiltInStore;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'buzzr-http-generate-'));
  builtIns = await openBuiltInStore(dir, {
    seed: [
      live('river1', {
        title: 'Rivers – Easy',
        category: 'Rivers',
        difficulty: 'easy',
        questions: [makeQuestion(1, { text: 'Longest river in Africa?' })],
      }),
      live('cap1', { title: 'Capitals', category: 'capitals', difficulty: 'hard' }),
      live('plain'),
    ],
  });
});

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
  await rm(dir, { recursive: true, force: true });
});

interface Setup {
  /** Null: the server has no key. */
  generate?: GenerateLevelFn | null;
  dailyLimit?: number;
  replaceDailyLimit?: number;
  /** The clock's start; T0 by default. */
  start?: number;
}

/** The app with the store and a job runner, signed in. */
async function signedIn({
  generate = fakeGenerator().generate,
  dailyLimit = 20,
  replaceDailyLimit,
  start = T0,
}: Setup = {}) {
  let now = start;
  const clock = () => now;
  let ids = 0;
  const jobs: JobRunner = createJobRunner({
    generate,
    store: builtIns,
    clock,
    dailyLimit,
    ...(replaceDailyLimit === undefined ? {} : { replaceDailyLimit }),
    newId: () => `id${++ids}`,
  });
  server = createApp({
    adminPassword: ADMIN_PASSWORD,
    clock,
    builtIns,
    generateJobs: jobs,
  }).listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  const login = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]!;

  const send = (method: string, path: string, body?: unknown, headers = {}) =>
    fetch(`${base}/api/admin${path}`, {
      method,
      headers: { origin: base, 'content-type': 'application/json', cookie, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const get = (path: string, headers = {}) =>
    fetch(`${base}/api/admin${path}`, { headers: { cookie, ...headers } });

  return {
    base,
    jobs,
    send,
    get,
    advance: (ms: number) => (now += ms),
    generate: (body: unknown) => send('POST', '/categories/generate', body),
    regenerate: (id: string) => send('POST', `/built-in-sets/${id}/regenerate`),
    replace: (setId: string, qid: string, body?: unknown) =>
      send('POST', `/built-in-sets/${setId}/questions/${qid}/replace`, body),
    add: (setId: string, body?: unknown) =>
      send('POST', `/built-in-sets/${setId}/questions/add`, body),
    cancel: (id: string) => send('POST', `/jobs/${id}/cancel`),
    reviewed: (setId: string) => send('POST', `/built-in-sets/${setId}/reviewed`),
    /** Marks every draft waiting for review reviewed, as the admin would before publishing. */
    reviewAll: async () => {
      for (const id of builtIns.read().unreviewed) {
        expect((await send('POST', `/built-in-sets/${id}/reviewed`)).status).toBe(200);
      }
    },
    replaces: async (setId: string) =>
      ((await (await get(`/jobs?setId=${setId}`)).json()) as AdminJobsResponse).jobs,
    job: async (id: string) => (await (await get(`/jobs/${id}`)).json()) as GenerateJob,
    categories: async () => (await (await get('/categories')).json()) as AdminCategoriesResponse,
  };
}

const levels = (...ds: Difficulty[]) => ds.map((difficulty) => ({ difficulty, count: 5 }));

async function jobIdOf(res: Response): Promise<string> {
  expect(res.status).toBe(202);
  return ((await res.json()) as { jobId: string }).jobId;
}

async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as HttpErrorBody).error;
}

function draftsTitled(...titles: string[]): QuestionSet[] {
  const drafts = Object.values(builtIns.read().drafts);
  return titles.map((t) => drafts.find((d) => d.title === t)!);
}

describe('POST /api/admin/categories/generate', () => {
  it('answers 202 {jobId}, then saves each level as a new draft with its category, difficulty and points', async () => {
    const app = await signedIn();
    const id = await jobIdOf(
      await app.generate({ category: ' Volcanoes ', levels: levels('hard', 'easy') }),
    );
    await app.jobs.idle();

    const job = await app.job(id);
    expect(job.state).toBe('done');
    expect(job.kind).toBe('generate');
    expect(job.levels.map((l) => l.difficulty)).toEqual(['easy', 'hard']);
    expect(job.finished.map((l) => [l.title, l.questions, l.count])).toEqual([
      ['Volcanoes – Easy', 5, 5],
      ['Volcanoes – Hard', 5, 5],
    ]);
    expect(job.short).toEqual([]);
    expect(job.error).toBeNull();
    expect(job.usage.searches).toBe(4);
    expect(job.usage.costUsd).toBeCloseTo(usage().costUsd * 2);

    const [easy, hard] = draftsTitled('Volcanoes – Easy', 'Volcanoes – Hard');
    expect(easy).toMatchObject({ category: 'Volcanoes', difficulty: 'easy', schemaVersion: 1 });
    expect(easy!.questions).toHaveLength(5);
    expect(easy!.questions.every((q) => q.points === 100)).toBe(true);
    expect(easy!.questions[0]!.hostNotes).toBe('Also accept: A1');
    expect(easy!.questions[1]).not.toHaveProperty('hostNotes');
    expect(hard!.questions.every((q) => q.points === 300)).toBe(true);
    // Drafts only: nothing new on the public list.
    expect(builtIns.read().sets.map((s) => s.id)).toEqual(['river1', 'cap1', 'plain']);
    const pub = (await (
      await fetch(`${app.base}/api/built-in-sets`)
    ).json()) as BuiltInSetsResponse;
    expect(pub.sets.some((s) => s.category === 'Volcanoes')).toBe(false);
  });

  it('gives medium 200 points a question', async () => {
    const app = await signedIn();
    await jobIdOf(await app.generate({ category: 'Volcanoes', levels: levels('medium') }));
    await app.jobs.idle();
    const [medium] = draftsTitled('Volcanoes – Medium');
    expect(medium!.questions.every((q) => q.points === 200)).toBe(true);
  });

  it('adds to an existing category in its spelling, titling a repeated level "… 2", "… 3"', async () => {
    const app = await signedIn();
    await jobIdOf(await app.generate({ category: 'RIVERS', levels: levels('easy', 'medium') }));
    await app.jobs.idle();
    await jobIdOf(await app.generate({ category: 'rivers', levels: levels('easy') }));
    await app.jobs.idle();
    const [two, medium, three] = draftsTitled(
      'Rivers – Easy 2',
      'Rivers – Medium',
      'Rivers – Easy 3',
    );
    expect(two!.category).toBe('Rivers');
    expect(medium!.category).toBe('Rivers');
    expect(three!.category).toBe('Rivers');
  });

  it("avoids every question already in the category, plus the job's earlier levels", async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await jobIdOf(
      await app.generate({
        category: 'Rivers',
        guidance: ' Europe only ',
        levels: levels('easy', 'medium'),
      }),
    );
    await app.jobs.idle();
    expect(fake.calls[0]).toMatchObject({
      category: 'Rivers',
      guidance: 'Europe only',
      difficulty: 'easy',
      count: 5,
      avoid: ['Longest river in Africa?'],
    });
    expect(fake.calls[1]!.avoid).toHaveLength(6);
    expect(fake.calls[1]!.avoid).toContain('Longest river in Africa?');
    expect(fake.calls[1]!.avoid).toContain('Rivers easy question 1.1?');
    expect(fake.calls[1]!.avoid).toContain('Rivers easy question 1.5?');
  });

  it('reports the stage and current level while running, and lists short levels', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    fake.answers.push(() => ({
      questions: [{ text: 'Only one?', answer: 'Yes' }],
      short: true,
      usage: usage(),
    }));
    const gate = fake.hold();
    const id = await jobIdOf(await app.generate({ category: 'Moons', levels: levels('easy') }));
    // Let the job reach its writing stage.
    await new Promise((r) => setImmediate(r));
    const running = await app.job(id);
    expect(running.state).toBe('writing');
    expect(running.currentLevel).toBe('easy');
    expect((await app.categories()).generation.running?.id).toBe(id);

    gate.resolve();
    await app.jobs.idle();
    const done = await app.job(id);
    expect(done.state).toBe('done');
    expect(done.currentLevel).toBeNull();
    expect(done.short).toEqual([
      {
        difficulty: 'easy',
        setId: done.finished[0]!.setId,
        title: 'Moons – Easy',
        questions: 1,
        count: 5,
      },
    ]);
  });

  it('fails a level with its plain message and usage, keeping the levels finished before it', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    fake.answers.push(
      () => ({
        questions: [
          { text: 'Q?', answer: 'A' },
          { text: 'R?', answer: 'B' },
        ],
        short: true,
        usage: usage(),
      }),
      () => new GenerationError('The fact check ran too long. Try again.', usage()),
    );
    const id = await jobIdOf(
      await app.generate({ category: 'Moons', levels: levels('easy', 'medium', 'hard') }),
    );
    await app.jobs.idle();
    const job = await app.job(id);
    expect(job.state).toBe('failed');
    expect(job.error).toBe('The fact check ran too long. Try again.');
    expect(job.usage.costUsd).toBeCloseTo(usage().costUsd * 2);
    expect(job.finished.map((l) => l.title)).toEqual(['Moons – Easy']);
    // The failed level saved nothing, and the third never started.
    expect(fake.calls).toHaveLength(2);
    const titles = Object.values(builtIns.read().drafts).map((d) => d.title);
    expect(titles).toEqual(['Moons – Easy']);
    const moons = (await app.categories()).categories.find((c) => c.name === 'Moons')!;
    expect(moons.job?.id).toBe(id);
    expect(moons.job?.state).toBe('failed');
  });

  it('fails a level that no question survived, saving nothing', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    fake.answers.push(() => ({ questions: [], short: true, usage: usage() }));
    const id = await jobIdOf(await app.generate({ category: 'Moons', levels: levels('hard') }));
    await app.jobs.idle();
    expect((await app.job(id)).error).toBe('No Hard question passed the fact check. Try again.');
    expect(builtIns.read().drafts).toEqual({});
  });

  it('shows only a plain message for an unexpected error', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    fake.answers.push(() => new Error('sk-ant-secret leaked in a stack'));
    const id = await jobIdOf(await app.generate({ category: 'Moons', levels: levels('easy') }));
    await app.jobs.idle();
    const text = JSON.stringify(await app.job(id));
    expect(text).toContain('Question generation failed unexpectedly. Try again.');
    expect(text).not.toContain('sk-ant-secret');
  });

  it('refuses a bad body with 400 and starts nothing', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    const bad = [
      {},
      { category: '', levels: levels('easy') },
      { category: 'x'.repeat(41), levels: levels('easy') },
      { category: 'Moons', guidance: 'x'.repeat(501), levels: levels('easy') },
      { category: 'Moons', levels: [] },
      { category: 'Moons', levels: levels('easy', 'easy') },
      { category: 'Moons', levels: [{ difficulty: 'easy', count: 4 }] },
      { category: 'Moons', levels: [{ difficulty: 'easy', count: 31 }] },
    ];
    for (const body of bad) expect((await app.generate(body)).status).toBe(400);
    const notJson = await app.send('POST', '/categories/generate');
    expect(notJson.status).toBe(400);
    expect(fake.calls).toEqual([]);
    expect((await app.categories()).generation.usedToday).toBe(0);
  });

  it('answers 409 while a job runs, for a generate and a regenerate alike', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    const gate = fake.hold();
    await jobIdOf(await app.generate({ category: 'Moons', levels: levels('easy') }));
    const again = await app.generate({ category: 'Stars', levels: levels('easy') });
    expect(again.status).toBe(409);
    expect(await errorOf(again)).toMatch(/already running/);
    expect((await app.regenerate('river1')).status).toBe(409);
    gate.resolve();
    await app.jobs.idle();
    await jobIdOf(await app.generate({ category: 'Stars', levels: levels('easy') }));
  });

  it('answers 429 over the daily cap, counting levels, and resets on the next UTC day', async () => {
    // 23:00 UTC, so the next day comes inside the admin session.
    const app = await signedIn({ dailyLimit: 3, start: Date.UTC(2027, 0, 15, 23) });
    const tooMany = await app.generate({ category: 'Moons', levels: levels('easy', 'medium') });
    expect(tooMany.status).toBe(202);
    await app.jobs.idle();
    const over = await app.generate({ category: 'Stars', levels: levels('easy', 'medium') });
    expect(over.status).toBe(429);
    expect(await errorOf(over)).toMatch(/Only 1 more level/);
    await jobIdOf(await app.regenerate('river1'));
    await app.jobs.idle();
    const capped = await app.generate({ category: 'Stars', levels: levels('easy') });
    expect(capped.status).toBe(429);
    expect(await errorOf(capped)).toMatch(/Daily limit reached/);
    const listed = await app.categories();
    expect(listed.generation).toMatchObject({ usedToday: 3, dailyLimit: 3 });

    app.advance(HOUR);
    expect((await app.categories()).generation.usedToday).toBe(0);
    await jobIdOf(await app.generate({ category: 'Stars', levels: levels('easy') }));
  });

  it('answers 503 with no key, for generate and regenerate', async () => {
    const app = await signedIn({ generate: null });
    const res = await app.generate({ category: 'Moons', levels: levels('easy') });
    expect(res.status).toBe(503);
    expect(await errorOf(res)).toMatch(/BUZZR_ANTHROPIC_API_KEY/);
    expect((await app.send('POST', '/categories/generate', { junk: 1 })).status).toBe(503);
    expect((await app.regenerate('river1')).status).toBe(503);
    const listed = await app.categories();
    expect(listed.generation.enabled).toBe(false);
    // Everything else still works.
    expect(listed.categories.map((c) => c.name)).toEqual(['capitals', 'Rivers']);
  });
});

describe('POST /api/admin/built-in-sets/:id/regenerate', () => {
  it("writes a live set's level again as its draft, from its category, difficulty and count", async () => {
    const fake = fakeGenerator();
    await builtIns.update((data) => ({
      ...data,
      sets: data.sets.map((s) =>
        s.id === 'cap1'
          ? { ...s, questions: Array.from({ length: 12 }, (_, i) => makeQuestion(i + 1)) }
          : s,
      ),
    }));
    const app = await signedIn({ generate: fake.generate });
    const id = await jobIdOf(await app.regenerate('cap1'));
    expect((await app.job(id)).setId).toBe('cap1');
    await app.jobs.idle();

    expect(fake.calls[0]).toMatchObject({ category: 'capitals', difficulty: 'hard', count: 12 });
    expect(fake.calls[0]!.avoid).toContain('Question 1 text');
    const job = await app.job(id);
    expect(job).toMatchObject({ kind: 'regenerate', state: 'done', category: 'capitals' });
    expect(job.finished[0]).toMatchObject({ setId: 'cap1', title: 'Capitals', questions: 12 });

    const { sets, drafts } = builtIns.read();
    expect(sets.find((s) => s.id === 'cap1')!.questions[0]!.text).toBe('Question 1 text');
    expect(drafts.cap1).toMatchObject({
      id: 'cap1',
      title: 'Capitals',
      category: 'capitals',
      difficulty: 'hard',
      createdAt: T0,
    });
    expect(drafts.cap1!.questions.every((q) => q.points === 300)).toBe(true);
    const listed = (await app.categories()).categories.find((c) => c.name === 'capitals')!;
    expect(listed.levels[0]).toMatchObject({ setId: 'cap1', status: 'draft', questions: 12 });
  });

  it('replaces a new draft in place, and keeps the count within 5–30', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await jobIdOf(await app.generate({ category: 'Moons', levels: levels('easy') }));
    await app.jobs.idle();
    const [easy] = draftsTitled('Moons – Easy');
    // Short of the minimum after an edit: asks for 5.
    await builtIns.update((data) => ({
      ...data,
      drafts: { ...data.drafts, [easy!.id]: { ...easy!, questions: easy!.questions.slice(0, 2) } },
    }));
    await jobIdOf(await app.regenerate(easy!.id));
    await app.jobs.idle();
    expect(fake.calls[1]!.count).toBe(5);
    expect(Object.keys(builtIns.read().drafts)).toEqual([easy!.id]);
    expect(builtIns.read().drafts[easy!.id]!.questions).toHaveLength(5);
  });

  it('refuses a set with no category or difficulty (400) and an unknown id (404)', async () => {
    const app = await signedIn();
    const res = await app.regenerate('plain');
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toMatch(/category and a difficulty/);
    expect((await app.regenerate('nope')).status).toBe(404);
    expect((await app.regenerate('bad id!')).status).toBe(404);
  });

  it('fails without saving when the set is deleted while it is written', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    const gate = fake.hold();
    const id = await jobIdOf(await app.regenerate('cap1'));
    await new Promise((r) => setImmediate(r));
    expect((await app.send('DELETE', '/built-in-sets/cap1')).status).toBe(200);
    gate.resolve();
    await app.jobs.idle();
    expect((await app.job(id)).state).toBe('failed');
    expect(builtIns.read().drafts).toEqual({});
  });
});

describe('GET /api/admin/categories', () => {
  it('folds categories case-insensitively over live sets and drafts, with each level and its status', async () => {
    await builtIns.update((data) => ({
      ...data,
      sets: [
        ...data.sets,
        live('river3', { title: 'Rivers – Hard', category: 'rivers ', difficulty: 'hard' }),
      ],
      drafts: {
        river1: { ...data.sets[0]!, title: 'Rivers – Easy', questions: [] },
        river2: live('river2', {
          title: 'Rivers – Medium',
          category: 'RIVERS',
          difficulty: 'medium',
        }),
      },
      // A generated draft not yet reviewed; the editor's draft river1 never was.
      unreviewed: ['river2'],
    }));
    const app = await signedIn();
    const { categories, generation } = await app.categories();
    expect(categories.map((c) => c.name)).toEqual(['capitals', 'Rivers']);
    expect(categories[1]!.levels).toEqual([
      {
        setId: 'river1',
        title: 'Rivers – Easy',
        difficulty: 'easy',
        questions: 0,
        wanted: null,
        status: 'draft',
        reviewed: true,
      },
      {
        setId: 'river2',
        title: 'Rivers – Medium',
        difficulty: 'medium',
        questions: 2,
        wanted: null,
        status: 'new',
        reviewed: false,
      },
      {
        setId: 'river3',
        title: 'Rivers – Hard',
        difficulty: 'hard',
        questions: 2,
        wanted: null,
        status: 'live',
        reviewed: true,
      },
    ]);
    expect(categories[1]!.job).toBeNull();
    expect(generation).toEqual({
      enabled: true,
      usedToday: 0,
      dailyLimit: 20,
      running: null,
      replacements: { usedToday: 0, dailyLimit: 100 },
    });
  });

  it('lists a new category whose first level is still being written, with its job', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    const gate = fake.hold();
    const id = await jobIdOf(await app.generate({ category: 'Moons', levels: levels('easy') }));
    const moons = (await app.categories()).categories.find((c) => c.name === 'Moons')!;
    expect(moons.levels).toEqual([]);
    expect(moons.job?.id).toBe(id);
    gate.resolve();
    await app.jobs.idle();
    // Done: the job is no longer attached.
    const after = (await app.categories()).categories.find((c) => c.name === 'Moons')!;
    expect(after.job).toBeNull();
    expect(after.levels).toHaveLength(1);
  });

  it("gives each generated level the count its job asked for, after the job is done, the newest job's winning", async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    fake.answers.push(() => ({
      questions: [{ text: 'Only one?', answer: 'Yes' }],
      short: true,
      usage: usage(),
    }));
    await jobIdOf(
      await app.generate({ category: 'Moons', levels: [{ difficulty: 'easy', count: 7 }] }),
    );
    await app.jobs.idle();
    const [level] = (await app.categories()).categories.find((c) => c.name === 'Moons')!.levels;
    expect(level).toMatchObject({ questions: 1, wanted: 7 });
    // A regenerate asks for the set's count kept within 5–30, so 5 now.
    await jobIdOf(await app.regenerate(level!.setId));
    await app.jobs.idle();
    const [after] = (await app.categories()).categories.find((c) => c.name === 'Moons')!.levels;
    expect(after).toMatchObject({ setId: level!.setId, questions: 5, wanted: 5 });
  });
});

describe('GET /api/admin/jobs/:id', () => {
  it('answers 404 for an unknown job', async () => {
    const app = await signedIn();
    expect((await app.get('/jobs/nope')).status).toBe(404);
  });
});

describe('POST /api/admin/categories/:name/publish', () => {
  it('publishes every draft in the category, new ones last, and nothing else', async () => {
    const app = await signedIn();
    await jobIdOf(await app.generate({ category: 'Rivers', levels: levels('medium', 'hard') }));
    await app.jobs.idle();
    await jobIdOf(await app.regenerate('river1'));
    await app.jobs.idle();
    await jobIdOf(await app.generate({ category: 'Moons', levels: levels('easy') }));
    await app.jobs.idle();
    await app.reviewAll();

    const res = await app.send('POST', `/categories/${encodeURIComponent('RIVERS')}/publish`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ published: 3 });
    const { sets, drafts } = builtIns.read();
    expect(sets.map((s) => s.title)).toEqual([
      'Rivers – Easy',
      'Capitals',
      'Set plain',
      'Rivers – Medium',
      'Rivers – Hard',
    ]);
    expect(sets[0]!.questions[0]!.text).toBe('Rivers easy question 3.1?');
    expect(Object.values(drafts).map((d) => d.title)).toEqual(['Moons – Easy']);
  });

  it('stops at the first draft that cannot be published and names it', async () => {
    const app = await signedIn();
    await jobIdOf(
      await app.generate({ category: 'Moons', levels: levels('easy', 'medium', 'hard') }),
    );
    await app.jobs.idle();
    const [, medium] = draftsTitled('Moons – Easy', 'Moons – Medium');
    await builtIns.update((data) => ({
      ...data,
      drafts: { ...data.drafts, [medium!.id]: { ...medium!, questions: [] } },
    }));
    await app.reviewAll();
    const res = await app.send('POST', '/categories/moons/publish');
    expect(res.status).toBe(400);
    const body = (await res.json()) as AdminPublishAllErrorBody;
    expect(body.error).toBe('“Moons – Medium” cannot be published yet.');
    expect(body.setId).toBe(medium!.id);
    expect(body.published).toBe(1);
    expect(body.problems.length).toBeGreaterThan(0);
    const { sets, drafts } = builtIns.read();
    expect(sets.map((s) => s.title)).toContain('Moons – Easy');
    expect(
      Object.values(drafts)
        .map((d) => d.title)
        .sort(),
    ).toEqual(['Moons – Hard', 'Moons – Medium']);
  });

  it('answers 409 with no drafts, 404 for an unknown category, and 409 while it generates', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    expect((await app.send('POST', '/categories/Rivers/publish')).status).toBe(409);
    expect((await app.send('POST', '/categories/Nope/publish')).status).toBe(404);
    const gate = fake.hold();
    await jobIdOf(await app.regenerate('river1'));
    const busy = await app.send('POST', '/categories/Rivers/publish');
    expect(busy.status).toBe(409);
    expect(await errorOf(busy)).toMatch(/being generated/);
    // Another category is not held up.
    expect((await app.send('DELETE', '/categories/capitals')).status).toBe(200);
    gate.resolve();
    await app.jobs.idle();
  });
});

describe('the reviewed mark (F114)', () => {
  it('a generate leaves each level it saved unreviewed, and the category list says so', async () => {
    const app = await signedIn();
    await jobIdOf(await app.generate({ category: 'Moons', levels: levels('easy', 'hard') }));
    await app.jobs.idle();
    const [easy, hard] = draftsTitled('Moons – Easy', 'Moons – Hard');
    expect(builtIns.read().unreviewed).toEqual([easy!.id, hard!.id]);
    const moons = (await app.categories()).categories.find((c) => c.name === 'Moons')!;
    expect(moons.levels.map((l) => [l.title, l.reviewed])).toEqual([
      ['Moons – Easy', false],
      ['Moons – Hard', false],
    ]);
    expect((await app.reviewed(easy!.id)).status).toBe(200);
    const after = (await app.categories()).categories.find((c) => c.name === 'Moons')!;
    expect(after.levels.map((l) => l.reviewed)).toEqual([true, false]);
    // A live set with no draft has nothing to review.
    const rivers = (await app.categories()).categories.find((c) => c.name === 'Rivers')!;
    expect(rivers.levels[0]).toMatchObject({ status: 'live', reviewed: true });
  });

  it('a regenerate asks for a review again, even of a draft reviewed before', async () => {
    const app = await signedIn();
    await jobIdOf(await app.regenerate('river1'));
    await app.jobs.idle();
    expect(builtIns.read().unreviewed).toEqual(['river1']);
    expect((await app.reviewed('river1')).status).toBe(200);
    expect(builtIns.read().unreviewed).toEqual([]);
    await jobIdOf(await app.regenerate('river1'));
    await app.jobs.idle();
    expect(builtIns.read().unreviewed).toEqual(['river1']);
  });

  it('replacements and additions leave the mark as it is', async () => {
    const app = await signedIn();
    await seedMoonDraft();
    await jobIdOf(await app.replace('moon', 'm1'));
    await jobIdOf(await app.add('moon'));
    await app.jobs.idle();
    expect(moonDraft().questions).toHaveLength(4);
    expect(builtIns.read().unreviewed).toEqual([]);
    await builtIns.update((data) => ({ ...data, unreviewed: ['moon'] }));
    await jobIdOf(await app.replace('moon', 'm2'));
    await app.jobs.idle();
    expect(builtIns.read().unreviewed).toEqual(['moon']);
  });

  it('publishing a category is refused while a level waits for review, naming it, and publishes nothing', async () => {
    const app = await signedIn();
    await jobIdOf(
      await app.generate({ category: 'Moons', levels: levels('easy', 'medium', 'hard') }),
    );
    await app.jobs.idle();
    const [easy, medium, hard] = draftsTitled('Moons – Easy', 'Moons – Medium', 'Moons – Hard');
    expect((await app.reviewed(medium!.id)).status).toBe(200);
    const before = builtIns.read();

    const res = await app.send('POST', '/categories/moons/publish');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error:
        'Mark every level reviewed before publishing. Not reviewed yet: “Moons – Easy”, “Moons – Hard”.',
      unreviewed: [easy!.id, hard!.id],
    } satisfies AdminPublishUnreviewedBody);
    expect(builtIns.read()).toBe(before);

    expect((await app.reviewed(easy!.id)).status).toBe(200);
    expect((await app.reviewed(hard!.id)).status).toBe(200);
    const ok = await app.send('POST', '/categories/moons/publish');
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ published: 3 });
    expect(builtIns.read().unreviewed).toEqual([]);
    expect(builtIns.read().drafts).toEqual({});
  });

  it('a draft from the editor in the category does not hold the publish up', async () => {
    const app = await signedIn();
    await builtIns.update((data) => ({
      ...data,
      drafts: { river1: { ...data.sets[0]!, title: 'Rivers – Easy (edited)' } },
    }));
    const res = await app.send('POST', '/categories/rivers/publish');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ published: 1 });
  });

  it('deleting the category takes its drafts off the unreviewed list', async () => {
    const app = await signedIn();
    await jobIdOf(await app.generate({ category: 'Moons', levels: levels('easy') }));
    await app.jobs.idle();
    expect(builtIns.read().unreviewed).toHaveLength(1);
    expect((await app.send('DELETE', '/categories/moons')).status).toBe(200);
    expect(builtIns.read().unreviewed).toEqual([]);
  });
});

describe('DELETE /api/admin/categories/:name', () => {
  it('removes its live sets and drafts, any case, and leaves the rest', async () => {
    const app = await signedIn();
    await jobIdOf(await app.generate({ category: 'Rivers', levels: levels('hard') }));
    await app.jobs.idle();
    await jobIdOf(await app.regenerate('river1'));
    await app.jobs.idle();
    const res = await app.send('DELETE', '/categories/%20rivers%20');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 2 });
    const { sets, drafts } = builtIns.read();
    expect(sets.map((s) => s.id)).toEqual(['cap1', 'plain']);
    expect(drafts).toEqual({});
    expect((await app.send('DELETE', '/categories/rivers')).status).toBe(404);
  });

  it('is gone from the list after a delete, even though its done job is remembered', async () => {
    const app = await signedIn();
    await jobIdOf(await app.generate({ category: 'Moons', levels: levels('easy') }));
    await app.jobs.idle();
    expect((await app.send('DELETE', '/categories/Moons')).status).toBe(200);
    const names = (await app.categories()).categories.map((c) => c.name);
    expect(names).not.toContain('Moons');
  });

  it('clears a failed new category that saved no set, which then leaves the list', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    fake.answers.push(() => new GenerationError('The Claude API is busy.'));
    await jobIdOf(await app.generate({ category: 'Moons', levels: levels('easy') }));
    await app.jobs.idle();
    const listed = (await app.categories()).categories.find((c) => c.name === 'Moons');
    expect(listed).toMatchObject({ levels: [], job: { state: 'failed' } });
    const res = await app.send('DELETE', '/categories/moons');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 0 });
    expect((await app.categories()).categories.map((c) => c.name)).not.toContain('Moons');
    expect((await app.send('DELETE', '/categories/moons')).status).toBe(404);
  });
});

// ---------- Replace jobs (F113) ----------

const MOON_QUESTIONS = [
  { id: 'm1', text: 'Largest moon of Saturn?', answer: 'Titan', points: 100 },
  { id: 'm2', text: 'Moon with volcanoes?', answer: 'Io', hostNotes: 'Jupiter', points: 150 },
  { id: 'm3', text: 'Moon of Mars, larger one?', answer: 'Phobos', points: 100 },
];

/** A new draft "Moons – Easy" with three questions, as a generate leaves it. */
async function seedMoonDraft(overrides: Partial<QuestionSet> = {}): Promise<QuestionSet> {
  const draft = live('moon', {
    title: 'Moons – Easy',
    category: 'Moons',
    difficulty: 'easy',
    questions: structuredClone(MOON_QUESTIONS),
    ...overrides,
  });
  await builtIns.update((data) => ({ ...data, drafts: { ...data.drafts, [draft.id]: draft } }));
  return draft;
}

const moonDraft = (): QuestionSet => builtIns.read().drafts.moon!;

/** Lets a job that just started reach its writing stage. */
const tick = () => new Promise((r) => setImmediate(r));

describe('POST /api/admin/built-in-sets/:id/questions/:qid/replace', () => {
  it('swaps one question in the draft, keeping its id and points, and reports old and new', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await seedMoonDraft();
    app.advance(5000);
    const id = await jobIdOf(await app.replace('moon', 'm2', { note: '  too easy ' }));
    const queued = await app.job(id);
    expect(queued).toMatchObject({
      kind: 'replace',
      setId: 'moon',
      questionId: 'm2',
      note: 'too easy',
      category: 'Moons',
      levels: [{ difficulty: 'easy', count: 1 }],
    });
    await app.jobs.idle();

    const done = await app.job(id);
    expect(done.state).toBe('done');
    const fresh = {
      id: 'm2',
      text: 'Moons easy question 1.1?',
      answer: 'Answer 1',
      hostNotes: 'Also accept: A1',
      points: 150,
    };
    expect(done.replaced).toEqual({ old: MOON_QUESTIONS[1], new: fresh });
    const draft = moonDraft();
    expect(draft.questions).toEqual([MOON_QUESTIONS[0], fresh, MOON_QUESTIONS[2]]);
    expect(draft.updatedAt).toBe(T0 + 5000);
    expect(builtIns.read().sets.map((s) => s.id)).toEqual(['river1', 'cap1', 'plain']);
  });

  it('asks for one question at the level, avoiding every question of the level, with the note', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await seedMoonDraft();
    await jobIdOf(await app.replace('moon', 'm3', { note: 'too easy' }));
    await app.jobs.idle();
    expect(fake.calls).toEqual([
      {
        category: 'Moons',
        guidance: 'For this question: too easy',
        difficulty: 'easy',
        count: 1,
        avoid: MOON_QUESTIONS.map((q) => q.text),
      },
    ]);
  });

  it("writes with the category's guidance from its generation, and keeps it on the job", async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await jobIdOf(
      await app.generate({
        category: 'Comets',
        guidance: 'Short-period only',
        levels: levels('easy'),
      }),
    );
    await app.jobs.idle();
    const [draft] = draftsTitled('Comets – Easy');
    const id = await jobIdOf(await app.replace(draft!.id, draft!.questions[0]!.id));
    await app.jobs.idle();
    expect((await app.job(id)).guidance).toBe('Short-period only');
    expect(fake.calls[1]!.guidance).toBe('Short-period only');
    await jobIdOf(await app.add(draft!.id, { note: 'harder' }));
    await app.jobs.idle();
    expect(fake.calls[2]!.guidance).toBe('Short-period only\nFor this question: harder');

    // A deleted category's guidance does not carry over to a new one of the same name.
    expect((await app.send('DELETE', '/categories/Comets')).status).toBe(200);
    await jobIdOf(await app.generate({ category: 'comets', levels: levels('easy') }));
    await app.jobs.idle();
    const [again] = draftsTitled('comets – Easy');
    const fresh = await jobIdOf(await app.add(again!.id));
    await app.jobs.idle();
    expect((await app.job(fresh)).guidance).toBe('');
    expect(fake.calls.at(-1)!.guidance).toBe('');
  });

  it('reads the draft fresh when the question arrives, keeping edits made meanwhile', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await seedMoonDraft();
    const gate = fake.hold();
    await jobIdOf(await app.replace('moon', 'm2'));
    await tick();
    await builtIns.update((data) => {
      const draft = data.drafts.moon!;
      const questions = draft.questions.map((q) => (q.id === 'm1' ? { ...q, text: 'Edited?' } : q));
      return { ...data, drafts: { ...data.drafts, moon: { ...draft, questions } } };
    });
    gate.resolve();
    await app.jobs.idle();
    expect(moonDraft().questions.map((q) => q.text)).toEqual([
      'Edited?',
      'Moons easy question 1.1?',
      MOON_QUESTIONS[2]!.text,
    ]);
  });

  it('fails with "The question was removed" when it is removed while written, leaving the draft', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await seedMoonDraft();
    const gate = fake.hold();
    const id = await jobIdOf(await app.replace('moon', 'm2'));
    await tick();
    await builtIns.update((data) => {
      const draft = data.drafts.moon!;
      const questions = draft.questions.filter((q) => q.id !== 'm2');
      return { ...data, drafts: { ...data.drafts, moon: { ...draft, questions } } };
    });
    const before = structuredClone(moonDraft());
    gate.resolve();
    await app.jobs.idle();
    const failed = await app.job(id);
    expect(failed).toMatchObject({
      state: 'failed',
      error: 'The question was removed',
      replaced: null,
    });
    expect(moonDraft()).toEqual(before);
  });

  it('fails when the draft is gone by the time it runs, saving nothing', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await seedMoonDraft();
    const gate = fake.hold();
    await jobIdOf(await app.replace('moon', 'm1'));
    const second = await jobIdOf(await app.replace('moon', 'm2'));
    await tick();
    await builtIns.update((data) => ({ ...data, drafts: {} }));
    gate.resolve();
    await app.jobs.idle();
    expect((await app.job(second)).error).toMatch(/draft is gone/);
    expect(builtIns.read().drafts).toEqual({});
    // The second never reached the generator.
    expect(fake.calls).toHaveLength(1);
  });

  it('leaves the draft alone when the level fails or no question passes', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await seedMoonDraft();
    fake.answers.push(
      () => new GenerationError('Claude refused.', usage()),
      () => ({ questions: [], short: true, usage: usage() }),
    );
    const refused = await jobIdOf(await app.replace('moon', 'm1'));
    const empty = await jobIdOf(await app.add('moon'));
    await app.jobs.idle();
    expect(await app.job(refused)).toMatchObject({ state: 'failed', error: 'Claude refused.' });
    expect((await app.job(refused)).usage.costUsd).toBeGreaterThan(0);
    expect(await app.job(empty)).toMatchObject({ state: 'failed', error: /fact check/ });
    expect(moonDraft().questions).toEqual(MOON_QUESTIONS);
  });

  it('answers 404 for a set with no draft, an unknown set or question, and 400 for a bad note', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await seedMoonDraft();
    const statuses = [
      (await app.replace('river1', 'q1')).status,
      (await app.add('river1')).status,
      (await app.replace('nope', 'q1')).status,
      (await app.replace('moon', 'nope')).status,
      (await app.replace('moon', 'm1', { note: 'x'.repeat(201) })).status,
      (await app.add('moon', { note: 3 })).status,
    ];
    expect(statuses).toEqual([404, 404, 404, 404, 400, 400]);
    const badJson = await app.send('POST', '/built-in-sets/moon/questions/add', undefined, {});
    expect(badJson.status).toBe(202);
    await app.jobs.idle();
    expect(fake.calls).toHaveLength(1);
  });

  it('refuses a draft with no category or difficulty (400) and answers 503 with no key', async () => {
    const app = await signedIn();
    await seedMoonDraft({ difficulty: undefined });
    const res = await app.replace('moon', 'm1');
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toMatch(/category and a difficulty/);

    server!.close();
    const off = await signedIn({ generate: null });
    expect((await off.replace('moon', 'm1')).status).toBe(503);
    expect((await off.add('moon')).status).toBe(503);
  });
});

describe('POST /api/admin/built-in-sets/:id/questions/add', () => {
  it('appends one question with a new id and the level’s points; old is null', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await seedMoonDraft({ difficulty: 'hard' });
    const id = await jobIdOf(await app.add('moon', { note: 'about Neptune' }));
    await app.jobs.idle();
    const job = await app.job(id);
    expect(job.questionId).toBeNull();
    const added = job.replaced!.new;
    expect(job.replaced!.old).toBeNull();
    expect(added).toMatchObject({ text: 'Moons hard question 1.1?', points: 300 });
    expect(MOON_QUESTIONS.map((q) => q.id)).not.toContain(added.id);
    expect(moonDraft().questions).toEqual([...MOON_QUESTIONS, added]);
    expect(fake.calls[0]!.avoid).toEqual(MOON_QUESTIONS.map((q) => q.text));
  });

  it('refuses (409) a draft that is already full', async () => {
    const app = await signedIn();
    await seedMoonDraft({
      questions: Array.from({ length: 100 }, (_, i) => makeQuestion(i + 1)),
    });
    const res = await app.add('moon');
    expect(res.status).toBe(409);
    expect(await errorOf(res)).toMatch(/100 questions/);
  });
});

describe('the replacements queue', () => {
  it('runs replace jobs one at a time, first in first out, and lists them per set', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await seedMoonDraft();
    await jobIdOf(await app.generate({ category: 'Comets', levels: levels('easy') }));
    await app.jobs.idle();
    const [comets] = draftsTitled('Comets – Easy');
    const gate = fake.hold();
    const first = await jobIdOf(await app.replace('moon', 'm3'));
    const other = await jobIdOf(await app.add(comets!.id));
    const second = await jobIdOf(await app.replace('moon', 'm1'));
    const third = await jobIdOf(await app.add('moon'));
    await tick();

    const listed = await app.replaces('moon');
    expect(listed.map((j) => [j.id, j.state, j.queuePosition])).toEqual([
      [first, 'writing', null],
      [second, 'queued', 2],
      [third, 'queued', 3],
    ]);
    expect((await app.replaces(comets!.id)).map((j) => [j.id, j.queuePosition])).toEqual([
      [other, 1],
    ]);
    // Replaces are not the dashboard's running generation.
    expect((await app.categories()).generation.running).toBeNull();

    gate.resolve();
    await app.jobs.idle();
    // The generate, then each replace in the order asked.
    expect(fake.calls.map((c) => c.category)).toEqual([
      'Comets',
      'Moons',
      'Comets',
      'Moons',
      'Moons',
    ]);
    const finished = await app.replaces('moon');
    expect(finished.map((j) => [j.id, j.state])).toEqual([
      [third, 'done'],
      [second, 'done'],
      [first, 'done'],
    ]);
    expect(moonDraft().questions).toHaveLength(4);
    expect((await app.get('/jobs')).status).toBe(400);
    expect(await app.replaces('nothing')).toEqual([]);
  });

  it('refuses a generate or regenerate (409) while a replace is queued or running', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await seedMoonDraft();
    const gate = fake.hold();
    await jobIdOf(await app.replace('moon', 'm1'));
    await tick();
    const refused = await app.generate({ category: 'Stars', levels: levels('easy') });
    expect(refused.status).toBe(409);
    expect(await errorOf(refused)).toMatch(/being replaced/);
    expect((await app.regenerate('river1')).status).toBe(409);
    gate.resolve();
    await app.jobs.idle();
    await jobIdOf(await app.generate({ category: 'Stars', levels: levels('easy') }));
  });

  it('queues a replace behind a running generate, and runs it after', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await seedMoonDraft();
    const gate = fake.hold();
    const generation = await jobIdOf(
      await app.generate({ category: 'Stars', levels: levels('easy', 'hard') }),
    );
    await tick();
    const replace = await jobIdOf(await app.replace('moon', 'm1'));
    expect(await app.job(replace)).toMatchObject({ state: 'queued', queuePosition: 1 });
    expect((await app.categories()).generation.running?.id).toBe(generation);
    gate.resolve();
    await app.jobs.idle();
    expect(fake.calls.map((c) => `${c.category} ${c.difficulty}`)).toEqual([
      'Stars easy',
      'Stars hard',
      'Moons easy',
    ]);
    expect((await app.job(replace)).state).toBe('done');
  });

  it('refuses publishing or deleting a category while it has a replace queued or running', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await seedMoonDraft();
    const gate = fake.hold();
    await jobIdOf(await app.replace('moon', 'm1'));
    expect((await app.send('POST', '/categories/Moons/publish')).status).toBe(409);
    expect((await app.send('DELETE', '/categories/moons')).status).toBe(409);
    gate.resolve();
    await app.jobs.idle();
    expect((await app.send('POST', '/categories/Moons/publish')).status).toBe(200);
  });
});

describe('POST /api/admin/jobs/:id/cancel', () => {
  it('stops a queued replace at once: it never runs and costs nothing', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await seedMoonDraft();
    const gate = fake.hold();
    const running = await jobIdOf(await app.replace('moon', 'm1'));
    const queued = await jobIdOf(await app.replace('moon', 'm2'));
    const last = await jobIdOf(await app.add('moon'));
    await tick();
    app.advance(1000);
    const res = await app.cancel(queued);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: queued,
      state: 'cancelled',
      finishedAt: T0 + 1000,
    });
    expect((await app.job(last)).queuePosition).toBe(1);
    gate.resolve();
    await app.jobs.idle();
    expect(fake.calls).toHaveLength(2);
    expect((await app.job(running)).state).toBe('done');
    expect(moonDraft().questions.find((q) => q.id === 'm2')).toEqual(MOON_QUESTIONS[1]);
    expect((await app.categories()).generation.replacements.usedToday).toBe(2);
  });

  it('stops a running replace after its current call, leaving the draft, and it still counts', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    await seedMoonDraft();
    const gate = fake.hold();
    const id = await jobIdOf(await app.replace('moon', 'm1'));
    const next = await jobIdOf(await app.replace('moon', 'm2'));
    await tick();
    const res = await app.cancel(id);
    expect(res.status).toBe(200);
    // Still in its API call.
    expect(((await res.json()) as GenerateJob).state).toBe('writing');
    gate.resolve();
    await app.jobs.idle();
    const cancelled = await app.job(id);
    expect(cancelled).toMatchObject({ state: 'cancelled', error: null, replaced: null });
    expect(cancelled.usage.costUsd).toBeGreaterThan(0);
    expect(moonDraft().questions[0]).toEqual(MOON_QUESTIONS[0]);
    // The queue goes on.
    expect((await app.job(next)).state).toBe('done');
    expect((await app.categories()).generation.replacements.usedToday).toBe(2);
  });

  it('stops a generate after its current call: saved levels stay drafts, the cancelled level counts', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    const result = (request: LevelRequest): LevelResult => ({
      questions: [{ text: `${request.difficulty}?`, answer: 'A' }],
      short: true,
      usage: usage(),
    });
    fake.answers.push(result, (request) => {
      // The admin cancels while the Medium level's last call runs.
      app.jobs.cancel(app.jobs.running()!.id);
      return result(request);
    });
    const id = await jobIdOf(
      await app.generate({ category: 'Stars', levels: levels('easy', 'medium', 'hard') }),
    );
    await app.jobs.idle();
    const job = await app.job(id);
    expect(job.state).toBe('cancelled');
    expect(job.finished.map((l) => l.title)).toEqual(['Stars – Easy']);
    expect(Object.values(builtIns.read().drafts).map((d) => d.title)).toEqual(['Stars – Easy']);
    expect(fake.calls).toHaveLength(2);
    const listed = await app.categories();
    expect(listed.generation.usedToday).toBe(2);
    expect(listed.categories.find((c) => c.name === 'Stars')!.job?.state).toBe('cancelled');
  });

  it('cancels a generate before its first level when asked at once', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    // Straight after the start, before the job's first tick.
    const started = app.jobs.start({
      kind: 'generate',
      category: 'Stars',
      guidance: '',
      levels: levels('easy'),
    });
    if (!started.ok) throw new Error(started.error);
    expect(app.jobs.cancel(started.job.id)).toMatchObject({ ok: true });
    await app.jobs.idle();
    expect((await app.job(started.job.id)).state).toBe('cancelled');
    expect(fake.calls).toEqual([]);
    expect((await app.categories()).generation.usedToday).toBe(0);
    // A cancelled new category with no set can be cleared like a failed one.
    expect((await app.send('DELETE', '/categories/Stars')).status).toBe(200);
  });

  it('answers 404 for an unknown job and 409 for a finished one', async () => {
    const app = await signedIn();
    await seedMoonDraft();
    expect((await app.cancel('nope')).status).toBe(404);
    const id = await jobIdOf(await app.replace('moon', 'm1'));
    await app.jobs.idle();
    const late = await app.cancel(id);
    expect(late.status).toBe(409);
    expect(await errorOf(late)).toMatch(/already finished/);
  });
});

describe('GENERATE_REPLACE_DAILY_LIMIT', () => {
  it('answers 429 past the day’s replacements, queued ones counted, apart from the levels', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({
      generate: fake.generate,
      dailyLimit: 1,
      replaceDailyLimit: 2,
      start: Date.UTC(2027, 0, 15, 23),
    });
    await seedMoonDraft();
    const gate = fake.hold();
    await jobIdOf(await app.replace('moon', 'm1'));
    const queued = await jobIdOf(await app.add('moon'));
    await tick();
    const over = await app.replace('moon', 'm2');
    expect(over.status).toBe(429);
    expect(await errorOf(over)).toMatch(/Daily limit reached: 2 replacements a day/);
    expect((await app.categories()).generation.replacements).toEqual({
      usedToday: 1,
      dailyLimit: 2,
    });
    // A cancelled queued one gives its place back.
    await app.cancel(queued);
    await jobIdOf(await app.replace('moon', 'm2'));
    gate.resolve();
    await app.jobs.idle();
    expect((await app.replace('moon', 'm3')).status).toBe(429);
    const listed = await app.categories();
    expect(listed.generation.replacements.usedToday).toBe(2);
    // The levels are counted apart.
    expect(listed.generation.usedToday).toBe(0);
    await jobIdOf(await app.generate({ category: 'Stars', levels: levels('easy') }));
    await app.jobs.idle();

    app.advance(HOUR);
    expect((await app.categories()).generation.replacements.usedToday).toBe(0);
    await jobIdOf(await app.replace('moon', 'm3'));
  });
});

describe('admin only', () => {
  it('answers 401 to every category and job route without a session', async () => {
    const app = await signedIn();
    const anon = { cookie: '' };
    const responses = [
      await app.get('/categories', anon),
      await app.get('/jobs/x', anon),
      await app.send(
        'POST',
        '/categories/generate',
        { category: 'M', levels: levels('easy') },
        anon,
      ),
      await app.send('POST', '/built-in-sets/river1/regenerate', undefined, anon),
      await app.send('POST', '/categories/Rivers/publish', undefined, anon),
      await app.send('DELETE', '/categories/Rivers', undefined, anon),
      await app.send('POST', '/built-in-sets/river1/questions/q1/replace', {}, anon),
      await app.send('POST', '/built-in-sets/river1/questions/add', {}, anon),
      await app.get('/jobs?setId=river1', anon),
      await app.send('POST', '/jobs/x/cancel', undefined, anon),
    ];
    expect(responses.map((r) => r.status)).toEqual(Array(10).fill(401));
    expect(builtIns.read().sets).toHaveLength(3);
  });

  it('refuses a write from another origin (403) or not sent as JSON (415)', async () => {
    const fake = fakeGenerator();
    const app = await signedIn({ generate: fake.generate });
    const body = { category: 'Moons', levels: levels('easy') };
    const writes = [
      () => app.send('POST', '/categories/generate', body, { origin: 'https://evil.example' }),
      () =>
        app.send('POST', '/built-in-sets/river1/regenerate', undefined, {
          'content-type': 'text/plain',
        }),
      () =>
        app.send('POST', '/categories/Rivers/publish', undefined, {
          origin: 'https://evil.example',
        }),
      () => app.send('DELETE', '/categories/Rivers', undefined, { 'content-type': 'text/plain' }),
      () =>
        app.send(
          'POST',
          '/built-in-sets/river1/questions/q1/replace',
          {},
          {
            origin: 'https://evil.example',
          },
        ),
      () =>
        app.send('POST', '/built-in-sets/river1/questions/add', undefined, {
          'content-type': 'text/plain',
        }),
      () => app.send('POST', '/jobs/x/cancel', undefined, { origin: 'https://evil.example' }),
    ];
    const statuses = [];
    for (const write of writes) statuses.push((await write()).status);
    expect(statuses).toEqual([403, 415, 403, 415, 403, 415, 403]);
    expect(fake.calls).toEqual([]);
    expect(builtIns.read().sets).toHaveLength(3);
  });
});
