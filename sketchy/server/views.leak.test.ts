// Word secrecy leak tests (Test plan: Secrecy). A scripted game visits every phase and, at every
// step, serialises every view (both Screens, every player, the crown holder) and every effect.
// No word, alternate, gloss or choice may reach anyone but its drawer before REVEAL, a correct
// guesser and the crown holder included. A second game runs the same check end to end through the
// socket gateway: every `state`, `fx` and ack a socket receives, and every console line.
//
// Every secret in play carries a `qz` marker (the v0 word list is mocked below), so a token search
// of the JSON finds any of them, wherever it hides. Every secret must therefore come from
// `LEAK_WORDS`, `upcomingFor` or `CLOSE_TEXT`; when F17/F18 replace `words.v0.ts` with packs and the
// deck, mock those instead. Logs are checked through `console.*`, the server's only logger; a
// logger added later must be spied on here too.
//
// SPEC-QUESTION: the v0 reducer cannot reach CHOOSING, SCOREBOARD, a pause, overlapped choosing
// (`upcoming`) or close guesses yet (F18, F20, F23, F21, F15), so those states are built by hand
// from real ones (each marked `synth`). When those features land, replace each `synth` with the
// real action (DECISIONS 33).

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GRACE_MS, GUESS_INTERVAL_MS } from '../shared/constants.js';
import type { Effect, Phase, Room, ScreenView, Turn, View, WordEntry } from '../shared/types.js';
import { generateHostToken, hashHostToken } from './hostToken.js';
import { createRoom } from './room.js';
import { InMemoryRoomStore } from './roomStore.js';
import { attachSockets } from './sockets.js';
import { SCREEN_HOST, asPlayer, secretWord, step, withPlayers } from './test/rooms.js';
import { toView, type Viewer } from './views.js';

const LEAK_WORDS = vi.hoisted(() =>
  Array.from({ length: 30 }, (_, i) => ({
    id: `leak/${i}`,
    word: `qzw${i}`,
    alt: [`qza${i}`, `qzb${i}`],
    difficulty: ((i % 3) + 1) as 1 | 2 | 3,
    lang: 'tl' as const,
    gloss: `qzg${i}`,
  })),
);
vi.mock('./words.v0.js', () => ({ V0_WORDS: LEAK_WORDS }));

const ALL_PHASES: Phase[] = ['LOBBY', 'CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD', 'FINAL'];
/** A close guess's text (a near miss of the word): Screen only, and only from REVEAL on. */
const CLOSE_TEXT = 'qzclose';

const tokens = (value: unknown): string[] => JSON.stringify(value).match(/qz[a-z0-9]+/g) ?? [];

const entrySecrets = (e: WordEntry): string[] => [e.word, ...(e.gloss ? [e.gloss] : [])];
/** What a drawer may see of their own turn: the choices until one is chosen, then only the
 * chosen word; glosses included, alternates never. */
const drawerSecrets = (turn: Turn): string[] =>
  (turn.word ? [turn.word] : turn.choices).flatMap(entrySecrets);

const revealPhase = (phase: Phase) =>
  phase === 'REVEAL' || phase === 'SCOREBOARD' || phase === 'FINAL';

/** Words anyone may see: the current word once its turn has ended, every past word in FINAL. */
function publicWords(room: Room): string[] {
  const words: string[] = [];
  if (revealPhase(room.phase) && room.turn?.word && room.turn.endReason !== null)
    words.push(room.turn.word.word);
  if (room.phase === 'FINAL') words.push(...room.history.map((h) => h.word));
  return words;
}

type Audience = { kind: 'screen' } | { kind: 'player'; pid: string } | { kind: 'all' };

