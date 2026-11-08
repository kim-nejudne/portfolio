// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import L from 'leaflet';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_ENDED_ERROR } from '#shared/constants.js';
import type { FinalPass, FinalView, PublicPlayer, RoundResult, ScreenView } from '#shared/types.js';
import { useRoomStore } from '../lib/roomStore.js';
import { resetSounds, startSounds } from '../lib/sounds.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { Screen, stageScale } from './Screen.js';

// Howler, faked: every sound the Screen plays lands in `played`.
const audio = vi.hoisted(() => ({
  played: [] as string[],
  resume: async () => {},
  ctx: { state: 'suspended', resume: () => audio.resume() },
}));
vi.mock('howler', () => ({
  Howler: { volume: () => {}, ctx: audio.ctx },
  Howl: class {
    name: string;
    constructor(o: { src: string[] }) {
      this.name = /(\w+)\.wav$/.exec(o.src[0]!)![1]!;
    }
    play() {
      audio.played.push(this.name);
      return 1;
    }
    stop() {}
  },
}));

const NOW = 1_800_000_000_000;

function lobbyView(players: PublicPlayer[] = [], overrides: Partial<ScreenView> = {}): ScreenView {
  return {
    role: 'screen',
    serverNow: NOW + 2500,
    code: 'WXYZ',
    joinUrl: 'https://pinpoint.kimnejudne.dev/play/WXYZ',
    phase: 'LOBBY',
    players,
    settings: { categoryId: '', mode: 'name', difficulty: 'mixed', rounds: 10, timerSeconds: 30 },
    categoryName: null,
    hasCategories: true,
    paused: null,
    rematchAt: null,
    region: null,
    round: null,
    reveal: null,
    standings: null,
    final: null,
    ...overrides,
  };
}

function player(id: string, name: string, emoji: string, isVip = false): PublicPlayer {
  return {
    id,
    name,
    emoji,
    color: '#00A0F8',
    connected: true,
    waiting: false,
    isVip,
    total: 0,
    rank: 1,
  };
}

let socket: FakeSocket;

