import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUZZ_RATE_LIMIT,
  BUZZ_RATE_LIMITED_ERROR,
  COLLECTION_WINDOW_MS,
  NOT_HOST_ERROR,
  PING_RATE_LIMIT,
  PING_RATE_LIMITED_ERROR,
  PONG_ACK_TIMEOUT_MS,
} from '../shared/constants.js';
import type {
  Ack,
  ClientToServerEvents,
  Fx,
  HostView,
  ServerToClientEvents,
  View,
} from '../shared/types.js';
import { generateHostToken, hashHostToken } from './hostToken.js';
import { InMemoryRoomStore } from './roomStore.js';
import { attachSockets, type GatewayServer } from './sockets.js';
import { makeRoom, T0 } from './test/rooms.js';

type TestClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

const TOKEN = generateHostToken();

let io: GatewayServer | undefined;
let clients: TestClient[] = [];

beforeEach(() => {
  // Only the gateway's window timers are faked; socket I/O stays real.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  // The round log; the log test reads it.
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const c of clients) c.disconnect();
  clients = [];
  await new Promise((resolve) => (io ? io.close(resolve) : resolve(undefined)));
  io = undefined;
});

interface Harness {
  rooms: InMemoryRoomStore;
  connect(): Promise<TestClient>;
  /** Moves the wall clock (reducer `now`, rate limiters). */
  advance(ms: number): void;
  /** Moves the monotonic clock (buzz arrival, RTT). */
  advanceMono(ms: number): void;
}

