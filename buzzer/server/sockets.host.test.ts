import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COLLECTION_WINDOW_MS,
  NOT_HOST_ERROR,
  PLAYER_KICKED_ERROR,
  REOPEN_DELAY_MS,
  TITLE_CARD_MS,
} from '../shared/constants.js';
import type { Fx, HostView, View } from '../shared/types.js';
import type { ScreenView } from '../shared/types.js';
import {
  flush,
  hostJoin,
  openTable,
  playerJoin,
  record,
  screenJoin,
  serverDisconnect,
  start,
  stopAll,
  TOKEN,
} from './test/sockets.js';

beforeEach(() => {
  // Only the gateway's window and reopen timers are faked; socket I/O stays real.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  // The round log.
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await stopAll();
});

/** `openTable`, then a buzzes alone and the window closes: BUZZED with a as the winner. */
async function buzzedTable() {
  const table = await openTable();
  expect(await table.a.emitWithAck('player:buzz', {})).toEqual({ ok: true });
  vi.advanceTimersByTime(COLLECTION_WINDOW_MS);
  const all = [table.screen, table.host, table.a, table.b];
  await Promise.all(all.map(flush));
  expect(table.h.rooms.get('ABCD')).toMatchObject({ phase: 'BUZZED', winnerId: 'a' });
  return table;
}

