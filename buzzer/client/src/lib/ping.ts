import { PING_INTERVAL_MS } from '../../../shared/constants.js';
import type { GameSocket } from './socket.js';

export interface PingOptions {
  /** Monotonic ms for ping timestamps. */
  clock?: () => number;
  /** The round trip of each answered ping, as the client sees it. */
  onRtt?: (rttMs: number) => void;
}

/**
 * Sends `ping {t}` every `PING_INTERVAL_MS` while the socket is connected and acks every `pong`,
 * so the server gets RTT samples (Buzzer fairness and timing, DECISIONS F15). Call it before
 * `connect()`. Returns a stop function that clears the interval.
 */
export function keepPinging(
  socket: GameSocket,
  { clock = () => performance.now(), onRtt }: PingOptions = {},
): () => void {
  let ping: ReturnType<typeof setInterval> | undefined;
  const stop = () => {
    clearInterval(ping);
    ping = undefined;
  };

  socket.on('connect', () => {
    // A reconnect restarts the interval, so there is only ever one.
    stop();
    ping = setInterval(() => socket.emit('ping', { t: clock() }, () => {}), PING_INTERVAL_MS);
  });
  socket.on('disconnect', stop);
  socket.on('pong', ({ t }, ack) => {
    // The server times its own RTT sample from the pong to this ack (DECISIONS F15).
    ack();
    onRtt?.(Math.round(clock() - t));
  });

  return stop;
}