function renderScreen() {
  socket = new FakeSocket();
  render(
    <MemoryRouter initialEntries={['/screen/wxyz']}>
      <Routes>
        <Route path="/screen/:code" element={<Screen makeSocket={() => socket.asSocket()} />} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** An element's text with each flap row read as its label, since the cells are mid-flip. */
function flapText(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  for (const row of copy.querySelectorAll('.board-face[role="img"]'))
    row.replaceWith(row.getAttribute('aria-label') ?? '');
  return copy.textContent ?? '';
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  resetSounds(); // an earlier test's Click to start may have finished loading after its cleanup
});

afterEach(() => {
  cleanup();
  resetSounds();
  audio.played.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Screen', () => {
  it('joins the room as a Screen with the upper-cased code', () => {
    renderScreen();
    expect(socket.emitted.map((e) => [e.event, e.payload])).toEqual([
      ['screen:join', { code: 'WXYZ' }],
    ]);
  });

  it('shows the empty lobby: code, QR, join URL, waiting line and join strip', () => {
    renderScreen();
    socket.fire('state', lobbyView());
    expect(screen.getByRole('img', { name: 'Room code WXYZ' })).toBeTruthy();
    expect(screen.getByTitle('Join at https://pinpoint.kimnejudne.dev/play/WXYZ')).toBeTruthy();
    expect(screen.getByText('https://pinpoint.kimnejudne.dev/play/WXYZ')).toBeTruthy();
    expect(screen.getByText('Waiting for the first player: they’ll be the VIP')).toBeTruthy();
    expect(screen.getByText('Join at pinpoint.kimnejudne.dev · code WXYZ')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Players' })).toBeNull();
  });

  it('shows a tile per player with the ★ only on the VIP', () => {
    renderScreen();
    socket.fire(
      'state',
      lobbyView([
        player('a', 'Mika', '🦊', true),
        player('b', 'Sam', '🐙'),
        player('c', 'Noor', '🐢'),
      ]),
    );
    const tiles = within(screen.getByRole('list', { name: 'Players' })).getAllByRole('listitem');
    expect(tiles.map((t) => t.textContent)).toEqual(['🦊★Mika', '🐙Sam', '🐢Noor']);
    expect(within(tiles[0]!).getByLabelText('VIP')).toBeTruthy();
    expect(within(tiles[1]!).queryByLabelText('VIP')).toBeNull();
    expect(screen.queryByText(/Waiting for the first player/)).toBeNull();
  });

  it('shows the settings departures row with the category, or the no-destinations line', () => {
    renderScreen();
    const settings = { ...lobbyView().settings, categoryId: 'world' };
    socket.fire('state', lobbyView([], { settings, categoryName: 'World' }));
    expect(screen.getByLabelText('Settings').textContent).toBe(
      'WORLD · NAME · MIXED · 10 ROUNDS · 30 S',
    );
    socket.fire('state', lobbyView([], { hasCategories: false }));
    expect(screen.getByLabelText('Settings').textContent).toBe(
      'No destinations yet. Check back soon.',
    );
  });

  it("wiggles only the practising player's tile, again on each practice", () => {
    renderScreen();
    socket.fire('state', lobbyView([player('a', 'Mika', '🦊', true), player('b', 'Sam', '🐙')]));
    const wiggling = () =>
      [...document.querySelectorAll('[data-wiggle]')].map((el) => el.textContent);
    expect(wiggling()).toEqual([]);
    socket.fire('fx', { kind: 'practice', playerId: 'b' });
    expect(wiggling()).toEqual(['🐙']);
    const first = document.querySelector('[data-wiggle]');
    socket.fire('fx', { kind: 'practice', playerId: 'b' });
    // A fresh element replays the animation.
    expect(document.querySelector('[data-wiggle]')).not.toBe(first);
    socket.fire('fx', { kind: 'join', playerId: 'a' });
    expect(wiggling()).toEqual([]);
  });

  it('keeps the server clock offset from the latest snapshot', () => {
    renderScreen();
    socket.fire('state', lobbyView());
    expect(useRoomStore.getState().clockOffset).toBe(2500);
  });

  it('Click to start requests fullscreen and goes away', () => {
    const requestFullscreen = vi.fn(async () => {});
    document.documentElement.requestFullscreen = requestFullscreen;
    renderScreen();
    socket.fire('state', lobbyView());
    fireEvent.click(screen.getByRole('button', { name: /Click to start/ }));
    expect(requestFullscreen).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Click to start' })).toBeNull();
  });

  it('Click to start unlocks audio and requests a Screen Wake Lock', async () => {
    const request = vi.fn(async () => ({ released: false, release: async () => {} }));
    vi.stubGlobal('navigator', { ...navigator, wakeLock: { request } });
    const resume = vi.spyOn(audio, 'resume');
    renderScreen();
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Click to start/ }));
    expect(request).toHaveBeenCalledWith('screen');
    await vi.waitFor(() => expect(resume).toHaveBeenCalled());
  });

  it('shows "This game has ended" with a link home when the room closes', () => {
    renderScreen();
    socket.fire('state', lobbyView());
    socket.fire('room:closed', { reason: 'expired' });
    expect(screen.getByRole('heading', { name: GAME_ENDED_ERROR })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Back to Pinpoint' }));
    expect(screen.getByText('home')).toBeTruthy();
  });

  it('shows "This game has ended" when the server refuses an unknown room', () => {
    renderScreen();
    act(() => socket.emitted[0]!.ack({ ok: false, error: GAME_ENDED_ERROR }));
    expect(screen.getByRole('heading', { name: GAME_ENDED_ERROR })).toBeTruthy();
  });

  it('pops each lobby tile in as its player joins', () => {
    renderScreen();
    socket.fire('state', lobbyView([player('a', 'Mika', '🦊', true)]));
    const tiles = within(screen.getByRole('list', { name: 'Players' })).getAllByRole('listitem');
    expect(tiles[0]!.className).toContain('tile-pop');
  });

  it('M cycles Sound, Quiet and Muted, stored on this device, and says so for 1.5 s', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      localStorage.clear();
      renderScreen();
      socket.fire('state', lobbyView());
      const press = (key: string) => fireEvent.keyDown(window, { key });
      press('m');
      expect(screen.getByText('Quiet').getAttribute('role')).toBe('status');
      expect(localStorage.getItem('pinpoint:sound')).toBe('Quiet');
      press('M');
      expect(screen.getByText('Muted')).toBeTruthy();
      press('m');
      expect(localStorage.getItem('pinpoint:sound')).toBe('Sound');
      act(() => void vi.advanceTimersByTime(1500));
      expect(screen.queryByText('Sound')).toBeNull();
      // A held key or a browser shortcut does nothing.
      fireEvent.keyDown(window, { key: 'm', repeat: true });
      fireEvent.keyDown(window, { key: 'm', ctrlKey: true });
      expect(localStorage.getItem('pinpoint:sound')).toBe('Sound');
    } finally {
      vi.useRealTimers();
      localStorage.clear();
    }
  });

  it('F toggles fullscreen', () => {
    const requestFullscreen = vi.fn(async () => {});
    const exitFullscreen = vi.fn(async () => {});
    document.documentElement.requestFullscreen = requestFullscreen;
    document.exitFullscreen = exitFullscreen;
    renderScreen();
    fireEvent.keyDown(window, { key: 'f' });
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => document.documentElement,
    });
    try {
      fireEvent.keyDown(window, { key: 'F' });
      expect(exitFullscreen).toHaveBeenCalledTimes(1);
      expect(requestFullscreen).toHaveBeenCalledTimes(1);
    } finally {
      delete (document as { fullscreenElement?: unknown }).fullscreenElement;
    }
  });

  it('? shows and hides the key list; Escape hides it', () => {
    renderScreen();
    socket.fire('state', lobbyView());
    expect(screen.queryByRole('region', { name: 'Keys' })).toBeNull();
    fireEvent.keyDown(window, { key: '?' });
    const keys = screen.getByRole('region', { name: 'Keys' });
    expect([...keys.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual(['M', 'F', '?']);
    expect(keys.textContent).toContain('Sound / Quiet / Muted');
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.queryByRole('region', { name: 'Keys' })).toBeNull();
    fireEvent.keyDown(window, { key: '?' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Keys' })).toBeNull();
  });

  it('scales the 1920 × 1080 stage to fit, letterboxed', () => {
    expect(stageScale(1920, 1080)).toBe(1);
    expect(stageScale(1280, 720)).toBeCloseTo(2 / 3);
    expect(stageScale(1920, 1200)).toBe(1); // a taller window: bars top and bottom
  });
});

const MIKA = player('a', 'Mika', '🦊', true);
const SAM = player('b', 'Sam', '🐙');
const NOOR = player('c', 'Noor', '🐢');
const IVY = player('d', 'Ivy', '🐸');
const PLAYERS = [MIKA, SAM, NOOR, IVY];
const OFFSET = 2500; // serverNow − Date.now() in every fixture
const ROUND = {
  number: 3,
  total: 10,
  multiplier: 1 as const,
  endsAt: null,
  gate: 'nowBoarding' as const,
  lockedIn: [],
  prompt: { kind: 'name' as const, displayName: 'Ciudad del Este, Paraguay' },
};
const REGION = { box: { south: -35, west: -82, north: 13, east: -34 }, scale: 6000 };

function gameView(overrides: Partial<ScreenView>): ScreenView {
  return lobbyView(PLAYERS, { region: REGION, round: ROUND, ...overrides });
}

function row(
  playerId: string,
  distanceKm: number | null,
  extra: Partial<RoundResult> = {},
): RoundResult {
  return {
    playerId,
    position: distanceKm === null ? null : { lat: -12 - distanceKm / 200, lng: -77 },
    lockedIn: distanceKm !== null,
    distanceKm,
    basePoints: distanceKm === null ? 0 : 500,
    bullseye: false,
    multiplier: 1,
    points: distanceKm === null ? 0 : 500,
    ...extra,
  };
}

// Reveal order: farthest first, the missed row last.
const RESULTS = [
  row('b', 1240.4, { basePoints: 300, points: 450, multiplier: 1.5 }),
  row('c', 4.24, { lockedIn: false, basePoints: 990, points: 1485, multiplier: 1.5 }),
  row('a', 0.31, { basePoints: 1000, points: 1500, multiplier: 1.5, bullseye: true }),
  row('d', null),
];

function revealView(revealStage: 'pins' | 'target' | 'lines', revealedCount: number): ScreenView {
  return gameView({
    phase: 'REVEAL',
    round: { ...ROUND, multiplier: 1.5, gate: 'boarding' },
    reveal: {
      place: {
        name: 'Lima',
        displayName: 'Lima, Peru',
        fact: 'Lima was founded by Francisco Pizarro in 1535.',
        position: { lat: -12.05, lng: -77.04 },
        credit: null,
        photoUrl: null,
      },
      results: RESULTS,
      revealStage,
      revealedCount,
    },
  });
}

/** The rail rows' text with each count-up at its settled value. */
const railText = () =>
  within(screen.getByRole('list', { name: 'Results' }))
    .queryAllByRole('listitem')
    .map((li) => {
      const copy = li.cloneNode(true) as HTMLElement;
      for (const n of copy.querySelectorAll<HTMLElement>('[data-final]'))
        n.textContent = n.dataset.final!;
      return copy.textContent;
    });

describe('Screen game views', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 })),
    );
  });

  it('Intro: the gate label at the centre, and the multiplier row only on a boosted round', () => {
    renderScreen();
    socket.fire('state', gameView({ phase: 'INTRO' }));
    expect(screen.getByRole('heading', { name: 'Round 3/10 · Now boarding' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: /Bonus round|Final round/ })).toBeNull();
    socket.fire(
      'state',
      gameView({ phase: 'INTRO', round: { ...ROUND, number: 10, multiplier: 2 } }),
    );
    expect(screen.getByRole('heading', { name: 'Round 10/10 · ×2 · Now boarding' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '×2 Final round' })).toBeTruthy();
  });

  it('Guessing: gate label, the city in flaps, tiles turning LOCKED IN, and no map', () => {
    renderScreen();
    const guessing = { ...ROUND, gate: 'boarding' as const, endsAt: NOW + OFFSET + 20_000 };
    socket.fire('state', gameView({ phase: 'GUESSING', round: guessing }));
    expect(screen.getByRole('img', { name: 'Round 3/10 · Boarding' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Ciudad del Este, Paraguay' })).toBeTruthy();
    const lockedIn = () =>
      [...document.querySelectorAll('[data-locked-in]')].map((el) => el.textContent);
    expect(lockedIn()).toEqual([]);
    socket.fire('state', gameView({ phase: 'GUESSING', round: { ...guessing, lockedIn: ['b'] } }));
    expect(lockedIn()).toEqual(['🐙SamLocked in']);
    expect(document.querySelector('.leaflet-container')).toBeNull();
  });

  it('Guessing, Picture: the photo contained in the 1500 × 820 frame with the credit, the gate label and timer beside it', () => {
    renderScreen();
    const picture = {
      ...ROUND,
      gate: 'boarding' as const,
      endsAt: NOW + OFFSET + 20_000,
      prompt: {
        kind: 'picture' as const,
        photoUrl: '/api/photos/tok123',
        credit: 'Photo: Jane Doe · CC BY-SA 4.0',
      },
    };
    socket.fire('state', gameView({ phase: 'GUESSING', round: picture }));
    const photo = screen.getByRole('img', { name: 'The photo to find' }) as HTMLImageElement;
    expect(photo.getAttribute('src')).toBe('/api/photos/tok123');
    expect(photo.className).toContain('object-contain'); // never cropped
    const frame = photo.parentElement!;
    expect(frame.className).toContain('h-[820px]');
    expect(frame.className).toContain('border-2 border-line');
    expect(frame.parentElement!.className).toContain('w-[1500px]');
    expect(screen.getByText('Photo: Jane Doe · CC BY-SA 4.0').tagName).toBe('FIGCAPTION');
    expect(screen.getByRole('img', { name: 'Round 3/10 · Boarding' })).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toBe('20');
    expect(document.querySelectorAll('[data-locked-in]')).toHaveLength(0);
    expect(screen.getAllByRole('listitem')).toHaveLength(4); // the compact tiles
  });

  it('Guessing, Picture: a photo that fails to load shows the "Photo unavailable" card', () => {
    renderScreen();
    const picture = {
      ...ROUND,
      gate: 'boarding' as const,
      prompt: { kind: 'picture' as const, photoUrl: '/api/photos/gone', credit: 'Photo: x · CC0' },
    };
    socket.fire('state', gameView({ phase: 'GUESSING', round: picture }));
    fireEvent.error(screen.getByRole('img', { name: 'The photo to find' }));
    expect(screen.queryByRole('img', { name: 'The photo to find' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Photo unavailable' })).toBeTruthy();
    // The next round's photo is tried afresh.
    socket.fire(
      'state',
      gameView({
        phase: 'GUESSING',
        round: { ...picture, prompt: { ...picture.prompt, photoUrl: '/api/photos/next' } },
      }),
    );
    expect(screen.getByRole('img', { name: 'The photo to find' })).toBeTruthy();
  });

  it('Guessing: the timer counts from endsAt on the server clock, red with "Final call" in the last 5 s', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      renderScreen();
      // 12 s left on the server's clock, which runs 2.5 s ahead of this device's.
      const round = { ...ROUND, gate: 'boarding' as const, endsAt: NOW + OFFSET + 12_000 };
      socket.fire('state', gameView({ phase: 'GUESSING', round }));
      const timer = () => screen.getByRole('timer');
      act(() => vi.advanceTimersByTime(250));
      expect(timer().textContent).toBe('12');
      expect(timer().className).not.toContain('text-delayed');

      vi.mocked(Date.now).mockReturnValue(NOW + 7_500);
      act(() => vi.advanceTimersByTime(250));
      expect(timer().textContent).toBe('5');
      expect(timer().className).toContain('text-delayed');
      const finalCall = screen.getByRole('img', { name: 'Round 3/10 · Final call' });
      expect(finalCall.className).toContain('text-delayed');

      vi.mocked(Date.now).mockReturnValue(NOW + 20_000);
      act(() => vi.advanceTimersByTime(250));
      expect(timer().textContent).toBe('0');
    } finally {
      vi.useRealTimers();
    }
  });

  it('Paused: "Delayed" in red, the timer stopped, the banner, then the 3-2-1', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      renderScreen();
      const round = { ...ROUND, gate: 'delayed' as const, endsAt: NOW + OFFSET + 12_000 };
      const paused = { reasons: ['vip' as const], since: NOW + OFFSET + 2_000, resumeAt: null };
      socket.fire('state', gameView({ phase: 'GUESSING', round, paused }));
      const label = screen.getByRole('img', { name: 'Round 3/10 · Delayed' });
      expect(label.className).toContain('text-delayed');
      expect(screen.getByRole('status').textContent).toBe('Delayed · the VIP paused the game');
      act(() => vi.advanceTimersByTime(250));
      expect(screen.getByRole('timer').textContent).toBe('10');
      vi.mocked(Date.now).mockReturnValue(NOW + 30_000);
      act(() => vi.advanceTimersByTime(250));
      expect(screen.getByRole('timer').textContent).toBe('10');

      // The last reason cleared: the banner gives way to the 3-2-1.
      // Every fixture's serverNow is NOW + OFFSET, received now at NOW + 30 s.
      const resumeAt = NOW + OFFSET + 3_000;
      socket.fire(
        'state',
        gameView({ phase: 'GUESSING', round, paused: { ...paused, reasons: [], resumeAt } }),
      );
      expect(screen.queryByText('Delayed · the VIP paused the game')).toBeNull();
      expect(screen.getByRole('img', { name: 'Resuming in 3' })).toBeTruthy();
      vi.mocked(Date.now).mockReturnValue(NOW + 31_500);
      act(() => vi.advanceTimersByTime(250));
      expect(screen.getByRole('img', { name: 'Resuming in 2' })).toBeTruthy();
      expect(screen.getByRole('timer').textContent).toBe('10');
    } finally {
      vi.useRealTimers();
    }
  });

  it('Paused by screenAway only: no banner on the Screen', () => {
    renderScreen();
    const paused = { reasons: ['screenAway' as const], since: NOW + OFFSET, resumeAt: null };
    socket.fire('state', gameView({ phase: 'SCOREBOARD', paused }));
    expect(screen.queryByText('Delayed · the VIP paused the game')).toBeNull();
  });

  it('Reveal: pins first, then the name, fact and target, then the rail fills in order', () => {
    renderScreen();
    socket.fire('state', revealView('pins', 0));
    const map = screen.getByRole('img', { name: 'Map of the guesses' });
    expect(document.querySelectorAll('.pin-marker')).toHaveLength(3); // the missed player has no pin
    expect(document.querySelector('.reveal-target')).toBeNull();
    expect(screen.queryByText(/Francisco Pizarro/)).toBeNull();
    expect(railText()).toEqual([]);

    socket.fire('state', revealView('target', 0));
    expect(screen.getByRole('img', { name: 'Lima, Peru' })).toBeTruthy();
    expect(screen.getByText('Lima was founded by Francisco Pizarro in 1535.')).toBeTruthy();
    expect(document.querySelector('.reveal-target')).toBeTruthy();
    expect(map.dataset.lines).toBe('0');
    expect(railText()).toEqual([]);

    socket.fire('state', revealView('lines', 1));
    expect(railText()).toEqual(['3🐙Sam1,240 km×1.5 → 450']);
    expect(map.dataset.lines).toBe('1');

    socket.fire('state', revealView('lines', 2));
    expect(railText()).toEqual([
      '3🐙Sam1,240 km×1.5 → 450',
      '2🐢NoorNot locked in4.2 km×1.5 → 1,485',
    ]);

    // The last step: the closest player, then the missed one with "—".
    socket.fire('state', revealView('lines', 3));
    expect(railText()).toEqual([
      '3🐙Sam1,240 km×1.5 → 450',
      '2🐢NoorNot locked in4.2 km×1.5 → 1,485',
      '1🦊MikaBullseyeClosest0.3 km×1.5 → 1,500',
      '🐸Ivy—',
    ]);
    expect(map.dataset.lines).toBe('3');
  });

  it('Reveal: pins drop 60 ms apart once, and each line draws once', () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    try {
      const drops = () =>
        [...document.querySelectorAll<HTMLElement>('.pin-drop')]
          .map((p) => parseFloat(p.style.animationDelay))
          .sort((a, b) => a - b);
      renderScreen();
      socket.fire('state', revealView('pins', 0));
      expect(drops()).toEqual([0, 60, 120]);

      // A rebuild mid-drop resumes each pin where it is (negative delays run it part-way in).
      vi.advanceTimersByTime(100);
      socket.fire('state', revealView('target', 0));
      expect(drops()).toEqual([-100, -40, 20]);

      vi.advanceTimersByTime(500);
      socket.fire('state', revealView('lines', 1));
      expect(document.querySelectorAll('.pin-marker')).toHaveLength(3);
      expect(drops()).toEqual([]); // no second drop
      const drawing = document.querySelectorAll('path.reveal-line-draw');
      expect(drawing).toHaveLength(1);
      expect(drawing[0]!.getAttribute('pathLength')).toBe('1');

      vi.advanceTimersByTime(500);
      socket.fire('state', revealView('lines', 2));
      expect(document.querySelectorAll('path')).toHaveLength(2);
      expect(document.querySelectorAll('path.reveal-line-draw')).toHaveLength(1); // only the new one
    } finally {
      vi.useRealTimers();
    }
  });

  it('Reveal, Picture: the 240 px thumbnail and the full credit beside the name and fact', () => {
    renderScreen();
    const view = revealView('target', 0);
    view.reveal!.place = {
      ...view.reveal!.place,
      credit: 'Photo: Jane Doe, CC BY-SA 4.0, via Wikimedia Commons',
      photoUrl: '/api/photos/tok123',
    };
    socket.fire('state', view);
    const thumb = screen.getByRole('img', { name: 'Photo of Lima' });
    expect(thumb.getAttribute('src')).toBe('/api/photos/tok123/thumb');
    expect(thumb.parentElement!.className).toContain('w-[240px]');
    expect(screen.getByText('Photo: Jane Doe, CC BY-SA 4.0, via Wikimedia Commons')).toBeTruthy();
    // Name mode has neither.
    socket.fire('state', revealView('target', 0));
    expect(screen.queryByRole('img', { name: 'Photo of Lima' })).toBeNull();
    expect(screen.queryByText(/via Wikimedia Commons/)).toBeNull();
  });

  it('Reveal: the map fits the target and every pin with 80 px padding, never past zoom 11', () => {
    const fit = vi.spyOn(L.Map.prototype, 'fitBounds');
    renderScreen();
    socket.fire('state', revealView('pins', 0));
    const [bounds, options] = fit.mock.calls.at(-1)!;
    const b = bounds as L.LatLngBounds; // RevealMap passes an L.LatLngBounds
    expect([b.getSouth(), b.getNorth()]).toEqual([-12 - 1240.4 / 200, -12 - 0.31 / 200]);
    expect(options).toMatchObject({ padding: [80, 80], maxZoom: 11 });
  });

  it('Reveal: a long name wraps into 22-cell flap rows', () => {
    renderScreen();
    const view = revealView('target', 0);
    view.reveal!.place.displayName = 'Santiago de Compostela, Spain';
    socket.fire('state', view);
    const name = screen.getByRole('img', { name: 'Santiago de Compostela, Spain' });
    expect([...name.children].map((row) => row.getAttribute('data-row'))).toEqual([
      'Santiago de',
      'Compostela, Spain',
    ]);
  });

  it('Reveal: a ×1 round shows "+points"', () => {
    renderScreen();
    const view = revealView('lines', 1);
    view.reveal!.results = [row('b', 812)];
    socket.fire('state', view);
    expect(railText()).toEqual(['1🐙SamClosest812 km+500']);
  });

  it("Reveal: a row's points count up from 0 over 600 ms", () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    try {
      renderScreen();
      const view = revealView('lines', 1);
      view.reveal!.results = [row('b', 812)];
      socket.fire('state', view);
      const points = () => document.querySelector('[data-count]')!.textContent;
      expect(points()).toBe('0');
      act(() => vi.advanceTimersByTime(300));
      expect(Number(points())).toBeGreaterThan(0);
      expect(Number(points())).toBeLessThan(500);
      act(() => vi.advanceTimersByTime(400));
      expect(points()).toBe('500');
    } finally {
      vi.useRealTimers();
    }
  });

  it('moves the ★ on the board row and the tile when VIP passes', () => {
    renderScreen();
    const standings = [
      { playerId: 'a', rank: 1, total: 900, roundPoints: 900, movement: 0 },
      { playerId: 'b', rank: 2, total: 500, roundPoints: 500, movement: 0 },
    ];
    const starred = () =>
      within(screen.getByRole('list', { name: 'Standings' }))
        .getAllByRole('listitem')
        .map((li) => within(li).queryByLabelText('VIP') !== null);
    socket.fire('state', gameView({ phase: 'SCOREBOARD', standings }));
    expect(starred()).toEqual([true, false]);
    const handedOff = [{ ...MIKA, isVip: false }, { ...SAM, isVip: true }, NOOR, IVY];
    socket.fire('state', gameView({ phase: 'SCOREBOARD', standings, players: handedOff }));
    expect(starred()).toEqual([false, true]);
    // And on the tiles, back in the lobby.
    socket.fire('state', lobbyView(handedOff));
    const tiles = within(screen.getByRole('list', { name: 'Players' })).getAllByRole('listitem');
    expect(tiles.map((t) => within(t).queryByLabelText('VIP') !== null)).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it('keeps a disconnected player on the board, greyed, with their score', () => {
    renderScreen();
    const standings = [
      { playerId: 'a', rank: 1, total: 900, roundPoints: 0, movement: 0 },
      { playerId: 'b', rank: 2, total: 500, roundPoints: 500, movement: 0 },
    ];
    const gone = [{ ...MIKA, connected: false }, SAM, NOOR, IVY];
    socket.fire('state', gameView({ phase: 'SCOREBOARD', standings, players: gone }));
    const [mika, sam] = within(screen.getByRole('list', { name: 'Standings' })).getAllByRole(
      'listitem',
    );
    expect(flapText(mika!)).toBe('1🦊Mika★(disconnected)+0900');
    expect(mika!.className).toContain('grayscale');
    expect(sam!.className).not.toContain('grayscale');
  });

  it('Scoreboard: rank, emoji, name, round points, total and movement', () => {
    renderScreen();
    const standings = [
      { playerId: 'c', rank: 1, total: 2485, roundPoints: 1485, movement: 2 },
      { playerId: 'a', rank: 2, total: 2000, roundPoints: 1500, movement: 0 },
      { playerId: 'b', rank: 2, total: 2000, roundPoints: 450, movement: -1 },
      { playerId: 'd', rank: 4, total: 0, roundPoints: 0, movement: -1 },
    ];
    socket.fire('state', gameView({ phase: 'SCOREBOARD', standings }));
    expect(screen.getByRole('heading').textContent).toBe('Round 3/10 · Standings');
    const rows = () =>
      within(screen.getByRole('list', { name: 'Standings' }))
        .getAllByRole('listitem')
        .map(flapText);
    expect(rows()).toEqual([
      '1🐢Noor+1,4852,485▲2',
      '2🦊Mika★+1,5002,000',
      '2🐙Sam+4502,000▼1',
      '4🐸Ivy+00▼1',
    ]);
    // Rows slide 600 ms from where they stood on the last board, 64 px a row.
    const items = within(screen.getByRole('list', { name: 'Standings' })).getAllByRole('listitem');
    expect(items.map((li) => li.dataset.slideFrom ?? '0')).toEqual(['2', '0', '-2', '0']);
    expect(items[0]!.className).toContain('row-slide');
    expect(items[0]!.style.getPropertyValue('--slide-from')).toBe('128px');
    expect(items[2]!.style.getPropertyValue('--slide-from')).toBe('-128px');
    expect(items[1]!.className).not.toContain('row-slide');
  });

  it('Final: the rematch 3-2-1 over the finale', () => {
    renderScreen();
    socket.fire('state', gameView({ phase: 'FINAL', final: FINAL }));
    expect(screen.queryByRole('img', { name: /Rematch in/ })).toBeNull();
    socket.fire(
      'state',
      gameView({ phase: 'FINAL', final: FINAL, rematchAt: NOW + OFFSET + 3000 }),
    );
    expect(screen.getByRole('img', { name: 'Rematch in 3' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Podium' })).toBeTruthy();
    socket.fire('state', gameView({ phase: 'FINAL', final: FINAL }));
    expect(screen.queryByRole('img', { name: /Rematch in/ })).toBeNull();
  });
});

const pass = (playerId: string, rank: number, total: number): FinalPass => ({
  playerId,
  rank,
  total,
  bestRound: `Round 2 · Lima, Peru · ${total / 2}`,
  avgKm: 318.4,
});

// Noor 1st, Mika and Sam share 2nd, Ivy 4th.
const FINAL: FinalView = {
  podium: [
    { rank: 1, playerIds: ['c'] },
    { rank: 2, playerIds: ['a', 'b'] },
  ],
  passes: [pass('c', 1, 2400), pass('a', 2, 2000), pass('b', 2, 2000), pass('d', 4, 600)],
  awards: [
    { id: 'pinpointPilot', title: 'Pinpoint Pilot', playerIds: ['a'], stat: '1 bullseye' },
    { id: 'lostLuggage', title: 'Lost Luggage', playerIds: ['d'], stat: '9,120 km from Lima' },
    { id: 'frequentFlyer', title: 'Frequent Flyer', playerIds: ['b'], stat: '12,400 km in total' },
  ],
};

describe('Screen finale', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // Each risen step: its screen-reader rank and its text.
  const steps = () =>
    [...screen.getByRole('list', { name: 'Podium' }).children]
      .filter((li) => !li.hasAttribute('aria-hidden'))
      .map((li) => [li.querySelector('.sr-only')?.textContent, li.textContent]);
  const passes = () =>
    within(screen.getByRole('list', { name: 'Boarding passes' }))
      .queryAllByRole('listitem')
      .map((li) => li.getAttribute('aria-label'));
  const awards = () =>
    within(screen.getByRole('list', { name: 'Travel awards' }))
      .queryAllByRole('listitem')
      .map(flapText);
  const at = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it('stages the podium, then the passes 150 ms apart, then an award every 2.5 s, and keeps them', () => {
    renderScreen();
    socket.fire('state', gameView({ phase: 'FINAL', final: FINAL }));
    expect(steps()).toEqual([]);
    expect(passes()).toEqual([]);
    expect(awards()).toEqual([]);
    // A shared rank stands on one step, and there is no 3rd step under a 2nd-place tie.
    at(1799);
    expect(steps()).toEqual([]);
    at(1);
    expect(steps()).toEqual([['2nd place', '🦊Mika🐙Sam22nd place']]);
    at(1199);
    expect(steps()).toHaveLength(1);
    at(1);
    expect(steps()).toEqual([
      ['2nd place', '🦊Mika🐙Sam22nd place'],
      ['1st place', '🐢Noor11st place'],
    ]);
    at(1999);
    expect(passes()).toEqual([]);
    at(1); // 5.0 s
    expect(passes()).toEqual(["Noor's boarding pass"]);
    at(150);
    expect(passes()).toHaveLength(2);
    at(300);
    expect(passes()).toEqual([
      "Noor's boarding pass",
      "Mika's boarding pass",
      "Sam's boarding pass",
      "Ivy's boarding pass",
    ]);
    const noor = screen.getByRole('listitem', { name: "Noor's boarding pass" });
    expect(noor.textContent).toBe('🐢Noor1st2,400Round 2 · Lima, Peru · 1200Avg 318 km');
    expect(noor.querySelector<HTMLElement>('[data-stripe]')!.style.background).toBe(
      'rgb(0, 160, 248)',
    );
    at(2549); // 7.999 s
    expect(awards()).toEqual([]);
    at(1); // 8.0 s
    expect(awards()).toEqual(['Pinpoint Pilot🦊 Mika1 bullseye']);
    expect(screen.getByRole('img', { name: 'Pinpoint Pilot' })).toBeTruthy();
    at(2500);
    expect(awards()).toHaveLength(2);
    at(2500);
    expect(awards()).toEqual([
      'Pinpoint Pilot🦊 Mika1 bullseye',
      'Lost Luggage🐸 Ivy9,120 km from Lima',
      'Frequent Flyer🐙 Sam12,400 km in total',
    ]);
    at(60_000);
    expect(steps()).toHaveLength(2);
    expect(passes()).toHaveLength(4);
    expect(awards()).toHaveLength(3);
  });

  it('shows only the two steps of a 2-player game, the 3rd step at 0.6 s, and no awards', () => {
    renderScreen();
    const two: FinalView = {
      podium: [
        { rank: 1, playerIds: ['a'] },
        { rank: 2, playerIds: ['b'] },
      ],
      passes: [pass('a', 1, 2000), pass('b', 2, 1000)],
      awards: [],
    };
    socket.fire('state', gameView({ phase: 'FINAL', players: [MIKA, SAM], final: two }));
    at(20_000);
    expect(steps().map(([rank]) => rank)).toEqual(['2nd place', '1st place']);
    expect(passes()).toHaveLength(2);
    expect(screen.queryByRole('list', { name: 'Travel awards' })).toBeNull();
    cleanup();

    renderScreen();
    const three: FinalView = {
      ...two,
      podium: [...two.podium, { rank: 3, playerIds: ['c'] }],
    };
    socket.fire('state', gameView({ phase: 'FINAL', final: three }));
    at(599);
    expect(steps()).toEqual([]);
    at(1);
    expect(steps()).toEqual([['3rd place', '🐢Noor33rd place']]);
  });

  it('keeps its timing when a player joins mid-finale', () => {
    renderScreen();
    socket.fire('state', gameView({ phase: 'FINAL', final: FINAL }));
    at(3000);
    vi.mocked(Date.now).mockReturnValue(NOW + 3000);
    const ana = player('e', 'Ana', '🐼');
    const final = { ...FINAL, passes: [...FINAL.passes, pass('e', 5, 0)] };
    socket.fire('state', gameView({ phase: 'FINAL', players: [...PLAYERS, ana], final }));
    expect(steps()).toHaveLength(2);
    at(1999);
    expect(passes()).toEqual([]);
    at(1); // 5.0 s from entering FINAL, not from the new view
    expect(passes()).toHaveLength(1);
  });

  it('shows the photo-credits address in Picture mode only', () => {
    renderScreen();
    const settings = { ...lobbyView().settings, mode: 'picture' as const };
    socket.fire('state', gameView({ phase: 'FINAL', final: FINAL, settings }));
    expect(
      screen.getByText(`Photo credits: ${window.location.host}/credits/WXYZ`, { exact: true }),
    ).toBeTruthy();
    socket.fire('state', gameView({ phase: 'FINAL', final: FINAL }));
    expect(screen.queryByText(/Photo credits/)).toBeNull();
  });

  it('says "No rounds played" when the game ended before a round', () => {
    renderScreen();
    socket.fire('state', gameView({ phase: 'FINAL', round: null, final: null }));
    expect(screen.getByRole('heading').textContent).toBe('No rounds played');
    expect(screen.queryByRole('list', { name: 'Podium' })).toBeNull();
  });
});

describe('Screen sounds', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 })),
    );
  });

  async function start() {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /Click to start/ }));
    // Joins the click's load (it shares the Howler import), so the sounds are in before the game.
    await act(() => startSounds());
  }

  it('plays nothing before Click to start', () => {
    renderScreen();
    socket.fire('state', gameView({ phase: 'GUESSING', round: { ...ROUND, gate: 'boarding' } }));
    expect(audio.played).toEqual([]);
  });

  it('clatters as the lobby code flaps in, and chimes once at the start of GUESSING', async () => {
    await start();
    socket.fire('state', lobbyView(PLAYERS));
    expect(audio.played).toEqual(['flap']);
    socket.fire('state', gameView({ phase: 'INTRO' }));
    expect(audio.played).not.toContain('chime');
    audio.played.length = 0;
    const round = { ...ROUND, gate: 'boarding' as const, endsAt: NOW + OFFSET + 30_000 };
    socket.fire('state', gameView({ phase: 'GUESSING', round }));
    socket.fire('state', gameView({ phase: 'GUESSING', round: { ...round, lockedIn: ['a'] } }));
    expect(audio.played.filter((s) => s === 'chime')).toEqual(['chime']);
  });

  it('a Screen arriving mid-round does not chime', async () => {
    await start();
    socket.fire('state', gameView({ phase: 'GUESSING', round: { ...ROUND, gate: 'boarding' } }));
    expect(audio.played).not.toContain('chime');
  });

  it('ticks once on each of the last 5 s of GUESSING, and not while paused', async () => {
    await start();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      const round = { ...ROUND, gate: 'boarding' as const, endsAt: NOW + OFFSET + 8_000 };
      const ticks = () => audio.played.filter((s) => s === 'tick').length;
      const at = (ms: number, view: ScreenView) => {
        vi.mocked(Date.now).mockReturnValue(NOW + ms);
        socket.fire('state', { ...view, serverNow: NOW + ms + OFFSET });
        act(() => vi.advanceTimersByTime(250));
      };
      // 8 s left at 0 ms: 5 at 3 s, 4 at 4 s.
      for (let ms = 0; ms <= 4_000; ms += 250) at(ms, gameView({ phase: 'GUESSING', round }));
      expect(ticks()).toBe(2);
      // The VIP pauses at 3.5 s left: the count holds at 4 and nothing ticks.
      const paused = { reasons: ['vip' as const], since: NOW + OFFSET + 4_500, resumeAt: null };
      const held = { ...round, gate: 'delayed' as const };
      for (let ms = 4_500; ms <= 9_000; ms += 250)
        at(ms, gameView({ phase: 'GUESSING', round: held, paused }));
      expect(ticks()).toBe(2);
      // Resumed at 9 s with `endsAt` moved on by the pause: 4 doesn't tick again; 3, 2, 1 do, 0 doesn't.
      const resumed = { ...round, endsAt: round.endsAt + 4_500 };
      for (let ms = 9_000; ms <= 14_000; ms += 250)
        at(ms, gameView({ phase: 'GUESSING', round: resumed }));
      expect(ticks()).toBe(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('thuds once per pin as it lands, and not again when the reveal steps on', async () => {
    await start();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      audio.played.length = 0;
      socket.fire('state', revealView('pins', 0));
      const thuds = () => audio.played.filter((s) => s === 'thud').length;
      act(() => vi.advanceTimersByTime(314));
      expect(thuds()).toBe(0);
      act(() => vi.advanceTimersByTime(1));
      expect(thuds()).toBe(1);
      act(() => vi.advanceTimersByTime(120));
      expect(thuds()).toBe(3); // three pins: the missed player has none
      socket.fire('state', revealView('lines', 2));
      act(() => vi.advanceTimersByTime(2_000));
      expect(thuds()).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops the pending thuds when the reveal map goes away', async () => {
    await start();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      audio.played.length = 0;
      socket.fire('state', revealView('pins', 0));
      cleanup();
      act(() => vi.advanceTimersByTime(2_000));
      expect(audio.played).not.toContain('thud');
    } finally {
      vi.useRealTimers();
    }
  });

  it('plays the fanfare as the 1st podium step rises, once', async () => {
    await start();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      socket.fire('state', gameView({ phase: 'FINAL', final: FINAL }));
      act(() => vi.advanceTimersByTime(2_999));
      expect(audio.played).not.toContain('fanfare');
      act(() => vi.advanceTimersByTime(1));
      expect(audio.played.filter((s) => s === 'fanfare')).toEqual(['fanfare']);
      act(() => vi.advanceTimersByTime(10_000));
      expect(audio.played.filter((s) => s === 'fanfare')).toEqual(['fanfare']);
    } finally {
      vi.useRealTimers();
    }
  });
});