/** Every `qz` token this audience may receive in `room`. Alternates are never on the list. */
function allowedFor(room: Room, who: Audience): Set<string> {
  const allowed = new Set(publicWords(room));
  const { phase, turn, upcoming } = room;
  if (who.kind === 'player') {
    if ((phase === 'CHOOSING' || phase === 'DRAWING') && turn?.drawerPid === who.pid)
      for (const s of drawerSecrets(turn)) allowed.add(s);
    if ((phase === 'REVEAL' || phase === 'SCOREBOARD') && upcoming?.drawerPid === who.pid)
      for (const s of drawerSecrets(upcoming)) allowed.add(s);
  }
  if (who.kind === 'screen' && revealPhase(phase)) allowed.add(CLOSE_TEXT);
  return allowed;
}

function expectNoLeak(value: unknown, allowed: Set<string>, label: string): void {
  const leaked = tokens(value).filter((t) => !allowed.has(t));
  expect(leaked, label).toEqual([]);
}

const VIEWERS = (room: Room): [string, Viewer, Audience][] => [
  ['screen with token', { kind: 'screen', isHost: true }, { kind: 'screen' }],
  ['screen', { kind: 'screen', isHost: false }, { kind: 'screen' }],
  ...Object.values(room.players).map((p): [string, Viewer, Audience] => {
    const roles = [
      room.turn?.drawerPid === p.pid ? 'drawer' : 'guesser',
      ...(room.crownPid === p.pid ? ['crown'] : []),
      ...(room.turn?.correct.some((c) => c.pid === p.pid) ? ['guessed'] : []),
    ];
    return [
      `${p.name} (${roles.join(', ')})`,
      { kind: 'player', pid: p.pid },
      { kind: 'player', pid: p.pid },
    ];
  }),
];

const audienceOf = (effect: Effect): Audience | null => {
  if (effect.type !== 'fx') return null;
  if (effect.to === 'screen') return { kind: 'screen' };
  if (effect.to === 'all') return { kind: 'all' };
  return { kind: 'player', pid: effect.to.pid };
};

/** The views of everyone in `room` at `now`, checked; and `effects`, checked per recipient. */
function audit(label: string, room: Room, now: number, effects: Effect[] = []): View[] {
  const views: View[] = [];
  for (const [name, viewer, who] of VIEWERS(room)) {
    const view = toView(room, viewer, now);
    expectNoLeak(view, allowedFor(room, who), `${label}: ${name}`);
    views.push(view);
  }
  for (const effect of effects) {
    // Internal effects (timers, ink open/close) reach nobody, but may be logged: public only.
    const who = audienceOf(effect) ?? { kind: 'all' };
    expectNoLeak(effect, allowedFor(room, who), `${label}: effect ${effect.type}`);
  }
  visited.add(room.phase);
  return views;
}

let visited = new Set<Phase>();

const screenView = (room: Room, now: number) => toView(room, { kind: 'screen', isHost: true }, now);
const playerView = (room: Room, pid: string, now: number) =>
  toView(room, { kind: 'player', pid }, now);

/** The word in play: tests only, to make right guesses and positive checks. */
const word = (room: Room) => secretWord(room);

/** Hand-built `upcoming` turn for `drawerPid`, dealt three fresh marked words. */
function upcomingFor(room: Room, drawerPid: string, chosen: boolean): Turn {
  const entry = (i: 1 | 2 | 3): WordEntry => ({
    id: `up/${i}`,
    word: `qzup${i}`,
    alt: [`qzupalt${i}`],
    difficulty: i,
    lang: 'tl',
    gloss: `qzupgloss${i}`,
  });
  const choices: Turn['choices'] = [entry(1), entry(2), entry(3)];
  return {
    ...room.turn!,
    id: room.turnCounter + 1,
    drawerPid,
    choices,
    word: chosen ? choices[1] : null,
    clockStart: null,
    endsAt: null,
    correct: [],
    feed: [],
    closeGuesses: [],
    closeCount: {},
    lastGuessAt: {},
    guessCount: {},
    drawerPoints: 0,
    endReason: null,
  };
}

