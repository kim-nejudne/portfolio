import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TIMER_SECONDS, EMOJI, MAX_PLAYERS } from '#shared/constants.js';
import type { ClientToServerEvents } from '#shared/schemas.js';
import type { ServerToClientEvents } from '#shared/types.js';
import { loadCategoryStore } from './categoryStore.js';
import { botIdentities, randomPointIn, spawnBots, type Bots } from './devBots.js';
import { createApp } from './http.js';
import { mulberry32 } from './placePicker.js';
import { createRoom, RoomStore } from './roomStore.js';
import { attachSockets, type GatewayServer } from './sockets.js';

const CODE = 'ABCD';
/** A seeded `Math.random` stand-in. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    const r = mulberry32(state);
    state = r.state;
    return r.value;
  };
}
const T0 = 1_000_000;
type TestClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

/** A connected player for a hand-built room. */
const player = (name: string, emoji: string) => ({
  id: name,
  keyHash: name,
  name,
  emoji,
  color: '#fff',
  connected: true,
  connectedSince: T0,
  joinedAt: T0,
  waiting: false,
});

let servers: GatewayServer[] = [];
let clients: TestClient[] = [];
let bots: Bots[] = [];

afterEach(async () => {
  for (const b of bots) b.stop();
  for (const c of clients) c.disconnect();
  await Promise.all(servers.map((io) => new Promise((resolve) => io.close(resolve))));
  servers = [];
  clients = [];
  bots = [];
});

/** A dev server (devTools on) with room ABCD, a clock the test moves and hand-fired timers. */
async function start() {
  let now = T0;
  const clock = () => now;
  const rooms = new RoomStore();
  rooms.set(createRoom(CODE, T0, 7));
  const timers: { fn: () => void; ms: number }[] = [];
  const categories = await loadCategoryStore({ dataDir: '/nonexistent', production: false });
  const httpServer = createServer(
    createApp({ rooms, clock, categories, log: () => {}, devTools: true }),
  );
  const gateway = attachSockets(httpServer, {
    rooms,
    publicUrl: 'https://pinpoint.example',
    categories,
    clock,
    setTimer: (fn, ms) => timers.push({ fn, ms }),
  });
  servers.push(gateway.io);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;

  async function connect(): Promise<TestClient> {
    const client: TestClient = connectClient(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    clients.push(client);
    await new Promise<void>((resolve) => client.once('connect', resolve));
    return client;
  }

  /** A Screen and a human VIP in the lobby, ready to start on the dev fixture. */
  async function lobby(): Promise<TestClient> {
    await (await connect()).emitWithAck('screen:join', { code: CODE });
    const vip = await connect();
    const key = 'human-key-00000000000';
    await vip.emitWithAck('player:join', { code: CODE, playerKey: key, name: 'Kim', emoji: '🦊' });
    await vip.emitWithAck('vip:settings', { categoryId: 'world-dev' });
    return vip;
  }

  /** Fires the newest timer, after moving the clock past it, until round `n` is in GUESSING. */
  function untilGuessing(n: number) {
    const room = () => rooms.get(CODE)!;
    while (!(room().phase === 'GUESSING' && room().game?.current?.number === n)) {
      const t = timers.at(-1)!;
      now += t.ms;
      t.fn();
    }
  }

  /** Start, then fire the INTRO timer: round 1 is in GUESSING. */
  async function guessing(vip: TestClient) {
    expect(await vip.emitWithAck('vip:start', {})).toEqual({ ok: true });
    untilGuessing(1);
  }

  return { url, rooms, connect, lobby, guessing, untilGuessing };
}

describe('GET /dev/bots/:code', () => {
  it('joins N bots to the room, named Bot 1…N with free emoji', async () => {
    const h = await start();
    await h.lobby();
    const res = await fetch(`${h.url}/dev/bots/${CODE}?count=3`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code: CODE, bots: ['Bot 1', 'Bot 2', 'Bot 3'] });

    const players = Object.values(h.rooms.get(CODE)!.players);
    expect(players.map((p) => [p.name, p.connected])).toEqual([
      ['Kim', true],
      ['Bot 1', true],
      ['Bot 2', true],
      ['Bot 3', true],
    ]);
    expect(new Set(players.map((p) => p.emoji)).size).toBe(4);
  });

  it('is 409 when no bot can join a full room', async () => {
    const h = await start();
    const players = Object.fromEntries(
      Array.from({ length: MAX_PLAYERS }, (_, i) => [`p${i}`, player(`P${i}`, EMOJI[i]!)]),
    );
    h.rooms.set({ ...h.rooms.get(CODE)!, players });
    const res = await fetch(`${h.url}/dev/bots/${CODE}`);
    expect(res.status).toBe(409);
  });

  it('is 404 for an unknown room', async () => {
    const h = await start();
    expect((await fetch(`${h.url}/dev/bots/ZZZZ`)).status).toBe(404);
  });
});

