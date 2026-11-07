// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Place } from '#shared/types.js';
import { boxPlaces, dragCorner, parseOtherEmoji, publishedText } from '../lib/adminCategory.js';
import { resetTiles } from '../lib/tiles.js';
import { AdminCategory } from './AdminCategory.js';

function place(id: string, kind: Place['kind'], name: string, lat: number, lng: number): Place {
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
    wikidataId: 'Q1',
    countryId: 'Q17',
    countryName: 'Japan',
  };
}

const JAPAN: Category = {
  id: 'japan',
  name: 'Japan',
  emoji: '🗾',
  box: { south: 24, west: 122, north: 46, east: 146 },
  labelStyle: 'city',
  draftMeta: null,
  hidden: false,
  live: {
    easy: {
      places: [
        place('osaka', 'city', 'Osaka', 34.69, 135.5),
        place('tower', 'landmark', 'Tokyo Tower', 35.66, 139.75),
      ],
      reviewed: true,
      updatedAt: 1,
    },
  },
  draft: {
    medium: {
      places: [place('taipei', 'city', 'Taipei', 25.03, 121.56)],
      reviewed: false,
      updatedAt: 1,
    },
  },
  createdAt: 1,
  updatedAt: 1,
};

type Call = { url: string; method: string; body: unknown };

/** The category GET, the meta PUT (echoing the body into draftMeta), and the tile config. */
function stubServer(category: Category = JAPAN) {
  const calls: Call[] = [];
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
      if (url === '/api/admin/categories/japan' && method === 'GET')
        return Response.json({ category });
      if (url === '/api/admin/categories/japan/meta' && method === 'PUT') {
        const meta = body as { box?: Category['box']; labelStyle?: Category['labelStyle'] };
        const current = category.draftMeta ?? {
          box: category.box,
          labelStyle: category.labelStyle,
        };
        category = { ...category, draftMeta: { ...current, ...meta } };
        return Response.json({ category });
      }
      if (url === '/api/admin/categories/japan/publish' && method === 'POST') {
        const levels = Object.keys(category.draft).length;
        category = { ...category, live: { ...category.live, ...category.draft }, draft: {} };
        return Response.json({ category, levels });
      }
      if (url === '/api/admin/categories/japan/hidden' && method === 'PUT') {
        category = { ...category, hidden: (body as { hidden: boolean }).hidden };
        return Response.json({ category });
      }
      if (url === '/api/admin/categories/japan/emoji' && method === 'PUT') {
        category = { ...category, emoji: (body as { emoji: string | null }).emoji };
        return Response.json({ category });
      }
      if (url === '/api/admin/categories/japan' && method === 'DELETE')
        return Response.json({ ok: true });
      return Response.json({ error: 'Not found.' }, { status: 404 });
    }),
  );
  return calls;
}

/** `/admin` in these tests: only the notice the category page passes on navigation. */
function AdminStub() {
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  return <p>Admin home: {notice}</p>;
}

async function renderPage() {
  const view = render(
    <MemoryRouter initialEntries={['/admin/categories/japan']}>
      <Routes>
        <Route path="/admin/categories/:id" element={<AdminCategory />} />
        <Route path="/admin" element={<AdminStub />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: /Japan/ });
  await act(async () => {});
  return view;
}

const field = (name: string) => screen.getByRole('spinbutton', { name }) as HTMLInputElement;
const readout = () => screen.getByTestId('scale-readout').textContent;
const saveBox = () => screen.getByRole('button', { name: 'Save box' }) as HTMLButtonElement;
const puts = (calls: Call[]) => calls.filter((c) => c.method === 'PUT');

