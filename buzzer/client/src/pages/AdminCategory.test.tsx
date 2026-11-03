// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminCategory as Category } from '../../../shared/types.js';
import { resetAdminSession } from '../lib/adminSession.js';
import {
  bodyOf,
  CATEGORIES,
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
} from '../test/adminServer.js';
import { AdminCategory } from './AdminCategory.js';

const PUBLISH = 'POST /api/admin/categories/Rivers/publish';

/** Rivers with its levels out of order, a live one among them, and Hard not reviewed. */
const UNREVIEWED: Category = {
  name: 'Rivers',
  levels: [
    level({
      setId: 'riv-h',
      title: 'Rivers – Hard',
      difficulty: 'hard',
      status: 'new',
      reviewed: false,
    }),
    level({ setId: 'riv-x', title: 'Bonus round', difficulty: null, status: 'live' }),
    level({
      setId: 'riv-m',
      title: 'Rivers – Medium',
      difficulty: 'medium',
      questions: 13,
      wanted: 15,
      status: 'draft',
      reviewed: false,
    }),
    level({ setId: 'riv-e', title: 'Rivers – Easy', status: 'new', wanted: 15 }),
  ],
  job: null,
  hidden: false,
  emoji: null,
};

const REVIEWED: Category = {
  ...UNREVIEWED,
  levels: UNREVIEWED.levels.map((l) => ({ ...l, reviewed: true })),
};

/** Where the router is, and the state it was handed. */
function Probe() {
  const location = useLocation();
  return (
    <>
      <span data-testid="location">{location.pathname + location.search}</span>
      <span data-testid="state">{JSON.stringify(location.state)}</span>
    </>
  );
}

async function renderAt(url: string, routes: Record<string, Answer[]>, session = signedIn) {
  const calls = stubServer({ 'GET /api/admin/session': [session], ...routes });
  render(
    <MemoryRouter initialEntries={[url]}>
      <AdminRoutes path="/admin/categories/:name" page={<AdminCategory />} />
      <Probe />
    </MemoryRouter>,
  );
  return calls;
}

const where = () => screen.getByTestId('location').textContent;
const cards = () => within(screen.getByRole('list', { name: 'Levels' })).getAllByRole('listitem');
const DELETE = 'DELETE /api/admin/categories/Rivers';
const HIDE = 'PUT /api/admin/categories/Rivers/hidden';
const publishButton = () => screen.getByRole('button', { name: 'Publish Rivers' });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetAdminSession();
});

