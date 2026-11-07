import { describe, expect, it } from 'vitest';
import {
  ALL_LOCKED_MS,
  EMOJI,
  GRACE_MS,
  INTRO_MS,
  RESUME_COUNTDOWN_MS,
  SCOREBOARD_MS,
  SCREEN_AWAY_MS,
  VIP_AWAY_MS,
} from '#shared/constants.js';
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
const pause = (n = 1): Action => ({ type: 'vip:pause', by: idOf(n) });
const resume = (n = 1): Action => ({ type: 'vip:resume', by: idOf(n) });
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
        lat: 35,
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

function schedules(effects: Effect[], timer: string) {
  return effects.flatMap((e) => (e.type === 'schedule' && e.timer === timer ? [e] : []));
}
function scheduled(effects: Effect[], timer: string) {
  const s = schedules(effects, timer)[0];
  if (!s) throw new Error(`no ${timer} scheduled`);
  return s;
}
/** Fires the timer `effects` scheduled, at `at` (default: its own time). */
const fire = (room: Room, effects: Effect[], timer: string, at?: number): Step => {
  const s = scheduled(effects, timer);
  return step(room, { ...s, type: 'timer' }, at ?? s.at);
};

/** Players 1…n and a Screen in a 5-round Japan game, at INTRO since T0 + 100. */
function intro(n = 2): Step {
  let room = createRoom(CODE, T0, 7);
  for (let i = 1; i <= n; i++) room = step(room, join(i), T0 + i).room;
  room = step(room, { type: 'screen:join' }, T0 + 50).room;
  room = step(
    room,
    {
      type: 'vip:settings',
      by: idOf(1),
      settings: { categoryId: 'japan', rounds: 5 },
      liveIds: ['japan'],
    },
    T0 + 60,
  ).room;
  return step(room, { type: 'vip:start', by: idOf(1), category: category() }, T0 + 100);
}
const G = T0 + 100 + INTRO_MS; // GUESSING starts
function guessing(n = 2): Step {
  const s = intro(n);
  return fire(s.room, s.effects, 'introDone');
}
function reveal(n = 2): Step {
  const s = guessing(n);
  return fire(s.room, s.effects, 'guessUp');
}

/** Resumes with no other reason: vip:resume at `at`, then resumeGo at its time. */
function resumeAll(room: Room, at: number): Step & { go: number } {
  const r = step(room, resume(), at);
  expect(r.room.paused?.resumeAt).toBe(at + RESUME_COUNTDOWN_MS);
  const go = scheduled(r.effects, 'resumeGo').at;
  expect(go).toBe(at + RESUME_COUNTDOWN_MS);
  return { ...fire(r.room, r.effects, 'resumeGo'), go };
}

