// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_ENDED_ERROR } from '#shared/constants.js';
import type { PublicPlayer, ScreenView } from '#shared/types.js';
import { useRoomStore } from '../lib/roomStore.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { Screen, stageScale } from './Screen.js';

const NOW = 1_800_000_000_000;

function lobbyView(players: PublicPlayer[] = []): ScreenView {
  return {
    role: 'screen',
    serverNow: NOW + 2500,
    code: 'WXYZ',
    joinUrl: 'https://pinpoint.kimnejudne.dev/play/WXYZ',
    phase: 'LOBBY',
    players,
    settings: { categoryId: '', mode: 'name', difficulty: 'mixed', rounds: 10, timerSeconds: 30 },
    paused: null,
    rematchAt: null,
    region: null,
    round: null,
    reveal: null,
    standings: null,
    final: null,
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
