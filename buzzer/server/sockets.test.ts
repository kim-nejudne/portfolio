import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUZZ_RATE_LIMIT,
  BUZZ_RATE_LIMITED_ERROR,
  NAME_TAKEN_ERROR,
  RENAME_RATE_LIMIT,
  RENAME_RATE_LIMITED_ERROR,
  SOCKET_MESSAGE_MAX_BYTES,
} from '../shared/constants.js';
import type { Ack, Fx, View } from '../shared/types.js';
import { generateHostToken, hashHostToken } from './hostToken.js';
import { makeBoardSet, makeQuestion, makeRoom, makeSet, T0 } from './test/rooms.js';
import {
  flush,
  hostJoin,
  nextState,
  playerJoin,
  record,
  recordStates,
  screenJoin,
  serverDisconnect,
  start,
  stopAll,
  TOKEN,
  type TestClient,
} from './test/sockets.js';

const TOKEN_HASH = hashHostToken(TOKEN);
const SECRETS = makeSet().questions.flatMap((q) => [q.answer, q.hostNotes!]);

afterEach(stopAll);

function nextFx(client: TestClient): Promise<Fx> {
  return new Promise((resolve) => client.once('fx', resolve));
}

describe('socket gateway: joins', () => {
  it('rejects host:join with a wrong token and sends no state', async () => {
    const h = await start();
    const host = await h.connect();
    const states = recordStates(host);
    expect(await hostJoin(host, generateHostToken())).toEqual({
      ok: false,
      error: 'Invalid host token',
    });
    expect(states).toEqual([]);
  });

  it('rejects screen:join with a wrong token', async () => {
    const h = await start();
    const screen = await h.connect();
    const states = recordStates(screen);
    expect(await screenJoin(screen, generateHostToken())).toEqual({
      ok: false,
      error: 'Invalid host token',
    });
    expect(states).toEqual([]);
  });

  it('gives a host with the right token the HostView, answers included', async () => {
    const h = await start();
    const host = await h.connect();
    const states = recordStates(host);
    expect(await hostJoin(host)).toEqual({ ok: true });
    expect(states).toHaveLength(1);
    expect(states[0]!.role).toBe('host');
    expect(JSON.stringify(states[0])).toContain('Answer-1-secret');
  });

  it('sends a Screen holding the hostToken only ScreenView, with no answer, notes or token hash', async () => {
    const h = await start();
    const screen = await h.connect();
    const states = recordStates(screen);
    expect(await screenJoin(screen, TOKEN)).toEqual({ ok: true });

    const player = await h.connect();
    const afterJoin = nextState(screen);
    await playerJoin(player, 'p1', 'Ana');
    await afterJoin;

    expect(states).toHaveLength(2);
    for (const view of states) {
      expect(view.role).toBe('screen');
      const json = JSON.stringify(view);
      for (const secret of [...SECRETS, TOKEN_HASH]) expect(json).not.toContain(secret);
    }
  });

  it('answers an unknown room with "Room not found"', async () => {
    const h = await start();
    const player = await h.connect();
    expect(
      await player.emitWithAck('player:join', { code: 'WXYZ', playerId: 'p1', name: 'Ana' }),
    ).toEqual({ ok: false, error: 'Room not found' });
  });

  it("puts a joining player's avatar into the Screen's and their own state, and keeps it on a reconnect", async () => {
    const h = await start();
    const screen = await h.connect();
    await screenJoin(screen);
    const player = await h.connect();
    const screenState = nextState(screen);
    const ownState = nextState(player);
    const join = { code: 'ABCD', playerId: 'p1', name: 'Ana', avatar: '🦊' };
    expect(await player.emitWithAck('player:join', join)).toEqual({ ok: true });
    expect(await screenState).toMatchObject({ players: [{ id: 'p1', avatar: '🦊' }] });
    expect(await ownState).toMatchObject({
      me: { avatar: '🦊' },
      lobby: [{ id: 'p1', avatar: '🦊' }],
    });

    player.disconnect();
    const again = await h.connect();
    expect(await again.emitWithAck('player:join', { ...join, avatar: '🐸' })).toEqual({ ok: true });
    expect(h.rooms.get('ABCD')!.players.p1?.avatar).toBe('🦊');
  });

  it('rejects a join with an avatar outside the list, and adds nobody', async () => {
    const h = await start();
    const player = await h.connect();
    const join = { code: 'ABCD', playerId: 'p1', name: 'Ana', avatar: '🐝' };
    const ack = await player.emitWithAck('player:join', join);
    expect(!ack.ok && ack.error).toMatch(/^Invalid player:join:/);
    expect(h.rooms.get('ABCD')!.players).toEqual({});
  });

  it('rejects a second join on the same socket', async () => {
    const h = await start();
    const player = await h.connect();
    await playerJoin(player, 'p1', 'Ana');
    expect(await screenJoin(player)).toEqual({ ok: false, error: 'Already joined' });
    expect(await playerJoin(player, 'p2', 'Bo')).toEqual({ ok: false, error: 'Already joined' });
    expect(Object.keys(h.rooms.get('ABCD')!.players)).toEqual(['p1']);
  });

  it('passes a reducer rejection through the ack, and the player gets no state', async () => {
    const h = await start();
    await playerJoin(await h.connect(), 'p1', 'Ana');
    const second = await h.connect();
    const states = recordStates(second);
    expect(await playerJoin(second, 'p2', 'ana')).toEqual({
      ok: false,
      error: 'That name is taken',
    });
    expect(states).toEqual([]);
  });

  it('tells the Screen and the other remotes, not players or the joiner, that a host joined', async () => {
    const h = await start();
    const screen = await h.connect();
    const remote = await h.connect();
    const player = await h.connect();
    const joiner = await h.connect();
    await screenJoin(screen, TOKEN);
    await hostJoin(remote);
    await playerJoin(player, 'p1');
    const paired: string[] = [];
    for (const [name, c] of Object.entries({ screen, remote, player, joiner })) {
      c.on('host:paired', () => paired.push(name));
    }
    const screenPaired = new Promise((resolve) => screen.once('host:paired', resolve));
    const remotePaired = new Promise((resolve) => remote.once('host:paired', resolve));

    expect(await hostJoin(joiner)).toEqual({ ok: true });
    await Promise.all([screenPaired, remotePaired]);
    // The server sends to everyone before it acks, so a round trip flushes anything still on its way.
    await player.emitWithAck('ping', { t: 0 });
    expect(paired.sort()).toEqual(['remote', 'screen']);
  });

  it('sends no host:paired for a host:join with a wrong token', async () => {
    const h = await start();
    const screen = await h.connect();
    await screenJoin(screen);
    let paired = 0;
    screen.on('host:paired', () => paired++);
    await hostJoin(await h.connect(), generateHostToken());
    await screen.emitWithAck('ping', { t: 0 });
    expect(paired).toBe(0);
  });
});

