import { describe, expect, it } from 'vitest';
import { ALL_GUESSED_MS, FEED_MAX, GRACE_MS, REVEAL_MS } from '../shared/constants.js';
import type { Action, Room } from '../shared/types.js';
import { reduce } from './reducer.js';
import { guesserPoints } from './scoring.js';
import { V0_WORDS } from './words.v0.js';
import {
  SCREEN,
  SCREEN_HOST,
  T0,
  asPlayer,
  makeRoom,
  secretWord,
  started,
  step,
  withPlayers,
} from './test/rooms.js';

const DRAW_MS = 60_000;

const guess = (pid: string, text: string, receivedAt: number): Action => ({
  type: 'player:guess',
  by: asPlayer(pid),
  text,
  receivedAt,
  oneWayMs: 40,
});

const timer = (room: Room, name: 'drawUp' | 'allGuessed' | 'revealDone'): Action => ({
  type: 'timer',
  timer: name,
  turnId: room.turn!.id,
  epoch: room.timerEpoch,
});

/** Ends the current turn by time and moves on: REVEAL, then the next turn or FINAL. */
function playOut(room: Room, now: number): Room {
  const reveal = step(room, timer(room, 'drawUp'), now).room;
  return step(reveal, timer(reveal, 'revealDone'), now + REVEAL_MS).room;
}

describe('starting a turn', () => {
  it('goes straight to DRAWING with a word from the v0 list and three distinct choices', () => {
    const { room } = started();
    const turn = room.turn!;
    expect(turn.word).not.toBeNull();
    expect(V0_WORDS).toContainEqual(turn.word);
    expect(new Set(turn.choices.map((c) => c.id)).size).toBe(3);
    expect(turn.choices).toContainEqual(turn.word);
  });

  it('starts the clock now, ends after drawSeconds and schedules drawUp after the grace window', () => {
    const { room, at, pids } = started();
    const turn = room.turn!;
    expect(turn.clockStart).toBe(at);
    expect(turn.endsAt).toBe(at + DRAW_MS);
    const { effects } = step(
      withPlayers(['Ana', 'Ben', 'Cy']).room,
      { type: 'host:start', by: SCREEN_HOST },
      at,
    );
    expect(effects).toContainEqual({
      type: 'schedule',
      at: at + DRAW_MS + GRACE_MS,
      timer: 'drawUp',
      turnId: turn.id,
      epoch: room.timerEpoch,
    });
    expect(effects).toContainEqual({ type: 'inkOpen', turnId: turn.id, drawerPid: pids[0] });
    expect(effects).toContainEqual({ type: 'fx', to: { pid: pids[0] }, fx: { kind: 'yourTurn' } });
  });

  it('draws the word from the seeded RNG and stores the advanced state', () => {
    const { room: a } = started();
    const { room: b } = started();
    expect(a.turn!.word).toEqual(b.turn!.word);
    expect(a.rngState).not.toBe(makeRoom().rngState);
  });

  it('uses the drawSeconds setting', () => {
    const { room: joined } = withPlayers(
      ['Ana', 'Ben'],
      makeRoom({ settings: { ...makeRoom().settings, drawSeconds: 45 } }),
    );
    const { room } = step(joined, { type: 'host:start', by: SCREEN_HOST }, T0 + 1000);
    expect(room.turn!.endsAt).toBe(T0 + 1000 + 45_000);
  });
});

