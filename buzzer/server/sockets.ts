import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';

/** The Socket.IO gateway. Event handlers arrive with the features that need them. */
export function attachSockets(httpServer: HttpServer): Server {
  return new Server(httpServer, { transports: ['websocket'] });
}
