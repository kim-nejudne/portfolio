// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminJobsResponse, GenerationJob, JobLevel } from '#shared/types.js';
import { categoryBadge, inFilter } from '../lib/adminCategories.js';
import { levelSteps, regenerateCount, stopText, unsavedLevels } from '../lib/adminJobs.js';
import { AdminGenerate, formProblem } from './AdminGenerate.js';

const lv = (level: JobLevel['level'], extra: Partial<JobLevel> = {}): JobLevel => ({
  level,
  count: 15,
  state: 'waiting',
  stage: null,
  kept: { city: 0, landmark: 0 },
  ...extra,
});

function job(extra: Partial<GenerationJob> = {}): GenerationJob {
  return {
    id: 'j1',
    kind: 'generate',
    guidance: 'Include Hokkaido',
    state: 'running',
    categoryId: null,
    category: 'Japan',
    levels: [lv('easy', { state: 'running', stage: 'write' }), lv('hard', { count: 20 })],
    placeKind: null,
    placeId: null,
    replaced: null,
    queuePosition: null,
    costUsd: 0,
    error: null,
    startedAt: 1,
    endedAt: null,
    ...extra,
  };
}

const jobsList = (jobs: GenerationJob[] = [], extra: Partial<AdminJobsResponse> = {}) => ({
  jobs,
  off: null,
  levelsLeft: 20,
  replacementsLeft: 100,
  ...extra,
});

type Reply = { status?: number; body: unknown };
type Call = { url: string; method: string; body: unknown };

/** Answers by `METHOD url`; an array answers in turn, then repeats its last reply. */
function stubFetch(routes: Record<string, Reply | Reply[]>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body ? JSON.parse(init.body as string) : undefined });
      const handler = routes[`${method} ${url}`];
      const reply = Array.isArray(handler)
        ? handler.length > 1
          ? handler.shift()!
          : handler[0]!
        : (handler ?? { status: 404, body: { error: 'There is no job with that id.' } });
      return Response.json(reply.body, { status: reply.status ?? 200 });
    }),
  );
  return calls;
}

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
}

const where = () => screen.getByTestId('where').textContent;

async function renderAt(path = '/admin/generate') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/generate" element={<AdminGenerate />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
  await flush();
}

/** Lets fetch answers and their state updates land. */
const flush = () => act(async () => {});
const tick = (ms = 1000) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Generate form', () => {
  const levels = (count = '15', on = true) => ({
    easy: { on, count },
    medium: { on, count },
    hard: { on, count },
  });

  it('checks the name, guidance, levels and places per mode', () => {
    expect(formProblem('  ', '', levels())).toBe('Enter a name.');
    expect(formProblem('x'.repeat(41), '', levels())).toBe(
      'The name can be at most 40 characters.',
    );
    expect(formProblem('Japan', 'x'.repeat(501), levels())).toBe(
      'The guidance can be at most 500 characters.',
    );
    expect(formProblem('Japan', '', levels('15', false))).toBe('Pick at least one level.');
    for (const count of ['4', '31', '7.5', '']) {
      expect(formProblem('Japan', '', levels(count))).toBe('Easy needs 5–30 places per mode.');
    }
    expect(formProblem('x'.repeat(40), 'x'.repeat(500), levels('30'))).toBeNull();
  });

  it('starts the levels ticked with their counts, then follows the job', async () => {
    const calls = stubFetch({
      'GET /api/admin/jobs': { body: jobsList() },
      'POST /api/admin/categories/generate': { body: { jobId: 'j1' } },
      'GET /api/admin/jobs/j1': { body: { job: job() } },
    });
    await renderAt();
    expect(screen.getByText('20 levels left today (UTC).')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: ' Japan ' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Guidance (optional)' }), {
      target: { value: 'Include Hokkaido' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Medium' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Hard places per mode' }), {
      target: { value: '20' },
    });
    // Each level shows 15 until changed.
    expect(
      (screen.getByRole('spinbutton', { name: 'Easy places per mode' }) as HTMLInputElement).value,
    ).toBe('15');
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await flush();
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
      name: 'Japan',
      guidance: 'Include Hokkaido',
      levels: { easy: { count: 15 }, hard: { count: 20 } },
    });
    expect(where()).toBe('/admin/generate?job=j1');
    expect(screen.getByRole('heading', { name: 'Generating Japan' })).toBeTruthy();
  });

  it('shows a refusal from the server and sends nothing when the form is wrong', async () => {
    const calls = stubFetch({
      'GET /api/admin/jobs': { body: jobsList() },
      'POST /api/admin/categories/generate': {
        status: 429,
        body: { error: 'Only 1 more level can be generated today (UTC).' },
      },
    });
    await renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a name.');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Japan' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await flush();
    expect(screen.getByRole('alert').textContent).toBe(
      'Only 1 more level can be generated today (UTC).',
    );
  });

  it('is off with the reason when the server has no Anthropic key', async () => {
    const off = 'Generation is off: PINPOINT_ANTHROPIC_API_KEY is not set.';
    stubFetch({ 'GET /api/admin/jobs': { body: jobsList([], { off }) } });
    await renderAt();
    expect(screen.getByText(off)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate' }).matches(':disabled')).toBe(true);
  });
});

