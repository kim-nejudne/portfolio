import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { EMOJI, MAX_PLAYERS, MAX_SCREENS, PALETTE, VIP_AWAY_MS } from '#shared/constants.js';
import type { Room } from '#shared/types.js';
import { type Action, type Effect, ERRORS, playerIdentity, reduce } from './reducer.js';
import { createRoom } from './roomStore.js';

const CODE = 'ABCD';
const T0 = 1_000_000;

/** A 21-character key per player number. */
const key = (n: number) => `key-${String(n).padStart(17, '0')}`;
const idOf = (n: number) => playerIdentity(CODE, key(n)).id;
const join = (n: number, name = `P${n}`, emoji: string = EMOJI[n % EMOJI.length]!): Action => ({
  type: 'player:join',
  playerKey: key(n),
  name,
  emoji,
});
const drop = (n: number): Action => ({
  type: 'player:connection',
  playerId: idOf(n),
  connected: false,
});
const back = (n: number): Action => ({
  type: 'player:connection',
  playerId: idOf(n),
  connected: true,
});

/** Applies an action that must succeed. */
function step(room: Room, action: Action, now: number): { room: Room; effects: Effect[] } {
  const res = reduce(room, action, now);
  expect(res.error).toBeUndefined();
  return res;
}

/** A lobby with players 1…n, joined 1 ms apart. */
function lobby(n: number): Room {
  let room = createRoom(CODE, T0, 7);
  for (let i = 1; i <= n; i++) room = step(room, join(i), T0 + i).room;
  return room;
}

const vipNow = (n: number): Effect => ({
  type: 'fx',
  to: { playerId: idOf(n) },
  fx: { kind: 'vipNow' },
});

/** Fires the `vipGone` scheduled by `effects`. */
function fireVipGone(room: Room, effects: Effect[]) {
  const s = effects.find((e) => e.type === 'schedule' && e.timer === 'vipGone');
  if (s?.type !== 'schedule') throw new Error('no vipGone scheduled');
  return reduce(room, { ...s, type: 'timer' }, s.at);
}

describe('playerIdentity', () => {
  it('derives the id from code + key and stores only the key hash', () => {
    const k = key(1);
    const { id, keyHash } = playerIdentity(CODE, k);
    expect(id).toBe(
      createHash('sha256')
        .update(CODE + k)
        .digest('base64url')
        .slice(0, 16),
    );
    expect(keyHash).toBe(createHash('sha256').update(k).digest('hex'));
    expect(playerIdentity('WXYZ', k).id).not.toBe(id);
  });
});

describe('player:join', () => {
  it('adds a player with the first free colour, makes the first one VIP and tells the Screens', () => {
    const { room, effects } = step(createRoom(CODE, T0, 7), join(1, 'Ana', '🦊'), T0 + 5);
    const ana = room.players[idOf(1)]!;
    expect(ana).toEqual({
      id: idOf(1),
      keyHash: playerIdentity(CODE, key(1)).keyHash,
      name: 'Ana',
      emoji: '🦊',
      color: PALETTE[0],
      connected: true,
      connectedSince: T0 + 5,
      joinedAt: T0 + 5,
      waiting: false,
    });
    expect(JSON.stringify(room)).not.toContain(key(1));
    expect(room.vipId).toBe(idOf(1));
    expect(room.lastActivityAt).toBe(T0 + 5);
    expect(effects).toEqual([
      { type: 'fx', to: 'screens', fx: { kind: 'join', playerId: idOf(1) } },
    ]);
  });

  it('gives colours in palette order and reuses a freed one first', () => {
    let room = lobby(3);
    expect(Object.values(room.players).map((p) => p.color)).toEqual(PALETTE.slice(0, 3));
    room = step(room, { type: 'player:leave', by: idOf(2) }, T0 + 10).room;
    room = step(room, join(4), T0 + 11).room;
    expect(room.players[idOf(4)]!.color).toBe(PALETTE[1]);
  });

  it('reconnects the same key to the same id, keeping name, emoji and colour', () => {
    let room = lobby(2);
    room = step(room, drop(2), T0 + 10).room;
    const { room: after, effects } = step(room, join(2, 'Other', '🐲'), T0 + 20);
    expect(Object.keys(after.players)).toHaveLength(2);
    expect(after.players[idOf(2)]).toMatchObject({
      name: 'P2',
      emoji: EMOJI[2],
      color: PALETTE[1],
      connected: true,
      connectedSince: T0 + 20,
    });
    expect(effects).toEqual([]);
  });

  it('a second tab of a connected player keeps its connectedSince', () => {
    const room = step(lobby(1), join(1), T0 + 50).room;
    expect(room.players[idOf(1)]!.connectedSince).toBe(T0 + 1);
  });

  it('refuses a 13th player, but still reconnects a known one', () => {
    let room = lobby(MAX_PLAYERS);
    const res = reduce(room, join(13, 'Late', EMOJI[23]), T0 + 100);
    expect(res).toEqual({ room, effects: [], error: 'This game is full (12 players)' });
    room = step(room, drop(5), T0 + 101).room;
    expect(step(room, join(5), T0 + 102).room.players[idOf(5)]!.connected).toBe(true);
  });

  it('refuses a name taken in any case and a taken emoji', () => {
    const room = step(lobby(1), join(2, 'Ana', '🦊'), T0 + 10).room; // P1 holds 🐼
    expect(reduce(room, join(3, 'aNA', '🐸'), T0 + 11).error).toBe('That name is taken');
    expect(reduce(room, join(3, 'Ben', '🐼'), T0 + 11).error).toBe('That emoji is taken');
  });

  it('players joining mid-round wait; INTRO joiners play', () => {
    for (const [phase, waiting] of [
      ['INTRO', false],
      ['GUESSING', true],
      ['REVEAL', true],
      ['SCOREBOARD', true],
      ['FINAL', true],
    ] as const) {
      const room = { ...lobby(1), phase };
      expect(step(room, join(2), T0 + 10).room.players[idOf(2)]!.waiting).toBe(waiting);
    }
  });
});

