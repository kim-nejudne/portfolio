// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_NOT_CONFIGURED, resetAdminSession } from '../lib/adminSession.js';
import { Admin } from './Admin.js';

type Reply = { status: number; body: unknown };

/** Answers each request in turn and records method, path and headers. */
function stubFetch(...replies: Reply[]) {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => {
    const { status, body } = replies.shift()!;
    return new Response(JSON.stringify(body), { status });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const EXPIRES = Date.now() + 60 * 60 * 1000;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetAdminSession();
});

describe('Admin session gate', () => {
  it('says admin is not configured when the server answers 404', async () => {
    stubFetch({ status: 404, body: { error: 'Not found.' } });
    render(<Admin />);
    expect(await screen.findByText(ADMIN_NOT_CONFIGURED)).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('signs in with a same-origin JSON POST, then signs out', async () => {
    const fetch = stubFetch(
      { status: 401, body: { error: 'Sign in as admin first.' } },
      { status: 200, body: { expiresAt: EXPIRES } },
      { status: 200, body: { ok: true } },
    );
    render(<Admin />);
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/Signed in until/)).toBeTruthy();
    expect(fetch.mock.calls[1]![0]).toBe('/api/admin/login');
    expect(fetch.mock.calls[1]![1]).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'pw' }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(await screen.findByLabelText('Password')).toBeTruthy();
    expect(fetch.mock.calls[2]![0]).toBe('/api/admin/logout');
  });

  it("shows the server's error for a wrong password and clears the field", async () => {
    stubFetch(
      { status: 401, body: { error: 'Sign in as admin first.' } },
      { status: 401, body: { error: 'That password is wrong.' } },
    );
    render(<Admin />);
    const input = (await screen.findByLabelText('Password')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toBe('That password is wrong.');
    expect(input.value).toBe('');
  });

  it('offers Retry when the server cannot be reached', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('offline'));
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ expiresAt: EXPIRES })));
    vi.stubGlobal('fetch', fetch);
    render(<Admin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/Signed in until/)).toBeTruthy();
  });
});
