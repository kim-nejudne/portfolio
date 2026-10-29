// The Socket.IO gateway: auth, zod parsing, rate limits, `reduce`, then a fresh role-filtered
// `state` for every socket in the room. See "Realtime events and HTTP API" in docs/SPEC.md.

import type { IncomingMessage, Server as HttpServer } from 'node:http';
import express from 'express';
import proxyaddr from 'proxy-addr';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import {
  BUZZ_RATE_LIMIT,
  BUZZ_RATE_LIMITED_ERROR,
  INVALID_HOST_TOKEN_ERROR,
  NOT_HOST_ERROR,
  PING_RATE_LIMIT,
  PING_RATE_LIMITED_ERROR,
  PLAYER_JOIN_RATE_LIMIT,
  PONG_ACK_TIMEOUT_MS,
  RENAME_RATE_LIMIT,
  RENAME_RATE_LIMITED_ERROR,
  ROOM_NOT_FOUND_ERROR,
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
import { addRttSample, medianRtt } from './fairness.js';
import { verifyHostToken } from './hostToken.js';
import { createRateLimiter, type RateLimit } from './rateLimit.js';
import { reduce, type Action, type Effect, type TimerAction } from './reducer.js';
import type { RoomStore } from './roomStore.js';
import { toView } from './views.js';

/** What a socket joined as. Set once, by a successful `*:join`; later events read it. */
export interface SocketData {
  code?: string;
  role?: 'screen' | 'host' | 'player';
  playerId?: string;
  /** May send `host:*` events: a host socket, or a Screen that joined with a valid token (DECISIONS #2). */
  canHost: boolean;
  /** This connection's newest RTT samples (fairness rules). A new socket starts afresh. */
  rttSamples: number[];
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
  /** Monotonic ms (`performance.now`): buzz arrival times and RTT samples. */
  monotonic?: () => number;
  /** Express's `trust proxy` value, so the join limit sees the same client IP as the HTTP layer. */
  trustProxy?: boolean | number | string;
  /** Overridable for tests; defaults to the spec's limit as amended by DECISIONS #3. */
  playerJoinLimit?: RateLimit;
}

/** Reduces `action` in room `code`, stores the result and sends every device its new state. */
export type Dispatch = (code: string, action: Action) => Ack;

/** The running gateway. `dispatch` lets the HTTP layer apply an action too (DECISIONS F49). */
export interface Gateway {
  io: GatewayServer;
  dispatch: Dispatch;
}

/** Every joined socket of a room, whatever its role: `room:closed` goes here. */
export const anyRoom = (code: string) => `room:${code}`;
export const screenRoom = (code: string) => `room:${code}:screen`;
export const hostRoom = (code: string) => `room:${code}:host`;
export const playerRoom = (code: string, playerId: string) => `room:${code}:player:${playerId}`;

export function attachSockets(
  httpServer: HttpServer,
  {
    rooms,
    clock = Date.now,
    monotonic = () => performance.now(),
    trustProxy = false,
    playerJoinLimit = PLAYER_JOIN_RATE_LIMIT,
  }: GatewayOptions,
): Gateway {
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
  // Keyed by socket id: the spec's limit is per socket.
  const buzzLimiter = createRateLimiter(BUZZ_RATE_LIMIT, clock);
  const pingLimiter = createRateLimiter(PING_RATE_LIMIT, clock);
  const renameLimiter = createRateLimiter(RENAME_RATE_LIMIT, clock);

  // Scheduled effects still pending. A timer must not fire into a gateway that has shut down.
  const timers = new Set<ReturnType<typeof setTimeout>>();
  httpServer.once('close', () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  });

  /** Emits each role's view of `room`. Only players in the room get one: `toView` throws for others. */
  function broadcast(room: Room): void {
    io.to(screenRoom(room.code)).emit('state', toView(room, 'screen'));
    io.to(hostRoom(room.code)).emit('state', toView(room, 'host'));
    for (const id of Object.keys(room.players)) {
      io.to(playerRoom(room.code, id)).emit('state', toView(room, 'player', id));
    }
  }

  /** Runs the reducer's effects. `now` is the `now` the reducer was given. */
  function runEffects(room: Room, effects: Effect[], now: number): void {
    for (const effect of effects) {
      switch (effect.type) {
        case 'fx':
          io.to([
            screenRoom(room.code),
            hostRoom(room.code),
            ...Object.keys(room.players).map((id) => playerRoom(room.code, id)),
          ]).emit('fx', effect.fx);
          break;
        case 'schedule':
          schedule(room.code, effect.action, effect.at - now);
          break;
        case 'log': {
          // The round log, for inspecting ties while testing (fairness rules).
          const { questionIndex, openingCounter, buzz } = effect;
          console.info(
            '[buzz]',
            JSON.stringify({ code: room.code, questionIndex, openingCounter, ...buzz }),
          );
          break;
        }
      }
    }
  }

  /**
   * Dispatches `action` after `delayMs`. The delay is fixed when the effect runs, and Node timers
   * run on the monotonic clock, so a wall-clock jump cannot stretch or cut the window (DECISIONS F15).
   * The reducer drops the action if the room has moved on.
   */
  function schedule(code: string, action: TimerAction, delayMs: number): void {
    const timer = setTimeout(
      () => {
        timers.delete(timer);
        try {
          dispatch(code, action);
        } catch (err) {
          console.error(`[sockets] ${action.type} failed`, err);
        }
      },
      Math.max(0, delayMs),
    );
    timers.add(timer);
  }

  /** Reduces, stores and broadcasts. Every game action goes through here. */
  function dispatch(code: string, action: Action): Ack {
    const room = rooms.get(code);
    if (!room) return fail(ROOM_NOT_FOUND_ERROR);
    const now = clock();
    const result = reduce(room, action, now, monotonic());
    if (!result.ok) return fail(result.error);
    // An ignored action (a buzz that does not count, a stale timer) returns the same room object.
    if (result.room !== room) {
      rooms.set(result.room);
      broadcast(result.room);
    }
    runEffects(result.room, result.effects, now);
    return { ok: true };
  }

  /**
   * Adds an RTT sample for this socket and writes the median into the player's `rttMs`. It is a
   * measurement, not a game action: no broadcast and no activity stamp (DECISIONS F15). The Host's
   * RTT column refreshes with the next `state`.
   */
  function recordRtt(socket: GatewaySocket, rttMs: number): void {
    socket.data.rttSamples = addRttSample(socket.data.rttSamples, rttMs);
    const { code, role, playerId } = socket.data;
    if (role !== 'player' || !code || !playerId) return;
    const room = rooms.get(code);
    const player = room?.players[playerId];
    if (!room || !player) return;
    const rtt = medianRtt(socket.data.rttSamples);
    rooms.set({ ...room, players: { ...room.players, [playerId]: { ...player, rttMs: rtt } } });
  }

  /**
   * Tells the room how many host remotes are connected, so the Screen lobby can fold its settings
   * (F66). Returns whether the count changed, and so went out to every device.
   */
  function countHostDevices(code: string): boolean {
    const count = io.sockets.adapter.rooms.get(hostRoom(code))?.size ?? 0;
    if (rooms.get(code)?.hostDevices === count) return false;
    return dispatch(code, { type: 'hostDevices', count }).ok;
  }

  /** A join outside the reducer still counts as activity, or the sweeper could close a live room. */
  function touch(room: Room): Room {
    const touched = { ...room, lastActivityAt: clock() };
    rooms.set(touched);
    return touched;
  }

  io.on('connection', (socket) => {
    socket.data = { canHost: false, rttSamples: [] };

    /** Host flow events need a host socket or a Screen holding the token (DECISIONS #2). */
    const asHost = (action: Action): Ack => {
      const { code, canHost } = socket.data;
      if (!code || !canHost) return fail(NOT_HOST_ERROR);
      return dispatch(code, action);
    };

    handle(socket, 'screen:join', ({ code, hostToken }) => {
      if (socket.data.role) return fail('Already joined');
      const room = rooms.get(code);
      if (!room) return fail(ROOM_NOT_FOUND_ERROR);
      if (hostToken !== undefined && !verifyHostToken(hostToken, room.hostTokenHash)) {
        return fail(INVALID_HOST_TOKEN_ERROR);
      }
      // SPEC-QUESTION: a token authorises host actions only; the Screen still gets ScreenView (DECISIONS #2, F07).
      socket.data = { ...socket.data, code, role: 'screen', canHost: hostToken !== undefined };
      void socket.join([anyRoom(code), screenRoom(code)]);
      socket.emit('state', toView(touch(room), 'screen'));
      return { ok: true };
    });

    handle(socket, 'host:join', ({ code, hostToken }) => {
      if (socket.data.role) return fail('Already joined');
      const room = rooms.get(code);
      if (!room) return fail(ROOM_NOT_FOUND_ERROR);
      if (!verifyHostToken(hostToken, room.hostTokenHash)) return fail(INVALID_HOST_TOKEN_ERROR);
      socket.data = { ...socket.data, code, role: 'host', canHost: true };
      void socket.join([anyRoom(code), hostRoom(code)]);
      // A new count reaches every device, this one included; otherwise only this one needs a state.
      if (!countHostDevices(code)) socket.emit('state', toView(touch(room), 'host'));
      // The pairing QR has done its job: every other device showing it closes it (F38).
      socket.to([screenRoom(code), hostRoom(code)]).emit('host:paired', {});
      return { ok: true };
    });

    handle(socket, 'player:join', ({ code, playerId, name, avatar }) => {
      if (socket.data.role) return fail('Already joined');
      const room = rooms.get(code);
      if (!room) return fail(ROOM_NOT_FOUND_ERROR);
      // SPEC-QUESTION: only joins that would add a player count; a known id always gets through (DECISIONS #3, F07).
      if (!room.players[playerId] && !joinLimiter.hit(clientIp(socket.request))) {
        return fail('Too many joins from this network. Try again in a minute.');
      }
      // Join the Socket.IO room first, so the broadcast inside dispatch reaches this socket too.
      void socket.join(playerRoom(code, playerId));
      const ack = dispatch(code, { type: 'player:join', playerId, name, avatar });
      if (!ack.ok) {
        void socket.leave(playerRoom(code, playerId));
        return ack;
      }
      void socket.join(anyRoom(code));
      socket.data = { ...socket.data, code, role: 'player', playerId, canHost: false };
      return ack;
    });

    // SPEC-QUESTION: `pong {t}` alone lets only the client time RTT; the server times emit → ack (DECISIONS F15).
    handle(socket, 'ping', ({ t }) => {
      if (!pingLimiter.hit(socket.id)) return fail(PING_RATE_LIMITED_ERROR);
      const sentAt = monotonic();
      socket.timeout(PONG_ACK_TIMEOUT_MS).emit('pong', { t }, (err: Error | null) => {
        if (!err) recordRtt(socket, monotonic() - sentAt);
      });
      return { ok: true };
    });

    handle(socket, 'player:buzz', () => {
      // Arrival time first: the ranking compares these (fairness rules).
      const receivedAt = monotonic();
      const { code, role, playerId } = socket.data;
      if (role !== 'player' || !code || !playerId) return fail('Join the game first');
      if (!buzzLimiter.hit(socket.id)) return fail(BUZZ_RATE_LIMITED_ERROR);
      return dispatch(code, { type: 'player:buzz', playerId, receivedAt });
    });

    // Shares the buzz budget: one limit per socket on how fast a phone can press (DECISIONS F59).
    handle(socket, 'player:practice', () => {
      const { code, role, playerId } = socket.data;
      if (role !== 'player' || !code || !playerId) return fail('Join the game first');
      if (!buzzLimiter.hit(socket.id)) return fail(BUZZ_RATE_LIMITED_ERROR);
      return dispatch(code, { type: 'player:practice', playerId });
    });

    handle(socket, 'player:rename', ({ name }) => {
      const { code, role, playerId } = socket.data;
      if (role !== 'player' || !code || !playerId) return fail('Join the game first');
      if (!renameLimiter.hit(socket.id)) return fail(RENAME_RATE_LIMITED_ERROR);
      return dispatch(code, { type: 'player:rename', playerId, name });
    });

    handle(socket, 'player:leave', () => {
      const { code, role, playerId } = socket.data;
      if (role !== 'player' || !code || !playerId) return fail('Join the game first');
      const ack = dispatch(code, { type: 'player:leave', playerId });
      if (!ack.ok) return ack;
      // Not a kick: every socket of this player stays connected but unjoined, so the phone can
      // join again as a new player on the same connection (DECISIONS F61).
      for (const id of io.sockets.adapter.rooms.get(playerRoom(code, playerId)) ?? []) {
        const own = io.sockets.sockets.get(id);
        if (!own) continue;
        void own.leave(playerRoom(code, playerId));
        void own.leave(anyRoom(code));
        own.data = { canHost: false, rttSamples: [] };
      }
      return ack;
    });

    handle(socket, 'host:start', () => asHost({ type: 'host:start' }));
    handle(socket, 'host:open', () => asHost({ type: 'host:open' }));
    handle(socket, 'host:reveal', () => asHost({ type: 'host:reveal' }));
    handle(socket, 'host:next', () => asHost({ type: 'host:next' }));
    handle(socket, 'host:prev', () => asHost({ type: 'host:prev' }));
    handle(socket, 'host:end', () => asHost({ type: 'host:end' }));
    handle(socket, 'host:scoreboard', ({ show }) => asHost({ type: 'host:scoreboard', show }));
    handle(socket, 'host:judge', ({ result }) => asHost({ type: 'host:judge', result }));
    handle(socket, 'host:undo', () => asHost({ type: 'host:undo' }));
    handle(socket, 'host:adjustScore', ({ playerId, delta }) =>
      asHost({ type: 'host:adjustScore', playerId, delta }),
    );
    handle(socket, 'host:settings', (settings) => asHost({ type: 'host:settings', settings }));
    handle(socket, 'host:setTeam', ({ playerId, team }) =>
      asHost({ type: 'host:setTeam', playerId, team }),
    );

    handle(socket, 'host:kick', ({ playerId }) => {
      const { code } = socket.data;
      const ack = asHost({ type: 'host:kick', playerId });
      if (!ack.ok || !code) return ack;
      // The reducer has removed the player, so the broadcast skipped them. `kicked` goes out first;
      // the disconnect packet follows on the same connection, and Socket.IO clients do not
      // reconnect after a server disconnect (DECISIONS F21).
      const own = playerRoom(code, playerId);
      io.to(own).emit('kicked', {});
      io.in(own).disconnectSockets();
      return ack;
    });

    socket.on('disconnect', () => {
      const { code, role, playerId } = socket.data;
      // Socket.IO has already taken the socket out of its rooms, so the count leaves it out.
      if (role === 'host' && code && rooms.get(code)) countHostDevices(code);
      if (role !== 'player' || !code || !playerId) return;
      // A phone that reconnected before its old socket timed out is still here: keep it connected.
      if (io.sockets.adapter.rooms.get(playerRoom(code, playerId))?.size) return;
      if (!rooms.get(code)?.players[playerId]) return;
      dispatch(code, { type: 'player:disconnect', playerId });
    });
  });

  return { io, dispatch };
}

/**
 * Tells every socket still in each of `codes` that its room is gone, then disconnects them. Call it
 * after the rooms have left the store. Socket.IO clients do not reconnect after a server
 * disconnect, so nobody retries a join into a room that no longer exists.
 */
// SPEC-QUESTION: `room:closed` goes out on expiry, with reason 'expired', then a server disconnect (DECISIONS, F32).
export function closeRooms(io: GatewayServer, codes: string[], reason: string): void {
  for (const code of codes) {
    io.to(anyRoom(code)).emit('room:closed', { reason });
    io.in(anyRoom(code)).disconnectSockets();
  }
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
