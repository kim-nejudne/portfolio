// The phone's connection dot (UI by role and phase, Guesser phone: "Connection dot (green/amber/red)
// and auto-reconnect, as in Buzzr"). Ported from Buzzr (buzzer/client/src/lib/useRoomSocket.ts)
// as a store for `useSyncExternalStore`: `connected` (green) on each connect and ping ack;
// `connecting` (amber) on a disconnect, the browser's `offline` event, STALE_AFTER_MS without an
// ack (a silent drop: Wi-Fi up, no internet), and before the first connect; `offline` (red) once
// that has lasted OFFLINE_AFTER_MS. Socket.IO reconnects by itself, and the page rejoins on every
// connect.

import { PING_INTERVAL_MS } from '../../../shared/constants.js';
import type { GameSocket } from './socket.js';

/** How long the link may be down, retrying, before the dot turns from amber to red. */
export const OFFLINE_AFTER_MS = 5_000;

/**
 * Three pings unanswered: the link looks down even though the socket hasn't noticed. A hidden page
 * stops pinging, so it may go amber, and it pings at once when it shows again.
 */
export const STALE_AFTER_MS = 3 * PING_INTERVAL_MS;

export type Connection = 'connected' | 'connecting' | 'offline';

/** The part of `window` this needs (a fake in tests). */
export interface OnlineEvents {
  addEventListener(type: 'online' | 'offline', cb: () => void): void;
  removeEventListener(type: 'online' | 'offline', cb: () => void): void;
}

export interface ConnectionStore {
  /** The socket connected, or a ping was answered: green for another STALE_AFTER_MS. */
  up(): void;
  /** The socket disconnected. */
  down(): void;
  /**
   * Follows `socket` (connect, disconnect) and the browser's `online`/`offline` until the returned
   * stop is called. A link not yet up starts the red clock: the first connect can fail too. Safe
   * to call again after a stop (React StrictMode runs effects twice).
   */
  watch(socket: Pick<GameSocket, 'on' | 'off' | 'connected'>, target?: OnlineEvents): () => void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): Connection;
}

/** Starts amber. The browser's `online` turns it green only when the socket is in fact connected. */
export function createConnection(): ConnectionStore {
  let state: Connection = 'connecting';
  let offlineTimer: ReturnType<typeof setTimeout> | undefined;
  let staleTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const set = (next: Connection) => {
    if (state === next) return;
    state = next;
    for (const l of listeners) l();
  };
  // Amber now (red stays red), red after OFFLINE_AFTER_MS. A second sign of the same outage does
  // not restart that clock.
  const down = () => {
    clearTimeout(staleTimer);
    if (state === 'connected') set('connecting');
    offlineTimer ??= setTimeout(() => set('offline'), OFFLINE_AFTER_MS);
  };
  const up = () => {
    clearTimeout(offlineTimer);
    offlineTimer = undefined;
    clearTimeout(staleTimer);
    staleTimer = setTimeout(down, STALE_AFTER_MS);
    set('connected');
  };
  return {
    up,
    down,
    watch(socket, target = window) {
      const onOnline = () => {
        if (socket.connected) up();
      };
      socket.on('connect', up);
      socket.on('disconnect', down);
      target.addEventListener('offline', down);
      target.addEventListener('online', onOnline);
      if (socket.connected) up();
      else down();
      return () => {
        clearTimeout(offlineTimer);
        clearTimeout(staleTimer);
        offlineTimer = undefined;
        socket.off('connect', up);
        socket.off('disconnect', down);
        target.removeEventListener('offline', down);
        target.removeEventListener('online', onOnline);
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
  };
}
