// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import L from 'leaflet';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_ENDED_ERROR, KICKED_ERROR } from '#shared/constants.js';
import type { Ack, MyResult, PlayerView, PublicPlayer, VipControl } from '#shared/types.js';
import { loadPlayer, savePlayer } from '../lib/playerIdentity.js';
import { resetTiles } from '../lib/tiles.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { ordinal } from '#shared/scoring.js';
import { Play } from './Play.js';

const STORED_KEY = 'abcdefghijklmnopqrstu';

function me(overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    id: 'p1',
    name: 'Ana',
    emoji: '🐸',
    color: '#56B4E9',
    connected: true,
    waiting: false,
    isVip: false,
    total: 0,
    rank: 1,
    ...overrides,
  };
}

function lobbyView(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    role: 'player',
    serverNow: 1_800_000_000_000,
    code: 'WXYZ',
    phase: 'LOBBY',
    me: me(),
    playerCount: 3,
    vipName: 'Mika',
    settings: { categoryId: '', mode: 'name', difficulty: 'mixed', rounds: 10, timerSeconds: 30 },
    categoryName: null,
    hasCategories: true,
    paused: null,
    rematchAt: null,
    region: null,
    round: null,
    myResult: null,
    final: null,
    vip: null,
    ...overrides,
  };
}

const NOW = 1_800_000_000_000;
const ROUND: NonNullable<PlayerView['round']> = {
  number: 3,
  total: 10,
  multiplier: 1,
  endsAt: null,
  prompt: { kind: 'name', displayName: 'Osaka' },
  myLock: null,
  myAim: null,
  stillGuessing: ['🐸', '🐼'],
};

/** A game view: round 3 of 10 in Europe's box, `phase` and `round` fields overridable. */
function gameView(
  phase: PlayerView['phase'],
  round: Partial<PlayerView['round'] & object> = {},
  overrides: Partial<PlayerView> = {},
): PlayerView {
  return lobbyView({
    phase,
    region: { box: { south: 35, west: -10, north: 60, east: 30 }, scale: 3000 },
    round: { ...ROUND, ...round },
    ...overrides,
  });
}

const RESULT: MyResult = {
  playerId: 'p1',
  position: { lat: 34.7, lng: 135.5 },
  lockedIn: true,
  distanceKm: 412.3,
  basePoints: 812,
  bullseye: false,
  multiplier: 1.5,
  points: 1218,
  closest: true,
  totalAfter: 3218,
};

/** Every Leaflet map the page builds, newest last. */
const maps: L.Map[] = [];
L.Map.addInitHook(function (this: L.Map) {
  maps.push(this);
});

let socket: FakeSocket;