describe('socket gateway: validation and limits', () => {
  it('acks an invalid payload with an error naming the event, and changes nothing', async () => {
    const h = await start();
    const player = await h.connect();
    const states = recordStates(player);
    const ack = await player.emitWithAck('player:join', {
      code: 'ABCD',
      playerId: 'p1',
      name: '   ',
    });
    expect(ack.ok).toBe(false);
    expect(!ack.ok && ack.error).toMatch(/^Invalid player:join:/);
    expect(states).toEqual([]);
    expect(h.rooms.get('ABCD')!.players).toEqual({});
  });

  it('acks a payload that is not an object at all', async () => {
    const h = await start();
    const host = await h.connect();
    const ack = await (host.emitWithAck as (e: string, p: unknown) => Promise<Ack>)(
      'host:join',
      'ABCD',
    );
    expect(ack.ok).toBe(false);
  });

  it('closes a socket that sends a message over 100 KB', async () => {
    const h = await start();
    const player = await h.connect();
    const closed = new Promise<string>((resolve) => player.once('disconnect', resolve));
    player.emit(
      'player:join',
      { code: 'ABCD', playerId: 'p1', name: 'x'.repeat(SOCKET_MESSAGE_MAX_BYTES) },
      () => {},
    );
    expect(await closed).toBe('transport close');
    expect(h.rooms.get('ABCD')!.players).toEqual({});
  });

  it('rate-limits new players per IP, lets known players reconnect, and frees up after the window', async () => {
    const h = await start({ playerJoinLimit: { max: 2, windowMs: 60_000 } });
    const first = await h.connect();
    expect(await playerJoin(first, 'p1')).toEqual({ ok: true });
    expect(await playerJoin(await h.connect(), 'p2')).toEqual({ ok: true });
    expect(await playerJoin(await h.connect(), 'p3')).toEqual({
      ok: false,
      error: 'Too many joins from this network. Try again in a minute.',
    });

    await serverDisconnect(h, first);
    expect(await playerJoin(await h.connect(), 'p1')).toEqual({ ok: true });

    h.advance(60_000);
    expect(await playerJoin(await h.connect(), 'p3')).toEqual({ ok: true });
  });
  it('lets 20 bots from one IP join at once under the default limit (Dev tool: fake players)', async () => {
    const h = await start();
    const bots = await Promise.all(Array.from({ length: 20 }, () => h.connect()));
    const acks = await Promise.all(bots.map((c, i) => playerJoin(c, `bot-${i + 1}`)));
    expect(acks.every((ack) => ack.ok)).toBe(true);
    expect(Object.keys(h.rooms.get('ABCD')!.players)).toHaveLength(20);
  });
});

