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
import { AdminCategories } from '../components/AdminCategories.js';
import { HEADER_ROW_QUERY } from './AdminLayout.js';
import { DESKTOP_QUERY } from '../lib/useMediaQuery.js';

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

const rowLinks = () =>
  within(screen.getByRole('list', { name: 'Categories' })).getAllByRole('link');
const where = () => screen.getByTestId('location').textContent;

const MIXED: AdminCategory[] = [
  // Its drafts are reviewed: nothing flags it.
  RIVERS,
  { name: 'Animals', levels: [level({ setId: 'an-e', title: 'Animals – Easy' })], job: null },
  {
    name: 'Zebras',
    levels: [
      level({ setId: 'z-e', title: 'Zebras – Easy' }),
      level({
        setId: 'z-m',
        title: 'Zebras – Medium',
        difficulty: 'medium',
        status: 'new',
        reviewed: false,
      }),
    ],
    job: null,
  },
  {
    name: 'Moons',
    levels: [],
    job: job({ state: 'failed', currentLevel: null, error: 'The Claude API is busy.' }),
  },
];

describe('Admin category list', () => {
  it('links Add category to /admin/generate and says what is left today', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog()] });
    expect(screen.getByRole('link', { name: 'Add category' }).getAttribute('href')).toBe(
      '/admin/generate',
    );
    expect(screen.queryByRole('form', { name: 'Add category' })).toBeNull();
    expect(screen.getByText('18 of 20 levels left today (UTC).')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /^Generating/ })).toBeNull();
  });

  it('puts the categories with a failed job or an unreviewed draft first, then the rest by name', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog(MIXED)] });
    expect(rowLinks().map((a) => a.getAttribute('href'))).toEqual([
      '/admin/categories/Moons',
      '/admin/categories/Zebras',
      '/admin/categories/Animals',
      '/admin/categories/Rivers',
    ]);
  });

  it('makes each row one link holding the name, a dot per level, the question total and one badge', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog(MIXED)] });
    expect(rowLinks().map((a) => a.textContent)).toEqual([
      'MoonsEasy failed. 0 questionsFailed',
      'ZebrasEasy live, Medium needs review. 30 questionsNeeds review',
      'AnimalsEasy live. 15 questions',
      'RiversEasy live, Medium draft, Hard draft. 43 questions',
    ]);
    // The dots, in level order, each with its state.
    const dots = (i: number) =>
      [...rowLinks()[i]!.querySelectorAll('[title]')].map((d) => d.getAttribute('title'));
    expect(dots(1)).toEqual(['Easy: live', 'Medium: needs review']);
    expect(dots(3)).toEqual(['Easy: live', 'Medium: draft', 'Hard: draft']);
    expect(screen.getByText('Needs review').className).toMatch(/text-warn/);
    expect(screen.getByText('Failed').className).toMatch(/text-buzz/);
  });

  it('has no Review, Delete or Regenerate in the list', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog(MIXED)] });
    const list = within(screen.getByRole('list', { name: 'Categories' }));
    expect(list.queryAllByRole('button')).toEqual([]);
    expect(screen.queryByRole('link', { name: /^Review/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Delete|Regenerate)/ })).toBeNull();
  });

  it("marks the open category's row with aria-current, in any case of the URL", async () => {
    stubMedia(HEADER_ROW_QUERY);
    stubServer({ 'GET /api/admin/session': [signedIn], [CATEGORIES]: [catalog(MIXED)] });
    render(
      <MemoryRouter initialEntries={['/admin/categories/zebras/z-m']}>
        <AdminRoutes path="/admin/categories/:name/:setId" page={<AdminCategories />} />
      </MemoryRouter>,
    );
    await screen.findByRole('list', { name: 'Categories' });
    expect(rowLinks().map((a) => a.getAttribute('aria-current'))).toEqual([
      null,
      'page',
      null,
      null,
    ]);
    unstubMedia();
  });

  it('shows a "Generating <name>" banner and badge, follows the job every 2 s, and reads the list again when it ends', async () => {
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
        catalog([RIVERS, { name: 'Moons', levels: [], job: job() }], { running: job() }),
        catalog([RIVERS, moons]),
      ],
      'GET /api/admin/jobs/job1': [json(job({ state: 'checking' })), json(failed)],
    });
    const banner = screen.getByRole('link', { name: 'Generating Moons' });
    expect(banner.getAttribute('href')).toBe('/admin/generate?job=job1');
    expect(screen.getByRole('status').textContent).toMatch(/Writing the questions/);
    expect(rowLinks()[0]!.textContent).toBe(
      'MoonsEasy generating, Medium generating. 0 questionsGenerating',
    );

    await act(() => vi.advanceTimersByTimeAsync(1999));
    expect(callsTo(calls, 'GET /api/admin/jobs/job1')).toBe(0);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByRole('status').textContent).toBe(
      'Generating MoonsChecking the facts · Easy, level 1 of 2 · $0.03 so far',
    );

    await nextPoll();
    await settle();
    expect(screen.queryByRole('link', { name: 'Generating Moons' })).toBeNull();
    // Easy was saved (a reviewed draft); Medium is where the job failed.
    expect(rowLinks()[0]!.textContent).toBe('MoonsEasy draft, Medium failed. 15 questionsFailed');
    // Ended: no more polls.
    await nextPoll();
    expect(callsTo(calls, 'GET /api/admin/jobs/job1')).toBe(2);
  });

  it('reads "Generation is not set up" with no key', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog([RIVERS], { enabled: false })] });
    expect(screen.getByText(/^Generation is not set up/)).toBeTruthy();
    expect(screen.queryByText(/levels left today/)).toBeNull();
  });

  it('reads "Daily limit reached" over the cap', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog([RIVERS], { usedToday: 20 })] });
    expect(screen.getByText(/^Daily limit reached/)).toBeTruthy();
  });

  it('says so when there are no categories', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog([])] });
    expect(screen.getByText('No categories yet.')).toBeTruthy();
  });

  it('shows the category page\'s "<name> is live" message once, then clears it from history', async () => {
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
    expect(where()).toBe('/admin');
  });
});

