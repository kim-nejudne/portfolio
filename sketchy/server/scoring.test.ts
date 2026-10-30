import { describe, expect, it } from 'vitest';
import { ALL_GUESSED_MS, GRACE_MS, MAX_LATENCY_CORRECTION_MS } from '../shared/constants.js';
import type { Action, Room } from '../shared/types.js';
import { reduce } from './reducer.js';
import { drawerPoints, guesserPoints } from './scoring.js';
import {
  SCREEN_HOST,
  T0,
  asPlayer,
  makeRoom,
  secretWord,
  step,
  withPlayers,
} from './test/rooms.js';
import { toView } from './views.js';

const T = 60_000;

describe('guesserPoints', () => {
  it('gives 300 for a guess at the very start of the turn', () => {
    expect(guesserPoints(T, 0)).toBe(300);
  });

  it('gives 100 for a guess at the buzzer', () => {
    expect(guesserPoints(T, T)).toBe(100);
  });

  it('falls evenly between them, rounded to the nearest 5', () => {
    expect(guesserPoints(T, 30_000)).toBe(200); // 100 + 200 × 0.5
    expect(guesserPoints(T, 9_000)).toBe(270); // 100 + 200 × 0.85
    expect(guesserPoints(T, 1_000)).toBe(295); // 296.67 → 295
    expect(guesserPoints(45_000, 20_000)).toBe(210); // 211.11 → 210
  });

  it('stays within 100 to 300 for times outside the turn', () => {
    expect(guesserPoints(T, -500)).toBe(300);
    expect(guesserPoints(T, T + 250)).toBe(100);
  });
});

describe('drawerPoints', () => {
  it('is half the guessers’ total, rounded to the nearest 5', () => {
    expect(drawerPoints([270, 200])).toBe(235);
    expect(drawerPoints([295])).toBe(150); // 147.5 → 29.5 × 5 → Math.round(29.5) = 30
    expect(drawerPoints([210, 105])).toBe(160); // 157.5 → 31.5 → 32 × 5
  });

  it('is 0 when nobody guessed', () => {
    expect(drawerPoints([])).toBe(0);
  });
});

// ---------- Through the reducer: the spec's worked examples, the cap and the grace window ----------

const T80 = 80_000;

/** Five players, drawSeconds 80: Mika draws; Jun, Ana, Bea and Carlo guess. */
function barkada() {
  const { room: joined, pids } = withPlayers(
    ['Mika', 'Jun', 'Ana', 'Bea', 'Carlo'],
    makeRoom({ settings: { ...makeRoom().settings, drawSeconds: 80 } }),
  );
  const at = T0 + 1000;
  const room = step(joined, { type: 'host:start', by: SCREEN_HOST }, at).room;
  const [mika, jun, ana, bea, carlo] = pids as [string, string, string, string, string];
  expect(room.turn!.drawerPid).toBe(mika);
  return { room, at, mika, jun, ana, bea, carlo, word: secretWord(room) };
}

const guessAt = (pid: string, text: string, receivedAt: number, oneWayMs = 0): Action => ({
  type: 'player:guess',
  by: asPlayer(pid),
  text,
  receivedAt,
  oneWayMs,
});

/** Guesses `text` as `pid`, received at `at + ms` with `oneWayMs` of latency. */
function guessIn(room: Room, at: number, pid: string, text: string, ms: number, oneWayMs = 0) {
  return step(room, guessAt(pid, text, at + ms, oneWayMs), at + ms);
}

const timer = (room: Room, name: 'drawUp' | 'allGuessed'): Action => ({
  type: 'timer',
  timer: name,
  turnId: room.turn!.id,
  epoch: room.timerEpoch,
});

const scores = (room: Room, ...pids: string[]) => pids.map((pid) => room.players[pid]!.score);

