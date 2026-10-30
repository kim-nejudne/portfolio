// Pausing (F28): the `host` reason, the 3-2-1 resume and the timers it restores. "Pausing" in
// docs/spec.md.
import { describe, expect, it } from 'vitest';
import {
  CHOOSE_MS,
  GRACE_MS,
  HINT_AT,
  RESUME_COUNTDOWN_MS,
  REVEAL_MS,
  SCOREBOARD_MS,
} from '../shared/constants.js';
import type { Action, Effect, Room, TimerName } from '../shared/types.js';
import { reduce } from './reducer.js';
import { guesserPoints } from './scoring.js';
import {
  SCREEN,
  SCREEN_HOST,
  asPlayer,
  dealt,
  inPhase,
  secretWord,
  started,
  step,
} from './test/rooms.js';

const DRAW_MS = 60_000;
const PAUSE: Action = { type: 'host:pause', by: SCREEN_HOST };
const RESUME: Action = { type: 'host:resume', by: SCREEN_HOST };

const timer = (room: Room, name: TimerName, epoch = room.timerEpoch): Action => ({
  type: 'timer',
  timer: name,
  turnId: room.turn!.id,
  epoch,
});

const schedules = (effects: Effect[]) =>
  effects.flatMap((e) => (e.type === 'schedule' ? [{ timer: e.timer, at: e.at }] : []));

/** Pauses at `pauseAt`, resumes at `resumeAt` and runs `resumeGo` 3 s later. */
function pauseFor(room: Room, pauseAt: number, resumeAt: number) {
  const paused = step(room, PAUSE, pauseAt).room;
  const counting = step(paused, RESUME, resumeAt).room;
  const goAt = resumeAt + RESUME_COUNTDOWN_MS;
  const res = step(counting, timer(counting, 'resumeGo'), goAt);
  return { paused, counting, goAt, ...res };
}

describe('host:pause', () => {
  it('stores the time left on the drawing clock and bumps the epoch', () => {
    const { room, at } = started();
    const res = step(room, PAUSE, at + 10_000);
    expect(res.room.paused).toEqual({
      reasons: ['host'],
      since: at + 10_000,
      remainingMs: DRAW_MS - 10_000,
      resumeAt: null,
    });
    expect(res.room.timerEpoch).toBe(room.timerEpoch + 1);
    expect(res.effects).toEqual([]);
  });

  it('is open to the token Screen and the crown holder only', () => {
    const { room, pids, at } = started();
    expect(reduce(room, { type: 'host:pause', by: SCREEN }, at)).toEqual({
      ok: false,
      error: 'notHost',
    });
    expect(reduce(room, { type: 'host:pause', by: asPlayer(pids[1]!, true) }, at)).toEqual({
      ok: false,
      error: 'notHost',
    });
    // Ana joined first, so she holds the crown.
    expect(reduce(room, { type: 'host:pause', by: asPlayer(pids[0]!, true) }, at).ok).toBe(true);
  });

  it('works in CHOOSING, DRAWING, REVEAL and SCOREBOARD, not in LOBBY or FINAL', () => {
    for (const phase of ['CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD'] as const) {
      expect(reduce(inPhase(phase), PAUSE, 2_000_000).ok, phase).toBe(true);
    }
    expect(reduce(inPhase('FINAL'), PAUSE, 2_000_000)).toEqual({
      ok: false,
      error: 'wrongPhase',
    });
    const { room } = dealt();
    const lobby = { ...room, phase: 'LOBBY' as const };
    expect(reduce(lobby, PAUSE, 2_000_000)).toEqual({ ok: false, error: 'wrongPhase' });
  });

  it('refuses a second host pause', () => {
    const { room, at } = started();
    const paused = step(room, PAUSE, at + 1000).room;
    expect(reduce(paused, PAUSE, at + 2000)).toEqual({ ok: false, error: 'paused' });
  });
});