describe('Generate progress', () => {
  it('resumes a running generation when the page is opened again', async () => {
    stubFetch({
      'GET /api/admin/jobs': { body: jobsList([job({ id: 'jR' })]) },
      'GET /api/admin/jobs/jR': { body: { job: job({ id: 'jR' }) } },
    });
    await renderAt();
    expect(where()).toBe('/admin/generate?job=jR');
    expect(screen.getByRole('heading', { name: 'Generating Japan' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Writing the places');
  });

  it('polls every second: stage, steps, places kept and cost, then the category page', async () => {
    const calls = stubFetch({
      'GET /api/admin/jobs/j1': [
        {
          body: {
            job: job({
              costUsd: 0.04,
              levels: [
                lv('easy', { state: 'running', stage: 'locate', kept: { city: 3, landmark: 2 } }),
                lv('hard', { count: 20 }),
              ],
            }),
          },
        },
        {
          body: {
            job: job({
              categoryId: 'japan',
              costUsd: 0.31,
              levels: [
                lv('easy', { state: 'saved', kept: { city: 15, landmark: 14 } }),
                lv('hard', { count: 20, state: 'running', stage: 'replace' }),
              ],
            }),
          },
        },
        { body: { job: job({ state: 'done', categoryId: 'japan', costUsd: 0.5 }) } },
      ],
    });
    await renderAt('/admin/generate?job=j1');
    const status = screen.getByRole('status').textContent;
    expect(status).toContain('Finding them on Wikidata');
    expect(status).toContain('Easy, level 1 of 2');
    const easy = screen.getByRole('progressbar', { name: 'Easy steps' });
    expect(easy.getAttribute('aria-valuenow')).toBe('1');
    expect(easy.getAttribute('aria-valuemax')).toBe('4');
    expect(within(easy).getByText('Locate').closest('[data-step]')!.getAttribute('data-step')).toBe(
      'running',
    );
    expect(screen.getByText('Cities 3/15 · Landmarks 2/15')).toBeTruthy();
    expect(screen.getByText('$0.04 so far')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel the generation' })).toBeTruthy();

    await tick();
    expect(screen.getByRole('status').textContent).toContain('Replacing dropped places');
    const hard = screen.getByRole('progressbar', { name: 'Hard steps' });
    // Replace joins the bar once drops are being replaced.
    expect(hard.getAttribute('aria-valuemax')).toBe('5');
    expect(hard.getAttribute('aria-valuenow')).toBe('4');
    expect(screen.getByText('Cities 15/15 · Landmarks 14/15')).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: 'Easy steps' }).getAttribute('aria-valuenow'),
    ).toBe('4');

    await tick();
    expect(where()).toBe('/admin/categories/japan');
    expect(calls.filter((c) => c.url === '/api/admin/jobs/j1')).toHaveLength(3);
  });

  it('leads a finished regenerate to the level’s review', async () => {
    stubFetch({
      'GET /api/admin/jobs/j1': {
        body: {
          job: job({
            kind: 'regenerate',
            state: 'done',
            categoryId: 'japan',
            levels: [lv('hard', { state: 'saved' })],
          }),
        },
      },
    });
    await renderAt('/admin/generate?job=j1');
    expect(where()).toBe('/admin/categories/japan/hard');
  });

  it('says it cannot reach the server after three missed polls, and keeps trying', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await renderAt('/admin/generate?job=j1');
    await tick();
    await tick();
    expect(screen.getByRole('alert').textContent).toContain('Cannot reach the server');
  });

  it('says so when the server no longer knows the job', async () => {
    stubFetch({});
    await renderAt('/admin/generate?job=gone');
    expect(screen.getByRole('alert').textContent).toBe('There is no job with that id.');
    expect(screen.getByRole('link', { name: 'Add category' })).toBeTruthy();
  });
});

