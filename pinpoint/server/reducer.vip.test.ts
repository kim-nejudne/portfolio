import { describe, expect, it } from 'vitest';
import { EMOJI, INTRO_MS, SCOREBOARD_MS, VIP_AWAY_MS } from '#shared/constants.js';
import type { Category, Difficulty, GameSettings, Place, Room } from '#shared/types.js';
import { type Action, type Effect, ERRORS, playerIdentity, reduce } from './reducer.js';
import { createRoom } from './roomStore.js';
import { toView } from './views.js';

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
const next = (n = 1): Action => ({ type: 'vip:next', by: idOf(n) });
const skip = (n = 1): Action => ({ type: 'vip:skipRound', by: idOf(n) });
const end = (n = 1): Action => ({ type: 'vip:end', by: idOf(n) });
const pause = (n = 1): Action => ({ type: 'vip:pause', by: idOf(n) });
const lockIn = (n: number): Action => ({ type: 'player:lockIn', by: idOf(n), lat: 35, lng: 139 });

function category(): Category {
  const live: Category['live'] = {};
  for (const level of ['easy', 'medium', 'hard'] as Difficulty[])
    live[level] = {
      places: Array.from({ length: 6 }, (_, i): Place => ({
        id: `${level}${i}`,
        kind: 'city',
        name: `${level}${i}`,
        displayName: `${level}${i}`,
        autoDisplayName: true,
        fact: 'A fact.',
        lat: 35 + i,
        lng: 139,
        coordsSource: 'wikidata',
        wikidataId: 'Q1',
        countryId: 'Q2',
        countryName: 'Testland',
      })),
      reviewed: true,
      updatedAt: 0,
    };
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

interface Step {
  room: Room;
  effects: Effect[];
}

function step(room: Room, action: Action, now: number): Step {
  const res = reduce(room, action, now);
  expect(res.error).toBeUndefined();
  return res;
}

function scheduled(effects: Effect[], timer: string) {
  const s = effects.find((e) => e.type === 'schedule' && e.timer === timer);
  if (!s || s.type !== 'schedule') throw new Error(`no ${timer} scheduled`);
  return s;
}
const fire = (room: Room, effects: Effect[], timer: string, at?: number): Step => {
  const s = scheduled(effects, timer);
  return step(room, { ...s, type: 'timer' }, at ?? s.at);
};

/** Players 1…2 and a Screen in a 5-round Japan game, at INTRO of round 1 since T0 + 100. */
function intro(settings: Partial<GameSettings> = {}): Step {
  let room = createRoom(CODE, T0, 7);
  for (let i = 1; i <= 2; i++) room = step(room, join(i), T0 + i).room;
  room = step(room, { type: 'screen:join' }, T0 + 50).room;
  room = step(
    room,
    {
      type: 'vip:settings',
      by: idOf(1),
      settings: { categoryId: 'japan', rounds: 5, ...settings },
      liveIds: ['japan'],
    },
    T0 + 60,
  ).room;
  return step(room, { type: 'vip:start', by: idOf(1), category: category() }, T0 + 100);
}
const G = T0 + 100 + INTRO_MS;
function guessing(settings: Partial<GameSettings> = {}): Step {
  const s = intro(settings);
  return fire(s.room, s.effects, 'introDone');
}
/** REVEAL of round 1, both players locked in at 35, 139. */
function reveal(settings: Partial<GameSettings> = {}): Step {
  let s = guessing(settings);
  s = step(s.room, lockIn(1), G + 1000);
  s = step(s.room, lockIn(2), G + 2000);
  return fire(s.room, s.effects, 'allLocked');
}
function scoreboard(): Step {
  const r = reveal();
  return fire(r.room, r.effects, 'revealDone');
}

describe('vip:next', () => {
  it('REVEAL → SCOREBOARD with every row revealed; the round is played', () => {
    const r = reveal();
    const at = scheduled(r.effects, 'revealTarget').at - 1;
    const n = step(r.room, next(), at);
    expect(n.room.phase).toBe('SCOREBOARD');
    const played = n.room.game!.played;
    expect(played).toHaveLength(1);
    expect(played[0]!.revealStage).toBe('done');
    expect(played[0]!.revealedCount).toBe(2);
    expect(played[0]!.results!.every((x) => x.points > 0)).toBe(true);
    expect(scheduled(n.effects, 'scoreboardDone').at).toBe(at + SCOREBOARD_MS);
    // The reveal's own timers, still in flight, change nothing.
    for (const t of ['revealTarget', 'revealStep', 'revealDone'])
      expect(fire(n.room, r.effects, t).room).toEqual(n.room);
  });

  it('REVEAL of the last round → FINAL', () => {
    let s = reveal({ rounds: 5 });
    for (let r = 1; r < 5; r++) {
      s = step(s.room, next(), T0 + 100_000 * r);
      s = step(s.room, next(), T0 + 100_000 * r + 1); // SCOREBOARD → INTRO r + 1
      s = fire(s.room, s.effects, 'introDone');
      s = fire(s.room, s.effects, 'guessUp');
    }
    expect(s.room.game!.current!.number).toBe(5);
    const f = step(s.room, next(), T0 + 900_000);
    expect(f.room.phase).toBe('FINAL');
    expect(f.room.game!.played).toHaveLength(5);
  });

  it('SCOREBOARD → INTRO of the next round; the stale scoreboardDone is ignored', () => {
    const s = scoreboard();
    const n = step(s.room, next(), T0 + 50_000);
    expect(n.room.phase).toBe('INTRO');
    expect(n.room.game!.current!.number).toBe(2);
    expect(scheduled(n.effects, 'introDone').at).toBe(T0 + 50_000 + INTRO_MS);
    expect(fire(n.room, s.effects, 'scoreboardDone').room).toEqual(n.room);
  });

  it('is refused while paused, in other phases and from a non-VIP', () => {
    const s = scoreboard();
    const p = step(s.room, pause(), T0 + 50_000);
    expect(reduce(p.room, next(), T0 + 50_001).error).toBe(ERRORS.paused);
    expect(reduce(s.room, next(2), T0 + 50_001).error).toBe(ERRORS.notVip);
    expect(reduce(intro().room, next(), T0 + 200).error).toBe(ERRORS.notNow);
    expect(reduce(guessing().room, next(), G + 1).error).toBe(ERRORS.notNow);
  });
});

describe('vip:skipRound', () => {
  function expectFreshRound(before: Room, after: Step, at: number) {
    const old = before.game!.current!;
    const fresh = after.room.game!.current!;
    expect(after.room.phase).toBe('INTRO');
    expect(fresh.number).toBe(old.number);
    expect(fresh.level).toBe(old.level);
    expect(fresh.multiplier).toBe(old.multiplier);
    expect(fresh.placeId).not.toBe(old.placeId);
    expect(fresh.results).toBeNull();
    expect(fresh.locks).toEqual({});
    expect(after.room.game!.played).toEqual([]);
    expect(after.room.game!.usedPlaceIds).toEqual([old.placeId, fresh.placeId]);
    expect(after.room.timerEpoch).toBe(before.timerEpoch + 1);
    expect(scheduled(after.effects, 'introDone').at).toBe(at + INTRO_MS);
  }

  it('INTRO: a fresh place, same number; the old introDone is stale', () => {
    const s = intro();
    const k = step(s.room, skip(), T0 + 1000);
    expectFreshRound(s.room, k, T0 + 1000);
    expect(fire(k.room, s.effects, 'introDone').room.phase).toBe('INTRO');
  });

  it('GUESSING: locks are voided; the old guessUp cannot end the new round', () => {
    const g = guessing();
    const s = step(g.room, lockIn(1), G + 1000);
    const k = step(s.room, skip(), G + 2000);
    expectFreshRound(s.room, k, G + 2000);
    const g2 = fire(k.room, k.effects, 'introDone');
    expect(fire(g2.room, g.effects, 'guessUp').room.phase).toBe('GUESSING');
  });

  it('REVEAL: the scored results are discarded and nobody scores', () => {
    const r = reveal();
    expect(r.room.game!.current!.results).toHaveLength(2);
    const k = step(r.room, skip(), G + 5000);
    expectFreshRound(r.room, k, G + 5000);
    expect(fire(k.room, r.effects, 'revealDone').room.phase).toBe('INTRO');
  });

  it('keeps a pause, holding the new introDone', () => {
    const s = intro();
    const p = step(s.room, pause(), T0 + 1000);
    const k = step(p.room, skip(), T0 + 2000);
    expect(k.room.phase).toBe('INTRO');
    expect(k.room.paused!.remainingMs).toEqual({ introDone: INTRO_MS });
  });

  it('re-schedules a pending vipGone with the new epoch', () => {
    let s = intro();
    s = step(s.room, { type: 'player:connection', playerId: idOf(1), connected: false }, T0 + 500);
    // P1 is still the VIP within the grace window (say, from a second tab).
    const k = step(s.room, skip(), T0 + 1000);
    const gone = scheduled(k.effects, 'vipGone');
    expect(gone.at).toBe(T0 + 500 + VIP_AWAY_MS);
    expect(gone.epoch).toBe(k.room.timerEpoch);
  });

  it('is refused with "No spare places left at Hard" once the level is used up', () => {
    let s = intro({ difficulty: 'hard' });
    for (let i = 1; i <= 5; i++) s = step(s.room, skip(), T0 + 1000 * i);
    expect(s.room.game!.usedPlaceIds).toHaveLength(6);
    const refused = reduce(s.room, skip(), T0 + 9000);
    expect(refused.error).toBe('No spare places left at Hard');
    expect(refused.room).toBe(s.room);
  });

  it('is refused in SCOREBOARD and FINAL, and from a non-VIP', () => {
    const s = scoreboard();
    expect(reduce(s.room, skip(), T0 + 50_000).error).toBe(ERRORS.notNow);
    expect(reduce(intro().room, skip(2), T0 + 200).error).toBe(ERRORS.notVip);
  });
});

describe('vip:end', () => {
  it('INTRO and GUESSING: the round is voided; FINAL with the rounds played so far', () => {
    for (const s of [intro(), guessing()]) {
      const e = step(s.room, end(), G + 500);
      expect(e.room.phase).toBe('FINAL');
      expect(e.room.game!.current).toBeNull();
      expect(e.room.game!.played).toEqual([]);
      expect(e.effects).toEqual([]);
      for (const t of ['introDone', 'guessUp'])
        if (s.effects.some((x) => x.type === 'schedule' && x.timer === t))
          expect(fire(e.room, s.effects, t).room).toEqual(e.room);
    }
  });

  it('REVEAL: the round counts as played', () => {
    const r = reveal();
    const e = step(r.room, end(), G + 5000);
    expect(e.room.phase).toBe('FINAL');
    expect(e.room.game!.played).toHaveLength(1);
    expect(e.room.game!.played[0]!.revealedCount).toBe(2);
    expect(e.effects).toEqual([]);
  });

  it('SCOREBOARD: FINAL, and the scoreboardDone in flight is ignored', () => {
    const s = scoreboard();
    const e = step(s.room, end(), T0 + 50_000);
    expect(e.room.phase).toBe('FINAL');
    expect(e.room.game!.played).toHaveLength(1);
    expect(fire(e.room, s.effects, 'scoreboardDone').room).toEqual(e.room);
  });

  it('works while paused, and lifts the pause', () => {
    const p = step(guessing().room, pause(), G + 1000);
    const e = step(p.room, end(), G + 2000);
    expect(e.room.phase).toBe('FINAL');
    expect(e.room.paused).toBeNull();
  });

  it('is refused in LOBBY and FINAL, and from a non-VIP', () => {
    const e = step(intro().room, end(), T0 + 200);
    expect(reduce(e.room, end(), T0 + 300).error).toBe(ERRORS.notNow);
    let lobby = createRoom(CODE, T0, 7);
    lobby = step(lobby, join(1), T0 + 1).room;
    expect(reduce(lobby, end(), T0 + 2).error).toBe(ERRORS.notNow);
    expect(reduce(intro().room, end(2), T0 + 200).error).toBe(ERRORS.notVip);
  });
});

describe('vip:kick mid-game', () => {
  const CTX = { now: T0, publicUrl: 'http://localhost', categories: [] };
  const kick = (n: number): Action => ({ type: 'vip:kick', by: idOf(1), playerId: idOf(n) });

  it('GUESSING: the kicked unlocked player leaves the round and allLocked is scheduled', () => {
    let s = guessing();
    s = step(s.room, lockIn(1), G + 1000);
    const k = step(s.room, kick(2), G + 2000);
    expect(k.effects).toContainEqual({ type: 'kicked', playerId: idOf(2) });
    expect(k.room.game!.current!.participants).toEqual([idOf(1)]);
    expect(scheduled(k.effects, 'allLocked')).toBeDefined();
    // The round goes on, without them, and scores only the VIP.
    const r = fire(k.room, k.effects, 'allLocked');
    expect(r.room.phase).toBe('REVEAL');
    expect(r.room.game!.current!.results!.map((x) => x.playerId)).toEqual([idOf(1)]);
  });

  it('SCOREBOARD: their rows leave the played rounds and the board; they cannot rejoin', () => {
    const k = step(scoreboard().room, kick(2), T0 + 100_000);
    expect(k.room.game!.played[0]!.results!.map((x) => x.playerId)).toEqual([idOf(1)]);
    const board = toView(k.room, 'screen', undefined, CTX);
    expect(board.standings!.map((x) => x.playerId)).toEqual([idOf(1)]);
    expect(board.players.map((p) => p.id)).toEqual([idOf(1)]);
    expect(reduce(k.room, join(2), T0 + 100_001).error).toBe(ERRORS.kicked);
  });
});

describe('vip:roundSettings', () => {
  const settings = (s: Partial<GameSettings>, n = 1): Action => ({
    type: 'vip:roundSettings',
    by: idOf(n),
    settings: s,
  });

  /** The Screen's round header: the gate label's number, total and multiplier. */
  const gate = (room: Room) =>
    toView(room, 'screen', undefined, { now: T0, publicUrl: 'http://localhost', categories: [] })
      .round;

  /** SCOREBOARD after round `played` of a Mixed game of `rounds`, both players locking in. */
  function scoreboardAfter(played: number, rounds: GameSettings['rounds'] = 5): Step {
    let s = reveal({ rounds, difficulty: 'mixed' });
    for (let r = 1; r < played; r++) {
      s = step(s.room, next(), T0 + 100_000 * r);
      s = step(s.room, next(), T0 + 100_000 * r + 1);
      s = fire(s.room, s.effects, 'introDone');
      const at = s.room.game!.current!.startedAt!;
      s = step(s.room, lockIn(1), at + 1000);
      s = step(s.room, lockIn(2), at + 2000);
      s = fire(s.room, s.effects, 'allLocked');
    }
    return step(s.room, next(), T0 + 100_000 * played);
  }

  it('5 → 10 keeps round 4 as scored, re-plans rounds 5–10 and boosts 8–10', () => {
    const s = scoreboardAfter(4);
    const before = s.room.game!.played[3]!;
    expect(before.multiplier).toBe(1.5);
    expect(before.results!.every((r) => r.points > 0)).toBe(true);
    const c = step(s.room, settings({ rounds: 10, timerSeconds: 45 }), T0 + 500_000);
    expect(c.room.settings.rounds).toBe(10);
    expect(c.room.settings.timerSeconds).toBe(45);
    expect(c.room.game!.played[3]).toEqual(before);
    // Played rounds keep easy, easy, medium, hard; rounds 5–10 come from the 10-round plan.
    expect(c.room.game!.levelPlan).toEqual([
      ...['easy', 'easy', 'medium', 'hard'],
      ...['medium', 'medium', 'medium', 'hard', 'hard', 'hard'],
    ]);

    // Round 5 is now ×1 at Medium with the new timer; the gate label reads "Round 5/10".
    let n = step(c.room, next(), T0 + 500_001);
    expect(n.room.game!.current!).toMatchObject({ number: 5, multiplier: 1, level: 'medium' });
    expect(gate(n.room)).toMatchObject({ number: 5, total: 10, multiplier: 1 });
    n = fire(n.room, n.effects, 'introDone');
    expect(n.room.game!.current!.endsAt! - n.room.game!.current!.startedAt!).toBe(45_000);

    const multipliers: number[] = [];
    for (let r = 5; r <= 10; r++) {
      multipliers.push(n.room.game!.current!.multiplier);
      if (r === 8) expect(gate(n.room)).toMatchObject({ number: 8, total: 10, multiplier: 1.5 });
      n = fire(n.room, n.effects, 'guessUp');
      n = step(n.room, next(), T0 + 1_000_000 * r); // REVEAL → SCOREBOARD (FINAL after 10)
      if (r === 10) break;
      n = step(n.room, next(), T0 + 1_000_000 * r + 1);
      n = fire(n.room, n.effects, 'introDone');
    }
    expect(multipliers).toEqual([1, 1, 1, 1.5, 1.5, 2]);
    expect(n.room.phase).toBe('FINAL');
    expect(n.room.game!.played.map((r) => r.multiplier)).toEqual([
      1, 1, 1, 1.5, 1, 1, 1, 1.5, 1.5, 2,
    ]);
  });

  it('10 → 5 is refused once 5 rounds are played; after 4 it is allowed', () => {
    const s = scoreboardAfter(5, 10);
    expect(reduce(s.room, settings({ rounds: 5 }), T0 + 900_000).error).toBe(ERRORS.roundsPlayed);
    const four = scoreboardAfter(4, 10);
    expect(step(four.room, settings({ rounds: 5 }), T0 + 900_000).room.settings.rounds).toBe(5);
  });

  it('a Mixed plan the unused places cannot fill is refused naming the level', () => {
    // After 5 of 10: 3 Easy and 2 Medium used. Rounds 6–10 of 15 need 5 Medium; 4 are left.
    const s = scoreboardAfter(5, 10);
    const res = reduce(s.room, settings({ rounds: 15 }), T0 + 900_000);
    expect(res.error).toBe('Japan · Medium has 4 cities left; the rest of the game needs 5.');
    expect(res.room).toBe(s.room);
  });

  it('a timer change alone applies from the next round', () => {
    const s = scoreboard();
    const c = step(s.room, settings({ timerSeconds: 20 }), T0 + 50_000);
    let n = step(c.room, next(), T0 + 50_001);
    n = fire(n.room, n.effects, 'introDone');
    const round = n.room.game!.current!;
    expect(round.endsAt! - round.startedAt!).toBe(20_000);
  });

  it('is refused outside SCOREBOARD, while paused and from a non-VIP', () => {
    const s = scoreboard();
    expect(reduce(s.room, settings({ timerSeconds: 20 }, 2), T0 + 50_000).error).toBe(
      ERRORS.notVip,
    );
    const p = step(s.room, pause(), T0 + 50_000);
    expect(reduce(p.room, settings({ timerSeconds: 20 }), T0 + 50_001).error).toBe(ERRORS.paused);
    expect(reduce(guessing().room, settings({ timerSeconds: 20 }), G + 1).error).toBe(
      ERRORS.notNow,
    );
    expect(reduce(reveal().room, settings({ rounds: 10 }), G + 9000).error).toBe(ERRORS.notNow);
  });
});

describe('vip:rematch and vip:backToLobby', () => {
  /** `null`: the category is gone from the store (the gateway reads `undefined`). */
  const rematch = (n = 1, cat: Category | null = category()): Action => ({
    type: 'vip:rematch',
    by: idOf(n),
    category: cat ?? undefined,
  });
  const cancel = (n = 1): Action => ({ type: 'vip:rematchCancel', by: idOf(n) });
  const lobby = (n = 1): Action => ({ type: 'vip:backToLobby', by: idOf(n) });
  /** rematchGo as the gateway sends it back, with the live category read then. */
  const go = (room: Room, effects: Effect[], cat: Category | null = category()): Step =>
    step(
      room,
      { ...scheduled(effects, 'rematchGo'), type: 'timer', category: cat ?? undefined },
      T0 + 99_000,
    );
  /** FINAL after one played round. */
  const final = () => step(scoreboard().room, end(), T0 + 50_000);

  it('rematch sets rematchAt and schedules rematchGo in 3 s; nothing is reset yet', () => {
    const f = final();
    const r = step(f.room, rematch(), T0 + 60_000);
    expect(r.room.rematchAt).toBe(T0 + 63_000);
    expect(scheduled(r.effects, 'rematchGo').at).toBe(T0 + 63_000);
    expect(r.room.phase).toBe('FINAL');
    expect(r.room.game).toEqual(f.room.game);
    expect(reduce(r.room, rematch(), T0 + 60_500).error).toBe(ERRORS.notNow);
  });

  it('rematch is refused from a non-VIP, outside FINAL, and when the place check fails', () => {
    const f = final().room;
    expect(reduce(f, rematch(2), T0 + 60_000).error).toBe(ERRORS.notVip);
    expect(reduce(scoreboard().room, rematch(), T0 + 60_000).error).toBe(ERRORS.notNow);
    expect(reduce(f, rematch(1, null), T0 + 60_000).error).toBe(ERRORS.noSuchCategory);
    const small = category();
    for (const level of ['easy', 'medium', 'hard'] as const)
      small.live[level]!.places = small.live[level]!.places.slice(0, 1);
    const res = reduce(f, rematch(1, small), T0 + 60_000);
    expect(res.error).toMatch(/^Japan · \w+ has 1 cit/);
    expect(res.room).toBe(f);
  });

  it('rematchGo starts a New game with the same players and settings', () => {
    const f = final();
    const r = step(f.room, rematch(), T0 + 60_000);
    const g = go(r.room, r.effects);
    expect(g.room.phase).toBe('INTRO');
    expect(g.room.rematchAt).toBeNull();
    expect(g.room.game!.number).toBe(f.room.game!.number + 1);
    expect(g.room.game!.current!.number).toBe(1);
    expect(g.room.game!.played).toEqual([]);
    expect(Object.keys(g.room.players)).toEqual(Object.keys(f.room.players));
    expect(g.room.settings).toEqual(f.room.settings);
    expect(g.room.previousGames).toEqual([{ number: f.room.game!.number, revealedPhotoIds: [] }]);
    scheduled(g.effects, 'introDone');
  });

  it('cancel clears the countdown, and the rematchGo in flight is ignored', () => {
    const r = step(final().room, rematch(), T0 + 60_000);
    expect(reduce(r.room, cancel(2), T0 + 61_000).error).toBe(ERRORS.notVip);
    const c = step(r.room, cancel(), T0 + 61_000);
    expect(c.room.rematchAt).toBeNull();
    expect(c.room.timerEpoch).toBe(r.room.timerEpoch + 1);
    expect(go(c.room, r.effects).room).toEqual(c.room);
    expect(reduce(c.room, cancel(), T0 + 62_000).error).toBe(ERRORS.notNow);
  });

  it('rematchGo with nobody connected just clears the countdown', () => {
    const r = step(final().room, rematch(), T0 + 60_000);
    let room = r.room;
    for (const n of [1, 2])
      room = step(
        room,
        { type: 'player:connection', playerId: idOf(n), connected: false },
        T0 + 61_000,
      ).room;
    const g = go(room, r.effects);
    expect(g.room.phase).toBe('FINAL');
    expect(g.room.rematchAt).toBeNull();
    expect(g.room.game).toEqual(room.game);
  });

  it('rematchGo stops the countdown when the category was taken down meanwhile', () => {
    const r = step(final().room, rematch(), T0 + 60_000);
    const g = go(r.room, r.effects, null);
    expect(g.room.phase).toBe('FINAL');
    expect(g.room.rematchAt).toBeNull();
  });

  it('a VIP who dropped during the countdown is still replaced in the new game', () => {
    let r = step(final().room, rematch(), T0 + 60_000);
    const drop = step(
      r.room,
      { type: 'player:connection', playerId: idOf(1), connected: false },
      T0 + 61_000,
    );
    r = { room: drop.room, effects: [...r.effects, ...drop.effects] };
    const g = go(r.room, r.effects);
    const v = g.effects.find((e) => e.type === 'schedule' && e.timer === 'vipGone');
    expect(v).toMatchObject({ game: g.room.game!.number, epoch: g.room.timerEpoch });
    const after = step(
      g.room,
      { ...scheduled(g.effects, 'vipGone'), type: 'timer' },
      T0 + 61_000 + VIP_AWAY_MS,
    );
    expect(after.room.vipId).toBe(idOf(2));
  });

  it('back to lobby clears the game, keeps players, settings and placeUsage, and cancels a countdown', () => {
    const f = final().room;
    const counting = step(f, rematch(), T0 + 60_000);
    const late = step(counting.room, join(3), T0 + 60_500);
    expect(late.room.players[idOf(3)]!.waiting).toBe(true);
    expect(reduce(late.room, lobby(2), T0 + 61_000).error).toBe(ERRORS.notVip);
    const l = step(late.room, lobby(), T0 + 61_000);
    expect(l.room.phase).toBe('LOBBY');
    expect(l.room.game).toBeNull();
    expect(l.room.rematchAt).toBeNull();
    expect(Object.keys(l.room.players)).toEqual(Object.keys(late.room.players));
    expect(l.room.players[idOf(3)]!.waiting).toBe(false);
    expect(l.room.settings).toEqual(f.settings);
    expect(l.room.placeUsage).toEqual(f.placeUsage);
    expect(l.room.previousGames).toEqual([{ number: f.game!.number, revealedPhotoIds: [] }]);
    expect(go(l.room, counting.effects).room).toEqual(l.room);
    expect(reduce(scoreboard().room, lobby(), T0 + 50_000).error).toBe(ERRORS.notNow);
  });

  it('placeUsage: the next game prefers places no earlier game used, after a rematch or the lobby', () => {
    // Easy, 6 places: game 1 uses five of them (round 1 and four skips).
    let s = intro({ difficulty: 'easy' });
    for (let i = 0; i < 4; i++) s = step(s.room, skip(), T0 + 200 + i);
    const used = s.room.game!.usedPlaceIds;
    expect(used).toHaveLength(5);
    const f = step(s.room, end(), T0 + 300).room;
    const unused = category().live.easy!.places.find((p) => !used.includes(p.id))!.id;

    const r = step(f, rematch(), T0 + 400);
    const g = go(r.room, r.effects);
    expect(g.room.game!.current!.placeId).toBe(unused);

    let l = step(f, lobby(), T0 + 400).room;
    l = step(l, { type: 'vip:start', by: idOf(1), category: category() }, T0 + 500).room;
    expect(l.game!.number).toBe(f.game!.number + 1);
    expect(l.game!.current!.placeId).toBe(unused);
  });
});
