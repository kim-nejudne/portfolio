import { describe, expect, it } from 'vitest';
import {
  ALL_GUESSED_MS,
  CLOSE_GUESSES_MAX,
  FEED_MAX,
  GRACE_MS,
  GUESS_INTERVAL_MS,
  REVEAL_MS,
} from '../shared/constants.js';
import type { Action, Room } from '../shared/types.js';
import { reduce } from './reducer.js';
import { guesserPoints } from './scoring.js';
import {
  SCREEN,
  SCREEN_HOST,
  T0,
  asPlayer,
  choose,
  dealt,
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

/**
 * Ends the current turn by time and moves on: REVEAL, then FINAL or the next turn, whose drawer
 * takes the first choice at once.
 */
function playOut(room: Room, now: number): Room {
  const reveal = step(room, timer(room, 'drawUp'), now).room;
  const next = step(reveal, timer(reveal, 'revealDone'), now + REVEAL_MS).room;
  return next.phase === 'CHOOSING' ? choose(next, now + REVEAL_MS) : next;
}

describe('starting a turn', () => {
  it('draws with the chosen one of the three choices', () => {
    const { room } = started();
    const turn = room.turn!;
    expect(room.phase).toBe('DRAWING');
    expect(turn.word).toEqual(turn.choices[0]);
  });

  it('starts the clock on the choice, ends after drawSeconds and schedules drawUp after the grace window', () => {
    const { room: choosing, at, pids } = dealt();
    const chosenAt = at + 4_000;
    const { room, effects } = step(
      choosing,
      { type: 'drawer:choose', by: asPlayer(pids[0]!), index: 1 },
      chosenAt,
    );
    const turn = room.turn!;
    expect(turn.clockStart).toBe(chosenAt);
    expect(turn.endsAt).toBe(chosenAt + DRAW_MS);
    expect(effects).toContainEqual({
      type: 'schedule',
      at: chosenAt + DRAW_MS + GRACE_MS,
      timer: 'drawUp',
      turnId: turn.id,
      epoch: room.timerEpoch,
    });
    expect(effects).toContainEqual({ type: 'inkOpen', turnId: turn.id, drawerPid: pids[0] });
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
    expect(choose(room, T0 + 2000).turn!.endsAt).toBe(T0 + 2000 + 45_000);
  });
});

describe('player:guess', () => {
  it('accepts the word lowercase-trimmed and scores it on the latency-corrected time', () => {
    const { room, pids, at } = started();
    const ben = pids[1]!;
    const word = secretWord(room);
    const { room: after, effects } = step(
      room,
      guess(ben, `  ${word.toUpperCase()} `, at + 9_000),
      at + 9_000,
    );
    const points = guesserPoints(DRAW_MS, 9_000 - 40);
    expect(points).toBe(270);
    expect(after.turn!.correct).toEqual([
      { pid: ben, receivedAt: at + 9_000, oneWayMs: 40, elapsedMs: 9_000 - 40, points },
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
      // Spaced out so neither guesser hits the 700 ms limit.
      const t = at + i * GUESS_INTERVAL_MS;
      room = step(room, guess(pids[1 + (i % 2)]!, `nope${i}`, t), t).room;
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
      fx: { kind: 'correct', pid: pids[2], points: guesserPoints(DRAW_MS, 2_000 - 40), order: 2 },
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

  it('rejects a guess from the drawer, a repeat correct guesser, and one sent after endsAt', () => {
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
    // Corrected by its 40 ms one-way latency, it was sent 1 ms after endsAt.
    const late = at + DRAW_MS + 41;
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

describe('player:guess matching (match.ts) and limits', () => {
  it('accepts the word normalised: case, punctuation, a leading filler and an English plural', () => {
    for (const text of [(w: string) => `The ${w.toUpperCase()}!`, (w: string) => `${w}s`]) {
      const { room, pids, at } = started();
      const guessed = text(secretWord(room));
      const { room: after } = step(room, guess(pids[1]!, guessed, at + 1_000), at + 1_000);
      expect(
        after.turn!.correct.map((c) => c.pid),
        guessed,
      ).toEqual([pids[1]]);
    }
  });

  it('accepts an alternate of the word', () => {
    const { room, pids, at } = started();
    const withAlt: Room = {
      ...room,
      turn: { ...room.turn!, word: { ...room.turn!.word!, alt: ['payong'] } },
    };
    const { room: after } = step(withAlt, guess(pids[1]!, 'Payong', at + 1_000), at + 1_000);
    expect(after.turn!.correct.map((c) => c.pid)).toEqual([pids[1]]);
  });

  it('answers a close guess with nearMiss to that phone only, keeps it out of the feed, scores nothing', () => {
    const { room, pids, at } = started();
    const ben = pids[1]!;
    const close = `${secretWord(room)} ko`;
    const { room: after, effects } = step(room, guess(ben, close, at + 1_000), at + 1_000);
    expect(effects).toEqual([{ type: 'fx', to: { pid: ben }, fx: { kind: 'nearMiss' } }]);
    expect(after.turn!.feed).toEqual([]);
    expect(after.turn!.correct).toEqual([]);
    expect(after.turn!.closeGuesses).toEqual([{ pid: ben, text: close, at: at + 1_000 }]);
    expect(after.turn!.closeCount).toEqual({ [ben]: 1 });
    expect(after.turn!.guessCount).toEqual({ [ben]: 1 });
    expect(after.players[ben]!.score).toBe(0);
    // Counted as close, not wrong, in the turn's summary.
    const reveal = step(after, timer(after, 'drawUp'), at + DRAW_MS + GRACE_MS).room;
    expect(reveal.history.at(-1)).toMatchObject({ close: { [ben]: 1 }, wrong: {} });
  });

  it(`keeps the last ${CLOSE_GUESSES_MAX} close guesses`, () => {
    let { room } = started();
    const { pids, at } = started();
    const word = secretWord(room);
    for (let i = 0; i < CLOSE_GUESSES_MAX + 1; i++) {
      const t = at + i * GUESS_INTERVAL_MS;
      room = step(room, guess(pids[1]!, `${word} ${i}`, t), t).room;
    }
    expect(room.turn!.closeGuesses.map((g) => g.text)).toEqual(
      Array.from({ length: CLOSE_GUESSES_MAX }, (_, i) => `${word} ${i + 1}`),
    );
    expect(room.turn!.closeCount[pids[1]!]).toBe(CLOSE_GUESSES_MAX + 1);
  });

  it('rejects a guess that is empty after normalisation or too long, without matching or counting it', () => {
    const { room, pids, at } = started();
    for (const [text, error] of [
      ['!!! 🙂', 'emptyGuess'],
      ['the', 'emptyGuess'],
      ['ang mga', 'emptyGuess'],
      ['z'.repeat(41), 'guessTooLong'],
    ] as const) {
      expect(reduce(room, guess(pids[1]!, text, at + 1_000), at + 1_000), text).toEqual({
        ok: false,
        error,
      });
    }
    // Nor does it start the 700 ms window: a real guess right after goes through.
    const { room: after } = step(room, guess(pids[1]!, secretWord(room), at + 1_001), at + 1_001);
    expect(after.turn!.correct).toHaveLength(1);
  });

  it('allows one guess per 700 ms per player: "Slow down" for the next, unmatched and uncounted', () => {
    const { room, pids, at } = started();
    const [, ben, cy] = pids as [string, string, string];
    const word = secretWord(room);
    const first = step(room, guess(ben, 'zzz', at + 1_000), at + 1_000).room;
    const soon = at + 1_000 + GUESS_INTERVAL_MS - 1;
    // Even the right word is refused, and it is neither scored nor fed.
    expect(reduce(first, guess(ben, word, soon), soon)).toEqual({ ok: false, error: 'slowDown' });
    // Another player is not held up.
    expect(step(first, guess(cy, 'yyy', at + 1_001), at + 1_001).room.turn!.feed).toHaveLength(2);
    // At 700 ms the next one counts.
    const next = at + 1_000 + GUESS_INTERVAL_MS;
    const { room: after } = step(first, guess(ben, word, next), next);
    expect(after.turn!.correct.map((c) => c.pid)).toEqual([ben]);
    expect(after.turn!.guessCount[ben]).toBe(2);
  });

  it('times the 700 ms from the last guess that went through, not from refused ones', () => {
    const { room, pids, at } = started();
    const ben = pids[1]!;
    const r = step(room, guess(ben, 'zzz', at + 1_000), at + 1_000).room;
    expect(reduce(r, guess(ben, 'yyy', at + 1_500), at + 1_500)).toEqual({
      ok: false,
      error: 'slowDown',
    });
    const t = at + 1_000 + GUESS_INTERVAL_MS;
    expect(step(r, guess(ben, 'yyy', t), t).room.turn!.lastGuessAt[ben]).toBe(t);
  });

  it('starts every turn with no guess times', () => {
    const { room } = started();
    expect(room.turn!.lastGuessAt).toEqual({});
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
    const room = choose(
      step(joined, { type: 'host:start', by: SCREEN_HOST }, T0 + 1000).room,
      T0 + 1000,
    );
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
  it('revealDone deals the next drawer a choice in CHOOSING', () => {
    const { room, pids, at } = started();
    const reveal = step(room, timer(room, 'drawUp'), at + DRAW_MS + GRACE_MS).room;
    const now = at + DRAW_MS + GRACE_MS + REVEAL_MS;
    const { room: after, effects } = step(reveal, timer(reveal, 'revealDone'), now);
    expect(after.phase).toBe('CHOOSING');
    expect(after.turn).toMatchObject({
      id: 2,
      cycle: 1,
      drawerPid: pids[1],
      dealtAt: now,
      word: null,
      clockStart: null,
      correct: [],
    });
    expect(after.timerEpoch).toBe(reveal.timerEpoch + 1);
    expect(effects).toContainEqual({ type: 'fx', to: { pid: pids[1] }, fx: { kind: 'yourTurn' } });
    expect(effects.some((e) => e.type === 'inkOpen')).toBe(false);
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
