// The Socket.IO gateway (spec: Realtime events and HTTP API): zod parsing, rate limits, `reduce`,
// then a fresh role-filtered `state` for every socket in the room. Adapted from Buzzr's gateway.
// It holds no game logic: who may do what is the reducer's, and `by` always comes from the socket.

import type { IncomingMessage, Server as HttpServer } from 'node:http';
import express from 'express';
import proxyaddr from 'proxy-addr';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { GAME_ENDED_ERROR, RATE_LIMITS, SOCKET_MAX_BYTES } from '#shared/constants.js';
import {
  type ClientEvent,
  type ClientPayload,
  type ClientToServerEvents,
  clientEventSchemas,
} from '#shared/schemas.js';
import type { Ack, Room, ServerToClientEvents } from '#shared/types.js';
import { CategoryStore } from './categoryStore.js';
import type { Env } from './env.js';
import { createRateLimiter, type RateLimit, type RateLimiter } from './rateLimit.js';
import { type Action, type Effect, ERRORS, playerIdentity, reduce } from './reducer.js';
import type { RoomStore } from './roomStore.js';
import { toView } from './views.js';

/** What a socket joined as. Set once by a successful `*:join`; later events read it. */
export interface SocketData {
  code?: string;
  role?: 'screen' | 'player';
  playerId?: string;
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

// SPEC-QUESTION: DECISIONS 15 (texts the spec leaves open for the gateway's own refusals)
export const SOCKET_ERRORS = {
  roomGone: GAME_ENDED_ERROR,
  alreadyJoined: 'Already joined',
  joinLimited: 'Too many joins from this network. Try again in a minute.',
  lookupLimited: 'Too many tries. Wait a minute and try again.',
  vipLimited: 'Slow down',
  practiceLimited: 'Slow down',
  lockInLimited: 'Slow down',
  server: 'Something went wrong',
} as const;

export interface GatewayOptions {
  rooms: RoomStore;
  /** `PUBLIC_URL`: the Screen's join URL. */
  publicUrl: string;
  /** Live categories: the VIP's lobby list and `vip:settings` validation; empty when omitted. */
  categories?: CategoryStore;
  /** Wall-clock ms: the reducer's `now`, `serverNow` and the limiters' clock (DECISIONS 15). */
  clock?: () => number;
  /** Express's `trust proxy` value, so the join limit sees the same client IP as `req.ip`. */
  trustProxy?: Env['trustProxy'];
  /** The limiter `createApp` uses for `/exists` and `/credits`: `screen:join` shares it. */
  roomLookupLimiter?: RateLimiter;
  playerJoinLimit?: RateLimit;
  /** Runs `fn` after `ms`; tests inject one they fire by hand. */
  setTimer?: (fn: () => void, ms: number) => void;
}

export interface Gateway {
  io: GatewayServer;
  /** `broadcast: false` skips the state broadcast (an aim changes no view). */
  dispatch: (code: string, action: Action, broadcast?: boolean) => Ack;
  /** Sends `room:closed {reason: 'expired'}` to each room's sockets and disconnects them. */
  closeRooms: (codes: string[]) => void;
}

/** Every joined socket of a room, whatever its role: `room:closed` goes here. */
export const anyRoom = (code: string) => `room:${code}`;
export const screenRoom = (code: string) => `room:${code}:screen`;
export const playerRoom = (code: string, playerId: string) => `room:${code}:player:${playerId}`;

const fail = (error: string): Ack => ({ ok: false, error });

export function attachSockets(
  httpServer: HttpServer,
  {
    rooms,
    publicUrl,
    categories = new CategoryStore([]),
    clock = Date.now,
    trustProxy = false,
    roomLookupLimiter = createRateLimiter(RATE_LIMITS.roomLookup, clock),
    playerJoinLimit = RATE_LIMITS.playerJoinNew,
    setTimer,
  }: GatewayOptions,
): Gateway {
  const io: GatewayServer = new Server(httpServer, {
    transports: ['websocket'],
    // A bigger frame closes the connection (spec: Rate limits and limits).
    maxHttpBufferSize: SOCKET_MAX_BYTES,
  });

  // Express compiles `trust proxy` into the function `req.ip` uses; the sockets reuse it.
  const trust = express().set('trust proxy', trustProxy).get('trust proxy fn') as (
    addr: string,
    i: number,
  ) => boolean;
  const clientIp = (req: IncomingMessage) => proxyaddr(req, trust);

  const joinLimiter = createRateLimiter(playerJoinLimit, clock);
  const vipLimiter = createRateLimiter(RATE_LIMITS.vipAction, clock); // keyed by socket id
  const practiceLimiter = createRateLimiter(RATE_LIMITS.practice, clock); // keyed by code + player
  const aimLimiter = createRateLimiter(RATE_LIMITS.aim, clock); // keyed by socket id
  const lockInLimiter = createRateLimiter(RATE_LIMITS.lockIn, clock); // keyed by socket id

  // Pending timeouts are cleared when the server closes, so none fires into a closed gateway.
  const pending = new Set<ReturnType<typeof setTimeout>>();
  httpServer.once('close', () => {
    for (const t of pending) clearTimeout(t);
    pending.clear();
  });
  const runLater =
    setTimer ??
    ((fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        pending.delete(t);
        fn();
      }, ms);
      pending.add(t);
    });

  function broadcast(room: Room, now: number): void {
    const ctx = { now, publicUrl, categories: categories.summaries() };
    io.to(screenRoom(room.code)).emit('state', toView(room, 'screen', undefined, ctx));
    for (const id of Object.keys(room.players)) {
      io.to(playerRoom(room.code, id)).emit('state', toView(room, 'player', id, ctx));
    }
  }

  function runEffects(code: string, effects: Effect[], now: number): void {
    for (const effect of effects) {
      switch (effect.type) {
        case 'fx':
          io.to(
            effect.to === 'screens' ? screenRoom(code) : playerRoom(code, effect.to.playerId),
          ).emit('fx', effect.fx);
          break;
        case 'schedule': {
          // The delay is fixed now, and Node timers run on the monotonic clock, so a wall-clock
          // jump cannot stretch a window. The reducer drops the timer if the room has moved on.
          const { at, timer, round, game, epoch, k } = effect;
          const fields = { at, timer, round, game, epoch, k };
          runLater(
            () => {
              try {
                dispatch(code, { type: 'timer', ...fields });
              } catch (err) {
                console.error(`[sockets] timer ${fields.timer} failed: ${errorText(err)}`);
              }
            },
            Math.max(0, effect.at - now),
          );
          break;
        }
        case 'kicked': {
          // The reducer removed them, so the broadcast skipped them. Socket.IO clients do not
          // reconnect after a server disconnect.
          const own = playerRoom(code, effect.playerId);
          io.to(own).emit('kicked', {});
          io.in(own).disconnectSockets(true);
          break;
        }
        default:
          effect satisfies never;
      }
    }
  }

  /** Reduces, stores, broadcasts, then runs the effects. Every game action goes through here. */
  function dispatch(code: string, action: Action, broadcastState = true): Ack {
    const room = rooms.get(code);
    if (!room) return fail(SOCKET_ERRORS.roomGone);
    const now = clock();
    const result = reduce(room, action, now);
    if (result.error) return fail(result.error);
    rooms.set(result.room);
    if (broadcastState) broadcast(result.room, now);
    runEffects(code, result.effects, now);
    return { ok: true };
  }

  function closeRooms(codes: string[]): void {
    for (const code of codes) {
      io.to(anyRoom(code)).emit('room:closed', { reason: 'expired' });
      io.in(anyRoom(code)).disconnectSockets(true);
    }
  }

  io.on('connection', (socket) => {
    socket.data = {};
    const ip = () => clientIp(socket.request);

    /** The joined player's code and id, or an error ack. */
    const asPlayer = (fn: (code: string, playerId: string) => Ack): Ack => {
      const { code, role, playerId } = socket.data;
      if (role !== 'player' || !code || !playerId) return fail(ERRORS.notInGame);
      return fn(code, playerId);
    };
    /** VIP actions: 10 per second per socket; the reducer checks `by` against `room.vipId`. */
    const asVip = (fn: (code: string, by: string) => Ack): Ack =>
      asPlayer((code, by) =>
        vipLimiter.hit(socket.id) ? fn(code, by) : fail(SOCKET_ERRORS.vipLimited),
      );

    handle(socket, 'screen:join', ({ code }) => {
      if (socket.data.role) return fail(SOCKET_ERRORS.alreadyJoined);
      if (!roomLookupLimiter.hit(ip())) return fail(SOCKET_ERRORS.lookupLimited);
      // Joined first, so the broadcast inside dispatch reaches this socket too.
      void socket.join([anyRoom(code), screenRoom(code)]);
      const ack = dispatch(code, { type: 'screen:join' });
      if (!ack.ok) {
        void socket.leave(anyRoom(code));
        void socket.leave(screenRoom(code));
        return ack;
      }
      socket.data = { code, role: 'screen' };
      return ack;
    });

    handle(socket, 'player:join', ({ code, playerKey, name, emoji }) => {
      if (socket.data.role) return fail(SOCKET_ERRORS.alreadyJoined);
      const room = rooms.get(code);
      if (!room) return fail(SOCKET_ERRORS.roomGone);
      const { id } = playerIdentity(code, playerKey);
      // Only joins that would add a player count; a known key reconnects freely (spec, as in Buzzr).
      if (!room.players[id] && !joinLimiter.hit(ip())) return fail(SOCKET_ERRORS.joinLimited);
      void socket.join([anyRoom(code), playerRoom(code, id)]);
      const ack = dispatch(code, { type: 'player:join', playerKey, name, emoji });
      if (!ack.ok) {
        void socket.leave(anyRoom(code));
        void socket.leave(playerRoom(code, id));
        return ack;
      }
      socket.data = { code, role: 'player', playerId: id };
      return ack;
    });

    handle(socket, 'player:rename', ({ name, emoji }) =>
      asPlayer((code, by) =>
        dispatch(code, { type: 'player:rename', by, name, ...(emoji && { emoji }) }),
      ),
    );

    handle(socket, 'player:leave', () =>
      asPlayer((code, by) => {
        const ack = dispatch(code, { type: 'player:leave', by });
        if (!ack.ok) return ack;
        // Not a kick: this player's sockets stay connected but unjoined, so the phone can join
        // again as a new player on the same connection.
        for (const id of io.sockets.adapter.rooms.get(playerRoom(code, by)) ?? []) {
          const own = io.sockets.sockets.get(id);
          if (!own) continue;
          void own.leave(anyRoom(code));
          void own.leave(playerRoom(code, by));
          own.data = {};
        }
        return ack;
      }),
    );

    handle(socket, 'player:practice', ({ lat, lng }) =>
      asPlayer((code, by) =>
        practiceLimiter.hit(`${code}:${by}`)
          ? dispatch(code, { type: 'player:practice', by, lat, lng })
          : fail(SOCKET_ERRORS.practiceLimited),
      ),
    );

    handle(socket, 'vip:settings', (settings) =>
      asVip((code, by) =>
        dispatch(code, {
          type: 'vip:settings',
          by,
          settings,
          liveIds: categories.summaries().map((c) => c.id),
        }),
      ),
    );

    // Silent: no state broadcast and no fx, so an aim reaches nobody (spec: Transitions).
    handle(socket, 'player:aim', ({ lat, lng }) =>
      asPlayer((code, by) =>
        // SPEC-QUESTION: DECISIONS 23 (an aim over the limit is dropped and still acks ok)
        aimLimiter.hit(socket.id)
          ? dispatch(code, { type: 'player:aim', by, lat, lng }, false)
          : { ok: true },
      ),
    );

    // SPEC-QUESTION: "no broadcast except fx lockedIn" read as no position-carrying broadcast: the
    // lock-in still pushes role-filtered state, which Role views need for `lockedIn` and
    // `stillGuessing` and which carries only the viewer's own lock (DECISIONS 25).
    handle(socket, 'player:lockIn', ({ lat, lng }) =>
      asPlayer((code, by) =>
        lockInLimiter.hit(socket.id)
          ? dispatch(code, { type: 'player:lockIn', by, lat, lng })
          : fail(SOCKET_ERRORS.lockInLimited),
      ),
    );

    handle(socket, 'vip:start', () =>
      asVip((code, by) => {
        const categoryId = rooms.get(code)?.settings.categoryId ?? '';
        return dispatch(code, { type: 'vip:start', by, category: categories.get(categoryId) });
      }),
    );

    handle(socket, 'vip:kick', ({ playerId }) =>
      asVip((code, by) => dispatch(code, { type: 'vip:kick', by, playerId })),
    );

    socket.on('disconnect', () => {
      const { code, role, playerId } = socket.data;
      if (!code || !rooms.get(code)) return;
      if (role === 'screen') {
        dispatch(code, { type: 'screen:leave' });
        return;
      }
      if (role !== 'player' || !playerId) return;
      // Socket.IO has already taken this socket out of its rooms: another tab of the same
      // player keeps them connected.
      if (io.sockets.adapter.rooms.get(playerRoom(code, playerId))?.size) return;
      if (!rooms.get(code)?.players[playerId]) return;
      dispatch(code, { type: 'player:connection', playerId, connected: false });
    });
  });

  return { io, dispatch, closeRooms };
}

/**
 * Registers `event` with a zod parse of its payload and a guarded ack. A client may omit the ack
 * or send garbage; neither can throw out of the handler.
 */
function handle<E extends ClientEvent>(
  socket: GatewaySocket,
  event: E,
  fn: (payload: ClientPayload<E>) => Ack,
): void {
  const listener = (raw: unknown, ack: unknown) => {
    const reply = typeof ack === 'function' ? (ack as (res: Ack) => void) : () => {};
    const parsed = clientEventSchemas[event].safeParse(raw);
    if (!parsed.success) {
      reply(fail(`Invalid ${event}: ${z.prettifyError(parsed.error)}`));
      return;
    }
    try {
      reply(fn(parsed.data as ClientPayload<E>));
    } catch (err) {
      console.error(`[sockets] ${event} failed: ${errorText(err)}`);
      reply(fail(SOCKET_ERRORS.server));
    }
  };
  socket.on(event, listener as never);
}

/** Only the message: a stack or a whole error object could one day carry room state into a log. */
const errorText = (err: unknown) => (err instanceof Error ? err.message : 'unknown error');