describe('socket gateway: state broadcast', () => {
  it('sends Screen, Host and every player a fresh role-filtered state, then fx join, after a join', async () => {
    const h = await start();
    const screen = await h.connect();
    const host = await h.connect();
    const ana = await h.connect();
    await screenJoin(screen);
    await hostJoin(host);
    await playerJoin(ana, 'p1', 'Ana');

    const bo = await h.connect();
    const views = [screen, host, ana].map(nextState);
    const fxs = [screen, host, ana].map(nextFx);
    const boStates = recordStates(bo);
    await playerJoin(bo, 'p2', 'Bo');
    const [screenView, hostView, anaView] = await Promise.all(views);

    expect(screenView!.role).toBe('screen');
    expect(hostView!.role).toBe('host');
    expect(anaView!.role).toBe('player');
    for (const view of [screenView!, hostView!]) {
      expect(view.role !== 'player' && view.players.map((p) => p.name)).toEqual(['Ana', 'Bo']);
    }
    for (const [view, id] of [
      [anaView!, 'p1'],
      [boStates[0]!, 'p2'],
    ] as const) {
      expect(view.role === 'player' && [view.me.id, view.playerCount]).toEqual([id, 2]);
    }
    expect(await Promise.all(fxs)).toEqual(Array(3).fill({ kind: 'join', playerId: 'p2' }));
  });

  it('marks a player disconnected when their socket drops, and a reconnect keeps the same id and score', async () => {
    const h = await start();
    const host = await h.connect();
    await hostJoin(host);
    const phone = await h.connect();
    await playerJoin(phone, 'p1', 'Ana');
    const room = h.rooms.get('ABCD')!;
    h.rooms.set({ ...room, players: { p1: { ...room.players.p1!, score: 300 } } });

    const dropped = nextState(host);
    await serverDisconnect(h, phone);
    const afterDrop = await dropped;
    expect(afterDrop.role === 'host' && afterDrop.players).toMatchObject([
      { id: 'p1', connected: false },
    ]);

    const again = await h.connect();
    const states = recordStates(again);
    const back = nextState(host);
    expect(await playerJoin(again, 'p1', 'Someone else')).toEqual({ ok: true });
    const view = states[0]!;
    expect(view.role).toBe('player');
    expect(view.role === 'player' && view.me).toMatchObject({
      id: 'p1',
      name: 'Ana',
      score: 300,
    });
    const afterReturn = await back;
    expect(afterReturn.role === 'host' && afterReturn.players).toMatchObject([
      { id: 'p1', connected: true },
    ]);
    expect(Object.keys(h.rooms.get('ABCD')!.players)).toEqual(['p1']);
  });

  it('keeps a player connected when the old socket drops after the new one joined', async () => {
    const h = await start();
    const oldPhone = await h.connect();
    await playerJoin(oldPhone, 'p1', 'Ana');
    const newPhone = await h.connect();
    await playerJoin(newPhone, 'p1', 'Ana');

    await serverDisconnect(h, oldPhone);
    expect(h.rooms.get('ABCD')!.players.p1!.connected).toBe(true);
  });

  it('bumps lastActivityAt on every join, so the sweeper does not close a room in use', async () => {
    const h = await start();
    h.advance(1000);
    await screenJoin(await h.connect());
    expect(h.rooms.get('ABCD')!.lastActivityAt).toBe(T0 + 1000);
    h.advance(1000);
    await hostJoin(await h.connect());
    expect(h.rooms.get('ABCD')!.lastActivityAt).toBe(T0 + 2000);
    h.advance(1000);
    await playerJoin(await h.connect(), 'p1');
    expect(h.rooms.get('ABCD')!.lastActivityAt).toBe(T0 + 3000);
  });
});