describe('word secrecy across a scripted game', () => {
  it('no Screen, guesser or crown view gets a word, alternate, gloss or choice before REVEAL', () => {
    visited = new Set();
    let t = 1_000_000;
    const players = withPlayers(['Ana', 'Ben', 'Cy']);
    let room = players.room;
    const [ana, ben, cy] = players.pids as [string, string, string];
    const act = (label: string, action: Parameters<typeof step>[1], dt = 1000) => {
      t += dt;
      const res = step(room, action, t);
      room = res.room;
      audit(label, room, t, res.effects);
    };

    // LOBBY: Ana holds the crown.
    audit('lobby', room, t);
    expect(room.crownPid).toBe(ana);

    // Turn 1: Ana draws and holds the crown.
    act('turn 1 starts', { type: 'host:start', by: SCREEN_HOST });
    expect(room.phase).toBe('DRAWING');
    expect(room.turn!.drawerPid).toBe(ana);
    const first = word(room);
    // Positive control: the drawer does get the word and its gloss, so the check isn't vacuous.
    expect(tokens(playerView(room, ana, t))).toEqual(
      expect.arrayContaining([first, room.turn!.word!.gloss]),
    );

    // synth CHOOSING. TODO(F18): `drawer:choose` and the auto-pick instead.
    // the drawer's three choices, then the choice made and the clock not
    // yet running.
    const choosing: Room = {
      ...room,
      phase: 'CHOOSING',
      turn: { ...room.turn!, word: null, clockStart: null, endsAt: null, dealtAt: t },
    };
    audit('choosing', choosing, t + 500);
    expect(playerView(choosing, ana, t).secret!.choices).toHaveLength(3);
    audit(
      'choosing, chosen',
      { ...choosing, turn: { ...choosing.turn!, word: room.turn!.word } },
      t,
    );

    act('wrong guess', {
      type: 'player:guess',
      by: asPlayer(ben),
      text: 'payong',
      receivedAt: t + 1000,
      oneWayMs: 0,
    });
    act('right guess', {
      type: 'player:guess',
      by: asPlayer(ben),
      text: first,
      receivedAt: t + 1000,
      oneWayMs: 0,
    });
    expect(room.turn!.correct.map((c) => c.pid)).toEqual([ben]);
    expect(playerView(room, ben, t).me.turnPoints).toBeGreaterThan(0);

    // A late joiner arrives mid-turn.
    act('late join', {
      type: 'player:join',
      by: { kind: 'player', isHost: false },
      keyHash: 'key-Dee',
      name: 'Dee',
    });
    const dee = Object.values(room.players).find((p) => p.name === 'Dee')!.pid;

    // synth pause. TODO(F23): `host:pause` and `host:resume` instead.
    // a host pause, then the 3-2-1 countdown.
    const paused: Room = {
      ...room,
      paused: { reasons: ['host'], since: t, remainingMs: 30_000, resumeAt: null },
    };
    audit('paused', paused, t + 5000);
    audit('resuming', { ...paused, paused: { ...paused.paused!, resumeAt: t + 8000 } }, t + 6000);

    // synth close guess. TODO(F15): a real near-miss guess instead.
    // kept from the Screen until REVEAL, never sent to a phone.
    room = {
      ...room,
      turn: { ...room.turn!, closeGuesses: [{ pid: cy, text: CLOSE_TEXT, at: t }] },
    };
    audit('close guess', room, t);

    // Time runs out: REVEAL.
    act(
      'reveal 1',
      {
        type: 'timer',
        timer: 'drawUp',
        turnId: room.turn!.id,
        epoch: room.timerEpoch,
      },
      room.turn!.endsAt! + GRACE_MS - t,
    );
    expect(room.phase).toBe('REVEAL');
    expect(screenView(room, t).turn!.word).toBe(first);
    expect(screenView(room, t).closeGuesses).toEqual([{ pid: cy, text: CLOSE_TEXT }]);

    // synth overlapped choosing. TODO(F21): the real deal and `drawer:choose` instead.
    // Ben, next to draw, chooses during REVEAL and SCOREBOARD.
    for (const chosen of [false, true]) {
      const overlap: Room = { ...room, upcoming: upcomingFor(room, ben, chosen) };
      audit(`reveal, upcoming ${chosen ? 'chosen' : 'choosing'}`, overlap, t);
      // synth SCOREBOARD. TODO(F20): reach it by finishing a cycle.
      audit(
        `scoreboard, upcoming ${chosen ? 'chosen' : 'choosing'}`,
        {
          ...overlap,
          phase: 'SCOREBOARD',
        },
        t,
      );
      expect(tokens(playerView(overlap, ben, t))).toContain(chosen ? 'qzup2' : 'qzup3');
    }

    // Turn 2: Ben draws; Ana, still crowned, guesses right.
    act('turn 2 starts', { type: 'host:next', by: SCREEN_HOST });
    expect(room.turn!.drawerPid).toBe(ben);
    expect(room.crownPid).toBe(ana);
    act('crown guesses right', {
      type: 'player:guess',
      by: asPlayer(ana, true),
      text: word(room),
      receivedAt: t,
      oneWayMs: 0,
    });
    act('late joiner guesses wrong', {
      type: 'player:guess',
      by: asPlayer(dee),
      text: 'bahay',
      receivedAt: t,
      oneWayMs: 0,
    });

    // Ana leaves: the crown passes to Ben (the drawer now, a guesser next turn).
    act('crown leaves', { type: 'player:leave', by: asPlayer(ana, true) });
    expect(room.crownPid).toBe(ben);
    act('reveal 2', { type: 'host:skip', by: SCREEN_HOST });

    // Turn 3: Cy draws; Ben guesses right with the crown.
    act('turn 3 starts', { type: 'host:next', by: SCREEN_HOST });
    expect(room.turn!.drawerPid).toBe(cy);
    act('crown guesses right', {
      type: 'player:guess',
      by: asPlayer(ben, true),
      text: word(room),
      receivedAt: t,
      oneWayMs: 0,
    });
    act('reveal 3', { type: 'host:skip', by: SCREEN_HOST });

    // Dee joined after the order was set (v0), so the game ends.
    act('final', { type: 'host:next', by: SCREEN_HOST });
    expect(room.phase).toBe('FINAL');
    expect(screenView(room, t).gallery.map((g) => g.word)).toEqual(room.history.map((h) => h.word));

    expect([...visited].sort()).toEqual([...ALL_PHASES].sort());
  });

  it('never sends alternates, even to the drawer, at the reveal or in FINAL', () => {
    let { room } = withPlayers(['Ana', 'Ben']);
    let t = 2_000_000;
    room = step(room, { type: 'host:start', by: SCREEN_HOST }, t).room;
    const alts = room.turn!.word!.alt;
    expect(alts.length).toBeGreaterThan(0);
    for (const action of ['host:skip', 'host:next', 'host:skip', 'host:next'] as const) {
      t += 1000;
      room = step(room, { type: action, by: SCREEN_HOST }, t).room;
      for (const [name, viewer] of VIEWERS(room)) {
        const found = tokens(toView(room, viewer, t)).filter((tok) => /^qz[ab]\d/.test(tok));
        expect(found, `${room.phase}: ${name}`).toEqual([]);
      }
    }
    expect(room.phase).toBe('FINAL');
  });
});

