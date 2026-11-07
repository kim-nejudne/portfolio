import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { ROOM_IDLE_TTL_MS, SOCKET_MAX_BYTES, VIP_AWAY_MS } from '#shared/constants.js';
import type { ClientToServerEvents } from '#shared/schemas.js';
import type {
  Ack,
  PlayerFx,
  PlayerView,
  ScreenFx,
  ScreenView,
  ServerToClientEvents,
  View,
} from '#shared/types.js';
import { createApp } from './http.js';
import { createRateLimiter, type RateLimit } from './rateLimit.js';
import { ERRORS, playerIdentity } from './reducer.js';
import { createRoom, RoomStore, startRoomSweeper } from './roomStore.js';
import { attachSockets, type GatewayServer, SOCKET_ERRORS } from './sockets.js';

type TestClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

const CODE = 'ABCD';
const T0 = 1_000_000;
const key = (n: number) => `key-${String(n).padStart(17, '0')}`;
const idOf = (n: number) => playerIdentity(CODE, key(n)).id;

let servers: GatewayServer[] = [];
let clients: TestClient[] = [];
let stops: (() => void)[] = [];

afterEach(async () => {
  for (const c of clients) c.disconnect();
  for (const stop of stops) stop();
  clients = [];
  stops = [];
  await Promise.all(servers.map((io) => new Promise((resolve) => io.close(resolve))));
  servers = [];
});

interface StartOptions {
  playerJoinLimit?: RateLimit;
  lookupLimit?: RateLimit;
}