describe('player:rename', () => {
  it('renames in the lobby, checking uniqueness against others only', () => {
    let room = lobby(2);
    room = step(
      room,
      { type: 'player:rename', by: idOf(1), name: 'p1', emoji: '🐲' },
      T0 + 10,
    ).room;
    expect(room.players[idOf(1)]).toMatchObject({ name: 'p1', emoji: '🐲' });
    room = step(room, { type: 'player:rename', by: idOf(1), name: 'Zed' }, T0 + 11).room;
    expect(room.players[idOf(1)]).toMatchObject({ name: 'Zed', emoji: '🐲' });
    expect(reduce(room, { type: 'player:rename', by: idOf(1), name: 'P2' }, T0 + 12).error).toBe(
      'That name is taken',
    );
    expect(
      reduce(room, { type: 'player:rename', by: idOf(1), name: 'Zed', emoji: EMOJI[2] }, T0 + 12)
        .error,
    ).toBe('That emoji is taken');
  });

  it('is refused outside the lobby and for unknown players', () => {
    const room = { ...lobby(1), phase: 'SCOREBOARD' as const };
    expect(reduce(room, { type: 'player:rename', by: idOf(1), name: 'X' }, T0).error).toBe(
      ERRORS.lobbyOnly,
    );
    expect(reduce(lobby(1), { type: 'player:rename', by: 'nobody', name: 'X' }, T0).error).toBe(
      ERRORS.notInGame,
    );
  });
});

describe('vip:kick', () => {
  it('removes the player, remembers the id and sends them kicked; they cannot rejoin', () => {
    const { room, effects } = step(
      lobby(3),
      { type: 'vip:kick', by: idOf(1), playerId: idOf(2) },
      T0 + 10,
    );
    expect(room.players[idOf(2)]).toBeUndefined();
    expect(room.kickedIds).toEqual([idOf(2)]);
    expect(effects).toEqual([{ type: 'kicked', playerId: idOf(2) }]);
    const again = reduce(room, join(2), T0 + 20);
    expect(again.error).toBe('You were removed from this game');
    expect(again.room).toBe(room);
  });

  it('is VIP only, and not on yourself or a stranger', () => {
    const room = lobby(3);
    expect(reduce(room, { type: 'vip:kick', by: idOf(2), playerId: idOf(3) }, T0).error).toBe(
      'Only the VIP can do that',
    );
    expect(reduce(room, { type: 'vip:kick', by: idOf(1), playerId: idOf(1) }, T0).error).toBe(
      ERRORS.kickSelf,
    );
    expect(reduce(room, { type: 'vip:kick', by: idOf(1), playerId: 'nobody' }, T0).error).toBe(
      ERRORS.noSuchPlayer,
    );
  });
});

describe('connections', () => {
  it('tracks connected and connectedSince', () => {
    let room = step(lobby(2), drop(2), T0 + 10).room;
    expect(room.players[idOf(2)]).toMatchObject({ connected: false, connectedSince: null });
    room = step(room, back(2), T0 + 20).room;
    expect(room.players[idOf(2)]).toMatchObject({ connected: true, connectedSince: T0 + 20 });
    expect(
      reduce(room, { type: 'player:connection', playerId: 'x', connected: true }, T0).error,
    ).toBe(ERRORS.notInGame);
  });
});

