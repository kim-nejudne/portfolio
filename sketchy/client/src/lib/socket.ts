// Sockets to the page's own origin (Vite proxies `/socket.io` in development). Ported from Buzzr
// (buzzer/client/src/lib/socket.ts). WebSocket first: long-polling adds latency and jitter to
// guess times and ink, so it's only the fallback when a WebSocket can't open (a proxy or network
// that blocks the upgrade). Each reconnect tries the WebSocket again (spec: Performance budget).
// Neither connects until the caller has attached its listeners and calls `connect()`.

import { io, type ManagerOptions, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  InkAuth,
  InkClientToServerEvents,
  InkServerToClientEvents,
  ServerToClientEvents,
} from '../../../shared/types.js';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type InkSocket = Socket<InkServerToClientEvents, InkClientToServerEvents>;

/** WebSocket, then long-polling only if the WebSocket fails to open. */
export const TRANSPORT_OPTIONS: Partial<ManagerOptions> = {
  transports: ['websocket', 'polling'],
  tryAllTransports: true,
};

export function createSocket(): GameSocket {
  return io({ ...TRANSPORT_OPTIONS, autoConnect: false });
}

/** The `/ink` namespace. A Screen passes no `auth`; a phone passes `{code, playerKey}`. */
export function createInkSocket(auth?: InkAuth): InkSocket {
  return io('/ink', { ...TRANSPORT_OPTIONS, autoConnect: false, ...(auth ? { auth } : {}) });
}
