// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GAME_ENDED_ERROR,
  PING_INTERVAL_MS,
  PLAYER_KICKED_ERROR,
  PLAYER_PALETTE,
  ROOM_CHECK_RATE_LIMITED_ERROR,
  ROOM_NOT_FOUND_ERROR,
} from '../../../shared/constants.js';
import type { PlayerView } from '../../../shared/types.js';
import { TOAST_MS } from '../components/Toast.js';
import { loadPlayer, savePlayer } from '../lib/playerIdentity.js';
import type { GameSocket } from '../lib/socket.js';
import { OFFLINE_AFTER_MS } from '../lib/useRoomSocket.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { Play } from './Play.js';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubExists(exists: boolean | Error) {
  const fetch = vi.fn(() =>
    exists instanceof Error
      ? Promise.reject(exists)
      : Promise.resolve(Response.json({ exists, phase: exists ? 'LOBBY' : null })),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function playerView(overrides: Partial<PlayerView> = {}): PlayerView {
  const base: Omit<PlayerView, 'canBuzz'> = {
    role: 'player',
    code: 'WXYZ',
    phase: 'LOBBY',
    questionIndex: -1,
    questionCount: 10,
    openingCounter: 0,
    me: { id: 'p1', name: 'Ana', color: PLAYER_PALETTE[3], score: 0, rank: 1 },
    playerCount: 1,
    hasBuzzed: false,
    lockedOut: false,
    winnerId: null,
    winnerName: null,
    pointsThisQuestion: 0,
    answerTimer: null,
    buzzTimer: null,
    // As the server sets it: the list in LOBBY only.
    lobby:
      (overrides.phase ?? 'LOBBY') === 'LOBBY'
        ? [{ id: 'p1', name: 'Ana', color: PLAYER_PALETTE[3], connected: true }]
        : null,
    ...overrides,
  };
  // As the server sets it, unless a test says otherwise.
  return { canBuzz: canBuzzFor(base), ...base };
}

function canBuzzFor({ phase, lockedOut, hasBuzzed }: Omit<PlayerView, 'canBuzz'>): boolean {
  return (phase === 'OPEN' || phase === 'COLLECTING') && !lockedOut && !hasBuzzed;
}

/** Renders `/play/<code>`. Each call to `makeSocket` gets a fresh fake, as a page reload would. */
function renderPlay(path = '/play/WXYZ') {
  const sockets: FakeSocket[] = [];
  const makeSocket = vi.fn(() => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket as unknown as GameSocket;
  });
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/play/:code" element={<Play makeSocket={makeSocket} />} />
      </Routes>
    </MemoryRouter>,
  );
  return { sockets, makeSocket, unmount: view.unmount };
}

