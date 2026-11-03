// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminCategory as Category } from '../../../shared/types.js';
import { resetAdminSession } from '../lib/adminSession.js';
import {
  CATEGORIES,
  RIVERS,
  callsTo,
  catalog,
  job,
  json,
  level,
  signedIn,
  stubServer,
  type Answer,
  AdminRoutes,
} from '../test/adminServer.js';
import { AdminCategory, publishedText } from './AdminCategory.js';

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
    level({ setId: 'riv-x', title: 'Rivers – Old', difficulty: 'easy', status: 'live' }),
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
      <span data-testid="location">{location.pathname}</span>
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
const publishButton = () => screen.getByRole('button', { name: 'Publish Rivers' });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetAdminSession();
});

describe('Category review page', () => {
  it('lists the draft levels Easy, Medium, Hard, each with its count, review state and list link', async () => {
    await renderAt('/admin/categories/Rivers', { [CATEGORIES]: [catalog([UNREVIEWED])] });
    expect(await screen.findByRole('heading', { name: 'Review Rivers' })).toBeTruthy();
    expect(cards().map((c) => c.textContent)).toEqual([
      'Easy15 questionsReviewed',
      'Medium13 of 15 ⚠ 2 shortNot reviewed',
      'Hard15 questionsNot reviewed',
    ]);
    // The live level has nothing to review.
    expect(screen.queryByText(/Old/)).toBeNull();
    expect(within(cards()[1]!).getByText('⚠ 2 short').className).toMatch(/text-warn/);
    expect(cards().map((c) => within(c).getByRole('link').getAttribute('href'))).toEqual([
      '/admin/categories/Rivers/riv-e',
      '/admin/categories/Rivers/riv-m',
      '/admin/categories/Rivers/riv-h',
    ]);
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
    await screen.findByRole('heading', { name: 'Review Rivers' });
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
    await screen.findByRole('heading', { name: 'Review Rivers' });
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
    await screen.findByRole('heading', { name: 'Review Rivers' });
    fireEvent.click(publishButton());
    fireEvent.click(screen.getByRole('button', { name: 'Publish 3 sets' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Mark every level reviewed/);
    await vi.waitFor(() => expect(publishButton()).toHaveProperty('disabled', true));
  });

  it('says "Nothing to review" with a link back when every level is live', async () => {
    const live: Category = { name: 'Rivers', levels: [level()], job: null };
    await renderAt('/admin/categories/Rivers', { [CATEGORIES]: [catalog([live])] });
    expect(await screen.findByText('Nothing to review.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Admin' }).getAttribute('href')).toBe('/admin');
    expect(screen.queryByRole('button', { name: 'Publish Rivers' })).toBeNull();
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
    expect(await screen.findByRole('heading', { name: 'Review Rock & Roll' })).toBeTruthy();
    expect(within(cards()[0]!).getByRole('link').getAttribute('href')).toBe(
      '/admin/categories/Rock%20%26%20Roll/rr-e',
    );
  });

  it('keeps Publish off while the category is generating, linking to its progress', async () => {
    const running = job({ category: 'Rivers' });
    await renderAt('/admin/categories/Rivers', {
      [CATEGORIES]: [catalog([{ ...REVIEWED, job: running }], { running })],
    });
    expect(await screen.findByRole('link', { name: 'Generating Rivers' })).toHaveProperty(
      'href',
      expect.stringMatching(/\/admin\/generate\?job=job1$/),
    );
    expect(publishButton()).toHaveProperty('disabled', true);
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

  it('words the dashboard message for one set and for several', () => {
    expect(publishedText('Rivers', 1)).toBe('Rivers is live: 1 set published.');
    expect(publishedText('Rivers', 3)).toBe('Rivers is live: 3 sets published.');
  });
});