function stubExists(takenEmoji: string[] = [], exists = true) {
  const fetch = vi.fn((url: string) =>
    Promise.resolve(
      new Response(
        JSON.stringify(
          url === '/api/config'
            ? {
                tiles: null,
                fallbackTiles: { url: '/t/{z}/{x}/{y}.png', attribution: 'NE', maxNativeZoom: 6 },
              }
            : { exists, phase: 'LOBBY', full: false, takenEmoji },
        ),
      ),
    ),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function renderPlay() {
  socket = new FakeSocket();
  render(
    <MemoryRouter initialEntries={['/play/wxyz']}>
      <Routes>
        <Route path="/play/:code" element={<Play makeSocket={() => socket.asSocket()} />} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function ack(index: number, res: Ack) {
  act(() => socket.emitted[index]!.ack(res));
}

async function fillAndJoin(name: string, emoji?: string) {
  fireEvent.change(await screen.findByLabelText('Your name'), { target: { value: name } });
  if (emoji) fireEvent.click(screen.getByRole('radio', { name: emoji }));
  fireEvent.click(screen.getByRole('button', { name: 'Join' }));
}

beforeEach(() => {
  localStorage.clear();
  resetTiles();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Play', () => {
  it('shows the join form with 24 emoji, taken ones disabled, and checks the room', async () => {
    const fetch = stubExists(['🦊', '🐼']);
    renderPlay();
    expect(fetch).toHaveBeenCalledWith('/api/rooms/WXYZ/exists');
    expect(
      ((await screen.findByRole('radio', { name: '🦊, taken' })) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(screen.getAllByRole('radio')).toHaveLength(24);
    expect((screen.getByRole('radio', { name: '🐸' }) as HTMLInputElement).checked).toBe(true); // the first free one
    expect((screen.getByRole('button', { name: 'Join' }) as HTMLInputElement).disabled).toBe(true);
  });

  it('joins with a new 21-character key, then remembers the identity and shows the lobby', async () => {
    stubExists();
    renderPlay();
    await fillAndJoin('  Ana ', '🐙');
    const join = socket.emitted[0]!;
    expect(join.event).toBe('player:join');
    expect(join.payload).toMatchObject({ code: 'WXYZ', name: 'Ana', emoji: '🐙' });
    const key = (join.payload as { playerKey: string }).playerKey;
    expect(key).toMatch(/^[\w-]{21}$/);

    ack(0, { ok: true });
    expect(loadPlayer('WXYZ')).toEqual({ playerKey: key, name: 'Ana', emoji: '🐙' });
    socket.fire('state', lobbyView());
    expect(screen.getByText('Waiting for ★ Mika to start')).toBeTruthy();
    expect(screen.getByLabelText('Settings').textContent).toContain(
      'NAME · MIXED · 10 ROUNDS · 30 S',
    );
    expect(screen.getByText('0 · 1st of 3')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Connected' })).toBeTruthy();
  });

  it('tells a non-VIP phone when there are no destinations yet', async () => {
    stubExists();
    renderPlay();
    await fillAndJoin('Ana');
    ack(0, { ok: true });
    socket.fire('state', lobbyView({ hasCategories: false }));
    expect(screen.getByLabelText('Settings').textContent).toBe(
      'No destinations yet. Check back soon.',
    );
    expect(screen.queryByRole('region', { name: 'Game settings' })).toBeNull();
  });

  it('goes back to the form with the text and the fields kept when the name is taken', async () => {
    stubExists();
    renderPlay();
    await fillAndJoin('Ana', '🐙');
    ack(0, { ok: false, error: 'That name is taken' });
    expect((await screen.findByRole('alert')).textContent).toContain('That name is taken');
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Ana');
    expect((screen.getByRole('radio', { name: '🐙' }) as HTMLInputElement).checked).toBe(true);
    expect(loadPlayer('WXYZ')).toBeNull();

    // The retry reuses the device's key.
    const firstKey = (socket.emitted[0]!.payload as { playerKey: string }).playerKey;
    await fillAndJoin('Ana B');
    expect(socket.emitted.at(-1)!.payload).toMatchObject({ playerKey: firstKey, name: 'Ana B' });
  });

  it('shows a full game on the form', async () => {
    stubExists();
    renderPlay();
    await fillAndJoin('Ana');
    ack(0, { ok: false, error: 'This game is full (12 players)' });
    expect((await screen.findByRole('alert')).textContent).toContain(
      'This game is full (12 players)',
    );
  });

  it('rejoins silently with the stored key after a refresh', () => {
    const fetch = stubExists();
    savePlayer('WXYZ', { playerKey: STORED_KEY, name: 'Ana', emoji: '🐸' });
    renderPlay();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Your name')).toBeNull();
    expect(socket.emitted.map((e) => [e.event, e.payload])).toEqual([
      ['player:join', { code: 'WXYZ', playerKey: STORED_KEY, name: 'Ana', emoji: '🐸' }],
    ]);
    ack(0, { ok: true });
    socket.fire('state', lobbyView());
    expect(screen.getByText('Ana')).toBeTruthy();
  });

  it('forgets a refused stored identity and opens the form with its name and key', async () => {
    stubExists();
    savePlayer('WXYZ', { playerKey: STORED_KEY, name: 'Ana', emoji: '🐸' });
    renderPlay();
    ack(0, { ok: false, error: 'That name is taken' });
    expect((await screen.findByRole('alert')).textContent).toContain('That name is taken');
    expect(loadPlayer('WXYZ')).toBeNull();
    await fillAndJoin('Ana B');
    expect(socket.emitted.at(-1)!.payload).toMatchObject({ playerKey: STORED_KEY, name: 'Ana B' });
  });

  it('renames from the menu, showing a refusal and storing the new name', () => {
    stubExists();
    savePlayer('WXYZ', { playerKey: STORED_KEY, name: 'Ana', emoji: '🐸' });
    renderPlay();
    socket.fire('state', lobbyView());
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change name' }));
    fireEvent.change(screen.getByLabelText('New name'), { target: { value: 'Mika' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(socket.emitted.at(-1)).toMatchObject({
      event: 'player:rename',
      payload: { name: 'Mika' },
    });
    ack(1, { ok: false, error: 'That name is taken' });
    expect(screen.getByRole('alert').textContent).toContain('That name is taken');

    fireEvent.change(screen.getByLabelText('New name'), { target: { value: 'Bo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    ack(2, { ok: true });
    expect(screen.queryByLabelText('New name')).toBeNull();
    expect(loadPlayer('WXYZ')?.name).toBe('Bo');
  });

  it('offers only Leave game outside the lobby', () => {
    savePlayer('WXYZ', { playerKey: STORED_KEY, name: 'Ana', emoji: '🐸' });
    renderPlay();
    socket.fire('state', lobbyView({ phase: 'INTRO' }));
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.queryByRole('button', { name: 'Change name' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Leave game' })).toBeTruthy();
  });

  it('leaves: sends player:leave, forgets the room and goes home', () => {
    savePlayer('WXYZ', { playerKey: STORED_KEY, name: 'Ana', emoji: '🐸' });
    renderPlay();
    socket.fire('state', lobbyView());
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave game' }));
    expect(socket.emitted.at(-1)!.event).toBe('player:leave');
    expect(loadPlayer('WXYZ')).toBeNull();
    ack(1, { ok: true });
    expect(screen.getByText('home')).toBeTruthy();
    expect(socket.disconnected).toBe(true);
  });

  it('shows the kicked screen with a link home', () => {
    savePlayer('WXYZ', { playerKey: STORED_KEY, name: 'Ana', emoji: '🐸' });
    renderPlay();
    socket.fire('state', lobbyView());
    socket.fire('kicked', {});
    expect(screen.getByRole('heading', { name: KICKED_ERROR })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Pinpoint' }).getAttribute('href')).toBe('/');
  });

  it('shows a refused rejoin of a kicked player as the kicked screen, not the form', () => {
    savePlayer('WXYZ', { playerKey: STORED_KEY, name: 'Ana', emoji: '🐸' });
    renderPlay();
    ack(0, { ok: false, error: KICKED_ERROR });
    expect(screen.getByRole('heading', { name: KICKED_ERROR })).toBeTruthy();
  });

  it('shows the room-gone screen on room:closed and for an unknown room', async () => {
    savePlayer('WXYZ', { playerKey: STORED_KEY, name: 'Ana', emoji: '🐸' });
    renderPlay();
    socket.fire('room:closed', { reason: 'expired' });
    expect(screen.getByRole('heading', { name: GAME_ENDED_ERROR })).toBeTruthy();
    cleanup();
    localStorage.clear();

    stubExists([], false);
    renderPlay();
    expect(await screen.findByRole('heading', { name: GAME_ENDED_ERROR })).toBeTruthy();
  });

  it('turns the connection dot amber while reconnecting and red once given up', () => {
    savePlayer('WXYZ', { playerKey: STORED_KEY, name: 'Ana', emoji: '🐸' });
    renderPlay();
    socket.fire('state', lobbyView());
    socket.fire('disconnect', 'transport close');
    expect(screen.getByRole('img', { name: 'Reconnecting' })).toBeTruthy();
    socket.active = false;
    socket.fire('disconnect', 'io server disconnect');
    expect(screen.getByRole('img', { name: 'Offline' })).toBeTruthy();
  });

  it('practises: Lock in sends the centre, shows the distance for 3 s and offers Try again', async () => {
    stubExists();
    savePlayer('WXYZ', { playerKey: STORED_KEY, name: 'Ana', emoji: '🐸' });
    renderPlay();
    ack(0, { ok: true });
    socket.fire('state', lobbyView());
    await act(async () => {});
    expect(screen.getByText('Practice: find 0°, 0°')).toBeTruthy();
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
      const sent = socket.emitted[1]!;
      expect(sent.event).toBe('player:practice');
      expect(sent.payload).toEqual({ lat: expect.any(Number), lng: expect.any(Number) });
      // The server's fx comes before its ack.
      socket.fire('fx', { kind: 'practiceResult', distanceKm: 1240.4 });
      ack(1, { ok: true });
      expect(screen.getByText('1,240 km from 0°, 0°')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Lock in' })).toBeNull();
      act(() => vi.advanceTimersByTime(3000));
      expect(screen.queryByText(/from 0°, 0°/)).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
      socket.fire('fx', { kind: 'practiceResult', distanceKm: 4.24 });
      ack(2, { ok: true });
      expect(screen.getByText('4.2 km from 0°, 0°')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(screen.getByRole('button', { name: 'Lock in' })).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
      ack(3, { ok: false, error: 'Slow down' });
      expect(screen.getByRole('alert').textContent).toBe('Slow down');
    } finally {
      vi.useRealTimers();
    }
  });

  describe('in a game', () => {
    /** A rejoined phone showing `view`, with the tile config loaded. */
    async function inGame(view: PlayerView) {
      stubExists();
      savePlayer('WXYZ', { playerKey: STORED_KEY, name: 'Ana', emoji: '🐸' });
      renderPlay();
      ack(0, { ok: true });
      socket.fire('state', view);
      await act(async () => {});
    }
    const sent = (event: string) => socket.emitted.filter((e) => e.event === event);

    it('shows the intro over the map, not interactive, with the multiplier', async () => {
      await inGame(gameView('INTRO', { multiplier: 1.5 }));
      expect(screen.getByRole('heading', { name: 'Round 3 of 10' })).toBeTruthy();
      expect(screen.getByText('×1.5 Bonus round')).toBeTruthy();
      expect(screen.getByRole('application').closest('[inert]')).toBeTruthy();
      expect((screen.getByRole('button', { name: 'Lock in' }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      // Clamped to the padded box: 25% of 40° wide and 25° tall on each side.
      const b = maps.at(-1)!.options.maxBounds as L.LatLngBounds;
      expect([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]).toEqual([
        28.75, -20, 66.25, 40,
      ]);
      expect(maps.at(-1)!.options.maxBoundsViscosity).toBe(1);
    });

    it('keeps the same map into guessing, with the prompt bar and the timer', async () => {
      await inGame(gameView('INTRO'));
      const map = maps.at(-1);
      socket.fire('state', gameView('GUESSING', { endsAt: NOW + 12_000 }));
      expect(maps.at(-1)).toBe(map);
      expect(screen.getByRole('heading', { name: 'Osaka' })).toBeTruthy();
      expect(screen.getByRole('timer').textContent).toBe('12');
      expect(screen.getByRole('application').closest('[inert]')).toBeNull();
      expect(screen.getByTestId('crosshair')).toBeTruthy();
    });

    it('leaves the World unclamped, jumping between world copies', async () => {
      await inGame(
        gameView(
          'GUESSING',
          {},
          {
            settings: { ...lobbyView().settings, categoryId: 'world' },
            region: { box: { south: -58, west: -180, north: 78, east: 180 }, scale: 20000 },
          },
        ),
      );
      expect(maps.at(-1)!.options.maxBounds).toBeUndefined();
      expect(maps.at(-1)!.options.worldCopyJump).toBe(true);
    });

    it('sends the aim at most once per 250 ms while moving, and on every moveend', async () => {
      await inGame(gameView('GUESSING', { endsAt: NOW + 30_000 }));
      const map = maps.at(-1)!;
      vi.useFakeTimers();
      try {
        for (let i = 0; i < 5; i++) map.fire('move');
        expect(sent('player:aim')).toHaveLength(1);
        act(() => vi.advanceTimersByTime(200));
        map.fire('move');
        expect(sent('player:aim')).toHaveLength(1);
        act(() => vi.advanceTimersByTime(50));
        map.fire('move');
        expect(sent('player:aim')).toHaveLength(2);
        map.fire('moveend');
        expect(sent('player:aim')).toHaveLength(3);
        const { lat, lng } = map.getCenter().wrap();
        expect(sent('player:aim')[2]!.payload).toEqual({ lat, lng });
      } finally {
        vi.useRealTimers();
      }
    });

    it('sends no aim during the intro', async () => {
      await inGame(gameView('INTRO'));
      maps.at(-1)!.fire('move').fire('moveend');
      expect(sent('player:aim')).toHaveLength(0);
    });

    it('locks in once, then shows the locked-in card with the frozen pin', async () => {
      await inGame(gameView('GUESSING', { endsAt: NOW + 20_000 }));
      const fitted = maps.at(-1)!.getZoom();
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      expect(maps.at(-1)!.getZoom()).toBe(fitted + 1);
      const lockIn = screen.getByRole('button', { name: 'Lock in' });
      fireEvent.click(lockIn);
      fireEvent.click(lockIn);
      expect(sent('player:lockIn')).toHaveLength(1);
      const centre = sent('player:lockIn')[0]!.payload as { lat: number; lng: number };
      act(() => sent('player:lockIn')[0]!.ack({ ok: true }));
      const zoom = maps.at(-1)!.getZoom();

      socket.fire(
        'state',
        gameView('GUESSING', { endsAt: NOW + 20_000, myLock: centre, stillGuessing: ['🐼'] }),
      );
      const pass = screen.getByRole('region', { name: 'Boarding pass' });
      expect(within(pass).getByRole('heading', { name: 'Boarding · Locked in' })).toBeTruthy();
      expect(within(pass).getByRole('timer').textContent).toBe('20');
      expect(pass.textContent).toContain('Still guessing: 🐼');
      expect(within(pass).getByRole('img', { name: 'Your pin' })).toBeTruthy();
      expect(maps.at(-1)!.getZoom()).toBe(zoom);
      expect(maps.at(-1)!.getCenter().lat).toBeCloseTo(centre.lat, 6);
      expect(screen.queryByRole('button', { name: 'Lock in' })).toBeNull();
    });

    it('reopens the crosshair on the earlier aim after a refresh mid-guessing', async () => {
      const aim = { lat: 48.5, lng: 2.25 };
      await inGame(gameView('GUESSING', { endsAt: NOW + 20_000, myAim: aim }));
      const centre = maps.at(-1)!.getCenter();
      expect([centre.lat, centre.lng]).toEqual([
        expect.closeTo(aim.lat, 6),
        expect.closeTo(aim.lng, 6),
      ]);
      fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
      const sentAt = sent('player:lockIn')[0]!.payload as { lat: number; lng: number };
      expect(sentAt.lat).toBeCloseTo(aim.lat, 6);
      expect(sentAt.lng).toBeCloseTo(aim.lng, 6);
    });

    it('shows a locked-in participant the Locked-in card after a refresh', async () => {
      await inGame(gameView('GUESSING', { endsAt: NOW + 20_000, myLock: { lat: 40, lng: 5 } }));
      const pass = screen.getByRole('region', { name: 'Boarding pass' });
      expect(within(pass).getByRole('heading', { name: 'Boarding · Locked in' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Lock in' })).toBeNull();
    });

    it('offers Lock in again after a refused lock-in, with the reason', async () => {
      await inGame(gameView('GUESSING', { endsAt: NOW + 20_000 }));
      fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
      act(() => sent('player:lockIn')[0]!.ack({ ok: false, error: 'Slow down' }));
      expect(screen.getByRole('alert').textContent).toBe('Slow down');
      fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
      expect(sent('player:lockIn')).toHaveLength(2);
    });

    it('covers the map while paused, with Lock in disabled and the timer stopped, then 3-2-1', async () => {
      const paused = { reasons: ['vip' as const], since: NOW - 4_000, resumeAt: null };
      await inGame(gameView('GUESSING', { endsAt: NOW + 20_000 }, { paused }));
      // Stopped at the pause: 24 s were left then.
      expect(screen.getByRole('timer').textContent).toBe('24');
      expect(screen.getByRole('status').textContent).toBe('Delayed · the VIP paused the round');
      const lockIn = screen.getByRole('button', { name: 'Lock in' }) as HTMLButtonElement;
      expect(lockIn.disabled).toBe(true);
      fireEvent.click(lockIn);
      expect(sent('player:lockIn')).toHaveLength(0);
      // The top bar stays above the overlay, for the VIP's ★ button.
      expect(screen.getByRole('application').closest('[inert]')).toBeTruthy();
      const overlaid = screen.getByRole('status').parentElement!;
      expect(overlaid.contains(document.querySelector('header'))).toBe(false);

      const away = { ...paused, reasons: ['screenAway' as const] };
      socket.fire('state', gameView('GUESSING', { endsAt: NOW + 20_000 }, { paused: away }));
      expect(screen.getByRole('status').textContent).toBe('Waiting for the Screen…');

      const counting = { ...paused, reasons: [], resumeAt: NOW + 3_000 };
      socket.fire('state', gameView('GUESSING', { endsAt: NOW + 20_000 }, { paused: counting }));
      expect(screen.getByRole('img', { name: 'Resuming in 3' })).toBeTruthy();

      socket.fire('state', gameView('GUESSING', { endsAt: NOW + 27_000 }));
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.getByRole('application').closest('[inert]')).toBeNull();
      expect(screen.getByRole('timer').textContent).toBe('27');
      expect((screen.getByRole('button', { name: 'Lock in' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });

    it('shows the paused overlay over the locked-in card and the result card too', async () => {
      const paused = { reasons: ['vip' as const], since: NOW, resumeAt: null };
      await inGame(gameView('SCOREBOARD', {}, { paused, myResult: RESULT }));
      expect(screen.getByRole('status').textContent).toBe('Delayed · the VIP paused the round');
    });

    it('keeps the card face down until the view carries the result, then shows it', async () => {
      await inGame(gameView('REVEAL', {}, { me: me({ total: 2000, rank: 2 }) }));
      expect(screen.getByRole('status', { name: 'Your result is coming' })).toBeTruthy();
      expect(screen.queryByRole('region', { name: 'Your result' })).toBeNull();

      socket.fire(
        'state',
        gameView('REVEAL', {}, { me: me({ total: 2000, rank: 2 }), myResult: RESULT }),
      );
      expect(screen.queryByRole('status', { name: 'Your result is coming' })).toBeNull();
      const pass = screen.getByRole('region', { name: 'Your result' });
      const text = pass.textContent;
      for (const part of [
        '412 km',
        'Base points812',
        'Multiplier×1.5',
        'Round+1,218',
        'Total3,218',
        'Closest',
      ])
        expect(text).toContain(part);
      expect(text).not.toContain('Bullseye');
      expect(text).not.toContain('Rank'); // the rank waits for the scoreboard
    });

    it('keeps the pass on the scoreboard with the new rank and the next round', async () => {
      await inGame(
        gameView(
          'SCOREBOARD',
          {},
          {
            me: me({ total: 3218, rank: 2 }),
            myResult: {
              ...RESULT,
              multiplier: 1,
              points: 812,
              bullseye: true,
              closest: false,
              totalAfter: 3218,
            },
          },
        ),
      );
      const text = screen.getByRole('region', { name: 'Your result' }).textContent;
      for (const part of ['Bullseye', 'Round+812', 'Total3,218', 'Rank2nd of 3'])
        expect(text).toContain(part);
      expect(text).not.toContain('Multiplier');
      expect(text).not.toContain('Closest');
      expect(screen.getByText('Next: Round 4 of 10')).toBeTruthy();
    });

    it('shows a missed round', async () => {
      await inGame(
        gameView(
          'SCOREBOARD',
          {},
          {
            myResult: {
              ...RESULT,
              position: null,
              distanceKm: null,
              basePoints: 0,
              points: 0,
              closest: false,
            },
          },
        ),
      );
      expect(screen.getByRole('heading', { name: 'Missed this round · 0' })).toBeTruthy();
      expect(screen.getByText('Next: Round 4 of 10')).toBeTruthy();
    });

    it('shows the waiting card to a player who joined mid-game', async () => {
      await inGame(gameView('GUESSING', { number: 4 }, { me: me({ waiting: true }) }));
      expect(screen.getByRole('heading', { name: 'Next departure' })).toBeTruthy();
      expect(screen.getByText("You're in from round 5. You start at 0.")).toBeTruthy();
      expect(screen.queryByRole('application')).toBeNull();
      cleanup();
      await inGame(gameView('REVEAL', { number: 10 }, { me: me({ waiting: true }) }));
      expect(screen.getByText("You're in from the next game. You start at 0.")).toBeTruthy();
    });

    it('shows the own finale pass and awards at the final', async () => {
      const pass = {
        playerId: 'p1',
        rank: 1,
        total: 6500,
        bestRound: 'Round 7 · Osaka · 960',
        avgKm: 318.4,
      };
      const award = {
        id: 'pinpointPilot' as const,
        title: 'Pinpoint Pilot',
        playerIds: ['p1'],
        stat: '2 bullseyes',
      };
      await inGame(
        gameView(
          'FINAL',
          {},
          { me: me({ total: 6500, rank: 1 }), final: { pass, awards: [award] } },
        ),
      );
      const card = screen.getByRole('region', { name: 'Your boarding pass' });
      expect(card.textContent).toBe('🐸AnaFinal1st of 36,500 ptsRound 7 · Osaka · 960Avg 318 km');
      // The colour stripe on the pass's left edge.
      expect(card.style.borderLeftColor).toBe('rgb(86, 180, 233)');
      const awards = screen.getByRole('region', { name: 'Your travel awards' });
      expect(
        within(awards)
          .getAllByRole('listitem')
          .map((li) => li.textContent),
      ).toEqual(['Pinpoint Pilot2 bullseyes']);
      cleanup();
      await inGame(gameView('FINAL', {}, { final: { pass, awards: [] } }));
      expect(screen.queryByRole('region', { name: 'Your travel awards' })).toBeNull();
    });

    it('says "No rounds played" at a final with no round played', async () => {
      await inGame(gameView('FINAL', {}, { round: null, final: null }));
      const card = screen.getByRole('region', { name: 'Your standing' });
      expect(card.textContent).toBe('FinalNo rounds played');
    });

    it('opens the VIP drawer only from the ★ button, over a paused round', async () => {
      const vip = { categories: [], screenCount: 1, players: [], controls: [] };
      await inGame(
        gameView(
          'GUESSING',
          {},
          {
            me: me({ isVip: true }),
            paused: { reasons: ['vip'], since: NOW, resumeAt: null },
            vip: { ...vip, controls: ['resume', 'skipRound', 'kick', 'end'] },
          },
        ),
      );
      expect(screen.queryByRole('dialog')).toBeNull();
      const star = screen.getByRole('button', { name: 'VIP controls' });
      fireEvent.click(star);
      fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
      expect(sent('vip:resume')).toHaveLength(1);
      act(() => sent('vip:resume')[0]!.ack({ ok: true }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(star);
      // No ★ for a non-VIP, nor in the lobby (the settings card is the VIP's lobby).
      socket.fire('state', gameView('GUESSING'));
      expect(screen.queryByRole('button', { name: 'VIP controls' })).toBeNull();
      socket.fire(
        'state',
        lobbyView({ me: me({ isVip: true }), vip: { ...vip, controls: ['start', 'kick'] } }),
      );
      expect(screen.queryByRole('button', { name: 'VIP controls' })).toBeNull();
    });

    it('opens Round settings at the scoreboard with the rounds played disabled', async () => {
      await inGame(
        gameView(
          'SCOREBOARD',
          { number: 5 },
          {
            me: me({ isVip: true }),
            vip: {
              categories: [],
              screenCount: 1,
              players: [],
              controls: ['next', 'pause', 'roundSettings', 'kick', 'end'],
            },
          },
        ),
      );
      fireEvent.click(screen.getByRole('button', { name: 'VIP controls' }));
      const rounds = within(screen.getByRole('group', { name: 'Rounds' }));
      expect((rounds.getByRole('button', { name: '5' }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(rounds.getByRole('button', { name: '15' }));
      expect(sent('vip:roundSettings').map((e) => e.payload)).toEqual([{ rounds: 15 }]);
    });

    it('opens Players from the ★ at the final, and kicks with two taps', async () => {
      const others = [me({ isVip: true }), me({ id: 'p2', name: 'Sam', emoji: '🐙' })];
      await inGame(
        gameView(
          'FINAL',
          {},
          {
            me: me({ isVip: true }),
            vip: {
              categories: [],
              screenCount: 1,
              players: others,
              controls: ['rematch', 'backToLobby', 'kick'],
            },
          },
        ),
      );
      fireEvent.click(screen.getByRole('button', { name: 'VIP controls' }));
      fireEvent.click(screen.getByRole('button', { name: 'Kick Sam' }));
      fireEvent.click(screen.getByRole('button', { name: 'Tap again to kick' }));
      expect(sent('vip:kick').map((e) => e.payload)).toEqual([{ playerId: 'p2' }]);
    });

    it('shows the 3-2-1 over the final, keeps the drawer open for Cancel, and closes it at the new game', async () => {
      const vip = {
        categories: [],
        screenCount: 1,
        players: [me({ isVip: true })],
        controls: ['rematch', 'backToLobby', 'kick'] as VipControl[],
      };
      const final = (rematchAt: number | null, controls = vip.controls) =>
        gameView('FINAL', {}, { me: me({ isVip: true }), rematchAt, vip: { ...vip, controls } });
      await inGame(final(null));
      expect(screen.queryByRole('img', { name: /Rematch in/ })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'VIP controls' }));
      fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));
      act(() => sent('vip:rematch')[0]!.ack({ ok: true }));
      socket.fire('state', final(NOW + 3000, ['rematchCancel']));
      expect(screen.getByRole('img', { name: 'Rematch in 3' })).toBeTruthy();
      expect(screen.getByRole('region', { name: 'Your standing' }).closest('[inert]')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      socket.fire(
        'state',
        gameView('INTRO', {}, { me: me({ isVip: true }), vip: { ...vip, controls: ['pause'] } }),
      );
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByRole('img', { name: /Rematch in/ })).toBeNull();
    });
  });

  describe('VIP hand-off', () => {
    it('shows "You\'re the VIP now ★" for 3 s on fx vipNow', async () => {
      stubExists();
      savePlayer('WXYZ', { playerKey: STORED_KEY, name: 'Ana', emoji: '🐸' });
      renderPlay();
      ack(0, { ok: true });
      socket.fire('state', lobbyView());
      await act(async () => {});
      vi.useFakeTimers();
      expect(screen.queryByText("You're the VIP now ★")).toBeNull();
      act(() => socket.fire('fx', { kind: 'vipNow' }));
      expect(screen.getByText("You're the VIP now ★")).toBeTruthy();
      act(() => vi.advanceTimersByTime(2999));
      expect(screen.getByText("You're the VIP now ★")).toBeTruthy();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByText("You're the VIP now ★")).toBeNull();
      vi.useRealTimers();
    });
  });

  it('says ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 112].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '112th',
    ]);
  });
});
