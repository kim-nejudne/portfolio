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
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_RATE_LIMITED_ERROR,
  ADMIN_SESSION_MS,
  ADMIN_WRONG_PASSWORD_ERROR,
} from '../../../shared/constants.js';
import type {
  AdminCategoriesResponse,
  AdminCategory,
  AdminCategoryLevel,
  GenerateJob,
} from '../../../shared/types.js';
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
// Relative to the clock at answer time: a fixed instant would expire once the real clock passes it.
const signedIn: Answer = () => Response.json({ expiresAt: Date.now() + ADMIN_SESSION_MS });

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

// ---------- The dashboard (F111) ----------

const level = (overrides: Partial<AdminCategoryLevel> = {}): AdminCategoryLevel => ({
  setId: 'riv-e',
  title: 'Rivers – Easy',
  difficulty: 'easy',
  questions: 15,
  wanted: null,
  status: 'live',
  ...overrides,
});

const RIVERS: AdminCategory = {
  name: 'Rivers',
  levels: [
    level(),
    level({
      setId: 'riv-m',
      title: 'Rivers – Medium',
      difficulty: 'medium',
      questions: 13,
      wanted: 15,
      status: 'new',
    }),
    level({ setId: 'riv-h', title: 'Rivers – Hard', difficulty: 'hard', status: 'draft' }),
  ],
  job: null,
};

const job = (overrides: Partial<GenerateJob> = {}): GenerateJob => ({
  id: 'job1',
  kind: 'generate',
  setId: null,
  category: 'Moons',
  guidance: '',
  levels: [
    { difficulty: 'easy', count: 15 },
    { difficulty: 'medium', count: 15 },
  ],
  questionId: null,
  note: '',
  queuePosition: null,
  replaced: null,
  state: 'writing',
  currentLevel: 'easy',
  finished: [],
  short: [],
  usage: {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    searches: 0,
    costUsd: 0.03,
  },
  error: null,
  startedAt: 0,
  finishedAt: null,
  ...overrides,
});

function catalog(
  categories: AdminCategory[] = [RIVERS],
  generation: Partial<AdminCategoriesResponse['generation']> = {},
): Answer {
  return json({
    categories,
    generation: {
      enabled: true,
      usedToday: 2,
      dailyLimit: 20,
      running: null,
      replacements: { usedToday: 0, dailyLimit: 100 },
      ...generation,
    },
  } satisfies AdminCategoriesResponse);
}

const CATEGORIES = 'GET /api/admin/categories';

/** Signed in, on the dashboard, with the given answers queued. */
async function renderDashboard(routes: Record<string, Answer[]>) {
  const calls = stubServer({ 'GET /api/admin/session': [signedIn], ...routes });
  renderAdmin();
  if (vi.isFakeTimers()) await settle();
  else await screen.findByRole('heading', { name: 'Categories' });
  return calls;
}

/**
 * Lets pending fetches and their state updates finish under fake timers, where `findBy` and
 * `waitFor` would wait on a faked `setTimeout` for ever.
 */
async function settle() {
  for (let i = 0; i < 5; i++) await act(() => vi.advanceTimersByTimeAsync(0));
}

const card = (name: string) => screen.getByRole('listitem', { name });
const nameField = () => screen.getByRole('combobox', { name: 'Name' });
const generateButton = () => screen.getByRole('button', { name: 'Generate' });
const bodyOf = (calls: { key: string; init?: RequestInit }[], key: string) =>
  JSON.parse(calls.find((c) => c.key === key)!.init!.body as string) as unknown;

/** Runs the poll timer and lets its fetch and state updates settle. */
async function nextPoll() {
  await act(() => vi.advanceTimersByTimeAsync(2000));
}