describe('Category page', () => {
  it('lists every level, live or draft, by difficulty then title, each with its count, state and review mark', async () => {
    await renderAt('/admin/categories/Rivers', { [CATEGORIES]: [catalog([UNREVIEWED])] });
    expect(await screen.findByRole('heading', { level: 1, name: 'Rivers' })).toBeTruthy();
    expect(cards().map((c) => c.textContent)).toEqual([
      'Easy15 questionsNewReviewedRegenerate',
      'Medium13 of 15 ⚠ 2 shortDraftNot reviewedRegenerate',
      'Hard15 questionsNewNot reviewedRegenerate',
      // A live level has no review mark; without a difficulty it cannot be regenerated.
      'Bonus round15 questionsLive',
    ]);
    expect(within(cards()[1]!).getByText('⚠ 2 short').className).toMatch(/text-warn/);
    // Each draft links to its level review; the live level has nothing to review.
    expect(cards().map((c) => within(c).queryByRole('link')?.getAttribute('href') ?? null)).toEqual(
      [
        '/admin/categories/Rivers/riv-e',
        '/admin/categories/Rivers/riv-m',
        '/admin/categories/Rivers/riv-h',
        null,
      ],
    );
  });

  it('keeps Publish off and names the levels left while any is not reviewed', async () => {
    const calls = await renderAt('/admin/categories/Rivers', {
      [CATEGORIES]: [catalog([UNREVIEWED])],
    });
    expect(await screen.findByRole('button', { name: 'Publish Rivers' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(
      screen.getByText('Mark every level reviewed to publish. Not reviewed yet: Medium, Hard.'),
    ).toBeTruthy();
    fireEvent.click(publishButton());
    expect(callsTo(calls, PUBLISH)).toBe(0);
  });

  it('publishes once every level is reviewed, after a confirm, and goes to /admin with the message', async () => {
    const calls = await renderAt('/admin/categories/Rivers', {
      [CATEGORIES]: [catalog([REVIEWED])],
      [PUBLISH]: [json({ published: 3 })],
    });
    await screen.findByRole('heading', { name: 'Rivers' });
    expect(publishButton()).toHaveProperty('disabled', false);
    expect(screen.queryByText(/Not reviewed yet/)).toBeNull();
    fireEvent.click(publishButton());
    expect(callsTo(calls, PUBLISH)).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Publish 3 sets' }));
    await vi.waitFor(() => expect(where()).toBe('/admin'));
    expect(callsTo(calls, PUBLISH)).toBe(1);
    expect(JSON.parse(screen.getByTestId('state').textContent!)).toEqual({
      published: 'Rivers is live: 3 sets published.',
    });
  });

  it('names an unplayable draft with its problems and a link to its list, and reads the category again', async () => {
    const calls = await renderAt('/admin/categories/Rivers', {
      [CATEGORIES]: [catalog([REVIEWED]), catalog([REVIEWED])],
      [PUBLISH]: [
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
    await screen.findByRole('heading', { name: 'Rivers' });
    fireEvent.click(publishButton());
    fireEvent.click(screen.getByRole('button', { name: 'Publish 3 sets' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/^“Rivers – Hard” cannot be published yet\./);
    expect(within(alert).getByText('Question 2 › answer: The answer is required')).toBeTruthy();
    expect(within(alert).getByRole('link', { name: 'Open its list' }).getAttribute('href')).toBe(
      '/admin/categories/Rivers/riv-h',
    );
    await vi.waitFor(() => expect(callsTo(calls, CATEGORIES)).toBe(2));
    expect(where()).toBe('/admin/categories/Rivers');
  });

  it('shows a refused publish (another tab left a level unreviewed) and stays', async () => {
    await renderAt('/admin/categories/Rivers', {
      [CATEGORIES]: [catalog([REVIEWED]), catalog([UNREVIEWED])],
      [PUBLISH]: [
        json(
          {
            ok: false,
            error:
              'Mark every level reviewed before publishing. Not reviewed yet: “Rivers – Hard”.',
            unreviewed: ['riv-h'],
          },
          400,
        ),
      ],
    });
    await screen.findByRole('heading', { name: 'Rivers' });
    fireEvent.click(publishButton());
    fireEvent.click(screen.getByRole('button', { name: 'Publish 3 sets' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Mark every level reviewed/);
    await vi.waitFor(() => expect(publishButton()).toHaveProperty('disabled', true));
  });

  it('shows a live-only category with its levels and Regenerate, no Publish and never "Nothing to review"', async () => {
    const live: Category = {
      name: 'Rivers',
      levels: [level(), level({ setId: 'riv-h', title: 'Rivers – Hard', difficulty: 'hard' })],
      job: null,
      hidden: false,
      emoji: null,
    };
    await renderAt('/admin/categories/Rivers', { [CATEGORIES]: [catalog([live])] });
    await screen.findByRole('list', { name: 'Levels' });
    expect(cards().map((c) => c.textContent)).toEqual([
      'Easy15 questionsLiveRegenerate',
      'Hard15 questionsLiveRegenerate',
    ]);
    expect(screen.queryByText(/Nothing to review/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Publish/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete Rivers' })).toHaveProperty('disabled', false);
  });

  it('Regenerate asks first, then starts the job and goes to its progress', async () => {
    const calls = await renderAt('/admin/categories/Rivers', {
      [CATEGORIES]: [catalog([RIVERS])],
      'POST /api/admin/built-in-sets/riv-m/regenerate': [json({ jobId: 'job7' }, 202)],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Regenerate Medium' }));
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Write it again' }));
    await vi.waitFor(() => expect(where()).toBe('/admin/generate?job=job7'));
  });

  it('shows a refused Regenerate and stays', async () => {
    await renderAt('/admin/categories/Rivers', {
      [CATEGORIES]: [catalog([RIVERS])],
      'POST /api/admin/built-in-sets/riv-m/regenerate': [
        json({ ok: false, error: 'Daily limit reached.' }, 429),
      ],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Regenerate Medium' }));
    fireEvent.click(screen.getByRole('button', { name: 'Write it again' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Daily limit reached.');
    expect(where()).toBe('/admin/categories/Rivers');
  });

  it.each([
    ['no API key', { enabled: false }, /^Generation is not set up/],
    ['the daily limit', { usedToday: 20 }, /^Daily limit reached/],
  ])('keeps Regenerate off with %s, and says why', async (_, generation, text) => {
    await renderAt('/admin/categories/Rivers', { [CATEGORIES]: [catalog([RIVERS], generation)] });
    expect(await screen.findByText(text)).toBeTruthy();
    for (const button of screen.getAllByRole('button', { name: /^Regenerate/ })) {
      expect(button).toHaveProperty('disabled', true);
    }
    expect(screen.getByRole('button', { name: 'Delete Rivers' })).toHaveProperty('disabled', false);
  });

  it("keeps Regenerate off while another category's generation runs", async () => {
    const other = job({ category: 'Moons' });
    await renderAt('/admin/categories/Rivers', {
      [CATEGORIES]: [catalog([RIVERS], { running: other })],
    });
    expect(
      await screen.findByText('Generating Moons. Regenerate waits until it is done.'),
    ).toBeTruthy();
    for (const button of screen.getAllByRole('button', { name: /^Regenerate/ })) {
      expect(button).toHaveProperty('disabled', true);
    }
    expect(screen.queryByRole('link', { name: /^Generating/ })).toBeNull();
  });

  it('puts Delete last; it asks first, deletes the whole category and goes to /admin', async () => {
    const calls = await renderAt('/admin/categories/Rivers', {
      [CATEGORIES]: [catalog([REVIEWED])],
      [DELETE]: [json({ deleted: 4 })],
    });
    await screen.findByRole('list', { name: 'Levels' });
    const buttons = screen.getAllByRole('button');
    expect(buttons.at(-1)!.getAttribute('aria-label')).toBe('Delete Rivers');
    expect(buttons.at(-1)!.className).toMatch(/text-buzz/);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Rivers' }));
    expect(callsTo(calls, DELETE)).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Delete 4 sets' }));
    await vi.waitFor(() => expect(where()).toBe('/admin'));
    expect(callsTo(calls, DELETE)).toBe(1);
  });

  it('shows a failed Delete and reads the category again', async () => {
    const calls = await renderAt('/admin/categories/Rivers', {
      [CATEGORIES]: [catalog([REVIEWED]), catalog([REVIEWED])],
      [DELETE]: [json({ ok: false, error: 'Wait for it to finish.' }, 409)],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Rivers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete 4 sets' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Wait for it to finish.');
    await vi.waitFor(() => expect(callsTo(calls, CATEGORIES)).toBe(2));
    expect(where()).toBe('/admin/categories/Rivers');
  });

  it('shows a failed new category with its error, and Delete clears it', async () => {
    const failed = job({
      category: 'Moons',
      state: 'failed',
      currentLevel: null,
      error: 'The Claude API is busy.',
    });
    const calls = await renderAt('/admin/categories/Moons', {
      [CATEGORIES]: [
        catalog([{ name: 'Moons', levels: [], job: failed, hidden: false, emoji: null }]),
      ],
      'DELETE /api/admin/categories/Moons': [json({ deleted: 0 })],
    });
    await screen.findByRole('list', { name: 'Levels' });
    expect(cards().map((c) => c.textContent)).toEqual(['EasyFailed']);
    expect(screen.getByText('The Claude API is busy.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Moons' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear it' }));
    await vi.waitFor(() => expect(where()).toBe('/admin'));
    expect(callsTo(calls, 'DELETE /api/admin/categories/Moons')).toBe(1);
  });

  it('Hide from hosts sits before Delete, hides the category and then offers Show to hosts', async () => {
    const hidden: Category = { ...REVIEWED, hidden: true };
    const calls = await renderAt('/admin/categories/Rivers', {
      [CATEGORIES]: [catalog([REVIEWED]), catalog([hidden])],
      [HIDE]: [json({ name: 'Rivers', hidden: true })],
    });
    await screen.findByRole('list', { name: 'Levels' });
    expect(screen.queryByText(/Hosts do not see its sets/)).toBeNull();
    const buttons = screen.getAllByRole('button');
    expect(buttons.at(-2)!.textContent).toBe('Hide from hosts');
    expect(buttons.at(-1)!.getAttribute('aria-label')).toBe('Delete Rivers');

    fireEvent.click(screen.getByRole('button', { name: 'Hide from hosts' }));
    expect(await screen.findByRole('button', { name: 'Show to hosts' })).toBeTruthy();
    expect(bodyOf(calls, HIDE)).toEqual({ hidden: true });
    expect(callsTo(calls, CATEGORIES)).toBe(2);
    expect(screen.getByText(/Hosts do not see its sets/).textContent).toMatch(/plays on/);
    expect(screen.queryByRole('button', { name: 'Hide from hosts' })).toBeNull();
    expect(where()).toBe('/admin/categories/Rivers');
  });

  it('Show to hosts shows a hidden category again', async () => {
    const hidden: Category = { ...REVIEWED, hidden: true };
    const calls = await renderAt('/admin/categories/Rivers', {
      [CATEGORIES]: [catalog([hidden]), catalog([REVIEWED])],
      [HIDE]: [json({ name: 'Rivers', hidden: false })],
    });
    expect(await screen.findByText('Hidden')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show to hosts' }));
    expect(await screen.findByRole('button', { name: 'Hide from hosts' })).toBeTruthy();
    expect(bodyOf(calls, HIDE)).toEqual({ hidden: false });
    expect(screen.queryByText(/Hosts do not see its sets/)).toBeNull();
  });

  it('shows a failed Hide and reads the category again', async () => {
    const calls = await renderAt('/admin/categories/Rivers', {
      [CATEGORIES]: [catalog([REVIEWED]), catalog([REVIEWED])],
      [HIDE]: [json({ ok: false, error: 'Could not save the built-in sets. Try again.' }, 500)],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Hide from hosts' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not save the built-in sets. Try again.',
    );
    await vi.waitFor(() => expect(callsTo(calls, CATEGORIES)).toBe(2));
    expect(screen.getByRole('button', { name: 'Hide from hosts' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('offers no Hide for a category with no sets, only a failed job', async () => {
    const failed = job({ category: 'Moons', state: 'failed', currentLevel: null, error: 'Busy.' });
    await renderAt('/admin/categories/Moons', {
      [CATEGORIES]: [
        catalog([{ name: 'Moons', levels: [], job: failed, hidden: false, emoji: null }]),
      ],
    });
    await screen.findByRole('list', { name: 'Levels' });
    expect(screen.queryByRole('button', { name: 'Hide from hosts' })).toBeNull();
  });

  it('says there is no such category for an unknown name', async () => {
    await renderAt('/admin/categories/Lakes', { [CATEGORIES]: [catalog([RIVERS])] });
    expect(await screen.findByText('There is no category with this name.')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Levels' })).toBeNull();
  });

  it('finds the category whatever the case of the URL, and encodes names in links', async () => {
    const odd: Category = {
      ...REVIEWED,
      name: 'Rock & Roll',
      levels: [level({ setId: 'rr-e', title: 'Rock & Roll – Easy', status: 'new' })],
    };
    await renderAt('/admin/categories/rock%20%26%20roll', { [CATEGORIES]: [catalog([odd])] });
    expect(await screen.findByRole('heading', { name: 'Rock & Roll' })).toBeTruthy();
    expect(within(cards()[0]!).getByRole('link').getAttribute('href')).toBe(
      '/admin/categories/Rock%20%26%20Roll/rr-e',
    );
  });

  it('shows a running generation with its progress, follows it every 2 s, and reads the category again when it ends', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const running = job({ category: 'Rivers' });
    const calls = await renderAt('/admin/categories/Rivers', {
      [CATEGORIES]: [catalog([{ ...REVIEWED, job: running }], { running }), catalog([REVIEWED])],
      'GET /api/admin/jobs/job1': [
        json(job({ category: 'Rivers', state: 'checking' })),
        json(job({ category: 'Rivers', state: 'done' })),
      ],
    });
    await settle();
    const line = screen.getByRole('link', { name: 'Generating Rivers' });
    expect(line.getAttribute('href')).toBe('/admin/generate?job=job1');
    expect(line.parentElement!.textContent).toBe(
      'Generating RiversWriting the questions · Easy, level 1 of 2 · $0.03 so far · Publish waits until it is done.',
    );
    expect(publishButton()).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Delete Rivers' })).toHaveProperty('disabled', true);
    for (const button of screen.getAllByRole('button', { name: /^Regenerate/ })) {
      expect(button).toHaveProperty('disabled', true);
    }

    await nextPoll();
    await settle();
    expect(
      screen.getByRole('link', { name: 'Generating Rivers' }).parentElement!.textContent,
    ).toMatch(/Checking the facts/);
    await nextPoll();
    await settle();
    expect(callsTo(calls, CATEGORIES)).toBe(2);
    expect(screen.queryByRole('link', { name: 'Generating Rivers' })).toBeNull();
    expect(publishButton()).toHaveProperty('disabled', false);
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(callsTo(calls, 'GET /api/admin/jobs/job1')).toBe(2);
  });

  it('shows the load error with Retry, which reads again', async () => {
    await renderAt('/admin/categories/Rivers', {
      [CATEGORIES]: [json({ ok: false, error: 'Disk on fire' }, 500), catalog([REVIEWED])],
    });
    expect((await screen.findByRole('alert')).textContent).toBe('Disk on fire');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('list', { name: 'Levels' })).toBeTruthy();
  });

  it('asks a signed-out visitor to sign in, and reads no categories', async () => {
    const calls = await renderAt(
      '/admin/categories/Rivers',
      {},
      json({ ok: false, error: 'x' }, 401),
    );
    expect(await screen.findByText(/Only the admin can open this page/)).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(callsTo(calls, CATEGORIES)).toBe(0);
  });
});
