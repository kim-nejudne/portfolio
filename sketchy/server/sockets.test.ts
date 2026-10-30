import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CHOOSE_MS,
  DRAWER_AWAY_DEBOUNCE_MS,
  GRACE_MS,
  HINT_AT,
  PING_RATE_LIMIT,
  REACTION_INTERVAL_MS,
  SCREEN_AWAY_MS,
  SOCKET_PING_INTERVAL_MS,
  SOCKET_PING_TIMEOUT_MS,
  VISIBILITY_RATE_LIMIT,
} from '../shared/constants.js';
import type { Ack, ClientEvent, Fx, PlayerView, ScreenView, View } from '../shared/types.js';
import { hintCount } from './hints.js';
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

  async function connect(transports = ['websocket']): Promise<Client> {
    const socket = connectClient(`http://127.0.0.1:${port}`, {
      transports,
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

  it('accepts long-polling, the fallback when a WebSocket cannot open (F39)', async () => {
    const s = await setup();
    const client = await s.connect(['polling']);
    expect(client.socket.io.engine.transport.name).toBe('polling');
    const ack = await client.emit<{ pid: string }>('player:join', {
      code: CODE,
      playerKey: KEY_ANA,
      name: 'Ana',
    });
    expect(ack.ok).toBe(true);
    expect((await client.state((v) => v.role === 'player')).role).toBe('player');
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

  it("sends a close guess's alert to the drawer only, without the text (F36)", async () => {
    const g = await playing();
    const close = `${g.word} ko`;
    expect(await g.ben.client.emit('player:guess', { text: close })).toEqual({ ok: true });
    // A round trip on each socket after the ack, so any fx sent with it has arrived.
    for (const c of [g.screen, g.ana.client, g.ben.client]) await c.emit('debug:rtt');
    expect(g.ana.client.fx).toContainEqual({ kind: 'closeAlert', pid: g.ben.pid });
    expect(g.ben.client.fx).toContainEqual({ kind: 'nearMiss' });
    expect(g.ben.client.fx.some((f) => f.kind === 'closeAlert')).toBe(false);
    expect(g.screen.fx.some((f) => f.kind === 'closeAlert')).toBe(false);
    for (const c of [g.screen, g.ana.client, g.ben.client]) {
      expect(JSON.stringify(c.fx)).not.toContain(close);
    }
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

describe('player:react', () => {
  it('reaches the Screens only, sends no views, and is limited to one a second per player', async () => {
    const g = await playing();
    expect(await g.ben.client.emit('player:guess', { text: g.word })).toEqual({ ok: true });
    await g.screen.state((v) => v.turn?.correct.length === 1);
    const screenStates = g.screen.states.length;
    const benStates = g.ben.client.states.length;

    expect(await g.ben.client.emit('player:react', { emoji: '🔥' })).toEqual({ ok: true });
    expect(await g.ben.client.emit('player:react', { emoji: '😂' })).toEqual({
      ok: false,
      error: 'rateLimited',
    });
    g.time.mono += REACTION_INTERVAL_MS;
    expect(await g.ben.client.emit('player:react', { emoji: '👏' })).toEqual({ ok: true });
    // A round trip after the acks, so any fx or state sent with them has arrived.
    await g.screen.emit('debug:rtt');

    const reactions = (fx: Fx[]) => fx.filter((f) => f.kind === 'reaction');
    expect(reactions(g.screen.fx)).toEqual([
      { kind: 'reaction', pid: g.ben.pid, emoji: '🔥' },
      { kind: 'reaction', pid: g.ben.pid, emoji: '👏' },
    ]);
    expect(reactions(g.ben.client.fx)).toEqual([]);
    expect(reactions(g.ana.client.fx)).toEqual([]);
    expect(g.screen.states.length).toBe(screenStates);
    expect(g.ben.client.states.length).toBe(benStates);
  });

  it('refuses a guesser who hasn’t got the word', async () => {
    const g = await playing();
    expect(await g.ben.client.emit('player:react', { emoji: '🔥' })).toEqual({
      ok: false,
      error: 'notGuessed',
    });
  });

  it('refuses an emoji outside REACTIONS', async () => {
    const g = await playing();
    expect(await g.ben.client.emit('player:react', { emoji: 'tsinelas' })).toEqual({
      ok: false,
      error: 'invalidPayload',
    });
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

  it('host:settings: validated, applied for the token Screen, and in every view (F22)', async () => {
    const s = await setup();
    const screen = await s.connect();
    await screen.emit('screen:join', { code: CODE, hostToken: s.hostToken });
    const ben = await joinPlayer(s, KEY_BEN, 'Ben');
    expect(await screen.emit('host:settings', { drawSeconds: 50 })).toEqual({
      ok: false,
      error: 'invalidPayload',
    });
    expect(await screen.emit('host:settings', { drawSeconds: 80, cycles: 3 })).toEqual({
      ok: true,
    });
    const seen = await ben.client.state((v) => v.settings.drawSeconds === 80);
    expect(seen.settings.cycles).toBe(3);
    const plain = await s.connect();
    await plain.emit('screen:join', { code: CODE });
    expect(await plain.emit('host:settings', { cycles: 1 })).toEqual({
      ok: false,
      error: 'notHost',
    });
    expect(s.rooms.get(CODE)!.settings.cycles).toBe(3);
  });

  it('host:crown: the holder passes it on, and the host rights go with it (F25)', async () => {
    const s = await setup();
    const screen = await s.connect();
    await screen.emit('screen:join', { code: CODE, hostToken: s.hostToken });
    const ana = await joinPlayer(s, KEY_ANA, 'Ana');
    const ben = await joinPlayer(s, KEY_BEN, 'Ben');
    expect(await ben.client.emit('host:crown', { pid: ben.pid })).toEqual({
      ok: false,
      error: 'notHost',
    });
    expect(await ana.client.emit('host:crown', { pid: 'not a pid!' })).toEqual({
      ok: false,
      error: 'invalidPayload',
    });
    expect(await ana.client.emit('host:crown', { pid: ben.pid })).toEqual({ ok: true });
    const benView = await ben.client.state<PlayerView>((v) => v.host !== null);
    expect(benView.players.find((p) => p.pid === ben.pid)!.crown).toBe(true);
    await ana.client.state<PlayerView>((v) => v.players.some((p) => p.pid === ben.pid && p.crown));
    expect(ana.client.states.at(-1)!.host).toBeNull();
    expect(ben.client.fx.filter((f) => f.kind === 'crowned')).toHaveLength(1);
    // Ana's phone lost its host rights; the token Screen moves the crown back.
    expect(await ana.client.emit('host:start')).toEqual({ ok: false, error: 'notHost' });
    expect(await screen.emit('host:crown', { pid: ana.pid })).toEqual({ ok: true });
    expect(s.rooms.get(CODE)!.crownPid).toBe(ana.pid);
  });

  it('host:kick: the phone hears `kicked`, is disconnected, and its key can’t rejoin (F28)', async () => {
    const g = await playing();
    const kicked = new Promise<void>((resolve) =>
      g.ben.client.socket.once('kicked', () => resolve()),
    );
    const gone = new Promise<void>((resolve) =>
      g.ben.client.socket.once('disconnect', () => resolve()),
    );
    expect(await g.ana.client.emit('host:kick', { pid: g.ana.pid })).toEqual({
      ok: false,
      error: 'cannotKickSelf',
    });
    expect(await g.ana.client.emit('host:kick', { pid: g.ben.pid })).toEqual({ ok: true });
    await kicked;
    await gone;
    const seen = await g.screen.state<ScreenView>((v) => v.players.length === 1);
    expect(seen.players.map((p) => p.name)).toEqual(['Ana']);
    const again = await g.connect();
    expect(
      await again.emit('player:join', { code: CODE, playerKey: KEY_BEN, name: 'Benji' }),
    ).toEqual({ ok: false, error: 'kicked' });
  });

  it('host:pause and host:resume: frozen clock, 3-2-1, then drawing again (F28)', async () => {
    const g = await playing();
    g.time.mono = MONO0 + 10_000;
    expect(await g.screen.emit('host:pause')).toEqual({ ok: true });
    const paused = await g.ben.client.state((v) => v.paused !== null);
    expect(paused.paused).toEqual({ reasons: ['host'], resumeInMs: null });
    expect(paused.turn!.timer).toEqual({ remainingMs: 50_000, totalMs: 60_000, running: false });
    expect(await g.ben.client.emit('player:guess', { text: g.word })).toEqual({
      ok: false,
      error: 'paused',
    });
    g.time.mono = MONO0 + 20_000;
    expect(await g.ana.client.emit('host:resume')).toEqual({ ok: true });
    const counting = await g.ben.client.state((v) => v.paused?.resumeInMs != null);
    expect(counting.paused!.resumeInMs).toBe(3000);
    const go = g.timers.at(-1)!;
    expect(go.delayMs).toBe(3000);
    g.time.mono = MONO0 + 23_000;
    go.fn();
    // The latest state, not the first DRAWING one: running again with the 50 s it had left.
    await g.ben.client.state((v) => v.paused === null && v.turn?.timer?.remainingMs === 50_000);
    expect(g.ben.client.states.at(-1)!.turn!.timer).toEqual({
      remainingMs: 50_000,
      totalMs: 60_000,
      running: true,
    });
  });

  it('host:rematch: a 3-2-1 for everyone, then game 2 with Ben drawing first (F29)', async () => {
    const g = await playing();
    expect(await g.screen.emit('host:end')).toEqual({ ok: true });
    await g.ben.client.state((v) => v.phase === 'FINAL');
    expect(await g.ana.client.emit('host:rematch')).toEqual({ ok: true });
    const counting = await g.ben.client.state((v) => v.rematchInMs !== null);
    expect(counting.rematchInMs).toBe(3000);
    expect(counting.rematchFirst?.name).toBe('Ben');
    const go = g.timers.at(-1)!;
    expect(go.delayMs).toBe(3000);
    g.time.mono += 3000;
    go.fn();
    const game2 = await g.ben.client.state((v) => v.phase === 'CHOOSING' && v.gameNumber === 2);
    expect(game2.turn!.drawerPid).toBe(g.ben.pid);
    expect(game2.turn!.number).toBe(1);
    expect(g.ben.client.fx).toContainEqual({ kind: 'yourTurn' });
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
    // The deal's chooseUp first, then the choice's drawUp and its hints (F19).
    const hints = HINT_AT.slice(0, hintCount(g.word)).map((f) => f * 60_000);
    expect(g.timers.map((t) => t.delayMs)).toEqual([CHOOSE_MS, 60_000 + GRACE_MS, ...hints]);
    const drawUp = g.timers[1]!;
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

  it('reveals a hint letter on every view when a hint timer fires', async () => {
    const g = await playing();
    const hint = g.timers[2]!;
    expect(hint.delayMs).toBe(HINT_AT[0] * 60_000);
    g.time.mono = MONO0 + hint.delayMs;
    hint.fn();
    const [index] = g.rooms.get(CODE)!.turn!.hintIndexes;
    expect(index).toBeDefined();
    const letter = [...g.word][index!];
    const screen = await g.screen.state((v) => v.turn?.mask?.[index!] === letter);
    const ben = await g.ben.client.state((v) => v.turn?.mask?.[index!] === letter);
    expect(ben.turn!.mask).toEqual(screen.turn!.mask);
    expect(g.ben.client.fx).toContainEqual({ kind: 'hint' });
    expect(g.screen.fx).toContainEqual({ kind: 'hint' });
  });

  it('drops a stale timer silently', async () => {
    const g = await playing();
    const drawUp = g.timers[1]!;
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

describe('the drawer away (F40)', () => {
  it('a hidden drawer shows "reconnecting", then the 2 s check pauses every view', async () => {
    const g = await playing();
    g.time.mono = MONO0 + 10_000;
    expect(await g.ana.client.emit('player:visibility', { hidden: true })).toEqual({ ok: true });
    const badge = await g.screen.state((v) => v.turn?.drawerReconnecting === true);
    expect(badge.paused).toBeNull();
    const check = g.timers.at(-1)!;
    expect(check.delayMs).toBe(DRAWER_AWAY_DEBOUNCE_MS);
    g.time.mono += DRAWER_AWAY_DEBOUNCE_MS;
    check.fn();
    const paused = await g.ben.client.state((v) => v.paused !== null);
    expect(paused.paused!.reasons).toEqual(['drawerAway']);
    expect(paused.turn!.drawerReconnecting).toBe(false);
    // Visible again: the 3-2-1 on every view.
    expect(await g.ana.client.emit('player:visibility', { hidden: false })).toEqual({ ok: true });
    await g.screen.state((v) => v.paused?.resumeInMs != null);
  });

  it('a dropped drawer socket schedules the check too', async () => {
    const g = await playing();
    const before = g.timers.length;
    g.ana.client.socket.disconnect();
    await g.screen.state((v) => v.turn?.drawerReconnecting === true);
    expect(g.timers.slice(before).map((t) => t.delayMs)).toEqual([DRAWER_AWAY_DEBOUNCE_MS]);
  });

  it(`refuses more than ${VISIBILITY_RATE_LIMIT.max} reports a second per player`, async () => {
    const g = await playing();
    for (let i = 0; i < VISIBILITY_RATE_LIMIT.max; i++)
      expect(await g.ben.client.emit('player:visibility', { hidden: i % 2 === 0 })).toEqual({
        ok: true,
      });
    expect(await g.ben.client.emit('player:visibility', { hidden: false })).toEqual({
      ok: false,
      error: 'rateLimited',
    });
    g.time.mono += VISIBILITY_RATE_LIMIT.windowMs;
    expect(await g.ben.client.emit('player:visibility', { hidden: false })).toEqual({ ok: true });
  });

  it('a join carries the page’s visibility', async () => {
    const s = await setup();
    const screen = await s.connect();
    await screen.emit('screen:join', { code: CODE });
    const ana = await s.connect();
    expect(
      await ana.emit('player:join', { code: CODE, playerKey: KEY_ANA, name: 'Ana', hidden: true }),
    ).toMatchObject({ ok: true });
    expect(Object.values(s.rooms.get(CODE)!.players)[0]!.hidden).toBe(true);
  });

  it('refuses a bad payload', async () => {
    const g = await playing();
    expect(await g.ana.client.emit('player:visibility', { hidden: 'yes' })).toMatchObject({
      ok: false,
    });
  });
});

describe('the Screen away and too few players (F41)', () => {
  it('the last Screen gone: screenGone 3 s on pauses the phones; a Screen back gets the 3-2-1', async () => {
    const g = await playing();
    g.time.mono = MONO0 + 10_000;
    const before = g.timers.length;
    g.screen.socket.disconnect();
    await g.ben.client.state(() => g.rooms.get(CODE)!.screens === 0);
    const check = g.timers.slice(before).find((t) => t.delayMs === SCREEN_AWAY_MS)!;
    expect(check).toBeDefined();
    expect((await g.ben.client.state((v) => v.role === 'player')).paused).toBeNull();
    g.time.mono += SCREEN_AWAY_MS;
    check.fn();
    const paused = await g.ben.client.state((v) => v.paused !== null);
    expect(paused.paused!.reasons).toEqual(['screenAway']);
    const screen = await g.connect();
    expect(await screen.emit('screen:join', { code: CODE, hostToken: g.hostToken })).toEqual({
      ok: true,
    });
    const back = await screen.state((v) => v.paused?.resumeInMs != null);
    expect(back.paused!.reasons).toEqual([]);
    await g.ana.client.state((v) => v.paused?.resumeInMs != null);
  });

  it('down to one connected player pauses every view at once', async () => {
    const g = await playing();
    g.ben.client.socket.disconnect();
    const paused = await g.screen.state((v) => v.paused !== null);
    expect(paused.paused!.reasons).toEqual(['fewPlayers']);
    expect((await g.ana.client.state((v) => v.paused !== null)).paused!.reasons).toEqual([
      'fewPlayers',
    ]);
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