describe('spawnBots', () => {
  it('aims inside the region and locks in before the timer, round after round', async () => {
    const h = await start();
    const vip = await h.lobby();
    const botTimers: { fn: () => void; ms: number }[] = [];
    const spawned = await spawnBots({
      url: h.url,
      code: CODE,
      identities: botIdentities(h.rooms.get(CODE)!, 3),
      random: seeded(42),
      setTimer: (fn, ms) => botTimers.push({ fn, ms }),
    });
    bots.push(spawned);
    expect(spawned.names).toEqual(['Bot 1', 'Bot 2', 'Bot 3']);
    const room = () => h.rooms.get(CODE)!;
    const botIds = Object.values(room().players)
      .filter((p) => p.name.startsWith('Bot'))
      .map((p) => p.id);

    await h.guessing(vip);
    await vi.waitFor(() => expect(botTimers).toHaveLength(3));
    for (const t of botTimers) {
      expect(t.ms).toBeGreaterThanOrEqual(0);
      expect(t.ms).toBeLessThan(DEFAULT_TIMER_SECONDS * 1000);
    }
    // They aim as soon as the round opens; nothing is locked until their moment comes.
    await vi.waitFor(() =>
      expect(Object.keys(room().game!.current!.aims).sort()).toEqual(botIds.sort()),
    );
    expect(room().game!.current!.locks).toEqual({});

    for (const t of botTimers) t.fn();
    await vi.waitFor(() =>
      expect(Object.keys(room().game!.current!.locks).sort()).toEqual(botIds.sort()),
    );
    const { box } = room().game!;
    for (const id of botIds) {
      const lock = room().game!.current!.locks[id]!;
      expect({ lat: lock.lat, lng: lock.lng }).toEqual(room().game!.current!.aims[id]);
      expect(lock.lat).toBeGreaterThanOrEqual(box.south);
      expect(lock.lat).toBeLessThanOrEqual(box.north);
      expect(lock.lng).toBeGreaterThanOrEqual(box.west);
      expect(lock.lng).toBeLessThanOrEqual(box.east);
    }

    // Round 2: the human locks in too, the round plays out, and the bots plan again.
    expect(await vip.emitWithAck('player:lockIn', { lat: 0, lng: 0 })).toEqual({ ok: true });
    h.untilGuessing(2);
    await vi.waitFor(() => expect(botTimers).toHaveLength(6));
    for (const t of botTimers.slice(3)) t.fn();
    await vi.waitFor(() =>
      expect(Object.keys(room().game!.current!.locks).sort()).toEqual(botIds.sort()),
    );
  });
});

describe('botIdentities', () => {
  const room = createRoom(CODE, T0, 1);

  it('skips names and emoji already taken', () => {
    const r = { ...room, players: { a: player('bot 1', EMOJI[0]), b: player('Ana', EMOJI[1]) } };
    expect(botIdentities(r, 2)).toEqual([
      { name: 'Bot 2', emoji: EMOJI[2] },
      { name: 'Bot 3', emoji: EMOJI[3] },
    ]);
  });

  it('stops at the player cap', () => {
    const players = Object.fromEntries(
      Array.from({ length: MAX_PLAYERS - 2 }, (_, i) => [`p${i}`, player(`P${i}`, EMOJI[i]!)]),
    );
    expect(botIdentities({ ...room, players }, 5)).toHaveLength(2);
  });
});

describe('randomPointIn', () => {
  it('stays in the box and wraps a box across the antimeridian', () => {
    const box = { south: -50, west: 160, north: -30, east: 190 };
    const random = seeded(3);
    for (let i = 0; i < 200; i++) {
      const p = randomPointIn(box, random);
      expect(p.lat).toBeGreaterThanOrEqual(-50);
      expect(p.lat).toBeLessThanOrEqual(-30);
      expect(p.lng >= 160 || p.lng <= -170).toBe(true);
      expect(p.lng).toBeGreaterThanOrEqual(-180);
      expect(p.lng).toBeLessThanOrEqual(180);
    }
  });
});
