// `/api/admin/generate` (F83): word generation through the admin, on a real CategoryStore in a temp
// folder with the fake generator (no API, no waiting). Generation off without a key, a new
// category drafted, reviewed and saved hidden, "Generate more" avoiding the category's words, the
// guards, and drafts kept out of the store, the lobby and the logs until saved.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AdminDraftSaveResponse,
  AdminGenerateStatus,
  AdminGenerationJob,
  AdminGenerationResponse,
} from '../shared/types.js';
import { AdminSessions } from './admin.js';
import { openAdminPassword } from './adminPassword.js';
import { openCategoryStore, type CategoryStore } from './categoryStore.js';
import { FAKE_EMOJI, fakeGenerator } from './generate/fake.js';
import { GenerationError } from './generate/generator.js';
import { openGenerationHistory, HISTORY_FILE, type GenerationHistory } from './generate/history.js';
import { createGenerationRunner, type GenerateFn, type GenerationRunner } from './generate/jobs.js';
import { GENERATION_OFF } from './generate/setup.js';
import { createApp } from './http.js';
import { InMemoryRoomStore } from './roomStore.js';
import { lobbyCategories } from './snapshot.js';
import { testHash } from './test/admin.js';
import { EN_PACK, SPICY_PACK } from './test/packs.js';

const CODE = 'pencil-moon-42';
const PASSWORD = 'a very long password';

let dir: string;
let servers: Server[] = [];
let store: CategoryStore;
let base: string;
let cookie: string;
let runner: GenerationRunner;
let history: GenerationHistory;
/** The history's writes, awaited before a test reads the file or removes the folder. */
let writes: Promise<void>[] = [];
let logged: string[];
/** What the fake generator waits on in each stage: settled at once unless a test holds it. */
let gate: Promise<void>;

/**
 * A server over a fresh store, signed in, with the fake generator unless `off` or another
 * `generate`, and the spend history in the same folder (F84).
 */
async function start({
  off = false,
  capUsd = 5,
  generate,
  clock = Date.now,
}: {
  off?: boolean;
  capUsd?: number;
  generate?: GenerateFn;
  clock?: () => number;
} = {}): Promise<void> {
  store = await openCategoryStore(dir, { seed: [EN_PACK, SPICY_PACK] });
  const { password } = await openAdminPassword(dir);
  history = await openGenerationHistory(dir, { capUsd, warn: (m) => logged.push(m) });
  const generationHistory = history;
  runner = createGenerationRunner({
    generate: off ? null : (generate ?? fakeGenerator({ stepMs: 0, wait: () => gate })),
    mode: off ? 'off' : 'fake',
    offMessage: GENERATION_OFF,
    clock,
    log: (m) => logged.push(m),
    refusal: () => generationHistory.refusal(clock()),
    onEnded: (job, usage, endedAt) => {
      writes.push(generationHistory.record(job, usage, endedAt));
    },
  });
  const server = createApp({
    rooms: new InMemoryRoomStore(),
    categories: store,
    clock,
    admin: {
      setupCode: CODE,
      password,
      sessions: new AdminSessions(),
      hash: testHash,
      categories: store,
      generation: runner,
      history,
    },
  }).listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let res = await send('POST', '/setup', { setupCode: CODE, password: PASSWORD }, '');
  // A restart over the same folder: the password is already set.
  if (res.status === 409) res = await send('POST', '/login', { password: PASSWORD }, '');
  cookie = res.headers.getSetCookie()[0]!.split(';')[0]!;
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sketchy-admin-generate-'));
  logged = [];
  gate = Promise.resolve();
  // Everything the server logs, to show no drafted word reaches a log line.
  for (const level of ['log', 'warn', 'error', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });
  }
});

