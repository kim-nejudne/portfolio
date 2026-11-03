// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminHistoryResponse, GenerationHistoryEntry } from '../../../shared/types.js';
import { resetAdminSession } from '../lib/adminSession.js';
import { whenText } from '../lib/adminHistory.js';
import { DESKTOP_QUERY } from '../lib/useMediaQuery.js';
import {
  AdminRoutes,
  CATEGORIES,
  RIVERS,
  catalog,
  json,
  signedIn,
  stubMedia,
  stubServer,
  unstubMedia,
  type Answer,
} from '../test/adminServer.js';
import { AdminHistory } from './AdminHistory.js';
import { HEADER_ROW_QUERY } from './AdminLayout.js';

const HISTORY = 'GET /api/admin/history';
const T = Date.UTC(2026, 10, 3, 5, 28);

const entry = (overrides: Partial<GenerationHistoryEntry> = {}): GenerationHistoryEntry => ({
  endedAt: T,
  startedAt: T - 60_000,
  kind: 'generate',
  category: 'Rivers',
  levels: [
    { difficulty: 'easy', count: 15 },
    { difficulty: 'medium', count: 15 },
  ],
  saved: 28,
  costUsd: 0.042,
  outcome: 'done',
  ...overrides,
});

const FAILED = entry({
  endedAt: T + 1000,
  category: 'Volcanoes',
  kind: 'regenerate',
  levels: [{ difficulty: 'hard', count: 15 }],
  saved: 0,
  costUsd: 0.004,
  outcome: 'failed',
  error: 'The writer gave up.',
});

const history = (
  entries: GenerationHistoryEntry[],
  totals: Partial<AdminHistoryResponse['totals']> = {},
): Answer =>
  json({
    entries,
    totals: {
      todayUsd: 0.046,
      last30DaysUsd: 1.92,
      allTimeUsd: 12.5,
      jobs: entries.length,
      ...totals,
    },
  } satisfies AdminHistoryResponse);

async function renderHistory(routes: Record<string, Answer[]>, ...media: string[]) {
  stubMedia(...media);
  const calls = stubServer({ 'GET /api/admin/session': [signedIn], ...routes });
  render(
    <MemoryRouter initialEntries={['/admin/history']}>
      <AdminRoutes path="/admin/history" page={<AdminHistory />} />
    </MemoryRouter>,
  );
  // The gate's <main> gives way to the frame's once signed in.
  await screen.findByRole('heading', { level: 1, name: 'History' });
  return calls;
}

const main = () => within(screen.getByRole('main'));
const tile = (label: string) =>
  main().getByText(label, { selector: 'dt' }).nextElementSibling!.textContent;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  unstubMedia();
  resetAdminSession();
});

