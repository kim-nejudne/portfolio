import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS_PER_ROOM, PLAYER_PALETTE } from '../shared/constants.js';
import type { Room } from '../shared/types.js';
import { reduce, WRONG_PHASE_ERROR, type Action, type ReduceResult } from './reducer.js';
import { T0, makePlayer, makeRoom, withPlayers } from './test/rooms.js';

function ok(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
  return result;
}

function join(room: Room, playerId: string, name = playerId, now = T0 + 1000): ReduceResult {
  return reduce(room, { type: 'player:join', playerId, name }, now);
}

/** Joins each id in order, starting from `room`. */
function joinAll(room: Room, ids: string[]): Room {
  return ids.reduce((r, id, i) => ok(join(r, id, id, T0 + i)).room, room);
}

describe('reduce: general', () => {
  it('rejects an unknown action with an error', () => {
    const room = makeRoom();
    const result = reduce(room, { type: 'host:dance' } as unknown as Action, T0);
    expect(result).toEqual({ ok: false, error: 'Unknown action' });
  });

  it('does not mutate the input room', () => {
    const room = makeRoom();
    const snapshot = structuredClone(room);
    ok(join(room, 'p1', 'Ana'));
    expect(room).toEqual(snapshot);
  });

  it('records the time of a successful action as the last activity', () => {
    const { room } = ok(join(makeRoom(), 'p1', 'Ana', T0 + 5000));
    expect(room.lastActivityAt).toBe(T0 + 5000);
  });

  it('leaves the last activity unchanged when an action is rejected', () => {
    const room = makeRoom({ kickedIds: ['p1'] });
    const result = join(room, 'p1', 'Ana', T0 + 5000);
    expect(result.ok).toBe(false);
    expect(room.lastActivityAt).toBe(T0);
  });
});

describe('reduce: player:join', () => {
  it('adds a new player at 0 points, connected, with the join time', () => {
    const { room } = ok(join(makeRoom(), 'p1', 'Ana', T0 + 42));
    expect(room.players.p1).toEqual({
      id: 'p1',
      name: 'Ana',
      color: PLAYER_PALETTE[0],
      score: 0,
      connected: true,
      rttMs: 0,
      joinedAt: T0 + 42,
      joinedAtOpening: 0,
    });
  });

  it('emits fx join for a new player', () => {
    const { effects } = ok(join(makeRoom(), 'p1', 'Ana'));
    expect(effects).toEqual([{ type: 'fx', fx: { kind: 'join', playerId: 'p1' } }]);
  });

  it('gives each new player the next palette colour in join order', () => {
    const room = joinAll(makeRoom(), ['a', 'b', 'c']);
    expect([room.players.a?.color, room.players.b?.color, room.players.c?.color]).toEqual(
      PLAYER_PALETTE.slice(0, 3),
    );
  });

  it('wraps around the palette once every colour is in use', () => {
    const ids = Array.from({ length: PLAYER_PALETTE.length + 1 }, (_, i) => `p${i}`);
    const room = joinAll(makeRoom(), ids);
    expect(room.players[`p${PLAYER_PALETTE.length}`]?.color).toBe(PLAYER_PALETTE[0]);
  });

  it('reuses the colour of a player who has left before repeating one', () => {
    const room = joinAll(makeRoom(), ['a', 'b', 'c']);
    const left = withPlayers(
      room,
      Object.values(room.players).filter((p) => p.id !== 'b'),
    );
    const { room: after } = ok(join(left, 'd'));
    expect(after.players.d?.color).toBe(PLAYER_PALETTE[1]);
  });

  it('reconnects an existing playerId with score and colour intact', () => {
    const room = withPlayers(makeRoom({ phase: 'OPEN', questionIndex: 2 }), [
      makePlayer('p1', { name: 'Ana', score: 300, color: PLAYER_PALETTE[5], connected: false }),
    ]);
    const { room: after, effects } = ok(join(room, 'p1', 'Ana'));
    expect(after.players.p1).toEqual({ ...room.players.p1, connected: true });
    expect(effects).toEqual([]);
  });

  it('keeps the stored name when a reconnect sends a different one', () => {
    const room = withPlayers(makeRoom(), [makePlayer('p1', { name: 'Ana', connected: false })]);
    const { room: after } = ok(join(room, 'p1', 'Bob'));
    expect(after.players.p1?.name).toBe('Ana');
  });

  it('keeps lockout status across a reconnect', () => {
    const room = withPlayers(makeRoom({ phase: 'OPEN', questionIndex: 0, lockedOut: ['p1'] }), [
      makePlayer('p1', { connected: false }),
    ]);
    const { room: after } = ok(join(room, 'p1'));
    expect(after.lockedOut).toEqual(['p1']);
  });

  it('rejects a name already taken by another player, ignoring case', () => {
    const room = withPlayers(makeRoom(), [makePlayer('p1', { name: 'Ana' })]);
    expect(join(room, 'p2', 'aNA')).toEqual({ ok: false, error: 'That name is taken' });
  });

  it('rejects a name taken by a disconnected player', () => {
    const room = withPlayers(makeRoom(), [makePlayer('p1', { name: 'Ana', connected: false })]);
    expect(join(room, 'p2', 'Ana')).toEqual({ ok: false, error: 'That name is taken' });
  });

  it('rejects a kicked playerId', () => {
    const room = makeRoom({ kickedIds: ['p1'] });
    expect(join(room, 'p1', 'Ana')).toEqual({
      ok: false,
      error: 'You were removed from this game',
    });
  });

  it(`accepts the ${MAX_PLAYERS_PER_ROOM}th player and rejects the next`, () => {
    const ids = Array.from({ length: MAX_PLAYERS_PER_ROOM }, (_, i) => `p${i}`);
    const full = joinAll(makeRoom(), ids);
    expect(Object.keys(full.players)).toHaveLength(MAX_PLAYERS_PER_ROOM);
    expect(join(full, 'late', 'Late')).toEqual({ ok: false, error: 'This game is full' });
  });

  it('still reconnects a known player when the room is full', () => {
    const ids = Array.from({ length: MAX_PLAYERS_PER_ROOM }, (_, i) => `p${i}`);
    const full = joinAll(makeRoom(), ids);
    const dropped = withPlayers(
      full,
      Object.values(full.players).map((p) => (p.id === 'p0' ? { ...p, connected: false } : p)),
    );
    expect(ok(join(dropped, 'p0')).room.players.p0?.connected).toBe(true);
  });

  it('lets a new player join mid-game at 0 points', () => {
    const room = withPlayers(makeRoom({ phase: 'BUZZED', questionIndex: 1, winnerId: 'p1' }), [
      makePlayer('p1', { score: 200 }),
    ]);
    const { room: after } = ok(join(room, 'p2', 'Bob'));
    expect(after.players.p2?.score).toBe(0);
    expect(after.phase).toBe('BUZZED');
  });

  it('rejects a new player once the game is over', () => {
    const room = makeRoom({ phase: 'FINAL', questionIndex: 2 });
    expect(join(room, 'p1', 'Ana')).toEqual({ ok: false, error: 'This game has ended' });
  });

  it('still reconnects a known player once the game is over', () => {
    const room = withPlayers(makeRoom({ phase: 'FINAL', questionIndex: 2 }), [
      makePlayer('p1', { score: 500, connected: false }),
    ]);
    const { room: after } = ok(join(room, 'p1'));
    expect(after.players.p1).toMatchObject({ score: 500, connected: true });
  });
});

