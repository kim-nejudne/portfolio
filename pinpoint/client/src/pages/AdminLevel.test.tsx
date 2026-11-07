// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Category,
  GenerationJob,
  Photo,
  PhotoCandidate,
  Place,
  WikidataCandidate,
} from '#shared/types.js';
import { placeChanges, placeWarnings, reviewAction, stepCard } from '../lib/adminLevel.js';
import { follow, ordinal } from '../lib/levelJobs.js';
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

const PHOTO: Photo = {
  id: 'ph1',
  width: 1280,
  height: 960,
  author: 'Jane Roe',
  licence: 'CC BY-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  commonsFile: 'File:Tokyo Tower 2023.jpg',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tokyo_Tower_2023.jpg',
  signCheck: 'passed',
};

const candidate = (n: number, extra: Partial<PhotoCandidate> = {}): PhotoCandidate => ({
  commonsFile: `File:Tower ${n}.jpg`,
  thumbUrl: `https://upload.wikimedia.org/t${n}.jpg`,
  author: `Author ${n}`,
  licence: 'CC0',
  licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  width: 1600,
  height: 1200,
  ...extra,
});

/** Japan with Tokyo Tower photographed, two candidates kept (the second flagged). */
function photographed(photo: Partial<Photo> = {}): Category {
  const c = japan();
  const tower = c.draft.medium!.places[3]!;
  tower.photo = { ...PHOTO, ...photo };
  tower.photoCandidates = [candidate(1), candidate(2, { namesPlace: true })];
  return c;
}

const NARA: WikidataCandidate[] = [
  {
    wikidataId: 'Q169134',
    name: 'Nara',
    description: 'capital city of Nara Prefecture, Japan',
    country: 'Japan',
    lat: 34.685,
    lng: 135.805,
  },
  {
    wikidataId: 'Q999',
    name: 'Nara Prefecture',
    description: 'prefecture of Japan',
    country: null,
    lat: null,
    lng: null,
  },
];

/** A replace or add job as the server lists it. */
function job(over: Partial<GenerationJob>): GenerationJob {
  return {
    id: 'j1',
    kind: 'replace',
    guidance: '',
    state: 'queued',
    categoryId: 'japan',
    category: 'Japan',
    levels: [
      { level: 'medium', count: 1, state: 'waiting', stage: null, kept: { city: 0, landmark: 0 } },
    ],
    placeKind: 'city',
    placeId: 'kyoto',
    replaced: null,
    queuePosition: 1,
    costUsd: 0,
    error: null,
    startedAt: 1,
    endedAt: null,
    ...over,
  };
}

/**
 * The job routes: a started job waits in the queue until a test moves it on with `run` or
 * `finish` (which swaps the new place into the category as the runner does) and a poll reads it.
 */
const jobServer = {
  list: [] as GenerationJob[],
  left: 100,
  off: null as string | null,
  category: null as unknown as Category,
  find: (id: string) => jobServer.list.find((j) => j.id === id)!,
  run(id: string) {
    for (const j of jobServer.list) {
      if (j.state === 'queued' && j.queuePosition !== null) j.queuePosition--;
    }
    Object.assign(jobServer.find(id), { state: 'running', queuePosition: null });
  },
  finish(id: string, arrived: Place) {
    const j = jobServer.find(id);
    const c = structuredClone(jobServer.category);
    const places = c.draft.medium!.places;
    const at = places.findIndex((p) => p.id === j.placeId);
    const old = at === -1 ? null : places[at]!;
    const placed = { ...arrived, id: j.placeId ?? arrived.id };
    if (at === -1) places.push(placed);
    else places[at] = placed;
    jobServer.category = c;
    Object.assign(j, { state: 'done', queuePosition: null, replaced: { old, new: placed } });
  },
};

