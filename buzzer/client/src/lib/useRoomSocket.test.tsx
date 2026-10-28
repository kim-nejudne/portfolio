// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PING_INTERVAL_MS } from '../../../shared/constants.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { PINGS_LOST } from './ping.js';
import { useRoomStore } from './roomStore.js';
import type { GameSocket } from './socket.js';
import { OFFLINE_AFTER_MS, useRoomSocket, type JoinRoom } from './useRoomSocket.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const join: JoinRoom = (socket, ack) => socket.emit('screen:join', { code: 'WXYZ' }, ack);

function setup() {
  const socket = new FakeSocket();
  const makeSocket = () => socket as unknown as GameSocket;
  renderHook(() => useRoomSocket('WXYZ', join, makeSocket));
  const pings = () => socket.emitted.filter((e) => e.event === 'ping');
  const connection = () => useRoomStore.getState().connection;
  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
  return { socket, pings, connection, advance };
}

describe('useRoomSocket connection', () => {
  it('pings on every page, from connect', () => {
    const { pings, advance } = setup();
    advance(PING_INTERVAL_MS * 2);
    expect(pings()).toHaveLength(2);
  });

  it('turns connecting once two pings in a row go unanswered, then offline after 5 s', () => {
    const { pings, connection, advance } = setup();
    advance(PING_INTERVAL_MS);
    act(() => pings()[0]!.ack({ ok: true }));
    expect(connection()).toBe('connected');

    // Two more pings go out and neither is answered.
    advance(PING_INTERVAL_MS * PINGS_LOST);
    expect(connection()).toBe('connected');
    // The next ping is due and the last two are still unanswered.
    advance(PING_INTERVAL_MS);
    expect(connection()).toBe('connecting');

    advance(OFFLINE_AFTER_MS - 1);
    expect(connection()).toBe('connecting');
    advance(1);
    expect(connection()).toBe('offline');
  });

  it('one unanswered ping changes nothing', () => {
    const { pings, connection, advance } = setup();
    advance(PING_INTERVAL_MS * 2);
    act(() => pings()[1]!.ack({ ok: true }));
    advance(PING_INTERVAL_MS * 2);
    expect(connection()).toBe('connected');
  });

  it('an ack, even a late one, sets connected again and stops the offline clock', () => {
    const { pings, connection, advance } = setup();
    advance(PING_INTERVAL_MS * (PINGS_LOST + 1));
    expect(connection()).toBe('connecting');

    act(() => pings()[0]!.ack({ ok: true }));
    expect(connection()).toBe('connected');
    advance(OFFLINE_AFTER_MS);
    expect(connection()).toBe('connected');
  });

  it('an ack also brings it back from offline', () => {
    const { pings, connection, advance } = setup();
    advance(PING_INTERVAL_MS * (PINGS_LOST + 1) + OFFLINE_AFTER_MS);
    expect(connection()).toBe('offline');
    act(() => pings().at(-1)!.ack({ ok: true }));
    expect(connection()).toBe('connected');
  });

  it("the browser's offline event sets connecting at once, and offline 5 s later", () => {
    const { connection, advance } = setup();
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(connection()).toBe('connecting');
    advance(OFFLINE_AFTER_MS);
    expect(connection()).toBe('offline');
  });

  it("the browser's online event changes nothing by itself; the next ack does", () => {
    const { pings, connection, advance } = setup();
    act(() => void window.dispatchEvent(new Event('offline')));
    advance(OFFLINE_AFTER_MS);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(connection()).toBe('offline');
    act(() => pings().at(-1)!.ack({ ok: true }));
    expect(connection()).toBe('connected');
  });

  it('a disconnect after unanswered pings keeps the offline clock running', () => {
    const { socket, connection, advance } = setup();
    advance(PING_INTERVAL_MS * (PINGS_LOST + 1));
    expect(connection()).toBe('connecting');
    advance(OFFLINE_AFTER_MS - 1000);
    socket.fire('disconnect', 'ping timeout');
    advance(1000);
    expect(connection()).toBe('offline');
  });

  it('a disconnect while offline keeps it red', () => {
    const { socket, connection, advance } = setup();
    act(() => void window.dispatchEvent(new Event('offline')));
    advance(OFFLINE_AFTER_MS);
    socket.fire('disconnect', 'transport close');
    expect(connection()).toBe('offline');
  });

  it('stops pinging and listening on unmount', () => {
    const { pings, advance } = setup();
    cleanup();
    advance(PING_INTERVAL_MS * 2);
    expect(pings()).toHaveLength(0);
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(useRoomStore.getState().connection).toBe('connecting');
    advance(OFFLINE_AFTER_MS);
    expect(useRoomStore.getState().connection).toBe('connecting');
  });
});