beforeEach(() => resetTiles());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Category page box editor', () => {
  it('shows the draft box at 2 decimals and the scale readout', async () => {
    stubServer();
    await renderPage();
    expect(field('South').value).toBe('24.00');
    expect(field('East').value).toBe('146.00');
    expect(readout()).toBe('Scale 2,313 km · Bullseye 23 km');
    expect(saveBox().disabled).toBe(true);
  });

  it('updates the readout as the fields change, and saves the box', async () => {
    const calls = stubServer();
    await renderPage();
    fireEvent.change(field('North'), { target: { value: '45' } });
    expect(readout()).toBe('Scale 2,266 km · Bullseye 23 km');
    fireEvent.blur(field('North'));
    expect(field('North').value).toBe('45.00');
    fireEvent.click(saveBox());
    expect(await screen.findByText('Box saved into the draft.')).toBeTruthy();
    expect(puts(calls)).toEqual([
      {
        url: '/api/admin/categories/japan/meta',
        method: 'PUT',
        body: { box: { south: 24, west: 122, north: 45, east: 146 } },
      },
    ]);
  });

  it('refuses a box under 150 km and sends nothing', async () => {
    const calls = stubServer();
    await renderPage();
    for (const [name, value] of [
      ['South', '35'],
      ['West', '139'],
      ['North', '36'],
      ['East', '140'],
    ]) {
      fireEvent.change(field(name!), { target: { value } });
    }
    expect(screen.getByRole('alert').textContent).toBe(
      'The box is too small: scale 100 km, at least 150 km',
    );
    expect(saveBox().disabled).toBe(true);
    fireEvent.click(saveBox());
    expect(puts(calls)).toEqual([]);
  });

  it('refuses a malformed box: south above north, or an empty edge', async () => {
    stubServer();
    await renderPage();
    fireEvent.change(field('South'), { target: { value: '50' } });
    expect(screen.getByRole('alert').textContent).toBe('South must be below north');
    expect(readout()).toBe('Scale –');
    fireEvent.change(field('South'), { target: { value: '' } });
    expect(screen.getByRole('alert').textContent).toBe('Enter all four edges in degrees');
    expect(saveBox().disabled).toBe(true);
  });

  it('lists and flags the places outside the box, live and draft levels alike', async () => {
    stubServer();
    const { container } = await renderPage();
    const list = screen.getByRole('list', { name: 'Places outside the box' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['⚠ Taipei · Medium · City']);
    expect(screen.getByRole('heading', { name: '1 place outside the box' })).toBeTruthy();
    // Every place is a dot: cities round, landmarks square, the outside one flagged.
    expect(container.querySelectorAll('.admin-dot')).toHaveLength(3);
    expect(container.querySelectorAll('.admin-dot-landmark')).toHaveLength(1);
    expect(container.querySelectorAll('.admin-dot-outside')).toHaveLength(1);
    expect(container.querySelectorAll('.admin-handle')).toHaveLength(4);

    fireEvent.change(field('West'), { target: { value: '121' } });
    expect(readout()).toBe('Scale 2,360 km · Bullseye 24 km');
    expect(screen.queryByRole('list', { name: 'Places outside the box' })).toBeNull();
    expect(screen.getByText('Every place is inside the box.')).toBeTruthy();
    expect(container.querySelectorAll('.admin-dot-outside')).toHaveLength(0);
  });

  it('shows the server refusal when a save is refused', async () => {
    stubServer();
    await renderPage();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'No such category' }, { status: 404 })),
    );
    fireEvent.change(field('North'), { target: { value: '45' } });
    fireEvent.click(saveBox());
    expect(await screen.findByText('No such category')).toBeTruthy();
  });
});

describe('Category page label style', () => {
  it('saves City, Country with PUT meta and checks it', async () => {
    const calls = stubServer();
    await renderPage();
    const group = screen.getByRole('radiogroup', { name: 'Label style' });
    const city = within(group).getByRole('radio', { name: /^City “/ }) as HTMLInputElement;
    const cityCountry = within(group).getByRole('radio', {
      name: /City, Country/,
    }) as HTMLInputElement;
    expect(city.checked).toBe(true);
    fireEvent.click(cityCountry);
    expect(await screen.findByText('Label style set to City, Country.')).toBeTruthy();
    expect(cityCountry.checked).toBe(true);
    expect(puts(calls)).toEqual([
      {
        url: '/api/admin/categories/japan/meta',
        method: 'PUT',
        body: { labelStyle: 'cityCountry' },
      },
    ]);
  });
});

