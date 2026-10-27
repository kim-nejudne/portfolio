// The Socket.IO gateway: auth, zod parsing, rate limits, `reduce`, then a fresh role-filtered
// `state` for every socket in the room. See "Realtime events and HTTP API" in docs/SPEC.md.

import type { IncomingMessage, Server as HttpServer } from 'node:http';
import express from 'express';
import proxyaddr from 'proxy-addr';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import {
  INVALID_HOST_TOKEN_ERROR,
  PLAYER_JOIN_RATE_LIMIT,
  SOCKET_MESSAGE_MAX_BYTES,
} from '../shared/constants.js';
import { clientPayloadSchemas } from '../shared/schemas.js';
import type {
  Ack,
  ClientEvent,
  ClientPayloads,
  ClientToServerEvents,
  Room,
  ServerToClientEvents,
} from '../shared/types.js';
import { verifyHostToken } from './hostToken.js';
import { createRateLimiter, type RateLimit } from './rateLimit.js';
import { reduce, type Action, type Effect } from './reducer.js';
import type { RoomStore } from './roomStore.js';
import { toView } from './views.js';

/** What a socket joined as. Set once, by a successful `*:join`; later events read it. */
export interface SocketData {
  code?: string;
  role?: 'screen' | 'host' | 'player';
  playerId?: string;
  /** May send `host:*` events: a host socket, or a Screen that joined with a valid token (DECISIONS #2). */
  canHost: boolean;
}

export type GatewayServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type GatewaySocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export interface GatewayOptions {
  rooms: RoomStore;
  /** Wall-clock ms: the reducer's `now` and the rate limiters' clock. */
  clock?: () => number;
  /** Express's `trust proxy` value, so the join limit sees the same client IP as the HTTP layer. */
  trustProxy?: boolean | number | string;
  /** Overridable for tests; defaults to the spec's limit as amended by DECISIONS #3. */
  playerJoinLimit?: RateLimit;
}

export const screenRoom = (code: string) => `room:${code}:screen`;
export const hostRoom = (code: string) => `room:${code}:host`;
export const playerRoom = (code: string, playerId: string) => `room:${code}:player:${playerId}`;

