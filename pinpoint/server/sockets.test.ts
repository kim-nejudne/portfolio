import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RESUME_COUNTDOWN_MS,
  ROOM_IDLE_TTL_MS,
  SCREEN_AWAY_MS,
  SOCKET_MAX_BYTES,
  VIP_AWAY_MS,
} from '#shared/constants.js';
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
import { loadCategoryStore } from './categoryStore.js';
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
    // No categories.json there, so the store serves the dev fixture ("World (dev)").
    categories: await loadCategoryStore({ dataDir: '/nonexistent', production: false }),
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

  it('validates vip:settings against the live categories and broadcasts the stored settings', async () => {
    const h = await start();
    const [screen, vip] = [await h.connect(), await h.connect()];
    const screenState = latest<ScreenView>(screen);
    await screenJoin(screen);
    await playerJoin(vip, 1);
    expect(await vip.emitWithAck('vip:settings', { categoryId: 'atlantis' })).toEqual({
      ok: false,
      error: ERRORS.noSuchCategory,
    });
    expect(await vip.emitWithAck('vip:settings', { categoryId: 'world-dev', rounds: 5 })).toEqual({
      ok: true,
    });
    await flush(screen);
    expect(screenState.view).toMatchObject({
      settings: { categoryId: 'world-dev', rounds: 5 },
      categoryName: 'World (dev)',
      hasCategories: true,
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

  it('allows one practice per 2 s per player and sends its fx to the right sockets', async () => {
    const h = await start();
    const [screen, a, b] = [await h.connect(), await h.connect(), await h.connect()];
    await screenJoin(screen);
    await playerJoin(a, 1);
    await playerJoin(b, 2);
    const screenFx = nextEvent<ScreenFx>(screen, 'fx');
    const playerFx = nextEvent<PlayerFx>(a, 'fx');
    const otherFx: unknown[] = [];
    b.on('fx', (f) => otherFx.push(f));

    expect(await a.emitWithAck('player:practice', { lat: 0, lng: 0 })).toEqual({ ok: true });
    expect(await screenFx).toEqual({ kind: 'practice', playerId: idOf(1) });
    expect(await playerFx).toEqual({ kind: 'practiceResult', distanceKm: 0 });
    expect(await a.emitWithAck('player:practice', { lat: 0, lng: 0 })).toEqual({
      ok: false,
      error: SOCKET_ERRORS.practiceLimited,
    });
    // The limit is per player: another player is not held up.
    expect(await b.emitWithAck('player:practice', { lat: 0, lng: 0 })).toEqual({ ok: true });
    h.advance(2000);
    expect(await a.emitWithAck('player:practice', { lat: 0, lng: 0 })).toEqual({ ok: true });
    await flush(b);
    expect(otherFx).toEqual([{ kind: 'practiceResult', distanceKm: 0 }]);
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

describe('socket gateway: guessing', () => {
  /** A Screen and players 1…n in GUESSING on the dev fixture; returns the clients. */
  async function guessing(h: Harness, n: number) {
    const screen = await h.connect();
    await screenJoin(screen);
    const players: TestClient[] = [];
    for (let i = 1; i <= n; i++) {
      const c = await h.connect();
      await playerJoin(c, i);
      players.push(c);
    }
    const vip = players[0]!;
    expect(await vip.emitWithAck('vip:settings', { categoryId: 'world-dev' })).toEqual({
      ok: true,
    });
    expect(await vip.emitWithAck('vip:start', {})).toEqual({ ok: true });
    expect(h.rooms.get(CODE)!.phase).toBe('INTRO');
    h.advance(h.timers.at(-1)!.ms);
    h.timers.at(-1)!.fn(); // introDone
    expect(h.rooms.get(CODE)!.phase).toBe('GUESSING');
    // Let the GUESSING broadcast arrive before a test watches for events.
    for (const c of [screen, ...players]) await flush(c);
    return { screen, players };
  }

  it('starts with the live category the room picked, and refuses Start without a Screen', async () => {
    const h = await start();
    const vip = await h.connect();
    await playerJoin(vip, 1);
    await vip.emitWithAck('vip:settings', { categoryId: 'world-dev' });
    expect(await vip.emitWithAck('vip:start', {})).toEqual({ ok: false, error: ERRORS.noScreen });
    const screen = await h.connect();
    await screenJoin(screen);
    expect(await vip.emitWithAck('vip:start', {})).toEqual({ ok: true });
    expect(h.rooms.get(CODE)!.game!.categoryName).toBe('World (dev)');
  });

  it('stores an aim without any broadcast and drops aims past 8 per second silently', async () => {
    const h = await start();
    const { screen, players } = await guessing(h, 1);
    const a = players[0]!;
    const seen: string[] = [];
    for (const c of [screen, a]) {
      c.onAny((event: string) => seen.push(event));
    }
    for (let i = 0; i < 10; i++) {
      expect(await a.emitWithAck('player:aim', { lat: i, lng: i })).toEqual({ ok: true });
    }
    await flush(a);
    await flush(screen);
    // flush itself is a refused rename: no state either.
    expect(seen).toEqual([]);
    // The 9th and 10th were dropped: the 8th is the stored aim.
    expect(h.rooms.get(CODE)!.game!.current!.aims).toEqual({ [idOf(1)]: { lat: 7, lng: 7 } });
    h.advance(1000);
    await a.emitWithAck('player:aim', { lat: 50, lng: 50 });
    expect(h.rooms.get(CODE)!.game!.current!.aims[idOf(1)]).toEqual({ lat: 50, lng: 50 });
  });

  it('limits player:lockIn to 2 per second per socket and sends lockedIn to Screens only', async () => {
    const h = await start();
    const { screen, players } = await guessing(h, 2);
    const [a, b] = players as [TestClient, TestClient];
    const screenFx = nextEvent<ScreenFx>(screen, 'fx');
    const playerFx: unknown[] = [];
    a.on('fx', (fx) => playerFx.push(fx));
    b.on('fx', (fx) => playerFx.push(fx));
    expect(await a.emitWithAck('player:lockIn', { lat: 1, lng: 2 })).toEqual({ ok: true });
    expect(await screenFx).toEqual({ kind: 'lockedIn', playerId: idOf(1) });
    expect(await a.emitWithAck('player:lockIn', { lat: 1, lng: 2 })).toEqual({
      ok: false,
      error: ERRORS.alreadyLocked,
    });
    expect(await a.emitWithAck('player:lockIn', { lat: 1, lng: 2 })).toEqual({
      ok: false,
      error: SOCKET_ERRORS.lockInLimited,
    });
    await flush(b);
    expect(playerFx).toEqual([]);
  });
  it('lets no aim or lock position reach another device: they get lockedIn and position-free state only', async () => {
    const h = await start();
    const { screen, players } = await guessing(h, 3);
    const [a, b, c] = players as [TestClient, TestClient, TestClient];
    const aimAt = { lat: 23.4567, lng: 45.6789 };
    const lockAt = { lat: -21.9876, lng: 33.1234 };
    const seen = new Map<TestClient, [string, unknown][]>([
      [screen, []],
      [b, []],
      [c, []],
    ]);
    for (const [client, events] of seen)
      client.onAny((event: string, payload) => events.push([event, payload]));
    const own = latest<PlayerView>(a);

    expect(await a.emitWithAck('player:aim', aimAt)).toEqual({ ok: true });
    expect(await a.emitWithAck('player:lockIn', lockAt)).toEqual({ ok: true });
    for (const client of seen.keys()) await flush(client);

    const forms = [aimAt.lat, aimAt.lng, lockAt.lat, lockAt.lng].flatMap((n) =>
      [1, 2, 3, 4].map((d) => n.toFixed(d)),
    );
    for (const [client, events] of seen) {
      const json = JSON.stringify(events);
      for (const text of forms) expect(json).not.toContain(text);
      const fx = events.filter(([event]) => event === 'fx').map(([, payload]) => payload);
      expect(fx).toEqual(client === screen ? [{ kind: 'lockedIn', playerId: idOf(1) }] : []);
      // Anything else is the role-filtered state broadcast of the lock-in.
      expect(events.every(([event]) => event === 'fx' || event === 'state')).toBe(true);
    }
    const screenState = seen.get(screen)!.findLast(([e]) => e === 'state')![1] as ScreenView;
    expect(screenState.round?.lockedIn).toEqual([idOf(1)]);
    // The locker's own view carries their lock, for the frozen mini map.
    expect(own.view?.round?.myLock).toEqual(lockAt);
  });

  it('pauses and resumes on the VIP, broadcasting Delayed and the 3-2-1, and pauses when the Screen is gone', async () => {
    const h = await start();
    const { screen, players } = await guessing(h, 2);
    const [vip, b] = players as [TestClient, TestClient];
    const tv = latest<ScreenView>(screen);
    const phone = latest<PlayerView>(b);
    expect(await b.emitWithAck('vip:pause', {})).toEqual({ ok: false, error: ERRORS.notVip });
    expect(await vip.emitWithAck('vip:pause', {})).toEqual({ ok: true });
    await flush(screen);
    await flush(b);
    expect(tv.view?.round?.gate).toBe('delayed');
    const since = h.rooms.get(CODE)!.paused!.since;
    expect(phone.view?.paused).toEqual({ reasons: ['vip'], since, resumeAt: null });
    expect(await b.emitWithAck('player:lockIn', { lat: 1, lng: 2 })).toEqual({
      ok: false,
      error: ERRORS.paused,
    });

    expect(await vip.emitWithAck('vip:resume', {})).toEqual({ ok: true });
    await flush(b);
    expect(phone.view?.paused?.resumeAt).toBe(since + RESUME_COUNTDOWN_MS);
    h.advance(RESUME_COUNTDOWN_MS);
    h.timers.at(-1)!.fn(); // resumeGo
    await flush(b);
    expect(phone.view?.paused).toBeNull();

    await serverDisconnect(h, screen);
    h.advance(SCREEN_AWAY_MS);
    h.timers.at(-1)!.fn(); // screenGone
    await flush(b);
    expect(phone.view?.paused?.reasons).toEqual(['screenAway']);
  });

  it('skips a round and ends the game on the VIP, refusing Next while guessing', async () => {
    const h = await start();
    const { players } = await guessing(h, 2);
    const [vip, b] = players as [TestClient, TestClient];
    const phone = latest<PlayerView>(b);
    expect(await vip.emitWithAck('vip:next', {})).toEqual({ ok: false, error: ERRORS.notNow });
    expect(await b.emitWithAck('vip:skipRound', {})).toEqual({ ok: false, error: ERRORS.notVip });
    expect(await vip.emitWithAck('vip:skipRound', {})).toEqual({ ok: true });
    await flush(b);
    expect(phone.view?.phase).toBe('INTRO');
    expect(phone.view?.round?.number).toBe(1);
    expect(await vip.emitWithAck('vip:end', {})).toEqual({ ok: true });
    await flush(b);
    expect(phone.view?.phase).toBe('FINAL');
    expect(phone.view?.round).toBeNull();
  });
});