const reviewed = (c: Category): Category => {
  const draft = { ...c.draft };
  for (const level of Object.values(draft)) level.reviewed = true;
  return { ...c, draft };
};

/** Japan with every level a reviewed draft inside the box: Publish may go ahead. */
const READY: Category = {
  ...JAPAN,
  draft: {
    easy: { ...JAPAN.live.easy!, reviewed: true },
    medium: {
      places: [place('kyoto', 'city', 'Kyoto', 35.01, 135.77)],
      reviewed: true,
      updatedAt: 1,
    },
    hard: { places: [place('nara', 'city', 'Nara', 34.68, 135.8)], reviewed: true, updatedAt: 1 },
  },
};

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('Category page levels', () => {
  it('shows each level with its state, live and draft counts, review mark and Review', async () => {
    stubServer({
      ...JAPAN,
      draft: { ...JAPAN.draft, easy: { ...JAPAN.live.easy!, reviewed: true } },
    });
    await renderPage();
    const list = screen.getByRole('list', { name: 'Levels' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'Easy · Draft · ReviewedLive: 1 city · 1 landmarkDraft: 1 city · 1 landmarkReview',
      'Medium · Draft · Not reviewedDraft: 1 city · 0 landmarksReview',
      'Hard · Not generated',
    ]);
    expect(within(list).getByRole('link', { name: 'Review Medium' }).getAttribute('href')).toBe(
      '/admin/categories/japan/medium',
    );
  });
});

describe('Category page Publish', () => {
  it('is disabled while a draft is unreviewed or a place lies outside the box, saying why', async () => {
    const calls = stubServer();
    await renderPage();
    expect(button('Publish Japan').disabled).toBe(true);
    expect(screen.getByText('Review Medium first.')).toBeTruthy();
    expect(screen.getByText('Taipei (Medium) lies outside the box.')).toBeTruthy();
    fireEvent.click(button('Publish Japan'));
    expect(calls.filter((c) => c.method === 'POST')).toEqual([]);
  });

  it('is disabled with nothing to publish, and while a landmark has no photo', async () => {
    stubServer({ ...JAPAN, draft: {} });
    await renderPage();
    expect(button('Publish Japan').disabled).toBe(true);
    expect(screen.getByText('Nothing to publish.')).toBeTruthy();
    cleanup();
    stubServer(reviewed({ ...JAPAN, draft: { easy: { ...JAPAN.live.easy!, reviewed: true } } }));
    await renderPage();
    expect(button('Publish Japan').disabled).toBe(true);
    expect(screen.getByText('Tokyo Tower (Easy) has no photo.')).toBeTruthy();
  });

  it('publishes every draft and returns to /admin saying how many levels went live', async () => {
    const ready = structuredClone(READY);
    ready.draft.easy!.places = ready.draft.easy!.places.filter((p) => p.kind === 'city');
    ready.live = {};
    const calls = stubServer(ready);
    await renderPage();
    expect(button('Publish Japan').disabled).toBe(false);
    fireEvent.click(button('Publish Japan'));
    expect(await screen.findByText('Admin home: Japan is live: 3 levels published.')).toBeTruthy();
    expect(calls.filter((c) => c.method === 'POST')).toEqual([
      { url: '/api/admin/categories/japan/publish', method: 'POST', body: {} },
    ]);
  });
});