/** Screen, host and players a and b, joined, still in LOBBY, every broadcast landed. */
async function lobbyTable() {
  const h = await start();
  const [screen, host, a, b] = await Promise.all([
    h.connect(),
    h.connect(),
    h.connect(),
    h.connect(),
  ]);
  await screenJoin(screen);
  await hostJoin(host);
  await playerJoin(a, 'a', 'Ann');
  await playerJoin(b, 'b', 'Bob');
  await Promise.all([screen, host, a, b].map(flush));
  return { h, screen, host, a, b };
}

describe('socket gateway: player:practice', () => {
  const practice = (c: TestClient): Promise<Ack> => c.emitWithAck('player:practice', {});

  it('sends fx practice to Screen, Host and every player, and no new state', async () => {
    const { h, screen, host, a, b } = await lobbyTable();
    const clients = [screen, host, a, b];
    const states = clients.map(recordStates);
    const fxs = clients.map((c) => record<Fx>(c, 'fx'));
    const before = h.rooms.get('ABCD');

    expect(await practice(b)).toEqual({ ok: true });
    await Promise.all(clients.map(flush));

    expect(fxs).toEqual(Array(4).fill([{ kind: 'practice', playerId: 'b' }]));
    expect(states).toEqual(Array(4).fill([]));
    expect(h.rooms.get('ABCD')).toBe(before);
  });

  it("shares player:buzz's per-socket limit", async () => {
    const { h, a, b } = await lobbyTable();
    // A lobby buzz is ignored by the reducer but still spends the socket's budget.
    for (let i = 0; i < BUZZ_RATE_LIMIT.max - 1; i++) {
      expect(await a.emitWithAck('player:buzz', {})).toEqual({ ok: true });
    }
    expect(await practice(a)).toEqual({ ok: true });
    expect(await practice(a)).toEqual({ ok: false, error: BUZZ_RATE_LIMITED_ERROR });
    expect(await practice(b)).toEqual({ ok: true });

    h.advance(BUZZ_RATE_LIMIT.windowMs);
    expect(await practice(a)).toEqual({ ok: true });
  });

  it('rejects a practice buzz once the game has started', async () => {
    const { host, a } = await lobbyTable();
    expect(await host.emitWithAck('host:start', {})).toEqual({ ok: true });
    expect(await practice(a)).toEqual({ ok: false, error: 'Not allowed in this phase' });
  });

  it('rejects a practice buzz from a socket that has not joined as a player', async () => {
    const { host } = await lobbyTable();
    expect(await practice(host)).toEqual({ ok: false, error: 'Join the game first' });
  });
});

/** The names in a view's player list, whatever the role. */
const names = (view: View) =>
  view.role === 'player' ? (view.lobby ?? []).map((p) => p.name) : view.players.map((p) => p.name);

describe('socket gateway: player:rename', () => {
  const rename = (c: TestClient, name: string): Promise<Ack> =>
    c.emitWithAck('player:rename', { name });

  it('sends every view the new name', async () => {
    const { screen, host, a, b } = await lobbyTable();
    const clients = [screen, host, a, b];
    const states = clients.map(recordStates);

    expect(await rename(a, '  Annie ')).toEqual({ ok: true });
    await Promise.all(clients.map(flush));

    for (const seen of states) expect(seen.map(names)).toEqual([['Annie', 'Bob']]);
    expect(states[2]![0]).toMatchObject({ me: { id: 'a', name: 'Annie' } });
  });

  it('refuses a name another player has', async () => {
    const { a } = await lobbyTable();
    expect(await rename(a, 'BOB')).toEqual({ ok: false, error: NAME_TAKEN_ERROR });
  });

  it('refuses a rename once the game has started', async () => {
    const { host, a } = await lobbyTable();
    await host.emitWithAck('host:start', {});
    expect(await rename(a, 'Annie')).toEqual({ ok: false, error: 'Not allowed in this phase' });
  });

  it(`allows ${RENAME_RATE_LIMIT.max} renames per socket in each window`, async () => {
    const { h, a, b } = await lobbyTable();
    for (let i = 0; i < RENAME_RATE_LIMIT.max; i++) {
      expect(await rename(a, `Ann${i}`)).toEqual({ ok: true });
    }
    expect(await rename(a, 'Annie')).toEqual({ ok: false, error: RENAME_RATE_LIMITED_ERROR });
    expect(await rename(b, 'Bobby')).toEqual({ ok: true });

    h.advance(RENAME_RATE_LIMIT.windowMs);
    expect(await rename(a, 'Annie')).toEqual({ ok: true });
  });

  it('refuses a rename from a socket that has not joined as a player', async () => {
    const { screen } = await lobbyTable();
    expect(await rename(screen, 'Annie')).toEqual({ ok: false, error: 'Join the game first' });
  });
});

