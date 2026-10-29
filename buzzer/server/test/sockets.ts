// The socket gateway harness shared by the `server/sockets*.test.ts` files: a real gateway and the
// HTTP app on a random port, real Socket.IO clients, and clocks the tests move. Left out of the build.

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { expect } from 'vitest';
import type {
  Ack,
  ClientToServerEvents,
  Room,
  ServerToClientEvents,
  View,
} from '../../shared/types.js';
import { generateHostToken, hashHostToken } from '../hostToken.js';
import { createApp } from '../http.js';
import { InMemoryImageStore } from '../imageStore.js';
import type { RateLimit } from '../rateLimit.js';
import { InMemoryRoomStore } from '../roomStore.js';
import { attachSockets, type GatewayServer } from '../sockets.js';
import { makeRoom, T0 } from './rooms.js';

export type TestClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

/** The host token of the room `start` creates by default. */
export const TOKEN = generateHostToken();

let servers: GatewayServer[] = [];
let clients: TestClient[] = [];

/** Disconnects every client and closes every gateway `start` opened. Call it from `afterEach`. */
export async function stopAll(): Promise<void> {
  for (const c of clients) c.disconnect();
  clients = [];
  await Promise.all(servers.map((io) => new Promise((resolve) => io.close(resolve))));
  servers = [];
}

export interface Harness {
  io: GatewayServer;
  rooms: InMemoryRoomStore;
  images: InMemoryImageStore;
  /** The HTTP origin, such as `http://127.0.0.1:51234`. Its routes dispatch through the gateway. */
  base: string;
  connect(): Promise<TestClient>;
  /** Moves the wall clock (reducer `now`, rate limiters). It starts at `T0`. */
  advance(ms: number): void;
  /** Moves the monotonic clock (buzz arrival, RTT). Only with `fakeMonotonic`. */
  advanceMono(ms: number): void;
}

export interface StartOptions {
  /** The room the gateway starts with. Default: room ABCD holding `TOKEN`. `null` starts with no rooms, as after a server restart. */
  room?: Room | null;
  /** Gives the gateway a monotonic clock that starts at 1000 and moves only with `advanceMono`. Otherwise it uses `performance.now`. */
  fakeMonotonic?: boolean;
  playerJoinLimit?: RateLimit;
}

/** A gateway on its own port. */
export async function start({
  room = makeRoom({ hostTokenHash: hashHostToken(TOKEN) }),
  fakeMonotonic = false,
  playerJoinLimit,
}: StartOptions = {}): Promise<Harness> {
  let now = T0;
  let mono = 1000;
  const rooms = new InMemoryRoomStore();
  const images = new InMemoryImageStore();
  if (room) rooms.set(room);
  // Bound late, as in index.ts: the gateway needs the server first.
  const httpServer = createServer(
    createApp({
      rooms,
      images,
      clock: () => now,
      dispatch: (code, action) => gateway.dispatch(code, action),
    }),
  );
  const gateway = attachSockets(httpServer, {
    rooms,
    clock: () => now,
    ...(fakeMonotonic && { monotonic: () => mono }),
    ...(playerJoinLimit && { playerJoinLimit }),
  });
  const { io } = gateway;
  servers.push(io);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;

  return {
    io,
    rooms,
    images,
    base: `http://127.0.0.1:${port}`,
    advance: (ms) => (now += ms),
    advanceMono(ms) {
      if (!fakeMonotonic) throw new Error('advanceMono needs start({ fakeMonotonic: true })');
      mono += ms;
    },
    async connect() {
      const client: TestClient = connectClient(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });
      clients.push(client);
      await new Promise<void>((resolve, reject) => {
        client.once('connect', resolve);
        client.once('connect_error', reject);
      });
      return client;
    },
  };
}

/** Every `event` payload the client receives, newest last. Attach before the event that triggers them. */
export function record<T>(client: TestClient, event: 'fx' | 'state'): T[] {
  const seen: T[] = [];
  client.on(event, (payload: unknown) => seen.push(payload as T));
  return seen;
}

/** Every `state` the client receives, newest last. Attach before the event that triggers them. */
export function recordStates(client: TestClient): View[] {
  const states: View[] = [];
  client.on('state', (view) => states.push(view));
  return states;
}

export function nextState(client: TestClient): Promise<View> {
  return new Promise((resolve) => client.once('state', resolve));
}

/**
 * An acked round trip with no side effects on a joined socket ("Already joined"). Everything the
 * server sent this socket before it has arrived.
 */
export const flush = (c: TestClient): Promise<Ack> =>
  c.emitWithAck('screen:join', { code: 'ABCD' });

// The gateway sends `state` before the ack, so a client's own state has arrived by the time the ack does.
export const screenJoin = (c: TestClient, hostToken?: string): Promise<Ack> =>
  c.emitWithAck('screen:join', hostToken ? { code: 'ABCD', hostToken } : { code: 'ABCD' });
export const hostJoin = (c: TestClient, hostToken = TOKEN): Promise<Ack> =>
  c.emitWithAck('host:join', { code: 'ABCD', hostToken });
export const playerJoin = (c: TestClient, playerId: string, name = playerId): Promise<Ack> =>
  c.emitWithAck('player:join', { code: 'ABCD', playerId, name });

/** Screen, host and players a and b, joined, with question 1 open. The monotonic clock is fake. */
export async function openTable() {
  const h = await start({ fakeMonotonic: true });
  const [screen, host, a, b] = await Promise.all([
    h.connect(),
    h.connect(),
    h.connect(),
    h.connect(),
  ]);
  await screen.emitWithAck('screen:join', { code: 'ABCD' });
  await host.emitWithAck('host:join', { code: 'ABCD', hostToken: TOKEN });
  await a.emitWithAck('player:join', { code: 'ABCD', playerId: 'a', name: 'Ann' });
  await b.emitWithAck('player:join', { code: 'ABCD', playerId: 'b', name: 'Bob' });
  expect(await host.emitWithAck('host:start', {})).toEqual({ ok: true });
  expect(await host.emitWithAck('host:open', {})).toEqual({ ok: true });
  // Every join, start and open broadcast has landed before a test starts recording.
  await Promise.all([screen, host, a, b].map(flush));
  return { h, screen, host, a, b };
}

/** Resolves once the server has handled `client`'s disconnect, gateway listener included. */
export function serverDisconnect(h: Harness, client: TestClient): Promise<void> {
  const serverSocket = h.io.sockets.sockets.get(client.id!)!;
  const done = new Promise<void>((resolve) =>
    serverSocket.once('disconnect', () => setImmediate(resolve)),
  );
  client.disconnect();
  return done;
}
