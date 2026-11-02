// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerateJob } from '../../../shared/types.js';
import { resetAdminSession } from '../lib/adminSession.js';
import {
  CATEGORIES,
  LocationProbe,
  RIVERS,
  bodyOf,
  callsTo,
  catalog,
  job,
  json,
  nextPoll,
  settle,
  signedIn,
  stubServer,
  type Answer,
} from '../test/adminServer.js';
import { AdminGenerate, UNREACHABLE_TEXT } from './AdminGenerate.js';

const JOB1 = 'GET /api/admin/jobs/job1';
const START = 'POST /api/admin/categories/generate';

/** The page at `url`, with every other route empty, and where the router is now. */
async function renderAt(url: string, routes: Record<string, Answer[]>, session = signedIn) {
  const calls = stubServer({ 'GET /api/admin/session': [session], ...routes });
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/admin/generate" element={<AdminGenerate />} />
        <Route path="*" element={null} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
  await settle();
  return calls;
}

const where = () => screen.getByTestId('location').textContent;
const nameField = () => screen.getByRole('combobox', { name: 'Name' });
const generateButton = () => screen.getByRole('button', { name: 'Generate' });
const bar = () => screen.getByRole('progressbar', { name: 'Progress' });
const steps = () =>
  [...document.querySelectorAll('[data-step]')].map((s) => s.getAttribute('data-step'));