describe('player:guess', () => {
  it('accepts the word lowercase-trimmed and scores it with the formula on uncorrected time', () => {
    const { room, pids, at } = started();
    const ben = pids[1]!;
    const word = secretWord(room);
    const { room: after, effects } = step(
      room,
      guess(ben, `  ${word.toUpperCase()} `, at + 9_000),
      at + 9_000,
    );
    const points = guesserPoints(DRAW_MS, 9_000);
    expect(points).toBe(270);
    expect(after.turn!.correct).toEqual([
      { pid: ben, receivedAt: at + 9_000, oneWayMs: 40, elapsedMs: 9_000, points },
    ]);
    expect(after.players[ben]!.score).toBe(points);
    expect(effects).toEqual([
      { type: 'fx', to: 'all', fx: { kind: 'correct', pid: ben, points, order: 1 } },
    ]);
  });

  it('feeds a wrong guess to the Screen and shakes the guesser’s box, scoring nothing', () => {
    const { room, pids, at } = started();
    const ben = pids[1]!;
    const { room: after, effects } = step(room, guess(ben, 'zzz', at + 1_000), at + 1_000);
    expect(after.turn!.correct).toEqual([]);
    expect(after.players[ben]!.score).toBe(0);
    expect(after.turn!.feed).toEqual([{ pid: ben, text: 'zzz', at: at + 1_000 }]);
    expect(after.turn!.guessCount[ben]).toBe(1);
    expect(effects).toEqual([
      { type: 'fx', to: 'screen', fx: { kind: 'wrongGuess', pid: ben, text: 'zzz' } },
      { type: 'fx', to: { pid: ben }, fx: { kind: 'wrong' } },
    ]);
  });

  it(`keeps only the last ${FEED_MAX} wrong guesses in the feed`, () => {
    let { room } = started();
    const { pids, at } = started();
    for (let i = 0; i < FEED_MAX + 2; i++) {
      room = step(room, guess(pids[1 + (i % 2)]!, `nope${i}`, at + i), at + i).room;
    }
    expect(room.turn!.feed).toHaveLength(FEED_MAX);
    expect(room.turn!.feed.at(-1)!.text).toBe(`nope${FEED_MAX + 1}`);
  });

  it('schedules allGuessed 1.5 s after the last connected guesser is correct', () => {
    const { room, pids, at } = started();
    const word = secretWord(room);
    const first = step(room, guess(pids[1]!, word, at + 1_000), at + 1_000);
    expect(first.effects.some((e) => e.type === 'schedule')).toBe(false);
    const second = step(first.room, guess(pids[2]!, word, at + 2_000), at + 2_000);
    expect(second.effects).toContainEqual({
      type: 'schedule',
      at: at + 2_000 + ALL_GUESSED_MS,
      timer: 'allGuessed',
      turnId: room.turn!.id,
      epoch: room.timerEpoch,
    });
    expect(second.effects).toContainEqual({
      type: 'fx',
      to: 'all',
      fx: { kind: 'correct', pid: pids[2], points: guesserPoints(DRAW_MS, 2_000), order: 2 },
    });
  });

  it('schedules allGuessed when the last guesser without the word leaves', () => {
    const { room, pids, at } = started();
    const r = step(room, guess(pids[1]!, secretWord(room), at + 1_000), at + 1_000).room;
    const { effects } = step(r, { type: 'player:leave', by: asPlayer(pids[2]!) }, at + 2_000);
    expect(effects).toContainEqual({
      type: 'schedule',
      at: at + 2_000 + ALL_GUESSED_MS,
      timer: 'allGuessed',
      turnId: room.turn!.id,
      epoch: room.timerEpoch,
    });
  });

  it('does not schedule allGuessed when a guesser leaves before anyone got it', () => {
    const { room, pids, at } = started();
    const { effects } = step(room, { type: 'player:leave', by: asPlayer(pids[2]!) }, at + 2_000);
    expect(effects.some((e) => e.type === 'schedule')).toBe(false);
  });

  it('rejects a guess from the drawer, a repeat correct guesser, and after endsAt', () => {
    const { room, pids, at } = started();
    const word = secretWord(room);
    expect(reduce(room, guess(pids[0]!, word, at + 1), at + 1)).toEqual({
      ok: false,
      error: 'drawerCannotGuess',
    });
    const got = step(room, guess(pids[1]!, word, at + 1), at + 1).room;
    expect(reduce(got, guess(pids[1]!, 'again', at + 2), at + 2)).toEqual({
      ok: false,
      error: 'alreadyGuessed',
    });
    const late = at + DRAW_MS + 1;
    expect(reduce(room, guess(pids[2]!, word, late), late)).toEqual({
      ok: false,
      error: 'tooLate',
    });
  });

  it('rejects a guess outside DRAWING, while paused, or from a Screen', () => {
    const { room: lobby, pids } = withPlayers(['Ana', 'Ben']);
    expect(reduce(lobby, guess(pids[1]!, 'x', T0), T0)).toEqual({ ok: false, error: 'wrongPhase' });

    const { room, at } = started();
    const paused: Room = {
      ...room,
      paused: { reasons: ['host'], since: at, remainingMs: null, resumeAt: null },
    };
    expect(reduce(paused, guess(pids[1]!, 'x', at + 1), at + 1)).toEqual({
      ok: false,
      error: 'paused',
    });

    const fromScreen = { ...guess(pids[1]!, 'x', at + 1), by: SCREEN } as Action;
    expect(reduce(room, fromScreen, at + 1)).toEqual({ ok: false, error: 'notPlayer' });
  });
});

