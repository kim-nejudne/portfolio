// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Place } from '#shared/types.js';
import { placeChanges, placeWarnings, reviewAction, stepCard } from '../lib/adminLevel.js';
import { resetTiles } from '../lib/tiles.js';
import { AdminLevel } from './AdminLevel.js';

function place(
  id: string,
  kind: Place['kind'],
  name: string,
  lat: number,
  lng: number,
  extra: Partial<Place> = {},
): Place {
  return {
    id,
    kind,
    name,
    displayName: name,
    autoDisplayName: true,
    fact: 'A fact.',
    lat,
    lng,
    coordsSource: 'wikidata',
    wikidataId: `Q${id.length}`,
    countryId: 'Q17',
    countryName: 'Japan',
    ...extra,
  };
}

// Japan's box: scale 2,313 km, bullseye 23 km.
const japan = (): Category => ({
  id: 'japan',
  name: 'Japan',
  emoji: '🗾',
  box: { south: 24, west: 122, north: 46, east: 146 },
  labelStyle: 'city',
  draftMeta: null,
  hidden: false,
  live: {
    easy: { places: [place('osaka', 'city', 'Osaka', 34.69, 135.5)], reviewed: true, updatedAt: 1 },
  },
  draft: {
    medium: {
      places: [
        place('kyoto', 'city', 'Kyoto', 35.01, 135.77, { displayName: 'Kyoto City' }),
        place('sakai', 'city', 'Sakai', 34.57, 135.48),
        place('sapporo', 'city', 'Sapporo', 43.06, 141.35, { displayName: 'Kyoto city' }),
        place('tower', 'landmark', 'Tokyo Tower', 35.66, 139.75, {
          fact: 'Painted international orange.',
        }),
      ],
      reviewed: false,
      updatedAt: 1,
    },
  },
  createdAt: 1,
  updatedAt: 1,
});

type Call = { url: string; method: string; body: unknown };

/** The category GET and the level's writes, applied as the store would, plus the tile config. */
function stubServer(start: Category = japan()) {
  let category = start;
  const calls: Call[] = [];
  const PLACE = /^\/api\/admin\/categories\/japan\/levels\/(\w+)\/places\/(\w+)$/;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? (JSON.parse(init.body as string) as unknown) : undefined;
      calls.push({ url, method, body });
      if (url === '/api/config') {
        return Response.json({
          tiles: null,
          fallbackTiles: {
            url: '/tiles/fallback/{z}/{x}/{y}.png',
            attribution: 'Natural Earth',
            maxNativeZoom: 6,
          },
        });
      }
      if (url === '/api/admin/categories/japan' && method === 'GET') {
        return Response.json({ category });
      }
      const at = PLACE.exec(url);
      if (at) {
        const [, level, id] = at as unknown as [string, 'easy' | 'medium', string];
        category = structuredClone(category);
        category.draft[level] ??= { ...structuredClone(category.live[level]!), reviewed: true };
        const content = category.draft[level];
        if (method === 'DELETE') content.places = content.places.filter((p) => p.id !== id);
        else {
          const p = content.places.find((x) => x.id === id)!;
          const edit = body as Partial<Place>;
          Object.assign(p, edit);
          if (edit.lat !== undefined) p.coordsSource = 'admin';
          if (edit.displayName !== undefined) p.autoDisplayName = false;
        }
        return Response.json({ category });
      }
      if (url === '/api/admin/categories/japan/levels/medium/reviewed' && method === 'POST') {
        category = structuredClone(category);
        category.draft.medium!.reviewed = (body as { reviewed: boolean }).reviewed;
        return Response.json({ category });
      }
      return Response.json({ error: 'Not found.' }, { status: 404 });
    }),
  );
  return calls;
}

async function renderPage(level = 'medium') {
  const view = render(
    <MemoryRouter initialEntries={[`/admin/categories/japan/${level}`]}>
      <Routes>
        <Route path="/admin/categories/:id/:level" element={<AdminLevel />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: /Japan/ });
  await act(async () => {});
  return view;
}

