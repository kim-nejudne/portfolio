// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../shared/constants.js';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import { STARTER_SETS } from '../../../shared/starterSets/index.js';
import { db } from '../lib/db.js';
import { loadHostToken } from '../lib/hostTokens.js';
import { DIFFICULTY_LABELS } from '../lib/setLabels.js';
import { Landing } from './Landing.js';

const FIRST_VISIT = 1_700_000_000_000;

/** The elements asked to scroll into view; jsdom has no layout, so it has no scrollIntoView. */
let scrolled: Element[] = [];

beforeEach(async () => {
  scrolled = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
  vi.spyOn(Date, 'now').mockReturnValue(FIRST_VISIT);
  await db.delete();
  await db.open();
});

afterEach(() => {
  cleanup();
  delete (Element.prototype as Partial<Element>).scrollIntoView;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

function renderLanding() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
  return {
    input: screen.getByLabelText<HTMLInputElement>('Room code'),
    join: screen.getByRole<HTMLButtonElement>('button', { name: 'Join' }),
  };
}

describe('Landing', () => {
  it('upper-cases the typed code', () => {
    const { input } = renderLanding();
    fireEvent.change(input, { target: { value: 'wxyz' } });
    expect(input.value).toBe('WXYZ');
  });

  it('keeps only room-code alphabet letters, at most 4', () => {
    const { input } = renderLanding();
    fireEvent.change(input, { target: { value: 'a1 iLob-cdEF' } });
    expect(input.value).toBe('ABCD');
  });

  it('disables Join until the code has 4 letters', () => {
    const { input, join } = renderLanding();
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(join.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'abcd' } });
    expect(join.disabled).toBe(false);
  });

  it('submitting a code navigates to /play/<CODE>', () => {
    const { input } = renderLanding();
    fireEvent.change(input, { target: { value: 'qrst' } });
    fireEvent.submit(input.form!);
    expect(screen.getByTestId('path').textContent).toBe('/play/QRST');
  });

  it('does not navigate on submit with an incomplete code', () => {
    const { input } = renderLanding();
    fireEvent.change(input, { target: { value: 'qr' } });
    fireEvent.submit(input.form!);
    expect(screen.queryByTestId('path')).toBeNull();
  });

  it('offers Host a game and links Question sets to /sets', () => {
    renderLanding();
    expect(screen.getByRole('button', { name: 'Host a game' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Question sets' }).getAttribute('href')).toBe('/sets');
  });
});

describe('Host a game', () => {
  const hostToken = 'h'.repeat(43);

  function stubCreateRoom(response: Response) {
    const fetch = vi.fn(() => Promise.resolve(response));
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  const quiz = {
    ...SAMPLE_SET,
    id: 'quiz',
    title: 'Pub quiz',
    questions: SAMPLE_SET.questions.filter((q) => q.imageId === undefined),
    createdAt: FIRST_VISIT,
    updatedAt: FIRST_VISIT + 1,
  };

  async function openPicker() {
    fireEvent.click(screen.getByRole('button', { name: 'Host a game' }));
    return screen.findByRole('heading', { name: 'Pick a question set' });
  }

  async function hostAGame() {
    renderLanding();
    await openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
    return screen.findByRole('heading', { name: 'Room created' });
  }

  it("Host a game lists this browser's sets, then the built-ins, the last edited one picked", async () => {
    await db.sets.add(quiz);
    renderLanding();
    await openPicker();
    const radios = screen.getAllByRole<HTMLInputElement>('radio');
    expect(radios.map((r) => r.labels?.[0]?.textContent)).toEqual([
      'Pub quiz8 questions',
      `${SAMPLE_SET.title}10 questions · Built-in`,
      ...STARTER_SETS.map(
        (s) => `${s.title}15 questions · ${DIFFICULTY_LABELS[s.difficulty!]} · Built-in`,
      ),
    ]);
    expect(radios.map((r) => r.checked)).toEqual([true, ...STARTER_SETS.map(() => false), false]);
  });

  it('creates a room with the picked set and default settings', async () => {
    await db.sets.add(quiz);
    const fetch = stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    renderLanding();
    await openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
    await screen.findByRole('heading', { name: 'Room created' });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/rooms');
    expect(JSON.parse(init.body as string)).toEqual({ set: quiz, settings: DEFAULT_SETTINGS });
  });

  it('with no saved sets, the picker lists the built-ins and hosts the sample with its pictures', async () => {
    const fetch = vi.fn((url: string) =>
      Promise.resolve(
        url === '/api/rooms'
          ? Response.json({ code: 'WXYZ', hostToken }, { status: 201 })
          : Response.json({ ok: true }, { status: 201 }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    renderLanding();
    await openPicker();
    expect(screen.getAllByRole('radio')).toHaveLength(1 + STARTER_SETS.length);
    expect(
      screen.getByRole<HTMLInputElement>('radio', { name: /^Sample: General Knowledge/ }).checked,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
    await screen.findByRole('heading', { name: 'Room created' });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/rooms',
      '/api/rooms/WXYZ/images/sample-img-hexagon',
      '/api/rooms/WXYZ/images/sample-img-flag',
    ]);
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      set: SAMPLE_SET,
      settings: DEFAULT_SETTINGS,
    });
  });

  it('picks Animals – Easy by search, chip and Enter, then hosts it', async () => {
    await db.sets.add(quiz);
    const fetch = stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    renderLanding();
    await openPicker();
    const search = screen.getByRole('searchbox', { name: 'Search sets' });
    fireEvent.change(search, { target: { value: 'animal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Easy' }));
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    fireEvent.keyDown(search, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
    await screen.findByRole('heading', { name: 'Room created' });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { set: { id: string } };
    expect(body.set.id).toBe('starter-animals-easy');
  });

  it('scrolls the picker to the top of the page when it opens, so its search box shows', async () => {
    renderLanding();
    const heading = await openPicker();
    expect(scrolled).toEqual([heading.closest('section')]);
  });

  it('Create room waits for a pick once the search hides the preselected set', async () => {
    await db.sets.add(quiz);
    renderLanding();
    await openPicker();
    const create = screen.getByRole<HTMLButtonElement>('button', { name: 'Create room' });
    expect(create.disabled).toBe(false);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search sets' }), {
      target: { value: 'movies' },
    });
    expect(create.disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /^Movies – Hard/ }));
    expect(create.disabled).toBe(false);
  });

  it('an unfinished draft is refused with what to fix, before any request', async () => {
    await db.sets.add({ ...quiz, questions: [] });
    const fetch = stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    renderLanding();
    await openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
    expect((await screen.findByRole('alert')).textContent).toBe('This set has no questions yet.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('Cancel closes the picker', async () => {
    renderLanding();
    await openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Pick a question set' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Host a game' })).toBeTruthy();
  });

  it('stores the hostToken in localStorage under the room code', async () => {
    stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    await hostAGame();
    expect(loadHostToken('WXYZ')).toBe(hostToken);
  });

  it('Use this device as the Screen opens /screen/<CODE>', async () => {
    stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    await hostAGame();
    fireEvent.click(screen.getByRole('button', { name: 'Use this device as the Screen' }));
    expect(screen.getByTestId('path').textContent).toBe('/screen/WXYZ');
  });

  it('Use this phone as the host remote opens /host/<CODE> with no token in the URL', async () => {
    stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    await hostAGame();
    fireEvent.click(screen.getByRole('button', { name: 'Use this phone as the host remote' }));
    expect(screen.getByTestId('path').textContent).toBe('/host/WXYZ');
    expect(loadHostToken('WXYZ')).toBe(hostToken);
  });

  it('Open the Screen on another device shows the Screen URL and the code', async () => {
    stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    await hostAGame();
    const other = screen.getByRole('button', { name: 'Open the Screen on another device' });
    expect(screen.queryByText(`${window.location.host}/screen/WXYZ`)).toBeNull();
    fireEvent.click(other);
    expect(screen.getByText(`${window.location.host}/screen/WXYZ`)).toBeTruthy();
    expect(screen.getAllByText('WXYZ').length).toBeGreaterThan(1);
  });

  it('shows the server error and lets the host try again', async () => {
    stubCreateRoom(Response.json({ ok: false, error: 'Too many rooms' }, { status: 429 }));
    renderLanding();
    await openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Too many rooms');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create room' }).disabled).toBe(
      false,
    );
    expect(localStorage.length).toBe(0);
  });
});
