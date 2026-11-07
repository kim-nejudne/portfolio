// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminCategoryRow, AdminLevelRow, GenerationJob } from '#shared/types.js';
import { ADMIN_NOT_CONFIGURED, resetAdminSession } from '../lib/adminSession.js';
import { Admin } from './Admin.js';

type Reply = { status: number; body: unknown };
type Handler = Reply | Reply[];

const EXPIRES = Date.now() + 60 * 60 * 1000;
const SIGNED_IN: Reply = { status: 200, body: { expiresAt: EXPIRES } };
const NO_JOBS = { jobs: [], off: null, levelsLeft: 20, replacementsLeft: 100 };
const SIGNED_OUT: Reply = { status: 401, body: { error: 'Sign in as admin first.' } };

/**
 * Answers by path; an array answers in turn and then repeats its last reply. Records each call.
 * A path with no handler is a 404.
 */
function stubFetch(routes: Record<string, Handler>) {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
    const handler = routes[url];
    const reply = Array.isArray(handler)
      ? handler.length > 1
        ? handler.shift()!
        : handler[0]!
      : (handler ?? { status: 404, body: { error: 'Not found.' } });
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

/** Makes `(min-width: 64rem)` match, as a 1280 px wide window does. */
function desktop() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(min-width: 64rem)',
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

function renderAt(path: string | { pathname: string; state: unknown } = '/admin') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/*" element={<Admin />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

const level = (state: AdminLevelRow['state'], city = 15, landmark = 15): AdminLevelRow => ({
  state,
  published: state === 'live',
  city,
  landmark,
});

function row(
  id: string,
  name: string,
  levels: Partial<AdminCategoryRow['levels']> = {},
  extra: Partial<AdminCategoryRow> = {},
): AdminCategoryRow {
  return {
    id,
    name,
    emoji: null,
    hidden: false,
    levels: {
      easy: level('live'),
      medium: level('live'),
      hard: level('live'),
      ...levels,
    },
    ...extra,
  };
}

const CATEGORIES: AdminCategoryRow[] = [
  row('world', 'World', { hard: level('live', 12, 15) }, { emoji: '🌍' }),
  row('alps', 'Alps', {}, { hidden: true }),
  row('japan', 'Japan', { easy: level('review', 15, 14), hard: level('missing', 0, 0) }),
  row('brazil', 'Brazil', { medium: level('draft', 9, 10) }),
  row('chile', 'Chile', { medium: level('review') }, { hidden: true }),
];

const LIST: Reply = { status: 200, body: { categories: CATEGORIES } };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetAdminSession();
});

/** A tile list's labels to their values. */
const tiles = (container: HTMLElement, label: string) =>
  Object.fromEntries(
    [...container.querySelectorAll(`dl[aria-label="${label}"] dt`)].map((dt) => [
      dt.textContent,
      dt.nextElementSibling!.textContent,
    ]),
  );

const rowNames = () =>
  within(screen.getByRole('list', { name: 'Categories' }))
    .getAllByRole('link')
    .map((link) => link.querySelector('.font-semibold')!.textContent);

describe('Admin session gate', () => {
  it('says admin is not configured when the server answers 404', async () => {
    stubFetch({});
    renderAt();
    expect(await screen.findByText(ADMIN_NOT_CONFIGURED)).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('signs in with a same-origin JSON POST, shows the list, then signs out from the ⋯ menu', async () => {
    const fetch = stubFetch({
      '/api/admin/session': SIGNED_OUT,
      '/api/admin/login': SIGNED_IN,
      '/api/admin/categories': LIST,
      '/api/admin/logout': { status: 200, body: { ok: true } },
    });
    renderAt();
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('list', { name: 'Categories' })).toBeTruthy();
    const login = fetch.mock.calls.find(([url]) => url === '/api/admin/login')!;
    expect(login[1]).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'pw' }),
    });

    // Below 1024 px: History and Logout sit in the ⋯ menu, the session's end on Logout.
    expect(screen.getByText('⋯').closest('summary')!.getAttribute('aria-label')).toBe('Admin menu');
    const menu = screen.getByText('⋯').closest('details')!;
    menu.open = true;
    fireEvent.keyDown(screen.getByRole('link', { name: 'History' }), { key: 'Escape' });
    expect(menu.open).toBe(false);
    menu.open = true;
    fireEvent.pointerDown(document.body);
    expect(menu.open).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /^Logout \(until .+\)$/ }));
    expect(await screen.findByLabelText('Password')).toBeTruthy();
    expect(fetch.mock.calls.some(([url]) => url === '/api/admin/logout')).toBe(true);
  });

  it("shows the server's error for a wrong password and clears the field", async () => {
    stubFetch({
      '/api/admin/session': SIGNED_OUT,
      '/api/admin/login': { status: 401, body: { error: 'That password is wrong.' } },
    });
    renderAt();
    const input = (await screen.findByLabelText('Password')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toBe('That password is wrong.');
    expect(input.value).toBe('');
  });

  it('offers Retry when the server cannot be reached', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('offline'));
    fetch.mockImplementation(async (url: string) =>
      url === '/api/admin/categories'
        ? new Response(JSON.stringify({ categories: [] }))
        : url === '/api/admin/jobs'
          ? new Response(JSON.stringify(NO_JOBS))
          : new Response(JSON.stringify({ expiresAt: EXPIRES })),
    );
    vi.stubGlobal('fetch', fetch);
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/No categories yet/)).toBeTruthy();
  });

  it('opens the page that was asked for after signing in on it', async () => {
    stubFetch({
      '/api/admin/session': SIGNED_OUT,
      '/api/admin/login': SIGNED_IN,
      '/api/admin/categories': LIST,
    });
    renderAt('/admin/history');
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'History' })).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/admin/history');
  });

  it('returns to the sign-in form when the list answers 401', async () => {
    stubFetch({ '/api/admin/session': SIGNED_IN, '/api/admin/categories': SIGNED_OUT });
    renderAt();
    expect(await screen.findByLabelText('Password')).toBeTruthy();
  });
});

