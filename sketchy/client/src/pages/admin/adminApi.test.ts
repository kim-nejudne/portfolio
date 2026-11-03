// The admin page's HTTP calls (F80): JSON POSTs, the server's error text, an unreachable server.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addWord,
  addWords,
  AdminApiError,
  createCategory,
  deleteCategory,
  deleteWord,
  getCategory,
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
});
