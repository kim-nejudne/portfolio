import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents } from '#shared/schemas.js';
import type { ServerToClientEvents } from '#shared/types.js';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * A socket to the page's own origin (Vite proxies `/socket.io` in development). WebSocket only,
 * as the server accepts (DECISIONS 15). It connects once the caller has attached its listeners.
 */
export function createSocket(): GameSocket {
  return io({ transports: ['websocket'], autoConnect: false });
}
