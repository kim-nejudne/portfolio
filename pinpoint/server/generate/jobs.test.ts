import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Box, Category, GenerationHistoryEntry, Place, PlaceKind } from '#shared/types.js';
import { CategoryStore } from '../categoryStore.js';
import { GenerationError } from './generator.js';
import {
  DISK_FULL_ERROR,
  GENERATION_BUSY_ERROR,
  NO_PLACE_ERROR,
  REPLACES_BUSY_ERROR,
  createJobRunner,
  photosOver,
  withNote,
  type JobRequest,
  type JobRunnerOptions,
  type LevelFn,
} from './jobs.js';
import type { LevelDeps, LevelRequest, LevelResult } from './pipeline.js';
import { emptyUsage } from './pricing.js';

const BOX: Box = { south: 24, west: 122, north: 46, east: 146 };
// 2026-11-08 23:00 UTC: an hour before the day's limits reset.
const T0 = Date.UTC(2026, 10, 8, 23);
const HOUR = 60 * 60 * 1000;

let q = 100;
function place(kind: PlaceKind, name = `${kind} ${q}`, id = `p${q}`): Place {
  q++;
  return {
    id,
    kind,
    name,
    displayName: name,
    autoDisplayName: true,
    fact: `A fact about ${name}.`,
    lat: 35,
    lng: 135,
    coordsSource: 'wikidata',
    wikidataId: `Q${q}`,
    countryId: 'Q17',
    countryName: 'Japan',
  };
}

function japan(): Category {
  return {
    id: 'japan',
    name: 'Japan',
    emoji: null,
    box: BOX,
    labelStyle: 'city',
    draftMeta: null,
    hidden: false,
    live: {},
    draft: {
      easy: {
        places: [place('city', 'Osaka', 'osaka'), place('landmark', 'Himeji Castle', 'himeji')],
        reviewed: true,
        updatedAt: 1,
      },
    },
    createdAt: 1,
    updatedAt: 1,
  };
}

interface Call {
  request: LevelRequest;
  hooks: Pick<LevelDeps, 'onStage' | 'onKept'>;
  signal: AbortSignal;
  resolve: (r: LevelResult) => void;
  reject: (e: unknown) => void;
}

/** A level function the test answers by hand, one call at a time. */
function stubLevel() {
  const calls: Call[] = [];
  const level: LevelFn = (request, hooks, signal) =>
    new Promise((resolve, reject) => calls.push({ request, hooks, signal, resolve, reject }));
  return { level, calls };
}

function result(places: Place[], costUsd = 0.5, dropped: LevelResult['dropped'] = []): LevelResult {
  return {
    places,
    dropped,
    usage: { ...emptyUsage(), costUsd },
    box: BOX,
    labelStyle: 'city',
    emoji: '🗾',
  };
}

