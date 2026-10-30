import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { INK_BATCH_RATE_LIMIT } from '../shared/constants.js';
import type { Ack, InkBatch, View } from '../shared/types.js';
import { generateHostToken, hashHostToken } from './hostToken.js';
import { attachInkGateway } from './inkGateway.js';
import { createRoom } from './room.js';
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

async function setup() {
  const rooms = new InMemoryRoomStore();
  const hostToken = generateHostToken();
  rooms.set(createRoom({ code: CODE, hostTokenHash: hashHostToken(hostToken), now: 0, seed: 7 }));
  const mono = { now: 10_000 };
  server = createServer();
  let onInk: ReturnType<typeof attachInkGateway>['onInk'] = () => {};
  const { io } = attachSockets(server, {
    rooms,
    clock: () => 1_800_000_000_000,
    monotonic: () => mono.now,
    // Timers never fire on their own: the tests move turns on with host actions.
    scheduler: () => () => {},
    onInk: (code, effect) => onInk(code, effect),
  });
  onInk = attachInkGateway(io, { rooms, monotonic: () => mono.now }).onInk;
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

  return { rooms, hostToken, mono, connect };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function joinPlayer(s: Setup, playerKey: string, name: string) {
  const main = await s.connect('');
  const ack = await main.emit<{ pid: string }>('player:join', { code: CODE, playerKey, name });
  if (!ack.ok) throw new Error(`join failed: ${ack.error}`);
  const ink = await s.connect('/ink', { code: CODE, playerKey });
  return { main, ink, pid: ack.pid };
}

/** A token Screen (main and `/ink`), Ana (crown, first drawer) and Ben, both with `/ink` sockets. */
async function lobby() {
  const s = await setup();
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

async function drawing() {
  const l = await lobby();
  expect(await l.screen.emit('host:start')).toEqual({ ok: true });
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

const inkEvents = (c: Client) => c.events.filter(([e]) => e.startsWith('ink:'));

describe('/ink relay', () => {
  it("relays the drawer's batch, unchanged, to the room's Screens", async () => {
    const d = await drawing();
    const batch = stroke(d.turnId, 1);
    expect(await d.ana.ink.emit('ink:batch', batch)).toEqual({ ok: true });
    await expect.poll(() => inkEvents(d.screenInk)).toContainEqual(['ink:batch', batch]);
  });

  it('sends ink:turn to Screens when a turn opens, so they clear', async () => {
    const l = await lobby();
    expect(await l.screen.emit('host:start')).toEqual({ ok: true });
    const firstTurn = l.rooms.get(CODE)!.turn!.id;
    await expect.poll(() => inkEvents(l.screenInk)).toEqual([['ink:turn', { turnId: firstTurn }]]);

    // Skip to REVEAL, then on to Ben's turn.
    expect(await l.screen.emit('host:skip')).toEqual({ ok: true });
    expect(await l.screen.emit('host:next')).toEqual({ ok: true });
    const secondTurn = l.rooms.get(CODE)!.turn!.id;
    expect(secondTurn).not.toBe(firstTurn);
    await expect
      .poll(() => inkEvents(l.screenInk))
      .toEqual([
        ['ink:turn', { turnId: firstTurn }],
        ['ink:turn', { turnId: secondTurn }],
      ]);
  });

  it('a guesser socket, and the drawer itself, receive no /ink event', async () => {
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
    expect(d.ana.ink.events).toEqual([]);
    // Nor does ink leak into the main namespace.
    for (const c of [d.screen, d.ana.main, d.ben.main]) expect(inkEvents(c)).toEqual([]);
  });

  it('across a whole game, only the Screens get ink: no guesser, crowned guesser, late joiner or drawer', async () => {
    const l = await lobby();
    const plainScreen = await l.connect('');
    expect(await plainScreen.emit('screen:join', { code: CODE })).toEqual({ ok: true });
    const plainScreenInk = await l.connect('/ink');
    expect(await plainScreenInk.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    const cy = await joinPlayer(l, 'c'.repeat(21), 'Cy');
    const phones = { ana: l.ana, ben: l.ben, cy };
    // Every phone also says hello, as a Screen would; it must still not be counted as one.
    for (const p of Object.values(phones))
      expect(await p.ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });

    let dee: Awaited<ReturnType<typeof joinPlayer>> | undefined;
    const sent: InkBatch[] = [];
    for (const [n, name] of (['ana', 'ben', 'cy'] as const).entries()) {
      expect(await l.screen.emit(n === 0 ? 'host:start' : 'host:next')).toEqual({ ok: true });
      const room = l.rooms.get(CODE)!;
      expect(room.turn!.drawerPid).toBe(phones[name].pid);
      // Ana keeps the crown throughout, so turns 2 and 3 have a crowned guesser.
      expect(room.crownPid).toBe(l.ana.pid);
      for (const seq of [1, 2]) {
        const batch = stroke(room.turn!.id, seq);
        expect(await phones[name].ink.emit('ink:batch', batch)).toEqual({ ok: true });
        sent.push(batch);
      }
      if (n === 0) {
        dee = await joinPlayer(l, 'd'.repeat(21), 'Dee');
        expect(await dee.ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
      }
      expect(await l.screen.emit('host:skip')).toEqual({ ok: true });
    }
    expect(await l.screen.emit('host:next')).toEqual({ ok: true });
    expect(l.rooms.get(CODE)!.phase).toBe('FINAL');

    for (const screenInk of [l.screenInk, plainScreenInk]) {
      await expect
        .poll(() => inkEvents(screenInk).filter(([e]) => e === 'ink:batch'))
        .toEqual(sent.map((b) => ['ink:batch', b]));
    }
    const phoneSockets = [...Object.values(phones), dee!];
    // A round trip on each phone socket after the relays: anything sent to it would be here now.
    for (const p of phoneSockets) await p.ink.emit('ink:hello', { code: CODE });
    // The main namespace carries only views and fx: no ink under any event name.
    const mainEventNames = (c: Client) => new Set(c.events.map(([e]) => e));
    for (const p of phoneSockets) {
      expect(p.ink.events).toEqual([]);
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
    expect(await l.screen.emit('host:start')).toEqual({ ok: true });
    const oldTurn = l.rooms.get(CODE)!.turn!.id;
    expect(await l.screen.emit('host:skip')).toEqual({ ok: true });
    expect(await l.screen.emit('host:next')).toEqual({ ok: true });
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
    expect(await l.screen.emit('host:start')).toEqual({ ok: true });
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
    d.mono.now += INK_BATCH_RATE_LIMIT.windowMs;
    expect(await d.ana.ink.emit('ink:batch', stroke(d.turnId, 42))).toEqual({ ok: true });
    await expect
      .poll(() => inkEvents(d.screenInk).filter(([e]) => e === 'ink:batch').length)
      .toBe(INK_BATCH_RATE_LIMIT.max + 1);
    expect(inkEvents(d.screenInk)).not.toContainEqual(['ink:batch', stroke(d.turnId, 41)]);
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
      createRoom({ code: 'WXYZ', hostTokenHash: hashHostToken(generateHostToken()), now: 0 }),
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
      createRoom({ code: 'WXYZ', hostTokenHash: hashHostToken(generateHostToken()), now: 0 }),
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
