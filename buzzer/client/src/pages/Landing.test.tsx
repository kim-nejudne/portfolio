// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../shared/constants.js';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import { STARTER_SETS } from '../../../shared/starterSets/index.js';
import type { QuestionSet } from '../../../shared/types.js';
import { db } from '../lib/db.js';
import { loadHostToken } from '../lib/hostTokens.js';
import { DIFFICULTY_LABELS } from '../lib/setLabels.js';
import { Landing } from './Landing.js';

const FIRST_VISIT = 1_700_000_000_000;

beforeEach(async () => {
  vi.spyOn(Date, 'now').mockReturnValue(FIRST_VISIT);
  await db.delete();
  await db.open();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function CurrentPath() {
  const location = useLocation();
  return <p data-testid="path">{location.pathname + location.search}</p>;
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

  it('says what Buzzr is in one line under the logo', () => {
    renderLanding();
    const explainer = screen.getByText(
      'A game-show buzzer: questions on the TV, buzzers on your phones',
    );
    expect(explainer.previousElementSibling).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('Host a game is a filled button of the same weight as Join', () => {
    const { join } = renderLanding();
    const host = screen.getByRole('button', { name: 'Host a game' });
    expect(host.className).toBe(join.className);
    expect(host.className).toContain('bg-accent');
  });

  it('Join and Host are two cards of the same weight, side by side from a tablet up (LND-01)', () => {
    const { join } = renderLanding();
    const joinCard = screen.getByRole('form', { name: 'Join a game' });
    const hostCard = screen.getByRole('region', { name: 'Host a game' });
    expect(joinCard.parentElement).toBe(hostCard.parentElement);
    expect(joinCard.parentElement!.className).toContain('md:grid-cols-2');
    expect(hostCard.className).toBe(joinCard.className);
    expect(
      within(hostCard).getByText('Questions on the TV, buzzers on everyone’s phone'),
    ).toBeTruthy();
    expect(within(hostCard).getByRole('link', { name: 'Question sets' })).toBeTruthy();
    expect(join.closest('[data-width]')!.getAttribute('data-width')).toBe('wide');
  });

  it('a disabled Join turns indigo with a muted label, not faded gold (LND-08)', () => {
    const { join } = renderLanding();
    expect(join.disabled).toBe(true);
    expect(join.className).toContain('disabled:bg-edge');
    expect(join.className).toContain('disabled:text-muted');
    expect(join.className).not.toContain('disabled:opacity');
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

  it('Preview shows the picked set with its answers, and Create room in it hosts that set', async () => {
    await db.sets.add(quiz);
    const fetch = stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    renderLanding();
    await openPicker();
    const hard = STARTER_SETS[2]!;
    // One Preview, in the summary, for the picked set (LND-02): the cards stay short.
    expect(screen.getAllByRole('button', { name: /^Preview/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^${hard.title}`) }));
    const summary = screen.getByRole('complementary', { name: 'Picked set' });
    fireEvent.click(within(summary).getByRole('button', { name: `Preview ${hard.title}` }));
    const preview = within(screen.getByRole('dialog', { name: hard.title }));
    expect(preview.getAllByRole('listitem')).toHaveLength(hard.questions.length);
    expect(preview.getByText(hard.questions[0]!.answer)).toBeTruthy();
    fireEvent.click(preview.getByRole('button', { name: 'Create room' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await screen.findByRole('heading', { name: 'Room created' });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((JSON.parse(init.body as string) as { set: QuestionSet }).set).toEqual(hard);
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

  it('the open picker replaces the Join card, in its place under the logo', async () => {
    renderLanding();
    const heading = await openPicker();
    expect(screen.queryByRole('form', { name: 'Join a game' })).toBeNull();
    expect(screen.queryByLabelText('Room code')).toBeNull();
    const picker = heading.closest('section')!;
    expect(picker.className).toContain('md:col-span-2');
    expect(picker.parentElement!.previousElementSibling?.querySelector('h1')).toBeTruthy();
  });

  it('the picker has Back on top and Build a game as an outline button with its hint (LND-04)', async () => {
    renderLanding();
    const heading = await openPicker();
    const picker = heading.closest('section')!;
    const back = within(picker).getByRole('button', { name: 'Back' });
    const build = within(picker).getByRole('button', { name: 'Build a game' });
    expect(within(picker).getAllByRole('button')[0]).toBe(back);
    expect(back.className).toContain('min-h-11');
    expect(build.className).toContain('border-accent');
    expect(build.className).toContain('min-h-11');
    expect(build.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(build.getAttribute('aria-describedby')!)!.textContent).toBe(
      'Mix categories or make a category board',
    );
  });

  it('the set list scrolls with the page: no box of its own (LND-02)', async () => {
    renderLanding();
    const heading = await openPicker();
    const picker = heading.closest('section')!;
    const radio = within(picker).getAllByRole('radio')[0]!;
    for (let el: Element | null = radio; el && el !== picker; el = el.parentElement) {
      expect(el.className).not.toMatch(/max-h-|overflow-y-auto/);
    }
  });

  it('the picked set and Create room stay in a sticky summary, which follows the pick (LND-03)', async () => {
    await db.sets.add(quiz);
    renderLanding();
    await openPicker();
    const summary = screen.getByRole('complementary', { name: 'Picked set' });
    expect(summary.className).toContain('sticky');
    expect(summary.className).toContain('lg:top-6');
    expect(within(summary).getByRole('button', { name: 'Create room' })).toBeTruthy();
    expect(summary.textContent).toContain('Pub quiz');
    expect(summary.textContent).toContain('8 questions');
    fireEvent.click(screen.getByRole('radio', { name: /^Animals – Easy/ }));
    expect(summary.textContent).toContain('Animals – Easy');
    expect(summary.textContent).toContain('Animals · 15 questions · Easy · Built-in');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search sets' }), {
      target: { value: 'movies' },
    });
    expect(summary.textContent).toContain('Pick a set');
  });

  it('the Join card stays hidden while building a game', async () => {
    renderLanding();
    await openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Build a game' }));
    await screen.findByRole('heading', { name: 'Build a game' });
    expect(screen.queryByRole('form', { name: 'Join a game' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the sets' }));
    expect(screen.queryByRole('form', { name: 'Join a game' })).toBeNull();
  });

  it('the created room keeps the Join card hidden', async () => {
    stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    await hostAGame();
    expect(screen.queryByRole('form', { name: 'Join a game' })).toBeNull();
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

  it('Back closes the picker and brings the Join card back', async () => {
    const { input } = renderLanding();
    fireEvent.change(input, { target: { value: 'wx' } });
    await openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('heading', { name: 'Pick a question set' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Host a game' })).toBeTruthy();
    expect(screen.getByRole('form', { name: 'Join a game' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Room code').value).toBe('WX');
  });

  it('stores the hostToken in localStorage under the room code', async () => {
    stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    await hostAGame();
    expect(loadHostToken('WXYZ')).toBe(hostToken);
  });

  it('This is the Screen opens /screen/<CODE>', async () => {
    stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    await hostAGame();
    fireEvent.click(screen.getByRole('button', { name: 'This is the Screen' }));
    expect(screen.getByTestId('path').textContent).toBe('/screen/WXYZ');
  });

  it('Host remote opens /host/<CODE> with no token in the URL', async () => {
    stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    await hostAGame();
    fireEvent.click(screen.getByRole('button', { name: 'Host remote' }));
    expect(screen.getByTestId('path').textContent).toBe('/host/WXYZ');
    expect(loadHostToken('WXYZ')).toBe(hostToken);
  });

  it('Phone only opens /host/<CODE>?read=1 with no token in the URL', async () => {
    stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    await hostAGame();
    fireEvent.click(screen.getByRole('button', { name: 'Phone only' }));
    expect(screen.getByTestId('path').textContent).toBe('/host/WXYZ?read=1');
    expect(loadHostToken('WXYZ')).toBe(hostToken);
  });

  it('Screen elsewhere shows the Screen URL and the code', async () => {
    stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    await hostAGame();
    const other = screen.getByRole('button', { name: 'Screen elsewhere' });
    expect(other.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(`${window.location.host}/screen/WXYZ`)).toBeNull();
    fireEvent.click(other);
    expect(other.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(`${window.location.host}/screen/WXYZ`)).toBeTruthy();
    expect(screen.getAllByText('WXYZ').length).toBeGreaterThan(1);
  });

  /** The option cards of Room created, in order: [title, its one-line explanation]. */
  function roomOptions() {
    return within(screen.getByRole('region', { name: 'Room created' }))
      .getAllByRole('button')
      .map((button) => [
        button.textContent!.replace(
          document.getElementById(button.getAttribute('aria-describedby')!)!.textContent!,
          '',
        ),
        document.getElementById(button.getAttribute('aria-describedby')!)!.textContent,
      ]);
  }

  it('on a touch screen, Room created offers Host remote first, in gold, then Phone only (LND-05)', async () => {
    stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    await hostAGame();
    expect(roomOptions()).toEqual([
      ['Host remote', 'Control the game from this phone'],
      ['Phone only', 'No TV: run everything from here'],
      ['This is the Screen', 'Show questions on this device'],
      ['Screen elsewhere', 'Open the Screen on a TV or laptop'],
    ]);
    expect(screen.getByRole('button', { name: 'Host remote' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Phone only' }).className).not.toContain('bg-accent');
  });

  it('with a mouse, Room created offers This is the Screen first, in gold (LND-05)', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: query === '(hover: hover) and (pointer: fine)',
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
    try {
      stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
      await hostAGame();
      expect(roomOptions().map(([title]) => title)).toEqual([
        'This is the Screen',
        'Screen elsewhere',
        'Host remote',
        'Phone only',
      ]);
      const region = screen.getByRole('region', { name: 'Room created' });
      expect(region.querySelector('.md\\:grid-cols-2')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'This is the Screen' }).className).toContain(
        'bg-accent',
      );
    } finally {
      Reflect.deleteProperty(window, 'matchMedia');
    }
  });

  /** Build a game with three rows: Animals, Science and World History, 3 each at one level. */
  function buildThreeByThree() {
    fireEvent.click(screen.getByRole('button', { name: 'Build a game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a row' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a row' }));
    const rows: [string, string][] = [
      ['Animals', 'easy'],
      ['Science', 'medium'],
      ['World History', 'hard'],
    ];
    rows.forEach(([category, difficulty], i) => {
      const change = (name: string, value: string) =>
        fireEvent.change(screen.getByRole('combobox', { name: `${name}, row ${i + 1}` }), {
          target: { value },
        });
      change('Category', category);
      change('Difficulty', difficulty);
      change('Questions', '3');
    });
  }

  it('Build a game hosts 3 categories × 3 questions as one Mixed set', async () => {
    const fetch = stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    renderLanding();
    await openPicker();
    buildThreeByThree();
    expect(screen.getByRole('heading', { name: 'Build a game' })).toBeTruthy();
    expect(screen.getByText('Total: 9 questions')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Host this game' }));
    await screen.findByRole('heading', { name: 'Room created' });
    const { set } = JSON.parse(
      (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    ) as { set: QuestionSet };
    expect(set).toMatchObject({
      title: 'Mixed: Animals, Science, World History',
      category: 'Mixed',
    });
    expect(set.questions.map((q) => q.points).sort()).toEqual([
      100, 100, 100, 200, 200, 200, 300, 300, 300,
    ]);
    expect(loadHostToken('WXYZ')).toBe(hostToken);
  });

  it('Build a game, Save to My sets puts the game first in the picker, picked', async () => {
    renderLanding();
    await openPicker();
    buildThreeByThree();
    fireEvent.click(screen.getByRole('button', { name: 'Save to My sets' }));
    await screen.findByRole('heading', { name: 'Pick a question set' });
    const first = screen.getAllByRole<HTMLInputElement>('radio')[0]!;
    expect(first.labels?.[0]?.textContent).toBe(
      'Mixed: Animals, Science, World History9 questions',
    );
    expect(first.checked).toBe(true);
    expect(await db.sets.count()).toBe(1);
  });

  it('Back to the sets returns from Build a game to the picker', async () => {
    renderLanding();
    await openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Build a game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to the sets' }));
    expect(screen.getByRole('heading', { name: 'Pick a question set' })).toBeTruthy();
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(0);
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