describe('while paused', () => {
  it('refuses guesses, choices and Next', () => {
    const { room, pids, at } = started();
    const paused = step(room, PAUSE, at + 1000).room;
    const guess: Action = {
      type: 'player:guess',
      by: asPlayer(pids[1]!),
      text: secretWord(room),
      receivedAt: at + 2000,
      oneWayMs: 0,
    };
    expect(reduce(paused, guess, at + 2000)).toEqual({ ok: false, error: 'paused' });

    const choosing = step(dealt().room, PAUSE, at + 1000).room;
    const pick: Action = {
      type: 'drawer:choose',
      by: asPlayer(choosing.turn!.drawerPid),
      index: 0,
    };
    expect(reduce(choosing, pick, at + 2000)).toEqual({ ok: false, error: 'paused' });

    const reveal = step(inPhase('REVEAL'), PAUSE, 2_000_000).room;
    expect(reduce(reveal, { type: 'host:next', by: SCREEN_HOST }, 2_000_001)).toEqual({
      ok: false,
      error: 'paused',
    });
  });

  it('ignores every timer scheduled before the pause', () => {
    const { room, at } = started();
    const before = room.timerEpoch;
    const paused = step(room, PAUSE, at + 1000).room;
    for (const name of ['drawUp', 'hint', 'allGuessed'] as const) {
      expect(reduce(paused, timer(paused, name, before), at + DRAW_MS + GRACE_MS)).toEqual({
        ok: false,
        error: 'staleTimer',
      });
    }
  });

  it('holds a timer of the current epoch too (one scheduled by a skip while paused)', () => {
    const { room, at } = started();
    const paused = step(room, PAUSE, at + 1000).room;
    const reveal = step(paused, { type: 'host:skip', by: SCREEN_HOST }, at + 2000).room;
    expect(reveal.phase).toBe('REVEAL');
    expect(reduce(reveal, timer(reveal, 'revealDone'), at + 2000 + REVEAL_MS)).toEqual({
      ok: false,
      error: 'paused',
    });
  });
});

