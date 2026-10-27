// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSocket } from '../lib/socket.js';
import { FakeSocket } from '../test/fakeSocket.js';
import DevBots from './DevBots.js';

let sockets: FakeSocket[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  sockets = [];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderAt(path: string, random = () => 0.5) {
  const makeSocket = () => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket as unknown as GameSocket;
  };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/dev/bots/:code"
          element={<DevBots makeSocket={makeSocket} random={random} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function spawn(count: number) {
  fireEvent.change(screen.getByLabelText('Number of bots'), { target: { value: String(count) } });
  fireEvent.click(screen.getByRole('button', { name: 'Spawn' }));
}

const rows = () => within(screen.getByRole('list', { name: 'Bots' })).queryAllByRole('listitem');
const joinIds = (s: FakeSocket) =>
  s.emitted
    .filter((e) => e.event === 'player:join')
    .map((e) => (e.payload as { playerId: string }).playerId);

describe('DevBots', () => {
  it('spawns the requested number of bots, each its own socket joining the room', () => {
    renderAt('/dev/bots/abcd');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bots for ABCD');
    spawn(8);

    expect(rows()).toHaveLength(8);
    expect(sockets.flatMap(joinIds)).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((i) => `bot-${i}`));

    act(() => sockets[0]!.emitted[0]!.ack({ ok: true }));
    expect(rows()[0]!.textContent).toContain('joined');
    expect(rows()[1]!.textContent).toContain('connecting');
  });

  it('grows and shrinks the set: kept bots keep their sockets, extras disconnect', () => {
    renderAt('/dev/bots/ABCD');
    spawn(3);
    spawn(5);
    expect(sockets).toHaveLength(5);
    expect(sockets.some((s) => s.disconnected)).toBe(false);

    spawn(2);
    expect(rows()).toHaveLength(2);
    expect(sockets.map((s) => s.disconnected)).toEqual([false, false, true, true, true]);
  });

  it('a re-spawn after Remove all reuses the same player ids, so the bots rejoin as themselves', () => {
    renderAt('/dev/bots/ABCD');
    spawn(2);
    fireEvent.click(screen.getByRole('button', { name: 'Remove all' }));
    expect(rows()).toHaveLength(0);
    spawn(2);
    expect(sockets.flatMap(joinIds)).toEqual(['bot-1', 'bot-2', 'bot-1', 'bot-2']);
  });

  it('Buzz all sends player:buzz from every bot after a random 0–300 ms delay', () => {
    const delays = [0, 0.5, 0.9999];
    renderAt('/dev/bots/ABCD', () => delays.shift()!);
    spawn(3);
    fireEvent.click(screen.getByRole('button', { name: /Buzz all/ }));
    const buzzed = () => sockets.map((s) => s.emitted.some((e) => e.event === 'player:buzz'));

    expect(buzzed()).toEqual([false, false, false]);
    act(() => vi.advanceTimersByTime(0));
    expect(buzzed()).toEqual([true, false, false]);
    act(() => vi.advanceTimersByTime(150));
    expect(buzzed()).toEqual([true, true, false]);
    act(() => vi.advanceTimersByTime(150));
    expect(buzzed()).toEqual([true, true, true]);
  });

  it('shows a buzz error on the bot row', () => {
    renderAt('/dev/bots/ABCD', () => 0);
    spawn(1);
    fireEvent.click(screen.getByRole('button', { name: /Buzz all/ }));
    act(() => vi.advanceTimersByTime(0));
    const buzz = sockets[0]!.emitted.find((e) => e.event === 'player:buzz')!;
    act(() => buzz.ack({ ok: false, error: 'Buzzers are not open' }));
    expect(rows()[0]!.textContent).toContain('Buzzers are not open');
  });

  it('disconnects every bot when the page closes', () => {
    const { unmount } = renderAt('/dev/bots/ABCD');
    spawn(4);
    unmount();
    expect(sockets.every((s) => s.disconnected)).toBe(true);
  });

  it('refuses a malformed room code and opens no socket', () => {
    renderAt('/dev/bots/AB1');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Not a room code');
    expect(sockets).toHaveLength(0);
  });
});