describe('socket gateway: player:leave', () => {
  const leave = (c: TestClient): Promise<Ack> => c.emitWithAck('player:leave', {});

  it('removes the player from every view and sends the leaver no more state', async () => {
    const { h, screen, host, a, b } = await lobbyTable();
    const states = [screen, host, b].map(recordStates);
    const leaverStates = recordStates(a);

    expect(await leave(a)).toEqual({ ok: true });
    await Promise.all([screen, host, b].map(flush));

    for (const seen of states) expect(seen.map(names)).toEqual([['Bob']]);
    expect(leaverStates).toEqual([]);
    expect(h.rooms.get('ABCD')!.kickedIds).toEqual([]);
    expect(a.connected).toBe(true);
  });

  it('lets the same connection join again as a new player', async () => {
    const { h, host, a } = await lobbyTable();
    await host.emitWithAck('host:start', {});
    await leave(a);

    const back = nextState(a);
    expect(await playerJoin(a, 'a2', 'Ann')).toEqual({ ok: true });
    expect(await back).toMatchObject({ role: 'player', me: { id: 'a2', name: 'Ann', score: 0 } });
    expect(Object.keys(h.rooms.get('ABCD')!.players).sort()).toEqual(['a2', 'b']);
  });

  it('dispatches no disconnect when the leaver closes the tab', async () => {
    const { h, a } = await lobbyTable();
    await leave(a);
    const before = h.rooms.get('ABCD');
    await serverDisconnect(h, a);
    expect(h.rooms.get('ABCD')).toBe(before);
  });

  it('refuses a second leave on the same connection', async () => {
    const { a } = await lobbyTable();
    await leave(a);
    expect(await leave(a)).toEqual({ ok: false, error: 'Join the game first' });
  });
});