describe('Admin list search and filters (F121)', () => {
  const chip = (name: RegExp) =>
    within(screen.getByRole('group', { name: 'Show' })).getByRole('button', { name });
  const chipTexts = () =>
    within(screen.getByRole('group', { name: 'Show' }))
      .getAllByRole('button')
      .map((b) => `${b.textContent}${b.getAttribute('aria-pressed') === 'true' ? '*' : ''}`);
  const rowNames = () => rowLinks().map((a) => a.textContent!.split(/Easy|\d/)[0]);

  async function renderAt(url: string) {
    stubServer({ 'GET /api/admin/session': [signedIn], [CATEGORIES]: [catalog(MIXED)] });
    render(
      <MemoryRouter initialEntries={[url]}>
        <AdminRoutes path="/admin" page={<Admin />} />
        <LocationProbe />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Categories' });
  }

  it('shows a search box and the All, Needs review, Generating and Live chips with their counts', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog(MIXED)] });
    expect(screen.getByRole('searchbox', { name: 'Search categories' })).toBeTruthy();
    expect(chipTexts()).toEqual(['All 4*', 'Needs review 1', 'Generating 0', 'Live 3']);
  });

  it('keeps the chips on one row that scrolls sideways, each at least 44px tall', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog(MIXED)] });
    const group = screen.getByRole('group', { name: 'Show' });
    expect(group.className).toMatch(/overflow-x-auto/);
    expect(group.className).not.toMatch(/flex-wrap/);
    for (const button of within(group).getAllByRole('button')) {
      expect(button.className).toMatch(/min-h-11/);
      expect(button.className).toMatch(/whitespace-nowrap/);
      expect(button.className).toMatch(/shrink-0/);
    }
  });

  it('a chip filters the list and goes into the URL', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog(MIXED)] });
    fireEvent.click(chip(/^Needs review/));
    expect(rowNames()).toEqual(['Zebras']);
    expect(where()).toBe('/admin?filter=review');
    expect(chip(/^Needs review/).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chip(/^Live/));
    expect(rowNames()).toEqual(['Zebras', 'Animals', 'Rivers']);
    expect(where()).toBe('/admin?filter=live');
    fireEvent.click(chip(/^All/));
    expect(rowLinks()).toHaveLength(4);
    expect(where()).toBe('/admin');
  });

  it('searches category names and level titles, ignoring case and accents, and the counts follow', async () => {
    const cafes: AdminCategory = {
      name: 'Cafés',
      levels: [level({ setId: 'c-e', title: 'Espresso – Easy' })],
      job: null,
    };
    await renderDashboard({ [CATEGORIES]: [catalog([...MIXED, cafes])] });
    const box = screen.getByRole('searchbox', { name: 'Search categories' });
    fireEvent.change(box, { target: { value: 'CAFE' } });
    expect(rowNames()).toEqual(['Cafés']);
    expect(where()).toBe('/admin?q=CAFE');
    expect(chipTexts()).toEqual(['All 1*', 'Needs review 0', 'Generating 0', 'Live 1']);
    fireEvent.change(box, { target: { value: 'espresso' } });
    expect(rowNames()).toEqual(['Cafés']);
    fireEvent.change(box, { target: { value: 'zebras – medium' } });
    expect(rowNames()).toEqual(['Zebras']);
    expect(chipTexts()).toEqual(['All 1*', 'Needs review 1', 'Generating 0', 'Live 1']);
    fireEvent.change(box, { target: { value: '' } });
    expect(rowLinks()).toHaveLength(5);
    expect(where()).toBe('/admin');
  });

  it('opens with the filter and search of the URL, so Back to the list keeps them', async () => {
    await renderAt('/admin?filter=live&q=r');
    expect(
      (screen.getByRole('searchbox', { name: 'Search categories' }) as HTMLInputElement).value,
    ).toBe('r');
    expect(chip(/^Live/).getAttribute('aria-pressed')).toBe('true');
    expect(rowNames()).toEqual(['Zebras', 'Rivers']);
  });

  it('carries the filter and search on each row, and the phone back link returns with them', async () => {
    await renderAt('/admin?filter=live&q=r');
    const row = rowLinks()[1]!;
    expect(row.getAttribute('href')).toBe('/admin/categories/Rivers?filter=live&q=r');
    fireEvent.click(row);
    expect(where()).toBe('/admin/categories/Rivers?filter=live&q=r');
  });

  it("the phone's back link from a category returns to the list with its filter and search", async () => {
    stubServer({ 'GET /api/admin/session': [signedIn] });
    render(
      <MemoryRouter initialEntries={['/admin/categories/Rivers?filter=live&q=r&x=1']}>
        <AdminRoutes path="/admin/categories/:name" page={null} />
      </MemoryRouter>,
    );
    const back = await screen.findByRole('link', { name: '← Categories' });
    expect(back.getAttribute('href')).toBe('/admin?filter=live&q=r');
  });

  it('treats an unknown filter as All', async () => {
    await renderAt('/admin?filter=bogus');
    expect(chip(/^All/).getAttribute('aria-pressed')).toBe('true');
    expect(rowLinks()).toHaveLength(4);
  });

  it('says "No categories match" with a Clear link that empties the search and filter', async () => {
    await renderAt('/admin?filter=review&q=animals');
    expect(screen.queryByRole('list', { name: 'Categories' })).toBeNull();
    expect(screen.getByText(/No categories match/)).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Clear' }));
    expect(where()).toBe('/admin');
    expect(rowLinks()).toHaveLength(4);
    expect(
      (screen.getByRole('searchbox', { name: 'Search categories' }) as HTMLInputElement).value,
    ).toBe('');
  });

  it('shows one line of counts above the list on a phone', async () => {
    await renderDashboard({
      [CATEGORIES]: [
        catalog([...MIXED, { name: 'Comets', levels: [], job: job({ category: 'Comets' }) }], {
          running: job({ category: 'Comets' }),
        }),
      ],
    });
    expect(screen.getByText('1 to review · 1 generating · 3 live')).toBeTruthy();
  });
});

