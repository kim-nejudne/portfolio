// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PING_INTERVAL_MS } from '../../../shared/constants.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { keepPinging, PINGS_LOST } from './ping.js';
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
  const onAck = vi.fn();
  const onLost = vi.fn();
  const stop = keepPinging(socket as unknown as GameSocket, {
    clock: () => now,
    onRtt: (rtt) => rtts.push(rtt),
    onAck,
    onLost,
  });
  const pings = () => socket.emitted.filter((e) => e.event === 'ping');
  return { socket, stop, pings, rtts, onAck, onLost, tick: (ms: number) => (now += ms) };
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

  it('reports a loss when the next ping is due and the last two are unanswered, once', () => {
    const { socket, onLost } = setup();
    socket.connect();
    vi.advanceTimersByTime(PING_INTERVAL_MS * PINGS_LOST);
    expect(onLost).not.toHaveBeenCalled();
    vi.advanceTimersByTime(PING_INTERVAL_MS);
    expect(onLost).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(PING_INTERVAL_MS * 3);
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('any ack, a refusal too, reports onAck and starts the count again', () => {
    const { socket, pings, onAck, onLost } = setup();
    socket.connect();
    vi.advanceTimersByTime(PING_INTERVAL_MS * 2);
    pings()[0]!.ack({ ok: false, error: 'Too many pings' });
    expect(onAck).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(PING_INTERVAL_MS);
    expect(onLost).not.toHaveBeenCalled();
    // A new silence after an ack is reported again.
    vi.advanceTimersByTime(PING_INTERVAL_MS * 2);
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('a reconnect starts the count afresh', () => {
    const { socket, onLost } = setup();
    socket.connect();
    vi.advanceTimersByTime(PING_INTERVAL_MS * PINGS_LOST);
    socket.fire('disconnect');
    socket.fire('connect');
    vi.advanceTimersByTime(PING_INTERVAL_MS * PINGS_LOST);
    expect(onLost).not.toHaveBeenCalled();
  });
});
