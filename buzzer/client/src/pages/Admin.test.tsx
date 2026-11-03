// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_RATE_LIMITED_ERROR,
  ADMIN_SESSION_MS,
  ADMIN_WRONG_PASSWORD_ERROR,
} from '../../../shared/constants.js';
import type { AdminCategory } from '../../../shared/types.js';
import {
  adminSessionEnded,
  adminSignIn,
  resetAdminSession,
  useAdminSession,
} from '../lib/adminSession.js';
import {
  CATEGORIES,
  LocationProbe,
  RIVERS,
  callsTo,
  catalog,
  job,
  json,
  level,
  nextPoll,
  settle,
  signedIn,
  stubServer,
  type Answer,
  AdminRoutes,
  stubMedia,
  unstubMedia,
} from '../test/adminServer.js';
import { Admin } from './Admin.js';
import { HEADER_ROW_QUERY } from './AdminLayout.js';

/** The router's history state, to see the published message cleared from it. */
function StateProbe() {
  return <span data-testid="state">{JSON.stringify(useLocation().state)}</span>;
}

const T0 = Date.UTC(2026, 9, 30, 9, 0);

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <AdminRoutes path="/admin" page={<Admin />} />
      <LocationProbe />
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
  // The header's Question sets, session end and Logout in a row, as from `sm` (F119).
  beforeEach(() => stubMedia(HEADER_ROW_QUERY));
  afterEach(unstubMedia);

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
      expiresAt: (first.result.current as { expiresAt: number }).expiresAt,
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

// ---------- The dashboard (F111, F115) ----------

/** Signed in, on the dashboard, with the given answers queued. */
async function renderDashboard(routes: Record<string, Answer[]>) {
  const calls = stubServer({ 'GET /api/admin/session': [signedIn], ...routes });
  renderAdmin();
  if (vi.isFakeTimers()) await settle();
  else await screen.findByRole('heading', { name: 'Categories' });
  return calls;
}

const card = (name: string) => screen.getByRole('listitem', { name });
const where = () => screen.getByTestId('location').textContent;

