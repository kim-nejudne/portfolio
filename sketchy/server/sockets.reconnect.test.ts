import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ALL_GUESSED_MS,
  DRAWER_AWAY_DEBOUNCE_MS,
  RESUME_COUNTDOWN_MS,
  SCREEN_AWAY_MS,
} from '../shared/constants.js';
import { applyInkOps, createInkStack, visibleStrokes } from '../shared/ink.js';
import type {
  Ack,
  InkBatch,
  InkSnapshot,
  PlayerView,
  ScreenView,
  Turn,
  View,
} from '../shared/types.js';
import { generateHostToken, hashHostToken } from './hostToken.js';
import { attachInkGateway } from './inkGateway.js';
import { createRoom } from './room.js';
import { InMemoryRoomStore } from './roomStore.js';
import { attachSockets } from './sockets.js';
import { TEST_PACKS } from './test/packs.js';

/*
 * F43: a refresh of each role mid-turn, over real sockets on both namespaces. A refreshed page is a
 * new socket (or two) with what the page kept in `localStorage`: the Screen its hostToken, a phone
 * its playerKey and name. The pause rules for a long absence are F40's and F41's; here every page
 * comes back within the debounce, as a reload does, and the game must carry on as if nothing
 * happened.
 */

const WALL0 = 1_800_000_000_000;
const MONO0 = 50_000;
const CODE = 'ABCD';
const KEY_ANA = 'a'.repeat(21);
const KEY_BEN = 'b'.repeat(21);
const KEY_CY = 'c'.repeat(21);

interface Pending {
  fn: () => void;
  delayMs: number;
  cancelled: boolean;
}