const card = (name: string) => screen.getByRole('article', { name });
const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET');
const input = (scope: HTMLElement, name: string | RegExp) =>
  within(scope).getByLabelText(name) as HTMLInputElement;
const press = (key: string, target: Element = document.body) => fireEvent.keyDown(target, { key });

beforeEach(() => resetTiles());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Level review cards', () => {
  it('shows Cities and Landmarks tabs with a card per place', async () => {
    stubServer();
    await renderPage();
    const cities = screen.getByRole('tab', { name: 'Cities (3)' });
    expect(cities.getAttribute('aria-selected')).toBe('true');
    expect(
      screen.getAllByRole('article').map((a) => a.getAttribute('aria-labelledby')),
    ).toHaveLength(3);
    const kyoto = card('Kyoto');
    expect(within(kyoto).getByText('Kyoto City')).toBeTruthy();
    expect(within(kyoto).getByText(/Japan/)).toBeTruthy();
    const link = within(kyoto).getByRole('link', { name: 'Q5' });
    expect(link.getAttribute('href')).toBe('https://www.wikidata.org/wiki/Q5');
    expect(within(kyoto).getByText('A fact.')).toBeTruthy();
    expect(within(kyoto).getByText('7/90')).toBeTruthy();
    const map = within(kyoto).getByRole('img', { name: 'Map of Kyoto in the box' });
    expect(map.parentElement!.className).toContain('h-[200px]');
    expect(map.querySelector('.admin-box')).toBeTruthy();
    expect(map.querySelector('.admin-pin')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Landmarks (1)' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(within(card('Tokyo Tower')).getByText('29/90')).toBeTruthy();
    // No display-name line or field for a landmark.
    expect(within(card('Tokyo Tower')).queryByText(/Shown as/)).toBeNull();
  });

  it('moves between the tabs with the arrow keys', async () => {
    stubServer();
    await renderPage();
    press('ArrowRight', screen.getByRole('tab', { name: /Cities/ }));
    const landmarks = screen.getByRole('tab', { name: /Landmarks/ });
    expect(landmarks.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(landmarks);
  });

  it('says so for a level with no places, and for an unknown level', async () => {
    stubServer();
    await renderPage('hard');
    expect(screen.getByText('Hard has no places yet.')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    cleanup();
    render(
      <MemoryRouter initialEntries={['/admin/categories/japan/extreme']}>
        <Routes>
          <Route path="/admin/categories/:id/:level" element={<AdminLevel />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'No such level' })).toBeTruthy();
  });
});