describe('vip:pause in GUESSING', () => {
  it('stores the remaining time, bumps timerEpoch, and the stale guessUp is ignored', () => {
    const g = guessing();
    const endsAt = g.room.game!.current!.endsAt!;
    const p = step(g.room, pause(), G + 10_000);
    expect(p.room.paused).toEqual({
      reasons: ['vip'],
      since: G + 10_000,
      remainingMs: { guessUp: endsAt + GRACE_MS - (G + 10_000) },
      resumeAt: null,
    });
    expect(p.room.timerEpoch).toBe(g.room.timerEpoch + 1);
    expect(schedules(p.effects, 'guessUp')).toEqual([]);
    const late = fire(p.room, g.effects, 'guessUp');
    expect(late.room.phase).toBe('GUESSING');
  });

  it('rejects aims and lock-ins while paused, and through the 3-2-1', () => {
    const p = step(guessing().room, pause(), G + 1000);
    const aim: Action = { type: 'player:aim', by: idOf(2), lat: 1, lng: 2 };
    expect(reduce(p.room, aim, G + 1100).error).toBe(ERRORS.paused);
    expect(reduce(p.room, lockIn(2), G + 1100).error).toBe(ERRORS.paused);
    const counting = step(p.room, resume(), G + 2000).room;
    expect(reduce(counting, lockIn(2), G + 2100).error).toBe(ERRORS.paused);
  });

  it('resumes after the 3-2-1 with the remaining time, moving endsAt forward', () => {
    const g = guessing();
    const endsAt = g.room.game!.current!.endsAt!;
    const p = step(g.room, pause(), G + 10_000);
    const r = resumeAll(p.room, G + 25_000);
    const paused = r.go - (G + 10_000);
    expect(r.room.paused).toBeNull();
    expect(r.room.game!.current!.endsAt).toBe(endsAt + paused);
    const up = scheduled(r.effects, 'guessUp');
    expect(up.at).toBe(endsAt + paused + GRACE_MS);
    expect(up.epoch).toBe(r.room.timerEpoch);
    expect(fire(r.room, r.effects, 'guessUp').room.phase).toBe('REVEAL');
    // Players can lock in again.
    expect(reduce(r.room, lockIn(2), r.go + 1).error).toBeUndefined();
  });

  it('holds a pending allLocked, and one that comes due while paused', () => {
    const g = guessing();
    const one = step(g.room, lockIn(1), G + 1000);
    const all = step(one.room, lockIn(2), G + 2000);
    expect(scheduled(all.effects, 'allLocked').at).toBe(G + 2000 + ALL_LOCKED_MS);
    const p = step(all.room, pause(), G + 2400);
    expect(p.room.paused!.remainingMs['allLocked']).toBe(ALL_LOCKED_MS - 400);
    const r = resumeAll(p.room, G + 5000);
    expect(scheduled(r.effects, 'allLocked').at).toBe(r.go + ALL_LOCKED_MS - 400);

    // The only unlocked player drops while paused: allLocked waits for the resume.
    const p2 = step(one.room, pause(), G + 1500);
    const d = step(p2.room, drop(2), G + 1600);
    expect(schedules(d.effects, 'allLocked')).toEqual([]);
    expect(d.room.paused!.remainingMs['allLocked']).toBe(ALL_LOCKED_MS);
    const r2 = resumeAll(d.room, G + 3000);
    expect(scheduled(r2.effects, 'allLocked').at).toBe(r2.go + ALL_LOCKED_MS);
    expect(fire(r2.room, r2.effects, 'allLocked').room.phase).toBe('REVEAL');
  });
});

describe('vip:pause in the other timed phases', () => {
  it('INTRO: introDone keeps its remaining time', () => {
    const s = intro();
    const p = step(s.room, pause(), T0 + 1100);
    expect(p.room.paused!.remainingMs).toEqual({ introDone: INTRO_MS - 1000 });
    expect(fire(p.room, s.effects, 'introDone').room.phase).toBe('INTRO');
    const r = resumeAll(p.room, T0 + 9000);
    expect(scheduled(r.effects, 'introDone').at).toBe(r.go + INTRO_MS - 1000);
    const g = fire(r.room, r.effects, 'introDone');
    expect(g.room.phase).toBe('GUESSING');
  });

  it('REVEAL holds its step and resumes every remaining reveal timer', () => {
    const rv = reveal();
    const at0 = scheduled(rv.effects, 'revealTarget').at - 1500; // REVEAL start
    const target = fire(rv.room, rv.effects, 'revealTarget');
    const step0 = step(
      target.room,
      { ...schedules(rv.effects, 'revealStep')[0]!, type: 'timer' },
      at0 + 3000,
    );
    expect(step0.room.game!.current!.revealedCount).toBe(1);
    const p = step(step0.room, pause(), at0 + 3200);
    const remaining = p.room.paused!.remainingMs;
    const step1 = schedules(rv.effects, 'revealStep')[1]!;
    const done = scheduled(rv.effects, 'revealDone');
    expect(remaining['revealStep:1']).toBe(step1.at - (at0 + 3200));
    expect(remaining['revealDone']).toBe(done.at - (at0 + 3200));
    // Already-fired timers come back with 0 left; firing them again changes nothing.
    expect(remaining['revealTarget']).toBe(0);

    // The old timers are stale: the reveal holds.
    let held = step(p.room, { ...step1, type: 'timer' }, step1.at).room;
    held = step(held, { ...done, type: 'timer' }, done.at).room;
    expect(held.phase).toBe('REVEAL');
    expect(held.game!.current!.revealedCount).toBe(1);

    const r = resumeAll(held, at0 + 20_000);
    const again = schedules(r.effects, 'revealStep');
    expect(again.find((e) => e.k === 1)!.at).toBe(r.go + remaining['revealStep:1']!);
    expect(scheduled(r.effects, 'revealDone').at).toBe(r.go + remaining['revealDone']!);
    const next = fire(
      r.room,
      again.filter((e) => e.k === 1),
      'revealStep',
    );
    expect(next.room.game!.current!.revealedCount).toBe(2);
    expect(fire(next.room, r.effects, 'revealDone').room.phase).toBe('SCOREBOARD');
  });

  it('SCOREBOARD holds the board', () => {
    const rv = reveal();
    const sb = fire(rv.room, rv.effects, 'revealDone');
    expect(sb.room.phase).toBe('SCOREBOARD');
    const at = scheduled(sb.effects, 'scoreboardDone').at - SCOREBOARD_MS;
    const p = step(sb.room, pause(), at + 2000);
    expect(p.room.paused!.remainingMs).toEqual({ scoreboardDone: SCOREBOARD_MS - 2000 });
    expect(fire(p.room, sb.effects, 'scoreboardDone').room.phase).toBe('SCOREBOARD');
    const r = resumeAll(p.room, at + 30_000);
    expect(scheduled(r.effects, 'scoreboardDone').at).toBe(r.go + SCOREBOARD_MS - 2000);
    const next = fire(r.room, r.effects, 'scoreboardDone');
    expect(next.room.phase).toBe('INTRO');
    expect(next.room.game!.current!.number).toBe(2);
  });
});

