import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  AdminCategoriesResponse,
  AdminPublishAllErrorBody,
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
  /** The clock's start; T0 by default. */
  start?: number;
}

/** The app with the store and a job runner, signed in. */
async function signedIn({
  generate = fakeGenerator().generate,
  dailyLimit = 20,
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
        status: 'draft',
      },
      {
        setId: 'river2',
        title: 'Rivers – Medium',
        difficulty: 'medium',
        questions: 2,
        status: 'new',
      },
      { setId: 'river3', title: 'Rivers – Hard', difficulty: 'hard', questions: 2, status: 'live' },
    ]);
    expect(categories[1]!.job).toBeNull();
    expect(generation).toEqual({ enabled: true, usedToday: 0, dailyLimit: 20, running: null });
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
    ];
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401]);
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
    ];
    const statuses = [];
    for (const write of writes) statuses.push((await write()).status);
    expect(statuses).toEqual([403, 415, 403, 415]);
    expect(fake.calls).toEqual([]);
    expect(builtIns.read().sets).toHaveLength(3);
  });
});
