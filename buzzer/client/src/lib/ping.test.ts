// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PING_INTERVAL_MS } from '../../../shared/constants.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { keepPinging } from './ping.js';
import type { GameSocket } from './socket.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  const socket = new FakeSocket();
  let now = 500;
  const rtts: number[] = [];
  const stop = keepPinging(socket as unknown as GameSocket, {
    clock: () => now,
    onRtt: (rtt) => rtts.push(rtt),
  });
  const pings = () => socket.emitted.filter((e) => e.event === 'ping');
  return { socket, stop, pings, rtts, tick: (ms: number) => (now += ms) };
}

describe('keepPinging', () => {
  it('sends nothing until the socket connects', () => {
    const { pings } = setup();
    vi.advanceTimersByTime(PING_INTERVAL_MS * 3);
    expect(pings()).toHaveLength(0);
  });

  it('pings every PING_INTERVAL_MS with the clock time', () => {
    const { socket, pings } = setup();
    socket.connect();
    vi.advanceTimersByTime(PING_INTERVAL_MS * 2);
    expect(pings().map((e) => e.payload)).toEqual([{ t: 500 }, { t: 500 }]);
  });

  it('a reconnect keeps a single interval', () => {
    const { socket, pings } = setup();
    socket.connect();
    socket.fire('connect');
    vi.advanceTimersByTime(PING_INTERVAL_MS);
    expect(pings()).toHaveLength(1);
  });

  it('stops on disconnect and on stop()', () => {
    const { socket, stop, pings } = setup();
    socket.connect();
    socket.fire('disconnect');
    vi.advanceTimersByTime(PING_INTERVAL_MS * 2);
    expect(pings()).toHaveLength(0);

    socket.fire('connect');
    stop();
    vi.advanceTimersByTime(PING_INTERVAL_MS * 2);
    expect(pings()).toHaveLength(0);
  });

  it('acks every pong and reports the client-side round trip', () => {
    const { socket, rtts, tick } = setup();
    socket.connect();
    tick(40);
    const ack = vi.fn();
    socket.fire('pong', { t: 500 }, ack);
    socket.fire('pong', { t: 520 }, ack);
    expect(ack).toHaveBeenCalledTimes(2);
    expect(rtts).toEqual([40, 20]);
  });
});