describe('pause and resume refusals', () => {
  it('pausing is refused in LOBBY and FINAL and from a non-VIP; a second pause is refused', () => {
    let lobby = createRoom(CODE, T0, 7);
    lobby = step(lobby, join(1), T0 + 1).room;
    expect(reduce(lobby, pause(), T0 + 2).error).toBe(ERRORS.notTimed);
    const g = guessing();
    expect(reduce(g.room, pause(2), G + 1).error).toBe(ERRORS.notVip);
    const p = step(g.room, pause(), G + 1);
    expect(reduce(p.room, pause(), G + 2).error).toBe(ERRORS.paused);
    const final = { ...g.room, phase: 'FINAL' as const };
    expect(reduce(final, pause(), G + 1).error).toBe(ERRORS.notTimed);
  });

  it('resuming is refused when the VIP did not pause, and from a non-VIP', () => {
    const g = guessing();
    expect(reduce(g.room, resume(), G + 1).error).toBe(ERRORS.notPaused);
    const p = step(g.room, pause(), G + 1);
    expect(reduce(p.room, resume(2), G + 2).error).toBe(ERRORS.notVip);
  });
});

describe('the screenAway reason', () => {
  it('pauses when no Screen has been connected for SCREEN_AWAY_MS in a timed phase', () => {
    const g = guessing();
    const left = step(g.room, { type: 'screen:leave' }, G + 1000);
    const gone = scheduled(left.effects, 'screenGone');
    expect(gone.at).toBe(G + 1000 + SCREEN_AWAY_MS);
    expect(left.room.paused).toBeNull();
    const p = fire(left.room, left.effects, 'screenGone');
    expect(p.room.paused).toMatchObject({
      reasons: ['screenAway'],
      since: gone.at,
      resumeAt: null,
    });
    expect(p.room.timerEpoch).toBe(g.room.timerEpoch + 1);

    // A Screen joining clears it and starts the 3-2-1.
    const back = step(p.room, { type: 'screen:join' }, gone.at + 5000);
    expect(back.room.paused).toMatchObject({
      reasons: [],
      resumeAt: gone.at + 5000 + RESUME_COUNTDOWN_MS,
    });
    const go = fire(back.room, back.effects, 'resumeGo');
    expect(go.room.paused).toBeNull();
    expect(go.room.game!.current!.endsAt).toBe(
      // Paused from gone.at to the resumeGo: 5 s away plus the 3-2-1.
      g.room.game!.current!.endsAt! + 5000 + RESUME_COUNTDOWN_MS,
    );
  });

  it('a Screen back within SCREEN_AWAY_MS (or one more still connected) means no pause', () => {
    const g = guessing();
    const left = step(g.room, { type: 'screen:leave' }, G + 1000);
    const back = step(left.room, { type: 'screen:join' }, G + 2000);
    const leftAgain = step(back.room, { type: 'screen:leave' }, G + 3000);
    // The first leave's timer is not this absence's.
    expect(fire(leftAgain.room, left.effects, 'screenGone').room.paused).toBeNull();
    expect(fire(leftAgain.room, leftAgain.effects, 'screenGone').room.paused).not.toBeNull();

    const two = step(g.room, { type: 'screen:join' }, G + 500).room;
    expect(schedules(step(two, { type: 'screen:leave' }, G + 1000).effects, 'screenGone')).toEqual(
      [],
    );
  });

  it('a stray second leave does not push the deadline back', () => {
    const left = step(guessing().room, { type: 'screen:leave' }, G + 1000);
    const stray = step(left.room, { type: 'screen:leave' }, G + 2000);
    expect(schedules(stray.effects, 'screenGone')).toEqual([]);
    expect(fire(stray.room, left.effects, 'screenGone').room.paused?.reasons).toEqual([
      'screenAway',
    ]);
  });

  it('is never set in LOBBY or FINAL', () => {
    let lobby = createRoom(CODE, T0, 7);
    lobby = step(lobby, { type: 'screen:join' }, T0 + 1).room;
    expect(schedules(step(lobby, { type: 'screen:leave' }, T0 + 2).effects, 'screenGone')).toEqual(
      [],
    );
    // A Screen that left in GUESSING but the game reached FINAL by the time it fires.
    const g = guessing();
    const left = step(g.room, { type: 'screen:leave' }, G + 1000);
    const final = { ...left.room, phase: 'FINAL' as const };
    expect(fire(final, left.effects, 'screenGone').room.paused).toBeNull();
  });

  it('survives the VIP pause bumping the epoch, and resumes only when both reasons clear', () => {
    const g = guessing();
    const left = step(g.room, { type: 'screen:leave' }, G + 1000);
    const p = step(left.room, pause(), G + 2000);
    const both = fire(p.room, left.effects, 'screenGone');
    expect(both.room.paused!.reasons).toEqual(['vip', 'screenAway']);
    expect(both.room.paused!.since).toBe(G + 2000);

    const vipDone = step(both.room, resume(), G + 6000);
    expect(vipDone.room.paused).toMatchObject({ reasons: ['screenAway'], resumeAt: null });
    expect(schedules(vipDone.effects, 'resumeGo')).toEqual([]);

    const back = step(vipDone.room, { type: 'screen:join' }, G + 9000);
    expect(back.room.paused).toMatchObject({
      reasons: [],
      resumeAt: G + 9000 + RESUME_COUNTDOWN_MS,
    });
    expect(fire(back.room, back.effects, 'resumeGo').room.paused).toBeNull();
  });

  it('a new reason during the 3-2-1 cancels it', () => {
    const p = step(guessing().room, pause(), G + 1000);
    const counting = step(p.room, resume(), G + 2000);
    const again = step(counting.room, pause(), G + 3000);
    expect(again.room.paused).toMatchObject({ reasons: ['vip'], since: G + 1000, resumeAt: null });
    // The cancelled countdown's resumeGo is ignored.
    expect(fire(again.room, counting.effects, 'resumeGo').room.paused).not.toBeNull();
  });
});

