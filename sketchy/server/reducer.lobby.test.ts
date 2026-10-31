import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS, NAME_OF_DISCONNECTED_ERROR, PLAYER_COLORS } from '../shared/constants.js';
import type { Action, Avatar } from '../shared/types.js';
import { reduce } from './reducer.js';
import {
  NEW_PHONE,
  SCREEN,
  SCREEN_HOST,
  T0,
  asPlayer,
  makeRoom,
  started,
  step,
  withPlayers,
} from './test/rooms.js';

const join = (
  keyHash: string,
  name: string,
  takeOver?: boolean,
  avatar: Avatar = '🦊',
): Action => ({
  type: 'player:join',
  by: NEW_PHONE,
  keyHash,
  name,
  avatar,
  ...(takeOver === undefined ? {} : { takeOver }),
});

describe('reduce: general', () => {
  it('rejects an unknown action with no change', () => {
    const room = makeRoom();
    const result = reduce(room, { type: 'host:dance' } as unknown as Action, T0);
    expect(result).toEqual({ ok: false, error: 'unknownAction' });
  });

  it('rejects an action whose feature has not landed yet', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const result = reduce(
      room,
      { type: 'player:rename', by: asPlayer(pids[0]!), name: 'Anna' },
      T0,
    );
    expect(result).toEqual({ ok: false, error: 'notAvailable' });
  });

  it('never mutates the input room', () => {
    const room = makeRoom();
    const before = structuredClone(room);
    step(room, join('k1', 'Ana'), T0);
    expect(room).toEqual(before);
  });

  it('is deterministic: the same room, action and time give the same result', () => {
    const { room } = withPlayers(['Ana', 'Ben']);
    const a = reduce(room, { type: 'host:start', by: SCREEN_HOST }, T0 + 50);
    const b = reduce(room, { type: 'host:start', by: SCREEN_HOST }, T0 + 50);
    expect(a).toEqual(b);
  });
});

