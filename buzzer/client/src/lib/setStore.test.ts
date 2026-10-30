// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestionSet } from '../../../shared/types.js';
import { db } from './db.js';
import { adminDraftStore, browserSetStore } from './setStore.js';

const SET: QuestionSet = {
  id: 'set-1',
  title: 'Quiz',
  questions: [{ id: 'q1', text: 'Q', answer: '', points: 100 }],
  createdAt: 1,
  updatedAt: 2,
  schemaVersion: 1,
};

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('browserSetStore', () => {
  it('saves to this browser and loads it back, never as a draft', async () => {
    await browserSetStore.save(SET);
    expect(await browserSetStore.load('set-1')).toMatchObject({
      set: { title: 'Quiz' },
      draft: false,
    });
    expect(await browserSetStore.load('nope')).toBeUndefined();
  });
});

describe('adminDraftStore (F107)', () => {
  it("loads the server's draft and saves to it with a same-origin JSON PUT", async () => {
    const fetch = vi.fn(async (url: string, init: RequestInit = {}) =>
      init.method === 'PUT'
        ? Response.json({ set: SET, draft: true })
        : url === '/api/admin/built-in-sets/set-1/draft'
          ? Response.json({ set: SET, draft: true })
          : Response.json({ ok: false, error: 'Not found.' }, { status: 404 }),
    );
    vi.stubGlobal('fetch', fetch);
    expect(await adminDraftStore.load('set-1')).toEqual({ set: SET, draft: true });
    expect(await adminDraftStore.load('nope')).toBeUndefined();
    await adminDraftStore.save(SET);
    const [url, init] = fetch.mock.calls.at(-1)!;
    expect(url).toBe('/api/admin/built-in-sets/set-1/draft');
    expect(init).toMatchObject({ method: 'PUT', headers: { 'content-type': 'application/json' } });
    expect(JSON.parse(init!.body as string)).toEqual(SET);
    // Nothing reached this browser's own sets.
    expect(await db.sets.count()).toBe(0);
  });

  it('a refused save throws, so the editor shows it did not save', async () => {
    vi.stubGlobal('fetch', async () =>
      Response.json({ ok: false, error: 'Title: Too big' }, { status: 400 }),
    );
    await expect(adminDraftStore.save(SET)).rejects.toThrow('Title: Too big');
  });
});