describe('VIP succession', () => {
  it('passes on leave to the connected player with the earliest connectedSince', () => {
    let room = lobby(3);
    // P2 drops and returns, so P3 has been connected longer.
    room = step(room, drop(2), T0 + 10).room;
    room = step(room, back(2), T0 + 20).room;
    const { room: after, effects } = step(room, { type: 'player:leave', by: idOf(1) }, T0 + 30);
    expect(after.players[idOf(1)]).toBeUndefined();
    expect(after.vipId).toBe(idOf(3));
    expect(effects).toEqual([vipNow(3)]);
  });

  it('a non-VIP leaving changes nothing about the VIP', () => {
    const { room, effects } = step(lobby(2), { type: 'player:leave', by: idOf(2) }, T0 + 10);
    expect(room.vipId).toBe(idOf(1));
    expect(effects).toEqual([]);
  });

  it('passes after VIP_AWAY_MS of disconnection, via the vipGone timer', () => {
    const dropped = step(lobby(3), drop(1), T0 + 10);
    expect(dropped.room.vipId).toBe(idOf(1));
    expect(dropped.effects).toEqual([
      {
        type: 'schedule',
        at: T0 + 10 + VIP_AWAY_MS,
        timer: 'vipGone',
        round: 0,
        game: 0,
        epoch: 0,
      },
    ]);
    const fired = fireVipGone(dropped.room, dropped.effects);
    expect(fired.room.vipId).toBe(idOf(2));
    expect(fired.effects).toEqual([vipNow(2)]);
    // A former VIP coming back later is an ordinary player.
    const later = step(fired.room, back(1), T0 + VIP_AWAY_MS + 100);
    expect(later.room.vipId).toBe(idOf(2));
    expect(later.effects).toEqual([]);
  });

  it('a VIP back within 60 s keeps it, and the old timer is then ignored', () => {
    const dropped = step(lobby(2), drop(1), T0 + 10);
    const returned = step(dropped.room, back(1), T0 + 30_000);
    expect(returned.room.vipAwayUntil).toBeNull();
    const stale = fireVipGone(returned.room, dropped.effects);
    expect(stale.room.vipId).toBe(idOf(1));
    expect(stale.effects).toEqual([]);
    // Dropping again re-arms a fresh 60 s; the first timer still does nothing.
    const again = step(returned.room, drop(1), T0 + 50_000);
    expect(fireVipGone(again.room, dropped.effects).room.vipId).toBe(idOf(1));
    expect(fireVipGone(again.room, again.effects).room.vipId).toBe(idOf(2));
  });

  it('reconnecting through player:join within 60 s keeps VIP too', () => {
    const dropped = step(lobby(2), drop(1), T0 + 10);
    const rejoined = step(dropped.room, join(1), T0 + 40_000);
    expect(fireVipGone(rejoined.room, dropped.effects).room.vipId).toBe(idOf(1));
  });

  it('with nobody connected, vipId stays until someone connects, who becomes VIP', () => {
    let room = step(lobby(3), drop(2), T0 + 5).room;
    room = step(room, drop(3), T0 + 6).room;
    const dropped = step(room, drop(1), T0 + 10);
    const fired = fireVipGone(dropped.room, dropped.effects);
    expect(fired.room.vipId).toBe(idOf(1));
    expect(fired.effects).toEqual([]);
    const first = step(fired.room, back(3), T0 + 200_000);
    expect(first.room.vipId).toBe(idOf(3));
    expect(first.effects).toEqual([vipNow(3)]);
  });

  it('the away VIP connecting first after 60 s, with nobody else connected, stays VIP', () => {
    let room = step(lobby(2), drop(2), T0 + 5).room;
    const dropped = step(room, drop(1), T0 + 10);
    room = fireVipGone(dropped.room, dropped.effects).room;
    room = step(room, back(1), T0 + 200_000).room;
    expect(room.vipId).toBe(idOf(1));
    expect(room.vipAwayUntil).toBeNull();
    expect(step(room, back(2), T0 + 200_001).room.vipId).toBe(idOf(1));
  });

  it('the VIP leaving with nobody connected clears vipId; the next to connect is VIP', () => {
    let room = step(lobby(2), drop(2), T0 + 5).room;
    room = step(room, { type: 'player:leave', by: idOf(1) }, T0 + 10).room;
    expect(room.vipId).toBeNull();
    const back2 = step(room, back(2), T0 + 20);
    expect(back2.room.vipId).toBe(idOf(2));
    expect(back2.effects).toEqual([vipNow(2)]);
  });

  it('the last player leaving and a new one joining makes the newcomer VIP, without a toast', () => {
    const room = step(lobby(1), { type: 'player:leave', by: idOf(1) }, T0 + 10).room;
    const { room: after, effects } = step(room, join(2), T0 + 20);
    expect(after.vipId).toBe(idOf(2));
    expect(effects).not.toContainEqual(vipNow(2));
  });

  it('a VIP back after 60 s but before vipGone fires is an ordinary player', () => {
    const dropped = step(lobby(3), drop(1), T0 + 10);
    const late = step(dropped.room, back(1), T0 + 10 + VIP_AWAY_MS + 5);
    expect(late.room.vipId).toBe(idOf(2));
    expect(late.room.vipAwayUntil).toBeNull();
    expect(late.effects).toEqual([vipNow(2)]);
    expect(fireVipGone(late.room, dropped.effects).room.vipId).toBe(idOf(2));
  });

  it('the away VIP leaving passes VIP at once', () => {
    const dropped = step(lobby(2), drop(1), T0 + 10);
    const left = step(dropped.room, { type: 'player:leave', by: idOf(1) }, T0 + 20);
    expect(left.room.vipId).toBe(idOf(2));
    expect(left.room.vipAwayUntil).toBeNull();
  });

  it('ignores a vipGone timer from another epoch or game', () => {
    const dropped = step(lobby(2), drop(1), T0 + 10);
    const bumped = { ...dropped.room, timerEpoch: 1 };
    expect(fireVipGone(bumped, dropped.effects).room.vipId).toBe(idOf(1));
    const s = dropped.effects[0]!;
    if (s.type !== 'schedule') throw new Error('expected a schedule');
    const otherGame = reduce(dropped.room, { ...s, type: 'timer', game: 3 }, s.at);
    expect(otherGame.room.vipId).toBe(idOf(1));
  });

  it('ignores a vipGone timer for a VIP who is connected', () => {
    const room = lobby(2);
    const res = reduce(
      room,
      { type: 'timer', timer: 'vipGone', at: T0, round: 0, game: 0, epoch: 0 },
      T0 + VIP_AWAY_MS,
    );
    expect(res.room.vipId).toBe(idOf(1));
    expect(res.effects).toEqual([]);
    expect(res.room.lastActivityAt).toBe(room.lastActivityAt); // a timer is not activity
  });
});

