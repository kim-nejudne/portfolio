// The admin page's HTTP calls (F80): JSON POSTs, the server's error text, an unreachable server.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addWord,
  addWords,
  AdminApiError,
  createCategory,
  deleteCategory,
  deleteWord,
  discardDraft,
  exportCategories,
  generationStatus,
  getGeneration,
  saveDraft,
  startGeneration,
  getCategory,
  importCategory,
  listCategories,
  patchCategory,
  patchWord,
  adminLogin,
  adminLogout,
  adminReset,
  adminSetup,
  adminStatus,
  UNREACHABLE,
} from './adminApi.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(status: number, body: unknown) {
  const fetch = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('adminApi', () => {
  it('reads the status, never from the cache', async () => {
    const fetch = stubFetch(200, { configured: true, passwordSet: false, signedIn: false });
    await expect(adminStatus()).resolves.toEqual({
      configured: true,
      passwordSet: false,
      signedIn: false,
    });
    expect(fetch).toHaveBeenCalledWith('/api/admin/status', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
  });

  it('sends setup, reset, login and logout as JSON POSTs', async () => {
    const fetch = stubFetch(200, { ok: true });
    await adminSetup({ setupCode: 'code', password: 'a long password' });
    await adminReset({ setupCode: 'code', password: 'a long password' });
    await adminLogin({ password: 'a long password' });
    await adminLogout();
    expect(fetch.mock.calls.map((call) => (call as unknown[])[0])).toEqual([
      '/api/admin/setup',
      '/api/admin/reset',
      '/api/admin/login',
      '/api/admin/logout',
    ]);
    for (const call of fetch.mock.calls) {
      const init = (call as unknown[])[1] as RequestInit;
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'content-type': 'application/json' });
      expect(init.credentials).toBe('same-origin');
    }
    expect(((fetch.mock.calls[0] as unknown[])[1] as RequestInit).body).toBe(
      '{"setupCode":"code","password":"a long password"}',
    );
  });

  it("throws the server's error text", async () => {
    stubFetch(401, { ok: false, error: 'That password is wrong.' });
    await expect(adminLogin({ password: 'nope' })).rejects.toThrow('That password is wrong.');
  });

  it('throws a readable error for an unexpected answer or no server', async () => {
    stubFetch(502, '<html>');
    await expect(adminStatus()).rejects.toThrow('Something went wrong (502).');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    await expect(adminStatus()).rejects.toThrow(UNREACHABLE);
  });

  it('sends each category and word edit with its method, path and JSON body (F81)', async () => {
    const category = {
      id: 'en-food',
      title: 'Food',
      emoji: '🍔',
      defaultOn: true,
      hidden: false,
      words: [],
    };
    const fetch = stubFetch(200, { category, added: 0, duplicates: 0, errors: [], ok: true });
    await createCategory({ title: 'Food', emoji: '🍔' });
    await patchCategory('en-food', { hidden: true });
    await addWord('en-food', { word: 'pizza', difficulty: 1, alt: ['pie'] });
    await patchWord('en-food', 'pizza', { difficulty: 3 });
    await deleteWord('en-food', 'pizza');
    await addWords('en-food', 'cake\npie');
    await deleteCategory('en-food');
    const calls = fetch.mock.calls.map((call) => {
      const [path, init] = call as unknown as [string, RequestInit];
      return [
        init.method,
        path,
        init.body,
        (init.headers as Record<string, string>)['content-type'],
      ];
    });
    expect(calls).toEqual([
      ['POST', '/api/admin/categories', '{"title":"Food","emoji":"🍔"}', 'application/json'],
      ['PATCH', '/api/admin/categories/en-food', '{"hidden":true}', 'application/json'],
      [
        'POST',
        '/api/admin/categories/en-food/words',
        '{"word":"pizza","difficulty":1,"alt":["pie"]}',
        'application/json',
      ],
      [
        'PATCH',
        '/api/admin/categories/en-food/words/pizza',
        '{"difficulty":3}',
        'application/json',
      ],
      ['DELETE', '/api/admin/categories/en-food/words/pizza', '{}', 'application/json'],
      [
        'POST',
        '/api/admin/categories/en-food/words/bulk',
        '{"text":"cake\\npie"}',
        'application/json',
      ],
      ['DELETE', '/api/admin/categories/en-food', '{}', 'application/json'],
    ]);
  });

  it('reads the list and one category, never from the cache', async () => {
    const fetch = stubFetch(200, { categories: [] });
    await expect(listCategories()).resolves.toEqual({ categories: [] });
    expect(fetch).toHaveBeenCalledWith('/api/admin/categories', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    stubFetch(200, { categories: [] });
    // Not a category answer: refused rather than trusted.
    await expect(getCategory('en-food')).rejects.toThrow('Something went wrong (200).');
  });

  it('carries the status and the field the server names', async () => {
    stubFetch(400, { ok: false, error: 'Word is required', field: 'word' });
    const err = (await addWord('x', { word: '' }).catch((e: unknown) => e)) as AdminApiError;
    expect([err.message, err.status, err.field]).toEqual(['Word is required', 400, 'word']);
    stubFetch(401, { ok: false, error: 'Sign in as admin first.' });
    const signedOut = (await listCategories().catch((e: unknown) => e)) as AdminApiError;
    expect([signedOut.status, signedOut.field]).toEqual([401, undefined]);
  });

  it('downloads one category or all of them under the export file names (F82)', async () => {
    const fetch = stubFetch(200, { schemaVersion: 1 });
    const one = await exportCategories('en-food');
    expect(one.name).toBe('sketchy-category-en-food.json');
    expect(JSON.parse(await one.blob.text())).toEqual({ schemaVersion: 1 });
    const all = await exportCategories();
    expect(all.name).toBe('sketchy-categories.json');
    expect(fetch.mock.calls.map((call) => (call as unknown[])[0])).toEqual([
      '/api/admin/export/en-food',
      '/api/admin/export',
    ]);
    expect((fetch.mock.calls[0] as unknown[])[1]).toEqual({
      cache: 'no-store',
      credentials: 'same-origin',
    });
  });

  it('a refused export throws the server’s error and status', async () => {
    stubFetch(401, { ok: false, error: 'Sign in as admin first.' });
    const err = (await exportCategories('x').catch((e: unknown) => e)) as AdminApiError;
    expect([err.message, err.status]).toEqual(['Sign in as admin first.', 401]);
  });

  it('imports the file’s text as the body, as chosen, with onClash in the query', async () => {
    const category = {
      id: 'en-food',
      title: 'Food',
      emoji: '🍔',
      defaultOn: false,
      hidden: false,
      words: [],
    };
    const fetch = stubFetch(200, { category, replaced: false });
    const text = '{ "schemaVersion": 1 }\n';
    await expect(importCategory(text)).resolves.toEqual({ category, replaced: false });
    await importCategory(text, 'rename');
    await importCategory(text, 'replace');
    const calls = fetch.mock.calls.map((call) => {
      const [path, init] = call as unknown as [string, RequestInit];
      return [
        init.method,
        path,
        init.body,
        (init.headers as Record<string, string>)['content-type'],
      ];
    });
    expect(calls).toEqual([
      ['POST', '/api/admin/import', text, 'application/json'],
      ['POST', '/api/admin/import?onClash=rename', text, 'application/json'],
      ['POST', '/api/admin/import?onClash=replace', text, 'application/json'],
    ]);
  });

  it('a refused import carries the file’s problems and the clash', async () => {
    stubFetch(400, {
      ok: false,
      error: 'This file is not a valid category.',
      issues: ['language: Invalid input', 'words.2.word: too short'],
    });
    const invalid = (await importCategory('{}').catch((e: unknown) => e)) as AdminApiError;
    expect(invalid.issues).toEqual(['language: Invalid input', 'words.2.word: too short']);
    expect(invalid.clash).toBeUndefined();
    stubFetch(409, {
      ok: false,
      error: 'A category with the id "en-food" already exists.',
      field: 'id',
      clash: { id: 'en-food', title: 'Food' },
    });
    const taken = (await importCategory('{}').catch((e: unknown) => e)) as AdminApiError;
    expect([taken.status, taken.field, taken.clash]).toEqual([
      409,
      'id',
      { id: 'en-food', title: 'Food' },
    ]);
  });

  it('starts, reads, saves and discards generations with their paths and JSON bodies (F83)', async () => {
    const job = {
      id: 'j1',
      kind: 'new',
      title: 'Kitchen',
      categoryId: null,
      count: 40,
      status: 'ready',
      stage: null,
      error: null,
      startedAt: 1,
      draft: { emoji: '🍳', words: [] },
    };
    const category = {
      id: 'kitchen',
      title: 'Kitchen',
      emoji: '🍳',
      defaultOn: false,
      hidden: true,
      words: [],
    };
    const fetch = stubFetch(200, {
      job,
      category,
      added: 1,
      duplicates: 0,
      ok: true,
      mode: 'claude',
      off: null,
      jobs: [job],
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
    expect((await generationStatus()).jobs).toEqual([job]);
    expect((await startGeneration({ title: 'Kitchen', count: 40 })).job).toEqual(job);
    await startGeneration({ categoryId: 'en-food' });
    await getGeneration('j1');
    expect(
      (await saveDraft('j1', { words: [{ word: 'kettle', difficulty: 1, alt: [] }] })).added,
    ).toBe(1);
    await discardDraft('j1');
    const calls = fetch.mock.calls.map((call) => {
      const [path, init] = call as unknown as [string, RequestInit | undefined];
      return [init?.method ?? 'GET', path, init?.body, init?.cache];
    });
    expect(calls).toEqual([
      ['GET', '/api/admin/generate', undefined, 'no-store'],
      ['POST', '/api/admin/generate', '{"title":"Kitchen","count":40}', undefined],
      ['POST', '/api/admin/generate', '{"categoryId":"en-food"}', undefined],
      ['GET', '/api/admin/generate/j1', undefined, 'no-store'],
      [
        'POST',
        '/api/admin/generate/j1/save',
        '{"words":[{"word":"kettle","difficulty":1,"alt":[]}]}',
        undefined,
      ],
      ['DELETE', '/api/admin/generate/j1', '{}', undefined],
    ]);
  });

  it('a refused generation carries the server’s message, status and field (F83)', async () => {
    stubFetch(503, {
      ok: false,
      error: 'Generation is off: the server has no SKETCHY_ANTHROPIC_API_KEY.',
    });
    await expect(startGeneration({ title: 'Kitchen' })).rejects.toMatchObject({
      status: 503,
      message: 'Generation is off: the server has no SKETCHY_ANTHROPIC_API_KEY.',
    });
    stubFetch(400, { ok: false, error: 'Word 2: Word is required', field: 'words.1.word' });
    await expect(saveDraft('j1', { words: [] })).rejects.toMatchObject({ field: 'words.1.word' });
  });
});