describe('socket gateway: remaining host events', () => {
  it('rejects judge, undo, adjustScore, kick and settings from a player and a plain Screen', async () => {
    const { h, screen, a } = await buzzedTable();
    const before = h.rooms.get('ABCD');

    for (const c of [screen, a]) {
      const acks = await Promise.all([
        c.emitWithAck('host:judge', { result: 'correct' }),
        c.emitWithAck('host:undo', {}),
        c.emitWithAck('host:adjustScore', { playerId: 'a', delta: 100 }),
        c.emitWithAck('host:kick', { playerId: 'b' }),
        c.emitWithAck('host:settings', { wrongPenalty: true }),
      ]);
      expect(acks).toEqual(Array(5).fill({ ok: false, error: NOT_HOST_ERROR }));
    }
    expect(h.rooms.get('ABCD')).toBe(before);
  });

  it('lets a Screen holding the token judge and kick, and it still gets only ScreenView', async () => {
    const { h, a, b } = await buzzedTable();
    const tokenScreen = await h.connect();
    const states = record<View>(tokenScreen, 'state');
    expect(
      await tokenScreen.emitWithAck('screen:join', { code: 'ABCD', hostToken: TOKEN }),
    ).toEqual({ ok: true });

    expect(await tokenScreen.emitWithAck('host:judge', { result: 'correct' })).toEqual({
      ok: true,
    });
    expect(await tokenScreen.emitWithAck('host:adjustScore', { playerId: 'a', delta: 5 })).toEqual({
      ok: true,
    });
    expect(await tokenScreen.emitWithAck('host:kick', { playerId: 'b' })).toEqual({ ok: true });
    await flush(tokenScreen);

    expect(h.rooms.get('ABCD')!.players.a!.score).toBe(105);
    expect(b.connected).toBe(false);
    expect(a.connected).toBe(true);
    // The join view is BUZZED: no answer before reveal. Host notes never reach a Screen.
    expect(states[0]).toMatchObject({ role: 'screen', phase: 'BUZZED' });
    expect(JSON.stringify(states[0])).not.toContain('Answer-1-secret');
    for (const view of states) {
      expect(view.role).toBe('screen');
      expect(JSON.stringify(view)).not.toContain('Notes-1-secret');
    }
  });

  it('acks an invalid judge payload with an error and changes nothing', async () => {
    const { h, host } = await buzzedTable();
    const before = h.rooms.get('ABCD');
    const ack = await host.emitWithAck('host:judge', { result: 'maybe' } as never);
    expect(ack.ok).toBe(false);
    expect(h.rooms.get('ABCD')).toBe(before);
  });

  it('judges correct: fx correct to Screen, Host and both players, points scored, REVEAL', async () => {
    const { h, screen, host, a, b } = await buzzedTable();
    const fxs = [screen, host, a, b].map((c) => record<Fx>(c, 'fx'));

    expect(await host.emitWithAck('host:judge', { result: 'correct' })).toEqual({ ok: true });
    await Promise.all([screen, host, a, b].map(flush));

    for (const seen of fxs) expect(seen).toEqual([{ kind: 'correct', playerId: 'a', points: 100 }]);
    expect(h.rooms.get('ABCD')!.phase).toBe('REVEAL');
    expect(h.rooms.get('ABCD')!.players.a!.score).toBe(100);
  });

  it('judges wrong: fx wrong, then the buzzers reopen after 1.5 s with the winner locked out', async () => {
    const { h, screen, host, a, b } = await buzzedTable();
    const fxs = [screen, host, a, b].map((c) => record<Fx>(c, 'fx'));

    expect(await host.emitWithAck('host:judge', { result: 'wrong' })).toEqual({ ok: true });
    await Promise.all([screen, host, a, b].map(flush));
    for (const seen of fxs) expect(seen).toEqual([{ kind: 'wrong', playerId: 'a' }]);

    const states = record<View>(screen, 'state');
    vi.advanceTimersByTime(REOPEN_DELAY_MS - 1);
    expect(h.rooms.get('ABCD')!.phase).toBe('BUZZED');
    vi.advanceTimersByTime(1);
    expect(h.rooms.get('ABCD')).toMatchObject({ phase: 'OPEN', lockedOut: ['a'] });

    await flush(screen);
    expect(states.at(-1)).toMatchObject({ phase: 'OPEN' });
    // The locked-out winner's buzz no longer counts; the other player's does.
    expect(await a.emitWithAck('player:buzz', {})).toEqual({ ok: true });
    expect(h.rooms.get('ABCD')!.phase).toBe('OPEN');
    expect(await b.emitWithAck('player:buzz', {})).toEqual({ ok: true });
    expect(h.rooms.get('ABCD')!.phase).toBe('COLLECTING');
  });

  it('undoes a wrong judgement: back to BUZZED, and the pending reopen no longer fires', async () => {
    const { h, host } = await buzzedTable();
    await host.emitWithAck('host:judge', { result: 'wrong' });

    expect(await host.emitWithAck('host:undo', {})).toEqual({ ok: true });
    vi.advanceTimersByTime(REOPEN_DELAY_MS);
    expect(h.rooms.get('ABCD')).toMatchObject({ phase: 'BUZZED', winnerId: 'a', lockedOut: [] });
    expect(await host.emitWithAck('host:undo', {})).toEqual({
      ok: false,
      error: 'Nothing to undo',
    });
  });

  it('adjusts a score and changes settings, and the host sees both in its next state', async () => {
    const { h, host } = await openTable();
    const views = record<HostView>(host, 'state');

    expect(await host.emitWithAck('host:adjustScore', { playerId: 'b', delta: -50 })).toEqual({
      ok: true,
    });
    expect(await host.emitWithAck('host:settings', { wrongPenalty: true })).toEqual({ ok: true });
    await flush(host);

    expect(h.rooms.get('ABCD')!.players.b!.score).toBe(-50);
    expect(h.rooms.get('ABCD')!.settings.wrongPenalty).toBe(true);
    expect(JSON.stringify(views.at(-1))).toContain('"wrongPenalty":true');
    expect(await host.emitWithAck('host:adjustScore', { playerId: 'zz', delta: 1 })).toEqual({
      ok: false,
      error: 'Unknown player',
    });
  });

  it('rejects settings keys the schema does not know', async () => {
    const { h, host } = await openTable();
    const before = h.rooms.get('ABCD');
    const ack = await host.emitWithAck('host:settings', { hostToken: 'x' } as never);
    expect(ack.ok).toBe(false);
    expect(h.rooms.get('ABCD')).toBe(before);
  });

  it('kicks a player: their socket gets kicked, is disconnected, and cannot rejoin with the same id', async () => {
    const { h, screen, host, a, b } = await openTable();
    const kicked = new Promise<void>((resolve) => b.once('kicked', () => resolve()));
    const disconnected = new Promise<string>((resolve) => b.once('disconnect', resolve));
    const bStates = record<View>(b, 'state');
    const screenStates = record<View>(screen, 'state');

    expect(await host.emitWithAck('host:kick', { playerId: 'b' })).toEqual({ ok: true });
    await kicked;
    expect(await disconnected).toBe('io server disconnect');
    await Promise.all([screen, host, a].map(flush));

    expect(bStates).toEqual([]);
    expect(h.rooms.get('ABCD')!.players.b).toBeUndefined();
    expect(h.rooms.get('ABCD')!.kickedIds).toContain('b');
    expect(JSON.stringify(screenStates.at(-1))).not.toContain('Bob');
    // The other player stays connected.
    expect(a.connected).toBe(true);

    const again = await h.connect();
    expect(
      await again.emitWithAck('player:join', { code: 'ABCD', playerId: 'b', name: 'Bob' }),
    ).toEqual({ ok: false, error: PLAYER_KICKED_ERROR });
    expect(h.rooms.get('ABCD')!.players.b).toBeUndefined();
  });

  it('kicks every socket a player has open', async () => {
    const { h, host, a } = await openTable();
    // The same phone reconnected before its old socket dropped: two sockets for player a.
    const second = await h.connect();
    expect(
      await second.emitWithAck('player:join', { code: 'ABCD', playerId: 'a', name: 'Ann' }),
    ).toEqual({ ok: true });

    const outcomes = [a, second].map((c) =>
      Promise.all([
        new Promise<void>((resolve) => c.once('kicked', () => resolve())),
        new Promise<string>((resolve) => c.once('disconnect', resolve)),
      ]),
    );
    expect(await host.emitWithAck('host:kick', { playerId: 'a' })).toEqual({ ok: true });
    for (const [, reason] of await Promise.all(outcomes))
      expect(reason).toBe('io server disconnect');
  });

  it('kicks an unknown player with "Unknown player" and disconnects nobody', async () => {
    const { host, a, b } = await openTable();
    expect(await host.emitWithAck('host:kick', { playerId: 'zz' })).toEqual({
      ok: false,
      error: 'Unknown player',
    });
    await Promise.all([a, b].map(flush));
    expect(a.connected && b.connected).toBe(true);
  });

  it('kicking the unjudged winner reopens the buzzers for everyone else', async () => {
    const { h, host, a, b } = await buzzedTable();
    const kicked = new Promise<void>((resolve) => a.once('kicked', () => resolve()));
    expect(await host.emitWithAck('host:kick', { playerId: 'a' })).toEqual({ ok: true });
    await kicked;
    expect(h.rooms.get('ABCD')).toMatchObject({ phase: 'OPEN', winnerId: null });
    expect(await b.emitWithAck('player:buzz', {})).toEqual({ ok: true });
    expect(h.rooms.get('ABCD')!.phase).toBe('COLLECTING');
  });
});

