// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetBuiltInSets } from '../lib/builtInSets.js';
import { serveSeededBuiltIns } from '../test/builtIns.js';
import { DEFAULT_SETTINGS } from '../../../shared/constants.js';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import { STARTER_SETS } from '../../../shared/starterSets/index.js';
import type { QuestionSet } from '../../../shared/types.js';
import { db } from '../lib/db.js';
import { loadHostToken } from '../lib/hostTokens.js';
import { Landing } from './Landing.js';

const FIRST_VISIT = 1_700_000_000_000;

beforeEach(async () => {
  serveSeededBuiltIns();
  vi.spyOn(Date, 'now').mockReturnValue(FIRST_VISIT);
  await db.delete();
  await db.open();
});

afterEach(() => {
  resetBuiltInSets();
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

  /** The radios' names, in order: one per tile and per level of a card. */
  const radioNames = (within_: HTMLElement = document.body) =>
    within(within_)
      .getAllByRole<HTMLInputElement>('radio')
      .map((radio) => radio.getAttribute('aria-label'));

  it('Host a game shows Your sets above Built-in, one card per category, the last edited set picked', async () => {
    await db.sets.add(quiz);
    renderLanding();
    await openPicker();
    const yours = screen.getByRole('group', { name: 'Your sets' });
    const builtIn = screen.getByRole('group', { name: 'Built-in' });
    expect(yours.compareDocumentPosition(builtIn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(radioNames(yours)).toEqual(['Pub quiz']);
    // The sample is a tile, then each category is one card with its three levels.
    expect(radioNames(builtIn)).toEqual([SAMPLE_SET.title, ...STARTER_SETS.map((s) => s.title)]);
    expect(within(builtIn).getAllByRole('group')).toHaveLength(20);
    const animals = within(builtIn).getByRole('group', { name: 'Animals' });
    expect(radioNames(animals)).toEqual(['Animals – Easy', 'Animals – Medium', 'Animals – Hard']);
    expect(animals.textContent).toContain('15 questions each');
    const radios = screen.getAllByRole<HTMLInputElement>('radio');
    expect(radios.map((r) => r.checked)).toEqual([true, ...STARTER_SETS.map(() => false), false]);
  });

  it('with no sets in this browser, there is no Your sets section', async () => {
    renderLanding();
    await openPicker();
    expect(screen.queryByRole('group', { name: 'Your sets' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Built-in' })).toBeTruthy();
  });

  it("each card and tile shows its emoji: the category's stored one, the keyword map, 🎲 and 📝", async () => {
    await db.sets.add(quiz);
    await db.sets.add({ ...quiz, id: 'lola', title: "Lola's 80th", category: undefined });
    resetBuiltInSets({
      sets: [SAMPLE_SET, ...STARTER_SETS.slice(0, 6)],
      sampleHidden: true,
      categoryEmoji: { animals: '🦉' },
    });
    renderLanding();
    await openPicker();
    const itemOf = (name: string) =>
      screen.getByRole('radio', { name }).closest('label, [role="group"]')!.textContent;
    expect(within(screen.getByRole('group', { name: 'Animals' })).getByText('🦉')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Movies' })).getByText('🎬')).toBeTruthy();
    expect(itemOf(SAMPLE_SET.title)).toContain('🎲');
    expect(itemOf('Pub quiz')).toContain('🧠');
    expect(itemOf("Lola's 80th")).toContain('📝');
    // No colours per category: every unpicked card has the same plain look.
    const cards = within(screen.getByRole('group', { name: 'Built-in' })).getAllByRole('group');
    expect(new Set(cards.map((card) => card.className)).size).toBe(1);
  });

  it('a click on a card picks Medium at first, then the last level used, else the nearest', async () => {
    const [easy, , hard] = STARTER_SETS;
    resetBuiltInSets({
      sets: [...STARTER_SETS.slice(3, 6), easy!, hard!],
      sampleHidden: true,
      categoryEmoji: {},
    });
    renderLanding();
    await openPicker();
    const checked = () =>
      screen
        .getAllByRole<HTMLInputElement>('radio')
        .find((r) => r.checked)
        ?.getAttribute('aria-label');
    const movies = screen.getByRole('group', { name: 'Movies' });
    const animals = screen.getByRole('group', { name: 'Animals' });
    fireEvent.click(within(animals).getByText('Animals'));
    // Animals has no Medium: the nearest, the easier on a tie.
    expect(checked()).toBe('Animals – Easy');
    fireEvent.click(within(movies).getByText('Movies'));
    expect(checked()).toBe('Movies – Medium');
    fireEvent.click(within(movies).getByRole('radio', { name: 'Movies – Hard' }));
    expect(checked()).toBe('Movies – Hard');
    fireEvent.click(within(animals).getByText('Animals'));
    expect(checked()).toBe('Animals – Hard');
    expect(screen.getByRole('complementary', { name: 'Picked set' }).textContent).toContain('Hard');
  });

  it('levels read E, M and H on a phone, with the set title as their names', async () => {
    renderLanding();
    await openPicker();
    const label = screen.getByRole('radio', { name: 'Animals – Easy' }).closest('label')!;
    const [short, long] = label.querySelectorAll('span');
    expect(short!.textContent).toBe('E');
    expect(short!.className).toContain('@min-[13rem]/card:hidden');
    expect(long!.textContent).toBe('Easy');
    expect(long!.className).toContain('hidden @min-[13rem]/card:inline');
    expect(label.className).toContain('min-h-11');
    expect(label.className).toContain('min-w-11');
  });

  it('a My set and a built-in with the same id both list, and Create room hosts the picked one', async () => {
    await db.sets.add(quiz);
    const twin: QuestionSet = { ...STARTER_SETS[0]!, id: quiz.id, title: 'Server twin' };
    resetBuiltInSets({ sets: [twin], sampleHidden: true, categoryEmoji: {} });
    const fetch = stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    renderLanding();
    await openPicker();
    const radios = screen.getAllByRole<HTMLInputElement>('radio');
    expect(radioNames()).toEqual(['Pub quiz', 'Server twin']);
    fireEvent.click(radios[1]!);
    expect(radios.map((r) => r.checked)).toEqual([false, true]);
    fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
    await screen.findByRole('heading', { name: 'Room created' });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((JSON.parse(init.body as string) as { set: QuestionSet }).set).toEqual(twin);
  });

  it("when the built-ins fail to load, the picker still hosts this browser's set", async () => {
    await db.sets.add(quiz);
    resetBuiltInSets();
    const fetch = vi.fn(async (url: string) =>
      url === '/api/built-in-sets'
        ? Response.json({ error: 'Down' }, { status: 503 })
        : Response.json({ code: 'WXYZ', hostToken }, { status: 201 }),
    );
    vi.stubGlobal('fetch', fetch);
    renderLanding();
    await openPicker();
    expect(screen.getByRole('alert').textContent).toContain("Couldn't load the built-in sets.");
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).checked)).toEqual([
      true,
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
    await screen.findByRole('heading', { name: 'Room created' });
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

  it('the toolbar is search only, and Enter picks the one card left at Medium', async () => {
    await db.sets.add(quiz);
    renderLanding();
    await openPicker();
    expect(screen.queryByRole('group', { name: 'Difficulty' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Easy' })).toBeNull();
    const search = screen.getByRole('searchbox', { name: 'Search sets' });
    fireEvent.change(search, { target: { value: 'animal' } });
    expect(radioNames()).toEqual(['Animals – Easy', 'Animals – Medium', 'Animals – Hard']);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Animals – Medium' }).checked).toBe(
      true,
    );
  });

  it('picks Animals – Easy by search and its level, then hosts it', async () => {
    await db.sets.add(quiz);
    const fetch = stubCreateRoom(Response.json({ code: 'WXYZ', hostToken }, { status: 201 }));
    renderLanding();
    await openPicker();
    const search = screen.getByRole('searchbox', { name: 'Search sets' });
    fireEvent.change(search, { target: { value: 'animal' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Animals – Easy' }));
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

  it('the picker has Back on top and Build a game as a dashed last tile with its hint (LND-04)', async () => {
    renderLanding();
    const heading = await openPicker();
    const picker = heading.closest('section')!;
    const back = within(picker).getByRole('button', { name: 'Back' });
    const build = within(picker).getByRole('button', { name: 'Build a game' });
    expect(within(picker).getAllByRole('button')[0]).toBe(back);
    expect(back.className).toContain('min-h-11');
    expect(build.className).toContain('border-dashed');
    // The grid's last tile, after the last card, not in the header.
    expect(build.parentElement!.lastElementChild).toBe(build);
    expect(build.previousElementSibling!.getAttribute('role')).toBe('group');
    expect(heading.parentElement!.contains(build)).toBe(false);
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
    expect(summary.textContent).toContain('Your set');
    expect(summary.textContent).toContain('Pub quiz');
    expect(summary.textContent).toContain('8 questions');
    fireEvent.click(screen.getByRole('radio', { name: 'Animals – Easy' }));
    // The ticket: emoji, kicker, the category as its title, then the level (gold) and the count.
    expect(summary.textContent).toContain('🐾');
    expect(summary.textContent).toContain('Built-in category');
    expect(within(summary).getAllByText('Animals')).toHaveLength(1);
    const chips = within(summary).getAllByRole('listitem');
    expect(chips.map((chip) => chip.textContent)).toEqual(['Easy', '15 questions']);
    expect(chips[0]!.className).toContain('text-accent');
    // The phone's bar has the same in one line, under the title.
    expect(summary.textContent).toContain('Easy · 15 questions');
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
      expect(region.querySelector('.\\@xl\\/room\\:grid-cols-2')).toBeTruthy();
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
    expect(first.getAttribute('aria-label')).toBe('Mixed: Animals, Science, World History');
    expect(first.closest('label')!.textContent).toContain('9 questions');
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
