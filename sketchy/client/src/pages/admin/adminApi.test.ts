// The admin page's HTTP calls (F80): JSON POSTs, the server's error text, an unreachable server.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
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
});
