// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import L from 'leaflet';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_ENDED_ERROR } from '#shared/constants.js';
import type { PublicPlayer, RoundResult, ScreenView } from '#shared/types.js';
import { useRoomStore } from '../lib/roomStore.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { Screen, stageScale } from './Screen.js';

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
    color: '#56B4E9',
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

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  cleanup();
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
    const resume = vi.fn(async () => {});
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'suspended';
        resume = resume;
      },
    );
    renderScreen();
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Click to start/ }));
    expect(request).toHaveBeenCalledWith('screen');
    expect(resume).toHaveBeenCalled();
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

const railText = () =>
  within(screen.getByRole('list', { name: 'Results' }))
    .queryAllByRole('listitem')
    .map((li) => li.textContent);

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
    expect(screen.getByRole('heading').textContent).toBe('Round 3/10 · Now boarding');
    expect(screen.queryByText(/Bonus round|Final round/)).toBeNull();
    socket.fire(
      'state',
      gameView({ phase: 'INTRO', round: { ...ROUND, number: 10, multiplier: 2 } }),
    );
    expect(screen.getByRole('heading').textContent).toBe('Round 10/10 · ×2 · Now boarding');
    expect(screen.getByText('×2 Final round')).toBeTruthy();
  });

  it('Guessing: gate label, the city in flaps, tiles turning LOCKED IN, and no map', () => {
    renderScreen();
    const guessing = { ...ROUND, gate: 'boarding' as const, endsAt: NOW + OFFSET + 20_000 };
    socket.fire('state', gameView({ phase: 'GUESSING', round: guessing }));
    expect(screen.getByText('Round 3/10 · Boarding')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Ciudad del Este, Paraguay' })).toBeTruthy();
    const lockedIn = () =>
      [...document.querySelectorAll('[data-locked-in]')].map((el) => el.textContent);
    expect(lockedIn()).toEqual([]);
    socket.fire('state', gameView({ phase: 'GUESSING', round: { ...guessing, lockedIn: ['b'] } }));
    expect(lockedIn()).toEqual(['🐙SamLocked in']);
    expect(document.querySelector('.leaflet-container')).toBeNull();
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
      expect(screen.getByText('Round 3/10 · Final call')).toBeTruthy();

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
      const label = screen.getByText('Round 3/10 · Delayed');
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
    expect(document.querySelectorAll('.reveal-pin')).toHaveLength(3); // the missed player has no pin
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

  it('Scoreboard and Final: rank, emoji, name, round points, total and movement', () => {
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
        .map((li) => li.textContent);
    expect(rows()).toEqual([
      '1🐢Noor+1,4852,485▲2',
      '2🦊Mika+1,5002,000',
      '2🐙Sam+4502,000▼1',
      '4🐸Ivy+00▼1',
    ]);
    socket.fire('state', gameView({ phase: 'FINAL', standings }));
    expect(screen.getByRole('heading').textContent).toBe('Final standings');
    expect(rows()).toHaveLength(4);
  });
});
