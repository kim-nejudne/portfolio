// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_RATE_LIMITED_ERROR,
  ADMIN_SESSION_MS,
  ADMIN_WRONG_PASSWORD_ERROR,
} from '../../../shared/constants.js';
import {
  adminSessionEnded,
  adminSignIn,
  resetAdminSession,
  useAdminSession,
} from '../lib/adminSession.js';
import { Admin } from './Admin.js';

const T0 = Date.UTC(2026, 9, 30, 9, 0);

type Answer = () => Response;
const json =
  (body: unknown, status = 200): Answer =>
  () =>
    Response.json(body, { status });
const signedIn = json({ expiresAt: T0 + ADMIN_SESSION_MS });

/**
 * A fake server: each `METHOD path` answers with the next of its queue. Unlisted calls fail as a
 * network error would. Returns the calls made, with their init.
 */
function stubServer(routes: Record<string, Answer[]>) {
  const calls: { key: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      calls.push({ key, init });
      const answer = routes[key]?.shift();
      if (!answer) throw new TypeError('Failed to fetch');
      return answer();
    }),
  );
  return calls;
}

function renderAdmin() {
  return render(
    <MemoryRouter>
      <Admin />
    </MemoryRouter>,
  );
}

function signIn(password: string) {
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetAdminSession();
});

describe('Admin page', () => {
  it('shows a password form when no session is signed in', async () => {
    stubServer({ 'GET /api/admin/session': [json({ ok: false, error: 'x' }, 401)] });
    renderAdmin();
    expect(screen.getByText('Checking…')).toBeTruthy();
    const input = await screen.findByLabelText('Password');
    expect(input.getAttribute('type')).toBe('password');
    expect(input.getAttribute('autocomplete')).toBe('current-password');
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveProperty('disabled', true);
  });

  it('signs in with a JSON POST and shows the signed-in state, a Question sets link and Logout', async () => {
    const calls = stubServer({
      'GET /api/admin/session': [json({ ok: false, error: 'x' }, 401)],
      'POST /api/admin/login': [signedIn],
    });
    renderAdmin();
    await screen.findByLabelText('Password');
    signIn('open sesame');
    expect(await screen.findByText(/Signed in until/)).toBeTruthy();
    const login = calls.find((c) => c.key === 'POST /api/admin/login')!;
    expect(login.init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(login.init?.body as string)).toEqual({ password: 'open sesame' });
    expect(screen.getByRole('link', { name: 'Question sets' }).getAttribute('href')).toBe('/sets');
    expect(screen.getByRole('button', { name: 'Logout' })).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('shows the wrong-password error, clears the field and stays signed out', async () => {
    stubServer({
      'GET /api/admin/session': [json({ ok: false, error: 'x' }, 401)],
      'POST /api/admin/login': [json({ ok: false, error: ADMIN_WRONG_PASSWORD_ERROR }, 401)],
    });
    renderAdmin();
    await screen.findByLabelText('Password');
    signIn('guess');
    expect((await screen.findByRole('alert')).textContent).toBe(ADMIN_WRONG_PASSWORD_ERROR);
    expect(screen.getByLabelText('Password')).toHaveProperty('value', '');
    expect(screen.getByLabelText('Password').getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByText(/Signed in until/)).toBeNull();
  });

  it('shows the rate-limit error', async () => {
    stubServer({
      'GET /api/admin/session': [json({ ok: false, error: 'x' }, 401)],
      'POST /api/admin/login': [json({ ok: false, error: ADMIN_RATE_LIMITED_ERROR }, 429)],
    });
    renderAdmin();
    await screen.findByLabelText('Password');
    signIn('open sesame');
    expect((await screen.findByRole('alert')).textContent).toBe(ADMIN_RATE_LIMITED_ERROR);
  });

  it('opens signed in when the cookie still holds a session', async () => {
    stubServer({ 'GET /api/admin/session': [signedIn] });
    renderAdmin();
    expect(await screen.findByRole('button', { name: 'Logout' })).toBeTruthy();
  });

  it('Logout posts JSON and returns to the form', async () => {
    const calls = stubServer({
      'GET /api/admin/session': [signedIn],
      'POST /api/admin/logout': [json({ ok: true })],
    });
    renderAdmin();
    fireEvent.click(await screen.findByRole('button', { name: 'Logout' }));
    expect(await screen.findByLabelText('Password')).toBeTruthy();
    const logout = calls.find((c) => c.key === 'POST /api/admin/logout')!;
    expect(logout.init?.headers).toEqual({ 'content-type': 'application/json' });
  });

  it('keeps the signed-in state and shows the error when Logout fails', async () => {
    stubServer({ 'GET /api/admin/session': [signedIn] });
    renderAdmin();
    fireEvent.click(await screen.findByRole('button', { name: 'Logout' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Could not reach the server/);
    expect(screen.getByRole('button', { name: 'Logout' })).toHaveProperty('disabled', false);
  });

  it('says admin is not set up when the server answers 404, with no form', async () => {
    stubServer({ 'GET /api/admin/session': [json({ ok: false, error: 'Not found.' }, 404)] });
    renderAdmin();
    expect(await screen.findByText('Admin sign-in is not set up on this server.')).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('offers Retry when the server cannot be reached, and Retry checks again', async () => {
    stubServer({ 'GET /api/admin/session': [json({ ok: false, error: 'x' }, 401)] });
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderAdmin();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByLabelText('Password')).toBeTruthy();
  });

  it('returns to the form when the session reaches its expiry', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(T0);
    stubServer({ 'POST /api/admin/login': [signedIn] });
    await act(() => adminSignIn('open sesame'));
    renderAdmin();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(ADMIN_SESSION_MS - 1));
    expect(screen.getByRole('button', { name: 'Logout' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });
});

describe('useAdminSession', () => {
  it('checks the server once for every component on the page', async () => {
    const calls = stubServer({ 'GET /api/admin/session': [signedIn, signedIn] });
    const first = renderHook(() => useAdminSession());
    const second = renderHook(() => useAdminSession());
    await vi.waitFor(() => expect(first.result.current.kind).toBe('signedIn'));
    expect(second.result.current).toMatchObject({
      kind: 'signedIn',
      expiresAt: T0 + ADMIN_SESSION_MS,
    });
    expect(calls).toHaveLength(1);
  });

  it('adminSessionEnded (a later 401) signs every user of the hook out', async () => {
    stubServer({ 'GET /api/admin/session': [signedIn] });
    const { result } = renderHook(() => useAdminSession());
    await vi.waitFor(() => expect(result.current.kind).toBe('signedIn'));
    act(() => adminSessionEnded());
    expect(result.current.kind).toBe('signedOut');
  });
});