describe('worked examples (five players, drawSeconds 80)', () => {
  it('Example 1: a normal turn scores 270, 225, 145, 0 and the drawer 320', () => {
    expect([12_400, 30_000, 61_600].map((t) => guesserPoints(T80, t))).toEqual([270, 225, 145]);
    expect(drawerPoints([270, 225, 145])).toBe(320);

    const { room: r0, at, mika, jun, ana, bea, carlo, word } = barkada();
    let room = guessIn(r0, at, jun, word, 12_400).room;
    room = guessIn(room, at, ana, word, 30_000).room;
    room = guessIn(room, at, bea, word, 61_600).room;
    room = guessIn(room, at, carlo, 'bangka', 70_000).room;
    room = step(room, timer(room, 'drawUp'), at + T80 + GRACE_MS).room;
    expect(room.phase).toBe('REVEAL');
    expect(scores(room, jun, ana, bea, carlo, mika)).toEqual([270, 225, 145, 0, 320]);
  });

  it('Example 2: everyone gets it fast, the turn ends 1.5 s later, the drawer scores 555', () => {
    expect([4_000, 6_200, 9_800, 15_200].map((t) => guesserPoints(T80, t))).toEqual([
      290, 285, 275, 260,
    ]);
    expect(drawerPoints([290, 285, 275, 260])).toBe(555);

    const { room: r0, at, mika, jun, ana, bea, carlo, word } = barkada();
    let room = guessIn(r0, at, jun, word, 4_000).room;
    room = guessIn(room, at, ana, word, 6_200).room;
    room = guessIn(room, at, bea, word, 9_800).room;
    const last = guessIn(room, at, carlo, word, 15_200);
    expect(last.effects).toContainEqual({
      type: 'schedule',
      at: at + 15_200 + ALL_GUESSED_MS,
      timer: 'allGuessed',
      turnId: room.turn!.id,
      epoch: room.timerEpoch,
    });
    room = step(last.room, timer(last.room, 'allGuessed'), at + 15_200 + ALL_GUESSED_MS).room;
    expect(room.phase).toBe('REVEAL');
    expect(scores(room, jun, ana, bea, carlo, mika)).toEqual([290, 285, 275, 260, 555]);
  });

  it('Example 3: nobody gets it, so every guesser and the drawer score 0', () => {
    expect(drawerPoints([])).toBe(0);
    const { room: r0, at, mika, jun, ana, bea, carlo } = barkada();
    let room = guessIn(r0, at, jun, 'bahay', 20_000).room;
    room = step(room, timer(room, 'drawUp'), at + T80 + GRACE_MS).room;
    expect(room.phase).toBe('REVEAL');
    expect(scores(room, jun, ana, bea, carlo, mika)).toEqual([0, 0, 0, 0, 0]);
    expect(room.history.at(-1)!.points).toEqual({});
  });

  it('Example 4: Ana (one-way 120 ms) arrives after Bea (15 ms) but is listed first; both 225', () => {
    const { room: r0, at, ana, bea, word } = barkada();
    const first = guessIn(r0, at, bea, word, 30_100, 15);
    const second = guessIn(first.room, at, ana, word, 30_180, 120);
    const correct = second.room.turn!.correct;
    expect(correct.map((c) => c.pid)).toEqual([ana, bea]);
    expect(correct.map((c) => c.elapsedMs)).toEqual([30_060, 30_085]);
    expect(correct.map((c) => c.points)).toEqual([225, 225]);
    // Every correct guess keeps its raw arrival and latency for inspecting close calls.
    expect(correct[0]).toMatchObject({ receivedAt: at + 30_180, oneWayMs: 120 });
    expect(second.effects).toContainEqual({
      type: 'fx',
      to: 'all',
      fx: { kind: 'correct', pid: ana, points: 225, order: 1 },
    });
    const view = toView(second.room, { kind: 'screen', isHost: false }, at + 30_180);
    expect(view.turn!.correct.map((c) => [c.pid, c.order])).toEqual([
      [ana, 1],
      [bea, 2],
    ]);
  });
});

describe('latency correction in the reducer', () => {
  it(`caps the correction at ${MAX_LATENCY_CORRECTION_MS} ms`, () => {
    const { room, at, jun, word } = barkada();
    const after = guessIn(room, at, jun, word, 10_000, 1_000).room;
    expect(after.turn!.correct[0]).toMatchObject({
      oneWayMs: 1_000,
      elapsedMs: 10_000 - MAX_LATENCY_CORRECTION_MS,
    });
  });

  it('never scores a time before the turn started', () => {
    const { room, at, jun, word } = barkada();
    const after = guessIn(room, at, jun, word, 100, 200).room;
    expect(after.turn!.correct[0]).toMatchObject({ elapsedMs: 0, points: 300 });
  });

  it('keeps arrival order for equal corrected times', () => {
    const { room, at, jun, ana, word } = barkada();
    const r = guessIn(room, at, ana, word, 5_000, 0).room;
    const after = guessIn(r, at, jun, word, 5_100, 100).room;
    expect(after.turn!.correct.map((c) => c.pid)).toEqual([ana, jun]);
  });
});

describe(`the ${GRACE_MS} ms grace window`, () => {
  it('accepts a guess after endsAt whose corrected time is ≤ endsAt, scoring 100', () => {
    const { room, at, jun, ana, word } = barkada();
    const endsAt = room.turn!.endsAt!;
    const late = guessIn(room, at, jun, word, T80 + 200, 250);
    expect(late.room.turn!.correct[0]).toMatchObject({
      pid: jun,
      elapsedMs: T80 - 50,
      points: 100,
    });
    expect(late.room.players[jun]!.score).toBe(100);
    // Exactly at endsAt still counts.
    const edge = guessIn(room, at, ana, word, T80 + 120, 120);
    expect(edge.room.turn!.correct[0]).toMatchObject({ pid: ana, elapsedMs: endsAt - at });
  });

  it('rejects a guess in the window whose corrected time is after endsAt', () => {
    const { room, at, jun, word } = barkada();
    const t = at + T80 + 200;
    expect(reduce(room, guessAt(jun, word, t, 150), t)).toEqual({ ok: false, error: 'tooLate' });
    expect(reduce(room, guessAt(jun, word, at + T80 + 1, 0), t)).toEqual({
      ok: false,
      error: 'tooLate',
    });
  });

  it('applies the cap there too: a claimed 400 ms one-way link only buys 250 ms', () => {
    const { room, at, jun, word } = barkada();
    const t = at + T80 + 260;
    expect(reduce(room, guessAt(jun, word, t, 400), t)).toEqual({ ok: false, error: 'tooLate' });
  });

  it('rejects anything received after endsAt + grace, whatever its latency', () => {
    const { room, at, jun, word } = barkada();
    const t = at + T80 + GRACE_MS + 1;
    expect(reduce(room, guessAt(jun, word, t, 250), t)).toEqual({ ok: false, error: 'tooLate' });
  });

  it('neither feeds nor counts a wrong guess that is too late', () => {
    const { room, at, jun } = barkada();
    const t = at + T80 + 100;
    expect(reduce(room, guessAt(jun, 'bangka', t, 0), t)).toEqual({ ok: false, error: 'tooLate' });
    const inTime = guessIn(room, at, jun, 'bangka', T80 + 100, 100).room;
    expect(inTime.turn!.feed).toHaveLength(1);
    expect(inTime.turn!.guessCount[jun]).toBe(1);
  });
});