// A close guess is held back from the feed and fx (F14, DECISIONS 37): only its phone hears it.
it('keeps a near miss of the word off the Screen until REVEAL', () => {
  const { room: lobby, pids } = withPlayers(['Ana', 'Ben']);
  let room = step(lobby, { type: 'host:start', by: SCREEN_HOST }, 2_000_000).room;
  const res = step(
    room,
    {
      type: 'player:guess',
      by: asPlayer(pids[1]!),
      text: `${word(room)}x`,
      receivedAt: 2_001_000,
      oneWayMs: 0,
    },
    2_001_000,
  );
  room = res.room;
  audit('near miss', room, 2_001_000, res.effects);
});

// ---------- Through the socket gateway ----------

const CODE = 'ABCD';

interface Client {
  name: string;
  socket: ClientSocket;
  /** Everything received: events in order, and the payload of every ack. */
  received: unknown[];
  emit(event: string, payload?: unknown): Promise<unknown>;
}

let server: Server | undefined;
let clients: Client[] = [];

afterEach(async () => {
  for (const c of clients) c.socket.disconnect();
  clients = [];
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
  vi.restoreAllMocks();
});

/** A store that can be told to throw once, to drive the gateway's logged failure path. */
class FlakyRoomStore extends InMemoryRoomStore {
  failNextSet = false;
  override set(room: Room): void {
    if (this.failNextSet) {
      this.failNextSet = false;
      throw new Error('store unavailable');
    }
    super.set(room);
  }
}