describe('Admin category list', () => {
  it('shows the notice a category page passes on its way back to /admin', async () => {
    stubFetch({ '/api/admin/session': SIGNED_IN, '/api/admin/categories': LIST });
    renderAt({ pathname: '/admin', state: { notice: 'Japan is live: 3 levels published.' } });
    await screen.findByRole('list', { name: 'Categories' });
    expect(
      screen.getByText('Japan is live: 3 levels published.').closest('[role=status]'),
    ).toBeTruthy();
  });

  it('shows a Generating ‹name› banner and badge while a generation runs, linking to its progress', async () => {
    const running = {
      id: 'j1',
      kind: 'regenerate',
      guidance: '',
      state: 'running',
      categoryId: 'japan',
      category: 'Japan',
      levels: [],
      placeKind: null,
      placeId: null,
      replaced: null,
      queuePosition: null,
      costUsd: 0,
      error: null,
      startedAt: 1,
      endedAt: null,
    };
    stubFetch({
      '/api/admin/session': SIGNED_IN,
      '/api/admin/categories': LIST,
      '/api/admin/jobs': { status: 200, body: { ...NO_JOBS, jobs: [running] } },
    });
    renderAt();
    const banner = await screen.findByRole('link', { name: /Generating Japan/ });
    expect(banner.getAttribute('href')).toBe('/admin/generate?job=j1');
    const japan = screen.getByRole('link', { name: /^Japan/ });
    expect(within(japan).getByText('Generating')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generating 1' })).toBeTruthy();
  });

  it('puts categories needing review first, then the rest, each by name', async () => {
    stubFetch({ '/api/admin/session': SIGNED_IN, '/api/admin/categories': LIST });
    renderAt();
    await screen.findByRole('list', { name: 'Categories' });
    expect(rowNames()).toEqual(['Chile', 'Japan', 'Alps', 'Brazil', 'World']);
  });

  it('shows each row with its emoji, level dots, counts and one badge, linking to its page', async () => {
    stubFetch({ '/api/admin/session': SIGNED_IN, '/api/admin/categories': LIST });
    renderAt();
    const list = await screen.findByRole('list', { name: 'Categories' });
    const [chile, japan, alps, brazil, world] = within(list).getAllByRole('link');
    expect(japan!.textContent).toContain('Cities 15/15/– · Landmarks 14/15/–');
    expect(japan!.textContent).toContain('Easy Needs review, Medium Live, Hard Missing.');
    expect(within(japan!).getByText('Needs review')).toBeTruthy();
    // Needs review outranks Hidden.
    expect(within(chile!).queryByText('Hidden')).toBeNull();
    expect(within(alps!).getByText('Hidden')).toBeTruthy();
    expect(brazil!.textContent).toContain('Medium Draft');
    expect(within(brazil!).queryByText(/Needs review|Hidden/)).toBeNull();
    expect(world!.textContent).toContain('🌍');
    expect(world!.textContent).toContain('Cities 15/15/12 · Landmarks 15/15/15');
    expect(world!.getAttribute('href')).toBe('/admin/categories/world');
    // The phone's overview line.
    expect(screen.getByText('5 categories · 3 live · 2 need review · 2 hidden')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add category' }).getAttribute('href')).toBe(
      '/admin/generate',
    );
  });

  it('filters by chip and search, keeps both in the URL, and clears', async () => {
    stubFetch({ '/api/admin/session': SIGNED_IN, '/api/admin/categories': LIST });
    renderAt();
    await screen.findByRole('list', { name: 'Categories' });
    const chips = within(screen.getByRole('group', { name: 'Show' }));
    expect(chips.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'All 5',
      'Needs review 2',
      'Generating 0',
      'Live 3',
      'Hidden 2',
    ]);

    fireEvent.click(chips.getByRole('button', { name: 'Hidden 2' }));
    expect(rowNames()).toEqual(['Chile', 'Alps']);
    expect(screen.getByTestId('where').textContent).toBe('/admin?filter=hidden');

    // Japan's Easy draft waits for review, but its Medium level is live.
    fireEvent.click(chips.getByRole('button', { name: 'Live 3' }));
    expect(rowNames()).toEqual(['Japan', 'Brazil', 'World']);

    fireEvent.click(chips.getByRole('button', { name: 'All 5' }));
    fireEvent.change(screen.getByLabelText('Search categories'), { target: { value: ' JAPÁN ' } });
    expect(rowNames()).toEqual(['Japan']);
    // Chip counts follow the search.
    expect(chips.getByRole('button', { name: 'Needs review 1' })).toBeTruthy();
    // A row keeps the list's filter and search for the way back.
    expect(screen.getByRole('link', { name: /Japan/ }).getAttribute('href')).toBe(
      '/admin/categories/japan?q=+JAP%C3%81N+',
    );

    fireEvent.change(screen.getByLabelText('Search categories'), { target: { value: 'zzz' } });
    expect(screen.getByText('No categories match.')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Clear' }));
    expect(rowNames()).toHaveLength(5);
  });

  it('says there are no categories yet, with Add category', async () => {
    stubFetch({
      '/api/admin/session': SIGNED_IN,
      '/api/admin/categories': { status: 200, body: { categories: [] } },
    });
    renderAt();
    const empty = await screen.findByText(/No categories yet/);
    expect(within(empty).getByRole('link', { name: 'Add category' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Show' })).toBeNull();
  });

  it('shows the error with Retry when the list fails to load', async () => {
    stubFetch({
      '/api/admin/session': SIGNED_IN,
      '/api/admin/categories': [{ status: 500, body: { error: 'Something went wrong.' } }, LIST],
    });
    renderAt();
    expect((await screen.findByRole('alert')).textContent).toBe('Something went wrong.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('list', { name: 'Categories' })).toBeTruthy();
  });
});

describe('Admin layout from 1024 px', () => {
  it('shows the header in a row, the list pane, and the overview with what needs review', async () => {
    desktop();
    stubFetch({ '/api/admin/session': SIGNED_IN, '/api/admin/categories': LIST });
    const { container } = renderAt();
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeTruthy();
    expect(container.querySelector('[data-layout="panes"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Pinpoint Admin' })).toBeTruthy();
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'History' }).getAttribute('href')).toBe(
      '/admin/history',
    );
    expect(screen.getByText(/Signed in until/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeTruthy();
    expect(screen.queryByLabelText('Admin menu')).toBeNull();

    const pane = screen.getByRole('complementary', { name: 'Categories' });
    expect(await within(pane).findByRole('list', { name: 'Categories' })).toBeTruthy();

    expect(tiles(container, 'Counts')).toEqual({
      Categories: '5',
      Live: '3',
      'Needs review': '2',
      Hidden: '2',
    });
    const toReview = screen.getByRole('list', { name: 'Needs review' });
    expect(
      within(toReview)
        .getAllByRole('link')
        .map((l) => l.textContent!.replace(/\s+/g, ' ')),
    ).toEqual(['Chile · Medium', 'Japan · Easy']);
  });

  it("shows the running job, what is left of the day's limits and spend in the overview", async () => {
    desktop();
    const job = (over: Partial<GenerationJob>): GenerationJob => ({
      id: 'j1',
      kind: 'replace',
      guidance: '',
      state: 'running',
      categoryId: 'japan',
      category: 'Japan',
      levels: [
        {
          level: 'easy',
          count: 1,
          state: 'running',
          stage: 'write',
          kept: { city: 0, landmark: 0 },
        },
      ],
      placeKind: 'city',
      placeId: 'p1',
      replaced: null,
      queuePosition: null,
      costUsd: 0,
      error: null,
      startedAt: 0,
      endedAt: null,
      ...over,
    });
    stubFetch({
      '/api/admin/session': SIGNED_IN,
      '/api/admin/categories': LIST,
      '/api/admin/jobs': {
        status: 200,
        body: {
          jobs: [job({}), job({ id: 'j2', state: 'queued', queuePosition: 1 })],
          off: null,
          levelsLeft: 17,
          replacementsLeft: 96,
        },
      },
      '/api/admin/history?limit=0': {
        status: 200,
        body: {
          entries: [],
          totals: { todayUsd: 0.004, last30DaysUsd: 1.5, allTimeUsd: 12.345, jobs: 9 },
        },
      },
    });
    const { container } = renderAt();
    const running = await screen.findByRole('link', { name: 'Replacing a place in Japan · Easy' });
    expect(running.getAttribute('href')).toBe('/admin/categories/japan/easy');
    expect(screen.getByText('1 waiting in the queue.')).toBeTruthy();
    expect(tiles(container, 'Left today (UTC)')).toEqual({ Levels: '17', Replacements: '96' });
    await screen.findByText('$1.50');
    expect(tiles(container, 'Spend')).toEqual({
      Today: 'under $0.01',
      'Last 30 days': '$1.50',
      'All time': '$12.35',
    });
    const spend = screen.getByRole('region', { name: 'Spend' });
    expect(within(spend).getByRole('link', { name: 'History' }).getAttribute('href')).toBe(
      '/admin/history',
    );
  });

  it('names a running generation, says when nothing runs, and shows why generation is off', async () => {
    desktop();
    stubFetch({
      '/api/admin/session': SIGNED_IN,
      '/api/admin/categories': LIST,
      '/api/admin/jobs': { status: 200, body: { ...NO_JOBS, off: 'Generation is off: no key.' } },
    });
    renderAt();
    expect(await screen.findByText('No job running.')).toBeTruthy();
    expect(screen.getByText('Generation is off: no key.')).toBeTruthy();
    // The history route is missing in this stub: the spend says so and offers a retry.
    expect(await screen.findByText('Not found.')).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Spend' })).getByRole('button', { name: 'Retry' }),
    ).toBeTruthy();
  });

  it('marks the open category in the list pane and shows its page beside it', async () => {
    desktop();
    stubFetch({ '/api/admin/session': SIGNED_IN, '/api/admin/categories': LIST });
    renderAt('/admin/categories/japan');
    const pane = await screen.findByRole('complementary', { name: 'Categories' });
    const japan = await within(pane).findByRole('link', { name: /Japan/ });
    expect(japan.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('heading', { name: 'Category' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: '← Categories' })).toBeNull();
  });
});