describe('socket gateway: player:answer', () => {
  beforeEach(() => {
    // Only the gateway's answer timer is faked; socket I/O stays real.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const pick = (c: TestClient, choice: unknown): Promise<Ack> =>
    c.emitWithAck('player:answer', { choice } as { choice: number });

  /** Lobby table whose question 1 is a choice question (B, "Lyon", correct), opened: ANSWERING. */
  async function answeringTable() {
    const set = makeSet();
    set.questions[0] = makeQuestion(1, {
      mode: 'choice',
      choices: ['Paris', 'Lyon', 'Nice'],
      correctChoice: 1,
      answer: 'Lyon',
    });
    const h = await start({ room: makeRoom({ set, hostTokenHash: TOKEN_HASH }) });
    const [screen, host, a, b] = await Promise.all([
      h.connect(),
      h.connect(),
      h.connect(),
      h.connect(),
    ]);
    await screenJoin(screen);
    await hostJoin(host);
    await playerJoin(a, 'a', 'Ann');
    await playerJoin(b, 'b', 'Bob');
    expect(await host.emitWithAck('host:start', {})).toEqual({ ok: true });
    expect(await host.emitWithAck('host:open', {})).toEqual({ ok: true });
    await Promise.all([screen, host, a, b].map(flush));
    expect(h.rooms.get('ABCD')!.phase).toBe('ANSWERING');
    return { h, screen, host, a, b };
  }

  it('records an answer and sends every view the count, with no correct choice for Screen or phones', async () => {
    const { h, screen, host, a, b } = await answeringTable();
    const states = [screen, a, b, host].map(recordStates);
    expect(await pick(a, 1)).toEqual({ ok: true });
    await Promise.all([screen, host, a, b].map(flush));

    expect(h.rooms.get('ABCD')!.answers).toEqual({ a: 1 });
    const [toScreen, toA, toB, toHost] = states.map((s) => s.at(-1)!);
    expect(toScreen).toMatchObject({ choice: { answered: 1, expected: 2 } });
    expect(toA).toMatchObject({ choice: { mine: 1 } });
    expect(toB).toMatchObject({ choice: { mine: null } });
    for (const view of [toScreen, toA, toB]) {
      expect(JSON.stringify(view)).not.toContain('correctChoice');
    }
    expect(toHost).toMatchObject({ choice: { correctChoice: 1, answers: { a: 1 } } });
  });

  it('scores and reveals once every player has answered', async () => {
    const { h, screen, host, a, b } = await answeringTable();
    const states = recordStates(screen);
    expect(await pick(a, 1)).toEqual({ ok: true });
    expect(await pick(b, 0)).toEqual({ ok: true });
    await Promise.all([screen, host, a, b].map(flush));

    const room = h.rooms.get('ABCD')!;
    expect(room.phase).toBe('REVEAL');
    expect([room.players.a!.score, room.players.b!.score]).toEqual([100, 0]);
    expect(states.at(-1)).toMatchObject({
      phase: 'REVEAL',
      choice: { correctChoice: 1, counts: [1, 1, 0] },
    });
  });

  it('closes and scores when the answer time runs out', async () => {
    const { h, a } = await answeringTable();
    expect(await pick(a, 1)).toEqual({ ok: true });
    vi.advanceTimersByTime(10_000 - 1);
    expect(h.rooms.get('ABCD')!.phase).toBe('ANSWERING');
    h.advance(10_000);
    vi.advanceTimersByTime(1);
    expect(h.rooms.get('ABCD')!.phase).toBe('REVEAL');
    expect(h.rooms.get('ABCD')!.players.a!.score).toBe(100);
  });

  it('acks an invalid choice with an error naming the event, and changes nothing', async () => {
    const { h, a } = await answeringTable();
    for (const choice of ['B', 4, -1, 1.5]) {
      const ack = await pick(a, choice);
      expect(ack.ok).toBe(false);
      expect(!ack.ok && ack.error).toContain('Invalid player:answer');
    }
    expect(await pick(a, 3)).toEqual({ ok: false, error: 'No such choice' });
    expect(h.rooms.get('ABCD')!.answers).toEqual({});
  });

  it('refuses an answer from a socket that has not joined as a player', async () => {
    const { host } = await answeringTable();
    expect(await pick(host, 0)).toEqual({ ok: false, error: 'Join the game first' });
  });

  it("shares player:buzz's per-socket limit", async () => {
    const { a } = await answeringTable();
    for (let i = 0; i < BUZZ_RATE_LIMIT.max; i++) {
      expect(await pick(a, i % 2)).toEqual({ ok: true });
    }
    expect(await pick(a, 0)).toEqual({ ok: false, error: BUZZ_RATE_LIMITED_ERROR });
  });
});

describe('socket gateway: typed answers', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const type = (c: TestClient, text: unknown): Promise<Ack> =>
    c.emitWithAck('player:answer', { text } as { text: string });

  /** Lobby table whose question 1 is typed ("Lyon", or "Lugdunum" in the notes), opened. */
  async function typedTable() {
    const set = makeSet();
    set.questions[0] = makeQuestion(1, { mode: 'typed', answer: 'Lyon', hostNotes: 'Lugdunum' });
    const h = await start({ room: makeRoom({ set, hostTokenHash: TOKEN_HASH }) });
    const [screen, host, a, b] = await Promise.all([
      h.connect(),
      h.connect(),
      h.connect(),
      h.connect(),
    ]);
    await screenJoin(screen);
    await hostJoin(host);
    await playerJoin(a, 'a', 'Ann');
    await playerJoin(b, 'b', 'Bob');
    expect(await host.emitWithAck('host:start', {})).toEqual({ ok: true });
    expect(await host.emitWithAck('host:open', {})).toEqual({ ok: true });
    await Promise.all([screen, host, a, b].map(flush));
    expect(h.rooms.get('ABCD')!.phase).toBe('ANSWERING');
    return { h, screen, host, a, b };
  }

  it('records a typed answer; only the host and the sender see its text', async () => {
    const { h, screen, host, a, b } = await typedTable();
    const states = [screen, a, b, host].map(recordStates);
    expect(await type(a, '  lyon ')).toEqual({ ok: true });
    await Promise.all([screen, host, a, b].map(flush));

    expect(h.rooms.get('ABCD')!.typed?.answers).toEqual({ a: 'lyon' });
    const [toScreen, toA, toB, toHost] = states.map((s) => s.at(-1)!);
    expect(toScreen).toMatchObject({ typed: { answered: 1, expected: 2, closed: false } });
    expect(toA).toMatchObject({ typed: { mine: 'lyon' } });
    for (const view of [toScreen, toB]) expect(JSON.stringify(view)).not.toContain('lyon');
    expect(toHost).toMatchObject({
      typed: { groups: [{ key: 'lyon', playerIds: ['a'], preMarked: true, correct: true }] },
    });
  });

  it('locks the answers when the time runs out, then the host marks and reveals to score', async () => {
    const { h, host, a, b } = await typedTable();
    expect(await type(a, 'Lyon')).toEqual({ ok: true });
    expect(await type(b, 'Lugdunum!')).toEqual({ ok: true });
    h.advance(10_000);
    vi.advanceTimersByTime(10_000);
    expect(h.rooms.get('ABCD')!.phase).toBe('ANSWERING');
    expect(h.rooms.get('ABCD')!.typed?.closed).toBe(true);
    expect(await type(a, 'Paris')).toEqual({ ok: false, error: 'Answers are closed' });

    expect(await host.emitWithAck('host:markTyped', { groups: ['lyon', 'lugdunum!'] })).toEqual({
      ok: true,
    });
    expect(await host.emitWithAck('host:reveal', {})).toEqual({ ok: true });
    const room = h.rooms.get('ABCD')!;
    expect(room.phase).toBe('REVEAL');
    expect([room.players.a!.score, room.players.b!.score]).toEqual([100, 100]);
  });

  it('refuses host:markTyped from a player, and invalid texts', async () => {
    const { a } = await typedTable();
    const mark = await a.emitWithAck('host:markTyped', { groups: ['lyon'] });
    expect(mark.ok).toBe(false);
    for (const text of ['', '   ', 'x'.repeat(81), 3]) {
      const ack = await type(a, text);
      expect(!ack.ok && ack.error).toContain('Invalid player:answer');
    }
    expect(await a.emitWithAck('player:answer', { choice: 0 })).toEqual({
      ok: false,
      error: 'Type your answer',
    });
  });
});

describe('socket gateway: category board', () => {
  /** A board set's table: a Screen, the host and one player, started on the board. */
  async function boardTable() {
    const h = await start({ room: makeRoom({ set: makeBoardSet(2), hostTokenHash: TOKEN_HASH }) });
    const [screen, host, a] = await Promise.all([h.connect(), h.connect(), h.connect()]);
    await screenJoin(screen);
    await hostJoin(host);
    await playerJoin(a, 'a', 'Ann');
    expect(await host.emitWithAck('host:start', {})).toEqual({ ok: true });
    await Promise.all([screen, host, a].map(flush));
    return { h, screen, host, a };
  }

  it('host:pick plays the tile, and every role gets the board with it used', async () => {
    const { h, screen, host, a } = await boardTable();
    const states = [screen, host, a].map(recordStates);
    expect(await host.emitWithAck('host:pick', { questionIndex: 4 })).toEqual({ ok: true });
    await Promise.all([screen, host, a].map(flush));

    const room = h.rooms.get('ABCD')!;
    expect(room).toMatchObject({ phase: 'QUESTION', questionIndex: 4, usedQuestionIds: ['q5'] });
    const [toScreen, toHost, toA] = states.map((s) => s.at(-1)!);
    for (const view of [toScreen, toHost]) {
      if (view?.role !== 'screen' && view?.role !== 'host')
        throw new Error('Expected a board view');
      expect(view).toMatchObject({ phase: 'QUESTION', questionIndex: 4 });
      expect(view.board?.columns[1]?.tiles[1]).toEqual({
        questionIndex: 4,
        points: 200,
        used: true,
      });
    }
    expect(toA).toMatchObject({ phase: 'QUESTION', questionIndex: 4 });
  });

  it('refuses host:pick from a player, a used tile and a bad payload', async () => {
    const { host, a } = await boardTable();
    expect((await a.emitWithAck('host:pick', { questionIndex: 0 })).ok).toBe(false);
    expect(await host.emitWithAck('host:pick', { questionIndex: 0 })).toEqual({ ok: true });
    expect(await host.emitWithAck('host:prev', {})).toEqual({ ok: true });
    expect(await host.emitWithAck('host:pick', { questionIndex: 0 })).toEqual({
      ok: false,
      error: 'That tile has been played',
    });
    const bad = await host.emitWithAck('host:pick', { questionIndex: -1 });
    expect(!bad.ok && bad.error).toContain('Invalid host:pick');
  });
});