describe('player:join', () => {
  it('adds a new player with a pid, the first colour, score 0, connected, joined now', () => {
    const { room, effects } = step(makeRoom(), join('k1', 'Ana'), T0 + 5);
    const players = Object.values(room.players);
    expect(players).toHaveLength(1);
    const ana = players[0]!;
    expect(ana).toMatchObject({
      name: 'Ana',
      keyHash: 'k1',
      color: PLAYER_COLORS[0],
      avatar: '🦊',
      score: 0,
      connected: true,
      hidden: false,
      joinedAt: T0 + 5,
    });
    expect(ana.pid).toMatch(/^[\w-]{1,64}$/);
    expect(room.players[ana.pid]).toBe(ana);
    expect(effects).toContainEqual({
      type: 'fx',
      to: 'screen',
      fx: { kind: 'join', pid: ana.pid },
    });
  });

  it('crowns the first joiner only', () => {
    const first = step(makeRoom(), join('k1', 'Ana'), T0);
    const ana = Object.values(first.room.players)[0]!.pid;
    expect(first.room.crownPid).toBe(ana);
    expect(first.effects).toContainEqual({ type: 'fx', to: { pid: ana }, fx: { kind: 'crowned' } });

    const second = step(first.room, join('k2', 'Ben'), T0 + 1);
    expect(second.room.crownPid).toBe(ana);
    expect(second.effects.some((e) => e.type === 'fx' && e.fx.kind === 'crowned')).toBe(false);
  });

  it('gives each new player the next unused colour and a distinct pid', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    expect(new Set(pids).size).toBe(3);
    expect(pids.map((pid) => room.players[pid]!.color)).toEqual(PLAYER_COLORS.slice(0, 3));
  });

  it('reconnects the player with the same keyHash, keeping pid and score', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const ana = pids[0]!;
    const scored = {
      ...room,
      players: { ...room.players, [ana]: { ...room.players[ana]!, score: 270, connected: false } },
    };
    const { room: after } = step(scored, join('key-Ana', 'Ana'), T0 + 100);
    expect(Object.keys(after.players)).toHaveLength(2);
    expect(after.players[ana]).toMatchObject({ connected: true, score: 270 });
  });

  it('stores the avatar each new player picked; two players may share one (F53)', () => {
    const first = step(makeRoom(), join('k1', 'Ana', undefined, '🐙'), T0).room;
    const { room } = step(first, join('k2', 'Ben', undefined, '🐙'), T0 + 1);
    expect(Object.values(room.players).map((p) => [p.name, p.avatar])).toEqual([
      ['Ana', '🐙'],
      ['Ben', '🐙'],
    ]);
  });

  it('a reconnect keeps the stored avatar and ignores the one it sends (F53)', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const ana = pids[0]!;
    const away = step(room, { type: 'sys:disconnected', pid: ana }, T0 + 10).room;
    const { room: after } = step(away, join('key-Ana', 'Ana', undefined, '🚀'), T0 + 20);
    expect(after.players[ana]).toMatchObject({ connected: true, avatar: '🦊' });
  });

  it('a takeover keeps the disconnected player’s avatar, not the new phone’s pick (F53)', () => {
    const { room: joined, pids } = withPlayers(['Ana', 'Ben']);
    const ana = pids[0]!;
    const room = step(joined, { type: 'sys:disconnected', pid: ana }, T0 + 10).room;
    const { room: after } = step(room, join('new-key', 'Ana', true, '🚀'), T0 + 20);
    expect(after.players[ana]).toMatchObject({ keyHash: 'new-key', avatar: '🦊' });
  });

  it('rejects a name a connected player holds, ignoring case', () => {
    const { room } = withPlayers(['Ana']);
    expect(reduce(room, join('k9', 'ana'), T0)).toEqual({ ok: false, error: 'nameTaken' });
  });

  it('rejects the name of a disconnected player unless takeOver, which hands over pid and score', () => {
    const { room: joined, pids } = withPlayers(['Ana', 'Ben']);
    const ana = pids[0]!;
    const room = step(joined, { type: 'sys:disconnected', pid: ana }, T0 + 10).room;

    expect(reduce(room, join('new-key', 'Ana'), T0 + 20)).toEqual({
      ok: false,
      error: NAME_OF_DISCONNECTED_ERROR,
    });

    const { room: after, effects } = step(room, join('new-key', 'Ana', true), T0 + 20);
    expect(Object.keys(after.players)).toHaveLength(2);
    expect(after.players[ana]).toMatchObject({ keyHash: 'new-key', connected: true });
    expect(after.crownPid).toBe(ana);
    expect(effects).toContainEqual({
      type: 'fx',
      to: 'screen',
      fx: { kind: 'rejoined', pid: ana },
    });
  });

  it('rejects a kicked key', () => {
    const room = makeRoom({ kickedKeyHashes: ['bad-key'] });
    expect(reduce(room, join('bad-key', 'Zed'), T0)).toEqual({ ok: false, error: 'kicked' });
  });

  it(`rejects a new player when the room has ${MAX_PLAYERS}`, () => {
    const names = Array.from({ length: MAX_PLAYERS }, (_, i) => `P${i}`);
    const { room } = withPlayers(names);
    expect(reduce(room, join('k-extra', 'Extra'), T0)).toEqual({ ok: false, error: 'roomFull' });
    // A full room still lets its own players reconnect.
    expect(reduce(room, join('key-P3', 'P3'), T0).ok).toBe(true);
  });

  it('works mid-game: the joiner is a player who can guess this turn', () => {
    const { room } = started();
    const { room: after } = step(room, join('k-late', 'Dee'), T0 + 2000);
    expect(after.phase).toBe('DRAWING');
    expect(Object.values(after.players).map((p) => p.name)).toContain('Dee');
  });
});

describe('player:leave', () => {
  it('removes the player', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const { room: after } = step(room, { type: 'player:leave', by: asPlayer(pids[1]!) }, T0 + 10);
    expect(Object.keys(after.players)).toEqual([pids[0]]);
  });

  it('passes the crown to the longest-connected remaining player', () => {
    const { room: joined, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    const [ana, ben, cy] = pids as [string, string, string];
    // Ben is disconnected, so the crown skips him for Cy.
    const room = step(joined, { type: 'sys:disconnected', pid: ben }, T0 + 5).room;
    const { room: after, effects } = step(
      room,
      { type: 'player:leave', by: asPlayer(ana) },
      T0 + 10,
    );
    expect(after.crownPid).toBe(cy);
    expect(effects).toContainEqual({ type: 'fx', to: { pid: cy }, fx: { kind: 'crowned' } });
  });

  it('leaves nobody crowned when the last player leaves', () => {
    const { room, pids } = withPlayers(['Ana']);
    const { room: after } = step(room, { type: 'player:leave', by: asPlayer(pids[0]!) }, T0 + 10);
    expect(after.crownPid).toBeNull();
    expect(after.players).toEqual({});
  });

  it('rejects a leave from a Screen or an unknown pid', () => {
    const { room } = withPlayers(['Ana']);
    expect(reduce(room, { type: 'player:leave', by: SCREEN }, T0)).toEqual({
      ok: false,
      error: 'notPlayer',
    });
    expect(reduce(room, { type: 'player:leave', by: asPlayer('ghost') }, T0)).toEqual({
      ok: false,
      error: 'unknownPlayer',
    });
  });
});

