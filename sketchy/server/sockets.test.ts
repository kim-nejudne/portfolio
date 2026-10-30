import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CHOOSE_MS,
  GRACE_MS,
  PING_RATE_LIMIT,
  SOCKET_PING_INTERVAL_MS,
  SOCKET_PING_TIMEOUT_MS,
} from '../shared/constants.js';
import type { Ack, ClientEvent, Fx, PlayerView, ScreenView, View } from '../shared/types.js';
import { generateHostToken, hashHostToken } from './hostToken.js';
import { createRoom } from './room.js';
import { TEST_PACKS } from './test/packs.js';
import { InMemoryRoomStore } from './roomStore.js';
import { attachSockets, closeRooms, hashPlayerKey, type Gateway } from './sockets.js';

const WALL0 = 1_800_000_000_000;
const MONO0 = 50_000;
const CODE = 'ABCD';
const KEY_ANA = 'a'.repeat(21);
const KEY_BEN = 'b'.repeat(21);

interface Pending {
  fn: () => void;
  delayMs: number;
  cancelled: boolean;
}

interface Client {
  socket: ClientSocket;
  states: View[];
  fx: Fx[];
  /** Resolves with the first state (already received or next) matching `pred`. */
  state<V extends View = View>(pred: (v: V) => boolean): Promise<V>;
  emit<T extends object = object>(event: ClientEvent | string, payload?: unknown): Promise<Ack<T>>;
}

let server: Server | undefined;
let clients: ClientSocket[] = [];

afterEach(async () => {
  for (const c of clients) c.disconnect();
  clients = [];
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
});