async function start(): Promise<Harness> {
  let now = T0;
  let mono = 1000;
  const rooms = new InMemoryRoomStore();
  rooms.set(makeRoom({ hostTokenHash: hashHostToken(TOKEN) }));
  const httpServer = createServer();
  io = attachSockets(httpServer, { rooms, clock: () => now, monotonic: () => mono });
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;

  return {
    rooms,
    advance: (ms) => (now += ms),
    advanceMono: (ms) => (mono += ms),
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

function record<T>(client: TestClient, event: 'fx' | 'state'): T[] {
  const seen: T[] = [];
  client.on(event, (payload: unknown) => seen.push(payload as T));
  return seen;
}

/**
 * An acked round trip with no side effects on a joined socket ("Already joined"). Everything the
 * server sent this socket before it has arrived.
 */
const flush = (c: TestClient): Promise<Ack> => c.emitWithAck('screen:join', { code: 'ABCD' });

const buzz = (c: TestClient): Promise<Ack> => c.emitWithAck('player:buzz', {});

/** Screen, host and players a and b, joined, with question 1 open. */
async function openTable() {
  const h = await start();
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

/** Gives `client` one RTT sample of `rttMs`: the monotonic clock moves while the pong is in flight. */
async function sampleRtt(h: Harness, client: TestClient, rttMs: number): Promise<void> {
  const acked = new Promise<void>((resolve) =>
    client.once('pong', (_payload, ack) => {
      h.advanceMono(rttMs);
      ack();
      resolve();
    }),
  );
  expect(await client.emitWithAck('ping', { t: 7 })).toEqual({ ok: true });
  await acked;
  await flush(client);
}

describe('socket gateway: buzz window', () => {
  it('announces the earlier of two buzzes 20 ms apart once, to Screen, Host and both players', async () => {
    const { h, screen, host, a, b } = await openTable();
    const fxs = [screen, host, a, b].map((c) => record<Fx>(c, 'fx'));

    expect(await buzz(a)).toEqual({ ok: true });
    h.advanceMono(20);
    expect(await buzz(b)).toEqual({ ok: true });
    expect(h.rooms.get('ABCD')!.phase).toBe('COLLECTING');

    vi.advanceTimersByTime(COLLECTION_WINDOW_MS - 1);
    expect(h.rooms.get('ABCD')!.phase).toBe('COLLECTING');
    vi.advanceTimersByTime(1);
    expect(h.rooms.get('ABCD')!.phase).toBe('BUZZED');

    // Running every later timer announces nothing more.
    vi.advanceTimersByTime(10 * COLLECTION_WINDOW_MS);
    await Promise.all([screen, host, a, b].map(flush));
    for (const seen of fxs) {
      expect(seen).toEqual([{ kind: 'buzz', playerId: 'a', gaps: [{ playerId: 'b', gapMs: 20 }] }]);
    }
    expect(h.rooms.get('ABCD')!.winnerId).toBe('a');
  });

  it('lets a later buzz win once its measured latency is taken off', async () => {
    const { h, screen, a, b } = await openTable();
    await sampleRtt(h, b, 100); // one-way 50 ms
    const fxs = record<Fx>(screen, 'fx');

    await buzz(a);
    h.advanceMono(20);
    await buzz(b);
    vi.advanceTimersByTime(COLLECTION_WINDOW_MS);
    await flush(screen);

    expect(fxs).toEqual([{ kind: 'buzz', playerId: 'b', gaps: [{ playerId: 'a', gapMs: 30 }] }]);
  });

  it('drops a window timer that fires after the host revealed', async () => {
    const { h, screen, host, a } = await openTable();
    const fxs = record<Fx>(screen, 'fx');

    await buzz(a);
    expect(await host.emitWithAck('host:reveal', {})).toEqual({ ok: true });
    await flush(screen);
    const states = record<View>(screen, 'state');
    vi.advanceTimersByTime(COLLECTION_WINDOW_MS);
    await flush(screen);

    expect(h.rooms.get('ABCD')!.phase).toBe('REVEAL');
    expect(fxs).toEqual([]);
    expect(states).toEqual([]);
  });

  it('acks a buzz that does not count and sends nobody a new state', async () => {
    const { h, screen, host, a } = await openTable();
    await host.emitWithAck('host:reveal', {});
    // The reveal's own state reaches the other sockets after the host's ack.
    await Promise.all([screen, host, a].map(flush));
    const before = h.rooms.get('ABCD');
    const states = [screen, host, a].map((c) => record<View>(c, 'state'));

    expect(await buzz(a)).toEqual({ ok: true });
    await Promise.all([screen, host, a].map(flush));

    expect(h.rooms.get('ABCD')).toBe(before);
    for (const seen of states) expect(seen).toEqual([]);
  });

  it('writes every counted buzz to the round log with its timings', async () => {
    const { h, a, b } = await openTable();
    await sampleRtt(h, b, 100);
    await buzz(a); // receivedAt 1100: the RTT sample moved the clock
    h.advanceMono(20);
    await buzz(b);

    const lines = vi.mocked(console.info).mock.calls.filter(([tag]) => tag === '[buzz]');
    expect(lines.map(([, json]) => JSON.parse(json as string))).toEqual([
      {
        code: 'ABCD',
        questionIndex: 0,
        openingCounter: 1,
        playerId: 'a',
        receivedAt: 1100,
        oneWayMs: 0,
        adjustedAt: 1100,
      },
      {
        code: 'ABCD',
        questionIndex: 0,
        openingCounter: 1,
        playerId: 'b',
        receivedAt: 1120,
        oneWayMs: 50,
        adjustedAt: 1070,
      },
    ]);
  });
});

describe('socket gateway: buzz rate limit', () => {
  it('rejects the 6th buzz in a second from one socket, and allows it again after the second', async () => {
    const { h, a, b } = await openTable();

    for (let i = 0; i < BUZZ_RATE_LIMIT.max; i++) expect(await buzz(a)).toEqual({ ok: true });
    expect(await buzz(a)).toEqual({ ok: false, error: BUZZ_RATE_LIMITED_ERROR });
    // The limit is per socket.
    expect(await buzz(b)).toEqual({ ok: true });

    h.advance(BUZZ_RATE_LIMIT.windowMs);
    expect(await buzz(a)).toEqual({ ok: true });
  });

  it('rejects a buzz from a socket that has not joined as a player', async () => {
    const { host } = await openTable();
    expect(await buzz(host)).toEqual({ ok: false, error: 'Join the game first' });
  });
});

describe('socket gateway: ping', () => {
  it('answers ping {t} with pong {t}', async () => {
    const h = await start();
    const client = await h.connect();
    const pong = new Promise<{ t: number }>((resolve) => client.once('pong', resolve));
    expect(await client.emitWithAck('ping', { t: 1234.5 })).toEqual({ ok: true });
    expect(await pong).toEqual({ t: 1234.5 });
  });

  it("keeps the median of the server's own RTT samples on the player, and the Host sees it", async () => {
    const { h, host, b } = await openTable();
    for (const rtt of [40, 200, 60]) await sampleRtt(h, b, rtt);
    expect(h.rooms.get('ABCD')!.players.b!.rttMs).toBe(60);

    const states = record<HostView>(host, 'state');
    await host.emitWithAck('host:scoreboard', { show: true });
    expect(states.at(-1)!.players.find((p) => p.id === 'b')!.rttMs).toBe(60);
  });

  it('records no sample when the pong ack comes after PONG_ACK_TIMEOUT_MS', async () => {
    const { h, b } = await openTable();
    const held = new Promise<() => void>((resolve) =>
      b.once('pong', (_payload, ack) => resolve(ack)),
    );
    await b.emitWithAck('ping', { t: 7 });
    const ack = await held;
    h.advanceMono(100);
    vi.advanceTimersByTime(PONG_ACK_TIMEOUT_MS);
    ack();
    await flush(b);

    expect(h.rooms.get('ABCD')!.players.b!.rttMs).toBe(0);
  });

  it('rejects the 6th ping in a second from one socket', async () => {
    const h = await start();
    const client = await h.connect();
    for (let i = 0; i < PING_RATE_LIMIT.max; i++) {
      expect(await client.emitWithAck('ping', { t: i })).toEqual({ ok: true });
    }
    expect(await client.emitWithAck('ping', { t: 9 })).toEqual({
      ok: false,
      error: PING_RATE_LIMITED_ERROR,
    });
    h.advance(PING_RATE_LIMIT.windowMs);
    expect(await client.emitWithAck('ping', { t: 10 })).toEqual({ ok: true });
  });

  it('records an RTT sample without broadcasting or stamping activity', async () => {
    const { h, screen, b } = await openTable();
    const states = record<View>(screen, 'state');
    const before = h.rooms.get('ABCD')!.lastActivityAt;
    h.advance(1000);

    await sampleRtt(h, b, 80);
    await flush(screen);

    expect(states).toEqual([]);
    expect(h.rooms.get('ABCD')!.lastActivityAt).toBe(before);
  });
});

describe('socket gateway: host flow events', () => {
  it('rejects host events from a player, a plain Screen and a socket that never joined', async () => {
    const h = await start();
    const [screen, player, stranger] = await Promise.all([h.connect(), h.connect(), h.connect()]);
    await screen.emitWithAck('screen:join', { code: 'ABCD' });
    await player.emitWithAck('player:join', { code: 'ABCD', playerId: 'p', name: 'Pat' });

    for (const c of [screen, player, stranger]) {
      expect(await c.emitWithAck('host:start', {})).toEqual({ ok: false, error: NOT_HOST_ERROR });
      expect(await c.emitWithAck('host:end', {})).toEqual({ ok: false, error: NOT_HOST_ERROR });
    }
    expect(h.rooms.get('ABCD')!.phase).toBe('LOBBY');
  });

  it('runs start, open, reveal, next, prev, scoreboard and end for the host and a Screen holding the token', async () => {
    const h = await start();
    const [screen, host, player] = await Promise.all([h.connect(), h.connect(), h.connect()]);
    await screen.emitWithAck('screen:join', { code: 'ABCD', hostToken: TOKEN });
    await host.emitWithAck('host:join', { code: 'ABCD', hostToken: TOKEN });
    await player.emitWithAck('player:join', { code: 'ABCD', playerId: 'p', name: 'Pat' });
    const phase = () => h.rooms.get('ABCD')!;

    expect(await host.emitWithAck('host:start', {})).toEqual({ ok: true });
    expect(phase()).toMatchObject({ phase: 'QUESTION', questionIndex: 0 });
    expect(await screen.emitWithAck('host:open', {})).toEqual({ ok: true });
    expect(phase().phase).toBe('OPEN');
    expect(await host.emitWithAck('host:reveal', {})).toEqual({ ok: true });
    expect(phase().phase).toBe('REVEAL');
    expect(await screen.emitWithAck('host:next', {})).toEqual({ ok: true });
    expect(phase()).toMatchObject({ phase: 'QUESTION', questionIndex: 1 });
    expect(await host.emitWithAck('host:prev', {})).toEqual({ ok: true });
    expect(phase()).toMatchObject({ phase: 'QUESTION', questionIndex: 0 });
    expect(await host.emitWithAck('host:scoreboard', { show: true })).toEqual({ ok: true });
    expect(phase().showScoreboard).toBe(true);
    expect(await screen.emitWithAck('host:end', {})).toEqual({ ok: true });
    expect(phase().phase).toBe('FINAL');
  });

  it('passes a wrong-phase rejection through the ack', async () => {
    const { host } = await openTable();
    expect(await host.emitWithAck('host:next', {})).toEqual({
      ok: false,
      error: 'Not allowed in this phase',
    });
  });
});
