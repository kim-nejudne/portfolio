import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { SOCKET_MESSAGE_MAX_BYTES } from '../shared/constants.js';
import type { Ack, ClientToServerEvents, Fx, ServerToClientEvents, View } from '../shared/types.js';
import { generateHostToken, hashHostToken } from './hostToken.js';
import type { RateLimit } from './rateLimit.js';
import { InMemoryRoomStore } from './roomStore.js';
import { attachSockets, type GatewayServer } from './sockets.js';
import { makeRoom, makeSet, T0 } from './test/rooms.js';

type TestClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

const TOKEN = generateHostToken();
const TOKEN_HASH = hashHostToken(TOKEN);
const SECRETS = makeSet().questions.flatMap((q) => [q.answer, q.hostNotes!]);

let io: GatewayServer | undefined;
let clients: TestClient[] = [];

afterEach(async () => {
  for (const c of clients) c.disconnect();
  clients = [];
  await new Promise((resolve) => (io ? io.close(resolve) : resolve(undefined)));
  io = undefined;
});

interface Harness {
  rooms: InMemoryRoomStore;
  connect(): Promise<TestClient>;
  advance(ms: number): void;
}

async function start(options: { playerJoinLimit?: RateLimit } = {}): Promise<Harness> {
  let now = T0;
  const rooms = new InMemoryRoomStore();
  rooms.set(makeRoom({ hostTokenHash: TOKEN_HASH }));
  const httpServer = createServer();
  io = attachSockets(httpServer, { rooms, clock: () => now, ...options });
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;

  return {
    rooms,
    advance: (ms) => (now += ms),
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

/** Every `state` the client receives, newest last. Attach before the event that triggers them. */
function recordStates(client: TestClient): View[] {
  const states: View[] = [];
  client.on('state', (view) => states.push(view));
  return states;
}

function nextState(client: TestClient): Promise<View> {
  return new Promise((resolve) => client.once('state', resolve));
}

function nextFx(client: TestClient): Promise<Fx> {
  return new Promise((resolve) => client.once('fx', resolve));
}

// The gateway sends `state` before the ack, so a client's own state has arrived by the time the ack does.
const screenJoin = (c: TestClient, hostToken?: string): Promise<Ack> =>
  c.emitWithAck('screen:join', hostToken ? { code: 'ABCD', hostToken } : { code: 'ABCD' });
const hostJoin = (c: TestClient, hostToken = TOKEN): Promise<Ack> =>
  c.emitWithAck('host:join', { code: 'ABCD', hostToken });
const playerJoin = (c: TestClient, playerId: string, name = playerId): Promise<Ack> =>
  c.emitWithAck('player:join', { code: 'ABCD', playerId, name });

/** Resolves once the server has handled `client`'s disconnect, gateway listener included. */
function serverDisconnect(client: TestClient): Promise<void> {
  const serverSocket = io!.sockets.sockets.get(client.id!)!;
  const done = new Promise<void>((resolve) =>
    serverSocket.once('disconnect', () => setImmediate(resolve)),
  );
  client.disconnect();
  return done;
}

describe('socket gateway: joins', () => {
  it('rejects host:join with a wrong token and sends no state', async () => {
    const h = await start();
    const host = await h.connect();
    const states = recordStates(host);
    expect(await hostJoin(host, generateHostToken())).toEqual({
      ok: false,
      error: 'Invalid host token',
    });
    expect(states).toEqual([]);
  });

  it('rejects screen:join with a wrong token', async () => {
    const h = await start();
    const screen = await h.connect();
    const states = recordStates(screen);
    expect(await screenJoin(screen, generateHostToken())).toEqual({
      ok: false,
      error: 'Invalid host token',
    });
    expect(states).toEqual([]);
  });

  it('gives a host with the right token the HostView, answers included', async () => {
    const h = await start();
    const host = await h.connect();
    const states = recordStates(host);
    expect(await hostJoin(host)).toEqual({ ok: true });
    expect(states).toHaveLength(1);
    expect(states[0]!.role).toBe('host');
    expect(JSON.stringify(states[0])).toContain('Answer-1-secret');
  });

  it('sends a Screen holding the hostToken only ScreenView, with no answer, notes or token hash', async () => {
    const h = await start();
    const screen = await h.connect();
    const states = recordStates(screen);
    expect(await screenJoin(screen, TOKEN)).toEqual({ ok: true });

    const player = await h.connect();
    const afterJoin = nextState(screen);
    await playerJoin(player, 'p1', 'Ana');
    await afterJoin;

    expect(states).toHaveLength(2);
    for (const view of states) {
      expect(view.role).toBe('screen');
      const json = JSON.stringify(view);
      for (const secret of [...SECRETS, TOKEN_HASH]) expect(json).not.toContain(secret);
    }
  });

  it('answers an unknown room with "Room not found"', async () => {
    const h = await start();
    const player = await h.connect();
    expect(
      await player.emitWithAck('player:join', { code: 'WXYZ', playerId: 'p1', name: 'Ana' }),
    ).toEqual({ ok: false, error: 'Room not found' });
  });

  it('rejects a second join on the same socket', async () => {
    const h = await start();
    const player = await h.connect();
    await playerJoin(player, 'p1', 'Ana');
    expect(await screenJoin(player)).toEqual({ ok: false, error: 'Already joined' });
    expect(await playerJoin(player, 'p2', 'Bo')).toEqual({ ok: false, error: 'Already joined' });
    expect(Object.keys(h.rooms.get('ABCD')!.players)).toEqual(['p1']);
  });

  it('passes a reducer rejection through the ack, and the player gets no state', async () => {
    const h = await start();
    await playerJoin(await h.connect(), 'p1', 'Ana');
    const second = await h.connect();
    const states = recordStates(second);
    expect(await playerJoin(second, 'p2', 'ana')).toEqual({
      ok: false,
      error: 'That name is taken',
    });
    expect(states).toEqual([]);
  });
});

describe('socket gateway: validation and limits', () => {
  it('acks an invalid payload with an error naming the event, and changes nothing', async () => {
    const h = await start();
    const player = await h.connect();
    const states = recordStates(player);
    const ack = await player.emitWithAck('player:join', {
      code: 'ABCD',
      playerId: 'p1',
      name: '   ',
    });
    expect(ack.ok).toBe(false);
    expect(!ack.ok && ack.error).toMatch(/^Invalid player:join:/);
    expect(states).toEqual([]);
    expect(h.rooms.get('ABCD')!.players).toEqual({});
  });

  it('acks a payload that is not an object at all', async () => {
    const h = await start();
    const host = await h.connect();
    const ack = await (host.emitWithAck as (e: string, p: unknown) => Promise<Ack>)(
      'host:join',
      'ABCD',
    );
    expect(ack.ok).toBe(false);
  });

  it('closes a socket that sends a message over 100 KB', async () => {
    const h = await start();
    const player = await h.connect();
    const closed = new Promise<string>((resolve) => player.once('disconnect', resolve));
    player.emit(
      'player:join',
      { code: 'ABCD', playerId: 'p1', name: 'x'.repeat(SOCKET_MESSAGE_MAX_BYTES) },
      () => {},
    );
    expect(await closed).toBe('transport close');
    expect(h.rooms.get('ABCD')!.players).toEqual({});
  });

  it('rate-limits new players per IP, lets known players reconnect, and frees up after the window', async () => {
    const h = await start({ playerJoinLimit: { max: 2, windowMs: 60_000 } });
    const first = await h.connect();
    expect(await playerJoin(first, 'p1')).toEqual({ ok: true });
    expect(await playerJoin(await h.connect(), 'p2')).toEqual({ ok: true });
    expect(await playerJoin(await h.connect(), 'p3')).toEqual({
      ok: false,
      error: 'Too many joins from this network. Try again in a minute.',
    });

    await serverDisconnect(first);
    expect(await playerJoin(await h.connect(), 'p1')).toEqual({ ok: true });

    h.advance(60_000);
    expect(await playerJoin(await h.connect(), 'p3')).toEqual({ ok: true });
  });
  it('lets 20 bots from one IP join at once under the default limit (Dev tool: fake players)', async () => {
    const h = await start();
    const bots = await Promise.all(Array.from({ length: 20 }, () => h.connect()));
    const acks = await Promise.all(bots.map((c, i) => playerJoin(c, `bot-${i + 1}`)));
    expect(acks.every((ack) => ack.ok)).toBe(true);
    expect(Object.keys(h.rooms.get('ABCD')!.players)).toHaveLength(20);
  });
});

describe('socket gateway: state broadcast', () => {
  it('sends Screen, Host and every player a fresh role-filtered state, then fx join, after a join', async () => {
    const h = await start();
    const screen = await h.connect();
    const host = await h.connect();
    const ana = await h.connect();
    await screenJoin(screen);
    await hostJoin(host);
    await playerJoin(ana, 'p1', 'Ana');

    const bo = await h.connect();
    const views = [screen, host, ana].map(nextState);
    const fxs = [screen, host, ana].map(nextFx);
    const boStates = recordStates(bo);
    await playerJoin(bo, 'p2', 'Bo');
    const [screenView, hostView, anaView] = await Promise.all(views);

    expect(screenView!.role).toBe('screen');
    expect(hostView!.role).toBe('host');
    expect(anaView!.role).toBe('player');
    for (const view of [screenView!, hostView!]) {
      expect(view.role !== 'player' && view.players.map((p) => p.name)).toEqual(['Ana', 'Bo']);
    }
    for (const [view, id] of [
      [anaView!, 'p1'],
      [boStates[0]!, 'p2'],
    ] as const) {
      expect(view.role === 'player' && [view.me.id, view.playerCount]).toEqual([id, 2]);
    }
    expect(await Promise.all(fxs)).toEqual(Array(3).fill({ kind: 'join', playerId: 'p2' }));
  });

  it('marks a player disconnected when their socket drops, and a reconnect keeps the same id and score', async () => {
    const h = await start();
    const host = await h.connect();
    await hostJoin(host);
    const phone = await h.connect();
    await playerJoin(phone, 'p1', 'Ana');
    const room = h.rooms.get('ABCD')!;
    h.rooms.set({ ...room, players: { p1: { ...room.players.p1!, score: 300 } } });

    const dropped = nextState(host);
    await serverDisconnect(phone);
    const afterDrop = await dropped;
    expect(afterDrop.role === 'host' && afterDrop.players).toMatchObject([
      { id: 'p1', connected: false },
    ]);

    const again = await h.connect();
    const states = recordStates(again);
    const back = nextState(host);
    expect(await playerJoin(again, 'p1', 'Someone else')).toEqual({ ok: true });
    const view = states[0]!;
    expect(view.role).toBe('player');
    expect(view.role === 'player' && view.me).toMatchObject({
      id: 'p1',
      name: 'Ana',
      score: 300,
    });
    const afterReturn = await back;
    expect(afterReturn.role === 'host' && afterReturn.players).toMatchObject([
      { id: 'p1', connected: true },
    ]);
    expect(Object.keys(h.rooms.get('ABCD')!.players)).toEqual(['p1']);
  });

  it('keeps a player connected when the old socket drops after the new one joined', async () => {
    const h = await start();
    const oldPhone = await h.connect();
    await playerJoin(oldPhone, 'p1', 'Ana');
    const newPhone = await h.connect();
    await playerJoin(newPhone, 'p1', 'Ana');

    await serverDisconnect(oldPhone);
    expect(h.rooms.get('ABCD')!.players.p1!.connected).toBe(true);
  });

  it('bumps lastActivityAt on every join, so the sweeper does not close a room in use', async () => {
    const h = await start();
    h.advance(1000);
    await screenJoin(await h.connect());
    expect(h.rooms.get('ABCD')!.lastActivityAt).toBe(T0 + 1000);
    h.advance(1000);
    await hostJoin(await h.connect());
    expect(h.rooms.get('ABCD')!.lastActivityAt).toBe(T0 + 2000);
    h.advance(1000);
    await playerJoin(await h.connect(), 'p1');
    expect(h.rooms.get('ABCD')!.lastActivityAt).toBe(T0 + 3000);
  });
});