describe('Level review edit', () => {
  it('edits name, display name and fact, sending only what changed', async () => {
    const calls = stubServer();
    await renderPage();
    fireEvent.click(within(card('Kyoto')).getByRole('button', { name: 'Edit Kyoto' }));
    const form = screen.getByRole('form', { name: 'Edit Kyoto' });
    expect(document.activeElement).toBe(input(form, 'Name'));
    const save = within(form).getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true); // nothing changed yet
    fireEvent.change(input(form, 'Display name'), { target: { value: 'Old capital' } });
    fireEvent.change(input(form, /^Fact/), { target: { value: 'Home to 1,600 temples. ' } });
    expect(within(form).getByText('23/90')).toBeTruthy();
    fireEvent.click(save);
    await screen.findByText('Home to 1,600 temples.');
    expect(writes(calls)).toEqual([
      {
        url: '/api/admin/categories/japan/levels/medium/places/kyoto',
        method: 'PUT',
        body: { displayName: 'Old capital', fact: 'Home to 1,600 temples.' },
      },
    ]);
    expect(within(card('Kyoto')).getByText('Old capital')).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('refuses an empty name and keeps Save off; Esc cancels without sending', async () => {
    const calls = stubServer();
    await renderPage();
    fireEvent.click(within(card('Sakai')).getByRole('button', { name: 'Edit Sakai' }));
    const form = screen.getByRole('form', { name: 'Edit Sakai' });
    fireEvent.change(input(form, 'Name'), { target: { value: '  ' } });
    expect((within(form).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    press('Escape', input(form, 'Name'));
    expect(screen.queryByRole('form')).toBeNull();
    expect(writes(calls)).toEqual([]);
  });

  it('refuses a pin outside the box, then saves one inside as the admin’s, with how far it moved', async () => {
    const calls = stubServer();
    await renderPage();
    fireEvent.click(within(card('Sapporo')).getByRole('button', { name: 'Edit Sapporo' }));
    const form = screen.getByRole('form', { name: 'Edit Sapporo' });
    fireEvent.change(input(form, 'Latitude'), { target: { value: '50' } });
    expect(within(form).getByRole('alert').textContent).toBe('The pin must stay inside the box');
    const save = within(form).getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(writes(calls)).toEqual([]);

    fireEvent.change(input(form, 'Latitude'), { target: { value: '43.26' } });
    expect(within(form).getByRole('alert').textContent).toBe('');
    // The warning follows the pin while editing.
    expect(within(card('Sapporo')).getByText('Moved 22 km from Wikidata')).toBeTruthy();
    fireEvent.click(save);
    await screen.findByText(/Pin placed by admin/);
    expect(writes(calls)).toEqual([
      {
        url: '/api/admin/categories/japan/levels/medium/places/sapporo',
        method: 'PUT',
        body: { lat: 43.26, lng: 141.35 },
      },
    ]);
    expect(within(card('Sapporo')).getByText('Moved 22 km from Wikidata')).toBeTruthy();
  });

  it('shows a server refusal on the card', async () => {
    stubServer();
    await renderPage();
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ error: 'The pin must stay inside the box' }, { status: 400 }),
    );
    fireEvent.click(within(card('Kyoto')).getByRole('button', { name: 'Edit Kyoto' }));
    const form = screen.getByRole('form', { name: 'Edit Kyoto' });
    fireEvent.change(input(form, /^Fact/), { target: { value: 'Temples.' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    expect(
      (await within(card('Kyoto')).findByText('The pin must stay inside the box')).getAttribute(
        'role',
      ),
    ).toBe('alert');
    expect(screen.getByRole('form', { name: 'Edit Kyoto' })).toBeTruthy();
  });
});

describe('Level review remove', () => {
  it('removes a place only after Confirm remove, then focuses the next card', async () => {
    const calls = stubServer();
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Kyoto' }));
    const confirm = screen.getByRole('button', { name: 'Confirm remove' });
    expect(document.activeElement).toBe(confirm);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(writes(calls)).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Kyoto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove' }));
    await act(async () => {});
    expect(screen.queryByRole('article', { name: 'Kyoto' })).toBeNull();
    expect(writes(calls)).toEqual([
      { url: '/api/admin/categories/japan/levels/medium/places/kyoto', method: 'DELETE', body: {} },
    ]);
    expect(document.activeElement).toBe(card('Sakai'));
    expect(screen.getByRole('tab', { name: 'Cities (2)' })).toBeTruthy();
  });
});

describe('Level review footer', () => {
  it('marks the level reviewed and back', async () => {
    const calls = stubServer();
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Medium reviewed' }));
    expect(await screen.findByText('✓ Medium is reviewed.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mark not reviewed' }));
    await screen.findByRole('button', { name: 'Mark Medium reviewed' });
    expect(writes(calls).map((c) => c.body)).toEqual([{ reviewed: true }, { reviewed: false }]);
    expect(screen.getByRole('contentinfo').className).toContain('sticky');
  });

  it('a live-only level has nothing to mark until an edit starts a draft', async () => {
    stubServer();
    await renderPage('easy');
    expect(screen.getByText('Easy is live. An edit starts a draft of it.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Mark/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Osaka' }));
    const form = screen.getByRole('form', { name: 'Edit Osaka' });
    fireEvent.change(input(form, /^Fact/), { target: { value: 'Kitchen.' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    // Forked from live, the draft keeps the live level's reviewed mark.
    expect(await screen.findByText('✓ Easy is reviewed.')).toBeTruthy();
  });
});

describe('Level review keys', () => {
  it('J and K move between cards, E edits and Delete arms Remove', async () => {
    stubServer();
    await renderPage();
    press('j');
    expect(document.activeElement).toBe(card('Kyoto'));
    press('j');
    press('j');
    press('j'); // stops at the last card
    expect(document.activeElement).toBe(card('Sapporo'));
    press('k');
    expect(document.activeElement).toBe(card('Sakai'));
    press('Delete', document.activeElement!);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Confirm remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    card('Sakai').focus();
    press('e', card('Sakai'));
    const form = screen.getByRole('form', { name: 'Edit Sakai' });
    // Typing in a field is typing, not a shortcut.
    press('j', input(form, 'Name'));
    expect(document.activeElement).toBe(input(form, 'Name'));
    expect(screen.getByRole('form', { name: 'Edit Sakai' })).toBeTruthy();
  });

  it('maps keys to actions, ignoring modifiers and held action keys', () => {
    const k = (key: string, more = {}) =>
      reviewAction({
        key,
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        ...more,
      });
    expect([k('j'), k('J'), k('ArrowDown'), k('k'), k('ArrowUp'), k('e'), k('Delete')]).toEqual([
      'next',
      'next',
      'next',
      'prev',
      'prev',
      'edit',
      'remove',
    ]);
    expect(k('J', { shiftKey: true })).toBeNull();
    expect(k('j', { ctrlKey: true })).toBeNull();
    expect(k('j', { repeat: true })).toBe('next');
    expect(k('Delete', { repeat: true })).toBeNull();
    expect(k('r')).toBeNull();
    expect([stepCard(-1, 3, 1), stepCard(-1, 3, -1), stepCard(2, 3, 1), stepCard(0, 0, 1)]).toEqual(
      [0, 2, 2, null],
    );
  });
});

describe('Level review warnings', () => {
  it('flags the bullseye radius and same display names among same-kind places of every level', async () => {
    stubServer();
    await renderPage();
    const warnings = (name: string) =>
      within(card(name))
        .queryAllByRole('listitem')
        .map((li) => li.textContent);
    expect(warnings('Sakai')).toEqual(['⚠ Within the bullseye radius of Osaka (Easy)']);
    expect(warnings('Kyoto')).toEqual(['⚠ Same display name as Sapporo']);
    expect(warnings('Sapporo')).toEqual(['⚠ Same display name as Kyoto']);
  });

  it('computes the warnings without the place itself, and only from Wikidata coordinates', () => {
    const c = japan();
    const osaka = c.live.easy!.places[0]!;
    expect(placeWarnings(c, 'easy', osaka, undefined)).toEqual([
      'Within the bullseye radius of Sakai (Medium)',
    ]);
    const tower = c.draft.medium!.places[3]!;
    expect(placeWarnings(c, 'medium', tower, tower)).toEqual([]);
    expect(
      placeWarnings(c, 'medium', { ...tower, lat: 35.7 }, { lat: tower.lat, lng: tower.lng }),
    ).toEqual(['Moved 4.4 km from Wikidata']);
  });

  it('sends only changed fields, and a landmark never sends a display name', () => {
    const tower = japan().draft.medium!.places[3]!;
    const same = {
      name: tower.name,
      displayName: 'X',
      fact: tower.fact,
      lat: tower.lat,
      lng: tower.lng,
    };
    expect(placeChanges(tower, same)).toEqual({});
    expect(placeChanges(tower, { ...same, name: ' Tower ', lng: 139.8 })).toEqual({
      name: 'Tower',
      lat: tower.lat,
      lng: 139.8,
    });
  });
});
