// Sockets to the page's own origin (Vite proxies `/socket.io` in development). Ported from Buzzr
// (buzzer/client/src/lib/socket.ts). WebSocket only: the server accepts nothing else, and
// long-polling would add latency and jitter to guess times and ink.
// Neither connects until the caller has attached its listeners and calls `connect()`.

import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  InkAuth,
  InkClientToServerEvents,
  InkServerToClientEvents,
  ServerToClientEvents,
} from '../../../shared/types.js';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type InkSocket = Socket<InkServerToClientEvents, InkClientToServerEvents>;

export function createSocket(): GameSocket {
  return io({ transports: ['websocket'], autoConnect: false });
}

/** The `/ink` namespace. A Screen passes no `auth`; a phone passes `{code, playerKey}`. */
export function createInkSocket(auth?: InkAuth): InkSocket {
  return io('/ink', { transports: ['websocket'], autoConnect: false, ...(auth ? { auth } : {}) });
}