describe('Admin dashboard', () => {
  it('shows Add category with the category names to pick from, and each level with its count, status and link', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog()] });
    expect(screen.getByRole('heading', { name: 'Add category' })).toBeTruthy();
    const options = document.querySelectorAll('#admin-category-names option');
    expect([...options].map((o) => o.getAttribute('value'))).toEqual(['Rivers']);
    expect(nameField().getAttribute('list')).toBe('admin-category-names');
    for (const d of ['Easy', 'Medium', 'Hard']) {
      expect(screen.getByRole('checkbox', { name: d })).toHaveProperty('checked', true);
      expect(screen.getByRole('spinbutton', { name: `${d} questions` })).toHaveProperty(
        'value',
        '15',
      );
    }
    expect(screen.getByText('18 of 20 levels left today (UTC).')).toBeTruthy();

    const rivers = within(card('Rivers'));
    const rows = rivers.getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^Rivers – Easy15 questionsliveRegenerate$/),
      expect.stringMatching(/^Rivers – Medium13 of 15newRegenerate$/),
      expect.stringMatching(/^Rivers – Hard15 questionsdraftRegenerate$/),
    ]);
    expect(rivers.getByRole('link', { name: 'Rivers – Medium' }).getAttribute('href')).toBe(
      '/admin/sets/riv-m',
    );
    expect(rivers.getByRole('button', { name: 'Publish all of Rivers' })).toBeTruthy();
    expect(rivers.getByRole('button', { name: 'Delete Rivers' })).toBeTruthy();
  });

  it('refuses a form with no name, no level or a count outside 5–30, sending nothing', async () => {
    const calls = await renderDashboard({ [CATEGORIES]: [catalog()] });
    fireEvent.click(generateButton());
    expect(screen.getByRole('alert').textContent).toBe('Enter a category name.');

    fireEvent.change(nameField(), { target: { value: 'Moons' } });
    for (const d of ['Easy', 'Medium', 'Hard']) {
      fireEvent.click(screen.getByRole('checkbox', { name: d }));
    }
    fireEvent.click(generateButton());
    expect(screen.getByRole('alert').textContent).toBe('Tick at least one level.');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Hard' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Hard questions' }), {
      target: { value: '31' },
    });
    fireEvent.click(generateButton());
    expect(screen.getByRole('alert').textContent).toBe('Hard needs 5–30 questions.');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Hard questions' }), {
      target: { value: '4' },
    });
    fireEvent.click(generateButton());
    expect(screen.getByRole('alert').textContent).toBe('Hard needs 5–30 questions.');
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false);
  });

  it('starts a generation, shows its progress every 2 s with the form off, then refreshes the list when done', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const done = job({
      state: 'done',
      currentLevel: null,
      finished: [
        { difficulty: 'easy', setId: 'moon-e', title: 'Moons – Easy', questions: 12, count: 12 },
      ],
      levels: [{ difficulty: 'easy', count: 12 }],
    });
    const moons: AdminCategory = {
      name: 'Moons',
      levels: [
        level({ setId: 'moon-e', title: 'Moons – Easy', questions: 12, wanted: 12, status: 'new' }),
      ],
      job: null,
    };
    const calls = await renderDashboard({
      [CATEGORIES]: [
        catalog(),
        catalog([{ name: 'Moons', levels: [], job: job() }, RIVERS], { running: job() }),
        catalog([moons, RIVERS], { usedToday: 3 }),
      ],
      'POST /api/admin/categories/generate': [json({ jobId: 'job1' }, 202)],
      'GET /api/admin/jobs/job1': [
        json(job({ state: 'checking' })),
        json(job({ state: 'checking', currentLevel: 'medium' })),
        json(done),
      ],
    });
    fireEvent.change(nameField(), { target: { value: '  Moons ' } });
    fireEvent.change(screen.getByLabelText('Guidance (optional)'), {
      target: { value: ' Moons of the solar system ' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hard' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Easy questions' }), {
      target: { value: '12' },
    });
    fireEvent.click(generateButton());
    await settle();
    expect(screen.getByText(/A generation is running/)).toBeTruthy();

    expect(bodyOf(calls, 'POST /api/admin/categories/generate')).toEqual({
      category: 'Moons',
      guidance: 'Moons of the solar system',
      levels: [
        { difficulty: 'easy', count: 12 },
        { difficulty: 'medium', count: 15 },
      ],
    });
    const form = screen.getByRole('form', { name: 'Add category' });
    expect(
      within(form).getByRole('group', { name: 'Levels' }).closest('fieldset[disabled]'),
    ).not.toBeNull();
    expect(nameField().matches(':disabled')).toBe(true);
    expect(within(card('Moons')).getAllByText('generating')).toHaveLength(2);

    // Every 2 s: not before.
    await act(() => vi.advanceTimersByTimeAsync(1999));
    expect(calls.filter((c) => c.key === 'GET /api/admin/jobs/job1')).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByRole('status').textContent).toBe(
      'Generating Moons: Checking the facts · Easy, level 1 of 2 · $0.03 so far',
    );
    await nextPoll();
    expect(screen.getByRole('status').textContent).toMatch(/Medium, level 2 of 2/);
    expect(calls.filter((c) => c.key === 'GET /api/admin/jobs/job1')).toHaveLength(2);

    await nextPoll();
    expect(screen.getByRole('status').textContent).toBe(
      'Moons is ready: 1 level saved as drafts ($0.03).',
    );
    await settle();
    expect(within(card('Moons')).getByText('12 questions')).toBeTruthy();
    expect(nameField().matches(':disabled')).toBe(false);
    expect(screen.getByText('17 of 20 levels left today (UTC).')).toBeTruthy();
    // Done: no more polls.
    await nextPoll();
    expect(calls.filter((c) => c.key === 'GET /api/admin/jobs/job1')).toHaveLength(3);
  });

  it('shows a failed job’s message, and the failed level in its category', async () => {
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
    // The page opens on a job that is already running, and follows it.
    await renderDashboard({
      [CATEGORIES]: [
        catalog([{ name: 'Moons', levels: [], job: job() }], { running: job() }),
        catalog([moons]),
      ],
      'GET /api/admin/jobs/job1': [json(failed)],
    });
    expect(screen.getByRole('status').textContent).toMatch(/^Generating Moons: Writing/);
    await nextPoll();
    expect(screen.getByRole('alert').textContent).toBe(
      'Generation failed: The Claude API is busy. Try again in a few minutes.',
    );
    await settle();
    expect(within(card('Moons')).getByText('failed')).toBeTruthy();
    const moonsCard = within(card('Moons'));
    expect(moonsCard.getByText('Moons – Medium')).toBeTruthy();
    expect(moonsCard.getByText('new')).toBeTruthy();
    expect(moonsCard.getByText(failed.error!)).toBeTruthy();
    expect(nameField().matches(':disabled')).toBe(false);
    // A new try (here refused by the form) replaces the old failure.
    fireEvent.click(generateButton());
    expect(screen.getByRole('alert').textContent).toBe('Enter a category name.');
  });

  it('ends the progress on a cancelled job, saying so (F113)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const cancelled = job({ state: 'cancelled', currentLevel: null });
    await renderDashboard({
      [CATEGORIES]: [
        catalog([{ name: 'Moons', levels: [], job: job() }], { running: job() }),
        catalog([{ name: 'Moons', levels: [], job: cancelled }]),
      ],
      'GET /api/admin/jobs/job1': [json(cancelled)],
    });
    expect(screen.getByRole('status').textContent).toMatch(/^Generating Moons: Writing/);
    await nextPoll();
    expect(screen.getByRole('alert').textContent).toBe('Generation cancelled.');
    await settle();
    expect(nameField().matches(':disabled')).toBe(false);
  });

  it('clears a failed new category with no set, and a new try clears the old failure', async () => {
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

  it('reads "Generation is not set up" with no key, with the form and Regenerate off', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog([RIVERS], { enabled: false })] });
    expect(screen.getByText(/^Generation is not set up/)).toBeTruthy();
    expect(nameField().matches(':disabled')).toBe(true);
    expect(screen.queryByText(/levels left today/)).toBeNull();
    for (const button of within(card('Rivers')).getAllByRole('button', { name: /^Regenerate/ })) {
      expect(button).toHaveProperty('disabled', true);
    }
    // Publishing and deleting need no key.
    expect(screen.getByRole('button', { name: 'Publish all of Rivers' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('reads "Daily limit reached" over the cap, and shows a 429 from the server', async () => {
    await renderDashboard({ [CATEGORIES]: [catalog([RIVERS], { usedToday: 20 })] });
    expect(screen.getByText(/^Daily limit reached/)).toBeTruthy();
    expect(nameField().matches(':disabled')).toBe(true);
    cleanup();
    resetAdminSession();

    await renderDashboard({
      [CATEGORIES]: [catalog([RIVERS], { usedToday: 18 }), catalog()],
      'POST /api/admin/categories/generate': [
        json({ ok: false, error: 'Only 2 more levels can be generated today (UTC).' }, 429),
      ],
    });
    fireEvent.change(nameField(), { target: { value: 'Moons' } });
    fireEvent.click(generateButton());
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Only 2 more levels can be generated today (UTC).',
    );
    expect(nameField()).toHaveProperty('value', 'Moons');
  });

  it('Publish all asks first, then publishes the category and refreshes the list', async () => {
    const calls = await renderDashboard({
      [CATEGORIES]: [
        catalog(),
        catalog([{ ...RIVERS, levels: RIVERS.levels.map((l) => ({ ...l, status: 'live' })) }]),
      ],
      'POST /api/admin/categories/Rivers/publish': [json({ published: 2 })],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish all of Rivers' }));
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Publish 2 sets' }));
    await vi.waitFor(() => expect(within(card('Rivers')).getAllByText('live')).toHaveLength(3));
    expect(calls.find((c) => c.key === 'POST /api/admin/categories/Rivers/publish')).toBeTruthy();
    // Nothing left to publish.
    expect(screen.getByRole('button', { name: 'Publish all of Rivers' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('Publish all names the draft that stopped it, with its problems and a link to its editor', async () => {
    await renderDashboard({
      [CATEGORIES]: [catalog(), catalog()],
      'POST /api/admin/categories/Rivers/publish': [
        json(
          {
            ok: false,
            error: '“Rivers – Hard” cannot be published yet.',
            problems: ['Question 2 › answer: The answer is required'],
            published: 1,
            setId: 'riv-h',
          },
          400,
        ),
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish all of Rivers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish 2 sets' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/^“Rivers – Hard” cannot be published yet\./);
    expect(within(alert).getByText('Question 2 › answer: The answer is required')).toBeTruthy();
    expect(
      within(alert).getByRole('link', { name: 'Open it in the editor' }).getAttribute('href'),
    ).toBe('/admin/sets/riv-h');
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

  it('Regenerate asks first, then writes the level again and shows it generating until done', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const regen = job({
      kind: 'regenerate',
      setId: 'riv-m',
      category: 'Rivers',
      levels: [{ difficulty: 'medium', count: 13 }],
      currentLevel: 'medium',
    });
    const calls = await renderDashboard({
      [CATEGORIES]: [
        catalog(),
        catalog([{ ...RIVERS, job: regen }], { running: regen }),
        catalog(),
      ],
      'POST /api/admin/built-in-sets/riv-m/regenerate': [json({ jobId: 'job1' }, 202)],
      'GET /api/admin/jobs/job1': [
        json({
          ...regen,
          state: 'done',
          currentLevel: null,
          finished: [
            {
              difficulty: 'medium',
              setId: 'riv-m',
              title: 'Rivers – Medium',
              questions: 13,
              count: 13,
            },
          ],
        }),
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Rivers – Medium' }));
    fireEvent.click(screen.getByRole('button', { name: 'Write it again' }));
    await settle();
    expect(within(card('Rivers')).getByText('generating')).toBeTruthy();
    expect(
      calls.find((c) => c.key === 'POST /api/admin/built-in-sets/riv-m/regenerate'),
    ).toBeTruthy();
    // One job at a time: every Regenerate and the form wait.
    for (const button of within(card('Rivers')).getAllByRole('button', { name: /^Regenerate/ })) {
      expect(button).toHaveProperty('disabled', true);
    }
    expect(screen.getByRole('button', { name: 'Publish all of Rivers' })).toHaveProperty(
      'disabled',
      true,
    );
    await nextPoll();
    expect(screen.getByRole('status').textContent).toBe(
      'Rivers is ready: 1 level written again as a draft ($0.03).',
    );
    await settle();
    expect(within(card('Rivers')).queryByText('generating')).toBeNull();
  });
});
