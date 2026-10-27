import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/types.js';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * A socket to the page's own origin (Vite proxies `/socket.io` in development). WebSocket only:
 * long-polling adds latency and jitter that would skew buzz times (Buzzer fairness and timing).
 * It does not connect until the caller has attached its listeners and calls `connect()`.
 */
export function createSocket(url?: string): GameSocket {
  const options = { transports: ['websocket'], autoConnect: false };
  return url === undefined ? io(options) : io(url, options);
}