/** The category GET and the level's writes, applied as the store would, plus the tile config. */
function stubServer(start: Category = japan()) {
  jobServer.list = [];
  jobServer.left = 100;
  jobServer.off = null;
  jobServer.category = start;
  const calls: Call[] = [];
  const START = /^\/api\/admin\/categories\/japan\/levels\/medium\/places\/(?:(\w+)\/replace|add)$/;
  const JOB = /^\/api\/admin\/jobs\/(\w+)\/(cancel|undo)$/;
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
        return Response.json({ category: jobServer.category });
      }
      if (url === '/api/admin/jobs?categoryId=japan') {
        return Response.json({
          jobs: structuredClone(jobServer.list),
          off: jobServer.off,
          levelsLeft: 5,
          replacementsLeft: jobServer.left,
        });
      }
      const starting = START.exec(url);
      if (starting && method === 'POST') {
        const id = `j${jobServer.list.length + 1}`;
        const placeId = starting[1] ?? null;
        jobServer.list.push(
          job({
            id,
            kind: placeId ? 'replace' : 'add',
            placeId,
            placeKind: placeId
              ? jobServer.category.draft.medium!.places.find((p) => p.id === placeId)!.kind
              : (body as { kind: Place['kind'] }).kind,
            queuePosition: jobServer.list.filter((j) => j.state === 'queued').length + 1,
          }),
        );
        jobServer.left--;
        return Response.json({ jobId: id });
      }
      const jobAt = JOB.exec(url);
      if (jobAt && method === 'POST') {
        const j = jobServer.find(jobAt[1]!);
        if (jobAt[2] === 'cancel') {
          Object.assign(j, { state: 'cancelled', queuePosition: null });
          jobServer.left++;
          return Response.json({ job: j });
        }
        const c = structuredClone(jobServer.category);
        const places = c.draft.medium!.places;
        places[places.findIndex((p) => p.id === j.placeId)] = j.replaced!.old!;
        jobServer.category = c;
        return Response.json({ category: c });
      }
      const at = PLACE.exec(url);
      if (at) {
        const [, level, id] = at as unknown as [string, 'easy' | 'medium', string];
        jobServer.category = structuredClone(jobServer.category);
        const category = jobServer.category;
        category.draft[level] ??= { ...structuredClone(category.live[level]!), reviewed: true };
        const content = category.draft[level];
        if (method === 'DELETE') content.places = content.places.filter((p) => p.id !== id);
        else {
          const p = content.places.find((x) => x.id === id)!;
          const { photoCandidate, ...edit } = body as Partial<Place> & { photoCandidate?: string };
          if (photoCandidate) {
            // As the server swaps: the pick becomes the photo, the old one a candidate.
            const pick = p.photoCandidates!.find((c) => c.commonsFile === photoCandidate)!;
            p.photoCandidates = p.photoCandidates!.filter((c) => c !== pick);
            p.photo = {
              ...PHOTO,
              id: 'swapped',
              author: pick.author,
              commonsFile: pick.commonsFile,
              signCheck: pick.namesPlace ? 'flagged' : 'passed',
            };
          }
          Object.assign(p, edit);
          if (edit.lat !== undefined) p.coordsSource = 'admin';
          if (edit.displayName !== undefined) p.autoDisplayName = false;
        }
        return Response.json({ category: jobServer.category });
      }
      if (url === '/api/admin/categories/japan/levels/medium/reviewed' && method === 'POST') {
        jobServer.category = structuredClone(jobServer.category);
        jobServer.category.draft.medium!.reviewed = (body as { reviewed: boolean }).reviewed;
        return Response.json({ category: jobServer.category });
      }
      if (url.startsWith('/api/admin/wikidata/search?')) {
        return Response.json({ candidates: url.includes('q=Nara') ? NARA : [] });
      }
      const adding = /^\/api\/admin\/categories\/japan\/levels\/(\w+)\/places\/add-by-id$/.exec(
        url,
      );
      if (adding && method === 'POST') {
        const { kind, wikidataId, fact } = body as {
          kind: Place['kind'];
          wikidataId: string;
          fact: string;
        };
        const pick = NARA.find((c) => c.wikidataId === wikidataId)!;
        if (pick.lat === null)
          return Response.json({ error: 'No coordinates on Wikidata' }, { status: 422 });
        jobServer.category = structuredClone(jobServer.category);
        jobServer.category.draft[adding[1] as 'medium']!.places.push(
          place('nara', kind, pick.name, pick.lat, pick.lng!, { fact, wikidataId }),
        );
        return Response.json({ category: jobServer.category });
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

describe('Level review photos', () => {
  const landmarks = async (c: Category) => {
    const calls = stubServer(c);
    await renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Landmarks/ }));
    return calls;
  };
  const warningsOf = (name: string) =>
    within(screen.getByRole('list', { name: `Warnings for ${name}` }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);

  it('shows the 4:3 photo with its credit, and swaps it for a stored candidate', async () => {
    const calls = await landmarks(photographed());
    const tower = card('Tokyo Tower');
    const img = within(tower).getByRole('img', { name: 'Photo of Tokyo Tower' });
    expect(img.getAttribute('src')).toBe('/api/admin/photos/ph1');
    expect(img.className).toContain('object-contain');
    expect(img.parentElement!.className).toContain('aspect-[4/3]');
    expect(within(tower).getByText(/Photo: Jane Roe/)).toBeTruthy();
    expect(within(tower).getByRole('link', { name: 'CC BY-SA 4.0' }).getAttribute('href')).toBe(
      PHOTO.sourceUrl,
    );
    expect(within(tower).queryByText('Names the place')).toBeNull();

    fireEvent.click(within(tower).getByRole('button', { name: 'Swap photo for Tokyo Tower' }));
    const picker = within(tower).getByRole('group', { name: 'Swap photo for Tokyo Tower' });
    // Thumbnails load from Commons in this browser.
    const thumbs = within(picker).getAllByRole('img');
    expect(thumbs.map((t) => t.getAttribute('src'))).toEqual([
      'https://upload.wikimedia.org/t1.jpg',
      'https://upload.wikimedia.org/t2.jpg',
    ]);
    expect(within(picker).getByText('Author 1 · CC0 · 1600 × 1200')).toBeTruthy();
    // Only the flagged one is badged, and it is offered rather than hidden.
    expect(within(picker).getAllByText('Names the place')).toHaveLength(1);
    expect(
      within(picker).getByRole('button', { name: 'Use photo 2 by Author 2 (names the place)' }),
    ).toBeTruthy();
    fireEvent.error(thumbs[0]!);
    expect(within(picker).getByText("Couldn't load from Commons")).toBeTruthy();
    expect(within(picker).getAllByRole('img')).toHaveLength(1);

    fireEvent.click(within(picker).getByRole('button', { name: 'Use photo 1 by Author 1' }));
    expect(within(picker).getByRole('button', { name: /Use photo 1/ }).textContent).toBe(
      'Swapping…',
    );
    await waitFor(() =>
      expect(
        within(card('Tokyo Tower'))
          .getByRole('img', { name: 'Photo of Tokyo Tower' })
          .getAttribute('src'),
      ).toBe('/api/admin/photos/swapped'),
    );
    expect(writes(calls)).toEqual([
      {
        url: '/api/admin/categories/japan/levels/medium/places/tower',
        method: 'PUT',
        body: { photoCandidate: 'File:Tower 1.jpg' },
      },
    ]);
    expect(within(card('Tokyo Tower')).queryByRole('group')).toBeNull();
    expect(within(card('Tokyo Tower')).getByText(/Photo: Author 1/)).toBeTruthy();
    const swap = screen.getByRole('button', { name: 'Swap photo for Tokyo Tower' });
    expect(document.activeElement).toBe(swap);
    expect(swap.getAttribute('aria-expanded')).toBe('false');
  });

  it('badges a flagged pick on the card once the server stores it', async () => {
    await landmarks(photographed());
    fireEvent.click(screen.getByRole('button', { name: 'Swap photo for Tokyo Tower' }));
    fireEvent.click(screen.getByRole('button', { name: /Use photo 2/ }));
    await waitFor(() => expect(within(card('Tokyo Tower')).queryByRole('group')).toBeNull());
    expect(within(card('Tokyo Tower')).getByText('Names the place')).toBeTruthy();
    expect(warningsOf('Tokyo Tower')).toEqual(['⚠ Check for signs naming the place']);
  });

  it('shows a refused swap on the card and keeps the picker; Esc closes it', async () => {
    await landmarks(photographed());
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json(
        {
          error:
            'The photo folder is over PHOTOS_MAX_MB. Delete unused categories before generating more.',
        },
        { status: 507 },
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Swap photo for Tokyo Tower' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use photo 1 by Author 1' }));
    expect((await screen.findByText(/over PHOTOS_MAX_MB/)).getAttribute('role')).toBe('alert');
    const picker = screen.getByRole('group', { name: 'Swap photo for Tokyo Tower' });
    expect(
      within(card('Tokyo Tower')).getByRole('img', { name: 'Photo of Tokyo Tower' }),
    ).toBeTruthy();
    press('Escape', within(picker).getByRole('button', { name: 'Use photo 1 by Author 1' }));
    expect(screen.queryByRole('group', { name: 'Swap photo for Tokyo Tower' })).toBeNull();
  });

  it('warns of a small photo, a hidden author credit and an unchecked or flagged photo', async () => {
    await landmarks(
      photographed({ width: 960, height: 720, author: 'Tokyo Tower fan', signCheck: 'flagged' }),
    );
    expect(warningsOf('Tokyo Tower')).toEqual([
      '⚠ Photo under 1000 px',
      '⚠ Author credit will be hidden while guessing',
      '⚠ Check for signs naming the place',
    ]);
    expect(within(card('Tokyo Tower')).getByText('Names the place')).toBeTruthy();

    const c = photographed();
    const tower = c.draft.medium!.places[3]!;
    expect(placeWarnings(c, 'medium', tower, tower)).toEqual([]);
    // 1000 px on the longer side is enough, either way round.
    const tall = { ...tower, photo: { ...PHOTO, width: 750, height: 1000 } };
    expect(placeWarnings(c, 'medium', tall, tower)).toEqual([]);
    // Never sign-checked (Add by name, or generation off).
    const unchecked = { ...PHOTO, signCheck: undefined };
    expect(placeWarnings(c, 'medium', { ...tower, photo: unchecked }, tower)).toEqual([
      'Check for signs naming the place',
    ]);
  });

  it('previews a landmark as the Screen’s Picture prompt and a city as its flaps', async () => {
    await landmarks(photographed({ author: 'Tokyo Tower fan' }));
    const tower = card('Tokyo Tower');
    const toggle = within(tower).getByRole('button', { name: 'Preview Tokyo Tower' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    const stage = within(tower).getByTestId('preview-stage');
    const photo = within(stage).getByRole('img', { name: 'The photo to find', hidden: true });
    expect(photo.getAttribute('src')).toBe('/api/admin/photos/ph1');
    // The guessing credit: here the author names the place, so it is hidden.
    expect(
      within(stage).getByText('Photo: Wikimedia Commons contributor · CC BY-SA 4.0'),
    ).toBeTruthy();
    expect(within(stage).getByRole('img', { name: /^Round 1\/10 · /, hidden: true })).toBeTruthy();
    expect((stage.firstElementChild as HTMLElement).style.width).toBe('1920px');
    expect(stage.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(within(tower).getByRole('button', { name: 'Hide the preview of Tokyo Tower' }));
    expect(within(tower).queryByTestId('preview-stage')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /Cities/ }));
    fireEvent.click(within(card('Kyoto')).getByRole('button', { name: 'Preview Kyoto' }));
    const kyotoStage = within(card('Kyoto')).getByTestId('preview-stage');
    // The flaps read as the name (their cells are mid-flip: SplitFlap.test.tsx covers them).
    expect(
      within(kyotoStage).getAllByRole('img', { name: 'Kyoto City', hidden: true }),
    ).not.toHaveLength(0);
    expect(
      within(kyotoStage).queryByRole('img', { name: 'The photo to find', hidden: true }),
    ).toBeNull();
  });

  it('offers no Swap photo with no other candidates, and no Preview without a photo', async () => {
    await landmarks(japan());
    const tower = card('Tokyo Tower');
    expect(within(tower).getByText('No photo')).toBeTruthy();
    const swap = within(tower).getByRole('button', { name: 'No other photos for Tokyo Tower' });
    expect((swap as HTMLButtonElement).disabled).toBe(true);
    expect(within(tower).queryByRole('button', { name: /Preview/ })).toBeNull();
  });
});

