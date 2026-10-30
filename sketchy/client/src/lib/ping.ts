// The phone's half of latency correction (spec "Scoring and timing" → Latency correction).
// Ported from Buzzr (buzzer/client/src/lib/ping.ts) without its silent-drop watch (Buzzr F41).

import { PING_INTERVAL_MS } from '../../../shared/constants.js';
import type { GameSocket } from './socket.js';

/** The page-visibility source; `document` in the browser. */
export interface VisibilitySource {
  readonly hidden: boolean;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

/**
 * Sends `ping {t}` on connect and then every PING_INTERVAL_MS, and acks every `pong` at once: the
 * server times its RTT sample from the `pong` to that ack (DECISIONS 36). The first ping goes at
 * once, so a reconnected phone has a sample before its first guess. Pings pause while the page is
 * hidden (nobody guesses then; it saves the radio) and resume with one at once when it shows.
 * A Screen in `?debug=1` mode pings too, for its clock offset (F16).
 * Call it before `connect()`. Returns a stop function that clears the interval and the listeners.
 */
export function keepPinging(
  socket: GameSocket,
  {
    clock = () => performance.now(),
    page = typeof document === 'undefined' ? undefined : document,
    onServerTime,
    onAck,
  }: {
    clock?: () => number;
    page?: VisibilitySource;
    /** `?debug=1` (F16): each pong's `t`, `serverNow` and local arrival time, for the offset. */
    onServerTime?: (t: number, serverNow: number, receivedAt: number) => void;
    /** Each ping the server acked: the phone's connection dot reads it as the link being up. */
    onAck?: () => void;
  } = {},
): () => void {
  let timer: ReturnType<typeof setInterval> | undefined;
  const pause = () => {
    clearInterval(timer);
    timer = undefined;
  };
  // The ack only says the server took it; the RTT sample is the server's.
  const ping = () => socket.emit('ping', { t: clock() }, () => onAck?.());
  const start = () => {
    // A reconnect restarts the interval, so there is only ever one.
    pause();
    if (!socket.connected || page?.hidden) return;
    ping();
    timer = setInterval(ping, PING_INTERVAL_MS);
  };
  const onVisibility = () => (page?.hidden ? pause() : start());
  const onPong = ({ t, serverNow }: { t: number; serverNow: number }, ack?: () => void) => {
    ack?.();
    onServerTime?.(t, serverNow, clock());
  };

  socket.on('connect', start);
  socket.on('disconnect', pause);
  socket.on('pong', onPong);
  page?.addEventListener('visibilitychange', onVisibility);

  return () => {
    pause();
    socket.off('connect', start);
    socket.off('disconnect', pause);
    socket.off('pong', onPong);
    page?.removeEventListener('visibilitychange', onVisibility);
  };
}