interface Client {
  socket: ClientSocket;
  /** Every event this socket received, in order. */
  events: [string, unknown][];
  /** The latest `state` this socket received. */
  last<V extends View = View>(): V | undefined;
  /** Resolves with the first state (already received or next) matching `pred`. */
  state<V extends View = View>(pred: (v: V) => boolean): Promise<V>;
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
  rooms.set(
    createRoom({
      code: CODE,
      hostTokenHash: hashHostToken(hostToken),
      now: WALL0,
      seed: 7,
      packs: TEST_PACKS,
    }),
  );
  const time = { mono: MONO0 };
  const timers: Pending[] = [];
  server = createServer();
  let onInk: ReturnType<typeof attachInkGateway>['onInk'] = () => {};
  const { io, dispatch } = attachSockets(server, {
    rooms,
    clock: () => WALL0,
    monotonic: () => time.mono,
    scheduler: (fn, delayMs) => {
      const t: Pending = { fn, delayMs, cancelled: false };
      timers.push(t);
      return () => {
        t.cancelled = true;
      };
    },
    onInk: (code, effect) => onInk(code, effect),
  });
  const gateway = attachInkGateway(io, { rooms, dispatch, monotonic: () => time.mono });
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
    const states: View[] = [];
    socket.onAny((event: string, payload: unknown) => {
      events.push([event, payload]);
      if (event === 'state') states.push(payload as View);
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    return {
      socket,
      events,
      last: <V extends View>() => states.at(-1) as V | undefined,
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

/** A Screen page: its main socket joined (with the token if given) and its `/ink` socket. */
async function openScreen(s: Setup, hostToken?: string) {
  const main = await s.connect('');
  expect(
    await main.emit('screen:join', { code: CODE, ...(hostToken ? { hostToken } : {}) }),
  ).toEqual({ ok: true });
  const ink = await s.connect('/ink');
  expect(await ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
  return { main, ink };
}

/** A phone page: `player:join` with what it kept, then its `/ink` socket. */
async function openPhone(s: Setup, playerKey: string, name: string) {
  const main = await s.connect('');
  const ack = await main.emit<{ pid: string }>('player:join', { code: CODE, playerKey, name });
  if (!ack.ok) throw new Error(`join failed: ${ack.error}`);
  const ink = await s.connect('/ink', { code: CODE, playerKey });
  return { main, ink, pid: ack.pid };
}

type Page = { main: Client; ink: Client };

/** Closes a page's sockets, as a reload does, and waits until the server has seen it. */
async function closePage(s: Setup, page: Page, pid?: string) {
  const screens = s.rooms.get(CODE)!.screens;
  page.main.socket.disconnect();
  page.ink.socket.disconnect();
  await expect
    .poll(() => (pid ? s.rooms.get(CODE)!.players[pid]!.connected : s.rooms.get(CODE)!.screens))
    .toBe(pid ? false : screens - 1);
}

/** A numbered stroke, so a duplicate or a missing one shows in the action stack. */
const strokeN = (turnId: number, seq: number, id: number): InkBatch => [
  turnId,
  seq,
  [
    ['b', id, id % 8, 1, 10 * id, 20 * id],
    ['p', id, 5, 5, 5, -3],
    ['e', id],
  ],
];

/** A Screen's picture from the events it received: the snapshot, then batches after its `seq`. */
function screenPicture(c: Client) {
  const stack = createInkStack();
  let seq = 0;
  for (const [event, payload] of c.events) {
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

/**
 * A token Screen, Ana (first joiner: crown, first drawer), Ben and Cy, in DRAWING with two of
 * Ana's strokes on the TV, the crown handed to Ben, Ben right and Cy not yet.
 */
/** A token Screen, Ana (first joiner: crown, first drawer), Ben and Cy, with Ana's choice open. */
async function choosing() {
  const s = await setup();
  const screen = await openScreen(s, s.hostToken);
  const ana = await openPhone(s, KEY_ANA, 'Ana');
  const ben = await openPhone(s, KEY_BEN, 'Ben');
  const cy = await openPhone(s, KEY_CY, 'Cy');
  expect(await screen.main.emit('host:start')).toEqual({ ok: true });
  expect(s.rooms.get(CODE)!.turn!.drawerPid).toBe(ana.pid);
  await ana.main.state((v) => v.phase === 'CHOOSING');
  return { ...s, screen, ana, ben, cy };
}

async function midTurn() {
  const s = await choosing();
  const { screen, ana, ben, cy } = s;
  expect(await ana.main.emit('drawer:choose', { index: 0 })).toEqual({ ok: true });
  const room = s.rooms.get(CODE)!;
  const word = room.turn!.word!.word;
  const turnId = room.turn!.id;
  for (const n of [1, 2])
    expect(await ana.ink.emit('ink:batch', strokeN(turnId, n, n))).toEqual({ ok: true });
  s.time.mono += 10_000;
  expect(await ben.main.emit('player:guess', { text: word })).toEqual({ ok: true });
  expect(await screen.main.emit('host:crown', { pid: ben.pid })).toEqual({ ok: true });
  expect(s.rooms.get(CODE)!.players[ben.pid]!.score).toBeGreaterThan(0);
  await expect.poll(() => screenPicture(screen.ink).seq).toBe(2);
  // Every page has the latest state before the refresh.
  for (const page of [screen, ana, ben, cy])
    await page.main.state((v) => v.players.some((p) => p.pid === ben.pid && p.crown));
  return { ...s, screen, ana, ben, cy, word, turnId };
}

/** Pending timers of this length scheduled since `from`, fired with the clock moved on to them. */
function fireTimers(g: Setup, from: number, delayMs: number) {
  const due = g.timers.slice(from).filter((t) => t.delayMs === delayMs && !t.cancelled);
  expect(due.length).toBeGreaterThan(0);
  g.time.mono += delayMs;
  for (const t of due) t.fn();
}

/**
 * Nothing a non-drawer may not see before REVEAL: the word, its alternates and gloss, and the other
 * choices, in every event these sockets received, on both namespaces.
 */
function expectNoSecrets(g: Setup, ...clients: Client[]) {
  expectNoneOf(secretsOf(g.rooms.get(CODE)!.turn!), ...clients);
}

/** A dealt turn's words, alternates and glosses. */
const secretsOf = (turn: Turn) =>
  turn.choices.flatMap((c) => [c.word, ...c.alt, ...(c.gloss ? [c.gloss] : [])]);

function expectNoneOf(secrets: string[], ...clients: Client[]) {
  expect(secrets.length).toBeGreaterThanOrEqual(3);
  for (const c of clients) {
    const seen = JSON.stringify(c.events).toLowerCase();
    for (const secret of secrets) expect(seen).not.toContain(secret.toLowerCase());
  }
}

/** A deep copy of a view, to compare with the one after the reload (the clock stands still between). */
const settled = (v: View | undefined) => JSON.parse(JSON.stringify(v)) as View;

describe('refreshing every role mid-turn (F43)', () => {
  it('the Screen comes back as the host Screen with the turn, scores, crown and drawing', async () => {
    const g = await midTurn();
    const before = settled(g.screen.main.last());
    const timersBefore = g.timers.length;

    await closePage(g, g.screen);
    const again = await openScreen(g, g.hostToken);
    const view = await again.main.state<ScreenView>((v) => v.role === 'screen');

    // The same view as before the reload: host controls, DRAWING, the clock, scores and crown.
    expect(view).toEqual(before);
    expect(view.host).toEqual({ code: CODE, customWordCount: 0 });
    expect(view.phase).toBe('DRAWING');
    expect(view.turn!.id).toBe(g.turnId);
    expect(view.players.find((p) => p.pid === g.ben.pid)).toMatchObject({
      crown: true,
      guessed: true,
      turnPoints: g.rooms.get(CODE)!.players[g.ben.pid]!.score,
    });
    expectNoSecrets(g, again.main, again.ink);

    // The drawing: a snapshot with both strokes, then live batches after it.
    await expect.poll(() => screenPicture(again.ink).seq).toBe(2);
    expect(again.ink.events[0]).toEqual([
      'ink:snapshot',
      expect.objectContaining({ turnId: g.turnId, seq: 2 }),
    ]);
    expect(await g.ana.ink.emit('ink:batch', strokeN(g.turnId, 3, 3))).toEqual({ ok: true });
    await expect.poll(() => screenPicture(again.ink).seq).toBe(3);
    expect(screenPicture(again.ink).stack.actions).toEqual(g.gateway.turnInk(CODE)!.stack.actions);
    expect(visibleStrokes(screenPicture(again.ink).stack).map((st) => st.id)).toEqual([1, 2, 3]);

    // Back within 3 s: the Screen-away check finds a Screen and pauses nothing.
    fireTimers(g, timersBefore, SCREEN_AWAY_MS);
    expect(g.rooms.get(CODE)!.paused).toBeNull();
    expect(await g.cy.main.emit('player:guess', { text: g.word })).toEqual({ ok: true });
  });

  it('a Screen without the token (another TV) comes back as a plain Screen with the same game', async () => {
    const g = await midTurn();
    const tv = await openScreen(g);
    const before = settled(await tv.main.state((v) => v.role === 'screen'));
    expect(before.host).toBeNull();
    await closePage(g, tv);
    expect(g.rooms.get(CODE)!.screens).toBe(1);
    const again = await openScreen(g);
    expect(await again.main.state((v) => v.role === 'screen')).toEqual(before);
    await expect.poll(() => screenPicture(again.ink).seq).toBe(2);
  });

  it('the drawer comes back to their word, crown state, score and own drawing, and draws on', async () => {
    const g = await midTurn();
    const before = settled(g.ana.main.last());
    expect((before as PlayerView).secret).not.toBeNull();
    const timersBefore = g.timers.length;

    await closePage(g, g.ana, g.ana.pid);
    await g.screen.main.state((v) => v.turn?.drawerReconnecting === true);
    const again = await openPhone(g, KEY_ANA, 'Ana');
    expect(again.pid).toBe(g.ana.pid);
    const view = await again.main.state<PlayerView>(
      (v) => v.role === 'player' && !v.turn!.drawerReconnecting,
    );

    // The same view as before: the word, the turn and its clock; Ana no longer holds the crown.
    expect(view).toEqual(before);
    expect(view.secret!.word!.word).toBe(g.word);
    expect(view.host).toBeNull();
    expect(view.players.find((p) => p.pid === g.ana.pid)).toMatchObject({
      connected: true,
      isDrawer: true,
      crown: false,
    });
    await g.screen.main.state((v) => v.turn?.drawerReconnecting === false);

    // `/ink`: the drawer's own snapshot, and drawing continues from its `seq`.
    expect(await again.ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    await expect.poll(() => again.ink.events.length).toBe(1);
    const [event, snapshot] = again.ink.events[0]! as [string, InkSnapshot];
    expect(event).toBe('ink:snapshot');
    expect(snapshot).toMatchObject({ turnId: g.turnId, seq: 2 });
    const pad = createInkStack();
    applyInkOps(pad, snapshot.actions);
    expect(pad.actions).toEqual(g.gateway.turnInk(CODE)!.stack.actions);
    expect(visibleStrokes(pad).map((st) => st.id)).toEqual([1, 2]);
    expect(await again.ink.emit('ink:batch', strokeN(g.turnId, snapshot.seq + 1, 3))).toEqual({
      ok: true,
    });
    await expect.poll(() => screenPicture(g.screen.ink).seq).toBe(3);
    expect(visibleStrokes(screenPicture(g.screen.ink).stack).map((st) => st.id)).toEqual([1, 2, 3]);
    expect(screenPicture(g.screen.ink).stack.actions).toEqual(
      g.gateway.turnInk(CODE)!.stack.actions,
    );

    // Back within 2 s: the drawer-away check pauses nothing.
    fireTimers(g, timersBefore, DRAWER_AWAY_DEBOUNCE_MS);
    expect(g.rooms.get(CODE)!.paused).toBeNull();
    expect(await g.cy.main.emit('player:guess', { text: g.word })).toEqual({ ok: true });
  });

  it('the drawer still holding the crown keeps it and the host controls', async () => {
    const g = await midTurn();
    expect(await g.screen.main.emit('host:crown', { pid: g.ana.pid })).toEqual({ ok: true });
    await expect.poll(() => g.ana.main.last()?.host).not.toBeNull();
    const before = settled(g.ana.main.last());
    await closePage(g, g.ana, g.ana.pid);
    const again = await openPhone(g, KEY_ANA, 'Ana');
    const view = await again.main.state<PlayerView>(
      (v) => v.role === 'player' && !v.turn!.drawerReconnecting,
    );
    expect(view).toEqual(before);
    expect(view.host).toEqual({ code: CODE, customWordCount: 0 });
    expect(g.rooms.get(CODE)!.crownPid).toBe(g.ana.pid);
    expect(await again.main.emit('host:settings', { guessFeed: 'off' })).toEqual({ ok: true });
  });

  it('a guesser who got it comes back right, with their points and crown, and still no word or ink', async () => {
    const g = await midTurn();
    const before = settled(g.ben.main.last());
    const score = g.rooms.get(CODE)!.players[g.ben.pid]!.score;

    await closePage(g, g.ben, g.ben.pid);
    expect(g.rooms.get(CODE)!.paused).toBeNull(); // Ana and Cy still play
    const again = await openPhone(g, KEY_BEN, 'Ben');
    expect(again.pid).toBe(g.ben.pid);
    const view = await again.main.state<PlayerView>(
      (v) => v.role === 'player' && v.players.find((p) => p.pid === g.ben.pid)!.connected,
    );

    expect(view).toEqual(before);
    expect(view.me).toMatchObject({ pid: g.ben.pid, turnPoints: score });
    expect(view.host).toEqual({ code: CODE, customWordCount: 0 });
    expect(view.players.find((p) => p.pid === g.ben.pid)).toMatchObject({
      crown: true,
      guessed: true,
    });
    expect(view.secret).toBeNull();
    expect(g.rooms.get(CODE)!.players[g.ben.pid]!.score).toBe(score);
    // Right already: another guess is refused, and the word reaches nothing of Ben's.
    expect(await again.main.emit('player:guess', { text: g.word })).toEqual({
      ok: false,
      error: 'alreadyGuessed',
    });
    expect(await again.main.emit('host:settings', { guessFeed: 'off' })).toEqual({ ok: true });
    // Ana keeps drawing; Ben's new `/ink` socket gets none of it, even when he says hello.
    expect(await again.ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    expect(await g.ana.ink.emit('ink:batch', strokeN(g.turnId, 3, 3))).toEqual({ ok: true });
    await expect.poll(() => screenPicture(g.screen.ink).seq).toBe(3);
    expect(again.ink.events).toEqual([]);
    expectNoSecrets(g, again.main, again.ink, g.ben.main, g.ben.ink);
  });

  it('a guesser who has not got it yet comes back able to guess, and scores', async () => {
    const g = await midTurn();
    const before = settled(g.cy.main.last());
    await closePage(g, g.cy, g.cy.pid);
    const again = await openPhone(g, KEY_CY, 'Cy');
    expect(again.pid).toBe(g.cy.pid);
    const view = await again.main.state<PlayerView>(
      (v) => v.role === 'player' && v.players.find((p) => p.pid === g.cy.pid)!.connected,
    );
    expect(view).toEqual(before);
    expect(view.host).toBeNull();
    expect(view.players.find((p) => p.pid === g.cy.pid)).toMatchObject({ guessed: false });
    expectNoSecrets(g, again.main, again.ink, g.cy.main, g.cy.ink);
    // Cy's new `/ink` socket gets no drawing by asking either.
    expect(await again.ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    expect(await again.ink.emit('ink:get', { turnId: g.turnId })).toEqual({
      ok: false,
      error: 'notScreen',
    });
    expect(again.ink.events).toEqual([]);

    // Cy's guess counts, and with everyone right the turn ends: Cy's points stay Cy's.
    g.time.mono += 5_000;
    const timersBefore = g.timers.length;
    expect(await again.main.emit('player:guess', { text: g.word })).toEqual({ ok: true });
    fireTimers(g, timersBefore, ALL_GUESSED_MS);
    const reveal = await again.main.state<PlayerView>((v) => v.phase === 'REVEAL');
    expect(reveal.me.turnPoints).toBeGreaterThan(0);
    expect(reveal.me.turnPoints).toBe(g.rooms.get(CODE)!.players[g.cy.pid]!.score);
  });

  it('all three pages refreshing at once carry the game on with the same scores', async () => {
    const g = await midTurn();
    const scores = Object.fromEntries(
      Object.values(g.rooms.get(CODE)!.players).map((p) => [p.pid, p.score]),
    );
    const timersBefore = g.timers.length;
    await closePage(g, g.screen);
    await closePage(g, g.ana, g.ana.pid);
    await closePage(g, g.ben, g.ben.pid);
    // Ana and Ben gone leaves one connected player: the room waits for more players at once.
    expect(g.rooms.get(CODE)!.paused?.reasons).toEqual(['fewPlayers']);

    const screen = await openScreen(g, g.hostToken);
    const ana = await openPhone(g, KEY_ANA, 'Ana');
    const ben = await openPhone(g, KEY_BEN, 'Ben');
    // Everyone back: the 3-2-1, then the turn carries on where it stopped.
    const counting = await screen.main.state<ScreenView>((v) => v.paused?.resumeInMs != null);
    expect(counting.paused!.reasons).toEqual([]);
    const old = [...g.timers];
    fireTimers(g, timersBefore, RESUME_COUNTDOWN_MS);
    await screen.main.state((v) => v.paused === null && v.phase === 'DRAWING');
    expect(g.rooms.get(CODE)!.turn!.id).toBe(g.turnId);
    // Every timer armed before the 3-2-1 ended (the turn's clock and hints, the away checks, the
    // 3-2-1 itself) is stale now: firing them all late changes nothing.
    const resumed = JSON.stringify(g.rooms.get(CODE));
    for (const t of old.filter((t) => !t.cancelled)) t.fn();
    expect(JSON.stringify(g.rooms.get(CODE))).toBe(resumed);
    expect(
      Object.fromEntries(Object.values(g.rooms.get(CODE)!.players).map((p) => [p.pid, p.score])),
    ).toEqual(scores);
    await expect.poll(() => screenPicture(screen.ink).seq).toBe(2);
    expect(await ana.ink.emit('ink:hello', { code: CODE })).toEqual({ ok: true });
    await expect.poll(() => ana.ink.events.length).toBe(1);
    expect(await ben.main.emit('player:guess', { text: g.word })).toEqual({
      ok: false,
      error: 'alreadyGuessed',
    });
    expectNoSecrets(g, screen.main, screen.ink, ben.main, ben.ink, g.cy.main, g.cy.ink);
    expect(await g.cy.main.emit('player:guess', { text: g.word })).toEqual({ ok: true });
  });
  it('a phone that opens its new page before the old socket times out never looks away', async () => {
    const g = await midTurn();
    const before = settled(g.screen.main.last());
    const timersBefore = g.timers.length;
    // The reload's new sockets connect while the old ones are still open, then the old ones drop.
    const again = await openPhone(g, KEY_ANA, 'Ana');
    expect(again.pid).toBe(g.ana.pid);
    g.ana.main.socket.disconnect();
    g.ana.ink.socket.disconnect();
    await again.main.state<PlayerView>((v) => v.secret?.word?.word === g.word);
    expect(await again.main.emit('ping', { t: 1 })).toEqual({ ok: true });
    expect(g.rooms.get(CODE)!.players[g.ana.pid]!.connected).toBe(true);
    expect(g.rooms.get(CODE)!.drawerAway).toBeNull();
    expect(g.timers.slice(timersBefore).map((t) => t.delayMs)).not.toContain(
      DRAWER_AWAY_DEBOUNCE_MS,
    );
    expect(settled(g.screen.main.last())).toEqual(before);
    expect(await again.ink.emit('ink:batch', strokeN(g.turnId, 3, 3))).toEqual({ ok: true });
    await expect.poll(() => screenPicture(g.screen.ink).seq).toBe(3);
  });

  it('in CHOOSING, the drawer comes back to the same choices, and nobody else gets them', async () => {
    const g = await choosing();
    const before = settled(g.ana.main.last());
    expect((before as PlayerView).secret!.choices).toHaveLength(3);
    // One page after another, as people do (two phones gone at once would pause for `fewPlayers`).
    await closePage(g, g.ana, g.ana.pid);
    const ana = await openPhone(g, KEY_ANA, 'Ana');
    await closePage(g, g.ben, g.ben.pid);
    const ben = await openPhone(g, KEY_BEN, 'Ben');
    await closePage(g, g.screen);
    const screen = await openScreen(g, g.hostToken);

    const view = await ana.main.state<PlayerView>(
      (v) => v.role === 'player' && !v.turn!.drawerReconnecting,
    );
    expect(view).toEqual(before);
    expect(view.secret!.choices!.map((c) => c.word)).toEqual(
      g.rooms.get(CODE)!.turn!.choices.map((c) => c.word),
    );
    await ben.main.state((v) => v.phase === 'CHOOSING');
    await screen.main.state((v) => v.phase === 'CHOOSING');
    expectNoSecrets(g, ben.main, ben.ink, screen.main, screen.ink, g.cy.main, g.cy.ink);
    // The choice the drawer makes after the reload is the turn's word.
    expect(await ana.main.emit('drawer:choose', { index: 1 })).toEqual({ ok: true });
    expect(g.rooms.get(CODE)!.turn!.word).toEqual(g.rooms.get(CODE)!.turn!.choices[1]);
  });

  it('in REVEAL, the next drawer comes back to their deal, and the others to the reveal only', async () => {
    const g = await midTurn();
    const timersBefore = g.timers.length;
    expect(await g.cy.main.emit('player:guess', { text: g.word })).toEqual({ ok: true });
    fireTimers(g, timersBefore, ALL_GUESSED_MS);
    const room = g.rooms.get(CODE)!;
    expect(room.phase).toBe('REVEAL');
    const upcoming = room.upcoming!;
    expect(upcoming.drawerPid).toBe(g.ben.pid);
    await g.ben.main.state<PlayerView>((v) => v.secret?.choices != null);
    const before = settled(g.ben.main.last());
    const cyBefore = settled(await g.cy.main.state((v) => v.phase === 'REVEAL'));

    await closePage(g, g.ben, g.ben.pid);
    const ben = await openPhone(g, KEY_BEN, 'Ben');
    await closePage(g, g.cy, g.cy.pid);
    const cy = await openPhone(g, KEY_CY, 'Cy');
    const view = await ben.main.state<PlayerView>(
      (v) => v.role === 'player' && v.players.every((p) => p.connected),
    );
    expect(view).toEqual(before);
    expect(view.secret!.choices!.map((c) => c.word)).toEqual(upcoming.choices.map((c) => c.word));
    expect(view.turn!.word).toBe(g.word);
    const cyView = await cy.main.state<PlayerView>(
      (v) => v.role === 'player' && v.players.every((p) => p.connected),
    );
    expect(cyView).toEqual(cyBefore);
    expect(cyView.secret).toBeNull();
    expectNoneOf(secretsOf(upcoming), cy.main, cy.ink, g.screen.main, g.screen.ink);
  });
});
