// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminHistoryResponse, GenerationHistoryEntry } from '#shared/types.js';
import { droppedLines, levelsText, savedText, shownText } from '../lib/adminHistory.js';
import { AdminHistory } from './AdminHistory.js';

const T = Date.UTC(2026, 10, 8, 12, 0);

function entry(over: Partial<GenerationHistoryEntry> = {}): GenerationHistoryEntry {
  return {
    startedAt: T - 60_000,
    endedAt: T,
    kind: 'generate',
    categoryId: 'japan',
    category: 'Japan',
    levels: ['easy', 'medium'],
    saved: { city: 30, landmark: 27 },
    dropped: [
      { reason: 'Not on Wikidata', count: 3 },
      { reason: 'Outside the box', count: 1 },
    ],
    costUsd: 0.42,
    outcome: 'done',
    ...over,
  };
}

const HISTORY: AdminHistoryResponse = {
  entries: [
    entry(),
    entry({
      endedAt: T - 3_600_000,
      kind: 'replace',
      categoryId: 'gone',
      category: 'Gone',
      levels: ['hard'],
      saved: { city: 0, landmark: 0 },
      dropped: [],
      costUsd: 0.004,
      outcome: 'failed',
      error: 'Wikidata isn’t answering. Try again later.',
    }),
    entry({ kind: 'add', levels: ['easy'], saved: { city: 0, landmark: 1 }, outcome: 'cancelled' }),
  ],
  totals: { todayUsd: 0.5, last30DaysUsd: 3.25, allTimeUsd: 10, jobs: 3 },
};

type Reply = { status: number; body: unknown };

function stubFetch(routes: Record<string, Reply | Reply[]>) {
  const fetch = vi.fn(async (url: string) => {
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

const CATEGORIES: Reply = {
  status: 200,
  body: { categories: [{ id: 'japan', name: 'Japan' }] },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/history']}>
      <AdminHistory />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AdminHistory', () => {
  it('shows the spend today, over 30 days and in all', async () => {
    stubFetch({
      '/api/admin/history': { status: 200, body: HISTORY },
      '/api/admin/categories': CATEGORIES,
    });
    const { container } = renderPage();
    await screen.findByRole('list', { name: 'Generations' });
    const tiles = Object.fromEntries(
      [...container.querySelectorAll('dl[aria-label="Spend"] dt')].map((dt) => [
        dt.textContent,
        dt.nextElementSibling!.textContent,
      ]),
    );
    expect(tiles).toEqual({ Today: '$0.50', 'Last 30 days': '$3.25', 'All time': '$10.00' });
  });

  it('lists every ended job newest first: kind, levels, saved per mode, drops by reason, cost and outcome', async () => {
    stubFetch({
      '/api/admin/history': { status: 200, body: HISTORY },
      '/api/admin/categories': CATEGORIES,
    });
    renderPage();
    const list = await screen.findByRole('list', { name: 'Generations' });
    const rows = within(list)
      .getAllByRole('listitem')
      .filter((li) => li.parentElement === list);
    expect(rows).toHaveLength(3);

    const [first, second, third] = rows as [HTMLElement, HTMLElement, HTMLElement];
    expect(first.textContent).toContain('Generate · Easy, Medium · $0.42');
    expect(first.textContent).toContain('Saved: Cities 30 · Landmarks 27');
    expect(
      within(within(first).getByRole('list', { name: 'Dropped' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Not on Wikidata ×3', 'Outside the box ×1']);
    expect(within(first).getByText('Done')).toBeTruthy();
    // A category that still exists links to its page.
    expect(await within(first).findByRole('link', { name: 'Japan' })).toBeTruthy();
    expect(within(first).getByRole('link', { name: 'Japan' }).getAttribute('href')).toBe(
      '/admin/categories/japan',
    );

    expect(second.textContent).toContain('Replace · Hard · under $0.01');
    expect(within(second).getByText('Nothing dropped')).toBeTruthy();
    expect(within(second).getByText('Failed')).toBeTruthy();
    expect(within(second).getByText('Wikidata isn’t answering. Try again later.')).toBeTruthy();
    // A deleted category is plain text.
    expect(within(second).queryByRole('link')).toBeNull();
    expect(within(second).getByText('Gone')).toBeTruthy();

    expect(third.textContent).toContain('Add a place · Easy');
    expect(within(third).getByText('Cancelled')).toBeTruthy();
    expect(screen.queryByText(/The newest/)).toBeNull();
  });

  it('says so when there is no history yet', async () => {
    stubFetch({
      '/api/admin/history': {
        status: 200,
        body: { entries: [], totals: { todayUsd: 0, last30DaysUsd: 0, allTimeUsd: 0, jobs: 0 } },
      },
      '/api/admin/categories': CATEGORIES,
    });
    renderPage();
    expect(await screen.findByText('No generations yet.')).toBeTruthy();
    expect(screen.getAllByText('$0.00')).toHaveLength(3);
  });

  it('shows the error with Retry when the history cannot load, then loads it', async () => {
    stubFetch({
      '/api/admin/history': [
        { status: 500, body: { error: 'Could not read the generation history. Try again.' } },
        { status: 200, body: HISTORY },
      ],
      '/api/admin/categories': CATEGORIES,
    });
    renderPage();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not read the generation history. Try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('list', { name: 'Generations' })).toBeTruthy();
  });

  it('writes levels, saved, drops and the shown count', () => {
    expect(levelsText(['easy', 'hard'])).toBe('Easy, Hard');
    expect(savedText(entry())).toBe('Cities 30 · Landmarks 27');
    expect(droppedLines(entry({ dropped: [] }))).toEqual([]);
    expect(shownText(500, 731)).toBe('The newest 500 of 731 jobs.');
    expect(shownText(3, 3)).toBeNull();
  });
});
