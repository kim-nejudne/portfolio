import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DOODLE_MAX_BYTES,
  INK_BATCH_RATE_LIMIT,
  INK_GET_RATE_LIMIT,
  INK_HELLO_RATE_LIMIT,
  INK_INVALID_BATCHES_MAX,
  INK_TURN_HARD_MAX_BYTES,
} from '../shared/constants.js';
import {
  applyInkOps,
  createInkStack,
  pushStroke,
  stackOps,
  visibleStrokes,
} from '../shared/ink.js';
import type { Ack, InkBatch, InkOp, InkSnapshot, View } from '../shared/types.js';
import { generateHostToken, hashHostToken } from './hostToken.js';
import { createDrawerSync, mergeSnapshot } from '../client/src/ink/drawerSync.js';
import { createInkSender } from '../client/src/ink/inkSender.js';
import { attachInkGateway } from './inkGateway.js';
import { createInkStore, type InkStore } from './inkStore.js';
import { createRoom } from './room.js';
import { TEST_PACKS } from './test/packs.js';
import { InMemoryRoomStore } from './roomStore.js';
import { attachSockets } from './sockets.js';

const CODE = 'ABCD';
const KEY_ANA = 'a'.repeat(21);
const KEY_BEN = 'b'.repeat(21);

interface Client {
  socket: ClientSocket;
  /** Every event this socket received, in order, on its namespace. */
  events: [string, unknown][];
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

async function setup(store?: InkStore) {
  const rooms = new InMemoryRoomStore();
  const hostToken = generateHostToken();
  rooms.set(
    createRoom({
      code: CODE,
      hostTokenHash: hashHostToken(hostToken),
      now: 0,
      seed: 7,
      packs: TEST_PACKS,
    }),
  );
  const mono = { now: 10_000 };
  server = createServer();
  // `io` needs the ink effects handler and the gateway needs `io`, as in `server/index.ts`.
  let onInk: ReturnType<typeof attachInkGateway>['onInk'] = () => {};
  const { io, dispatch } = attachSockets(server, {
    rooms,
    clock: () => 1_800_000_000_000,
    monotonic: () => mono.now,
    // Timers never fire on their own: the tests move turns on with host actions.
    scheduler: () => () => {},
    onInk: (code, effect) => onInk(code, effect),
  });
  const gateway = attachInkGateway(io, { rooms, dispatch, monotonic: () => mono.now, store });
  onInk = gateway.onInk;
  server.listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  async function connect(path: '' | '/ink', auth?: object): Promise<Client> {
    const socket = connectClient(`http://127.0.0.1:${port}${path}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      ...(auth ? { auth } : {}),
    });
    sockets.push(socket);
    const events: [string, unknown][] = [];
    socket.onAny((event: string, payload: unknown) => events.push([event, payload]));
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    return {
      socket,
      events,
      emit: <T extends object>(event: string, payload: unknown = {}) =>
        socket.timeout(2000).emitWithAck(event, payload) as Promise<Ack<T>>,
    };
  }

  return { rooms, hostToken, mono, connect, gateway };
}

type Setup = Awaited<ReturnType<typeof setup>>;

type Phone = Awaited<ReturnType<typeof joinPlayer>>;

async function joinPlayer(s: Setup, playerKey: string, name: string) {
  const main = await s.connect('');
  const ack = await main.emit<{ pid: string }>('player:join', { code: CODE, playerKey, name });
  if (!ack.ok) throw new Error(`join failed: ${ack.error}`);
  const ink = await s.connect('/ink', { code: CODE, playerKey });
  return { main, ink, pid: ack.pid };
}

/**
 * `host:start` or `host:next`; then, if that dealt a turn, its drawer takes the first word, so the
 * room is in DRAWING. `phones` are the players who may be dealt.
 */
async function startTurn(
  l: { screen: Client; rooms: InMemoryRoomStore; ana: Phone; ben: Phone },
  event: 'host:start' | 'host:next',
  phones: Phone[] = [l.ana, l.ben],
) {
  expect(await l.screen.emit(event)).toEqual({ ok: true });
  const room = l.rooms.get(CODE)!;
  if (room.phase !== 'CHOOSING') return;
  const drawer = phones.find((p) => p.pid === room.turn!.drawerPid)!;
  expect(await drawer.main.emit('drawer:choose', { index: 0 })).toEqual({ ok: true });
}

/** A token Screen (main and `/ink`), Ana (crown, first drawer) and Ben, both with `/ink` sockets. */
async function lobby(store?: InkStore) {
  const s = await setup(store);
  const screen = await s.connect('');
  expect(await screen.emit('screen:join', { code: CODE, hostToken: s.hostToken })).toEqual({
    ok: true,
  });
  const screenInk = await s.connect('/ink');
  expect(await screenInk.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
  const ana = await joinPlayer(s, KEY_ANA, 'Ana');
  const ben = await joinPlayer(s, KEY_BEN, 'Ben');
  return { ...s, screen, screenInk, ana, ben };
}

async function drawing(store?: InkStore) {
  const l = await lobby(store);
  await startTurn(l, 'host:start');
  const turn = l.rooms.get(CODE)!.turn!;
  expect(turn.drawerPid).toBe(l.ana.pid);
  return { ...l, turnId: turn.id };
}

const stroke = (turnId: number, seq: number): InkBatch => [
  turnId,
  seq,
  [
    ['b', 1, 0, 1, 412, 300],
    ['p', 1, 4, -1, 6, -2, 5, 0],
    ['e', 1],
  ],
];

/** The ops that rebuild the stack these batches build, as a snapshot carries them. */
const stackOpsOf = (batches: InkBatch[]) => {
  const stack = createInkStack();
  for (const b of batches) applyInkOps(stack, b[2]);
  return stackOps(stack);
};

const inkEvents = (c: Client) => c.events.filter(([e]) => e.startsWith('ink:'));

describe('/ink relay', () => {
  it("relays the drawer's batch, unchanged, to the room's Screens", async () => {
    const d = await drawing();
    const batch = stroke(d.turnId, 1);
    expect(await d.ana.ink.emit('ink:batch', batch)).toEqual({ ok: true });
    await expect.poll(() => inkEvents(d.screenInk)).toContainEqual(['ink:batch', batch]);
  });

  it("relays a ?debug=1 batch with the drawer's send time on it (F16)", async () => {
    const d = await drawing();
    const [turnId, seq, ops] = stroke(d.turnId, 1);
    const batch: InkBatch = [turnId, seq, ops, 1_800_000_000_042];
    expect(await d.ana.ink.emit('ink:batch', batch)).toEqual({ ok: true });
    await expect.poll(() => inkEvents(d.screenInk)).toContainEqual(['ink:batch', batch]);
  });

  it("applies each relayed batch to the turn's action stack, the same one the Screen rebuilds", async () => {
    const d = await drawing();
    const batches: InkBatch[] = [
      stroke(d.turnId, 1),
      [
        d.turnId,
        2,
        [
          ['b', 2, 3, 2, 1020, 5],
          ['p', 2, 10, -10, -5, 2],
          ['e', 2],
        ],
      ],
      [d.turnId, 3, [['c']]],
      [
        d.turnId,
        4,
        [
          ['b', 3, 1, 0, 50, 50],
          ['e', 3],
        ],
      ],
      [d.turnId, 5, [['u'], ['u']]],
    ];
    for (const b of batches) expect(await d.ana.ink.emit('ink:batch', b)).toEqual({ ok: true });
    // A guesser's batch is refused and never reaches the stack.
    expect(await d.ben.ink.emit('ink:batch', [d.turnId, 1, [['c']]])).toEqual({
      ok: false,
      error: 'notDrawer',
    });
    await expect
      .poll(() => inkEvents(d.screenInk).filter(([e]) => e === 'ink:batch').length)
      .toBe(batches.length);

    const server = d.gateway.turnInk(CODE)!;
    expect(server.turnId).toBe(d.turnId);
    // Undoing stroke 3 and then the clear brings strokes 1 and 2 back; stroke 2's points are
    // clamped to the grid.
    expect(visibleStrokes(server.stack).map((st) => [st.id, st.points])).toEqual([
      [1, [412, 300, 416, 299, 422, 297, 427, 297]],
      [2, [1020, 5, 1023, 0, 1018, 2]],
    ]);
    const screen = createInkStack();
    for (const [e, b] of inkEvents(d.screenInk))
      if (e === 'ink:batch') applyInkOps(screen, (b as InkBatch)[2]);
    expect(screen.actions).toEqual(server.stack.actions);

    // The next turn starts an empty stack; an expired room's ink is dropped.
    expect(await d.screen.emit('host:skip')).toEqual({ ok: true });
    await startTurn(d, 'host:next');
    const next = d.rooms.get(CODE)!.turn!.id;
    expect(d.gateway.turnInk(CODE)).toMatchObject({
      turnId: next,
      lastSeq: 0,
      stack: createInkStack(),
      bytes: 0,
    });
    d.gateway.forget(CODE);
    expect(d.gateway.turnInk(CODE)).toBeUndefined();
  });

  it('sends ink:turn to Screens when a turn opens, so they clear', async () => {
    const l = await lobby();
    await startTurn(l, 'host:start');
    const firstTurn = l.rooms.get(CODE)!.turn!.id;
    await expect.poll(() => inkEvents(l.screenInk)).toEqual([['ink:turn', { turnId: firstTurn }]]);

    // Skip to REVEAL, then on to Ben's turn.
    expect(await l.screen.emit('host:skip')).toEqual({ ok: true });
    await startTurn(l, 'host:next');
    const secondTurn = l.rooms.get(CODE)!.turn!.id;
    expect(secondTurn).not.toBe(firstTurn);
    await expect
      .poll(() => inkEvents(l.screenInk))
      .toEqual([
        ['ink:turn', { turnId: firstTurn }],
        ['ink:turn', { turnId: secondTurn }],
      ]);
  });

  it("a guesser socket gets no /ink event; the drawer gets only its own turn's snapshot", async () => {
    const d = await drawing();
    // A guesser's hello must not put it among the Screens.
    expect(await d.ben.ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    expect(await d.ana.ink.emit('ink:batch', stroke(d.turnId, 1))).toEqual({ ok: true });
    expect(await d.ana.ink.emit('ink:batch', stroke(d.turnId, 2))).toEqual({ ok: true });
    await expect.poll(() => inkEvents(d.screenInk).length).toBe(3); // ink:turn + 2 batches

    // A round trip on each socket after the relays: anything sent to them would be here by now.
    await d.ben.ink.emit('ink:hello', { code: CODE });
    await d.ana.ink.emit('ink:hello', { code: CODE });
    expect(d.ben.ink.events).toEqual([]);
    // The drawer's hello (after a reload) brings back its own drawing, and nothing else.
    expect(d.ana.ink.events).toEqual([['ink:snapshot', d.gateway.store.snapshot(CODE)]]);
    expect(d.ana.ink.events[0]![1]).toMatchObject({ turnId: d.turnId, seq: 2 });
    // Nor does ink leak into the main namespace.
    for (const c of [d.screen, d.ana.main, d.ben.main]) expect(inkEvents(c)).toEqual([]);
  });

  it("across a whole game, only the Screens get ink: no guesser, crowned guesser or late joiner, and the drawer only its own turn's snapshot", async () => {
    const l = await lobby();
    // A one-cycle game, so it ends after the three turns.
    const before = l.rooms.get(CODE)!;
    l.rooms.set({ ...before, settings: { ...before.settings, cycles: 1 } });
    const plainScreen = await l.connect('');
    expect(await plainScreen.emit('screen:join', { code: CODE })).toEqual({ ok: true });
    const plainScreenInk = await l.connect('/ink');
    expect(await plainScreenInk.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    const cy = await joinPlayer(l, 'c'.repeat(21), 'Cy');
    const phones: Record<string, Phone> = { ana: l.ana, ben: l.ben, cy };
    // Every phone also says hello, as a Screen would; it must still not be counted as one.
    for (const p of Object.values(phones))
      expect(await p.ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });

    const sent: InkBatch[] = [];
    // What each phone's `/ink` socket may receive: its own drawing, while it is drawing it.
    const allowed = new Map<string, unknown[]>();
    // Dee joins during turn 1 with turns left, so they are appended and draw turn 4 (F23).
    for (const [n, name] of (['ana', 'ben', 'cy', 'dee'] as const).entries()) {
      await startTurn(l, n === 0 ? 'host:start' : 'host:next', Object.values(phones));
      const room = l.rooms.get(CODE)!;
      expect(room.turn!.drawerPid).toBe(phones[name]!.pid);
      // Ana keeps the crown throughout, so turns 2 to 4 have a crowned guesser.
      expect(room.crownPid).toBe(l.ana.pid);
      for (const seq of [1, 2]) {
        const batch = stroke(room.turn!.id, seq);
        expect(await phones[name]!.ink.emit('ink:batch', batch)).toEqual({ ok: true });
        sent.push(batch);
      }
      if (n === 0) {
        phones.dee = await joinPlayer(l, 'd'.repeat(21), 'Dee');
        expect(await phones.dee.ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
      }
      // Everyone says hello mid-turn, as after a reload: only the drawer gets a snapshot.
      for (const p of Object.values(phones))
        expect(await p.ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
      allowed.set(phones[name]!.pid, [
        ...(allowed.get(phones[name]!.pid) ?? []),
        ['ink:snapshot', { turnId: room.turn!.id, seq: 2, actions: stackOpsOf(sent.slice(-2)) }],
      ]);
      expect(await l.screen.emit('host:skip')).toEqual({ ok: true });
    }
    await startTurn(l, 'host:next');
    expect(l.rooms.get(CODE)!.phase).toBe('FINAL');

    for (const screenInk of [l.screenInk, plainScreenInk]) {
      await expect
        .poll(() => inkEvents(screenInk).filter(([e]) => e === 'ink:batch'))
        .toEqual(sent.map((b) => ['ink:batch', b]));
    }
    const phoneSockets = Object.values(phones);
    // A round trip on each phone socket after the relays: anything sent to it would be here now.
    for (const p of phoneSockets) await p.ink.emit('ink:hello', { code: CODE });
    // The main namespace carries only views and fx: no ink under any event name.
    const mainEventNames = (c: Client) => new Set(c.events.map(([e]) => e));
    for (const p of phoneSockets) {
      expect(p.ink.events).toEqual(allowed.get(p.pid) ?? []);
      expect([...mainEventNames(p.main)].sort()).toEqual(['fx', 'state']);
    }
    for (const c of [l.screen, plainScreen])
      expect([...mainEventNames(c)].every((e) => e === 'state' || e === 'fx')).toBe(true);
  });

  it('drops a batch from a guesser', async () => {
    const d = await drawing();
    expect(await d.ben.ink.emit('ink:batch', stroke(d.turnId, 1))).toEqual({
      ok: false,
      error: 'notDrawer',
    });
    expect(inkEvents(d.screenInk).map(([e]) => e)).toEqual(['ink:turn']);
  });

  it('drops a batch from a Screen socket, or a socket that never said who it is', async () => {
    const d = await drawing();
    expect(await d.screenInk.emit('ink:batch', stroke(d.turnId, 1))).toEqual({
      ok: false,
      error: 'notDrawer',
    });
    const stranger = await d.connect('/ink');
    expect(await stranger.emit('ink:batch', stroke(d.turnId, 1))).toEqual({
      ok: false,
      error: 'notJoined',
    });
    expect(inkEvents(d.screenInk).map(([e]) => e)).toEqual(['ink:turn']);
  });

  it('drops a batch for an old turnId', async () => {
    const l = await lobby();
    await startTurn(l, 'host:start');
    const oldTurn = l.rooms.get(CODE)!.turn!.id;
    expect(await l.screen.emit('host:skip')).toEqual({ ok: true });
    await startTurn(l, 'host:next');
    const room = l.rooms.get(CODE)!;
    expect(room.phase).toBe('DRAWING');
    // Ben draws now; a batch tagged with Ana's finished turn is stale even from the new drawer.
    expect(room.turn!.drawerPid).toBe(l.ben.pid);
    expect(await l.ben.ink.emit('ink:batch', stroke(oldTurn, 1))).toEqual({
      ok: false,
      error: 'staleTurn',
    });
    expect(await l.ben.ink.emit('ink:batch', stroke(room.turn!.id, 1))).toEqual({ ok: true });
    await expect
      .poll(() => inkEvents(l.screenInk).filter(([e]) => e === 'ink:batch'))
      .toEqual([['ink:batch', stroke(room.turn!.id, 1)]]);
  });

  it('drops a batch outside DRAWING: in the lobby and in REVEAL', async () => {
    const l = await lobby();
    expect(await l.ana.ink.emit('ink:batch', stroke(1, 1))).toEqual({
      ok: false,
      error: 'wrongPhase',
    });
    await startTurn(l, 'host:start');
    const turnId = l.rooms.get(CODE)!.turn!.id;
    expect(await l.screen.emit('host:skip')).toEqual({ ok: true });
    expect(l.rooms.get(CODE)!.phase).toBe('REVEAL');
    expect(await l.ana.ink.emit('ink:batch', stroke(turnId, 1))).toEqual({
      ok: false,
      error: 'wrongPhase',
    });
    expect(inkEvents(l.screenInk).map(([e]) => e)).toEqual(['ink:turn']);
  });

  it('drops a batch while the room is paused', async () => {
    const d = await drawing();
    const room = d.rooms.get(CODE)!;
    d.rooms.set({
      ...room,
      paused: { reasons: ['host'], since: 0, remainingMs: 30_000, resumeAt: null },
    });
    expect(await d.ana.ink.emit('ink:batch', stroke(d.turnId, 1))).toEqual({
      ok: false,
      error: 'paused',
    });
    expect(inkEvents(d.screenInk).map(([e]) => e)).toEqual(['ink:turn']);
  });

  it(`drops batches past ${INK_BATCH_RATE_LIMIT.max} per second from one socket`, async () => {
    const d = await drawing();
    for (let seq = 1; seq <= INK_BATCH_RATE_LIMIT.max; seq++) {
      expect(await d.ana.ink.emit('ink:batch', stroke(d.turnId, seq))).toEqual({ ok: true });
    }
    expect(await d.ana.ink.emit('ink:batch', stroke(d.turnId, 41))).toEqual({
      ok: false,
      error: 'rateLimited',
    });
    expect(inkEvents(d.screenInk)).not.toContainEqual(['ink:batch', stroke(d.turnId, 41)]);
    // A refused batch doesn't take its `seq`: sent again after the window, it is the next one.
    d.mono.now += INK_BATCH_RATE_LIMIT.windowMs;
    expect(await d.ana.ink.emit('ink:batch', stroke(d.turnId, 41))).toEqual({ ok: true });
    await expect
      .poll(() => inkEvents(d.screenInk).filter(([e]) => e === 'ink:batch').length)
      .toBe(INK_BATCH_RATE_LIMIT.max + 1);
  });

  it("shares the batch limit across all of the drawer's /ink sockets", async () => {
    const d = await drawing();
    const second = await d.connect('/ink', { code: CODE, playerKey: KEY_ANA });
    for (let seq = 1; seq <= INK_BATCH_RATE_LIMIT.max; seq++) {
      const socket = seq % 2 ? d.ana.ink : second;
      expect(await socket.emit('ink:batch', stroke(d.turnId, seq))).toEqual({ ok: true });
    }
    expect(await second.emit('ink:batch', stroke(d.turnId, 41))).toEqual({
      ok: false,
      error: 'rateLimited',
    });
  });

  it(`stops the stack at ${INK_TURN_HARD_MAX_BYTES / 1024} KB: further clears are refused, undo still works, the Screens keep the same stack`, async () => {
    // Without the action cap, so the byte bound is the one that stops it.
    const d = await drawing(createInkStore({ maxActions: Infinity }));
    // About 4 KB of clears per batch: the cheapest way to grow the stack.
    const clears = Array.from({ length: 680 }, () => ['c'] as InkBatch[2][number]);
    let seq = 0;
    let refused: unknown;
    while (seq < 200) {
      if (seq % INK_BATCH_RATE_LIMIT.max === 0) d.mono.now += 1000;
      const ack = await d.ana.ink.emit('ink:batch', [d.turnId, ++seq, clears]);
      if (!ack.ok) {
        refused = ack;
        break;
      }
    }
    expect(refused).toEqual({ ok: false, error: 'inkFull' });
    const turn = d.gateway.turnInk(CODE)!;
    expect(turn.bytes).toBeLessThanOrEqual(INK_TURN_HARD_MAX_BYTES);
    const atCap = turn.stack.actions.length;
    expect(atCap).toBe(INK_TURN_HARD_MAX_BYTES / 5);
    // Still refused afterwards (the batch's seq is taken, with nothing applied)…
    expect(await d.ana.ink.emit('ink:batch', [d.turnId, ++seq, clears])).toEqual({
      ok: false,
      error: 'inkFull',
    });
    expect(turn.stack.actions).toHaveLength(atCap);
    // …but undo still applies.
    expect(await d.ana.ink.emit('ink:batch', [d.turnId, ++seq, [['u'], ['u']]])).toEqual({
      ok: true,
    });
    expect(turn.stack.actions).toHaveLength(atCap - 2);
    // Every relayed batch arrived, in seq order, and rebuilds the server's stack.
    await expect
      .poll(() => inkEvents(d.screenInk).filter(([e]) => e === 'ink:batch').length)
      .toBe(seq);
    const relayed = inkEvents(d.screenInk)
      .filter(([e]) => e === 'ink:batch')
      .map(([, b]) => b as InkBatch);
    expect(relayed.map((b) => b[1])).toEqual(Array.from({ length: seq }, (_, i) => i + 1));
    const screen = createInkStack();
    for (const b of relayed) applyInkOps(screen, b[2]);
    expect(screen.actions).toEqual(turn.stack.actions);
  });

  it('drops a malformed batch without relaying or echoing it', async () => {
    const d = await drawing();
    const offGrid = [d.turnId, 1, [['b', 1, 0, 1, 5000, 300]]];
    expect(await d.ana.ink.emit('ink:batch', offGrid)).toEqual({
      ok: false,
      error: 'invalidPayload',
    });
    expect(inkEvents(d.screenInk).map(([e]) => e)).toEqual(['ink:turn']);
  });

  it("does not relay to another room's Screens", async () => {
    const d = await drawing();
    d.rooms.set(
      createRoom({
        code: 'WXYZ',
        hostTokenHash: hashHostToken(generateHostToken()),
        now: 0,
        packs: TEST_PACKS,
      }),
    );
    const otherScreen = await d.connect('/ink');
    expect(await otherScreen.emit('ink:hello', { code: 'WXYZ' })).toEqual({ ok: true });
    expect(await d.ana.ink.emit('ink:batch', stroke(d.turnId, 1))).toEqual({ ok: true });
    await expect.poll(() => inkEvents(d.screenInk).length).toBe(2);
    await otherScreen.emit('ink:hello', { code: 'WXYZ' });
    expect(otherScreen.events).toEqual([]);
  });
});

describe('/ink handshake and hello', () => {
  it('refuses a phone whose playerKey is not in the room, or a malformed handshake', async () => {
    const l = await lobby();
    await expect(
      l.connect('/ink', { code: CODE, playerKey: 'z'.repeat(21) }),
    ).rejects.toMatchObject({ message: 'notPlayer' });
    await expect(l.connect('/ink', { code: 'WXYZ', playerKey: KEY_ANA })).rejects.toMatchObject({
      message: 'roomNotFound',
    });
    await expect(l.connect('/ink', { code: CODE })).rejects.toMatchObject({
      message: 'invalidPayload',
    });
  });

  it('refuses a hello for an unknown room, or for a second room', async () => {
    const l = await lobby();
    const screen = await l.connect('/ink');
    expect(await screen.emit('ink:hello', { code: 'WXYZ' })).toEqual({
      ok: false,
      error: 'roomNotFound',
    });
    expect(await l.screenInk.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    l.rooms.set(
      createRoom({
        code: 'WXYZ',
        hostTokenHash: hashHostToken(generateHostToken()),
        now: 0,
        packs: TEST_PACKS,
      }),
    );
    expect(await l.screenInk.emit('ink:hello', { code: 'WXYZ' })).toEqual({
      ok: false,
      error: 'alreadyJoined',
    });
    expect(await l.ana.ink.emit('ink:hello', { code: 'WXYZ' })).toEqual({
      ok: false,
      error: 'alreadyJoined',
    });
  });

  it('keeps the main namespace unaffected: states still flow to the main sockets', async () => {
    const d = await drawing();
    expect(d.screen.events.some(([e, v]) => e === 'state' && (v as View).phase === 'DRAWING')).toBe(
      true,
    );
  });
});

/** A Screen's picture from the events it received: the snapshot, then batches after its `seq`. */
function screenPicture(c: Client) {
  const stack = createInkStack();
  let seq = 0;
  for (const [event, payload] of inkEvents(c)) {
    if (event === 'ink:snapshot') {
      const snap = payload as InkSnapshot;
      stack.actions = [];
      stack.byId.clear();
      applyInkOps(stack, snap.actions);
      seq = snap.seq;
    } else if (event === 'ink:batch') {
      const [, bseq, ops] = payload as InkBatch;
      if (bseq !== seq + 1) throw new Error(`seq ${bseq} after ${seq}`);
      applyInkOps(stack, ops);
      seq = bseq;
    }
  }
  return { stack, seq };
}

/** The phone's drawer code (`inkSender` + `drawerSync`, as `DrawPad` and `Play` wire them). */
function wireDrawer(c: Client, turnId: number) {
  const pad = createInkStack();
  const sender = createInkSender({
    turnId,
    held: true,
    send: (b) => void (c.socket.connected && c.socket.emit('ink:batch', b)),
  });
  const sync = createDrawerSync({
    code: CODE,
    turnId,
    sender,
    emit: (event, payload) => void c.socket.emit(event, payload),
    onSnapshot: (snapshot, offset) => mergeSnapshot(pad, snapshot.actions, offset),
  });
  c.socket.on('ink:snapshot', (snap: InkSnapshot) => sync.snapshot(snap));
  c.socket.on('ink:state', (p: { turnId: number; lastSeq: number }) => sync.state(p));
  c.socket.on('ink:resend', (p: { turnId: number; from: number }) => sync.resend(p));
  sync.connected();
  const draw = (x: number) => {
    const id = sender.begin(0, 1, x, 100);
    const stroke = pushStroke(pad, id, 0, 1, x, 100);
    for (const dx of [10, 20, 30]) {
      stroke.points.push(x + dx, 100 + dx);
      sender.move(x + dx, 100 + dx);
    }
    stroke.ended = true;
    sender.end();
  };
  return { pad, sender, draw };
}

/** A numbered stroke at its own place, so a duplicate would show as an extra action. */
const strokeN = (turnId: number, seq: number, id: number): InkBatch => [
  turnId,
  seq,
  [
    ['b', id, id % 8, 1, 10 * id, 20 * id],
    ['p', id, 5, 5, 5, -3],
    ['e', id],
  ],
];

describe('/ink sequence, snapshots and resends', () => {
  it("a drawer reloading mid-turn continues its own drawing: the phone's real sender and sync, end to end", async () => {
    const d = await drawing();
    const before = wireDrawer(d.ana.ink, d.turnId);
    await expect.poll(() => before.sender.started()).toBe(true);
    before.draw(100);
    before.draw(200);
    await expect.poll(() => d.gateway.turnInk(CODE)!.lastSeq).toBe(2);

    // The page reloads: the old socket and sender are gone; a new pad starts held.
    d.ana.ink.socket.disconnect();
    before.sender.dispose();
    const again = await d.connect('/ink', { code: CODE, playerKey: KEY_ANA });
    const after = wireDrawer(again, d.turnId);
    // The finger lands before the snapshot is back.
    after.draw(300);
    await expect.poll(() => after.sender.started()).toBe(true);
    after.draw(400);
    await expect.poll(() => d.gateway.turnInk(CODE)!.lastSeq).toBe(4);

    const server = d.gateway.turnInk(CODE)!.stack;
    expect(visibleStrokes(server).map((st) => st.id)).toEqual([1, 2, 3, 4]);
    expect(after.pad.actions).toEqual(server.actions);
    await expect.poll(() => screenPicture(d.screenInk).seq).toBe(4);
    expect(screenPicture(d.screenInk).stack.actions).toEqual(server.actions);
    // The only drawing data the phone got was its own snapshot.
    expect(again.events.map(([e]) => e)).toEqual(['ink:snapshot']);
    after.sender.dispose();
  });

  it('answers the drawer even if the turn had no log yet', async () => {
    const d = await drawing();
    d.gateway.forget(CODE);
    expect(await d.ana.ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    expect(d.ana.ink.events).toEqual([['ink:snapshot', { turnId: d.turnId, seq: 0, actions: [] }]]);
  });

  it('a Screen reconnecting mid-turn rebuilds the exact action stack', async () => {
    const d = await drawing();
    const script: InkOp[][] = [
      strokeN(d.turnId, 0, 1)[2],
      strokeN(d.turnId, 0, 2)[2],
      [['c']],
      strokeN(d.turnId, 0, 3)[2],
      [['u']], // stroke 3 goes; the clear stays, hiding strokes 1 and 2
    ];
    let seq = 0;
    for (const ops of script)
      expect(await d.ana.ink.emit('ink:batch', [d.turnId, ++seq, ops])).toEqual({ ok: true });

    // The TV's socket drops and comes back as a new one: hello brings the whole stack.
    d.screenInk.socket.disconnect();
    const back = await d.connect('/ink');
    expect(await back.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    await expect.poll(() => inkEvents(back).length).toBe(1);
    expect(back.events[0]).toEqual([
      'ink:snapshot',
      expect.objectContaining({ turnId: d.turnId, seq }),
    ]);

    // Live batches continue after the snapshot; undoing the clear brings back strokes under it.
    for (const ops of [[['u']], strokeN(d.turnId, 0, 4)[2]] as InkOp[][])
      expect(await d.ana.ink.emit('ink:batch', [d.turnId, ++seq, ops])).toEqual({ ok: true });
    await expect.poll(() => screenPicture(back).seq).toBe(seq);
    const server = d.gateway.turnInk(CODE)!.stack;
    expect(screenPicture(back).stack.actions).toEqual(server.actions);
    expect(visibleStrokes(server).map((st) => st.id)).toEqual([1, 2, 4]);
  });

  it('a Screen that says hello again (after a gap) gets a fresh snapshot', async () => {
    const d = await drawing();
    expect(await d.ana.ink.emit('ink:batch', strokeN(d.turnId, 1, 1))).toEqual({ ok: true });
    expect(await d.screenInk.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    await expect
      .poll(() => inkEvents(d.screenInk).filter(([e]) => e === 'ink:snapshot'))
      .toEqual([
        ['ink:snapshot', { turnId: d.turnId, seq: 1, actions: strokeN(d.turnId, 1, 1)[2] }],
      ]);
  });

  it('a dropped drawer resends its kept batches without duplicates', async () => {
    const d = await drawing();
    const kept = [1, 2, 3, 4, 5].map((n) => strokeN(d.turnId, n, n));
    for (const b of kept.slice(0, 2))
      expect(await d.ana.ink.emit('ink:batch', b)).toEqual({ ok: true });

    // Batches 3–5 were lost with the drawer's socket. It comes back on a new one and asks.
    d.ana.ink.socket.disconnect();
    const again = await d.connect('/ink', { code: CODE, playerKey: KEY_ANA });
    expect(await again.emit('ink:sync', { turnId: d.turnId, lastSentSeq: 5 })).toEqual({
      ok: true,
    });
    await expect
      .poll(() => again.events)
      .toEqual([['ink:state', { turnId: d.turnId, lastSeq: 2 }]]);

    // It resends every kept batch after lastSeq; one it already sent is ignored as a duplicate.
    for (const b of [kept[1]!, ...kept.slice(2)])
      expect(await again.emit('ink:batch', b)).toEqual({ ok: true });
    await expect
      .poll(() => inkEvents(d.screenInk).filter(([e]) => e === 'ink:batch'))
      .toEqual(kept.map((b) => ['ink:batch', b]));
    expect(visibleStrokes(d.gateway.turnInk(CODE)!.stack).map((st) => st.id)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(screenPicture(d.screenInk).stack.actions).toEqual(
      d.gateway.turnInk(CODE)!.stack.actions,
    );
    // `ink:state` carries numbers only: no drawing data reached the drawer.
    expect(again.events.map(([e]) => e)).toEqual(['ink:state']);
  });

  it('answers a gap with ink:resend once, drops the batch, and takes the resent ones in order', async () => {
    const d = await drawing();
    expect(await d.ana.ink.emit('ink:batch', strokeN(d.turnId, 1, 1))).toEqual({ ok: true });
    expect(await d.ana.ink.emit('ink:batch', strokeN(d.turnId, 3, 3))).toEqual({
      ok: false,
      error: 'inkGap',
    });
    expect(await d.ana.ink.emit('ink:batch', strokeN(d.turnId, 4, 4))).toEqual({
      ok: false,
      error: 'inkGap',
    });
    expect(d.ana.ink.events).toEqual([['ink:resend', { turnId: d.turnId, from: 2 }]]);
    for (const n of [2, 3, 4])
      expect(await d.ana.ink.emit('ink:batch', strokeN(d.turnId, n, n))).toEqual({ ok: true });
    await expect
      .poll(() => inkEvents(d.screenInk).filter(([e]) => e === 'ink:batch'))
      .toEqual([1, 2, 3, 4].map((n) => ['ink:batch', strokeN(d.turnId, n, n)]));
  });

  it('refuses ink:sync from anyone but the drawer of the live turn', async () => {
    const d = await drawing();
    expect(await d.ben.ink.emit('ink:sync', { turnId: d.turnId, lastSentSeq: 0 })).toEqual({
      ok: false,
      error: 'notDrawer',
    });
    expect(await d.screenInk.emit('ink:sync', { turnId: d.turnId, lastSentSeq: 0 })).toEqual({
      ok: false,
      error: 'notDrawer',
    });
    expect(await d.ana.ink.emit('ink:sync', { turnId: d.turnId + 1, lastSentSeq: 0 })).toEqual({
      ok: false,
      error: 'staleTurn',
    });
    expect(await d.screen.emit('host:skip')).toEqual({ ok: true });
    expect(await d.ana.ink.emit('ink:sync', { turnId: d.turnId, lastSentSeq: 0 })).toEqual({
      ok: false,
      error: 'wrongPhase',
    });
    expect(d.ben.ink.events).toEqual([]);
    expect(d.ana.ink.events).toEqual([]);
  });

  it('the drawer gets no snapshot once its turn is over, and a guesser never does', async () => {
    const d = await drawing();
    expect(await d.ana.ink.emit('ink:batch', strokeN(d.turnId, 1, 1))).toEqual({ ok: true });
    expect(await d.screen.emit('host:skip')).toEqual({ ok: true });
    expect(await d.ana.ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    expect(await d.ben.ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    expect(d.ana.ink.events).toEqual([]);
    expect(d.ben.ink.events).toEqual([]);
    // Ben draws next: his hello mid-turn gets his own (empty) turn, never Ana's drawing.
    await startTurn(d, 'host:next');
    const next = d.rooms.get(CODE)!.turn!.id;
    expect(await d.ben.ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    expect(d.ben.ink.events).toEqual([['ink:snapshot', { turnId: next, seq: 0, actions: [] }]]);
  });

  it('serves a frozen turn to Screens for the gallery, and to no phone', async () => {
    const d = await drawing();
    expect(await d.ana.ink.emit('ink:batch', strokeN(d.turnId, 1, 1))).toEqual({ ok: true });
    // Live: not yet kept for the gallery.
    expect(await d.screenInk.emit('ink:get', { turnId: d.turnId })).toEqual({
      ok: false,
      error: 'inkNotKept',
    });
    expect(await d.screen.emit('host:skip')).toEqual({ ok: true });
    expect(await d.screenInk.emit('ink:get', { turnId: d.turnId })).toEqual({
      ok: true,
      turnId: d.turnId,
      actions: strokeN(d.turnId, 1, 1)[2],
    });
    expect(await d.screenInk.emit('ink:get', { turnId: d.turnId + 5 })).toEqual({
      ok: false,
      error: 'inkNotKept',
    });
    for (const phone of [d.ana.ink, d.ben.ink])
      expect(await phone.emit('ink:get', { turnId: d.turnId })).toEqual({
        ok: false,
        error: 'notScreen',
      });
    const stranger = await d.connect('/ink');
    expect(await stranger.emit('ink:get', { turnId: d.turnId })).toEqual({
      ok: false,
      error: 'notJoined',
    });
    // A Screen reloading in REVEAL still gets the finished drawing.
    const late = await d.connect('/ink');
    expect(await late.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    await expect
      .poll(() => late.events)
      .toEqual([
        ['ink:snapshot', { turnId: d.turnId, seq: 1, actions: strokeN(d.turnId, 1, 1)[2] }],
      ]);
  });

  it('a full canvas refuses new strokes: the ack says so, and the Screens get the rest of the batch', async () => {
    const d = await drawing(createInkStore({ turnMax: 60 }));
    expect(await d.ana.ink.emit('ink:batch', strokeN(d.turnId, 1, 1))).toEqual({ ok: true });
    expect(await d.ana.ink.emit('ink:batch', strokeN(d.turnId, 2, 2))).toEqual({ ok: true });
    const batch: InkBatch = [d.turnId, 3, [...strokeN(d.turnId, 3, 3)[2], ['u']]];
    expect(await d.ana.ink.emit('ink:batch', batch)).toEqual({ ok: false, error: 'inkFull' });
    await expect
      .poll(() =>
        inkEvents(d.screenInk)
          .filter(([e]) => e === 'ink:batch')
          .at(-1),
      )
      .toEqual(['ink:batch', [d.turnId, 3, [['u']]]]);
    expect(visibleStrokes(d.gateway.turnInk(CODE)!.stack).map((st) => st.id)).toEqual([1]);
    expect(screenPicture(d.screenInk).stack.actions).toEqual(
      d.gateway.turnInk(CODE)!.stack.actions,
    );
  });

  it(`disconnects a socket after ${INK_INVALID_BATCHES_MAX} invalid batches in a turn`, async () => {
    const d = await drawing();
    const bad = [d.turnId, 1, [['b', 1, 0, 1, 5000, 300]]];
    for (let i = 1; i < INK_INVALID_BATCHES_MAX; i++)
      expect(await d.ana.ink.emit('ink:batch', bad)).toEqual({
        ok: false,
        error: 'invalidPayload',
      });
    expect(d.ana.ink.socket.connected).toBe(true);
    // A valid batch doesn't reset the count.
    expect(await d.ana.ink.emit('ink:batch', strokeN(d.turnId, 1, 1))).toEqual({ ok: true });
    const gone = new Promise((resolve) => d.ana.ink.socket.once('disconnect', resolve));
    d.ana.ink.socket.emit('ink:batch', bad);
    await gone;
    expect(d.ana.ink.socket.connected).toBe(false);
    expect(inkEvents(d.screenInk).filter(([e]) => e === 'ink:batch')).toHaveLength(1);
  });

  it('counts invalid batches per turn', async () => {
    const l = await lobby();
    const bad = [1, 1, [['b', 1, 0, 1, 5000, 300]]];
    for (let i = 1; i < INK_INVALID_BATCHES_MAX; i++) await l.ana.ink.emit('ink:batch', bad);
    await startTurn(l, 'host:start');
    // A new turn: the count starts again.
    for (let i = 1; i < INK_INVALID_BATCHES_MAX; i++)
      expect(await l.ana.ink.emit('ink:batch', bad)).toEqual({
        ok: false,
        error: 'invalidPayload',
      });
    expect(l.ana.ink.socket.connected).toBe(true);
  });

  it('rate-limits hellos, syncs and gallery requests per socket', async () => {
    const d = await drawing();
    const screen = await d.connect('/ink');
    for (let i = 0; i < INK_HELLO_RATE_LIMIT.max; i++)
      expect(await screen.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    expect(await screen.emit('ink:hello', { code: CODE })).toEqual({
      ok: false,
      error: 'rateLimited',
    });
    for (let i = 0; i < INK_HELLO_RATE_LIMIT.max; i++)
      expect(await d.ana.ink.emit('ink:sync', { turnId: d.turnId, lastSentSeq: 0 })).toEqual({
        ok: true,
      });
    expect(await d.ana.ink.emit('ink:sync', { turnId: d.turnId, lastSentSeq: 0 })).toEqual({
      ok: false,
      error: 'rateLimited',
    });
    for (let i = 0; i < INK_GET_RATE_LIMIT.max; i++)
      await d.screenInk.emit('ink:get', { turnId: d.turnId });
    expect(await d.screenInk.emit('ink:get', { turnId: d.turnId })).toEqual({
      ok: false,
      error: 'rateLimited',
    });
    d.mono.now += INK_GET_RATE_LIMIT.windowMs;
    expect(await screen.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    expect(await d.screenInk.emit('ink:get', { turnId: d.turnId })).toEqual({
      ok: false,
      error: 'inkNotKept',
    });
  });
});

describe('/ink lobby doodles', () => {
  const doodleOps = (id = 1, x = 200): InkOp[] => [
    ['b', id, 0, 1, x, 300],
    ['p', id, 4, -1, 6, -2, 5, 0],
    ['e', id],
  ];
  /** The latest `state` a main-namespace socket received. */
  const lastState = (c: Client) =>
    c.events.filter(([e]) => e === 'state').at(-1)?.[1] as View | undefined;
  const hasDoodle = (c: Client, pid: string) =>
    lastState(c)?.players.find((p) => p.pid === pid)?.hasDoodle;

  it('relays a doodle to the Screens only, and every view shows hasDoodle', async () => {
    const l = await lobby();
    const plainScreenInk = await l.connect('/ink');
    expect(await plainScreenInk.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    // Ben says hello as a Screen would; he still must not get Ana's doodle.
    expect(await l.ben.ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    expect(await l.ana.ink.emit('doodle:batch', { ops: doodleOps() })).toEqual({ ok: true });

    for (const screenInk of [l.screenInk, plainScreenInk])
      await expect
        .poll(() => screenInk.events.filter(([e]) => e === 'doodle'))
        .toEqual([['doodle', { pid: l.ana.pid, ops: doodleOps() }]]);
    await expect.poll(() => hasDoodle(l.screen, l.ana.pid)).toBe(true);
    await expect.poll(() => hasDoodle(l.ben.main, l.ana.pid)).toBe(true);
    expect(hasDoodle(l.screen, l.ben.pid)).toBe(false);

    // A round trip on each phone socket after the relay: anything sent to it would be here now.
    for (const p of [l.ana, l.ben]) {
      await p.ink.emit('ink:hello', { code: CODE });
      expect(p.ink.events).toEqual([]);
      expect(p.main.events.some(([e]) => e !== 'state' && e !== 'fx')).toBe(false);
    }
  });

  it('refuses doodles outside LOBBY, from a Screen, and from a socket that never said who it is', async () => {
    const d = await drawing();
    for (const phone of [d.ana, d.ben])
      expect(await phone.ink.emit('doodle:batch', { ops: doodleOps() })).toEqual({
        ok: false,
        error: 'wrongPhase',
      });
    expect(await d.screenInk.emit('doodle:batch', { ops: doodleOps() })).toEqual({
      ok: false,
      error: 'notPlayer',
    });
    const stranger = await d.connect('/ink');
    expect(await stranger.emit('doodle:batch', { ops: doodleOps() })).toEqual({
      ok: false,
      error: 'notJoined',
    });
    await d.screenInk.emit('ink:hello', { code: CODE });
    expect(d.screenInk.events.filter(([e]) => e === 'doodle')).toEqual([]);
    expect(d.gateway.store.doodles(CODE)).toEqual({});
  });

  it(`caps a doodle at ${DOODLE_MAX_BYTES / 1024} KB per player: past it, a batch is refused and not relayed`, async () => {
    const l = await lobby(createInkStore({ doodleMax: 80 }));
    expect(await l.ana.ink.emit('doodle:batch', { ops: doodleOps(1) })).toEqual({ ok: true });
    expect(await l.ana.ink.emit('doodle:batch', { ops: doodleOps(2) })).toEqual({ ok: true });
    expect(await l.ana.ink.emit('doodle:batch', { ops: doodleOps(3) })).toEqual({
      ok: false,
      error: 'inkFull',
    });
    // Ben's budget is his own.
    expect(await l.ben.ink.emit('doodle:batch', { ops: doodleOps(1) })).toEqual({ ok: true });
    await expect.poll(() => l.screenInk.events.filter(([e]) => e === 'doodle').length).toBe(3);
    expect(
      l.screenInk.events.some(([e, p]) => e === 'doodle' && JSON.stringify(p).includes('"b",3')),
    ).toBe(false);
    // One batch over the cap fails its schema.
    const big: InkOp[] = [];
    for (let id = 1; JSON.stringify(big).length <= DOODLE_MAX_BYTES; id++)
      big.push(['b', id, 0, 1, 500, 500], ['p', id, ...Array<number>(200).fill(1)] as InkOp);
    expect(await l.ben.ink.emit('doodle:batch', { ops: big })).toEqual({
      ok: false,
      error: 'invalidPayload',
    });
  });

  it('gives a Screen that connects later every doodle in its snapshot, in the lobby and mid-game', async () => {
    const l = await lobby();
    await l.ana.ink.emit('doodle:batch', { ops: doodleOps(1) });
    await l.ben.ink.emit('doodle:batch', { ops: doodleOps(1, 700) });
    const late = await l.connect('/ink');
    expect(await late.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    await expect
      .poll(() => late.events)
      .toEqual([
        [
          'ink:snapshot',
          {
            turnId: 0,
            seq: 0,
            actions: [],
            doodles: { [l.ana.pid]: doodleOps(1), [l.ben.pid]: doodleOps(1, 700) },
          },
        ],
      ]);

    await startTurn(l, 'host:start');
    const turnId = l.rooms.get(CODE)!.turn!.id;
    await l.ana.ink.emit('ink:batch', stroke(turnId, 1));
    const later = await l.connect('/ink');
    await later.emit('ink:hello', { code: CODE });
    await expect.poll(() => later.events.length).toBe(1);
    expect(later.events[0]![1]).toMatchObject({
      turnId,
      seq: 1,
      doodles: { [l.ana.pid]: doodleOps(1), [l.ben.pid]: doodleOps(1, 700) },
    });
    // The drawer's own snapshot carries no doodles.
    await l.ana.ink.emit('ink:hello', { code: CODE });
    await expect.poll(() => l.ana.ink.events.length).toBe(1);
    expect(l.ana.ink.events[0]![1]).not.toHaveProperty('doodles');
  });

  it("drops a player's doodle when they leave, and refuses their /ink socket after", async () => {
    const l = await lobby();
    await l.ana.ink.emit('doodle:batch', { ops: doodleOps(1) });
    await l.ben.ink.emit('doodle:batch', { ops: doodleOps(1, 700) });
    expect(await l.ben.main.emit('player:leave')).toEqual({ ok: true });
    expect(Object.keys(l.gateway.store.doodles(CODE))).toEqual([l.ana.pid]);
    expect(await l.ben.ink.emit('doodle:batch', { ops: doodleOps(2) })).toEqual({
      ok: false,
      error: 'notPlayer',
    });
    const late = await l.connect('/ink');
    await late.emit('ink:hello', { code: CODE });
    await expect.poll(() => late.events.length).toBe(1);
    expect(late.events[0]![1]).toMatchObject({ doodles: { [l.ana.pid]: doodleOps(1) } });
    expect(Object.keys((late.events[0]![1] as InkSnapshot).doodles!)).toEqual([l.ana.pid]);
  });

  it('marks hasDoodle false again when every stroke is undone', async () => {
    const l = await lobby();
    await l.ana.ink.emit('doodle:batch', { ops: doodleOps(1) });
    await expect.poll(() => hasDoodle(l.screen, l.ana.pid)).toBe(true);
    expect(await l.ana.ink.emit('doodle:batch', { ops: [['u']] })).toEqual({ ok: true });
    await expect.poll(() => hasDoodle(l.screen, l.ana.pid)).toBe(false);
  });
});