async function setup() {
  const rooms = new InMemoryRoomStore();
  const hostToken = generateHostToken();
  rooms.set(
    createRoom({
      code: CODE,
      hostTokenHash: hashHostToken(hostToken),
      now: WALL0,
      seed: 7,
      packs: TEST_PACKS,
    }),
  );
  const time = { wall: WALL0, mono: MONO0 };
  const timers: Pending[] = [];
  server = createServer();
  const gateway: Gateway = attachSockets(server, {
    rooms,
    clock: () => time.wall,
    monotonic: () => time.mono,
    scheduler: (fn, delayMs) => {
      const t: Pending = { fn, delayMs, cancelled: false };
      timers.push(t);
      return () => {
        t.cancelled = true;
      };
    },
  });
  server.listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  async function connect(): Promise<Client> {
    const socket = connectClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    clients.push(socket);
    const states: View[] = [];
    const fx: Fx[] = [];
    socket.on('state', (v: View) => states.push(v));
    socket.on('fx', (f: Fx) => fx.push(f));
    await new Promise<void>((resolve) => socket.once('connect', () => resolve()));
    return {
      socket,
      states,
      fx,
      state: <V extends View>(pred: (v: V) => boolean) =>
        new Promise<V>((resolve) => {
          const seen = (states as V[]).find(pred);
          if (seen) return resolve(seen);
          const on = (v: V) => {
            if (!pred(v)) return;
            socket.off('state', on);
            resolve(v);
          };
          socket.on('state', on);
        }),
      emit: <T extends object>(event: string, payload: unknown = {}) =>
        socket.timeout(2000).emitWithAck(event, payload) as Promise<Ack<T>>,
    };
  }

  return { rooms, hostToken, time, timers, gateway, connect };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function joinPlayer(s: Setup, playerKey: string, name: string) {
  const client = await s.connect();
  const ack = await client.emit<{ pid: string }>('player:join', { code: CODE, playerKey, name });
  if (!ack.ok) throw new Error(`join failed: ${ack.error}`);
  return { client, pid: ack.pid };
}

/** A token Screen, Ana (first joiner: crown, first drawer) and Ben, in DRAWING. */
async function playing() {
  const s = await setup();
  const screen = await s.connect();
  expect(await screen.emit('screen:join', { code: CODE, hostToken: s.hostToken })).toEqual({
    ok: true,
  });
  const ana = await joinPlayer(s, KEY_ANA, 'Ana');
  const ben = await joinPlayer(s, KEY_BEN, 'Ben');
  expect(await screen.emit('host:start')).toEqual({ ok: true });
  // Ana is dealt three words and takes the first.
  expect(await ana.client.emit('drawer:choose', { index: 0 })).toEqual({ ok: true });
  const word = s.rooms.get(CODE)!.turn!.word!.word;
  return { ...s, screen, ana, ben, word };
}

describe('Socket.IO options', () => {
  it('uses a 5 s ping interval and timeout', async () => {
    const { gateway } = await setup();
    expect(SOCKET_PING_INTERVAL_MS).toBe(5000);
    expect(SOCKET_PING_TIMEOUT_MS).toBe(5000);
    expect(gateway.io.engine.opts).toMatchObject({ pingInterval: 5000, pingTimeout: 5000 });
  });
});

describe('screen:join', () => {
  it('with the token makes the socket a host Screen and counts it', async () => {
    const s = await setup();
    const screen = await s.connect();
    expect(await screen.emit('screen:join', { code: CODE, hostToken: s.hostToken })).toEqual({
      ok: true,
    });
    const view = await screen.state<ScreenView>((v) => v.role === 'screen');
    expect(view.host).toEqual({ code: CODE, customWordCount: 0 });
    expect(s.rooms.get(CODE)!.screens).toBe(1);
  });

  it('without the token is a plain Screen that cannot run host actions', async () => {
    const s = await setup();
    const screen = await s.connect();
    expect(await screen.emit('screen:join', { code: CODE })).toEqual({ ok: true });
    expect((await screen.state((v) => v.role === 'screen')).host).toBeNull();
    expect(await screen.emit('host:start')).toEqual({ ok: false, error: 'notHost' });
  });

  it('refuses a wrong token, an unknown room and a malformed payload', async () => {
    const s = await setup();
    const screen = await s.connect();
    const wrong = generateHostToken();
    expect(await screen.emit('screen:join', { code: CODE, hostToken: wrong })).toEqual({
      ok: false,
      error: 'badHostToken',
    });
    expect(await screen.emit('screen:join', { code: 'ZZZZ' })).toEqual({
      ok: false,
      error: 'roomNotFound',
    });
    expect(await screen.emit('screen:join', { code: 42 })).toEqual({
      ok: false,
      error: 'invalidPayload',
    });
  });

  it('uncounts a Screen that disconnects', async () => {
    const s = await setup();
    const screen = await s.connect();
    await screen.emit('screen:join', { code: CODE });
    const other = await s.connect();
    await other.emit('screen:join', { code: CODE });
    expect(s.rooms.get(CODE)!.screens).toBe(2);
    screen.socket.disconnect();
    await other.state<ScreenView>(() => s.rooms.get(CODE)!.screens === 1);
    expect(s.rooms.get(CODE)!.screens).toBe(1);
  });
});

describe('player:join', () => {
  it('acks the pid, sends the player its view and stores only the key hash', async () => {
    const s = await setup();
    const screen = await s.connect();
    await screen.emit('screen:join', { code: CODE });
    const { client, pid } = await joinPlayer(s, KEY_ANA, 'Ana');
    const view = await client.state<PlayerView>((v) => v.role === 'player');
    expect(view.me.pid).toBe(pid);
    const player = s.rooms.get(CODE)!.players[pid]!;
    expect(player.keyHash).toBe(hashPlayerKey(KEY_ANA));
    expect(JSON.stringify(s.rooms.get(CODE))).not.toContain(KEY_ANA);
    // The first joiner is crowned; the Screen hears about the join.
    expect(client.fx).toContainEqual({ kind: 'crowned' });
    await screen.state((v) => v.players.length === 1);
    expect(screen.fx).toContainEqual({ kind: 'join', pid });
  });

  it('refuses a second join on the same socket', async () => {
    const s = await setup();
    const { client } = await joinPlayer(s, KEY_ANA, 'Ana');
    expect(
      await client.emit('player:join', { code: CODE, playerKey: KEY_BEN, name: 'Ben' }),
    ).toEqual({ ok: false, error: 'alreadyJoined' });
  });

  it('passes reducer errors through as codes, e.g. a taken name', async () => {
    const s = await setup();
    await joinPlayer(s, KEY_ANA, 'Ana');
    const other = await s.connect();
    expect(
      await other.emit('player:join', { code: CODE, playerKey: KEY_BEN, name: 'ana' }),
    ).toEqual({ ok: false, error: 'nameTaken' });
  });

  it('rejoins with the same key: same pid, same score, connected again', async () => {
    const g = await playing();
    const ack = await g.ben.client.emit('player:guess', { text: g.word });
    expect(ack).toEqual({ ok: true });
    const scored = g.rooms.get(CODE)!.players[g.ben.pid]!.score;
    expect(scored).toBe(300);

    g.ben.client.socket.disconnect();
    await g.screen.state((v) => v.players.some((p) => p.pid === g.ben.pid && !p.connected));
    expect(g.rooms.get(CODE)!.players[g.ben.pid]!.connected).toBe(false);

    const again = await joinPlayer(g, KEY_BEN, 'Ben');
    expect(again.pid).toBe(g.ben.pid);
    const room = g.rooms.get(CODE)!;
    expect(room.players[g.ben.pid]).toMatchObject({ connected: true, score: scored });
    expect(Object.keys(room.players)).toHaveLength(2);
    const view = await again.client.state<PlayerView>((v) => v.role === 'player');
    expect(view.me.turnPoints).toBe(300);
    expect(view.players.find((p) => p.pid === g.ben.pid)!.guessed).toBe(true);
  });
});

describe('state broadcast', () => {
  it('sends the word only to the drawer while drawing', async () => {
    const g = await playing();
    const drawer = await g.ana.client.state<PlayerView>((v) => v.phase === 'DRAWING');
    expect(drawer.secret!.word!.word).toBe(g.word);
    const screen = await g.screen.state((v) => v.phase === 'DRAWING');
    const ben = await g.ben.client.state((v) => v.phase === 'DRAWING');
    expect(JSON.stringify(screen)).not.toContain(`"${g.word}"`);
    expect(JSON.stringify(ben)).not.toContain(`"${g.word}"`);
    expect(screen.turn!.mask).toHaveLength(g.word.length);
  });

  it('keeps the word, alternates and gloss out of every non-drawer state and fx', async () => {
    const g = await playing();
    // Swap in a word whose every secret starts with `qz`, so a substring search finds any of them.
    const room = g.rooms.get(CODE)!;
    const secret = { ...room.turn!.word!, word: 'qzsecret', alt: ['qzalt'], gloss: 'qzgloss' };
    g.rooms.set({ ...room, turn: { ...room.turn!, word: secret } });

    const third = await joinPlayer(g, 'c'.repeat(21), 'Cy');
    expect(await third.client.emit('player:guess', { text: 'nope' })).toEqual({ ok: true });
    expect(await g.ben.client.emit('player:guess', { text: 'qzalt' })).toEqual({ ok: true });
    await g.ana.client.state<PlayerView>((v) => v.turn?.correct.length === 1);
    await g.screen.state((v) => v.turn?.correct.length === 1);
    await third.client.state((v) => v.turn?.correct.length === 1);
    expect(g.screen.fx).toContainEqual({ kind: 'correct', pid: g.ben.pid, points: 300, order: 1 });

    for (const [name, c] of [
      ['screen', g.screen],
      ['correct guesser', g.ben.client],
      ['guesser', third.client],
    ] as const) {
      expect(JSON.stringify(c.states.slice(-1)), name).not.toContain('qz');
      expect(JSON.stringify(c.fx), name).not.toContain('qz');
    }
    const drawer = g.ana.client.states.at(-1) as PlayerView;
    expect(drawer.secret!.word).toEqual({
      word: 'qzsecret',
      gloss: 'qzgloss',
      difficulty: secret.difficulty,
    });
    expect(JSON.stringify(g.ana.client.states)).not.toContain('qzalt');
  });

  it('goes to every socket after every accepted action and stamps lastActivityAt', async () => {
    const g = await playing();
    g.time.wall = WALL0 + 60_000;
    const before = g.screen.states.length;
    expect(await g.ben.client.emit('player:guess', { text: 'zzz-not-it' })).toEqual({ ok: true });
    await g.screen.state(() => g.screen.states.length > before);
    await g.ana.client.state<PlayerView>((v) => v.lastGuess?.text === 'zzz-not-it');
    expect(g.rooms.get(CODE)!.lastActivityAt).toBe(WALL0 + 60_000);
    // The Screen's bubble; the guesser's shake.
    expect(g.screen.fx).toContainEqual({ kind: 'wrongGuess', pid: g.ben.pid, text: 'zzz-not-it' });
    expect(g.ben.client.fx).toContainEqual({ kind: 'wrong' });
  });

  it('broadcasts nothing for a refused action', async () => {
    const g = await playing();
    const before = g.screen.states.length;
    expect(await g.ana.client.emit('player:guess', { text: g.word })).toEqual({
      ok: false,
      error: 'drawerCannotGuess',
    });
    expect(g.screen.states.length).toBe(before);
  });
});

describe('host actions', () => {
  it('are accepted from the crown holder and refused from other players', async () => {
    const s = await setup();
    const ana = await joinPlayer(s, KEY_ANA, 'Ana');
    const ben = await joinPlayer(s, KEY_BEN, 'Ben');
    expect(await ben.client.emit('host:start')).toEqual({ ok: false, error: 'notHost' });
    expect(await ana.client.emit('host:start')).toEqual({ ok: true });
    expect(s.rooms.get(CODE)!.phase).toBe('CHOOSING');
  });

  it('need a join first', async () => {
    const s = await setup();
    const stranger = await s.connect();
    expect(await stranger.emit('host:start')).toEqual({ ok: false, error: 'notJoined' });
    expect(await stranger.emit('player:guess', { text: 'hi' })).toEqual({
      ok: false,
      error: 'notJoined',
    });
  });
});

describe('effects runner', () => {
  it('schedules timers and dispatches them, ending the turn when the clock runs out', async () => {
    const g = await playing();
    // The deal's chooseUp first, then the choice's drawUp.
    expect(g.timers.map((t) => t.delayMs)).toEqual([CHOOSE_MS, 60_000 + GRACE_MS]);
    const drawUp = g.timers.at(-1)!;
    g.time.mono = MONO0 + drawUp.delayMs;
    drawUp.fn();
    expect(g.rooms.get(CODE)!.phase).toBe('REVEAL');
    const reveal = await g.ben.client.state((v) => v.phase === 'REVEAL');
    expect(reveal.turn!.word).toBe(g.word);
    expect(g.ben.client.fx).toContainEqual({ kind: 'turnEnd', reason: 'time' });
  });

  it('auto-picks a word when chooseUp fires, and the drawer alone hears which', async () => {
    const s = await setup();
    const screen = await s.connect();
    expect(await screen.emit('screen:join', { code: CODE, hostToken: s.hostToken })).toEqual({
      ok: true,
    });
    const ana = await joinPlayer(s, KEY_ANA, 'Ana');
    const ben = await joinPlayer(s, KEY_BEN, 'Ben');
    expect(await screen.emit('host:start')).toEqual({ ok: true });
    const chooseUp = s.timers.at(-1)!;
    expect(chooseUp.delayMs).toBe(CHOOSE_MS);
    s.time.mono = MONO0 + CHOOSE_MS;
    chooseUp.fn();
    const room = s.rooms.get(CODE)!;
    expect(room.phase).toBe('DRAWING');
    expect(room.turn!.word).toEqual(room.turn!.choices[0]);
    const drawer = await ana.client.state<PlayerView>((v) => v.phase === 'DRAWING');
    expect(drawer.secret!.word!.word).toBe(room.turn!.word!.word);
    const guesser = await ben.client.state((v) => v.phase === 'DRAWING');
    expect(JSON.stringify(guesser)).not.toContain(room.turn!.word!.word);
  });

  it('drops a stale timer silently', async () => {
    const g = await playing();
    const drawUp = g.timers.at(-1)!;
    expect(await g.screen.emit('host:skip')).toEqual({ ok: true });
    const room = g.rooms.get(CODE)!;
    const before = g.screen.states.length;
    drawUp.fn();
    expect(g.rooms.get(CODE)).toBe(room);
    expect(g.screen.states.length).toBe(before);
  });

  it('cancels pending timers when the server closes', async () => {
    const g = await playing();
    const pending = g.timers.filter((t) => !t.cancelled);
    expect(pending.length).toBeGreaterThan(0);
    for (const c of clients) c.disconnect();
    await new Promise((resolve) => server!.close(resolve));
    server = undefined;
    expect(pending.every((t) => t.cancelled)).toBe(true);
  });
});

describe('ping, leave and closing', () => {
  it('answers ping with pong {t, serverNow}, the server wall clock for the debug offset', async () => {
    const s = await setup();
    const { client } = await joinPlayer(s, KEY_ANA, 'Ana');
    s.time.wall = WALL0 + 4_321;
    const pong = new Promise((resolve) => client.socket.once('pong', resolve));
    expect(await client.emit('ping', { t: 123 })).toEqual({ ok: true });
    expect(await pong).toEqual({ t: 123, serverNow: WALL0 + 4_321 });
  });

  it('debug:rtt gives a Screen each player median RTT, players without samples left out', async () => {
    const g = await playing();
    const rtts = [100, 140, 120];
    g.ben.client.socket.on('pong', (_payload: unknown, ack: () => void) => {
      g.time.mono += rtts.shift()!;
      ack();
    });
    for (let i = 0; i < 3; i++) await g.ben.client.emit('ping', { t: i });
    // Ana's pongs go unacked: no sample.
    await g.ana.client.emit('ping', { t: 1 });
    expect(await g.screen.emit('debug:rtt', {})).toEqual({ ok: true, rtt: { [g.ben.pid]: 120 } });
  });

  it('debug:rtt is refused to a phone and before a join', async () => {
    const g = await playing();
    expect(await g.ben.client.emit('debug:rtt', {})).toEqual({ ok: false, error: 'notScreen' });
    const lone = await g.connect();
    expect(await lone.emit('debug:rtt', {})).toEqual({ ok: false, error: 'notJoined' });
  });

  it('debug:rtt shares the per-socket ping limit', async () => {
    const g = await playing();
    for (let i = 0; i < PING_RATE_LIMIT.max; i++)
      expect(await g.screen.emit('debug:rtt', {})).toMatchObject({ ok: true });
    expect(await g.screen.emit('debug:rtt', {})).toEqual({ ok: false, error: 'rateLimited' });
  });

  it('times RTT from pong to its ack and corrects a guess by half the median', async () => {
    const g = await playing();
    const ben = g.ben.client.socket;
    // Each pong is acked `rtt` ms (server monotonic) after it was sent: 200, 260, 240 → 240.
    const rtts = [200, 260, 240];
    ben.on('pong', (_payload: { t: number }, ack: () => void) => {
      g.time.mono += rtts.shift()!;
      ack();
    });
    for (let i = 0; i < 3; i++)
      expect(await g.ben.client.emit('ping', { t: i })).toEqual({ ok: true });
    expect(rtts).toEqual([]);
    const receivedAt = g.time.mono;
    expect(await g.ben.client.emit('player:guess', { text: g.word })).toEqual({ ok: true });
    expect(g.rooms.get(CODE)!.turn!.correct).toEqual([
      expect.objectContaining({
        pid: g.ben.pid,
        receivedAt,
        oneWayMs: 120,
        elapsedMs: receivedAt - 120 - MONO0,
      }),
    ]);
  });

  it('takes no sample from an unacked pong, so a guess is uncorrected', async () => {
    const g = await playing();
    expect(await g.ben.client.emit('ping', { t: 1 })).toEqual({ ok: true });
    g.time.mono += 5_000;
    expect(await g.ben.client.emit('player:guess', { text: g.word })).toEqual({ ok: true });
    expect(g.rooms.get(CODE)!.turn!.correct[0]).toMatchObject({ oneWayMs: 0, elapsedMs: 5_000 });
  });

  it(`refuses more than ${PING_RATE_LIMIT.max} pings a second from one socket`, async () => {
    const s = await setup();
    const { client } = await joinPlayer(s, KEY_ANA, 'Ana');
    for (let i = 0; i < PING_RATE_LIMIT.max; i++)
      expect(await client.emit('ping', { t: i })).toEqual({ ok: true });
    expect(await client.emit('ping', { t: 9 })).toEqual({ ok: false, error: 'rateLimited' });
    s.time.mono += PING_RATE_LIMIT.windowMs;
    expect(await client.emit('ping', { t: 10 })).toEqual({ ok: true });
  });

  it('player:leave removes the player and lets the socket join again', async () => {
    const s = await setup();
    const { client, pid } = await joinPlayer(s, KEY_ANA, 'Ana');
    expect(await client.emit('player:leave')).toEqual({ ok: true });
    expect(s.rooms.get(CODE)!.players[pid]).toBeUndefined();
    expect(await client.emit('player:guess', { text: 'x' })).toEqual({
      ok: false,
      error: 'notJoined',
    });
    const again = await client.emit<{ pid: string }>('player:join', {
      code: CODE,
      playerKey: KEY_ANA,
      name: 'Ana',
    });
    expect(again.ok).toBe(true);
  });

  it('closeRooms tells every socket of the room, then disconnects it', async () => {
    const s = await setup();
    const { client } = await joinPlayer(s, KEY_ANA, 'Ana');
    const closed = new Promise((resolve) => client.socket.once('room:closed', resolve));
    const gone = new Promise((resolve) => client.socket.once('disconnect', resolve));
    s.rooms.delete(CODE);
    closeRooms(s.gateway.io, [CODE], 'expired');
    expect(await closed).toEqual({ reason: 'expired' });
    expect(await gone).toBe('io server disconnect');
  });
});