describe('Level review Add by name', () => {
  it('searches Wikidata, picks a candidate, types the fact and adds it to the tab', async () => {
    const calls = stubServer();
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Add by name' }));
    const panel = screen.getByRole('region', { name: 'Add a city by name' });
    const search = within(panel).getByRole('button', { name: 'Search' }) as HTMLButtonElement;
    expect(search.disabled).toBe(true);
    fireEvent.change(input(panel, 'Name on Wikidata'), { target: { value: 'Nowhere' } });
    fireEvent.click(search);
    expect(await within(panel).findByText('Nothing on Wikidata matches that name.')).toBeTruthy();

    fireEvent.change(input(panel, 'Name on Wikidata'), { target: { value: ' Nara ' } });
    fireEvent.click(search);
    const nara = await within(panel).findByRole('radio', { name: /^Nara Q169134/ });
    expect(calls.at(-1)!.url).toBe('/api/admin/wikidata/search?q=Nara&categoryId=japan');
    // Each candidate: description, country and coordinates (or that there are none).
    expect(within(panel).getByText('capital city of Nara Prefecture, Japan')).toBeTruthy();
    expect(within(panel).getByText('Japan · 34.69, 135.81')).toBeTruthy();
    expect(within(panel).getByText('Country unclear · no coordinates')).toBeTruthy();

    const add = () => within(panel).getByRole('button', { name: /^Add / }) as HTMLButtonElement;
    expect(within(panel).getByText('2 matches')).toBeTruthy();
    expect(add().disabled).toBe(true);
    expect(within(panel).getByText('Pick a city to add it.')).toBeTruthy();
    fireEvent.click(nara);
    expect(add().disabled).toBe(true);
    expect(within(panel).getByText('Type a fact to add it.')).toBeTruthy();
    fireEvent.change(input(panel, /^Fact/), { target: { value: ' Deer roam the park. ' } });
    expect(within(panel).getByText('21/90')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Add Nara' }));

    expect(await screen.findByRole('article', { name: 'Nara' })).toBeTruthy();
    expect(writes(calls).at(-1)).toEqual({
      url: '/api/admin/categories/japan/levels/medium/places/add-by-id',
      method: 'POST',
      body: { kind: 'city', wikidataId: 'Q169134', fact: 'Deer roam the park.' },
    });
    expect(screen.getByRole('status').textContent).toBe('Added Nara.');
    expect(screen.queryByRole('region', { name: 'Add a city by name' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Cities (4)' })).toBeTruthy();
  });

  it('shows why the server refused a pick, keeps the form, and is offered on Landmarks too', async () => {
    stubServer();
    await renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Landmarks/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add by name' }));
    const panel = screen.getByRole('region', { name: 'Add a landmark by name' });
    fireEvent.change(input(panel, 'Name on Wikidata'), { target: { value: 'Nara' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Search' }));
    fireEvent.click(await within(panel).findByRole('radio', { name: /^Nara Prefecture/ }));
    fireEvent.change(input(panel, /^Fact/), { target: { value: 'A fact.' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Add Nara Prefecture' }));
    expect(
      (await within(panel).findByText('No coordinates on Wikidata')).getAttribute('role'),
    ).toBe('alert');
    // Esc closes the panel and gives focus back to Add by name.
    press('Escape', input(panel, /^Fact/));
    expect(screen.queryByRole('region', { name: 'Add a landmark by name' })).toBeNull();
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
    expect(k('r')).toBe('replace');
    expect(k('x')).toBeNull();
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

describe('Level review Replace and Add a place', () => {
  /** Lets the page's 2-second job poll run once. */
  async function poll() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
  }
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }));
  afterEach(() => vi.useRealTimers());

  it('queues replacements with their note and position, swaps the new place in, and Undo puts the old back', async () => {
    const calls = stubServer();
    await renderPage();
    expect(screen.getByText('100 replacements left today (UTC).')).toBeTruthy();

    fireEvent.click(within(card('Kyoto')).getByRole('button', { name: 'Replace Kyoto' }));
    const form = screen.getByRole('form', { name: 'Replace' });
    fireEvent.change(input(form, /Why replace/), { target: { value: 'too obscure' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Replace' }));
    expect(await within(card('Kyoto')).findByText('Queued · 1st')).toBeTruthy();
    // Replace is now disabled, so focus stays on the card for J/K.
    await waitFor(() => expect(document.activeElement).toBe(card('Kyoto')));
    fireEvent.click(within(card('Sakai')).getByRole('button', { name: 'Replace Sakai' }));
    fireEvent.click(
      within(screen.getByRole('form', { name: 'Replace' })).getByRole('button', {
        name: 'Replace',
      }),
    );
    expect(await within(card('Sakai')).findByText('Queued · 2nd')).toBeTruthy();
    expect(writes(calls).map(({ url, body }) => ({ url, body }))).toEqual([
      {
        url: '/api/admin/categories/japan/levels/medium/places/kyoto/replace',
        body: { note: 'too obscure' },
      },
      { url: '/api/admin/categories/japan/levels/medium/places/sakai/replace', body: {} },
    ]);
    expect(screen.getByText('2 replacing')).toBeTruthy();
    expect(screen.getByText('98 replacements left today (UTC).')).toBeTruthy();
    // A queued place can't be edited or removed meanwhile.
    expect(
      (within(card('Kyoto')).getByRole('button', { name: 'Edit Kyoto' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    jobServer.run('j1');
    await poll();
    expect(within(card('Kyoto')).getByText('Writing a new city…')).toBeTruthy();
    expect(within(card('Sakai')).getByText('Queued · 1st')).toBeTruthy();

    jobServer.finish('j1', place('x', 'city', 'Nagoya', 35.18, 136.91, { wikidataId: 'Q11751' }));
    await poll();
    const nagoya = await screen.findByRole('article', { name: 'Nagoya' });
    expect(within(nagoya).getByText('Replaced Kyoto')).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Kyoto' })).toBeNull();
    // Far from Kyoto, but where Wikidata put it: no "Moved" warning from the old place's pin.
    expect(within(nagoya).queryByText(/Moved/)).toBeNull();

    fireEvent.click(within(nagoya).getByRole('button', { name: 'Undo replacing Kyoto' }));
    const kyoto = await screen.findByRole('article', { name: 'Kyoto' });
    expect(within(kyoto).queryByRole('button', { name: /Undo/ })).toBeNull();
    expect(writes(calls).at(-1)).toMatchObject({ url: '/api/admin/jobs/j1/undo', method: 'POST' });
  });

  it('cancels a queued replacement, and shows a failed one on its card', async () => {
    const calls = stubServer();
    await renderPage();
    fireEvent.click(within(card('Kyoto')).getByRole('button', { name: 'Replace Kyoto' }));
    fireEvent.submit(screen.getByRole('form', { name: 'Replace' }));
    await within(card('Kyoto')).findByText('Queued · 1st');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel replacing Kyoto' }));
    expect(
      await within(card('Kyoto')).findByRole('button', { name: 'Replace Kyoto' }),
    ).toBeTruthy();
    expect(writes(calls).at(-1)).toMatchObject({ url: '/api/admin/jobs/j1/cancel' });

    fireEvent.click(within(card('Sakai')).getByRole('button', { name: 'Replace Sakai' }));
    fireEvent.submit(screen.getByRole('form', { name: 'Replace' }));
    await within(card('Sakai')).findByText('Queued · 1st');
    Object.assign(jobServer.find('j2'), { state: 'failed', error: 'No place passed the checks.' });
    await poll();
    expect(within(card('Sakai')).getByRole('alert').textContent).toBe(
      'The replacement failed: No place passed the checks.',
    );
  });

  it('adds a place of the tab’s kind with a note, queued under the list, then marked Added', async () => {
    const calls = stubServer();
    await renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Landmarks/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    const form = screen.getByRole('form', { name: 'Add a landmark' });
    fireEvent.change(input(form, /new landmark/), { target: { value: 'a temple' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add a landmark' }));
    const adding = await screen.findByRole('region', { name: 'Add a landmark' });
    expect(await within(adding).findByText('Queued · 1st')).toBeTruthy();
    expect(writes(calls)[0]).toMatchObject({
      url: '/api/admin/categories/japan/levels/medium/places/add',
      body: { kind: 'landmark', note: 'a temple' },
    });
    expect(screen.getByText('1 adding')).toBeTruthy();

    jobServer.finish('j1', place('kinkaku', 'landmark', 'Kinkaku-ji', 35.04, 135.73));
    await poll();
    const added = await screen.findByRole('article', { name: /Kinkaku-ji/ });
    expect(within(added).getByText('Added')).toBeTruthy();
    expect(within(adding).queryByText(/Queued/)).toBeNull();
  });

  it('R opens Replace on the focused card; the limit and no key turn Replace and Add off', async () => {
    stubServer();
    await renderPage();
    card('Sakai').focus();
    press('r', card('Sakai'));
    expect(within(card('Sakai')).getByRole('form', { name: 'Replace' })).toBeTruthy();
    cleanup();

    stubServer();
    jobServer.left = 0;
    await renderPage();
    const limited = within(card('Kyoto')).getByRole('button', {
      name: 'Replace Kyoto (daily limit reached)',
    });
    expect(limited.textContent).toBe('Daily limit reached');
    expect((limited as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getAllByRole('button', { name: 'Daily limit reached' }).at(-1) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText('0 replacements left today (UTC).')).toBeTruthy();
    cleanup();

    stubServer();
    jobServer.off = 'Generation is off: PINPOINT_ANTHROPIC_API_KEY is not set.';
    await renderPage();
    expect(
      (
        within(card('Kyoto')).getByRole('button', {
          name: 'Replace Kyoto (off)',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    // The reason sits by Add a place too, not only in the footer.
    expect(
      screen.getAllByText(/PINPOINT_ANTHROPIC_API_KEY is not set/).map((e) => e.textContent),
    ).toHaveLength(2);
    expect(
      screen.getByText(
        'Replacing and adding places is off: Generation is off: PINPOINT_ANTHROPIC_API_KEY is not set.',
      ),
    ).toBeTruthy();
  });

  it('follows only jobs seen running, and numbers queue places', () => {
    const ended = job({ id: 'old', state: 'done' });
    expect(follow(new Map(), [ended]).followed.size).toBe(0);
    const { followed } = follow(new Map(), [job({ id: 'a' })]);
    expect(follow(followed, [job({ id: 'a', state: 'done' })]).ended).toHaveLength(1);
    expect([1, 2, 3, 4, 11, 22, 113].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '22nd',
      '113th',
    ]);
  });
});
