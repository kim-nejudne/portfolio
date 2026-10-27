// Reconnects and room lifecycle (Reconnects, security and edge cases › Reconnects): every role
// gets the latest snapshot back on a new socket, and a room that goes away tells everyone in it.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ROOM_EXPIRED_REASON,
  ROOM_IDLE_TTL_MS,
  ROOM_NOT_FOUND_ERROR,
} from '../shared/constants.js';
import type { Ack, ClientToServerEvents, ServerToClientEvents, View } from '../shared/types.js';
import { generateHostToken, hashHostToken } from './hostToken.js';
import { InMemoryRoomStore } from './roomStore.js';
import { attachSockets, closeRooms, type GatewayServer } from './sockets.js';
import { makePlayer, makeRoom, T0, withPlayers } from './test/rooms.js';

type TestClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

const TOKEN = generateHostToken();

let servers: GatewayServer[] = [];
let clients: TestClient[] = [];

afterEach(async () => {
  for (const c of clients) c.disconnect();
  clients = [];
  await Promise.all(servers.map((io) => new Promise((resolve) => io.close(resolve))));
  servers = [];
});

interface Harness {
  io: GatewayServer;
  rooms: InMemoryRoomStore;
  connect(): Promise<TestClient>;
}

/** A gateway on its own port. `empty` starts with no rooms, as after a server restart. */
async function start({ empty = false } = {}): Promise<Harness> {
  const rooms = new InMemoryRoomStore();
  if (!empty) rooms.set(midGame());
  const httpServer = createServer();
  const io = attachSockets(httpServer, { rooms, clock: () => T0 });
  servers.push(io);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;

  return {
    io,
    rooms,
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

/** Question 2 is open; Ana has 300 points and is locked out after a wrong answer. */
function midGame() {
  return withPlayers(
    makeRoom({
      hostTokenHash: hashHostToken(TOKEN),
      phase: 'OPEN',
      questionIndex: 1,
      openingCounter: 2,
      lockedOut: ['p1'],
    }),
    [makePlayer('p1', { name: 'Ana', score: 300 }), makePlayer('p2', { name: 'Ben', score: 100 })],
  );
}

const screenJoin = (c: TestClient, hostToken?: string): Promise<Ack> =>
  c.emitWithAck('screen:join', hostToken ? { code: 'ABCD', hostToken } : { code: 'ABCD' });
const hostJoin = (c: TestClient): Promise<Ack> =>
  c.emitWithAck('host:join', { code: 'ABCD', hostToken: TOKEN });
const playerJoin = (c: TestClient, playerId: string, name = playerId): Promise<Ack> =>
  c.emitWithAck('player:join', { code: 'ABCD', playerId, name });

function recordStates(client: TestClient): View[] {
  const states: View[] = [];
  client.on('state', (view) => states.push(view));
  return states;
}

function nextState(client: TestClient): Promise<View> {
  return new Promise((resolve) => client.once('state', resolve));
}

/** Resolves once the server has handled `client`'s disconnect, gateway listener included. */
function serverDisconnect(h: Harness, client: TestClient): Promise<void> {
  const serverSocket = h.io.sockets.sockets.get(client.id!)!;
  const done = new Promise<void>((resolve) =>
    serverSocket.once('disconnect', () => setImmediate(resolve)),
  );
  client.disconnect();
  return done;
}

describe('reconnects', () => {
  it('a player who drops mid-question rejoins on a new socket with their score and lockout', async () => {
    const h = await start();
    const phone = await h.connect();
    await playerJoin(phone, 'p1', 'Ana');
    await serverDisconnect(h, phone);
    expect(h.rooms.get('ABCD')!.players.p1!.connected).toBe(false);

    const again = await h.connect();
    const states = recordStates(again);
    expect(await playerJoin(again, 'p1', 'Ana')).toEqual({ ok: true });
    expect(states.at(-1)).toMatchObject({
      role: 'player',
      phase: 'OPEN',
      questionIndex: 1,
      lockedOut: true,
      me: { id: 'p1', name: 'Ana', score: 300 },
    });
  });

  it('a disconnected player stays listed, marked offline, on the Screen and the Host', async () => {
    const h = await start();
    const screen = await h.connect();
    await screenJoin(screen);
    const host = await h.connect();
    await hostJoin(host);
    const phone = await h.connect();
    await playerJoin(phone, 'p2', 'Ben');

    const onScreen = nextState(screen);
    const onHost = nextState(host);
    await serverDisconnect(h, phone);
    for (const view of [await onScreen, await onHost]) {
      expect(view.role !== 'player' && view.players).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'p2', connected: false })]),
      );
    }
  });

  it('a refreshed Screen and Host each get the latest snapshot on their new socket', async () => {
    const h = await start();
    const oldScreen = await h.connect();
    await screenJoin(oldScreen, TOKEN);
    const oldHost = await h.connect();
    await hostJoin(oldHost);
    // The game moves on while both are reloading.
    const host = await h.connect();
    await hostJoin(host);
    await host.emitWithAck('host:reveal', {});
    oldScreen.disconnect();
    oldHost.disconnect();

    const screen = await h.connect();
    const screenStates = recordStates(screen);
    expect(await screenJoin(screen, TOKEN)).toEqual({ ok: true });
    const hostAgain = await h.connect();
    const hostStates = recordStates(hostAgain);
    expect(await hostJoin(hostAgain)).toEqual({ ok: true });

    expect(screenStates.at(-1)).toMatchObject({
      role: 'screen',
      phase: 'REVEAL',
      questionIndex: 1,
    });
    expect(hostStates.at(-1)).toMatchObject({ role: 'host', phase: 'REVEAL', questionIndex: 1 });
    // A Screen holding the token may send host actions again after the refresh.
    expect(await screen.emitWithAck('host:next', {})).toEqual({ ok: true });
  });

  it('the host can still judge a buzz winner who disconnected before judgement', async () => {
    const h = await start();
    h.rooms.set({ ...midGame(), phase: 'BUZZED', lockedOut: [], winnerId: 'p2' });
    const host = await h.connect();
    await hostJoin(host);
    const phone = await h.connect();
    await playerJoin(phone, 'p2', 'Ben');
    await serverDisconnect(h, phone);

    expect(await host.emitWithAck('host:judge', { result: 'correct' })).toEqual({ ok: true });
    expect(h.rooms.get('ABCD')!.players.p2).toMatchObject({ connected: false, score: 200 });
  });
});