afterEach(async () => {
  await Promise.all(writes);
  writes = [];
  await Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve))));
  servers = [];
  await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function send(
  method: string,
  path: string,
  body?: unknown,
  c = cookie,
  origin: string | null = base,
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (origin !== null) headers.origin = origin;
  if (c) headers.cookie = c;
  return fetch(`${base}/api/admin${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const get = (path: string, c = cookie) =>
  fetch(`${base}/api/admin${path}`, { headers: c ? { cookie: c } : {} });

/** Starts a generation and waits for it to end, returning the finished job. */
async function generated(body: object): Promise<AdminGenerationJob> {
  const res = await send('POST', '/generate', body);
  expect(res.status).toBe(202);
  const { job } = (await res.json()) as AdminGenerationResponse;
  expect(job.status).toBe('running');
  await runner.idle();
  await Promise.all(writes);
  return ((await (await get(`/generate/${job.id}`)).json()) as AdminGenerationResponse).job;
}

describe('generation off', () => {
  it('says why, and refuses to start, when the server has no key', async () => {
    await start({ off: true });
    const status = (await (await get('/generate')).json()) as AdminGenerateStatus;
    expect(status).toEqual({
      mode: 'off',
      off: 'Generation is off: the server has no SKETCHY_ANTHROPIC_API_KEY.',
      jobs: [],
      spend: {
        capUsd: 5,
        monthUsd: 0,
        allTimeUsd: 0,
        last: null,
        history: [],
        total: 0,
        refused: null,
      },
    });
    const res = await send('POST', '/generate', { title: 'Kitchen' });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: GENERATION_OFF });
  });
});

describe('the guards', () => {
  beforeEach(() => start());

  it('needs a session on every route, and this site’s Origin on writes', async () => {
    expect((await get('/generate', '')).status).toBe(401);
    expect((await get('/generate/abc', '')).status).toBe(401);
    expect((await send('POST', '/generate', { title: 'Kitchen' }, '')).status).toBe(401);
    expect((await send('POST', '/generate/abc/save', { words: [] }, '')).status).toBe(401);
    expect((await send('DELETE', '/generate/abc', {}, '')).status).toBe(401);
    expect((await send('POST', '/generate', { title: 'Kitchen' }, cookie, null)).status).toBe(403);
    expect(runner.list()).toEqual([]);
  });

  it('checks the title and a count of 10 to 100, naming the field', async () => {
    for (const [body, field] of [
      [{ title: '' }, 'title'],
      [{ title: 'Kitchen', count: 9 }, 'count'],
      [{ title: 'Kitchen', count: 101 }, 'count'],
      [{ title: 'Kitchen', count: 40.5 }, 'count'],
      [{ categoryId: 'NOPE' }, 'categoryId'],
      [{ title: 'Kitchen', extra: 1 }, 'extra'],
    ] as const) {
      const res = await send('POST', '/generate', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(((await res.json()) as { field: string }).field).toBe(field);
    }
    const missing = await send('POST', '/generate', { categoryId: 'no-such' });
    expect(missing.status).toBe(404);
    expect(runner.list()).toEqual([]);
  });
});

describe('a new category', () => {
  beforeEach(() => start());

  it('drafts 40 words by default with an emoji, and keeps the draft out of the store and lobby', async () => {
    const job = await generated({ title: 'Everyday things' });
    expect(job).toMatchObject({ kind: 'new', status: 'ready', count: 40, error: null });
    expect(job.draft!.emoji).toBe(FAKE_EMOJI);
    expect(job.draft!.words).toHaveLength(40);
    const file = await readFile(store.path, 'utf8');
    const lobby = JSON.stringify(lobbyCategories(store.read()));
    for (const w of job.draft!.words.slice(0, 10)) {
      // Not saved, so nowhere a room reads from.
      if (!EN_PACK.words.some((e) => e.word === w.word)) {
        expect(file).not.toContain(`"${w.word}"`);
      }
      expect(lobby).not.toContain(w.word);
    }
    const status = (await (await get('/generate')).json()) as AdminGenerateStatus;
    expect(status.mode).toBe('fake');
    expect(status.jobs.map((j) => j.id)).toEqual([job.id]);
  });

  it('saves the reviewed words (unticked left out, edits kept) as a hidden category, then forgets the draft', async () => {
    const job = await generated({ title: 'Everyday things', count: 10 });
    const [first, second, , fourth] = job.draft!.words;
    const res = await send('POST', `/generate/${job.id}/save`, {
      title: 'Odds and ends',
      emoji: '🧺',
      words: [
        first,
        { word: 'tea kettle', difficulty: 3, alt: ['kettle'] },
        { ...fourth!, alt: [...fourth!.alt, 'thingamajig'] },
      ],
    });
    expect(res.status).toBe(200);
    const saved = (await res.json()) as AdminDraftSaveResponse;
    expect(saved.added).toBe(3);
    expect(saved.duplicates).toBe(0);
    expect(saved.category).toMatchObject({
      id: 'odds-and-ends',
      title: 'Odds and ends',
      emoji: '🧺',
      hidden: true,
      defaultOn: false,
    });
    expect(saved.category.words.map((w) => [w.word, w.difficulty, w.alt])).toEqual([
      [first!.word, first!.difficulty, first!.alt],
      ['tea kettle', 3, ['kettle']],
      [fourth!.word, fourth!.difficulty, [...fourth!.alt, 'thingamajig']],
    ]);
    expect(saved.category.words.map((w) => w.word)).not.toContain(second!.word);
    // Saved to the file; hidden, so not in the lobby until the admin unhides it.
    expect(store.read().find((c) => c.id === 'odds-and-ends')!.hidden).toBe(true);
    expect(lobbyCategories(store.read()).map((c) => c.id)).not.toContain('odds-and-ends');
    expect(await readFile(store.path, 'utf8')).toContain('"tea kettle"');
    // The draft is gone: a second save can't make a second category.
    expect((await get(`/generate/${job.id}`)).status).toBe(404);
    expect((await send('POST', `/generate/${job.id}/save`, { words: [first] })).status).toBe(404);
  });

  it('uses the draft’s title and emoji when the save leaves them out, and skips repeats', async () => {
    const job = await generated({ title: 'Everyday things', count: 10 });
    const [first] = job.draft!.words;
    const saved = (await (
      await send('POST', `/generate/${job.id}/save`, { words: [first, { ...first!, alt: [] }] })
    ).json()) as AdminDraftSaveResponse;
    expect(saved.category).toMatchObject({ title: 'Everyday things', emoji: FAKE_EMOJI });
    expect(saved).toMatchObject({ added: 1, duplicates: 1 });
  });

  it('refuses a word the store would refuse, naming it, and keeps the draft to fix', async () => {
    const job = await generated({ title: 'Everyday things', count: 10 });
    const before = await readFile(store.path, 'utf8');
    const [first] = job.draft!.words;
    const res = await send('POST', `/generate/${job.id}/save`, {
      words: [first, { word: 'ab', difficulty: 1, alt: [] }],
    });
    expect(res.status).toBe(400);
    const refused = (await res.json()) as { field: string; error: string };
    expect(refused.field).toBe('words.1.word');
    expect(refused.error).toMatch(/^Word 2: Word must keep at least 3 letters/);
    const shape = await send('POST', `/generate/${job.id}/save`, {
      words: [{ word: first!.word, difficulty: 4, alt: [] }],
    });
    expect(await shape.json()).toMatchObject({ field: 'words.0.difficulty' });
    const none = await send('POST', `/generate/${job.id}/save`, { words: [] });
    expect(await none.json()).toMatchObject({
      field: 'words',
      error: 'Words Tick at least one word.',
    });
    expect(await readFile(store.path, 'utf8')).toBe(before);
    // Still there, and a good save works.
    expect((await send('POST', `/generate/${job.id}/save`, { words: [first] })).status).toBe(200);
  });

  it('runs one at a time, and a draft can be discarded', async () => {
    let open!: () => void;
    gate = new Promise((resolve) => (open = resolve));
    const held = await send('POST', '/generate', { title: 'One' });
    const busy = await send('POST', '/generate', { title: 'Two' });
    expect(busy.status).toBe(409);
    const { job } = (await held.json()) as AdminGenerationResponse;
    // A running generation can't be discarded; it ends by itself.
    expect((await send('DELETE', `/generate/${job.id}`, {})).status).toBe(409);
    open();
    await runner.idle();
    expect((await send('DELETE', `/generate/${job.id}`, {})).status).toBe(200);
    expect((await get(`/generate/${job.id}`)).status).toBe(404);
    expect((await send('DELETE', `/generate/${job.id}`, {})).status).toBe(404);
  });

  it('a failed generation says why', async () => {
    const job = await generated({ title: 'Fail on purpose' });
    expect(job).toMatchObject({ status: 'failed', draft: null });
    expect(job.error).toContain('fake generator fails');
  });
});

describe('Generate more', () => {
  beforeEach(() => start());

  it('drafts words that avoid the category’s words, then adds the kept ones, skipping repeats', async () => {
    const category = store.read().find((c) => c.id === 'test-en')!;
    const existing = new Set(category.words.map((w) => w.word));
    const job = await generated({ categoryId: 'test-en', count: 20 });
    expect(job).toMatchObject({ kind: 'more', categoryId: 'test-en', title: category.title });
    expect(job.draft!.words.length).toBeGreaterThan(0);
    for (const w of job.draft!.words) expect(existing.has(w.word), w.word).toBe(false);

    const kept = job.draft!.words.slice(0, 5);
    const res = await send('POST', `/generate/${job.id}/save`, {
      // The category's own word comes back as a repeat; title and emoji are not changed.
      words: [...kept, { word: 'apple', difficulty: 1, alt: [] }],
      title: 'Ignored',
    });
    const saved = (await res.json()) as AdminDraftSaveResponse;
    expect(saved).toMatchObject({ added: 5, duplicates: 1 });
    expect(saved.category).toMatchObject({ id: 'test-en', title: category.title, hidden: false });
    expect(saved.category.words.map((w) => w.word)).toEqual([
      ...category.words.map((w) => w.word),
      ...kept.map((w) => w.word),
    ]);
  });

  it('refuses to save into a category deleted since, keeping the draft', async () => {
    const job = await generated({ categoryId: 'test-en', count: 10 });
    expect((await send('DELETE', '/categories/test-en', {})).status).toBe(200);
    const res = await send('POST', `/generate/${job.id}/save`, { words: job.draft!.words });
    expect(res.status).toBe(404);
    expect((await get(`/generate/${job.id}`)).status).toBe(200);
  });
});

describe('the logs', () => {
  beforeEach(() => start());

  it('never carry a drafted word or the title', async () => {
    const job = await generated({ title: 'Secret theme', count: 30 });
    await send('POST', `/generate/${job.id}/save`, { words: job.draft!.words.slice(0, 3) });
    const all = logged.join('\n');
    expect(all).toContain('kept 30 of 30 words');
    expect(all).not.toContain('Secret theme');
    for (const w of job.draft!.words) {
      for (const form of [w.word, ...w.alt]) expect(all).not.toContain(form);
    }
  });
});

describe('spend and the monthly cap (F84)', () => {
  const NOV_3 = Date.UTC(2026, 10, 3, 12);
  /** A generator that spends $1.50 (Sonnet output) and keeps the fake's words. */
  const spent = [
    {
      model: 'claude-sonnet-5-5',
      inputTokens: 0,
      outputTokens: 150_000,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
  ];
  const fake = fakeGenerator({ stepMs: 0, wait: () => Promise.resolve() });
  const costly: GenerateFn = async (request, onStage) => {
    try {
      return { ...(await fake(request, onStage)), usage: spent };
    } catch (err) {
      // A failed generation still spent what it spent.
      throw new GenerationError((err as Error).message, spent);
    }
  };

  it('prices each generation into generation-history.json and shows the tiles and history', async () => {
    await start({ generate: costly, clock: () => NOV_3 });
    await generated({ title: 'Kitchen', count: 12 });
    await generated({ title: 'fail on purpose', count: 10 });
    const status = (await (await get('/generate')).json()) as AdminGenerateStatus;
    expect(status.spend).toMatchObject({ capUsd: 5, total: 2, refused: null });
    expect(status.spend.monthUsd).toBeCloseTo(3);
    expect(status.spend.allTimeUsd).toBeCloseTo(3);
    expect(status.spend.history.map((e) => [e.title, e.count, e.kept, e.outcome])).toEqual([
      ['fail on purpose', 10, 0, 'failed'],
      ['Kitchen', 12, 12, 'ready'],
    ]);
    expect(status.spend.last).toEqual(status.spend.history[0]);
    // On disk, with no drafted word.
    const file = await readFile(join(dir, HISTORY_FILE), 'utf8');
    expect(JSON.parse(file).entries).toHaveLength(2);
    const draft = runner.list().find((j) => j.status === 'ready')!.draft!;
    for (const w of draft.words) expect(file).not.toContain(`"${w.word}"`);
  });

  it('refuses a start once the month reaches the cap, showing the spend and the cap; the history survives a restart', async () => {
    await start({ generate: costly, capUsd: 2.5, clock: () => NOV_3 });
    await generated({ title: 'Kitchen', count: 10 });
    // $1.50 of $2.50: one more may start, and ends past the cap.
    await generated({ title: 'Garden', count: 10 });
    const refusedText =
      'This month’s generation spend is $3.00, and the cap is $2.50 (SKETCHY_GENERATION_CAP_USD). Generation opens again on 1 December (UTC).';
    let res = await send('POST', '/generate', { title: 'Zoo' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: refusedText });
    expect(((await (await get('/generate')).json()) as AdminGenerateStatus).spend.refused).toBe(
      refusedText,
    );
    // Generate more on a category is refused too.
    res = await send('POST', '/generate', { categoryId: 'test-en' });
    expect(res.status).toBe(409);

    // After a restart the month's spend is still there, so the cap still holds.
    await start({ generate: costly, capUsd: 2.5, clock: () => NOV_3 });
    expect((await send('POST', '/generate', { title: 'Zoo' })).status).toBe(409);
    // In December it starts over.
    await start({ generate: costly, capUsd: 2.5, clock: () => Date.UTC(2026, 11, 1) });
    const status = (await (await get('/generate')).json()) as AdminGenerateStatus;
    expect(status.spend).toMatchObject({ monthUsd: 0, total: 2, refused: null });
    expect(status.spend.allTimeUsd).toBeCloseTo(3);
    expect((await send('POST', '/generate', { title: 'Zoo', count: 10 })).status).toBe(202);
  });
});
