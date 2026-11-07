import { describe, expect, it } from 'vitest';
import { ALL_LOCKED_MS, EMOJI, GRACE_MS, INTRO_MS } from '#shared/constants.js';
import type { Category, Difficulty, Place, Room } from '#shared/types.js';
import { type Action, type Effect, ERRORS, playerIdentity, reduce } from './reducer.js';
import { createRoom } from './roomStore.js';

const CODE = 'ABCD';
const T0 = 1_000_000;

const key = (n: number) => `key-${String(n).padStart(17, '0')}`;
const idOf = (n: number) => playerIdentity(CODE, key(n)).id;
const join = (n: number): Action => ({
  type: 'player:join',
  playerKey: key(n),
  name: `P${n}`,
  emoji: EMOJI[n]!,
});
const drop = (n: number): Action => ({
  type: 'player:connection',
  playerId: idOf(n),
  connected: false,
});
const aim = (n: number, lat = 10, lng = 20): Action => ({
  type: 'player:aim',
  by: idOf(n),
  lat,
  lng,
});
const lockIn = (n: number, lat = 11, lng = 21): Action => ({
  type: 'player:lockIn',
  by: idOf(n),
  lat,
  lng,
});

function place(id: string, kind: Place['kind'] = 'city'): Place {
  return {
    id,
    kind,
    name: id,
    displayName: id,
    autoDisplayName: true,
    fact: 'A fact.',
    lat: 1,
    lng: 2,
    coordsSource: 'wikidata',
    wikidataId: 'Q1',
    countryId: 'Q2',
    countryName: 'Testland',
  };
}
const places = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => place(`${prefix}${i}`));

/** Japan with `n` cities per level. */
function category(n = 6): Category {
  const live: Category['live'] = {};
  for (const level of ['easy', 'medium', 'hard'] as Difficulty[])
    live[level] = { places: places(n, level), reviewed: true, updatedAt: 0 };
  return {
    id: 'japan',
    name: 'Japan',
    emoji: '🗾',
    box: { south: 30, west: 129, north: 46, east: 146 },
    labelStyle: 'city',
    draftMeta: null,
    hidden: false,
    live,
    draft: {},
    createdAt: 0,
    updatedAt: 0,
  };
}

function step(room: Room, action: Action, now: number): { room: Room; effects: Effect[] } {
  const res = reduce(room, action, now);
  expect(res.error).toBeUndefined();
  return res;
}

/** A 5-round Mixed lobby with players 1…n, a Screen and Japan picked. */
function lobby(n: number): Room {
  let room = createRoom(CODE, T0, 7);
  for (let i = 1; i <= n; i++) room = step(room, join(i), T0 + i).room;
  room = step(room, { type: 'screen:join' }, T0 + 50).room;
  return step(
    room,
    {
      type: 'vip:settings',
      by: idOf(1),
      settings: { categoryId: 'japan', rounds: 5 },
      liveIds: ['japan'],
    },
    T0 + 60,
  ).room;
}

const start = (cat: Category | undefined = category()): Action => ({
  type: 'vip:start',
  by: idOf(1),
  category: cat,
});

function scheduled(effects: Effect[], timer: string) {
  const s = effects.find((e) => e.type === 'schedule' && e.timer === timer);
  return s?.type === 'schedule' ? s : undefined;
}

/** Fires the timer `effects` scheduled, at its time. */
function fire(room: Room, effects: Effect[], timer: string) {
  const s = scheduled(effects, timer);
  if (!s) throw new Error(`no ${timer} scheduled`);
  return reduce(room, { ...s, type: 'timer' }, s.at);
}

/** Started at T0 + 100, then INTRO → GUESSING at T0 + 100 + INTRO_MS. */
function guessing(n: number) {
  const started = step(lobby(n), start(), T0 + 100);
  return fire(started.room, started.effects, 'introDone');
}