describe('room lifecycle', () => {
  it('an expired room sends room:closed to every device in it and disconnects them', async () => {
    const h = await start();
    const screen = await h.connect();
    await screenJoin(screen);
    const host = await h.connect();
    await hostJoin(host);
    const phone = await h.connect();
    await playerJoin(phone, 'p1', 'Ana');
    // A socket that never joined is not part of the room.
    const stranger = await h.connect();
    let strangerClosed = false;
    stranger.on('room:closed', () => (strangerClosed = true));

    const outcomes = [screen, host, phone].map(
      (client) =>
        new Promise<{ reason: string; disconnect: string }>((resolve) =>
          client.once('room:closed', ({ reason }) =>
            client.once('disconnect', (why) => resolve({ reason, disconnect: why })),
          ),
        ),
    );
    const expired = h.rooms.sweep(T0 + ROOM_IDLE_TTL_MS);
    expect(expired).toEqual(['ABCD']);
    closeRooms(h.io, expired, ROOM_EXPIRED_REASON);

    expect(await Promise.all(outcomes)).toEqual(
      Array(3).fill({ reason: ROOM_EXPIRED_REASON, disconnect: 'io server disconnect' }),
    );
    expect(strangerClosed).toBe(false);
    expect(stranger.connected).toBe(true);
  });

  it('after a server restart, every role rejoining the lost room is told "Room not found"', async () => {
    const h = await start({ empty: true });
    const screen = await h.connect();
    const host = await h.connect();
    const phone = await h.connect();
    const fail = { ok: false, error: ROOM_NOT_FOUND_ERROR };
    expect(await screenJoin(screen, TOKEN)).toEqual(fail);
    expect(await hostJoin(host)).toEqual(fail);
    expect(await playerJoin(phone, 'p1', 'Ana')).toEqual(fail);
  });
});