describe('reduce: player:disconnect', () => {
  it('marks the player disconnected and keeps them in the list', () => {
    const room = withPlayers(makeRoom(), [makePlayer('p1', { score: 100 })]);
    const { room: after } = ok(reduce(room, { type: 'player:disconnect', playerId: 'p1' }, T0 + 1));
    expect(after.players.p1).toEqual({ ...room.players.p1, connected: false });
  });

  it('rejects an unknown player', () => {
    const result = reduce(makeRoom(), { type: 'player:disconnect', playerId: 'nobody' }, T0);
    expect(result).toEqual({ ok: false, error: 'Unknown player' });
  });
});

describe('reduce: player:practice', () => {
  const practice = (room: Room, playerId = 'p1', now = T0 + 1000): ReduceResult =>
    reduce(room, { type: 'player:practice', playerId }, now);

  it('emits fx practice in LOBBY', () => {
    const room = withPlayers(makeRoom(), [makePlayer('p1')]);
    const { effects } = ok(practice(room));
    expect(effects).toEqual([{ type: 'fx', fx: { kind: 'practice', playerId: 'p1' } }]);
  });

  it('changes no room state: the same room object, not even the last activity', () => {
    const room = withPlayers(makeRoom(), [makePlayer('p1')]);
    const snapshot = structuredClone(room);
    const { room: after } = ok(practice(room, 'p1', T0 + 9000));
    expect(after).toBe(room);
    expect(room).toEqual(snapshot);
  });

  it.each(['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED', 'REVEAL', 'FINAL'] as const)(
    'rejects a practice buzz in %s',
    (phase) => {
      const room = withPlayers(makeRoom({ phase, questionIndex: 0 }), [makePlayer('p1')]);
      expect(practice(room)).toEqual({ ok: false, error: WRONG_PHASE_ERROR });
    },
  );

  it('rejects an unknown player', () => {
    expect(practice(makeRoom(), 'nobody')).toEqual({ ok: false, error: 'Unknown player' });
  });
});