describe('screens', () => {
  it('counts Screens up to the limit and down to zero', () => {
    let room = createRoom(CODE, T0, 7);
    for (let i = 0; i < MAX_SCREENS; i++) room = step(room, { type: 'screen:join' }, T0).room;
    expect(room.screenCount).toBe(MAX_SCREENS);
    expect(reduce(room, { type: 'screen:join' }, T0).error).toBe(ERRORS.screensFull);
    for (let i = 0; i <= MAX_SCREENS; i++) room = step(room, { type: 'screen:leave' }, T0).room;
    expect(room.screenCount).toBe(0);
  });
});

describe('purity', () => {
  it('never mutates the room it is given', () => {
    const room = lobby(3);
    const snapshot = structuredClone(room);
    reduce(room, { type: 'vip:kick', by: idOf(1), playerId: idOf(2) }, T0 + 10);
    reduce(room, drop(1), T0 + 10);
    reduce(room, join(4), T0 + 10);
    expect(room).toEqual(snapshot);
  });
});

describe('practice', () => {
  const practice = (n: number, lat: number, lng: number): Action => ({
    type: 'player:practice',
    by: idOf(n),
    lat,
    lng,
  });

  it('wiggles the tile on Screens and tells only that player the distance to 0°, 0°', () => {
    const room = lobby(2);
    const { room: after, effects } = step(room, practice(2, 0, 10), T0 + 50);
    expect(effects).toHaveLength(2);
    expect(effects[0]).toEqual({
      type: 'fx',
      to: 'screens',
      fx: { kind: 'practice', playerId: idOf(2) },
    });
    const result = effects[1]!;
    if (result.type !== 'fx' || result.fx.kind !== 'practiceResult') throw new Error('no result');
    expect(result.to).toEqual({ playerId: idOf(2) });
    expect(result.fx.distanceKm).toBeCloseTo(1111.95, 1);
    // Nothing is stored or scored.
    expect({ ...after, lastActivityAt: 0 }).toEqual({ ...room, lastActivityAt: 0 });
  });

  it('is refused outside the lobby and from someone not in the game', () => {
    const room = lobby(1);
    expect(reduce(room, practice(9, 0, 0), T0).error).toBe(ERRORS.notInGame);
    expect(reduce({ ...room, phase: 'GUESSING' }, practice(1, 0, 0), T0).error).toBe(
      ERRORS.lobbyOnly,
    );
  });
});