describe('Category page Hide and Delete', () => {
  it('hides the category from hosts and shows it again', async () => {
    const calls = stubServer();
    await renderPage();
    fireEvent.click(button('Hide from hosts'));
    expect(await screen.findByRole('button', { name: 'Show to hosts' })).toBeTruthy();
    expect(screen.getByText(/A game already using it plays on/)).toBeTruthy();
    fireEvent.click(button('Show to hosts'));
    expect(await screen.findByRole('button', { name: 'Hide from hosts' })).toBeTruthy();
    expect(puts(calls).map((c) => c.body)).toEqual([{ hidden: true }, { hidden: false }]);
  });

  it('deletes only once the name is typed, then returns to /admin', async () => {
    const calls = stubServer();
    await renderPage();
    fireEvent.click(button('Delete'));
    const name = screen.getByRole('textbox', { name: /Type “Japan” to delete it/ });
    fireEvent.change(name, { target: { value: 'japan' } });
    expect(button('Delete Japan').disabled).toBe(true);
    fireEvent.submit(name.closest('form')!);
    expect(calls.filter((c) => c.method === 'DELETE')).toEqual([]);
    fireEvent.change(name, { target: { value: 'Japan' } });
    expect(button('Delete Japan').disabled).toBe(false);
    fireEvent.click(button('Delete Japan'));
    expect(await screen.findByText('Admin home: Japan deleted.')).toBeTruthy();
    expect(calls.filter((c) => c.method === 'DELETE')).toEqual([
      { url: '/api/admin/categories/japan', method: 'DELETE', body: {} },
    ]);
  });

  it('cancels a delete, keeping the category', async () => {
    stubServer();
    await renderPage();
    fireEvent.click(button('Delete'));
    fireEvent.click(button('Cancel'));
    expect(screen.queryByRole('textbox', { name: /to delete it/ })).toBeNull();
    expect(document.activeElement).toBe(button('Delete'));
  });
});

describe('Category page emoji', () => {
  it('saves a grid pick and refuses anything but one emoji in Other', async () => {
    const calls = stubServer();
    await renderPage();
    fireEvent.click(button('Change emoji for Japan'));
    const dialog = screen.getByRole('dialog', { name: 'Emoji for Japan' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Other' }), {
      target: { value: 'ab' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Type one emoji, such as 🦉.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '🗽' }));
    await screen.findByRole('button', { name: 'Change emoji for Japan', expanded: false });
    expect(puts(calls).map((c) => c.body)).toEqual([{ emoji: '🗽' }]);
    expect(screen.getByRole('button', { name: 'Change emoji for Japan' }).textContent).toBe('🗽');
  });

  it('parseOtherEmoji takes flags and keycaps, not text', () => {
    expect(parseOtherEmoji(' 🇯🇵 ')).toEqual({ emoji: '🇯🇵' });
    expect(parseOtherEmoji('x')).toEqual({ error: 'Type one emoji, such as 🦉.' });
  });
});

describe('publishedText', () => {
  it('names the levels published', () => {
    expect(publishedText('Japan', 3)).toBe('Japan is live: 3 levels published.');
    expect(publishedText('Japan', 1)).toBe('Japan is live: 1 level published.');
    expect(publishedText('Japan', 0)).toBe('Japan is live: its box and label style published.');
  });
});

describe('dragCorner', () => {
  it('moves the two edges of the dragged corner, rounded to 2 decimals', () => {
    const box = { south: 24, west: 122, north: 46, east: 146 };
    expect(dragCorner(box, 'sw', { lat: 20.123, lng: 120.456 })).toEqual({
      south: 20.12,
      west: 120.46,
      north: 46,
      east: 146,
    });
    expect(dragCorner(box, 'ne', { lat: 47.005, lng: 190 })).toEqual({
      south: 24,
      west: 122,
      north: 47.01,
      east: 190,
    });
  });
});

describe('boxPlaces', () => {
  it('counts a place past the antimeridian as inside a box with east > 180', () => {
    const pacific: Category = {
      ...JAPAN,
      live: {},
      draft: {
        easy: {
          places: [
            place('suva', 'city', 'Suva', -18.14, 178.44),
            place('nukualofa', 'city', "Nuku'alofa", -21.14, -175.2),
            place('papeete', 'city', 'Papeete', -17.53, -149.57),
          ],
          reviewed: false,
          updatedAt: 1,
        },
      },
    };
    const box = { south: -25, west: 170, north: -10, east: 190 };
    expect(boxPlaces(pacific, box).map((p) => [p.place.id, p.outside])).toEqual([
      ['suva', false],
      ['nukualofa', false],
      ['papeete', true],
    ]);
  });
});