describe('DRAWING → REVEAL', () => {
  it('drawUp awards the drawer half the guessers’ points, closes the ink and schedules revealDone', () => {
    const { room, pids, at } = started();
    const word = secretWord(room);
    let r = step(room, guess(pids[1]!, word, at + 9_000), at + 9_000).room; // 270
    r = step(r, guess(pids[2]!, word, at + 30_000), at + 30_000).room; // 200
    const now = at + DRAW_MS + GRACE_MS;
    const { room: after, effects } = step(r, timer(r, 'drawUp'), now);

    expect(after.phase).toBe('REVEAL');
    expect(after.timerEpoch).toBe(r.timerEpoch + 1);
    expect(after.turn!.drawerPoints).toBe(235);
    expect(after.turn!.endReason).toBe('time');
    expect(after.players[pids[0]!]!.score).toBe(235);
    expect(effects).toEqual([
      { type: 'inkClose', turnId: 1 },
      { type: 'fx', to: 'all', fx: { kind: 'turnEnd', reason: 'time' } },
      {
        type: 'schedule',
        at: now + REVEAL_MS,
        timer: 'revealDone',
        turnId: 1,
        epoch: after.timerEpoch,
      },
    ]);
    expect(after.history).toEqual([
      expect.objectContaining({
        turnId: 1,
        drawerPid: pids[0],
        word,
        points: { [pids[1]!]: 270, [pids[2]!]: 200, [pids[0]!]: 235 },
      }),
    ]);
  });

  it('allGuessed ends the turn with reason allGuessed', () => {
    const { room, pids, at } = started();
    const word = secretWord(room);
    let r = step(room, guess(pids[1]!, word, at + 1_000), at + 1_000).room;
    r = step(r, guess(pids[2]!, word, at + 2_000), at + 2_000).room;
    const { room: after } = step(r, timer(r, 'allGuessed'), at + 3_500);
    expect(after.phase).toBe('REVEAL');
    expect(after.turn!.endReason).toBe('allGuessed');
  });

  it('does not schedule revealDone without auto-advance', () => {
    const { room: joined } = withPlayers(
      ['Ana', 'Ben'],
      makeRoom({ settings: { ...makeRoom().settings, autoAdvance: false } }),
    );
    const room = step(joined, { type: 'host:start', by: SCREEN_HOST }, T0 + 1000).room;
    const { effects } = step(room, timer(room, 'drawUp'), T0 + 70_000);
    expect(effects.some((e) => e.type === 'schedule')).toBe(false);
  });

  it('host:skip ends the turn as a skip and keeps points already earned', () => {
    const { room, pids, at } = started();
    const r = step(room, guess(pids[1]!, secretWord(room), at + 9_000), at + 9_000).room;
    const { room: after, effects } = step(r, { type: 'host:skip', by: SCREEN_HOST }, at + 10_000);
    expect(after.phase).toBe('REVEAL');
    expect(after.turn!.endReason).toBe('skip');
    expect(after.players[pids[1]!]!.score).toBe(270);
    expect(after.players[pids[0]!]!.score).toBe(135);
    expect(effects).toContainEqual({
      type: 'fx',
      to: 'all',
      fx: { kind: 'turnEnd', reason: 'skip' },
    });
    expect(reduce(room, { type: 'host:skip', by: SCREEN }, at)).toEqual({
      ok: false,
      error: 'notHost',
    });
  });

  it('the drawer leaving ends the turn as a skip', () => {
    const { room, pids, at } = started();
    const { room: after, effects } = step(
      room,
      { type: 'player:leave', by: asPlayer(pids[0]!) },
      at + 5_000,
    );
    expect(after.phase).toBe('REVEAL');
    expect(after.turn!.endReason).toBe('skip');
    expect(effects).toContainEqual({ type: 'inkClose', turnId: 1 });
  });
});

