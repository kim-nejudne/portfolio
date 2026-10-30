// The limiter: ported from Buzzr (buzzer/server/rateLimit.test.ts). The spec's limits: F44.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  GUESS_INTERVAL_MS,
  HOST_ACTION_RATE_LIMIT,
  INK_BATCH_MAX_BYTES,
  INK_BATCH_RATE_LIMIT,
  INK_INVALID_BATCHES_MAX,
  INK_POINTS_PER_OP_MAX,
  JOIN_RATE_LIMIT,
  MAX_PLAYERS,
  REACTION_INTERVAL_MS,
  SOCKET_MAX_BUFFER_BYTES,
} from '../shared/constants.js';
import type { Ack, InkBatch, InkOp } from '../shared/types.js';
import { generateHostToken, hashHostToken } from './hostToken.js';
import { attachInkGateway } from './inkGateway.js';
import { createRateLimiter } from './rateLimit.js';
import { createRoom } from './room.js';
import { InMemoryRoomStore } from './roomStore.js';
import { attachSockets } from './sockets.js';
import { TEST_PACKS } from './test/packs.js';

function setup(max = 3, windowMs = 1000) {
  let now = 0;
  const limiter = createRateLimiter({ max, windowMs }, () => now);
  return {
    limiter,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('createRateLimiter', () => {
  it('allows max hits per key, then refuses', () => {
    const { limiter } = setup(3);
    expect([1, 2, 3, 4].map(() => limiter.hit('a'))).toEqual([true, true, true, false]);
  });

  it('counts keys separately', () => {
    const { limiter } = setup(1);
    expect(limiter.hit('a')).toBe(true);
    expect(limiter.hit('b')).toBe(true);
    expect(limiter.hit('a')).toBe(false);
  });

  it('frees a slot exactly one window after the oldest hit', () => {
    const { limiter, advance } = setup(2, 1000);
    limiter.hit('a');
    advance(400);
    limiter.hit('a');
    advance(599);
    expect(limiter.hit('a')).toBe(false);
    advance(1);
    expect(limiter.hit('a')).toBe(true);
    expect(limiter.hit('a')).toBe(false);
  });

  it('does not count refused hits against the key', () => {
    const { limiter, advance } = setup(1, 1000);
    limiter.hit('a');
    advance(500);
    expect(limiter.hit('a')).toBe(false);
    advance(500);
    expect(limiter.hit('a')).toBe(true);
  });

  it('starts a key fresh after its hits expire and idle keys are cleaned up', () => {
    const { limiter, advance } = setup(1, 1000);
    limiter.hit('a');
    limiter.hit('b');
    advance(5000);
    expect(limiter.hit('c')).toBe(true);
    expect(limiter.hit('a')).toBe(true);
    expect(limiter.hit('a')).toBe(false);
  });
});

// ---------- F44: every limit in Security and Limits, over real sockets ----------

const CODE = 'ABCD';
const KEY_ANA = 'a'.repeat(21);
const KEY_BEN = 'b'.repeat(21);
const KEY_CY = 'c'.repeat(21);
/** A distinct playerKey for the i-th test phone. */
const keyOf = (i: number) => `k${String(i).padStart(20, '0')}`;

interface Client {
  socket: ClientSocket;
  emit<T extends object = object>(event: string, payload?: unknown): Promise<Ack<T>>;
}

let server: Server | undefined;
let sockets: ClientSocket[] = [];

afterEach(async () => {
  for (const s of sockets) s.disconnect();
  sockets = [];
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
});

async function gateway({ trustProxy }: { trustProxy?: number } = {}) {
  const rooms = new InMemoryRoomStore();
  const hostToken = generateHostToken();
  for (const code of [CODE, 'WXYZ']) {
    rooms.set(
      createRoom({
        code,
        hostTokenHash: hashHostToken(hostToken),
        now: 0,
        seed: 7,
        packs: TEST_PACKS,
      }),
    );
  }
  const mono = { now: 10_000 };
  server = createServer();
  let onInk: ReturnType<typeof attachInkGateway>['onInk'] = () => {};
  const { io, dispatch } = attachSockets(server, {
    rooms,
    clock: () => 1_800_000_000_000,
    monotonic: () => mono.now,
    scheduler: () => () => {},
    onInk: (code, effect) => onInk(code, effect),
    ...(trustProxy === undefined ? {} : { trustProxy }),
  });
  onInk = attachInkGateway(io, { rooms, dispatch, monotonic: () => mono.now }).onInk;
  server.listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  async function connect(
    path: '' | '/ink' = '',
    { auth, forwardedFor }: { auth?: object; forwardedFor?: string } = {},
  ): Promise<Client> {
    const socket = connectClient(`http://127.0.0.1:${port}${path}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      ...(auth ? { auth } : {}),
      ...(forwardedFor ? { extraHeaders: { 'x-forwarded-for': forwardedFor } } : {}),
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    return {
      socket,
      emit: <T extends object>(event: string, payload: unknown = {}) =>
        socket.timeout(2000).emitWithAck(event, payload) as Promise<Ack<T>>,
    };
  }

  /** A new phone socket joining as `name`; resolves with its socket and the ack. */
  async function join(
    playerKey: string,
    name: string,
    opts: { forwardedFor?: string; code?: string } = {},
  ) {
    const main = await connect('', opts);
    const ack = await main.emit<{ pid: string }>('player:join', {
      code: opts.code ?? CODE,
      playerKey,
      name,
    });
    return { main, ack };
  }

  return { rooms, hostToken, mono, connect, join };
}

type Gateway = Awaited<ReturnType<typeof gateway>>;

/** A token Screen, Ana (crown, first drawer), Ben and Cy, with Ana drawing the first word. */
async function drawing(g: Gateway) {
  const screen = await g.connect();
  expect(await screen.emit('screen:join', { code: CODE, hostToken: g.hostToken })).toEqual({
    ok: true,
  });
  const ana = await g.join(KEY_ANA, 'Ana');
  const ben = await g.join(KEY_BEN, 'Ben');
  const cy = await g.join(KEY_CY, 'Cy');
  expect(await screen.emit('host:start')).toEqual({ ok: true });
  const turn = g.rooms.get(CODE)!.turn!;
  expect(turn.drawerPid).toBe(ana.ack.ok && ana.ack.pid);
  expect(await ana.main.emit('drawer:choose', { index: 0 })).toEqual({ ok: true });
  const word = g.rooms.get(CODE)!.turn!.word!.word;
  const ink = await g.connect('/ink', { auth: { code: CODE, playerKey: KEY_ANA } });
  return { screen, ana, ben, cy, word, ink, turnId: turn.id };
}

const rateLimited = { ok: false, error: 'rateLimited' };

describe('guesses: one per 700 ms per player', () => {
  it('answers "slowDown" inside the window, unread, and takes the next guess after it', async () => {
    const g = await gateway();
    const d = await drawing(g);
    expect(await d.ben.main.emit('player:guess', { text: 'payong' })).toEqual({ ok: true });
    g.mono.now += GUESS_INTERVAL_MS - 1;
    // The right word, too fast: refused before matching, so Ben has not got it.
    expect(await d.ben.main.emit('player:guess', { text: d.word })).toEqual({
      ok: false,
      error: 'slowDown',
    });
    expect(g.rooms.get(CODE)!.turn!.correct).toEqual([]);
    // Cy has his own window.
    expect(await d.cy.main.emit('player:guess', { text: 'bahay' })).toEqual({ ok: true });
    g.mono.now += 1;
    expect(await d.ben.main.emit('player:guess', { text: d.word })).toEqual({ ok: true });
    expect(g.rooms.get(CODE)!.turn!.correct.map((c) => c.pid)).toEqual([
      d.ben.ack.ok && d.ben.ack.pid,
    ]);
  });
});

describe('reactions: one per second per player', () => {
  it('refuses a second reaction within the second, and takes one after it', async () => {
    const g = await gateway();
    const d = await drawing(g);
    expect(await d.ben.main.emit('player:guess', { text: d.word })).toEqual({ ok: true });
    expect(await d.ben.main.emit('player:react', { emoji: '😂' })).toEqual({ ok: true });
    g.mono.now += REACTION_INTERVAL_MS - 1;
    expect(await d.ben.main.emit('player:react', { emoji: '🔥' })).toEqual(rateLimited);
    g.mono.now += 1;
    expect(await d.ben.main.emit('player:react', { emoji: '🔥' })).toEqual({ ok: true });
  });
});

describe(`player:join: ${JOIN_RATE_LIMIT.max} per address per minute`, () => {
  it('refuses the next new join from the same address with "rateLimited", nothing joined', async () => {
    const g = await gateway();
    // Across rooms: the limit is the address's, not the room's.
    for (let i = 0; i < JOIN_RATE_LIMIT.max; i++) {
      const { ack } = await g.join(keyOf(i), `P${i}`, { code: i % 2 ? 'WXYZ' : CODE });
      expect(ack.ok).toBe(true);
    }
    const { ack } = await g.join(keyOf(99), 'Late');
    expect(ack).toEqual(rateLimited);
    expect(Object.values(g.rooms.get(CODE)!.players).map((p) => p.name)).not.toContain('Late');
    // A minute after the first join, a slot is free again.
    g.mono.now += JOIN_RATE_LIMIT.windowMs;
    expect((await g.join(keyOf(99), 'Late')).ack.ok).toBe(true);
  });

  it('counts refused new joins (a taken name, a missing room) too', async () => {
    const g = await gateway();
    expect((await g.join(keyOf(0), 'Ana')).ack.ok).toBe(true);
    for (let i = 1; i < JOIN_RATE_LIMIT.max; i++) {
      const { ack } = await g.join(keyOf(i), 'Ana', { code: i % 2 ? CODE : 'QQQQ' });
      expect(ack).toEqual({ ok: false, error: i % 2 ? 'nameTaken' : 'roomNotFound' });
    }
    expect((await g.join(keyOf(50), 'Ben')).ack).toEqual(rateLimited);
  });

  it('never counts a rejoin by a key the room knows, so a barkada can reload together', async () => {
    const g = await gateway();
    const phones = [];
    for (let i = 0; i < JOIN_RATE_LIMIT.max; i++) phones.push(await g.join(keyOf(i), `P${i}`));
    // Every phone reloads twice: a new socket joining with the same key and name.
    for (let round = 0; round < 2; round++) {
      for (const [i, phone] of phones.entries()) {
        phone.main.socket.disconnect();
        const again = await g.join(keyOf(i), `P${i}`);
        expect(again.ack).toEqual(phone.ack);
        phones[i] = again;
      }
    }
    // A new phone (in another room: this one is full) is still over the limit.
    expect((await g.join(keyOf(99), 'New', { code: 'WXYZ' })).ack).toEqual(rateLimited);
  });

  it('lets a full room answer "roomFull", uncounted, so the 11th friend reads why', async () => {
    const g = await gateway();
    expect(MAX_PLAYERS).toBe(JOIN_RATE_LIMIT.max);
    for (let i = 0; i < MAX_PLAYERS; i++)
      expect((await g.join(keyOf(i), `P${i}`)).ack.ok).toBe(true);
    for (let i = 0; i < 3; i++)
      expect((await g.join(keyOf(50 + i), 'Eleven')).ack).toEqual({ ok: false, error: 'roomFull' });
    // Another room on the same Wi-Fi is still over the address's limit.
    expect((await g.join(keyOf(60), 'Elsewhere', { code: 'WXYZ' })).ack).toEqual(rateLimited);
    // A takeover of a disconnected player can get into the full room, so it counts.
    const room = g.rooms.get(CODE)!;
    const p3 = Object.values(room.players).find((p) => p.name === 'P3')!;
    g.rooms.set({ ...room, players: { ...room.players, [p3.pid]: { ...p3, connected: false } } });
    const takeOver = async () => {
      const main = await g.connect();
      return main.emit('player:join', {
        code: CODE,
        playerKey: keyOf(70),
        name: 'P3',
        takeOver: true,
      });
    };
    expect(await takeOver()).toEqual(rateLimited);
    g.mono.now += JOIN_RATE_LIMIT.windowMs;
    expect(await takeOver()).toEqual({ ok: true, pid: p3.pid });
  });

  it('keys on the client address behind a trusted proxy', async () => {
    const proxied = await gateway({ trustProxy: 1 });
    for (let i = 0; i < JOIN_RATE_LIMIT.max; i++) {
      const { ack } = await proxied.join(keyOf(i), `P${i}`, { forwardedFor: '203.0.113.7' });
      expect(ack.ok).toBe(true);
    }
    expect(
      (await proxied.join(keyOf(98), 'X', { code: 'WXYZ', forwardedFor: '203.0.113.7' })).ack,
    ).toEqual(rateLimited);
    // Another household behind the same proxy has its own limit.
    const other = await proxied.join(keyOf(99), 'Y', {
      code: 'WXYZ',
      forwardedFor: '198.51.100.2',
    });
    expect(other.ack.ok).toBe(true);
  });

  it('ignores X-Forwarded-For without a trusted proxy, so a spoofed header buys nothing', async () => {
    const direct = await gateway();
    for (let i = 0; i < JOIN_RATE_LIMIT.max; i++) {
      const forwardedFor = `198.51.100.${i}`;
      expect((await direct.join(keyOf(i), `P${i}`, { forwardedFor })).ack.ok).toBe(true);
    }
    expect(
      (await direct.join(keyOf(99), 'Z', { code: 'WXYZ', forwardedFor: '192.0.2.1' })).ack,
    ).toEqual(rateLimited);
  });
});

describe(`host actions: ${HOST_ACTION_RATE_LIMIT.max} per second per socket`, () => {
  it('refuses the next one from the same socket, and leaves other sockets their own', async () => {
    const g = await gateway();
    const screen = await g.connect();
    await screen.emit('screen:join', { code: CODE, hostToken: g.hostToken });
    const tv = await g.connect();
    await tv.emit('screen:join', { code: CODE, hostToken: g.hostToken });
    for (let i = 0; i < HOST_ACTION_RATE_LIMIT.max; i++) {
      const drawSeconds = i % 2 ? 60 : 80;
      expect(await screen.emit('host:settings', { drawSeconds })).toEqual({ ok: true });
    }
    expect(await screen.emit('host:settings', { drawSeconds: 100 })).toEqual(rateLimited);
    expect(g.rooms.get(CODE)!.settings.drawSeconds).toBe(60);
    // A second token Screen is another socket.
    expect(await tv.emit('host:settings', { drawSeconds: 100 })).toEqual({ ok: true });
    // Refused tries count too: hammering keeps the socket out.
    g.mono.now += HOST_ACTION_RATE_LIMIT.windowMs - 1;
    expect(await screen.emit('host:start')).toEqual(rateLimited);
    g.mono.now += 1;
    expect(await screen.emit('host:settings', { drawSeconds: 80 })).toEqual({ ok: true });
  });

  it('counts tries by a socket that may not host', async () => {
    const g = await gateway();
    await g.join(KEY_ANA, 'Ana');
    const ben = await g.join(KEY_BEN, 'Ben');
    for (let i = 0; i < HOST_ACTION_RATE_LIMIT.max; i++)
      expect(await ben.main.emit('host:start')).toEqual({ ok: false, error: 'notHost' });
    expect(await ben.main.emit('host:start')).toEqual(rateLimited);
  });
});

describe('ink: Limits', () => {
  const stroke = (turnId: number, seq: number): InkBatch => [
    turnId,
    seq,
    [
      ['b', seq, 0, 1, 412, 300],
      ['p', seq, 4, -1],
      ['e', seq],
    ],
  ];

  it(`takes ${INK_BATCH_RATE_LIMIT.max} batches a second from the drawer, then "rateLimited"`, async () => {
    const g = await gateway();
    const d = await drawing(g);
    for (let seq = 1; seq <= INK_BATCH_RATE_LIMIT.max; seq++)
      expect(await d.ink.emit('ink:batch', stroke(d.turnId, seq))).toEqual({ ok: true });
    const next = stroke(d.turnId, INK_BATCH_RATE_LIMIT.max + 1);
    expect(await d.ink.emit('ink:batch', next)).toEqual(rateLimited);
    g.mono.now += INK_BATCH_RATE_LIMIT.windowMs;
    expect(await d.ink.emit('ink:batch', next)).toEqual({ ok: true });
  });

  it(`refuses a "p" op over ${INK_POINTS_PER_OP_MAX} points and a batch over ${INK_BATCH_MAX_BYTES} bytes`, async () => {
    const g = await gateway();
    const d = await drawing(g);
    const points = (n: number) => Array.from({ length: n * 2 }, () => 1);
    const op = (n: number): InkBatch => [
      d.turnId,
      1,
      [['b', 1, 0, 1, 10, 10], ['p', 1, ...points(n)] as InkOp],
    ];
    expect(await d.ink.emit('ink:batch', op(INK_POINTS_PER_OP_MAX + 1))).toEqual({
      ok: false,
      error: 'invalidPayload',
    });
    // Many legal ops that add up to more than 4 KB.
    const big: InkBatch = [
      d.turnId,
      1,
      [
        ['b', 1, 0, 1, 10, 10],
        ...Array.from({ length: 12 }, () => ['p', 1, ...points(INK_POINTS_PER_OP_MAX)] as InkOp),
      ],
    ];
    expect(JSON.stringify(big).length).toBeGreaterThan(INK_BATCH_MAX_BYTES);
    expect(await d.ink.emit('ink:batch', big)).toEqual({ ok: false, error: 'invalidPayload' });
    expect(await d.ink.emit('ink:batch', op(INK_POINTS_PER_OP_MAX))).toEqual({ ok: true });
  });

  it(`disconnects the drawer's /ink socket on the ${INK_INVALID_BATCHES_MAX}th invalid batch of a turn`, async () => {
    const g = await gateway();
    const d = await drawing(g);
    const bad = [d.turnId, 1, [['b', 1, 0, 1, 5000, 300]]];
    for (let i = 1; i < INK_INVALID_BATCHES_MAX; i++) await d.ink.emit('ink:batch', bad);
    expect(d.ink.socket.connected).toBe(true);
    const gone = new Promise((resolve) => d.ink.socket.once('disconnect', resolve));
    d.ink.socket.emit('ink:batch', bad);
    await gone;
    // The game socket stays: the drawer is not kicked.
    expect(d.ana.main.socket.connected).toBe(true);
  });

  it(`closes a connection that sends a message over ${SOCKET_MAX_BUFFER_BYTES / 1024} KB`, async () => {
    const g = await gateway();
    const phone = await g.connect();
    const gone = new Promise((resolve) => phone.socket.once('disconnect', resolve));
    phone.socket.emit('player:guess', { text: 'x'.repeat(SOCKET_MAX_BUFFER_BYTES + 1) });
    await gone;
    expect(phone.socket.connected).toBe(false);
  });
});