describe('Generate failure and cancel', () => {
  const failed = job({
    state: 'failed',
    categoryId: 'japan',
    error: 'Wikidata isn’t answering. Try again later.',
    costUsd: 0.2,
    levels: [lv('easy', { state: 'saved' }), lv('medium', { state: 'failed' }), lv('hard')],
  });

  it('names the level and why, with Review what was saved and Try the rest again', async () => {
    const calls = stubFetch({
      'GET /api/admin/jobs/j1': { body: { job: failed } },
      'POST /api/admin/categories/japan/generate': { body: { jobId: 'j2' } },
      'GET /api/admin/jobs/j2': { body: { job: job({ id: 'j2' }) } },
    });
    await renderAt('/admin/generate?job=j1');
    expect(screen.getByRole('alert').textContent).toBe(
      'Medium failed: Wikidata isn’t answering. Try again later.',
    );
    expect(screen.getByText('Cost: $0.20')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Review what was saved' }).getAttribute('href')).toBe(
      '/admin/categories/japan',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try the rest again' }));
    await flush();
    expect(calls.find((c) => c.method === 'POST')).toEqual({
      url: '/api/admin/categories/japan/generate',
      method: 'POST',
      body: {
        guidance: 'Include Hokkaido',
        levels: { medium: { count: 15 }, hard: { count: 15 } },
      },
    });
    expect(where()).toBe('/admin/generate?job=j2');
  });

  it('tries a new category again by name when no level saved', async () => {
    const calls = stubFetch({
      'GET /api/admin/jobs/j1': {
        body: {
          job: job({
            state: 'failed',
            error: 'Claude gave no usable box for this region.',
            levels: [lv('easy', { state: 'failed' }), lv('hard', { count: 20 })],
          }),
        },
      },
      'POST /api/admin/categories/generate': { body: { jobId: 'j2' } },
    });
    await renderAt('/admin/generate?job=j1');
    expect(screen.queryByRole('link', { name: 'Review what was saved' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await flush();
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
      name: 'Japan',
      guidance: 'Include Hokkaido',
      levels: { easy: { count: 15 }, hard: { count: 20 } },
    });
  });

  it('regenerates the same level again after a failed regenerate', async () => {
    const calls = stubFetch({
      'GET /api/admin/jobs/j1': {
        body: {
          job: job({
            kind: 'regenerate',
            state: 'failed',
            categoryId: 'japan',
            guidance: '',
            error: 'No Hard place passed the checks. Try again.',
            levels: [lv('hard', { count: 12, state: 'failed' })],
          }),
        },
      },
      'POST /api/admin/categories/japan/levels/hard/regenerate': { body: { jobId: 'j2' } },
    });
    await renderAt('/admin/generate?job=j1');
    expect(screen.getByRole('heading', { name: 'Regenerating Japan · Hard' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await flush();
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ count: 12 });
  });

  it('cancels after a confirm and names the level it stopped at', async () => {
    const cancelled = job({
      state: 'cancelled',
      levels: [lv('easy', { state: 'cancelled' }), lv('hard', { count: 20 })],
    });
    const calls = stubFetch({
      'GET /api/admin/jobs/j1': { body: { job: job() } },
      'POST /api/admin/jobs/j1/cancel': { body: { job: cancelled } },
    });
    await renderAt('/admin/generate?job=j1');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel the generation' }));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Stop generating' }));
    await flush();
    expect(calls.at(-1)!.url).toBe('/api/admin/jobs/j1/cancel');
    expect(screen.getByRole('alert').textContent).toBe('Cancelled at Easy.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('job rules', () => {
  it('marks steps before the running one done, and every step of a saved level', () => {
    expect(
      levelSteps(lv('easy', { state: 'running', stage: 'check' })).map((s) => s.state),
    ).toEqual(['done', 'done', 'running', 'waiting']);
    expect(levelSteps(lv('easy', { state: 'saved' })).every((s) => s.state === 'done')).toBe(true);
    expect(levelSteps(lv('easy')).every((s) => s.state === 'waiting')).toBe(true);
  });

  it('says why a job stopped and which levels are left', () => {
    expect(stopText(job({ state: 'failed', error: 'Boom.' }))).toBe('Failed: Boom.');
    expect(stopText(job({ state: 'cancelled', levels: [] }))).toBe('Cancelled.');
    expect(unsavedLevels(job({ levels: [lv('easy', { state: 'saved' }), lv('hard')] }))).toEqual({
      hard: { count: 15 },
    });
  });

  it('regenerates at the level’s larger mode within 5–30, or 15 for a new level', () => {
    expect(regenerateCount(null)).toBe(15);
    expect(regenerateCount({ city: 12, landmark: 14 })).toBe(14);
    expect(regenerateCount({ city: 1, landmark: 0 })).toBe(5);
    expect(regenerateCount({ city: 40, landmark: 0 })).toBe(30);
  });

  it('badges a category Generating while its generation runs, and Failed when its last one failed', () => {
    const row = {
      id: 'japan',
      name: 'Japan',
      emoji: null,
      hidden: true,
      levels: {
        easy: { state: 'live' as const, published: true, city: 15, landmark: 15 },
        medium: { state: 'missing' as const, published: false, city: 0, landmark: 0 },
        hard: { state: 'missing' as const, published: false, city: 0, landmark: 0 },
      },
    };
    const running = job({ categoryId: 'japan' });
    expect(categoryBadge(row, [running])).toBe('Generating');
    expect(inFilter(row, 'generating', [running])).toBe(true);
    expect(inFilter(row, 'generating', [])).toBe(false);
    const failedJob = job({ categoryId: 'japan', state: 'failed' });
    const doneJob = job({ categoryId: 'japan', state: 'done' });
    expect(categoryBadge(row, [failedJob, doneJob])).toBe('Failed');
    // The newest ended job comes first: a later success clears it.
    expect(categoryBadge(row, [doneJob, failedJob])).toBe('Hidden');
  });
});