/** A real gateway on a random port with room ABCD, a clock the test moves and hand-fired timers. */
async function start({ playerJoinLimit, lookupLimit }: StartOptions = {}) {
  let now = T0;
  const clock = () => now;
  const rooms = new RoomStore();
  rooms.set(createRoom(CODE, T0, 7));
  const timers: { fn: () => void; ms: number }[] = [];
  const roomLookupLimiter = lookupLimit ? createRateLimiter(lookupLimit, clock) : undefined;
  const httpServer = createServer(createApp({ rooms, clock, log: () => {}, roomLookupLimiter }));
  const gateway = attachSockets(httpServer, {
    rooms,
    publicUrl: 'https://pinpoint.example',
    clock,
    roomLookupLimiter,
    playerJoinLimit,
    setTimer: (fn, ms) => timers.push({ fn, ms }),
  });
  servers.push(gateway.io);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;

  return {
    rooms,
    gateway,
    timers,
    clock,
    advance: (ms: number) => (now += ms),
    async connect(): Promise<TestClient> {
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

type Harness = Awaited<ReturnType<typeof start>>;

/** The newest `state` the client has received, kept up to date. */
function latest<V extends View>(client: TestClient): { view: V | null } {
  const box: { view: V | null } = { view: null };
  client.on('state', (v) => (box.view = v as V));
  return box;
}

function nextEvent<T>(client: TestClient, event: 'fx' | 'kicked' | 'room:closed' | 'disconnect') {
  return new Promise<T>((resolve) => (client as ClientSocket).once(event, resolve));
}

// The gateway emits `state` before it acks, so the joiner's own state has arrived with the ack.
const playerJoin = (c: TestClient, n: number, name = `P${n}`, emoji = ['🦊', '🐸', '🐙'][n % 3]) =>
  c.emitWithAck('player:join', { code: CODE, playerKey: key(n), name, emoji: emoji as never });
const screenJoin = (c: TestClient) => c.emitWithAck('screen:join', { code: CODE });

/** An acked no-op round trip: everything the server sent before it has arrived. */
const flush = (c: TestClient) => c.emitWithAck('player:rename', { name: '' });

/** Resolves once the server has handled `client`'s disconnect. */
function serverDisconnect(h: Harness, client: TestClient): Promise<void> {
  const serverSocket = h.gateway.io.sockets.sockets.get(client.id!)!;
  const done = new Promise<void>((resolve) =>
    serverSocket.once('disconnect', () => setImmediate(resolve)),
  );
  client.disconnect();
  return done;
}

describe('socket gateway: lobby', () => {
  it('sends a Screen and two players their own role-filtered lobby state', async () => {
    const h = await start();
    const [screen, a, b] = [await h.connect(), await h.connect(), await h.connect()];
    const screenState = latest<ScreenView>(screen);
    const aState = latest<PlayerView>(a);
    const bState = latest<PlayerView>(b);

    expect(await screenJoin(screen)).toEqual({ ok: true });
    expect(await playerJoin(a, 1)).toEqual({ ok: true });
    expect(await playerJoin(b, 2)).toEqual({ ok: true });
    await Promise.all([screen, a, b].map(flush));

    expect(screenState.view).toMatchObject({
      role: 'screen',
      code: CODE,
      serverNow: T0,
      joinUrl: 'https://pinpoint.example/play/ABCD',
    });
    expect(screenState.view!.players.map((p) => p.name)).toEqual(['P1', 'P2']);

    expect(aState.view).toMatchObject({ role: 'player', me: { id: idOf(1), isVip: true } });
    expect(aState.view!.vip?.players).toHaveLength(2);
    expect(bState.view).toMatchObject({ role: 'player', me: { id: idOf(2) }, vip: null });

    for (const view of [screenState.view, aState.view, bState.view]) {
      const json = JSON.stringify(view);
      for (const n of [1, 2]) {
        expect(json).not.toContain(key(n));
        expect(json).not.toContain(playerIdentity(CODE, key(n)).keyHash);
      }
    }
  });

  it('rejects a bad payload with {ok: false} and adds nobody', async () => {
    const h = await start();
    const player = await h.connect();
    const bad = await (player.emitWithAck as (e: string, p: unknown) => Promise<Ack>)(
      'player:join',
      { code: CODE, playerKey: key(1), name: 'Ana', emoji: 'not-an-emoji' },
    );
    expect(bad.ok).toBe(false);
    expect(
      await (player.emitWithAck as (e: string, p: unknown) => Promise<Ack>)('player:join', 'ABCD'),
    ).toMatchObject({ ok: false });
    expect(h.rooms.get(CODE)!.players).toEqual({});
  });

  it('answers an unknown room with "This game has ended"', async () => {
    const h = await start();
    const player = await h.connect();
    expect(
      await player.emitWithAck('player:join', {
        code: 'WXYZ',
        playerKey: key(1),
        name: 'Ana',
        emoji: '🦊',
      }),
    ).toEqual({ ok: false, error: SOCKET_ERRORS.roomGone });
  });

  it('refuses player events from a socket that has not joined', async () => {
    const h = await start();
    const socket = await h.connect();
    expect(await socket.emitWithAck('player:rename', { name: 'Ana' })).toEqual({
      ok: false,
      error: ERRORS.notInGame,
    });
  });

  it('counts only new players against the join limit; a reconnect gets through', async () => {
    const h = await start({ playerJoinLimit: { max: 2, windowMs: 60_000 } });
    const first = await h.connect();
    expect(await playerJoin(first, 1)).toEqual({ ok: true });
    expect(await playerJoin(await h.connect(), 2)).toEqual({ ok: true });
    expect(await playerJoin(await h.connect(), 3)).toEqual({
      ok: false,
      error: SOCKET_ERRORS.joinLimited,
    });

    await serverDisconnect(h, first);
    expect(await playerJoin(await h.connect(), 1)).toEqual({ ok: true });
    expect(h.rooms.get(CODE)!.players[idOf(1)]!.connected).toBe(true);

    h.advance(60_000);
    expect(await playerJoin(await h.connect(), 3)).toEqual({ ok: true });
  });

  it('counts screen:join in the shared room-lookup limit', async () => {
    const h = await start({ lookupLimit: { max: 1, windowMs: 60_000 } });
    expect(await screenJoin(await h.connect())).toEqual({ ok: true });
    expect(await screenJoin(await h.connect())).toEqual({
      ok: false,
      error: SOCKET_ERRORS.lookupLimited,
    });
  });

  it('limits VIP actions to 10 per second per socket', async () => {
    const h = await start();
    const vip = await h.connect();
    await playerJoin(vip, 1);
    for (let i = 0; i < 10; i++) {
      expect(await vip.emitWithAck('vip:kick', { playerId: 'nobody' })).toEqual({
        ok: false,
        error: ERRORS.noSuchPlayer,
      });
    }
    expect(await vip.emitWithAck('vip:kick', { playerId: 'nobody' })).toEqual({
      ok: false,
      error: SOCKET_ERRORS.vipLimited,
    });
    h.advance(1000);
    expect(await vip.emitWithAck('vip:kick', { playerId: 'nobody' })).toMatchObject({
      error: ERRORS.noSuchPlayer,
    });
  });

  it('disconnects a socket that sends a message over 16 KB', async () => {
    const h = await start();
    const player = await h.connect();
    const closed = nextEvent<string>(player, 'disconnect');
    player.emit(
      'player:join',
      { code: CODE, playerKey: key(1), name: 'x'.repeat(SOCKET_MAX_BYTES), emoji: '🦊' },
      () => {},
    );
    expect(await closed).toBe('transport close');
    expect(h.rooms.get(CODE)!.players).toEqual({});
  });

  it('sends a kicked player `kicked`, disconnects them and drops them from the others', async () => {
    const h = await start();
    const [screen, vip, other] = [await h.connect(), await h.connect(), await h.connect()];
    const screenState = latest<ScreenView>(screen);
    await screenJoin(screen);
    await playerJoin(vip, 1);
    await playerJoin(other, 2);
    const kicked = nextEvent(other, 'kicked');
    const gone = nextEvent(other, 'disconnect');

    expect(await vip.emitWithAck('vip:kick', { playerId: idOf(2) })).toEqual({ ok: true });
    await kicked;
    await gone;
    await flush(screen);
    expect(screenState.view!.players.map((p) => p.id)).toEqual([idOf(1)]);
    expect(h.rooms.get(CODE)!.kickedIds).toEqual([idOf(2)]);
  });

  it('marks a dropped player disconnected and lets their device join again after leaving', async () => {
    const h = await start();
    const [screen, a] = [await h.connect(), await h.connect()];
    const screenState = latest<ScreenView>(screen);
    await screenJoin(screen);
    await playerJoin(a, 1);
    const b = await h.connect();
    await playerJoin(b, 2);

    await serverDisconnect(h, b);
    await flush(screen);
    expect(screenState.view!.players.find((p) => p.id === idOf(2))!.connected).toBe(false);

    expect(await a.emitWithAck('player:leave', {})).toEqual({ ok: true });
    expect(await playerJoin(a, 3)).toEqual({ ok: true });
    await flush(screen);
    expect(screenState.view!.players.map((p) => p.id)).toEqual([idOf(2), idOf(3)]);
  });

  it('runs schedule effects and dispatches the timer with its round, game and epoch', async () => {
    const h = await start();
    const [vip, heir] = [await h.connect(), await h.connect()];
    await playerJoin(vip, 1);
    await playerJoin(heir, 2);
    const vipNow = nextEvent<PlayerFx>(heir, 'fx');
    const heirState = latest<PlayerView>(heir);

    await serverDisconnect(h, vip);
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0]!.ms).toBe(VIP_AWAY_MS);
    expect(h.rooms.get(CODE)!.vipId).toBe(idOf(1));

    h.advance(VIP_AWAY_MS);
    h.timers[0]!.fn();
    expect(await vipNow).toEqual({ kind: 'vipNow' });
    await flush(heir);
    expect(h.rooms.get(CODE)!.vipId).toBe(idOf(2));
    expect(heirState.view!.me.isVip).toBe(true);
    expect(heirState.view!.vip?.controls).toEqual(['start', 'kick']);
  });

  it('sends `join` fx to Screens only', async () => {
    const h = await start();
    const [screen, a] = [await h.connect(), await h.connect()];
    await screenJoin(screen);
    const fx = nextEvent<ScreenFx>(screen, 'fx');
    const playerFx: unknown[] = [];
    a.on('fx', (f) => playerFx.push(f));
    await playerJoin(a, 1);
    expect(await fx).toEqual({ kind: 'join', playerId: idOf(1) });
    await flush(a);
    expect(playerFx).toEqual([]);
  });

  it('sends `room:closed` to every socket of a room when it expires', async () => {
    const h = await start();
    const [screen, a] = [await h.connect(), await h.connect()];
    await screenJoin(screen);
    await playerJoin(a, 1);
    const closed = [screen, a].map((c) => nextEvent<{ reason: string }>(c, 'room:closed'));

    h.advance(ROOM_IDLE_TTL_MS);
    stops.push(startRoomSweeper(h.rooms, h.clock, h.gateway.closeRooms, 1));
    expect(await Promise.all(closed)).toEqual([{ reason: 'expired' }, { reason: 'expired' }]);
    expect(h.rooms.has(CODE)).toBe(false);
  });
});