describe('the VIP while paused', () => {
  it('a VIP who disconnects while paused is replaced after VIP_AWAY_MS, and the new VIP resumes', () => {
    const p = step(guessing().room, pause(), G + 1000);
    const d = step(p.room, drop(1), G + 2000);
    const gone = fire(d.room, d.effects, 'vipGone');
    expect(gone.room.vipId).toBe(idOf(2));
    expect(gone.room.paused!.reasons).toEqual(['vip']);
    const r = step(gone.room, resume(2), G + 2000 + VIP_AWAY_MS + 10);
    expect(r.room.paused!.resumeAt).not.toBeNull();
  });

  it('a pause re-schedules a pending vipGone with the new epoch', () => {
    const g = guessing(3);
    const d = step(g.room, drop(1), G + 1000);
    const away = d.room.vipAwayUntil!;
    // Player 1 is still VIP during the grace, but cannot pause while disconnected; pausing via the
    // screenAway reason bumps the epoch just the same.
    const left = step(d.room, { type: 'screen:leave' }, G + 1500);
    const p = fire(left.room, left.effects, 'screenGone');
    const again = scheduled(p.effects, 'vipGone');
    expect(again).toMatchObject({ at: away, epoch: p.room.timerEpoch });
    expect(fire(p.room, d.effects, 'vipGone').room.vipId).toBe(idOf(1)); // the old one is stale
    expect(fire(p.room, p.effects, 'vipGone').room.vipId).toBe(idOf(2));
  });
});