async function submitName(name: string) {
  const input = await screen.findByLabelText('Your name');
  fireEvent.change(input, { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Join' }));
}

function lastJoin(socket: FakeSocket) {
  const join = socket.emitted.findLast((e) => e.event === 'player:join');
  if (!join) throw new Error('no player:join sent');
  return join;
}

describe('Play', () => {
  it('checks that the room exists before showing the name form', async () => {
    const fetch = stubExists(true);
    renderPlay('/play/wxyz');
    expect(screen.getByRole('heading').textContent).toBe('Checking the room…');
    expect(await screen.findByLabelText('Your name')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('/api/rooms/WXYZ/exists');
  });

  it('an unknown code shows Room not found with a link home, without connecting', async () => {
    stubExists(false);
    const { makeSocket } = renderPlay();
    expect(await screen.findByRole('heading', { name: 'Room not found' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to start' }).getAttribute('href')).toBe('/');
    expect(makeSocket).not.toHaveBeenCalled();
  });

  it('a malformed code shows Room not found without asking the server', () => {
    const fetch = stubExists(true);
    renderPlay('/play/AB1');
    expect(screen.getByRole('heading').textContent).toBe('Room not found');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows a readable message when the server cannot be reached', async () => {
    stubExists(new TypeError('Failed to fetch'));
    renderPlay();
    expect(await screen.findByText(/Could not reach the server/)).toBeTruthy();
  });

  it('past the room-check limit, says to wait a minute instead of showing the form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          Response.json({ ok: false, error: ROOM_CHECK_RATE_LIMITED_ERROR }, { status: 429 }),
        ),
      ),
    );
    renderPlay();
    expect(await screen.findByText('Too many tries. Wait a minute and try again.')).toBeTruthy();
    expect(screen.getByRole('heading').textContent).toBe('Slow down');
    expect(screen.queryByLabelText('Your name')).toBeNull();
  });

  it('the name input allows at most 16 characters', async () => {
    stubExists(true);
    renderPlay();
    const input = await screen.findByLabelText('Your name');
    expect(input.getAttribute('maxlength')).toBe('16');
  });

  it('Join stays disabled until the name has a visible character', async () => {
    stubExists(true);
    renderPlay();
    const input = await screen.findByLabelText('Your name');
    const join = screen.getByRole('button', { name: 'Join' }) as HTMLButtonElement;
    expect(join.disabled).toBe(true);
    fireEvent.change(input, { target: { value: '   ' } });
    expect(join.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'Ana' } });
    expect(join.disabled).toBe(false);
  });

  it('sends player:join with the trimmed name and a new playerId', async () => {
    stubExists(true);
    const { sockets } = renderPlay();
    await submitName('  Ana  ');
    const { payload } = lastJoin(sockets[0]!);
    expect(payload).toEqual({ code: 'WXYZ', playerId: expect.any(String), name: 'Ana' });
    expect((payload as { playerId: string }).playerId).toMatch(/^[\w-]{21}$/);
  });

  it('rejects a name with invisible characters on the form, without joining', async () => {
    stubExists(true);
    const { makeSocket } = renderPlay();
    await submitName('A​na');
    expect(screen.getByRole('alert').textContent).toBe('Name contains invisible characters');
    expect(makeSocket).not.toHaveBeenCalled();
  });

  it('a duplicate name shows "That name is taken" on the form and stores nothing', async () => {
    stubExists(true);
    const { sockets } = renderPlay();
    await submitName('Ana');
    act(() => lastJoin(sockets[0]!).ack({ ok: false, error: 'That name is taken' }));

    expect(screen.getByRole('alert').textContent).toBe('That name is taken');
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Ana');
    expect(sockets[0]!.disconnected).toBe(true);
    expect(loadPlayer('WXYZ')).toBeNull();
  });

  it('a second try after a taken name keeps the same playerId', async () => {
    stubExists(true);
    const { sockets } = renderPlay();
    await submitName('Ana');
    const first = lastJoin(sockets[0]!);
    act(() => first.ack({ ok: false, error: 'That name is taken' }));
    await submitName('Ana B');
    const second = lastJoin(sockets[1]!);
    expect(second.payload).toEqual({ ...(first.payload as object), name: 'Ana B' });
  });

  it('stores the playerId and name per room code once the join succeeds', async () => {
    stubExists(true);
    const { sockets } = renderPlay();
    await submitName('Ana');
    const join = lastJoin(sockets[0]!);
    expect(loadPlayer('WXYZ')).toBeNull();
    act(() => join.ack({ ok: true }));
    const { playerId } = join.payload as { playerId: string };
    expect(loadPlayer('WXYZ')).toEqual({ playerId, name: 'Ana' });
  });

  it('a refresh rejoins automatically as the same player, without the form', async () => {
    stubExists(true);
    savePlayer('WXYZ', { playerId: 'stored-id', name: 'Ana' });
    const { sockets } = renderPlay();
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    expect(lastJoin(sockets[0]!).payload).toEqual({
      code: 'WXYZ',
      playerId: 'stored-id',
      name: 'Ana',
    });
    expect(screen.queryByLabelText('Your name')).toBeNull();
  });

  it('joins again with the same identity after a reconnect', async () => {
    stubExists(true);
    savePlayer('WXYZ', { playerId: 'stored-id', name: 'Ana' });
    const { sockets } = renderPlay();
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    sockets[0]!.fire('connect');
    const joins = sockets[0]!.emitted.filter((e) => e.event === 'player:join');
    expect(joins.map((e) => e.payload)).toEqual([joins[0]!.payload, joins[0]!.payload]);
  });

  it('a kicked player sees "Removed by host" with a link home and stays refused', async () => {
    stubExists(true);
    savePlayer('WXYZ', { playerId: 'stored-id', name: 'Ana' });
    const { sockets } = renderPlay();
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    act(() => lastJoin(sockets[0]!).ack({ ok: false, error: PLAYER_KICKED_ERROR }));
    expect(screen.getByRole('heading').textContent).toBe('Removed by host');
    expect(screen.getByText(PLAYER_KICKED_ERROR)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to start' })).toBeTruthy();
    expect(loadPlayer('WXYZ')).toEqual({ playerId: 'stored-id', name: 'Ana' });
  });

  it('a stored identity the room no longer knows is forgotten and the form comes back', async () => {
    stubExists(true);
    savePlayer('WXYZ', { playerId: 'old-id', name: 'Ana' });
    const { sockets } = renderPlay();
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    act(() => lastJoin(sockets[0]!).ack({ ok: false, error: 'That name is taken' }));
    expect(screen.getByRole('alert').textContent).toBe('That name is taken');
    expect(screen.getByLabelText('Your name')).toBeTruthy();
    expect(loadPlayer('WXYZ')).toBeNull();
  });

  it('after joining from the form, a reconnect rejoins on the same socket as the same player', async () => {
    stubExists(true);
    const { sockets } = renderPlay();
    await submitName('Ana');
    act(() => lastJoin(sockets[0]!).ack({ ok: true }));
    sockets[0]!.fire('connect');
    expect(sockets).toHaveLength(1);
    const joins = sockets[0]!.emitted.filter((e) => e.event === 'player:join');
    expect(joins).toHaveLength(2);
    expect(joins[1]!.payload).toEqual(joins[0]!.payload);
    act(() => joins[1]!.ack({ ok: true }));
    expect(screen.queryByLabelText('Your name')).toBeNull();
  });

  it('a refresh into a room that expired or was lost in a restart shows "This game has ended" with a link home', async () => {
    stubExists(false);
    savePlayer('WXYZ', { playerId: 'stored-id', name: 'Ana' });
    const { makeSocket } = renderPlay();
    expect(await screen.findByRole('heading', { name: GAME_ENDED_ERROR })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to start' }).getAttribute('href')).toBe('/');
    expect(makeSocket).not.toHaveBeenCalled();
    // The identity is stale: a later room may reuse the code.
    expect(loadPlayer('WXYZ')).toBeNull();
  });

  it('mid-game, a rejoin refused with "Room not found" (server restart) shows "This game has ended", not the form', async () => {
    stubExists(true);
    savePlayer('WXYZ', { playerId: 'p1', name: 'Ana' });
    const { sockets } = renderPlay();
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    act(() => lastJoin(sockets[0]!).ack({ ok: true }));
    sockets[0]!.fire('state', playerView({ phase: 'OPEN', questionIndex: 2 }));

    sockets[0]!.fire('connect');
    act(() => lastJoin(sockets[0]!).ack({ ok: false, error: ROOM_NOT_FOUND_ERROR }));
    expect(screen.getByRole('heading').textContent).toBe(GAME_ENDED_ERROR);
    expect(screen.queryByLabelText('Your name')).toBeNull();
    expect(loadPlayer('WXYZ')).toBeNull();
  });

  it('room:closed (the room expired) shows "This game has ended" with a link home', async () => {
    stubExists(true);
    savePlayer('WXYZ', { playerId: 'p1', name: 'Ana' });
    const { sockets } = renderPlay();
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    sockets[0]!.fire('state', playerView());
    sockets[0]!.fire('room:closed', { reason: 'expired' });
    expect(screen.getByRole('heading').textContent).toBe(GAME_ENDED_ERROR);
    expect(screen.getByRole('link', { name: 'Back to start' })).toBeTruthy();
  });

  it('a new player whose room vanished before the join sees "Room not found", not the form', async () => {
    stubExists(true);
    const { sockets } = renderPlay();
    await submitName('Ana');
    act(() => lastJoin(sockets[0]!).ack({ ok: false, error: ROOM_NOT_FOUND_ERROR }));
    expect(screen.getByRole('heading').textContent).toBe(ROOM_NOT_FOUND_ERROR);
    expect(screen.queryByLabelText('Your name')).toBeNull();
  });

  it('lobby shows "Tap to test your buzzer" over a live, muted BUZZ button, with the player\'s name and colour on top', async () => {
    stubExists(true);
    savePlayer('WXYZ', { playerId: 'p1', name: 'Ana' });
    const { sockets } = renderPlay();
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    sockets[0]!.fire('state', playerView());

    const button = screen.getByRole('button', { name: 'BUZZ' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.dataset.look).toBe('practice');
    // Muted: its own darker red, and no pulse.
    expect(button.className).toContain('bg-buzz-muted');
    expect(button.className).not.toContain('animate-buzz-pulse');
    // The state line describes the button, so a screen reader hears it with "BUZZ".
    const status = screen.getByRole('heading', { level: 1 });
    expect(status.textContent).toBe('Tap to test your buzzer');
    expect(screen.getByText('You’re in! Waiting for the host')).toBeTruthy();
    expect(button.getAttribute('aria-describedby')).toBe(status.id);
    const bar = screen.getByRole('banner');
    expect(bar.textContent).toContain('Ana');
    expect(bar.textContent).toContain('Room WXYZ');
    const dot = bar.querySelector<HTMLElement>('[data-player-color]')!;
    expect(dot.style.backgroundColor).toBe(hexToRgb(PLAYER_PALETTE[3]));
    expect(screen.getByLabelText('Score').textContent).toBe('0');
  });

  it('disconnects when the page closes', async () => {
    stubExists(true);
    savePlayer('WXYZ', { playerId: 'p1', name: 'Ana' });
    const { sockets, unmount } = renderPlay();
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    unmount();
    expect(sockets[0]!.disconnected).toBe(true);
  });
});

describe('Play buzzer', () => {
  /** A stored identity rejoins without the form; returns the page's socket. */
  async function joined() {
    stubExists(true);
    savePlayer('WXYZ', { playerId: 'p1', name: 'Ana' });
    const { sockets } = renderPlay();
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    return sockets[0]!;
  }

  const open = (overrides: Partial<PlayerView> = {}) =>
    playerView({ phase: 'OPEN', questionIndex: 0, openingCounter: 1, ...overrides });
  const buzzer = () => screen.getByRole('button', { name: 'BUZZ' }) as HTMLButtonElement;
  /** The state line above the button. */
  const status = () => screen.getByRole('heading', { level: 1 });
  const buzzes = (socket: FakeSocket) => socket.emitted.filter((e) => e.event === 'player:buzz');
  const practices = (socket: FakeSocket) =>
    socket.emitted.filter((e) => e.event === 'player:practice');
  const ring = () => document.querySelector<HTMLElement>('[data-practice-ring]');

  function stubVibrate() {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    return vibrate;
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'vibrate');
    vi.useRealTimers();
  });

  it('a lobby press is a test buzz: it vibrates, plays the ring and sends player:practice, never a buzz', async () => {
    const vibrate = stubVibrate();
    const socket = await joined();
    socket.fire('state', playerView());
    expect(ring()).toBeNull();

    fireEvent.pointerDown(buzzer(), { button: 0 });
    expect(practices(socket)).toHaveLength(1);
    expect(practices(socket)[0]!.payload).toEqual({});
    expect(buzzes(socket)).toHaveLength(0);
    expect(vibrate).toHaveBeenCalledWith(30);
    expect(ring()!.className).toContain('motion-safe:animate-practice-ring');
    // Still a test buzzer: no "Buzzed…".
    expect(status().textContent).toBe('Tap to test your buzzer');
    expect(buzzer().disabled).toBe(false);
  });

  it('every test buzz replays the ring, from a tap or Space, but not from a click', async () => {
    const socket = await joined();
    socket.fire('state', playerView());
    fireEvent.pointerDown(buzzer(), { button: 0 });
    const first = ring();
    fireEvent.keyDown(window, { code: 'Space' });
    fireEvent.keyDown(window, { code: 'Space', repeat: true });
    fireEvent.click(buzzer());
    expect(practices(socket)).toHaveLength(2);
    // A new element, so the animation runs again.
    expect(ring()).not.toBe(first);
    expect(buzzer().dataset.practices).toBe('2');
  });

  it('a refused test buzz shows the reason in a toast', async () => {
    const socket = await joined();
    socket.fire('state', playerView());
    fireEvent.pointerDown(buzzer(), { button: 0 });
    act(() => practices(socket)[0]!.ack({ ok: false, error: 'Too many buzzes' }));
    expect(screen.getByRole('alert').textContent).toBe('Too many buzzes');
    expect(buzzer().disabled).toBe(false);
  });

  it('"Who\'s here" lists the lobby in colour, this phone\'s own name first, the rest in join order', async () => {
    const socket = await joined();
    const lobby = [
      { id: 'p2', name: 'Bo', color: PLAYER_PALETTE[0], connected: true },
      { id: 'p1', name: 'Ana', color: PLAYER_PALETTE[3], connected: true },
      { id: 'p3', name: 'Cy', color: PLAYER_PALETTE[1], connected: false },
    ];
    socket.fire('state', playerView({ lobby, playerCount: 3 }));

    const list = screen.getByRole('region', { name: 'Who’s here · 3' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['Ana(you)', 'Bo', 'Cy']);
    const colours = rows.map(
      (row) => row.querySelector<HTMLElement>('[data-player-color]')!.style.backgroundColor,
    );
    expect(colours).toEqual(
      [PLAYER_PALETTE[3], PLAYER_PALETTE[0], PLAYER_PALETTE[1]].map((c) => hexToRgb(c!)),
    );
    // A disconnected player stays listed, dimmed, as on the Screen.
    expect(rows.map((row) => row.className.includes('opacity-40'))).toEqual([false, false, true]);
  });

  it('"Who\'s here" follows the lobby as players join, and goes once the game starts', async () => {
    const socket = await joined();
    socket.fire('state', playerView());
    const names = () =>
      within(screen.getByRole('region', { name: /Who’s here/ }))
        .getAllByRole('listitem')
        .map((row) => row.textContent);
    expect(names()).toEqual(['Ana(you)']);

    const bo = { id: 'p2', name: 'Bo', color: PLAYER_PALETTE[0], connected: true };
    socket.fire('state', playerView({ lobby: [...playerView().lobby!, bo], playerCount: 2 }));
    expect(names()).toEqual(['Ana(you)', 'Bo']);

    socket.fire('state', playerView({ phase: 'QUESTION', questionIndex: 0 }));
    expect(screen.queryByRole('region', { name: /Who’s here/ })).toBeNull();
    expect(buzzer().disabled).toBe(true);
    fireEvent.pointerDown(buzzer(), { button: 0 });
    expect(practices(socket)).toHaveLength(0);
  });

  it('says "Get ready…" on a grey, disabled button while buzzers are locked', async () => {
    const socket = await joined();
    socket.fire('state', playerView({ phase: 'QUESTION', questionIndex: 0 }));
    expect(status().textContent).toBe('Get ready…');
    expect(buzzer().disabled).toBe(true);
    expect(buzzer().dataset.look).toBe('idle');
  });

  it('shows "Buzzers open!" over a bright, pulsing BUZZ button while buzzers are open', async () => {
    const socket = await joined();
    socket.fire('state', open());
    expect(status().textContent).toBe('Buzzers open!');
    expect(screen.getByText('Question 1 of 10 · tap to buzz in')).toBeTruthy();
    expect(buzzer().textContent).toBe('BUZZ');
    expect(buzzer().className).toContain('bg-buzz');
    expect(buzzer().disabled).toBe(false);
    // Guarded, so reduced motion keeps the button still.
    expect(buzzer().className).toContain('motion-safe:animate-buzz-pulse');
  });

  it('a player who joined this opening gets a grey, disabled button and cannot buzz', async () => {
    const socket = await joined();
    for (const phase of ['OPEN', 'COLLECTING'] as const) {
      socket.fire('state', open({ phase, canBuzz: false }));
      expect(status().textContent).toBe('Get ready… you can buzz from the next question');
      expect(buzzer().disabled).toBe(true);
      expect(buzzer().dataset.look).toBe('idle');

      fireEvent.pointerDown(buzzer(), { button: 0 });
      fireEvent.keyDown(window, { code: 'Space' });
      expect(buzzes(socket)).toHaveLength(0);
    }
  });

  it('a press shows "Buzzed…" and vibrates for 30 ms before the server replies', async () => {
    const vibrate = stubVibrate();
    const socket = await joined();
    socket.fire('state', open());

    fireEvent.pointerDown(buzzer(), { button: 0 });

    expect(buzzes(socket)).toHaveLength(1);
    expect(status().textContent).toBe('Buzzed…');
    expect(buzzer().dataset.look).toBe('pressed');
    expect(vibrate).toHaveBeenCalledWith(30);
  });

  it('buzzes on pointerdown, not on click', async () => {
    const socket = await joined();
    socket.fire('state', open());
    fireEvent.click(buzzer());
    expect(buzzes(socket)).toHaveLength(0);
  });

  it('a second press in the same opening sends nothing more', async () => {
    const socket = await joined();
    socket.fire('state', open());
    fireEvent.pointerDown(buzzer(), { button: 0 });
    fireEvent.pointerDown(buzzer(), { button: 0 });
    fireEvent.keyDown(window, { code: 'Space' });
    expect(buzzes(socket)).toHaveLength(1);
  });

  it('Space buzzes once; holding it down does not send again', async () => {
    const socket = await joined();
    socket.fire('state', open());
    fireEvent.keyDown(window, { code: 'Space' });
    fireEvent.keyDown(window, { code: 'Space', repeat: true });
    expect(buzzes(socket)).toHaveLength(1);
    expect(status().textContent).toBe('Buzzed…');
  });

  it('Space does nothing while buzzers are locked', async () => {
    const socket = await joined();
    socket.fire('state', playerView({ phase: 'QUESTION', questionIndex: 0 }));
    fireEvent.keyDown(window, { code: 'Space' });
    expect(buzzes(socket)).toHaveLength(0);
  });

  it('a refused buzz frees the button to try again', async () => {
    const socket = await joined();
    socket.fire('state', open());
    fireEvent.pointerDown(buzzer(), { button: 0 });
    act(() => buzzes(socket)[0]!.ack({ ok: false, error: 'Too many buzzes' }));
    expect(status().textContent).toBe('Buzzers open!');
  });

  it('a refused buzz shows the reason in a toast that hides itself', async () => {
    const socket = await joined();
    socket.fire('state', open());
    vi.useFakeTimers();
    fireEvent.pointerDown(buzzer(), { button: 0 });
    act(() => buzzes(socket)[0]!.ack({ ok: false, error: 'Too many buzzes' }));
    expect(screen.getByRole('alert').textContent).toBe('Too many buzzes');
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('an accepted buzz shows no toast', async () => {
    const socket = await joined();
    socket.fire('state', open());
    fireEvent.pointerDown(buzzer(), { button: 0 });
    act(() => buzzes(socket)[0]!.ack({ ok: true }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('the connection dot is green, amber while reconnecting, red after 5 s down, then green again', async () => {
    const socket = await joined();
    socket.fire('state', open());
    const dot = () => within(screen.getByRole('banner')).getByRole('status');
    expect(dot().getAttribute('aria-label')).toBe('Connected');
    expect(dot().className).toContain('bg-win');

    vi.useFakeTimers();
    socket.fire('disconnect', 'transport close');
    expect(dot().getAttribute('aria-label')).toBe('Reconnecting…');
    expect(dot().className).toContain('bg-warn');
    act(() => vi.advanceTimersByTime(OFFLINE_AFTER_MS - 1));
    expect(dot().className).toContain('bg-warn');
    act(() => vi.advanceTimersByTime(1));
    expect(dot().getAttribute('aria-label')).toBe('Offline');
    expect(dot().className).toContain('bg-buzz');

    socket.fire('connect');
    expect(dot().getAttribute('aria-label')).toBe('Connected');
    // The reconnect stopped the clock: the dot stays green.
    act(() => vi.advanceTimersByTime(OFFLINE_AFTER_MS));
    expect(dot().getAttribute('aria-label')).toBe('Connected');
  });

  it('holds a screen wake lock while the buzzer shows, and lets it go on leaving', async () => {
    const held: string[] = [];
    const request = vi.fn((type: string) => {
      held.push(type);
      return Promise.resolve({
        released: false,
        release: () => (held.pop(), Promise.resolve()),
      });
    });
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    try {
      const socket = await joined();
      socket.fire('state', playerView());
      await act(() => Promise.resolve());
      expect(held).toEqual(['screen']);

      cleanup();
      expect(held).toEqual([]);
    } finally {
      Reflect.deleteProperty(navigator, 'wakeLock');
    }
  });

  it('stays "Buzzed…" through the window, and a new opening brings "Buzzers open!" back', async () => {
    const socket = await joined();
    socket.fire('state', open());
    fireEvent.pointerDown(buzzer(), { button: 0 });
    act(() => buzzes(socket)[0]!.ack({ ok: true }));
    socket.fire('state', open({ phase: 'COLLECTING', hasBuzzed: true }));
    expect(status().textContent).toBe('Buzzed…');

    socket.fire('state', open({ openingCounter: 2 }));
    expect(status().textContent).toBe('Buzzers open!');
  });

  it('the winner sees "You\'re first! Answer now" on a red panel', async () => {
    const socket = await joined();
    socket.fire(
      'state',
      open({ phase: 'BUZZED', hasBuzzed: true, winnerId: 'p1', winnerName: 'Ana' }),
    );
    expect(status().textContent).toBe('You’re first! Answer now');
    expect(buzzer().dataset.look).toBe('won');
    expect(screen.getByRole('region', { name: 'Your turn' }).className).toContain('bg-buzz');
    expect(buzzer().disabled).toBe(true);
  });

  it('with an answer time, the winner sees the seconds count down, then "Time\'s up!"', async () => {
    const socket = await joined();
    vi.useFakeTimers();
    const won = open({
      phase: 'BUZZED',
      hasBuzzed: true,
      winnerId: 'p1',
      winnerName: 'Ana',
      answerTimer: { seconds: 3, up: false },
    });
    socket.fire('state', won);
    const secondsLeft = () =>
      within(screen.getByRole('region', { name: 'Your turn' })).getByLabelText('Seconds left')
        .textContent;
    expect(status().textContent).toContain('You’re first! Answer now');
    expect(secondsLeft()).toBe('3');
    act(() => vi.advanceTimersByTime(1000));
    expect(secondsLeft()).toBe('2');

    socket.fire('state', { ...won, answerTimer: { seconds: 3, up: true } });
    expect(status().textContent).toBe('Time’s up!');
    expect(buzzer().dataset.look).toBe('won');
  });

  it('with an answer time, everyone else still sees only the winner’s name', async () => {
    const socket = await joined();
    const lost = open({ phase: 'BUZZED', winnerId: 'p2', winnerName: 'Ben' });
    socket.fire('state', { ...lost, answerTimer: { seconds: 3, up: false } });
    expect(status().textContent).toBe('Ben buzzed first');
    socket.fire('state', { ...lost, answerTimer: { seconds: 3, up: true } });
    expect(status().textContent).toBe('Ben buzzed first');
  });

  describe('with a buzz time', () => {
    const buzzTime = () => screen.queryByRole('timer', { name: 'Buzz time' });

    it('shows the seconds left under the button while the buzzers are open', async () => {
      const socket = await joined();
      vi.useFakeTimers();
      socket.fire('state', open({ openingCounter: 1, buzzTimer: { seconds: 5 } }));
      expect(buzzer().compareDocumentPosition(buzzTime()!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(buzzTime()?.textContent).toBe('5seconds to buzz');
      act(() => vi.advanceTimersByTime(2000));
      expect(buzzTime()?.textContent).toBe('3seconds to buzz');
      act(() => vi.advanceTimersByTime(2000));
      expect(buzzTime()?.textContent).toBe('1second to buzz');
      expect(buzzer().dataset.look).toBe('live');
    });

    it('goes once someone buzzes, and shows the answer at time up', async () => {
      const socket = await joined();
      socket.fire('state', open({ openingCounter: 1, buzzTimer: { seconds: 5 } }));
      socket.fire('state', open({ phase: 'BUZZED', winnerId: 'p2', winnerName: 'Ben' }));
      expect(buzzTime()).toBeNull();
      socket.fire('state', open({ phase: 'REVEAL', answer: 'Paris', canBuzz: false }));
      expect(buzzTime()).toBeNull();
      expect(status().textContent).toBe('Paris');
    });

    it('is absent with no buzz time', async () => {
      const socket = await joined();
      socket.fire('state', open());
      expect(buzzTime()).toBeNull();
    });
  });

  it("everyone else sees the winner's name on a dim button", async () => {
    const socket = await joined();
    socket.fire('state', open({ phase: 'BUZZED', winnerId: 'p2', winnerName: 'Ben' }));
    expect(status().textContent).toBe('Ben buzzed first');
    expect(buzzer().dataset.look).toBe('lost');
    expect(buzzer().disabled).toBe(true);
  });

  it('blocks zoom, text selection and the long-press menu on the button', async () => {
    const socket = await joined();
    socket.fire('state', open());
    // fireEvent returns false when a handler called preventDefault.
    expect(fireEvent.contextMenu(buzzer())).toBe(false);
    expect(buzzer().className).toMatch(/\btouch-none\b/);
    expect(buzzer().className).toMatch(/\bselect-none\b/);
    expect(buzzer().className).toContain('[-webkit-touch-callout:none]');
  });

  it('pings every PING_INTERVAL_MS from connect and acks every pong', async () => {
    vi.useFakeTimers();
    const socket = await joined();
    const pings = () => socket.emitted.filter((e) => e.event === 'ping');

    vi.advanceTimersByTime(PING_INTERVAL_MS * 3);
    expect(pings()).toHaveLength(3);

    const ack = vi.fn();
    socket.fire('pong', pings()[2]!.payload, ack);
    expect(ack).toHaveBeenCalledOnce();
  });
});

/** jsdom reports inline colours as `rgb(r, g, b)`. */
function hexToRgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

describe('Play result states', () => {
  async function joined() {
    stubExists(true);
    savePlayer('WXYZ', { playerId: 'p1', name: 'Ana' });
    const { sockets } = renderPlay();
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    return sockets[0]!;
  }

  it('a locked-out player sees a red X, "Locked out this round" and a desaturated, disabled button', async () => {
    const socket = await joined();
    socket.fire(
      'state',
      playerView({ phase: 'OPEN', questionIndex: 0, openingCounter: 2, lockedOut: true }),
    );
    const button = screen.getByRole('button', { name: 'BUZZ' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.dataset.look).toBe('out');
    expect(button.className).toContain('bg-surface');
    expect(button.className).not.toContain('bg-buzz');
    const status = screen.getByRole('heading', { level: 1 });
    expect(status.textContent).toBe('Locked out this round');
    expect(status.querySelector('svg')?.getAttribute('class')).toContain('text-buzz');
  });

  it('shows the answer and "+100" at reveal when this player scored', async () => {
    const socket = await joined();
    socket.fire(
      'state',
      playerView({
        phase: 'REVEAL',
        questionIndex: 0,
        answer: 'Canberra',
        pointsThisQuestion: 100,
        me: { id: 'p1', name: 'Ana', color: PLAYER_PALETTE[3], score: 100, rank: 1 },
      }),
    );
    const button = screen.getByRole('button', { name: 'BUZZ' }) as HTMLButtonElement;
    expect(button.dataset.look).toBe('revealed');
    const card = screen.getByRole('region', { name: 'Answer' });
    expect(within(card).getByRole('heading', { level: 1 }).textContent).toBe('Canberra');
    expect(within(card).getByText('+100').className).toContain('text-win');
    expect(screen.getByLabelText('Score').textContent).toBe('100');
  });

  it('shows the answer without points at reveal when this player did not score', async () => {
    const socket = await joined();
    socket.fire('state', playerView({ phase: 'REVEAL', questionIndex: 0, answer: 'Canberra' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Canberra');
    expect(screen.queryByText(/^[+−]/)).toBeNull();
  });

  it('shows the final rank and score when the game is over, with no buzzer', async () => {
    const socket = await joined();
    socket.fire(
      'state',
      playerView({
        phase: 'FINAL',
        questionIndex: 9,
        playerCount: 4,
        me: { id: 'p1', name: 'Ana', color: PLAYER_PALETTE[3], score: 300, rank: 2 },
      }),
    );
    const result = screen.getByRole('region', { name: 'Final result' });
    expect(within(result).getByText('2nd of 4')).toBeTruthy();
    expect(within(result).getByText('300 points')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'BUZZ' })).toBeNull();
  });

  it('shows "Removed by host" with a link home when kicked, and does not join again', async () => {
    const socket = await joined();
    act(() => lastJoin(socket).ack({ ok: true }));
    socket.fire('state', playerView({ phase: 'OPEN', questionIndex: 0, openingCounter: 1 }));

    socket.fire('kicked', {});
    expect(screen.getByRole('heading').textContent).toBe('Removed by host');
    expect(screen.getByText(PLAYER_KICKED_ERROR)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to start' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(socket.emitted.filter((e) => e.event === 'player:join')).toHaveLength(1);
  });
});

describe('Play menu, rename, leave and haptics', () => {
  async function joined() {
    stubExists(true);
    savePlayer('WXYZ', { playerId: 'p1', name: 'Ana' });
    const { sockets } = renderPlay();
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    const socket = sockets[0]!;
    act(() => lastJoin(socket).ack({ ok: true }));
    return { socket, sockets };
  }

  const sent = (socket: FakeSocket, event: string) =>
    socket.emitted.filter((e) => e.event === event);
  const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
  const menuItem = (name: string) => screen.queryByRole('button', { name });

  function stubVibrate() {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    return vibrate;
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'vibrate');
  });

  it('the top bar menu offers Change name and Leave game in the lobby', async () => {
    const { socket } = await joined();
    socket.fire('state', playerView());
    expect(menuItem('Change name')).toBeNull();

    openMenu();
    expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe('true');
    expect(menuItem('Change name')).toBeTruthy();
    expect(menuItem('Leave game')).toBeTruthy();
  });

  it('mid-game the menu offers only Leave game', async () => {
    const { socket } = await joined();
    socket.fire('state', playerView({ phase: 'OPEN', questionIndex: 0, openingCounter: 1 }));
    openMenu();
    expect(menuItem('Change name')).toBeNull();
    expect(menuItem('Leave game')).toBeTruthy();
  });

  it('a tap outside closes the menu without buzzing, and Space does not buzz while it is open', async () => {
    const { socket } = await joined();
    socket.fire('state', playerView({ phase: 'OPEN', questionIndex: 0, openingCounter: 1 }));
    openMenu();
    fireEvent.keyDown(window, { code: 'Space' });
    fireEvent.pointerDown(document.querySelector('[data-menu-backdrop]')!, { button: 0 });
    expect(menuItem('Leave game')).toBeNull();
    expect(sent(socket, 'player:buzz')).toHaveLength(0);
  });

  it('Change name sends player:rename with the trimmed name, then closes and stores it', async () => {
    const { socket } = await joined();
    socket.fire('state', playerView());
    openMenu();
    fireEvent.click(menuItem('Change name')!);

    const input = screen.getByLabelText('Your name') as HTMLInputElement;
    expect(input.value).toBe('Ana');
    fireEvent.change(input, { target: { value: '  Annie ' } });
    // Typing a space in the field is not a test buzz.
    fireEvent.keyDown(input, { code: 'Space', key: ' ' });
    expect(sent(socket, 'player:practice')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(sent(socket, 'player:rename').map((e) => e.payload)).toEqual([{ name: 'Annie' }]);
    act(() => sent(socket, 'player:rename')[0]!.ack({ ok: true }));
    expect(screen.queryByRole('heading', { name: 'Change name' })).toBeNull();
    expect(loadPlayer('WXYZ')).toEqual({ playerId: 'p1', name: 'Annie' });
  });

  it('a taken name stays on the Change name form with "That name is taken"', async () => {
    const { socket } = await joined();
    socket.fire('state', playerView());
    openMenu();
    fireEvent.click(menuItem('Change name')!);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Bo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    act(() => sent(socket, 'player:rename')[0]!.ack({ ok: false, error: 'That name is taken' }));

    expect(screen.getByRole('alert').textContent).toBe('That name is taken');
    expect(screen.getByRole('heading', { name: 'Change name' })).toBeTruthy();
    expect(loadPlayer('WXYZ')).toEqual({ playerId: 'p1', name: 'Ana' });
  });

  it('a name with invisible characters is refused on the form, without sending', async () => {
    const { socket } = await joined();
    socket.fire('state', playerView());
    openMenu();
    fireEvent.click(menuItem('Change name')!);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ana​' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toBe('Name contains invisible characters');
    expect(sent(socket, 'player:rename')).toHaveLength(0);
  });

  it('the Change name form closes when the game starts', async () => {
    const { socket } = await joined();
    socket.fire('state', playerView());
    openMenu();
    fireEvent.click(menuItem('Change name')!);
    socket.fire('state', playerView({ phase: 'QUESTION', questionIndex: 0 }));
    expect(screen.queryByRole('heading', { name: 'Change name' })).toBeNull();
  });

  it('Leave game asks to confirm, sends player:leave, then forgets the room and shows the join form', async () => {
    const { socket, sockets } = await joined();
    socket.fire('state', playerView({ phase: 'OPEN', questionIndex: 0, openingCounter: 1 }));
    openMenu();
    fireEvent.click(menuItem('Leave game')!);
    expect(sent(socket, 'player:leave')).toHaveLength(0);
    fireEvent.click(menuItem('Confirm leave')!);
    expect(sent(socket, 'player:leave').map((e) => e.payload)).toEqual([{}]);

    act(() => sent(socket, 'player:leave')[0]!.ack({ ok: true }));
    expect(loadPlayer('WXYZ')).toBeNull();
    expect(socket.disconnected).toBe(true);
    const input = screen.getByLabelText('Your name') as HTMLInputElement;
    expect(input.value).toBe('Ana');

    // Joining again is a new player: a new socket and a new playerId.
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    await vi.waitFor(() => expect(sockets).toHaveLength(2));
    const rejoin = lastJoin(sockets[1]!).payload as { playerId: string; name: string };
    expect(rejoin.name).toBe('Ana');
    expect(rejoin.playerId).not.toBe('p1');
  });

  it('a refused leave keeps the player in and shows the reason in a toast', async () => {
    const { socket } = await joined();
    socket.fire('state', playerView());
    openMenu();
    fireEvent.click(menuItem('Leave game')!);
    fireEvent.click(menuItem('Confirm leave')!);
    act(() => sent(socket, 'player:leave')[0]!.ack({ ok: false, error: 'Unknown player' }));
    expect(screen.getByRole('alert').textContent).toBe('Unknown player');
    expect(loadPlayer('WXYZ')).toEqual({ playerId: 'p1', name: 'Ana' });
    expect(screen.getByRole('button', { name: 'BUZZ' })).toBeTruthy();
  });

  it('vibrates twice short on its own correct answer and once long on its own wrong one', async () => {
    const vibrate = stubVibrate();
    const { socket } = await joined();
    socket.fire('state', playerView({ phase: 'BUZZED', questionIndex: 0, openingCounter: 1 }));

    socket.fire('fx', { kind: 'correct', playerId: 'p1', points: 100 });
    expect(vibrate).toHaveBeenLastCalledWith([60, 80, 60]);
    socket.fire('fx', { kind: 'wrong', playerId: 'p1' });
    expect(vibrate).toHaveBeenLastCalledWith(400);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it("does not vibrate for another player's outcome or for other effects", async () => {
    const vibrate = stubVibrate();
    const { socket } = await joined();
    socket.fire('state', playerView({ phase: 'BUZZED', questionIndex: 0, openingCounter: 1 }));
    socket.fire('fx', { kind: 'correct', playerId: 'p2', points: 100 });
    socket.fire('fx', { kind: 'wrong', playerId: 'p2' });
    socket.fire('fx', { kind: 'timeUp', playerId: 'p1' });
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('works where the phone cannot vibrate', async () => {
    const { socket } = await joined();
    socket.fire('state', playerView({ phase: 'BUZZED', questionIndex: 0, openingCounter: 1 }));
    expect(() => socket.fire('fx', { kind: 'wrong', playerId: 'p1' })).not.toThrow();
  });
});