describe('host:resume and resumeGo', () => {
  it('starts the 3-2-1: resumeAt in 3 s and resumeGo scheduled, still paused meanwhile', () => {
    const { room, at } = started();
    const paused = step(room, PAUSE, at + 1000).room;
    const res = step(paused, RESUME, at + 5000);
    expect(res.room.paused).toMatchObject({ reasons: [], resumeAt: at + 8000 });
    expect(res.effects).toEqual([
      {
        type: 'schedule',
        timer: 'resumeGo',
        at: at + 8000,
        turnId: room.turn!.id,
        epoch: res.room.timerEpoch,
      },
    ]);
  });

  it('refuses resume when the host has not paused', () => {
    const { room, at } = started();
    expect(reduce(room, RESUME, at + 1000)).toEqual({ ok: false, error: 'notPaused' });
    const counting = step(step(room, PAUSE, at + 1000).room, RESUME, at + 2000).room;
    expect(reduce(counting, RESUME, at + 2500)).toEqual({ ok: false, error: 'notPaused' });
  });

  it('pausing again during the 3-2-1 stops it, and the old resumeGo goes stale', () => {
    const { room, at } = started();
    const counting = step(step(room, PAUSE, at + 1000).room, RESUME, at + 2000).room;
    const again = step(counting, PAUSE, at + 3000).room;
    expect(again.paused).toMatchObject({ reasons: ['host'], since: at + 1000, resumeAt: null });
    expect(reduce(again, timer(counting, 'resumeGo'), at + 5000)).toEqual({
      ok: false,
      error: 'staleTimer',
    });
  });

  it('restores the drawing clock with the time it had left, the countdown included', () => {
    const { room, at } = started();
    const turn = room.turn!;
    // Paused 10 s in, resumed 10 s later, drawing again 3 s after that: 13 s paused.
    const { room: after, effects, goAt } = pauseFor(room, at + 10_000, at + 20_000);
    expect(goAt).toBe(at + 23_000);
    expect(after.paused).toBeNull();
    expect(after.turn!.clockStart).toBe(turn.clockStart! + 13_000);
    expect(after.turn!.endsAt).toBe(turn.endsAt! + 13_000);
    expect(after.timerEpoch).toBeGreaterThan(room.timerEpoch);
    expect(schedules(effects)).toEqual([
      { timer: 'drawUp', at: turn.endsAt! + 13_000 + GRACE_MS },
      ...HINT_AT.map((f) => ({ timer: 'hint', at: at + 13_000 + f * DRAW_MS })),
    ]);
    expect(effects.every((e) => e.type !== 'schedule' || e.epoch === after.timerEpoch)).toBe(true);
  });

  it('paused time does not count towards a guess’s t', () => {
    const { room, pids, at } = started();
    const { room: after, goAt } = pauseFor(room, at + 10_000, at + 20_000);
    // 10 s drawn before the pause and 2 s after it.
    const res = step(
      after,
      {
        type: 'player:guess',
        by: asPlayer(pids[1]!),
        text: secretWord(room),
        receivedAt: goAt + 2000,
        oneWayMs: 0,
      },
      goAt + 2000,
    );
    expect(res.room.turn!.correct[0]).toMatchObject({
      elapsedMs: 12_000,
      points: guesserPoints(DRAW_MS, 12_000),
    });
  });

  it('a guess is still on time up to the moved endsAt', () => {
    const { room, pids, at } = started();
    const { room: after } = pauseFor(room, at + 10_000, at + 20_000);
    const lateButMoved = at + DRAW_MS + 5_000;
    const res = reduce(
      after,
      {
        type: 'player:guess',
        by: asPlayer(pids[1]!),
        text: secretWord(room),
        receivedAt: lateButMoved,
        oneWayMs: 0,
      },
      lateButMoved,
    );
    expect(res.ok).toBe(true);
  });

  it('re-schedules only the hints still to come', () => {
    const { room, at } = started();
    // The 50 % hint fires at 30 s; pause at 40 s for 10 s (+3).
    const hinted = step(room, timer(room, 'hint'), at + 30_000).room;
    expect(hinted.turn!.hintIndexes).toHaveLength(1);
    const { effects } = pauseFor(hinted, at + 40_000, at + 50_000);
    expect(schedules(effects).filter((s) => s.timer === 'hint')).toEqual([
      { timer: 'hint', at: at + 13_000 + HINT_AT[1] * DRAW_MS },
    ]);
  });

  it('a hint due during the pause comes right after it', () => {
    const { room, at } = started();
    const { room: after, effects, goAt } = pauseFor(room, at + 29_000, at + 40_000);
    const firstHint = schedules(effects).find((s) => s.timer === 'hint')!;
    expect(firstHint.at).toBe(at + 30_000 + 14_000);
    expect(firstHint.at).toBeGreaterThan(goAt);
    const hinted = step(after, timer(after, 'hint'), firstHint.at).room;
    expect(hinted.turn!.hintIndexes).toHaveLength(1);
  });

  it('an early end held by the pause is scheduled again', () => {
    const { room, pids, at } = started(['Ana', 'Ben']);
    const got = step(
      room,
      {
        type: 'player:guess',
        by: asPlayer(pids[1]!),
        text: secretWord(room),
        receivedAt: at + 5000,
        oneWayMs: 0,
      },
      at + 5000,
    ).room;
    const { effects, goAt } = pauseFor(got, at + 5500, at + 6000);
    expect(schedules(effects)).toContainEqual({ timer: 'allGuessed', at: goAt + 1500 });
  });

  it('restores an open choice: chooseUp 12 s after the deal plus the paused time', () => {
    const { room, at } = dealt();
    const { room: after, effects } = pauseFor(room, at + 5000, at + 9000);
    expect(after.turn!.dealtAt).toBe(at + 7000);
    expect(schedules(effects)).toEqual([{ timer: 'chooseUp', at: at + 7000 + CHOOSE_MS }]);
  });

  it('restores the reveal’s auto-advance and the upcoming drawer’s choice', () => {
    const reveal = inPhase('REVEAL');
    const pausedAt = reveal.advanceAt! - REVEAL_MS + 2000;
    const up = reveal.upcoming!;
    const { room: after, effects } = pauseFor(reveal, pausedAt, pausedAt + 1000);
    expect(after.advanceAt).toBe(reveal.advanceAt! + 4000);
    expect(after.upcoming!.dealtAt).toBe(up.dealtAt + 4000);
    expect(schedules(effects)).toEqual(
      expect.arrayContaining([
        { timer: 'chooseUp', at: up.dealtAt + 4000 + CHOOSE_MS },
        { timer: 'revealDone', at: reveal.advanceAt! + 4000 },
      ]),
    );
  });

  it('restores the scoreboard’s auto-advance', () => {
    const board = inPhase('SCOREBOARD');
    const pausedAt = board.advanceAt! - SCOREBOARD_MS + 1000;
    const { effects } = pauseFor(board, pausedAt, pausedAt + 2000);
    expect(schedules(effects)).toContainEqual({
      timer: 'scoreboardDone',
      at: board.advanceAt! + 5000,
    });
  });

  it('a stale resumeGo is ignored', () => {
    const { room, at } = started();
    const counting = step(step(room, PAUSE, at + 1000).room, RESUME, at + 2000).room;
    expect(
      reduce(counting, timer(counting, 'resumeGo', counting.timerEpoch - 1), at + 5000),
    ).toEqual({ ok: false, error: 'staleTimer' });
  });
});