describe('Admin overview (F121)', () => {
  afterEach(() => unstubMedia());

  async function renderDesktop(routes: Record<string, Answer[]>) {
    stubMedia(DESKTOP_QUERY);
    const calls = stubServer({ 'GET /api/admin/session': [signedIn], ...routes });
    renderAdmin();
    if (vi.isFakeTimers()) await settle();
    else await screen.findByRole('heading', { name: 'Overview' });
    return calls;
  }
  const main = () => within(screen.getByRole('main'));
  const tile = (label: string) =>
    main().getByText(label, { selector: 'dt' }).nextElementSibling!.textContent;

  it('fills the detail pane with tiles for Needs review, Generating and Left today', async () => {
    await renderDesktop({
      [CATEGORIES]: [
        catalog(MIXED, { usedToday: 3, replacements: { usedToday: 7, dailyLimit: 100 } }),
        catalog(MIXED, { usedToday: 3, replacements: { usedToday: 7, dailyLimit: 100 } }),
      ],
    });
    await main().findByText('Needs review', { selector: 'dt' });
    expect(tile('Needs review')).toBe('1');
    expect(tile('Generating')).toBe('0');
    expect(tile('Left today')).toBe('17 of 20 levels93 of 100 replacements');
    // The phone's counts line is not on desktop.
    expect(screen.queryByText(/to review ·/)).toBeNull();
  });

  it('says generation is not set up in Left today without a key', async () => {
    await renderDesktop({
      [CATEGORIES]: [catalog(MIXED, { enabled: false }), catalog(MIXED, { enabled: false })],
    });
    await main().findByText('Left today', { selector: 'dt' });
    expect(tile('Left today')).toBe('Generation is not set up');
  });

  it('links each category that needs review to its page', async () => {
    await renderDesktop({ [CATEGORIES]: [catalog(MIXED), catalog(MIXED)] });
    const list = await main().findByRole('list', { name: 'Needs review' });
    const links = within(list).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Zebras →', '/admin/categories/Zebras'],
    ]);
  });

  it('says when nothing needs review', async () => {
    await renderDesktop({ [CATEGORIES]: [catalog([RIVERS]), catalog([RIVERS])] });
    expect(await main().findByText('Nothing needs review.')).toBeTruthy();
  });

  it("shows the running job's progress, linking to its page, and follows it every 2 s", async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const moons: AdminCategory = { name: 'Moons', levels: [], job: job() };
    const calls = await renderDesktop({
      [CATEGORIES]: [
        catalog([RIVERS, moons], { running: job() }),
        catalog([RIVERS, moons], { running: job() }),
        catalog([RIVERS]),
        catalog([RIVERS]),
      ],
      'GET /api/admin/jobs/job1': [
        json(job({ state: 'checking' })),
        json(job({ state: 'checking' })),
        json(job({ state: 'done', currentLevel: null, finishedAt: 1 })),
        json(job({ state: 'done', currentLevel: null, finishedAt: 1 })),
      ],
    });
    const overview = within(screen.getByRole('main'));
    const line = overview.getByRole('link', { name: 'Generating Moons' });
    expect(line.getAttribute('href')).toBe('/admin/generate?job=job1');
    expect(tile('Generating')).toBe('1');
    expect(overview.getByRole('status').textContent).toMatch(/Writing the questions/);
    await nextPoll();
    expect(overview.getByRole('status').textContent).toMatch(/Checking the facts/);
    await nextPoll();
    await settle();
    expect(overview.queryByRole('link', { name: 'Generating Moons' })).toBeNull();
    expect(tile('Generating')).toBe('0');
    expect(callsTo(calls, CATEGORIES)).toBe(4);
  });

  it('offers Retry when the categories cannot be read', async () => {
    stubMedia(DESKTOP_QUERY);
    stubServer({ 'GET /api/admin/session': [signedIn] });
    renderAdmin();
    // The gate's <main> gives way to the panes' once signed in.
    await screen.findByRole('complementary', { name: 'Categories' });
    expect(await main().findByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(main().getByRole('alert').textContent).toMatch(/^Could not reach the server/);
  });
});
