// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Place } from '#shared/types.js';
import { boxPlaces, dragCorner } from '../lib/adminCategory.js';
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
      return Response.json({ error: 'Not found.' }, { status: 404 });
    }),
  );
  return calls;
}

async function renderPage() {
  const view = render(
    <MemoryRouter initialEntries={['/admin/categories/japan']}>
      <Routes>
        <Route path="/admin/categories/:id" element={<AdminCategory />} />
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
