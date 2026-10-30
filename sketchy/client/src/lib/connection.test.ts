import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSocket } from '../dev/fakeSocket.js';
import {
  OFFLINE_AFTER_MS,
  STALE_AFTER_MS,
  createConnection,
  type OnlineEvents,
} from './connection.js';
import type { GameSocket } from './socket.js';

/** A fake `window` that only dispatches `online` and `offline`. */
function fakeWindow() {
  const listeners = { online: new Set<() => void>(), offline: new Set<() => void>() };
  const target: OnlineEvents = {
    addEventListener: (type, cb) => listeners[type].add(cb),
    removeEventListener: (type, cb) => listeners[type].delete(cb),
  };
  return { target, fire: (type: 'online' | 'offline') => listeners[type].forEach((cb) => cb()) };
}

/** A store watching a fake socket and window, as `Play.tsx` wires it. */
function setup() {
  const socket = new FakeSocket();
  const win = fakeWindow();
  const conn = createConnection();
  const stop = conn.watch(socket as unknown as GameSocket, win.target);
  const drop = () => {
    socket.connected = false;
    socket.fire('disconnect');
  };
  return { socket, win, conn, stop, drop };
}

describe('the connection dot', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is amber before the first connect and green on the socket's connect", () => {
    const { socket, conn } = setup();
    expect(conn.getSnapshot()).toBe('connecting');
    socket.connect();
    expect(conn.getSnapshot()).toBe('connected');
  });

  it('turns red when the first connect fails for OFFLINE_AFTER_MS', () => {
    const { conn } = setup();
    vi.advanceTimersByTime(OFFLINE_AFTER_MS - 1);
    expect(conn.getSnapshot()).toBe('connecting');
    vi.advanceTimersByTime(1);
    expect(conn.getSnapshot()).toBe('offline');
  });

  it('goes amber on a disconnect, red after OFFLINE_AFTER_MS, and green on the reconnect', () => {
    const { socket, conn, drop } = setup();
    socket.connect();
    drop();
    expect(conn.getSnapshot()).toBe('connecting');
    vi.advanceTimersByTime(OFFLINE_AFTER_MS);
    expect(conn.getSnapshot()).toBe('offline');
    socket.connect();
    expect(conn.getSnapshot()).toBe('connected');
    // The red clock was cleared: the next outage starts a fresh one.
    vi.advanceTimersByTime(OFFLINE_AFTER_MS);
    expect(conn.getSnapshot()).toBe('connected');
  });

  it('goes green on a ping ack (up) after the browser said offline', () => {
    const { socket, conn, win } = setup();
    socket.connect();
    win.fire('offline');
    expect(conn.getSnapshot()).toBe('connecting');
    conn.up();
    expect(conn.getSnapshot()).toBe('connected');
  });

  it('goes amber when pings go unanswered for STALE_AFTER_MS (a silent drop), green on the next ack', () => {
    const { socket, conn } = setup();
    socket.connect();
    vi.advanceTimersByTime(STALE_AFTER_MS - 1);
    conn.up(); // an ack just in time keeps it green for another STALE_AFTER_MS
    vi.advanceTimersByTime(STALE_AFTER_MS - 1);
    expect(conn.getSnapshot()).toBe('connected');
    vi.advanceTimersByTime(1);
    expect(conn.getSnapshot()).toBe('connecting');
    vi.advanceTimersByTime(OFFLINE_AFTER_MS);
    expect(conn.getSnapshot()).toBe('offline');
    conn.up();
    expect(conn.getSnapshot()).toBe('connected');
  });

  it('does not restart the red clock on a second sign of the same outage', () => {
    const { socket, conn, win, drop } = setup();
    socket.connect();
    drop();
    vi.advanceTimersByTime(3_000);
    win.fire('offline');
    vi.advanceTimersByTime(OFFLINE_AFTER_MS - 3_000);
    expect(conn.getSnapshot()).toBe('offline');
  });

  it("goes amber on the browser's offline event and back to green on online only while connected", () => {
    const { socket, conn, win, drop } = setup();
    socket.connect();
    win.fire('offline');
    expect(conn.getSnapshot()).toBe('connecting');
    drop();
    win.fire('online');
    expect(conn.getSnapshot()).toBe('connecting');
    socket.connected = true;
    win.fire('online');
    expect(conn.getSnapshot()).toBe('connected');
  });

  it('tells subscribers of each change, and stops following the socket and window on stop', () => {
    const { socket, conn, win, stop, drop } = setup();
    const seen: string[] = [];
    conn.subscribe(() => seen.push(conn.getSnapshot()));
    socket.connect();
    socket.connect();
    drop();
    expect(seen).toEqual(['connected', 'connecting']);
    stop();
    vi.advanceTimersByTime(OFFLINE_AFTER_MS);
    socket.connect();
    win.fire('online');
    expect(conn.getSnapshot()).toBe('connecting');
  });

  it('follows again after a stop and a second watch (StrictMode runs effects twice)', () => {
    const socket = new FakeSocket();
    const win = fakeWindow();
    const conn = createConnection();
    conn.watch(socket as unknown as GameSocket, win.target)();
    conn.watch(socket as unknown as GameSocket, win.target);
    // The red clock runs again for the first connect…
    vi.advanceTimersByTime(OFFLINE_AFTER_MS);
    expect(conn.getSnapshot()).toBe('offline');
    // …and the socket and window are followed once more.
    socket.connect();
    expect(conn.getSnapshot()).toBe('connected');
    win.fire('offline');
    expect(conn.getSnapshot()).toBe('connecting');
  });

  it('is green at once when watching a socket that is already connected', () => {
    const socket = new FakeSocket();
    socket.connected = true;
    const conn = createConnection();
    conn.watch(socket as unknown as GameSocket, fakeWindow().target);
    expect(conn.getSnapshot()).toBe('connected');
  });
});