/** Lets queued promise callbacks and the runner's next tick run. No real time passes. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

function setup(options: Partial<JobRunnerOptions> = {}) {
  const store = new CategoryStore([japan()], { now: () => now });
  let now = T0;
  const { level, calls } = stubLevel();
  const history: GenerationHistoryEntry[] = [];
  let id = 0;
  const jobs = createJobRunner({
    level,
    store,
    clock: () => now,
    dailyLimit: 20,
    replaceDailyLimit: 100,
    onEnded: (e) => history.push(e),
    newId: () => `job${++id}`,
    ...options,
  });
  const start = async (request: JobRequest) => {
    const started = await jobs.start(request);
    if (!started.ok) throw new Error(started.error);
    return started.job.id;
  };
  return { jobs, store, calls, history, start, advance: (ms: number) => (now += ms) };
}

const generate = (levels: Extract<JobRequest, { kind: 'generate' }>['levels']): JobRequest => ({
  kind: 'generate',
  name: 'Kansai',
  guidance: 'Mostly Kyoto',
  levels,
});
const replace = (placeId = 'osaka', note?: string): JobRequest => ({
  kind: 'replace',
  categoryId: 'japan',
  level: 'easy',
  placeId,
  ...(note ? { note } : {}),
});
const add = (placeKind: PlaceKind = 'city'): JobRequest => ({
  kind: 'add',
  categoryId: 'japan',
  level: 'easy',
  placeKind,
});

describe('generate and regenerate', () => {
  it('runs the levels easy to hard, creating the category on the first and saving each as an unreviewed draft', async () => {
    const { jobs, store, calls, start } = setup();
    const id = await start(generate({ hard: { count: 5 }, easy: { count: 5 } }));
    await settle();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.request).toMatchObject({
      category: 'Kansai',
      guidance: 'Mostly Kyoto',
      level: 'easy',
      count: 5,
      meta: null,
      avoid: [],
    });
    const easy = [place('city', 'Kyoto'), place('landmark', 'Kinkaku-ji')];
    calls[0]!.resolve(result(easy));
    await settle();
    const created = store.find('kansai')!;
    expect(created.draft.easy).toMatchObject({ reviewed: false });
    expect(created.draft.easy!.places.map((p) => p.name)).toEqual(['Kyoto', 'Kinkaku-ji']);
    // The second level is made for the category as saved: its box, and its names to avoid.
    expect(calls[1]!.request).toMatchObject({
      level: 'hard',
      meta: { box: BOX, labelStyle: 'city' },
      avoid: ['Kyoto', 'Kinkaku-ji'],
    });
    expect(calls[1]!.request.existingIds).toEqual(new Set(easy.map((p) => p.wikidataId)));
    calls[1]!.resolve(result([place('city', 'Nara')]));
    await jobs.idle();
    expect(jobs.get(id)).toMatchObject({
      state: 'done',
      categoryId: 'kansai',
      costUsd: 1,
      levels: [
        { level: 'easy', state: 'saved', kept: { city: 1, landmark: 1 } },
        { level: 'hard', state: 'saved', kept: { city: 1, landmark: 0 } },
      ],
    });
    expect(jobs.levelsLeft()).toBe(18);
  });

  it('generates more levels into an existing category, keeping the job’s guidance', async () => {
    const { jobs, store, calls, start } = setup();
    const id = await start({
      kind: 'generate',
      categoryId: 'japan',
      name: '',
      guidance: 'North',
      levels: { medium: { count: 5 } },
    });
    expect(jobs.get(id)).toMatchObject({
      categoryId: 'japan',
      category: 'Japan',
      guidance: 'North',
    });
    await settle();
    expect(calls[0]!.request).toMatchObject({
      category: 'Japan',
      meta: { box: BOX, labelStyle: 'city' },
      avoid: ['Osaka', 'Himeji Castle'],
    });
    calls[0]!.resolve(result([place('city', 'Sendai')]));
    await jobs.idle();
    expect(store.find('japan')!.draft.medium!.places.map((p) => p.name)).toEqual(['Sendai']);
    expect(store.list().map((c) => c.id)).toEqual(['japan']);
    const refused = await jobs.start({
      kind: 'generate',
      categoryId: 'nope',
      name: '',
      guidance: '',
      levels: { easy: { count: 5 } },
    });
    expect(refused).toMatchObject({ ok: false, status: 404 });
  });

  it('shows the running step and the places kept so far', async () => {
    const { jobs, calls, start } = setup();
    const id = await start(generate({ easy: { count: 5 } }));
    await settle();
    calls[0]!.hooks.onStage!('check');
    calls[0]!.hooks.onKept!({ city: 3, landmark: 2 });
    expect(jobs.get(id)!.levels[0]).toMatchObject({
      state: 'running',
      stage: 'check',
      kept: { city: 3, landmark: 2 },
    });
  });

  it('regenerates one level of a category over its draft, with the guidance given', async () => {
    const { jobs, store, calls, start } = setup();
    await start({
      kind: 'regenerate',
      categoryId: 'japan',
      level: 'easy',
      count: 6,
      guidance: 'North',
    });
    await settle();
    expect(calls[0]!.request).toMatchObject({
      category: 'Japan',
      level: 'easy',
      count: 6,
      guidance: 'North',
      meta: { box: BOX, labelStyle: 'city' },
      avoid: ['Osaka', 'Himeji Castle'],
    });
    calls[0]!.resolve(result([place('city', 'Sapporo')]));
    await jobs.idle();
    expect(store.find('japan')!.draft.easy).toMatchObject({
      reviewed: false,
      places: [{ name: 'Sapporo' }],
    });
  });

  it('refuses a second generation while one runs', async () => {
    const { jobs, start } = setup();
    await start(generate({ easy: { count: 5 } }));
    expect(await jobs.start(generate({ medium: { count: 5 } }))).toEqual({
      ok: false,
      status: 409,
      error: GENERATION_BUSY_ERROR,
    });
    expect(
      await jobs.start({ kind: 'regenerate', categoryId: 'japan', level: 'easy', count: 5 }),
    ).toMatchObject({ status: 409, error: GENERATION_BUSY_ERROR });
  });

  it('refuses a generation while a replacement is queued or running', async () => {
    const { jobs, calls, start } = setup();
    await start(replace());
    expect(await jobs.start(generate({ easy: { count: 5 } }))).toEqual({
      ok: false,
      status: 409,
      error: REPLACES_BUSY_ERROR,
    });
    await settle();
    calls[0]!.resolve(result([place('city', 'Kobe')]));
    await jobs.idle();
    expect((await jobs.start(generate({ easy: { count: 5 } }))).ok).toBe(true);
  });

  it('fails with the step’s message and its spend, keeping the levels already saved', async () => {
    const { jobs, store, calls, history, start } = setup();
    const id = await start(generate({ easy: { count: 5 }, medium: { count: 5 } }));
    await settle();
    calls[0]!.resolve(result([place('city', 'Kyoto')]));
    await settle();
    calls[1]!.reject(
      new GenerationError('The Claude API is overloaded or down. Try again later.', {
        ...emptyUsage(),
        costUsd: 0.25,
      }),
    );
    await jobs.idle();
    expect(jobs.get(id)).toMatchObject({
      state: 'failed',
      error: 'The Claude API is overloaded or down. Try again later.',
      costUsd: 0.75,
      levels: [{ state: 'saved' }, { state: 'failed' }],
    });
    expect(store.find('kansai')!.draft.easy).toBeDefined();
    expect(history[0]).toMatchObject({ outcome: 'failed', categoryId: 'kansai', costUsd: 0.75 });
  });

  it('fails a level where no place passed, saving nothing', async () => {
    const { jobs, store, calls, history, start } = setup();
    const id = await start(generate({ easy: { count: 5 } }));
    await settle();
    calls[0]!.resolve(result([]));
    await jobs.idle();
    expect(jobs.get(id)).toMatchObject({
      state: 'failed',
      error: 'No Easy place passed the checks. Try again.',
    });
    expect(store.find('kansai')).toBeUndefined();
    // No category was made: the history names the id it would have had.
    expect(history[0]).toMatchObject({ categoryId: 'kansai', category: 'Kansai' });
  });
});

describe('the replacement queue', () => {
  it('runs replacements and additions one at a time, first in first out, behind a generation', async () => {
    const { jobs, calls, start } = setup();
    const gen = await start({ kind: 'regenerate', categoryId: 'japan', level: 'medium', count: 5 });
    const a = await start(replace('osaka'));
    const b = await start(replace('himeji'));
    const c = await start(add('landmark'));
    expect([a, b, c].map((id) => jobs.get(id)!.queuePosition)).toEqual([1, 2, 3]);
    expect(jobs.get(a)!.state).toBe('queued');
    expect(jobs.list().map((j) => j.id)).toEqual([gen, a, b, c]);

    await settle();
    calls[0]!.resolve(result([place('city', 'Nagoya')]));
    await settle();
    expect(calls).toHaveLength(2);
    expect(calls[1]!.request).toMatchObject({ only: 'city', count: 1 });
    expect(jobs.get(a)!.state).toBe('running');
    expect([b, c].map((id) => jobs.get(id)!.queuePosition)).toEqual([1, 2]);
    calls[1]!.resolve(result([place('city', 'Kobe')]));
    await settle();
    expect(calls[2]!.request).toMatchObject({ only: 'landmark' });
    calls[2]!.resolve(result([place('landmark', 'Osaka Castle')]));
    await settle();
    calls[3]!.resolve(result([place('landmark', 'Tokyo Tower')]));
    await jobs.idle();
    expect([gen, a, b, c].map((id) => jobs.get(id)!.state)).toEqual([
      'done',
      'done',
      'done',
      'done',
    ]);
  });

  it('a replacement swaps the new place in under the old id, avoiding the old name and passing the note', async () => {
    const { jobs, store, calls, start } = setup();
    const id = await start(replace('osaka', 'too famous'));
    await settle();
    expect(calls[0]!.request).toMatchObject({
      level: 'easy',
      count: 1,
      only: 'city',
      guidance: withNote('', 'too famous'),
      avoid: ['Osaka', 'Himeji Castle'],
    });
    calls[0]!.resolve(result([place('city', 'Kobe', 'new-id')]));
    await jobs.idle();
    const places = store.find('japan')!.draft.easy!.places;
    expect(places.map((p) => [p.id, p.name])).toEqual([
      ['osaka', 'Kobe'],
      ['himeji', 'Himeji Castle'],
    ]);
    expect(jobs.get(id)!.replaced).toMatchObject({
      old: { id: 'osaka', name: 'Osaka' },
      new: { id: 'osaka', name: 'Kobe' },
    });
  });

  it('an addition appends one place of its mode', async () => {
    const { jobs, store, calls, history, start } = setup();
    const id = await start(add('city'));
    await settle();
    calls[0]!.resolve(result([place('city', 'Kobe')]));
    await jobs.idle();
    expect(store.find('japan')!.draft.easy!.places.map((p) => p.name)).toEqual([
      'Osaka',
      'Himeji Castle',
      'Kobe',
    ]);
    expect(jobs.get(id)!.replaced).toMatchObject({ old: null, new: { name: 'Kobe' } });
    expect(history[0]).toMatchObject({ kind: 'add', saved: { city: 1, landmark: 0 } });
  });

  it('refuses a replacement of a place that is not in the level', async () => {
    const { jobs } = setup();
    expect(await jobs.start(replace('nope'))).toEqual({
      ok: false,
      status: 404,
      error: NO_PLACE_ERROR,
    });
  });

  it('fails a replacement whose place was removed while it was written', async () => {
    const { jobs, store, calls, start } = setup();
    const id = await start(replace('osaka'));
    await settle();
    await store.removePlace('japan', 'easy', 'osaka');
    calls[0]!.resolve(result([place('city', 'Kobe')]));
    await jobs.idle();
    expect(jobs.get(id)).toMatchObject({ state: 'failed', error: 'No such place' });
  });
});

describe('cancel', () => {
  it('cancels a queued job at once; it never runs and does not count', async () => {
    const { jobs, calls, history, start } = setup({ replaceDailyLimit: 5 });
    await start(replace('osaka'));
    const b = await start(replace('himeji'));
    expect(jobs.replacementsLeft()).toBe(3);
    expect(jobs.cancel(b)).toMatchObject({ ok: true, job: { state: 'cancelled' } });
    expect(history).toMatchObject([{ outcome: 'cancelled', kind: 'replace' }]);
    expect(jobs.replacementsLeft()).toBe(4);
    await settle();
    calls[0]!.resolve(result([place('city', 'Kobe')]));
    await jobs.idle();
    expect(calls).toHaveLength(1);
  });

  it('stops a running job before its next call: the level in flight is not saved and still counts', async () => {
    const { jobs, store, calls, history, start } = setup();
    const id = await start(generate({ easy: { count: 5 }, hard: { count: 5 } }));
    await settle();
    expect(jobs.cancel(id)).toMatchObject({ ok: true });
    expect(calls[0]!.signal.aborted).toBe(true);
    // The call in flight finished anyway; its result is thrown away.
    calls[0]!.resolve(result([place('city', 'Kyoto')], 0.4));
    await jobs.idle();
    expect(calls).toHaveLength(1);
    expect(store.find('kansai')).toBeUndefined();
    expect(jobs.get(id)).toMatchObject({
      state: 'cancelled',
      costUsd: 0.4,
      levels: [{ state: 'cancelled' }, { state: 'waiting' }],
    });
    expect(jobs.levelsLeft()).toBe(19);
    expect(history[0]).toMatchObject({ outcome: 'cancelled', costUsd: 0.4 });
  });

  it('treats a call rejected by the abort as a cancel, not a failure', async () => {
    const { jobs, calls, start } = setup();
    const id = await start(replace());
    await settle();
    jobs.cancel(id);
    calls[0]!.reject(new GenerationError('Could not reach the Claude API.', emptyUsage()));
    await jobs.idle();
    expect(jobs.get(id)).toMatchObject({ state: 'cancelled', error: null });
  });

  it('refuses to cancel an ended or unknown job', async () => {
    const { jobs, calls, start } = setup();
    const id = await start(replace());
    await settle();
    calls[0]!.resolve(result([place('city', 'Kobe')]));
    await jobs.idle();
    expect(jobs.cancel(id)).toMatchObject({ ok: false, status: 409 });
    expect(jobs.cancel('nope')).toMatchObject({ ok: false, status: 404 });
  });
});

describe('daily limits', () => {
  it('counts levels per UTC day and resets at midnight', async () => {
    const { jobs, calls, start, advance } = setup({ dailyLimit: 2 });
    expect(
      await jobs.start(generate({ easy: { count: 5 }, medium: { count: 5 }, hard: { count: 5 } })),
    ).toEqual({
      ok: false,
      status: 429,
      error: 'Only 2 more levels can be generated today (UTC).',
    });
    await start(generate({ easy: { count: 5 }, medium: { count: 5 } }));
    await settle();
    calls[0]!.resolve(result([place('city')]));
    await settle();
    calls[1]!.resolve(result([place('city')]));
    await jobs.idle();
    expect(
      await jobs.start({ kind: 'regenerate', categoryId: 'japan', level: 'easy', count: 5 }),
    ).toEqual({
      ok: false,
      status: 429,
      error: 'Daily limit reached: 2 levels a day. Try again tomorrow (UTC).',
    });
    advance(HOUR); // 00:00 UTC
    expect(jobs.levelsLeft()).toBe(2);
    expect(
      (await jobs.start({ kind: 'regenerate', categoryId: 'japan', level: 'easy', count: 5 })).ok,
    ).toBe(true);
  });

  it('counts replacements and additions per UTC day, queued ones ahead, and resets at midnight', async () => {
    const { jobs, start, advance } = setup({ replaceDailyLimit: 2 });
    await start(replace('osaka'));
    await start(add());
    expect(await jobs.start(replace('himeji'))).toEqual({
      ok: false,
      status: 429,
      error: 'Daily limit reached: 2 replacements a day. Try again tomorrow (UTC).',
    });
    advance(HOUR);
    // The running one counted yesterday; the queued one still waits.
    expect(jobs.replacementsLeft()).toBe(1);
    expect((await jobs.start(replace('himeji'))).ok).toBe(true);
    expect(jobs.replacementsLeft()).toBe(0);
  });

  it('holds the replacement cap for two starts back to back, and counts one cancelled as it starts', async () => {
    const { jobs, calls } = setup({ replaceDailyLimit: 1 });
    const first = await jobs.start(replace('osaka'));
    expect(await jobs.start(add())).toMatchObject({ ok: false, status: 429 });
    if (first.ok) jobs.cancel(first.job.id);
    await settle();
    calls[0]!.reject(new Error('aborted'));
    await jobs.idle();
    expect(first.ok && jobs.get(first.job.id)!.state).toBe('cancelled');
    expect(jobs.replacementsLeft()).toBe(0);
  });
});

describe('guards', () => {
  it('refuses every job while the photo folder is over PHOTOS_MAX_MB', async () => {
    const { jobs, calls } = setup({ photosFull: () => Promise.resolve(true) });
    for (const request of [generate({ easy: { count: 5 } }), replace(), add()]) {
      expect(await jobs.start(request)).toEqual({ ok: false, status: 507, error: DISK_FULL_ERROR });
    }
    await settle();
    expect(calls).toHaveLength(0);
    expect(jobs.list()).toEqual([]);
  });

  it('measures the photo folder against the limit in MB', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pinpoint-photos-'));
    expect(await photosOver(join(dir, 'missing'), 1)()).toBe(false);
    await mkdir(join(dir, 'photos'));
    await writeFile(join(dir, 'photos', 'a.webp'), Buffer.alloc(600 * 1024));
    expect(await photosOver(join(dir, 'photos'), 1)()).toBe(false);
    await writeFile(join(dir, 'photos', 'b.webp'), Buffer.alloc(600 * 1024));
    expect(await photosOver(join(dir, 'photos'), 1)()).toBe(true);
  });

  it('answers 503 with the reason when generation is off', async () => {
    const { jobs } = setup({ level: null, off: 'Generation is off: no key.' });
    expect(jobs.off).toBe('Generation is off: no key.');
    expect(await jobs.start(replace())).toEqual({
      ok: false,
      status: 503,
      error: 'Generation is off: no key.',
    });
  });
});

describe('history', () => {
  it('records each ended job with its places saved, drops by reason and cost', async () => {
    const { jobs, calls, history, start } = setup();
    await start(generate({ easy: { count: 5 } }));
    await settle();
    calls[0]!.resolve(
      result([place('city'), place('city'), place('landmark')], 0.3, [
        { kind: 'city', name: 'A', reason: 'Not found on Wikidata' },
        { kind: 'landmark', name: 'B', reason: 'Not found on Wikidata' },
        { kind: 'city', name: 'C', reason: 'Outside the box' },
      ]),
    );
    await jobs.idle();
    expect(history).toEqual([
      {
        startedAt: T0,
        endedAt: T0,
        kind: 'generate',
        categoryId: 'kansai',
        category: 'Kansai',
        levels: ['easy'],
        saved: { city: 2, landmark: 1 },
        dropped: [
          { reason: 'Not found on Wikidata', count: 2 },
          { reason: 'Outside the box', count: 1 },
        ],
        costUsd: 0.3,
        outcome: 'done',
      },
    ]);
  });
});