async function gateway() {
  const rooms = new FlakyRoomStore();
  const hostToken = generateHostToken();
  rooms.set(createRoom({ code: CODE, hostTokenHash: hashHostToken(hostToken), now: 0, seed: 11 }));
  const mono = { now: 10_000 };
  server = createServer();
  attachSockets(server, {
    rooms,
    clock: () => 1_800_000_000_000,
    monotonic: () => mono.now,
    // Timers never fire on their own: the test moves turns on with host actions.
    scheduler: () => () => {},
  });
  server.listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  async function connect(name: string): Promise<Client> {
    const socket = connectClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    const received: unknown[] = [];
    socket.onAny((event: string, payload: unknown) => received.push([event, payload]));
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    const client: Client = {
      name,
      socket,
      received,
      emit: async (event, payload = {}) => {
        const ack: unknown = await socket.timeout(2000).emitWithAck(event, payload);
        received.push(['ack', event, ack]);
        return ack;
      },
    };
    clients.push(client);
    return client;
  }

  return { rooms, hostToken, mono, connect };
}

describe('word secrecy through the socket gateway', () => {
  it('no state, fx, ack or log line reaches a Screen or guesser with a secret before REVEAL', async () => {
    const logged: unknown[] = [];
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const)
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void logged.push(args));

    const g = await gateway();
    const room = () => g.rooms.get(CODE)!;
    const screen = await g.connect('screen with token');
    expect(await screen.emit('screen:join', { code: CODE, hostToken: g.hostToken })).toEqual({
      ok: true,
    });
    const plain = await g.connect('screen');
    expect(await plain.emit('screen:join', { code: CODE })).toEqual({ ok: true });

    const players = new Map<Client, string>();
    async function join(name: string, letter: string) {
      const c = await g.connect(name);
      const ack = (await c.emit('player:join', {
        code: CODE,
        playerKey: letter.repeat(21),
        name,
      })) as { ok: boolean; pid: string };
      expect(ack.ok).toBe(true);
      players.set(c, ack.pid);
      return c;
    }
    const ana = await join('Ana', 'a');
    const ben = await join('Ben', 'b');
    const cy = await join('Cy', 'c');

    // What each socket has had checked so far.
    const seen = new Map<Client, number>();
    let logsSeen = 0;
    /** A `ping` round trip on every socket flushes what the server sent it, then everything new is
     * checked against what that socket may see in the room as it is now. That holds only because
     * it runs after every single action: never batch actions between checkpoints. */
    async function checkpoint(label: string) {
      for (const c of clients) await c.emit('ping', { t: 0 });
      const r = room();
      visited.add(r.phase);
      for (const c of clients) {
        const pid = players.get(c);
        const who: Audience = pid ? { kind: 'player', pid } : { kind: 'screen' };
        const fresh = c.received.slice(seen.get(c) ?? 0);
        seen.set(c, c.received.length);
        expectNoLeak(fresh, allowedFor(r, who), `${label}: ${c.name}`);
      }
      expectNoLeak(logged.slice(logsSeen), allowedFor(r, { kind: 'all' }), `${label}: console`);
      logsSeen = logged.length;
    }
    const lastState = (c: Client) =>
      (c.received.filter((e) => Array.isArray(e) && e[0] === 'state').at(-1) as [string, View])[1];

    visited = new Set();
    await checkpoint('lobby');

    for (const [n, drawer] of [ana, ben, cy].entries()) {
      expect(await screen.emit(n === 0 ? 'host:start' : 'host:next')).toEqual({ ok: true });
      expect(room().turn!.drawerPid).toBe(players.get(drawer));
      await checkpoint(`turn ${n + 1} starts`);
      // Positive control: the drawer's socket did get the word.
      expect(tokens(lastState(drawer))).toContain(word(room()));

      const guessers = [ana, ben, cy].filter((c) => c !== drawer);
      expect(await guessers[0]!.emit('player:guess', { text: 'payong' })).toEqual({ ok: true });
      await checkpoint(`turn ${n + 1} wrong guess`);
      // A near miss: only its own phone hears about it until REVEAL.
      const near = `${word(room())} ko`;
      expect(await guessers[1]!.emit('player:guess', { text: near })).toEqual({ ok: true });
      await checkpoint(`turn ${n + 1} near miss`);
      // Past the 700 ms limit before this guesser's next guess.
      g.mono.now += GUESS_INTERVAL_MS;
      if (n === 0) {
        // The right guess fails inside the gateway once: it is logged, without the guess.
        g.rooms.failNextSet = true;
        expect(await guessers[0]!.emit('player:guess', { text: word(room()) })).toEqual({
          ok: false,
          error: 'serverError',
        });
        expect(logged.length).toBeGreaterThan(logsSeen);
        await checkpoint('failed guess, logged');
      }
      expect(await guessers[0]!.emit('player:guess', { text: word(room()) })).toEqual({ ok: true });
      await checkpoint(`turn ${n + 1} right guess`);
      // Refused guesses of the word: the drawer, a repeat, and one too long to be a guess. Their
      // acks are checked like everything else.
      expect(await drawer.emit('player:guess', { text: word(room()) })).toEqual({
        ok: false,
        error: 'drawerCannotGuess',
      });
      expect(await guessers[0]!.emit('player:guess', { text: word(room()) })).toEqual({
        ok: false,
        error: 'alreadyGuessed',
      });
      expect(
        await guessers[1]!.emit('player:guess', { text: word(room()).padEnd(41, 'z') }),
      ).toEqual({ ok: false, error: 'invalidPayload' });
      await checkpoint(`turn ${n + 1} refused guesses`);
      expect(
        lastState(guessers[0]!).players.find((p) => p.pid === players.get(guessers[0]!))!.guessed,
      ).toBe(true);

      if (n === 0) {
        await join('Dee', 'd');
        await checkpoint('late join');
      }
      expect(await screen.emit('host:skip')).toEqual({ ok: true });
      await checkpoint(`reveal ${n + 1}`);
      expect(lastState(plain).turn!.word).toBe(word(room()));
      expect((lastState(plain) as ScreenView).closeGuesses).toEqual([
        { pid: players.get(guessers[1]!), text: near },
      ]);
      expect(await guessers[1]!.emit('player:guess', { text: word(room()) })).toEqual({
        ok: false,
        error: 'wrongPhase',
      });
      await checkpoint(`reveal ${n + 1} late guess`);
    }
    expect(await screen.emit('host:next')).toEqual({ ok: true });
    await checkpoint('final');
    expect(room().phase).toBe('FINAL');
    expect([...visited]).toEqual(['LOBBY', 'DRAWING', 'REVEAL', 'FINAL']);
  });
});
