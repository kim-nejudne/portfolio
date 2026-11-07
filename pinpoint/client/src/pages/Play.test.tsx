// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_ENDED_ERROR, KICKED_ERROR } from '#shared/constants.js';
import type { Ack, PlayerView, PublicPlayer } from '#shared/types.js';
import { loadPlayer, savePlayer } from '../lib/playerIdentity.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { ordinal, Play } from './Play.js';

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
    paused: null,
    rematchAt: null,
    region: null,
    round: null,
    myResult: null,
    vip: null,
    ...overrides,
  };
}

let socket: FakeSocket;

function stubExists(takenEmoji: string[] = [], exists = true) {
  const fetch = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ exists, phase: 'LOBBY', full: false, takenEmoji })),
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

beforeEach(() => localStorage.clear());

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