describe('vip:start', () => {
  it('runs New game and Open round: round 1 in INTRO with introDone in INTRO_MS', () => {
    const { room, effects } = step(lobby(2), start(), T0 + 100);
    expect(room.phase).toBe('INTRO');
    const game = room.game!;
    expect(game).toMatchObject({
      number: 1,
      categoryName: 'Japan',
      categoryEmoji: '🗾',
      levelPlan: ['easy', 'easy', 'medium', 'hard', 'hard'],
      played: [],
    });
    expect(game.scale).toBeGreaterThan(0);
    expect(Object.keys(game.pool).sort()).toEqual(['easy', 'hard', 'medium']);
    const round = game.current!;
    expect(round).toMatchObject({ number: 1, level: 'easy', multiplier: 1, startedAt: null });
    expect(round.placeId).toMatch(/^easy/);
    expect(game.usedPlaceIds).toEqual([round.placeId]);
    expect(room.placeUsage).toEqual({ [round.placeId]: 1 });
    expect(room.rngState).not.toBe(7);
    expect(effects).toEqual([
      {
        type: 'schedule',
        at: T0 + 100 + INTRO_MS,
        timer: 'introDone',
        round: 1,
        game: 1,
        epoch: 0,
      },
    ]);
  });

  it('is refused without a Screen', () => {
    const room = step(lobby(1), { type: 'screen:leave' }, T0 + 70).room;
    expect(reduce(room, start(), T0 + 100).error).toBe(ERRORS.noScreen);
  });

  it('is refused with no connected player', () => {
    const room = step(lobby(1), drop(1), T0 + 70).room;
    expect(reduce(room, start(), T0 + 100).error).toBe(ERRORS.noPlayers);
  });

  it('is refused when the level has too few places, naming it', () => {
    const res = reduce(lobby(1), start(category(1)), T0 + 100);
    expect(res.error).toBe('Japan · Easy has 1 city; this game needs 2.');
    expect(res.room.phase).toBe('LOBBY');
  });

  it('is refused without a live category, from a non-VIP, and outside LOBBY', () => {
    expect(
      reduce(lobby(2), { type: 'vip:start', by: idOf(1), category: undefined }, T0 + 100).error,
    ).toBe(ERRORS.noCategory);
    expect(reduce(lobby(2), { ...start(), by: idOf(2) } as Action, T0 + 100).error).toBe(
      ERRORS.notVip,
    );
    const intro = step(lobby(2), start(), T0 + 100).room;
    expect(reduce(intro, start(), T0 + 200).error).toBe(ERRORS.lobbyOnly);
  });
});

describe('INTRO → GUESSING', () => {
  it('on introDone sets the clock, participants and everConnected, and schedules guessUp', () => {
    let room = step(lobby(3), start(), T0 + 100).room;
    room = step(room, drop(3), T0 + 200).room;
    const startEffects = step(lobby(3), start(), T0 + 100).effects;
    const { room: g, effects } = fire(room, startEffects, 'introDone');
    const now = T0 + 100 + INTRO_MS;
    expect(g.phase).toBe('GUESSING');
    expect(g.game!.current).toMatchObject({
      startedAt: now,
      endsAt: now + 30_000,
      participants: [idOf(1), idOf(2), idOf(3)],
      everConnected: [idOf(1), idOf(2)],
    });
    expect(effects).toEqual([
      {
        type: 'schedule',
        at: now + 30_000 + GRACE_MS,
        timer: 'guessUp',
        round: 1,
        game: 1,
        epoch: 0,
      },
    ]);
  });

  it('counts a participant who was away at GUESSING start once they reconnect', () => {
    const started = step(lobby(2), start(), T0 + 100);
    const away = step(started.room, drop(2), T0 + 200).room;
    const g = fire(away, started.effects, 'introDone').room;
    expect(g.game!.current!.everConnected).toEqual([idOf(1)]);
    const back = step(g, join(2), T0 + 5000).room;
    expect(back.game!.current!.everConnected).toEqual([idOf(1), idOf(2)]);
  });
});

