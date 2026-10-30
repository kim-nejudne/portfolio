import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PING_INTERVAL_MS } from '../../../shared/constants.js';
import { FakeSocket } from '../dev/fakeSocket.js';
import { keepPinging, type VisibilitySource } from './ping.js';
import type { GameSocket } from './socket.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

class FakePage extends EventTarget implements VisibilitySource {
  hidden = false;
  set(hidden: boolean) {
    this.hidden = hidden;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

function setup() {
  const socket = new FakeSocket();
  const page = new FakePage();
  // Fake timers move Date.now with them, so each ping reads the time it fired at.
  vi.setSystemTime(0);
  const stop = keepPinging(socket as unknown as GameSocket, { clock: () => Date.now(), page });
  const pings = () => socket.sent('ping').map((e) => e.payload);
  return { socket, page, stop, pings, tick: (ms: number) => vi.advanceTimersByTime(ms) };
}

describe('keepPinging', () => {
  it(`pings at once on connect, then every ${PING_INTERVAL_MS} ms, with the clock as t`, () => {
    const { socket, pings, tick } = setup();
    tick(PING_INTERVAL_MS * 2);
    expect(pings()).toEqual([]);
    socket.connect();
    tick(PING_INTERVAL_MS * 2);
    expect(pings()).toEqual([
      { t: PING_INTERVAL_MS * 2 },
      { t: PING_INTERVAL_MS * 3 },
      { t: PING_INTERVAL_MS * 4 },
    ]);
  });

  it('acks every pong at once, so the server can time the round trip', () => {
    const { socket } = setup();
    const ack = vi.fn();
    socket.fire('pong', { t: 1, serverNow: 9 }, ack);
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it("calls onAck when the server acks a ping (the phone's connection dot), not before", () => {
    const socket = new FakeSocket();
    const onAck = vi.fn();
    keepPinging(socket as unknown as GameSocket, { page: new FakePage(), onAck });
    socket.connect();
    const [sent] = socket.sent('ping');
    expect(onAck).not.toHaveBeenCalled();
    sent!.ack!({ ok: true });
    expect(onAck).toHaveBeenCalledTimes(1);
  });

  it('hands each pong and its local arrival time to onServerTime (?debug=1)', () => {
    const socket = new FakeSocket();
    vi.setSystemTime(0);
    const seen: number[][] = [];
    keepPinging(socket as unknown as GameSocket, {
      clock: () => Date.now(),
      page: new FakePage(),
      onServerTime: (...args) => seen.push(args),
    });
    vi.setSystemTime(1_140);
    socket.fire('pong', { t: 1_000, serverNow: 1_800_000_000_000 }, () => {});
    expect(seen).toEqual([[1_000, 1_800_000_000_000, 1_140]]);
  });

  it('stops while disconnected and keeps one interval across reconnects', () => {
    const { socket, pings, tick } = setup();
    socket.connect();
    socket.fire('disconnect');
    tick(PING_INTERVAL_MS * 3);
    expect(pings()).toHaveLength(1);
    socket.connect();
    socket.connect();
    expect(pings()).toHaveLength(3);
    tick(PING_INTERVAL_MS);
    expect(pings()).toHaveLength(4);
  });

  it('pauses while the page is hidden and pings at once when it shows again', () => {
    const { socket, page, pings, tick } = setup();
    socket.connect();
    page.set(true);
    tick(PING_INTERVAL_MS * 5);
    expect(pings()).toHaveLength(1);
    page.set(false);
    expect(pings()).toHaveLength(2);
    tick(PING_INTERVAL_MS);
    expect(pings()).toHaveLength(3);
  });

  it('does not start on a connect while the page is hidden', () => {
    const { socket, page, pings, tick } = setup();
    page.set(true);
    socket.connect();
    tick(PING_INTERVAL_MS * 3);
    expect(pings()).toEqual([]);
  });

  it('stops for good when the stop function is called, even on a later connect or show', () => {
    const { socket, page, stop, pings, tick } = setup();
    socket.connect();
    stop();
    socket.fire('disconnect');
    socket.connect();
    page.set(true);
    page.set(false);
    tick(PING_INTERVAL_MS * 3);
    expect(pings()).toHaveLength(1);
  });
});
