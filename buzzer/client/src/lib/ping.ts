import { PING_INTERVAL_MS } from '../../../shared/constants.js';
import type { GameSocket } from './socket.js';

export interface PingOptions {
  /** Monotonic ms for ping timestamps. */
  clock?: () => number;
  /** The round trip of each answered ping, as the client sees it. */
  onRtt?: (rttMs: number) => void;
  /** Any ping's ack: the server answered, so the link works. */
  onAck?: () => void;
  /**
   * `PINGS_LOST` pings in a row still unanswered when the next one is due: the link has gone
   * silent though the socket still looks connected. Called once per silence; an ack ends it.
   */
  onLost?: () => void;
}

/** Consecutive unanswered pings that mean a silent drop (F41). */
export const PINGS_LOST = 2;

/**
 * Sends `ping {t}` every `PING_INTERVAL_MS` while the socket is connected and acks every `pong`,
 * so the server gets RTT samples (Buzzer fairness and timing, DECISIONS F15). Call it before
 * `connect()`. Returns a stop function that clears the interval.
 *
 * It also watches the acks to the pings: `onLost` when `PINGS_LOST` in a row go unanswered,
 * `onAck` on each answer. Socket.IO's own heartbeat takes up to about 45 s to notice a silent
 * drop; this takes about two intervals (DECISIONS F41).
 */
export function keepPinging(
  socket: GameSocket,
  { clock = () => performance.now(), onRtt, onAck, onLost }: PingOptions = {},
): () => void {
  let ping: ReturnType<typeof setInterval> | undefined;
  const stop = () => {
    clearInterval(ping);
    ping = undefined;
  };

  socket.on('connect', () => {
    // A reconnect restarts the interval, so there is only ever one.
    stop();
    // Pings sent since the last ack on this connection.
    let unanswered = 0;
    let lost = false;
    ping = setInterval(() => {
      if (unanswered >= PINGS_LOST && !lost) {
        lost = true;
        onLost?.();
      }
      unanswered += 1;
      // Any ack counts, a refusal too: it still came back from the server.
      socket.emit('ping', { t: clock() }, () => {
        unanswered = 0;
        lost = false;
        onAck?.();
      });
    }, PING_INTERVAL_MS);
  });
  socket.on('disconnect', stop);
  socket.on('pong', ({ t }, ack) => {
    // The server times its own RTT sample from the pong to this ack (DECISIONS F15).
    ack();
    onRtt?.(Math.round(clock() - t));
  });

  return stop;
}