describe('Admin dashboard', () => {
  it('links Add category to /admin/generate with no form, and shows each level with its count, status and link', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog()] });
    expect(screen.getByRole('link', { name: 'Add category' }).getAttribute('href')).toBe(
      '/admin/generate',
    );
    // The form moved to /admin/generate (F115).
    expect(screen.queryByRole('form', { name: 'Add category' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Name' })).toBeNull();
    expect(screen.getByText('18 of 20 levels left today (UTC).')).toBeTruthy();

    const rivers = within(card('Rivers'));
    const rows = rivers.getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^Rivers – Easy15 questionsliveRegenerate$/),
      expect.stringMatching(/^Rivers – Medium13 of 15newRegenerate$/),
      expect.stringMatching(/^Rivers – Hard15 questionsdraftRegenerate$/),
    ]);
    // Each level opens its review list (F116).
    expect(rivers.getByRole('link', { name: 'Rivers – Medium' }).getAttribute('href')).toBe(
      '/admin/categories/Rivers/riv-m',
    );
    // Review replaces Publish all: publishing needs every level reviewed, on the review page.
    expect(rivers.getByRole('link', { name: 'Review Rivers' }).getAttribute('href')).toBe(
      '/admin/categories/Rivers',
    );
    expect(rivers.queryByRole('button', { name: /^Publish/ })).toBeNull();
    expect(rivers.getByRole('button', { name: 'Delete Rivers' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /^Generating/ })).toBeNull();
  });

  it('shows a "Generating <name>" banner linking to the running job, follows it every 2 s, and reads the list again when it ends', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const failed = job({
      state: 'failed',
      currentLevel: null,
      error: 'The Claude API is busy. Try again in a few minutes.',
      finished: [
        { difficulty: 'easy', setId: 'moon-e', title: 'Moons – Easy', questions: 15, count: 15 },
      ],
    });
    const moons: AdminCategory = {
      name: 'Moons',
      levels: [level({ setId: 'moon-e', title: 'Moons – Easy', status: 'new' })],
      job: failed,
    };
    const calls = await renderDashboard({
      [CATEGORIES]: [
        catalog([{ name: 'Moons', levels: [], job: job() }], { running: job() }),
        catalog([moons]),
      ],
      'GET /api/admin/jobs/job1': [json(job({ state: 'checking' })), json(failed)],
    });
    const banner = screen.getByRole('link', { name: 'Generating Moons' });
    expect(banner.getAttribute('href')).toBe('/admin/generate?job=job1');
    expect(screen.getByRole('status').textContent).toMatch(/Writing the questions/);
    expect(within(card('Moons')).getAllByText('generating')).toHaveLength(2);

    await act(() => vi.advanceTimersByTimeAsync(1999));
    expect(callsTo(calls, 'GET /api/admin/jobs/job1')).toBe(0);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByRole('status').textContent).toBe(
      'Generating MoonsChecking the facts · Easy, level 1 of 2 · $0.03 so far',
    );

    await nextPoll();
    await settle();
    expect(screen.queryByRole('link', { name: 'Generating Moons' })).toBeNull();
    const moonsCard = within(card('Moons'));
    expect(moonsCard.getByText('failed')).toBeTruthy();
    expect(moonsCard.getByText('Moons – Medium')).toBeTruthy();
    expect(moonsCard.getByText(failed.error!)).toBeTruthy();
    // Ended: no more polls.
    await nextPoll();
    expect(callsTo(calls, 'GET /api/admin/jobs/job1')).toBe(2);
  });

  it('clears a failed new category with no set', async () => {
    const failed = job({ state: 'failed', currentLevel: null, error: 'The Claude API is busy.' });
    const calls = await renderDashboard({
      [CATEGORIES]: [catalog([{ name: 'Moons', levels: [], job: failed }]), catalog([])],
      'DELETE /api/admin/categories/Moons': [json({ deleted: 0 })],
    });
    const moons = within(card('Moons'));
    expect(moons.getByText('Moons – Easy')).toBeTruthy();
    expect(moons.getByText('failed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Moons' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear it' }));
    expect(await screen.findByText('No categories yet.')).toBeTruthy();
    expect(calls.some((c) => c.key === 'DELETE /api/admin/categories/Moons')).toBe(true);
  });

  it('reads "Generation is not set up" with no key, with Regenerate off', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog([RIVERS], { enabled: false })] });
    expect(screen.getByText(/^Generation is not set up/)).toBeTruthy();
    expect(screen.queryByText(/levels left today/)).toBeNull();
    for (const button of within(card('Rivers')).getAllByRole('button', { name: /^Regenerate/ })) {
      expect(button).toHaveProperty('disabled', true);
    }
    // Reviewing and deleting need no key.
    expect(screen.getByRole('link', { name: 'Review Rivers' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Rivers' })).toHaveProperty('disabled', false);
  });

  it('reads "Daily limit reached" over the cap, with Regenerate off', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog([RIVERS], { usedToday: 20 })] });
    expect(screen.getByText(/^Daily limit reached/)).toBeTruthy();
    for (const button of within(card('Rivers')).getAllByRole('button', { name: /^Regenerate/ })) {
      expect(button).toHaveProperty('disabled', true);
    }
  });

  it('shows the category review\'s "<name> is live" message once, then clears it from history', async () => {
    stubServer({ 'GET /api/admin/session': [signedIn], [CATEGORIES]: [catalog()] });
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/admin', state: { published: 'Rivers is live: 2 sets published.' } },
        ]}
      >
        <AdminRoutes path="/admin" page={<Admin />} />
        <StateProbe />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Rivers is live: 2 sets published.')).toBeTruthy();
    // A reload or Back to this entry would not repeat it.
    await vi.waitFor(() => expect(screen.getByTestId('state').textContent).toBe('null'));
    expect(screen.getByText('Rivers is live: 2 sets published.')).toBeTruthy();
  });

  it('shows no message without one', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog()] });
    expect(screen.queryByText(/is live:/)).toBeNull();
  });

  it('Delete asks first, then removes the whole category', async () => {
    const calls = await renderDashboard({
      [CATEGORIES]: [catalog(), catalog([])],
      'DELETE /api/admin/categories/Rivers': [json({ deleted: 3 })],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Rivers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete 3 sets' }));
    expect(await screen.findByText('No categories yet.')).toBeTruthy();
    const sent = calls.find((c) => c.key === 'DELETE /api/admin/categories/Rivers')!;
    expect(sent.init?.headers).toEqual({ 'content-type': 'application/json' });
  });

  it('Regenerate asks first, then starts the job and goes to its progress at /admin/generate?job=', async () => {
    const calls = await renderDashboard({
      [CATEGORIES]: [catalog()],
      'POST /api/admin/built-in-sets/riv-m/regenerate': [json({ jobId: 'job7' }, 202)],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Rivers – Medium' }));
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Write it again' }));
    await vi.waitFor(() => expect(where()).toBe('/admin/generate?job=job7'));
  });

  it('keeps every Regenerate and Delete of the generating category off while a job runs', async () => {
    const regen = job({
      kind: 'regenerate',
      setId: 'riv-m',
      category: 'Rivers',
      levels: [{ difficulty: 'medium', count: 13 }],
      currentLevel: 'medium',
    });
    await renderDashboard({
      [CATEGORIES]: [catalog([{ ...RIVERS, job: regen }], { running: regen })],
    });
    expect(within(card('Rivers')).getByText('generating')).toBeTruthy();
    for (const button of within(card('Rivers')).getAllByRole('button', { name: /^Regenerate/ })) {
      expect(button).toHaveProperty('disabled', true);
    }
    expect(screen.getByRole('button', { name: 'Delete Rivers' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('link', { name: 'Generating Rivers' }).getAttribute('href')).toBe(
      '/admin/generate?job=job1',
    );
  });
});
