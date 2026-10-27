// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GAME_ENDED_ERROR,
  PING_INTERVAL_MS,
  PLAYER_KICKED_ERROR,
  PLAYER_PALETTE,
  ROOM_NOT_FOUND_ERROR,
} from '../../../shared/constants.js';
import type { PlayerView } from '../../../shared/types.js';
import { loadPlayer, savePlayer } from '../lib/playerIdentity.js';
import type { GameSocket } from '../lib/socket.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { Play } from './Play.js';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
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
  return {
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
    ...overrides,
  };
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

  it('lobby shows the grey "You\'re in! Waiting for the host" button under a bar in the player\'s colour', async () => {
    stubExists(true);
    savePlayer('WXYZ', { playerId: 'p1', name: 'Ana' });
    const { sockets } = renderPlay();
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    sockets[0]!.fire('state', playerView());

    const button = screen.getByRole('button', {
      name: 'You’re in! Waiting for the host',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const bar = screen.getByRole('banner');
    expect(bar.textContent).toContain('Ana');
    expect(bar.style.backgroundColor).toBe(hexToRgb(PLAYER_PALETTE[3]));
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
  const buzzer = () => screen.getByRole('button') as HTMLButtonElement;
  const buzzes = (socket: FakeSocket) => socket.emitted.filter((e) => e.event === 'player:buzz');

  function stubVibrate() {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    return vibrate;
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'vibrate');
    vi.useRealTimers();
  });

  it('says "Get ready…" on a grey, disabled button while buzzers are locked', async () => {
    const socket = await joined();
    socket.fire('state', playerView({ phase: 'QUESTION', questionIndex: 0 }));
    expect(buzzer().textContent).toBe('Get ready…');
    expect(buzzer().disabled).toBe(true);
    expect(buzzer().dataset.look).toBe('idle');
  });

  it('shows a bright, pulsing "BUZZ!" while buzzers are open', async () => {
    const socket = await joined();
    socket.fire('state', open());
    expect(buzzer().textContent).toBe('BUZZ!');
    expect(buzzer().disabled).toBe(false);
    // Guarded, so reduced motion keeps the button still.
    expect(buzzer().className).toContain('motion-safe:animate-buzz-pulse');
  });

  it('a press shows "Buzzed…" and vibrates for 30 ms before the server replies', async () => {
    const vibrate = stubVibrate();
    const socket = await joined();
    socket.fire('state', open());

    fireEvent.pointerDown(buzzer(), { button: 0 });

    expect(buzzes(socket)).toHaveLength(1);
    expect(buzzer().textContent).toBe('Buzzed…');
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
    expect(buzzer().textContent).toBe('Buzzed…');
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
    expect(buzzer().textContent).toBe('BUZZ!');
  });

  it('stays "Buzzed…" through the window, and a new opening brings "BUZZ!" back', async () => {
    const socket = await joined();
    socket.fire('state', open());
    fireEvent.pointerDown(buzzer(), { button: 0 });
    act(() => buzzes(socket)[0]!.ack({ ok: true }));
    socket.fire('state', open({ phase: 'COLLECTING', hasBuzzed: true }));
    expect(buzzer().textContent).toBe('Buzzed…');

    socket.fire('state', open({ openingCounter: 2 }));
    expect(buzzer().textContent).toBe('BUZZ!');
  });

  it('the winner sees a green "You\'re first! Answer now"', async () => {
    const socket = await joined();
    socket.fire(
      'state',
      open({ phase: 'BUZZED', hasBuzzed: true, winnerId: 'p1', winnerName: 'Ana' }),
    );
    expect(buzzer().textContent).toBe('You’re first! Answer now');
    expect(buzzer().dataset.look).toBe('won');
    expect(buzzer().className).toContain('bg-win');
  });

  it("everyone else sees the winner's name on a dim button", async () => {
    const socket = await joined();
    socket.fire('state', open({ phase: 'BUZZED', winnerId: 'p2', winnerName: 'Ben' }));
    expect(buzzer().textContent).toBe('Ben buzzed first');
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

  it('a locked-out player sees a dark, disabled button with an X and "Locked out this round"', async () => {
    const socket = await joined();
    socket.fire(
      'state',
      playerView({ phase: 'OPEN', questionIndex: 0, openingCounter: 2, lockedOut: true }),
    );
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.dataset.look).toBe('out');
    expect(button.className).toContain('bg-bg');
    expect(button.textContent).toBe('✕Locked out this round');
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
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.dataset.look).toBe('revealed');
    expect(within(button).getByText('Canberra')).toBeTruthy();
    expect(within(button).getByText('+100').className).toContain('text-win');
    expect(screen.getByLabelText('Score').textContent).toBe('100');
  });

  it('shows the answer without points at reveal when this player did not score', async () => {
    const socket = await joined();
    socket.fire('state', playerView({ phase: 'REVEAL', questionIndex: 0, answer: 'Canberra' }));
    expect(screen.getByRole('button').textContent).toBe('Canberra');
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
    expect(screen.queryByRole('button')).toBeNull();
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