const checklist = () =>
  within(screen.getByRole('list', { name: 'Levels' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent);

const easySaved = (questions = 15) => ({
  difficulty: 'easy' as const,
  setId: 'moon-e',
  title: 'Moons – Easy',
  questions,
  count: 15,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetAdminSession();
});

describe('/admin/generate', () => {
  it('is for the signed-in admin only', async () => {
    const calls = await renderAt('/admin/generate', {}, json({ ok: false, error: 'x' }, 401));
    expect(screen.getByRole('alert').textContent).toMatch(/^Only the admin can generate/);
    expect(screen.getByRole('link', { name: 'Sign in as admin' }).getAttribute('href')).toBe(
      '/admin',
    );
    expect(screen.queryByRole('form', { name: 'Add category' })).toBeNull();
    expect(callsTo(calls, CATEGORIES)).toBe(0);
  });

  it('holds the Add category form: names to pick from, the levels at 15 and the levels left today', async () => {
    await renderAt('/admin/generate', { [CATEGORIES]: [catalog()] });
    expect(screen.getByRole('heading', { level: 1, name: 'Add category' })).toBeTruthy();
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
    expect(screen.getByRole('link', { name: '← Admin' }).getAttribute('href')).toBe('/admin');
  });

  it('refuses a form with no name, no level or a count outside 5–30, sending nothing', async () => {
    const calls = await renderAt('/admin/generate', { [CATEGORIES]: [catalog()] });
    fireEvent.click(generateButton());
    expect(screen.getByRole('alert').textContent).toBe('Enter a category name.');

    fireEvent.change(nameField(), { target: { value: 'Moons' } });
    for (const d of ['Easy', 'Medium', 'Hard']) {
      fireEvent.click(screen.getByRole('checkbox', { name: d }));
    }
    fireEvent.click(generateButton());
    expect(screen.getByRole('alert').textContent).toBe('Tick at least one level.');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Hard' }));
    const hard = screen.getByRole('spinbutton', { name: 'Hard questions' });
    fireEvent.change(hard, { target: { value: '31' } });
    fireEvent.click(generateButton());
    expect(screen.getByRole('alert').textContent).toBe('Hard needs 5–30 questions.');
    fireEvent.change(hard, { target: { value: '4' } });
    fireEvent.click(generateButton());
    expect(screen.getByRole('alert').textContent).toBe('Hard needs 5–30 questions.');
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false);
  });

  it('turns the form off with no key, and over the daily limit', async () => {
    await renderAt('/admin/generate', { [CATEGORIES]: [catalog([RIVERS], { enabled: false })] });
    expect(screen.getByText(/^Generation is not set up/)).toBeTruthy();
    expect(nameField().matches(':disabled')).toBe(true);
    expect(screen.queryByText(/levels left today/)).toBeNull();
    cleanup();
    resetAdminSession();
    await renderAt('/admin/generate', { [CATEGORIES]: [catalog([RIVERS], { usedToday: 20 })] });
    expect(screen.getByText(/^Daily limit reached/)).toBeTruthy();
    expect(nameField().matches(':disabled')).toBe(true);
  });

  it('shows a refused start (429) and keeps what was typed', async () => {
    await renderAt('/admin/generate', {
      [CATEGORIES]: [catalog([RIVERS], { usedToday: 18 })],
      [START]: [
        json({ ok: false, error: 'Only 2 more levels can be generated today (UTC).' }, 429),
      ],
    });
    fireEvent.change(nameField(), { target: { value: 'Moons' } });
    fireEvent.click(generateButton());
    await settle();
    expect(screen.getByRole('alert').textContent).toBe(
      'Only 2 more levels can be generated today (UTC).',
    );
    expect(nameField()).toHaveProperty('value', 'Moons');
    expect(where()).toBe('/admin/generate');
  });

  it('starts, follows the job at ?job=, and shows the stepped bar, stage, checklist and cost, polling every 2 s', async () => {
    const calls = await renderAt('/admin/generate', {
      [CATEGORIES]: [catalog()],
      [START]: [json({ jobId: 'job1' }, 202)],
      [JOB1]: [
        json(job()),
        json(job({ state: 'checking' })),
        json(
          job({
            state: 'topping up',
            currentLevel: 'medium',
            finished: [easySaved(13)],
            short: [easySaved(13)],
            usage: { ...job().usage, costUsd: 0.004 },
          }),
        ),
      ],
    });
    fireEvent.change(nameField(), { target: { value: '  Moons ' } });
    fireEvent.change(screen.getByLabelText('Guidance (optional)'), {
      target: { value: ' Moons of the solar system ' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hard' }));
    fireEvent.click(generateButton());
    await settle();
    expect(bodyOf(calls, START)).toEqual({
      category: 'Moons',
      guidance: 'Moons of the solar system',
      levels: [
        { difficulty: 'easy', count: 15 },
        { difficulty: 'medium', count: 15 },
      ],
    });
    expect(where()).toBe('/admin/generate?job=job1');

    // At once: a write step and a check step per level, the first one running.
    expect(screen.getByRole('heading', { level: 1, name: 'Generating Moons' })).toBeTruthy();
    expect(bar().getAttribute('aria-valuemax')).toBe('4');
    expect(bar().getAttribute('aria-valuenow')).toBe('0');
    expect(steps()).toEqual(['running', 'waiting', 'waiting', 'waiting']);
    expect(screen.getByRole('status').textContent).toBe('Writing the questionsEasy, level 1 of 2');
    expect(checklist()).toEqual(['●EasyIn progress', '○MediumWaiting']);
    expect(screen.getByText('$0.03 so far')).toBeTruthy();

    // Every 2 s: not before.
    await act(() => vi.advanceTimersByTimeAsync(1999));
    expect(callsTo(calls, JOB1)).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(callsTo(calls, JOB1)).toBe(2);
    expect(bar().getAttribute('aria-valuenow')).toBe('1');
    expect(steps()).toEqual(['done', 'running', 'waiting', 'waiting']);
    expect(screen.getByRole('status').textContent).toBe('Checking the factsEasy, level 1 of 2');

    await nextPoll();
    expect(bar().getAttribute('aria-valuenow')).toBe('3');
    expect(steps()).toEqual(['done', 'done', 'done', 'running']);
    expect(screen.getByRole('status').textContent).toBe(
      'Replacing dropped questionsMedium, level 2 of 2',
    );
    expect(checklist()).toEqual(['✓EasyDone · 13 of 15', '●MediumIn progress']);
    expect(screen.getByText('under $0.01 so far')).toBeTruthy();
  });

  it('done, a generate goes to the category’s review', async () => {
    await renderAt('/admin/generate?job=job1', {
      [JOB1]: [
        json(job()),
        json(job({ state: 'done', currentLevel: null, category: 'Moons & Stars' })),
      ],
    });
    expect(screen.getByRole('progressbar')).toBeTruthy();
    await nextPoll();
    expect(where()).toBe('/admin/categories/Moons%20%26%20Stars');
  });

  it('done, a regenerate goes to that level’s list', async () => {
    const regen: Partial<GenerateJob> = {
      kind: 'regenerate',
      setId: 'riv-m',
      category: 'Rivers',
      levels: [{ difficulty: 'medium', count: 13 }],
      currentLevel: 'medium',
    };
    await renderAt('/admin/generate?job=job1', {
      [JOB1]: [json(job(regen)), json(job({ ...regen, state: 'done', currentLevel: null }))],
    });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Regenerating Rivers – Medium' }),
    ).toBeTruthy();
    expect(bar().getAttribute('aria-valuemax')).toBe('2');
    await nextPoll();
    expect(where()).toBe('/admin/categories/Rivers/riv-m');
  });

  it('opening the page while a job runs follows that job', async () => {
    const calls = await renderAt('/admin/generate', {
      [CATEGORIES]: [catalog([RIVERS], { running: job({ state: 'checking' }) })],
      [JOB1]: [json(job({ state: 'checking' }))],
    });
    expect(where()).toBe('/admin/generate?job=job1');
    expect(screen.queryByRole('form', { name: 'Add category' })).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/^Checking the facts/);
    expect(callsTo(calls, JOB1)).toBe(1);
  });

  it('Cancel asks first, then cancels, reads "Cancelling…" until the job stops, and names the level', async () => {
    const running = job({ currentLevel: 'medium', finished: [easySaved()] });
    const cancelled = job({ state: 'cancelled', currentLevel: null, finished: [easySaved()] });
    const calls = await renderAt('/admin/generate?job=job1', {
      [JOB1]: [json(running), json(running), json(cancelled)],
      'POST /api/admin/jobs/job1/cancel': [json(running)],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel the generation' }));
    expect(callsTo(calls, 'POST /api/admin/jobs/job1/cancel')).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Stop generating' }));
    await settle();
    expect(callsTo(calls, 'POST /api/admin/jobs/job1/cancel')).toBe(1);
    expect(screen.getByRole('status').textContent).toMatch(/^Cancelling…/);
    expect(screen.getByRole('button', { name: 'Cancelling…' })).toHaveProperty('disabled', true);

    await nextPoll();
    expect(screen.getByRole('status').textContent).toMatch(/^Cancelling…/);
    await nextPoll();
    expect(screen.getByRole('alert').textContent).toBe('Cancelled at Medium.');
    expect(checklist()).toEqual(['✓EasyDone · 15 questions', '✕MediumCancelled']);
    expect(screen.getByText('Cost: $0.03')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Cancel/ })).toBeNull();
    // Ended: no more polls.
    await nextPoll();
    expect(callsTo(calls, JOB1)).toBe(3);
  });

  it('failed after a level saved: names the level and why, offers Review what was saved and Try the rest again', async () => {
    const failed = job({
      state: 'failed',
      currentLevel: null,
      guidance: 'Moons of the solar system',
      levels: [
        { difficulty: 'easy', count: 15 },
        { difficulty: 'medium', count: 12 },
        { difficulty: 'hard', count: 10 },
      ],
      finished: [easySaved()],
      error: 'The Claude API is busy. Try again in a few minutes.',
    });
    const calls = await renderAt('/admin/generate?job=job1', {
      [JOB1]: [json(failed)],
      [START]: [json({ jobId: 'job2' }, 202)],
      'GET /api/admin/jobs/job2': [json(job({ id: 'job2' }))],
    });
    expect(screen.getByRole('alert').textContent).toBe(
      'Medium failed: The Claude API is busy. Try again in a few minutes.',
    );
    expect(checklist()).toEqual(['✓EasyDone · 15 questions', '✕MediumFailed', '○HardNot started']);
    expect(steps()).toEqual(['done', 'done', 'waiting', 'waiting', 'waiting', 'waiting']);
    expect(screen.getByRole('link', { name: 'Review what was saved' }).getAttribute('href')).toBe(
      '/admin/categories/Moons',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try the rest again' }));
    await settle();
    expect(bodyOf(calls, START)).toEqual({
      category: 'Moons',
      guidance: 'Moons of the solar system',
      levels: [
        { difficulty: 'medium', count: 12 },
        { difficulty: 'hard', count: 10 },
      ],
    });
    expect(where()).toBe('/admin/generate?job=job2');
    expect(screen.getByRole('status').textContent).toMatch(/^Writing the questions/);
  });

  it('failed with nothing saved: no Review, and Try again starts every level; a refusal shows', async () => {
    const failed = job({ state: 'failed', currentLevel: null, error: 'Out of credit.' });
    const calls = await renderAt('/admin/generate?job=job1', {
      [JOB1]: [json(failed)],
      [START]: [json({ ok: false, error: 'Questions are being replaced' }, 409)],
    });
    expect(screen.getByRole('alert').textContent).toBe('Easy failed: Out of credit.');
    expect(screen.queryByRole('link', { name: 'Review what was saved' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await settle();
    expect(bodyOf(calls, START)).toEqual({
      category: 'Moons',
      levels: [
        { difficulty: 'easy', count: 15 },
        { difficulty: 'medium', count: 15 },
      ],
    });
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toContain(
      'Questions are being replaced',
    );
    expect(where()).toBe('/admin/generate?job=job1');
  });

  it('a failed regenerate tries the same set again', async () => {
    const failed = job({
      kind: 'regenerate',
      setId: 'riv-m',
      category: 'Rivers',
      levels: [{ difficulty: 'medium', count: 13 }],
      state: 'failed',
      currentLevel: null,
      error: 'Busy.',
    });
    const calls = await renderAt('/admin/generate?job=job1', {
      [JOB1]: [json(failed)],
      'POST /api/admin/built-in-sets/riv-m/regenerate': [json({ jobId: 'job2' }, 202)],
    });
    expect(screen.getByRole('alert').textContent).toBe('Medium failed: Busy.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await settle();
    expect(callsTo(calls, 'POST /api/admin/built-in-sets/riv-m/regenerate')).toBe(1);
    expect(where()).toBe('/admin/generate?job=job2');
  });

  it('a job the server does not know says so and stops polling', async () => {
    const calls = await renderAt('/admin/generate?job=gone', {
      'GET /api/admin/jobs/gone': [
        json({ ok: false, error: 'There is no job with that id.' }, 404),
      ],
    });
    expect(screen.getByRole('alert').textContent).toMatch(/does not know this generation/);
    expect(screen.getByRole('link', { name: 'Add category' }).getAttribute('href')).toBe(
      '/admin/generate',
    );
    await nextPoll();
    expect(callsTo(calls, 'GET /api/admin/jobs/gone')).toBe(1);
  });

  it('a missed poll is tried again 2 s later', async () => {
    const calls = await renderAt('/admin/generate?job=job1', {
      [JOB1]: [
        json(job()),
        () => Response.json({ error: 'x' }, { status: 502 }),
        json(job({ state: 'checking' })),
      ],
    });
    await nextPoll();
    expect(screen.getByRole('status').textContent).toMatch(/^Writing/);
    await nextPoll();
    expect(screen.getByRole('status').textContent).toMatch(/^Checking/);
    expect(callsTo(calls, JOB1)).toBe(3);
  });

  it('says it cannot reach the server after 3 missed polls, and stops saying so once one answers', async () => {
    const miss: Answer = () => Response.json({ error: 'x' }, { status: 502 });
    await renderAt('/admin/generate?job=job1', {
      [JOB1]: [json(job()), miss, miss, miss, json(job({ state: 'checking' }))],
    });
    await nextPoll();
    await nextPoll();
    expect(screen.queryByText(UNREACHABLE_TEXT)).toBeNull();
    await nextPoll();
    expect(screen.getByRole('alert').textContent).toBe(UNREACHABLE_TEXT);
    // The progress it last had stays on screen.
    expect(screen.getByRole('status').textContent).toMatch(/^Writing/);
    await nextPoll();
    expect(screen.queryByText(UNREACHABLE_TEXT)).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/^Checking/);
  });

  it('offers no Try the rest again when every level was saved before the failure', async () => {
    const failed = job({
      state: 'failed',
      currentLevel: null,
      levels: [{ difficulty: 'easy', count: 15 }],
      finished: [easySaved()],
      error: 'The save failed.',
    });
    await renderAt('/admin/generate?job=job1', { [JOB1]: [json(failed)] });
    expect(screen.getByRole('link', { name: 'Review what was saved' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Try/ })).toBeNull();
  });
});