describe('player:aim and player:lockIn', () => {
  it('stores an aim silently: no effects', () => {
    const { room } = guessing(2);
    const res = step(room, aim(2, 35, 139), T0 + 5000);
    expect(res.room.game!.current!.aims).toEqual({ [idOf(2)]: { lat: 35, lng: 139 } });
    expect(res.effects).toEqual([]);
  });

  it('stores a final lock and tells only the Screens; a second lock-in and later aims are refused', () => {
    const { room } = guessing(2);
    const res = step(room, lockIn(2, 35, 139), T0 + 5000);
    expect(res.room.game!.current!.locks).toEqual({
      [idOf(2)]: { lat: 35, lng: 139, at: T0 + 5000 },
    });
    expect(res.effects).toEqual([
      { type: 'fx', to: 'screens', fx: { kind: 'lockedIn', playerId: idOf(2) } },
    ]);
    expect(reduce(res.room, lockIn(2, 0, 0), T0 + 5100).error).toBe(ERRORS.alreadyLocked);
    expect(reduce(res.room, aim(2), T0 + 5100).error).toBe(ERRORS.alreadyLocked);
  });

  it('is refused outside GUESSING and while paused', () => {
    const intro = step(lobby(2), start(), T0 + 100).room;
    expect(reduce(intro, lockIn(1), T0 + 200).error).toBe(ERRORS.notGuessing);
    expect(reduce(intro, aim(1), T0 + 200).error).toBe(ERRORS.notGuessing);
    const { room } = guessing(2);
    room.paused = { reasons: ['vip'], since: T0 + 4000, remainingMs: {}, resumeAt: null };
    expect(reduce(room, lockIn(1), T0 + 5000).error).toBe(ERRORS.paused);
    expect(reduce(room, aim(1), T0 + 5000).error).toBe(ERRORS.paused);
  });

  it('schedules allLocked in ALL_LOCKED_MS once every connected participant has locked in', () => {
    let { room } = guessing(2);
    const first = step(room, lockIn(1), T0 + 5000);
    expect(scheduled(first.effects, 'allLocked')).toBeUndefined();
    room = first.room;
    const last = step(room, lockIn(2), T0 + 6000);
    expect(scheduled(last.effects, 'allLocked')).toEqual({
      type: 'schedule',
      at: T0 + 6000 + ALL_LOCKED_MS,
      timer: 'allLocked',
      round: 1,
      game: 1,
      epoch: 0,
    });
  });

  it('ignores disconnected participants: the last connected lock-in schedules allLocked', () => {
    let { room } = guessing(3);
    room = step(room, drop(3), T0 + 4500).room;
    room = step(room, lockIn(1), T0 + 5000).room;
    expect(scheduled(step(room, lockIn(2), T0 + 6000).effects, 'allLocked')).toBeDefined();
  });

  it('schedules allLocked when the only unlocked participant disconnects', () => {
    let { room } = guessing(2);
    room = step(room, lockIn(1), T0 + 5000).room;
    const res = step(room, drop(2), T0 + 6000);
    expect(scheduled(res.effects, 'allLocked')?.at).toBe(T0 + 6000 + ALL_LOCKED_MS);
  });

  it('does not schedule allLocked when everyone disconnects', () => {
    let { room } = guessing(2);
    room = step(room, drop(2), T0 + 5000).room;
    const res = step(room, drop(1), T0 + 6000);
    expect(scheduled(res.effects, 'allLocked')).toBeUndefined();
  });

  it('schedules allLocked when the only unlocked participant is kicked, and drops their rows', () => {
    let { room } = guessing(3);
    room = step(room, aim(3), T0 + 4500).room;
    room = step(room, lockIn(2), T0 + 5000).room;
    room = step(room, lockIn(1), T0 + 5100).room;
    const res = step(room, { type: 'vip:kick', by: idOf(1), playerId: idOf(3) }, T0 + 6000);
    expect(scheduled(res.effects, 'allLocked')?.at).toBe(T0 + 6000 + ALL_LOCKED_MS);
    const round = res.room.game!.current!;
    expect(round.participants).toEqual([idOf(1), idOf(2)]);
    expect(round.everConnected).toEqual([idOf(1), idOf(2)]);
    expect(round.aims).toEqual({});
  });

  it('schedules allLocked when the only unlocked participant leaves', () => {
    let { room } = guessing(2);
    room = step(room, lockIn(1), T0 + 5000).room;
    const res = step(room, { type: 'player:leave', by: idOf(2) }, T0 + 6000);
    expect(scheduled(res.effects, 'allLocked')).toBeDefined();
  });
});

describe('timers', () => {
  it('carry round, game and timerEpoch; a stale one is ignored', () => {
    const started = step(lobby(2), start(), T0 + 100);
    const s = scheduled(started.effects, 'introDone')!;
    for (const stale of [
      { ...s, round: 2 },
      { ...s, game: 2 },
      { ...s, epoch: 1 },
    ]) {
      const res = step(started.room, { ...stale, type: 'timer' }, s.at);
      expect(res.room.phase).toBe('INTRO');
      expect(res.effects).toEqual([]);
    }
    const bumped = { ...started.room, timerEpoch: 1 };
    expect(step(bumped, { ...s, type: 'timer' }, s.at).room.phase).toBe('INTRO');
  });

  it('ignores an introDone that arrives in GUESSING', () => {
    const started = step(lobby(1), start(), T0 + 100);
    const g = fire(started.room, started.effects, 'introDone').room;
    const again = fire(g, started.effects, 'introDone');
    expect(again.room).toEqual(g);
    expect(again.effects).toEqual([]);
  });
});

describe('late joiners', () => {
  it('a join in INTRO plays that round', () => {
    const started = step(lobby(1), start(), T0 + 100);
    const room = step(started.room, join(2), T0 + 200).room;
    expect(room.players[idOf(2)]!.waiting).toBe(false);
    const g = fire(room, started.effects, 'introDone').room;
    expect(g.game!.current!.participants).toEqual([idOf(1), idOf(2)]);
  });

  it('a join in GUESSING waits: not a participant, cannot aim or lock in, joins at the next Open round', () => {
    let { room } = guessing(1);
    room = step(room, join(2), T0 + 5000).room;
    expect(room.players[idOf(2)]!.waiting).toBe(true);
    expect(room.game!.current!.participants).toEqual([idOf(1)]);
    expect(reduce(room, aim(2), T0 + 5100).error).toBe(ERRORS.notPlaying);
    expect(reduce(room, lockIn(2), T0 + 5100).error).toBe(ERRORS.notPlaying);
    // A waiting player's absence does not hold up allLocked.
    expect(scheduled(step(room, lockIn(1), T0 + 6000).effects, 'allLocked')).toBeDefined();
  });
});