describe('socket gateway: hostDevices', () => {
  it('counts each paired remote on the Screen, and not the Screen holding the token', async () => {
    const h = await start();
    const [screen, first, second] = await Promise.all([h.connect(), h.connect(), h.connect()]);
    const states = record<ScreenView>(screen, 'state');
    expect(await screenJoin(screen, TOKEN)).toEqual({ ok: true });
    expect(states.at(-1)!.hostDevices).toBe(0);

    expect(await hostJoin(first)).toEqual({ ok: true });
    await flush(screen);
    expect(states.at(-1)!.hostDevices).toBe(1);

    expect(await hostJoin(second)).toEqual({ ok: true });
    await flush(screen);
    expect(states.at(-1)!.hostDevices).toBe(2);
    expect(h.rooms.get('ABCD')!.hostDevices).toBe(2);
  });

  it('gives a pairing remote exactly one state, carrying the new count', async () => {
    const h = await start();
    const host = await h.connect();
    const states = record<HostView>(host, 'state');
    expect(await hostJoin(host)).toEqual({ ok: true });
    expect(states).toHaveLength(1);
    expect(h.rooms.get('ABCD')!.hostDevices).toBe(1);
  });

  it('counts down as remotes disconnect, and a player leaving changes nothing', async () => {
    const h = await start();
    const [screen, first, second, player] = await Promise.all([
      h.connect(),
      h.connect(),
      h.connect(),
      h.connect(),
    ]);
    await screenJoin(screen);
    await hostJoin(first);
    await hostJoin(second);
    await playerJoin(player, 'p1', 'Ana');
    const states = record<ScreenView>(screen, 'state');

    await serverDisconnect(h, first);
    await flush(screen);
    expect(states.at(-1)!.hostDevices).toBe(1);

    await serverDisconnect(h, second);
    await flush(screen);
    expect(states.at(-1)!.hostDevices).toBe(0);

    await serverDisconnect(h, player);
    expect(h.rooms.get('ABCD')!.hostDevices).toBe(0);
  });
});

describe('socket gateway: auto-open waits for the title card', () => {
  it('opens question 1 on every device 3 s after Start game', async () => {
    const h = await start();
    const [screen, host, a] = await Promise.all([h.connect(), h.connect(), h.connect()]);
    await screenJoin(screen);
    await hostJoin(host);
    await playerJoin(a, 'a', 'Ann');
    expect(await host.emitWithAck('host:settings', { autoOpenBuzzers: true })).toEqual({
      ok: true,
    });
    expect(await host.emitWithAck('host:start', {})).toEqual({ ok: true });
    await Promise.all([screen, a].map(flush));
    const states = record<View>(a, 'state');
    expect(h.rooms.get('ABCD')).toMatchObject({ phase: 'QUESTION', questionIndex: 0 });

    vi.advanceTimersByTime(TITLE_CARD_MS - 1);
    expect(h.rooms.get('ABCD')!.phase).toBe('QUESTION');
    vi.advanceTimersByTime(1);
    expect(h.rooms.get('ABCD')!.phase).toBe('OPEN');
    await Promise.all([screen, a].map(flush));
    expect(states.at(-1)).toMatchObject({ phase: 'OPEN', canBuzz: true });
  });
});