export function attachSockets(
  httpServer: HttpServer,
  {
    rooms,
    clock = Date.now,
    trustProxy = false,
    playerJoinLimit = PLAYER_JOIN_RATE_LIMIT,
  }: GatewayOptions,
): GatewayServer {
  const io: GatewayServer = new Server(httpServer, {
    transports: ['websocket'],
    // A bigger frame closes the connection. Images go over HTTP, never sockets.
    maxHttpBufferSize: SOCKET_MESSAGE_MAX_BYTES,
  });

  // Express compiles `trust proxy` (hop count, list or boolean) into the function `req.ip` uses.
  const trust = express().set('trust proxy', trustProxy).get('trust proxy fn') as (
    addr: string,
    i: number,
  ) => boolean;
  const clientIp = (req: IncomingMessage) => proxyaddr(req, trust);

  const joinLimiter = createRateLimiter(playerJoinLimit, clock);

  /** Emits each role's view of `room`. Only players in the room get one: `toView` throws for others. */
  function broadcast(room: Room): void {
    io.to(screenRoom(room.code)).emit('state', toView(room, 'screen'));
    io.to(hostRoom(room.code)).emit('state', toView(room, 'host'));
    for (const id of Object.keys(room.players)) {
      io.to(playerRoom(room.code, id)).emit('state', toView(room, 'player', id));
    }
  }

  function runEffects(room: Room, effects: Effect[]): void {
    for (const effect of effects) {
      switch (effect.type) {
        case 'fx':
          io.to([
            screenRoom(room.code),
            hostRoom(room.code),
            ...Object.keys(room.players).map((id) => playerRoom(room.code, id)),
          ]).emit('fx', effect.fx);
          break;
      }
    }
  }

  /** Reduces, stores and broadcasts. Every game action goes through here. */
  function dispatch(code: string, action: Action): Ack {
    const room = rooms.get(code);
    if (!room) return fail('Room not found');
    const result = reduce(room, action, clock());
    if (!result.ok) return fail(result.error);
    rooms.set(result.room);
    broadcast(result.room);
    runEffects(result.room, result.effects);
    return { ok: true };
  }

  /** A join outside the reducer still counts as activity, or the sweeper could close a live room. */
  function touch(room: Room): Room {
    const touched = { ...room, lastActivityAt: clock() };
    rooms.set(touched);
    return touched;
  }

  io.on('connection', (socket) => {
    socket.data = { canHost: false };

    handle(socket, 'screen:join', ({ code, hostToken }) => {
      if (socket.data.role) return fail('Already joined');
      const room = rooms.get(code);
      if (!room) return fail('Room not found');
      if (hostToken !== undefined && !verifyHostToken(hostToken, room.hostTokenHash)) {
        return fail(INVALID_HOST_TOKEN_ERROR);
      }
      // SPEC-QUESTION: a token authorises host actions only; the Screen still gets ScreenView (DECISIONS #2, F07).
      socket.data = { code, role: 'screen', canHost: hostToken !== undefined };
      void socket.join(screenRoom(code));
      socket.emit('state', toView(touch(room), 'screen'));
      return { ok: true };
    });

    handle(socket, 'host:join', ({ code, hostToken }) => {
      if (socket.data.role) return fail('Already joined');
      const room = rooms.get(code);
      if (!room) return fail('Room not found');
      if (!verifyHostToken(hostToken, room.hostTokenHash)) return fail(INVALID_HOST_TOKEN_ERROR);
      socket.data = { code, role: 'host', canHost: true };
      void socket.join(hostRoom(code));
      socket.emit('state', toView(touch(room), 'host'));
      return { ok: true };
    });

    handle(socket, 'player:join', ({ code, playerId, name }) => {
      if (socket.data.role) return fail('Already joined');
      const room = rooms.get(code);
      if (!room) return fail('Room not found');
      // SPEC-QUESTION: only joins that would add a player count; a known id always gets through (DECISIONS #3, F07).
      if (!room.players[playerId] && !joinLimiter.hit(clientIp(socket.request))) {
        return fail('Too many joins from this network. Try again in a minute.');
      }
      // Join the Socket.IO room first, so the broadcast inside dispatch reaches this socket too.
      void socket.join(playerRoom(code, playerId));
      const ack = dispatch(code, { type: 'player:join', playerId, name });
      if (!ack.ok) {
        void socket.leave(playerRoom(code, playerId));
        return ack;
      }
      socket.data = { code, role: 'player', playerId, canHost: false };
      return ack;
    });

    socket.on('disconnect', () => {
      const { code, role, playerId } = socket.data;
      if (role !== 'player' || !code || !playerId) return;
      // A phone that reconnected before its old socket timed out is still here: keep it connected.
      if (io.sockets.adapter.rooms.get(playerRoom(code, playerId))?.size) return;
      if (!rooms.get(code)?.players[playerId]) return;
      dispatch(code, { type: 'player:disconnect', playerId });
    });
  });

  return io;
}

/**
 * Registers `event` with a zod parse of its payload and a guarded ack. A client may omit the ack
 * or send garbage; neither can throw out of the handler.
 */
function handle<E extends ClientEvent>(
  socket: GatewaySocket,
  event: E,
  fn: (payload: ClientPayloads[E]) => Ack,
): void {
  const listener = (raw: unknown, ack: unknown) => {
    const reply = typeof ack === 'function' ? (ack as (res: Ack) => void) : () => {};
    const parsed = clientPayloadSchemas[event].safeParse(raw);
    if (!parsed.success) {
      reply(fail(`Invalid ${event}: ${z.prettifyError(parsed.error)}`));
      return;
    }
    try {
      reply(fn(parsed.data as ClientPayloads[E]));
    } catch (err) {
      console.error(`[sockets] ${event} failed`, err);
      reply(fail('Server error'));
    }
  };
  socket.on(event, listener as never);
}

function fail(error: string): Ack {
  return { ok: false, error };
}