describe('stale timers', () => {
  it('ignores a drawUp from an earlier epoch', () => {
    const { room, at } = started();
    const stale = timer(room, 'drawUp');
    const skipped = step(room, { type: 'host:skip', by: SCREEN_HOST }, at + 1_000).room;
    expect(reduce(skipped, stale, at + DRAW_MS + GRACE_MS)).toEqual({
      ok: false,
      error: 'staleTimer',
    });
  });

  it('ignores a timer for another turn', () => {
    const { room, at } = started();
    const other = { ...timer(room, 'drawUp'), turnId: room.turn!.id + 1 } as Action;
    expect(reduce(room, other, at + DRAW_MS)).toEqual({ ok: false, error: 'staleTimer' });
  });

  it('ignores allGuessed once drawUp has already ended the turn', () => {
    const { room, pids, at } = started();
    const word = secretWord(room);
    let r = step(room, guess(pids[1]!, word, at + 1_000), at + 1_000).room;
    r = step(r, guess(pids[2]!, word, at + 2_000), at + 2_000).room;
    const allGuessed = timer(r, 'allGuessed');
    const revealed = step(r, timer(r, 'drawUp'), at + 3_000).room;
    expect(reduce(revealed, allGuessed, at + 3_500)).toEqual({ ok: false, error: 'staleTimer' });
  });

  it('ignores any timer in the lobby', () => {
    const { room } = withPlayers(['Ana']);
    const t: Action = { type: 'timer', timer: 'drawUp', turnId: 1, epoch: 0 };
    expect(reduce(room, t, T0)).toEqual({ ok: false, error: 'staleTimer' });
  });
});

describe('REVEAL → next drawer → FINAL', () => {
  it('revealDone starts the next drawer’s turn in DRAWING', () => {
    const { room, pids, at } = started();
    const reveal = step(room, timer(room, 'drawUp'), at + DRAW_MS + GRACE_MS).room;
    const now = at + DRAW_MS + GRACE_MS + REVEAL_MS;
    const { room: after, effects } = step(reveal, timer(reveal, 'revealDone'), now);
    expect(after.phase).toBe('DRAWING');
    expect(after.turn).toMatchObject({
      id: 2,
      cycle: 1,
      drawerPid: pids[1],
      clockStart: now,
      correct: [],
    });
    expect(after.timerEpoch).toBe(reveal.timerEpoch + 1);
    expect(effects).toContainEqual({ type: 'inkOpen', turnId: 2, drawerPid: pids[1] });
  });

  it('host:next advances REVEAL at once and is rejected in DRAWING', () => {
    const { room, pids, at } = started();
    expect(reduce(room, { type: 'host:next', by: SCREEN_HOST }, at)).toEqual({
      ok: false,
      error: 'wrongPhase',
    });
    const reveal = step(room, { type: 'host:skip', by: SCREEN_HOST }, at + 1_000).room;
    const { room: after } = step(reveal, { type: 'host:next', by: SCREEN_HOST }, at + 2_000);
    expect(after.turn!.drawerPid).toBe(pids[1]);
  });

  it('plays every player once, then FINAL', () => {
    const { room, pids, at } = started();
    const drawers: string[] = [];
    let r = room;
    let now = at;
    while (r.phase === 'DRAWING') {
      drawers.push(r.turn!.drawerPid);
      now += DRAW_MS + GRACE_MS;
      r = playOut(r, now);
      now += REVEAL_MS;
    }
    expect(drawers).toEqual(pids);
    expect(r.phase).toBe('FINAL');
    expect(r.history.map((h) => h.turnId)).toEqual([1, 2, 3]);
  });

  it('a player who leaves before their turn is dropped from the order', () => {
    const { room, pids, at } = started();
    const r = step(room, { type: 'player:leave', by: asPlayer(pids[1]!) }, at + 1_000).room;
    expect(r.turnOrder).toEqual([pids[0], pids[2]]);
    const next = playOut(r, at + DRAW_MS + GRACE_MS);
    expect(next.turn!.drawerPid).toBe(pids[2]);
  });

  it('after the drawer leaves, the next turn goes to the following player', () => {
    const { room, pids, at } = started();
    const reveal = step(room, { type: 'player:leave', by: asPlayer(pids[0]!) }, at + 1_000).room;
    const { room: after } = step(reveal, timer(reveal, 'revealDone'), at + 1_000 + REVEAL_MS);
    expect(after.turn!.drawerPid).toBe(pids[1]);
  });

  it('skips a disconnected player when their turn comes', () => {
    const { room, pids, at } = started();
    const r = step(room, { type: 'sys:disconnected', pid: pids[1]! }, at + 1_000).room;
    const next = playOut(r, at + DRAW_MS + GRACE_MS);
    expect(next.turn!.drawerPid).toBe(pids[2]);
  });
});
