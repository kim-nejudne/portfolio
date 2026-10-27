// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, PLAYER_PALETTE } from '../../../shared/constants.js';
import type { RankedPlayer, ScreenView } from '../../../shared/types.js';
import { loadHostToken, saveHostToken } from '../lib/hostTokens.js';
import type { GameSocket } from '../lib/socket.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { Screen } from './Screen.js';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function player(n: number, overrides: Partial<RankedPlayer> = {}): RankedPlayer {
  return {
    id: `p${n}`,
    name: `Player ${n}`,
    color: PLAYER_PALETTE[n % PLAYER_PALETTE.length]!,
    score: 0,
    connected: true,
    rank: 1,
    ...overrides,
  };
}

function lobbyView(players: RankedPlayer[] = [], overrides: Partial<ScreenView> = {}): ScreenView {
  return {
    role: 'screen',
    code: 'WXYZ',
    title: 'Sample quiz',
    phase: 'LOBBY',
    questionIndex: -1,
    questionCount: 10,
    openingCounter: 0,
    players,
    winnerId: null,
    alsoBuzzed: [],
    lockedOut: [],
    showScoreboard: false,
    settings: DEFAULT_SETTINGS,
    question: null,
    ...overrides,
  };
}

function renderScreen(path = '/screen/WXYZ') {
  const socket = new FakeSocket();
  const makeSocket = vi.fn(() => socket as unknown as GameSocket);
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/screen/:code" element={<Screen makeSocket={makeSocket} />} />
      </Routes>
    </MemoryRouter>,
  );
  return { socket, makeSocket, unmount: view.unmount };
}

const joinUrl = `${window.location.host}/play/WXYZ`;

describe('Screen', () => {
  it('joins the room from the URL as a Screen', () => {
    const { socket } = renderScreen('/screen/wxyz');
    expect(socket.emitted).toHaveLength(1);
    expect(socket.emitted[0]).toMatchObject({ event: 'screen:join', payload: { code: 'WXYZ' } });
  });

  it('sends the stored hostToken when this device created the room', () => {
    const hostToken = 'h'.repeat(43);
    saveHostToken('WXYZ', hostToken);
    const { socket } = renderScreen();
    expect(socket.emitted[0]?.payload).toEqual({ code: 'WXYZ', hostToken });
  });

  it('drops a stale hostToken and joins as a plain Screen when the server rejects it', () => {
    saveHostToken('WXYZ', 's'.repeat(43));
    const { socket } = renderScreen();
    act(() => socket.emitted[0]!.ack({ ok: false, error: 'Invalid host token' }));
    expect(socket.emitted[1]).toMatchObject({ event: 'screen:join', payload: { code: 'WXYZ' } });
    expect(socket.emitted[1]!.payload).not.toHaveProperty('hostToken');
    expect(loadHostToken('WXYZ')).toBeNull();
    socket.fire('state', lobbyView());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('WXYZ');
  });

  it('joins again after a reconnect', () => {
    const { socket } = renderScreen();
    socket.fire('connect');
    expect(socket.emitted.map((e) => e.event)).toEqual(['screen:join', 'screen:join']);
  });

  it('shows Connecting until the first state arrives', () => {
    renderScreen();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Connecting…');
  });

  it('lobby shows the huge code, the join URL and a QR to /play/<CODE>', () => {
    const { socket } = renderScreen();
    socket.fire('state', lobbyView());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('WXYZ');
    const main = screen.getByRole('main');
    expect(within(main).getAllByText(joinUrl).length).toBeGreaterThan(0);
    expect(screen.getByTitle(`Join at http://${joinUrl}`)).toBeTruthy();
    expect(screen.getByText('Waiting for players…')).toBeTruthy();
  });

  it('warns that phones cannot open a localhost join URL', () => {
    const { socket } = renderScreen();
    socket.fire('state', lobbyView());
    expect(screen.getByRole('note').textContent).toContain('Phones can’t open localhost');
  });

  it('player chips appear live, in each player’s colour', () => {
    const { socket } = renderScreen();
    socket.fire('state', lobbyView([player(1)]));
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Player 1']);

    socket.fire('state', lobbyView([player(1), player(2)]));
    const chips = screen.getAllByRole('listitem');
    expect(chips.map((li) => li.textContent)).toEqual(['Player 1', 'Player 2']);
    expect(chips[1]!.style.backgroundColor).not.toBe('');
    expect(chips[0]!.style.backgroundColor).not.toBe(chips[1]!.style.backgroundColor);
    expect(screen.getByText('2 players')).toBeTruthy();
  });

  it('bottom strip shows the code and "Join at <url>" in the lobby and in a game', () => {
    const { socket } = renderScreen();
    socket.fire('state', lobbyView());
    let strip = screen.getByRole('contentinfo');
    expect(strip.textContent).toBe(`Room WXYZJoin at ${joinUrl}`);

    socket.fire('state', lobbyView([], { phase: 'QUESTION', questionIndex: 0 }));
    strip = screen.getByRole('contentinfo');
    expect(strip.textContent).toBe(`Room WXYZJoin at ${joinUrl}`);
  });

  it('shows the join error, such as an unknown room, with a link home', () => {
    const { socket } = renderScreen();
    act(() => socket.emitted[0]!.ack({ ok: false, error: 'Room not found' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Room not found');
    expect(screen.getByRole('link', { name: 'Back to start' }).getAttribute('href')).toBe('/');
  });

  it('a malformed code shows Room not found without connecting', () => {
    const { makeSocket } = renderScreen('/screen/AB1');
    expect(makeSocket).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Room not found');
  });

  it('disconnects when the page closes', () => {
    const { socket, unmount } = renderScreen();
    unmount();
    expect(socket.disconnected).toBe(true);
  });
});