describe('AdminHistory (F128)', () => {
  it('shows the totals as tiles: today, 30 days, all time and jobs', async () => {
    await renderHistory({
      [HISTORY]: [history([entry(), FAILED], { jobs: 2 })],
      [CATEGORIES]: [catalog()],
    });
    await main().findByText('Today', { selector: 'dt' });
    expect(tile('Today')).toBe('$0.05');
    expect(tile('Last 30 days')).toBe('$1.92');
    expect(tile('All time')).toBe('$12.50');
    expect(tile('Jobs')).toBe('2');
  });

  it('from lg: full width with no list pane, the entries as a seven-column table', async () => {
    await renderHistory(
      { [HISTORY]: [history([FAILED, entry()])], [CATEGORIES]: [catalog()] },
      DESKTOP_QUERY,
      HEADER_ROW_QUERY,
    );
    const table = await main().findByRole('table');
    expect(screen.queryByRole('complementary', { name: 'Categories' })).toBeNull();
    expect(document.querySelector('[data-layout="full"]')!.className).toMatch(/h-dvh/);
    expect(screen.getByRole('main').className).toMatch(/overflow-y-auto/);
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['When', 'Category', 'Kind', 'Levels', 'Saved', 'Cost', 'Outcome']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(
      rows.map((r) =>
        within(r)
          .getAllByRole('cell')
          .map((c) => c.textContent),
      ),
    ).toEqual([
      [
        whenText(T + 1000),
        'Volcanoes',
        'Regenerate',
        'Hard 15',
        '0 of 15',
        'under $0.01',
        'FailedThe writer gave up.',
      ],
      [whenText(T), 'Rivers', 'Generate', 'Easy 15 · Medium 15', '28 of 30', '$0.04', 'Done'],
    ]);
    // The header's History marks the open page.
    const link = within(screen.getByRole('banner')).getByRole('link', { name: 'History' });
    expect(link.getAttribute('aria-current')).toBe('page');
  });

  it('links a category that still exists to its page, any case, and leaves a gone one as text', async () => {
    await renderHistory(
      {
        [HISTORY]: [history([FAILED, entry({ category: 'rivers' })])],
        [CATEGORIES]: [catalog([RIVERS])],
      },
      DESKTOP_QUERY,
    );
    const link = await main().findByRole('link', { name: 'rivers' });
    expect(link.getAttribute('href')).toBe('/admin/categories/Rivers');
    expect(main().getByText('Volcanoes').closest('a')).toBeNull();
  });

  it('below lg: stacked rows, with a failed row showing its error and no table', async () => {
    await renderHistory({ [HISTORY]: [history([FAILED, entry()])], [CATEGORIES]: [catalog()] });
    const list = await main().findByRole('list', { name: 'Generations' });
    expect(main().queryByRole('table')).toBeNull();
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      `VolcanoesFailed${whenText(T + 1000)} · RegenerateHard 15 · saved 0 of 15 · under $0.01The writer gave up.`,
      `RiversDone${whenText(T)} · GenerateEasy 15 · Medium 15 · saved 28 of 30 · $0.04`,
    ]);
    expect(within(rows[0]!).getByText('The writer gave up.')).toBeTruthy();
    // The phone's way back to the list.
    expect(screen.getByRole('link', { name: '← Categories' }).getAttribute('href')).toBe('/admin');
  });

  it('says "No generations yet." with an empty log', async () => {
    await renderHistory({
      [HISTORY]: [history([], { todayUsd: 0, last30DaysUsd: 0, allTimeUsd: 0 })],
    });
    expect(await main().findByText('No generations yet.')).toBeTruthy();
    expect(tile('Jobs')).toBe('0');
    expect(tile('All time')).toBe('$0.00');
    expect(main().queryByRole('list', { name: 'Generations' })).toBeNull();
  });

  it('says how many it shows when the log holds more than were sent', async () => {
    await renderHistory({
      [HISTORY]: [history([entry()], { jobs: 73 })],
      [CATEGORIES]: [catalog()],
    });
    expect(await main().findByText('The newest 1 of 73 jobs.')).toBeTruthy();
  });

  it('shows the error and Retry when the history cannot be read, then loads it', async () => {
    const calls = await renderHistory({
      [HISTORY]: [
        json({ ok: false, error: 'Could not read the history.' }, 500),
        history([entry()]),
      ],
      [CATEGORIES]: [catalog(), catalog()],
    });
    expect((await main().findByRole('alert')).textContent).toBe('Could not read the history.');
    fireEvent.click(main().getByRole('button', { name: 'Retry' }));
    expect(await main().findByRole('list', { name: 'Generations' })).toBeTruthy();
    expect(main().queryByRole('alert')).toBeNull();
    expect(calls.filter((c) => c.key === HISTORY)).toHaveLength(2);
  });

  it('still lists the entries, as text, when the categories cannot be read', async () => {
    await renderHistory({ [HISTORY]: [history([entry()])] });
    const list = await main().findByRole('list', { name: 'Generations' });
    expect(within(list).getByText('Rivers').closest('a')).toBeNull();
    expect(main().queryByRole('alert')).toBeNull();
  });
});