describe('host:start', () => {
  it('goes to CHOOSING, turn 1 of cycle 1, with the turn order in join order', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    const { room: after } = step(room, { type: 'host:start', by: SCREEN_HOST }, T0 + 100);
    expect(after.phase).toBe('CHOOSING');
    expect(after.cycle).toBe(1);
    expect(after.turnOrder).toEqual(pids);
    expect(after.turn).toMatchObject({ id: 1, cycle: 1, drawerPid: pids[0] });
    expect(after.timerEpoch).toBe(room.timerEpoch + 1);
    expect(after.session.firstDrawerJoinedAt).toBe(room.players[pids[0]!]!.joinedAt);
  });

  it('is allowed for the crown holder', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const result = reduce(room, { type: 'host:start', by: asPlayer(pids[0]!, true) }, T0 + 100);
    expect(result.ok).toBe(true);
  });

  it('rejects a sender without the host role', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const notHost = { ok: false, error: 'notHost' };
    expect(reduce(room, { type: 'host:start', by: SCREEN }, T0)).toEqual(notHost);
    expect(reduce(room, { type: 'host:start', by: asPlayer(pids[1]!) }, T0)).toEqual(notHost);
    // isHost on a player who doesn't hold the crown is not trusted.
    expect(reduce(room, { type: 'host:start', by: asPlayer(pids[1]!, true) }, T0)).toEqual(notHost);
  });

  it('needs at least 2 connected players', () => {
    const { room: one } = withPlayers(['Ana']);
    expect(reduce(one, { type: 'host:start', by: SCREEN_HOST }, T0)).toEqual({
      ok: false,
      error: 'notEnoughPlayers',
    });

    const { room: two, pids } = withPlayers(['Ana', 'Ben']);
    const away = step(two, { type: 'sys:disconnected', pid: pids[1]! }, T0 + 5).room;
    expect(reduce(away, { type: 'host:start', by: SCREEN_HOST }, T0 + 10)).toEqual({
      ok: false,
      error: 'notEnoughPlayers',
    });
  });

  it('is rejected outside LOBBY', () => {
    const { room } = started();
    expect(reduce(room, { type: 'host:start', by: SCREEN_HOST }, T0 + 2000)).toEqual({
      ok: false,
      error: 'wrongPhase',
    });
  });

  it('skips a disconnected player for the first turn', () => {
    const { room: joined, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    const room = step(joined, { type: 'sys:disconnected', pid: pids[0]! }, T0 + 5).room;
    const { room: after } = step(room, { type: 'host:start', by: SCREEN_HOST }, T0 + 10);
    expect(after.turn?.drawerPid).toBe(pids[1]);
  });
});

describe('gateway actions', () => {
  it('sys:connected and sys:disconnected update connected', () => {
    const { room, pids } = withPlayers(['Ana']);
    const pid = pids[0]!;
    const off = step(room, { type: 'sys:disconnected', pid }, T0 + 1).room;
    expect(off.players[pid]!.connected).toBe(false);
    expect(off.crownPid).toBe(pid); // the crown stays on disconnect
    const on = step(off, { type: 'sys:connected', pid }, T0 + 2).room;
    expect(on.players[pid]!.connected).toBe(true);
    expect(reduce(room, { type: 'sys:connected', pid: 'ghost' }, T0)).toEqual({
      ok: false,
      error: 'unknownPlayer',
    });
  });

  it('sys:screens stores the Screen count', () => {
    const { room } = step(makeRoom(), { type: 'sys:screens', count: 2 }, T0);
    expect(room.screens).toBe(2);
  });
});