describe('moving on while paused', () => {
  it('a skip keeps the pause; the next drawer’s 12 s start at resumeGo', () => {
    const { room, at } = dealt();
    const paused = step(room, PAUSE, at + 1000).room;
    const skipped = step(paused, { type: 'host:skip', by: SCREEN_HOST }, at + 4000).room;
    expect(skipped.phase).toBe('CHOOSING');
    expect(skipped.turn!.id).not.toBe(room.turn!.id);
    expect(skipped.paused).toMatchObject({ reasons: ['host'], since: at + 4000 });
    const { effects, goAt } = pauseForResumeOnly(skipped, at + 6000);
    expect(schedules(effects)).toEqual([{ timer: 'chooseUp', at: goAt + CHOOSE_MS }]);
  });

  it('a skip during the 3-2-1 keeps the countdown going', () => {
    const { room, at } = started();
    const counting = step(step(room, PAUSE, at + 1000).room, RESUME, at + 2000).room;
    const res = step(counting, { type: 'host:skip', by: SCREEN_HOST }, at + 3000);
    expect(res.room.phase).toBe('REVEAL');
    expect(res.room.paused).toMatchObject({ reasons: [], since: at + 3000, resumeAt: at + 5000 });
    const go = res.effects.find((e) => e.type === 'schedule' && e.timer === 'resumeGo');
    expect(go).toMatchObject({ at: at + 5000, epoch: res.room.timerEpoch });
    const resumed = step(res.room, timer(res.room, 'resumeGo'), at + 5000);
    expect(resumed.room.paused).toBeNull();
    expect(resumed.room.advanceAt).toBe(at + 3000 + REVEAL_MS + 2000);
  });

  it('the game ending clears the pause', () => {
    const { room, at } = started();
    const paused = step(room, PAUSE, at + 1000).room;
    const final = step(paused, { type: 'host:end', by: SCREEN_HOST }, at + 2000).room;
    expect(final.phase).toBe('FINAL');
    expect(final.paused).toBeNull();
  });
});

/** Resumes a room paused by the host at `resumeAt` and runs its resumeGo. */
function pauseForResumeOnly(room: Room, resumeAt: number) {
  const counting = step(room, RESUME, resumeAt).room;
  const goAt = resumeAt + RESUME_COUNTDOWN_MS;
  return { goAt, ...step(counting, timer(counting, 'resumeGo'), goAt) };
}
