// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAYER_KICKED_ERROR, PLAYER_PALETTE } from '../../../shared/constants.js';
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

  it('a kicked player sees the message with a link home and stays refused', async () => {
    stubExists(true);
    savePlayer('WXYZ', { playerId: 'stored-id', name: 'Ana' });
    const { sockets } = renderPlay();
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    act(() => lastJoin(sockets[0]!).ack({ ok: false, error: PLAYER_KICKED_ERROR }));
    expect(screen.getByRole('heading').textContent).toBe(PLAYER_KICKED_ERROR);
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

  it('forgets the stored identity when the room no longer exists', async () => {
    stubExists(false);
    savePlayer('WXYZ', { playerId: 'stored-id', name: 'Ana' });
    renderPlay();
    await screen.findByText('Room not found');
    expect(loadPlayer('WXYZ')).toBeNull();
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

/** jsdom reports inline colours as `rgb(r, g, b)`. */
function hexToRgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}
