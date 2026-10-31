// F19: letter hints at 50% and 75% of the drawing time, and the early end when every eligible
// guesser has the word (spec: Scoring and timing, Timing and hints).
import { describe, expect, it } from 'vitest';
import { ALL_GUESSED_MS, HINT_AT } from '../shared/constants.js';
import type { Action, Effect, Room, RoomSettings, WordEntry } from '../shared/types.js';
import { reduce } from './reducer.js';
import { toView } from './views.js';
import {
  NEW_PHONE,
  SCREEN_HOST,
  asPlayer,
  dealt,
  makeRoom,
  step,
  withPlayers,
} from './test/rooms.js';

const DRAW_MS = 60_000;

function entry(word: string): WordEntry {
  return { id: `test/${word}`, word, alt: [], difficulty: 2, lang: 'en' };
}

/**
 * A room in DRAWING with `word`, chosen at `at` (the clock start). The word is put into the
 * deal's middle card, so the deck and RNG stay as the deal left them.
 */
function drawing(
  word: string,
  { names = ['Ana', 'Ben', 'Cy'], settings = {} as Partial<RoomSettings> } = {},
): { room: Room; pids: string[]; at: number; effects: Effect[] } {
  const base = makeRoom();
  const joined = withPlayers(names, makeRoom({ settings: { ...base.settings, ...settings } }));
  const { room: choosing, at } = dealt(names, joined.room);
  const r = structuredClone({ ...choosing, packs: [] });
  r.turn!.choices[1] = entry(word);
  const res = step({ ...r, packs: choosing.packs }, chooseAction(r), at);
  return { room: res.room, pids: joined.pids, at, effects: res.effects };
}

function chooseAction(room: Room): Action {
  return { type: 'drawer:choose', by: asPlayer(room.turn!.drawerPid), index: 1 };
}

const timer = (room: Room, name: 'hint' | 'allGuessed' | 'drawUp'): Action => ({
  type: 'timer',
  timer: name,
  turnId: room.turn!.id,
  epoch: room.timerEpoch,
});

const guess = (pid: string, text: string, at: number): Action => ({
  type: 'player:guess',
  by: asPlayer(pid),
  text,
  receivedAt: at,
  oneWayMs: 0,
});

const hintSchedules = (effects: Effect[]) =>
  effects.filter((e) => e.type === 'schedule' && e.timer === 'hint');

const allGuessedAt = (effects: Effect[]) =>
  effects.flatMap((e) => (e.type === 'schedule' && e.timer === 'allGuessed' ? [e.at] : []));

describe('hint scheduling', () => {
  it('schedules a hint at 50% and 75% of the drawing time', () => {
    const { room, at, effects } = drawing('banana');
    expect(hintSchedules(effects)).toEqual(
      HINT_AT.map((f) => ({
        type: 'schedule',
        at: at + f * DRAW_MS,
        timer: 'hint',
        turnId: room.turn!.id,
        epoch: room.timerEpoch,
      })),
    );
  });

  it('follows drawSeconds', () => {
    const { at, effects } = drawing('banana', { settings: { drawSeconds: 80 } });
    expect(hintSchedules(effects).map((e) => e.type === 'schedule' && e.at)).toEqual([
      at + 40_000,
      at + 60_000,
    ]);
  });

  it('schedules only the 50% hint when the cap is one letter (4 or 5 letters)', () => {
    for (const word of ['tree', 'apple']) {
      const { at, effects } = drawing(word);
      expect(
        hintSchedules(effects).map((e) => e.type === 'schedule' && e.at),
        word,
      ).toEqual([at + DRAW_MS / 2]);
    }
  });

  it('schedules no hints for a word under 4 letters', () => {
    expect(hintSchedules(drawing('cat').effects)).toEqual([]);
    // Spaces aren't letters.
    expect(hintSchedules(drawing('a b c').effects)).toEqual([]);
  });

  it('schedules no hints with hints off', () => {
    expect(hintSchedules(drawing('banana', { settings: { hints: false } }).effects)).toEqual([]);
  });
});

describe('timer hint', () => {
  it('reveals one letter, sends fx hint to all, and every view shows it in the mask', () => {
    const { room, pids, at } = drawing('banana');
    const { room: after, effects } = step(room, timer(room, 'hint'), at + DRAW_MS / 2);
    expect(after.turn!.hintIndexes).toHaveLength(1);
    expect(effects).toEqual([{ type: 'fx', to: 'all', fx: { kind: 'hint' } }]);

    const i = after.turn!.hintIndexes[0]!;
    const screen = toView(after, { kind: 'screen', isHost: false }, at + DRAW_MS / 2);
    expect(screen.turn!.mask![i]).toBe('banana'[i]);
    expect(screen.turn!.mask!.filter((c) => c === '_')).toHaveLength(5);
    // The same hints for the Screen and every phone, drawer included.
    for (const pid of pids) {
      const view = toView(after, { kind: 'player', pid }, at + DRAW_MS / 2);
      expect(view.turn!.mask).toEqual(screen.turn!.mask);
    }
  });

  it('reveals a different letter at 75%', () => {
    const { room, at } = drawing('banana');
    const half = step(room, timer(room, 'hint'), at + DRAW_MS / 2).room;
    const three = step(half, timer(half, 'hint'), at + DRAW_MS * 0.75).room;
    const [a, b] = three.turn!.hintIndexes;
    expect(three.turn!.hintIndexes).toHaveLength(2);
    expect(a).not.toBe(b);
  });

  it('never reveals more than a third of the letters', () => {
    const { room, at } = drawing('tree');
    let r = step(room, timer(room, 'hint'), at + DRAW_MS / 2).room;
    // A hint timer past the cap (it is never scheduled) changes nothing and sends nothing.
    const extra = step(r, timer(r, 'hint'), at + DRAW_MS * 0.75);
    expect(extra.room.turn!.hintIndexes).toEqual(r.turn!.hintIndexes);
    expect(extra.effects).toEqual([]);

    r = drawing('cat').room;
    const none = step(r, timer(r, 'hint'), at + DRAW_MS / 2);
    expect(none.room.turn!.hintIndexes).toEqual([]);
    expect(none.effects).toEqual([]);
  });

  it('caps a multi-word word at a third of its letters, never a space', () => {
    const { room, at } = drawing('bahay kubo');
    let r = room;
    for (let k = 0; k < 4; k++) r = step(r, timer(r, 'hint'), at + 30_000 + k).room;
    expect(r.turn!.hintIndexes).toHaveLength(3);
    expect(r.turn!.hintIndexes).not.toContain(5);
  });

  it('picks the same letters for the same seed and stores the RNG state', () => {
    const a = drawing('umbrella');
    const b = drawing('umbrella');
    const ra = step(a.room, timer(a.room, 'hint'), a.at + 30_000).room;
    const rb = step(b.room, timer(b.room, 'hint'), b.at + 30_000).room;
    expect(ra.turn!.hintIndexes).toEqual(rb.turn!.hintIndexes);
    expect(ra.rngState).not.toBe(a.room.rngState);
  });

  it('is stale once the turn has ended', () => {
    const { room, at } = drawing('banana');
    const hint = timer(room, 'hint');
    const revealed = step(room, timer(room, 'drawUp'), at + DRAW_MS + 1_000).room;
    expect(reduce(revealed, hint, at + DRAW_MS + 2_000)).toEqual({
      ok: false,
      error: 'staleTimer',
    });
  });

  it('never puts the word in the hint fx', () => {
    const { room, at } = drawing('banana');
    const { effects } = step(room, timer(room, 'hint'), at + 30_000);
    expect(JSON.stringify(effects)).not.toMatch(/banana|"[abn]"/);
  });
});

describe('early end (allGuessed)', () => {
  it('ends the turn 1.5 s after the last eligible guesser is correct', () => {
    const { room, pids, at } = drawing('banana');
    const one = step(room, guess(pids[1]!, 'banana', at + 5_000), at + 5_000);
    expect(allGuessedAt(one.effects)).toEqual([]);
    const two = step(one.room, guess(pids[2]!, 'banana', at + 9_000), at + 9_000);
    expect(allGuessedAt(two.effects)).toEqual([at + 9_000 + ALL_GUESSED_MS]);
    const { room: ended, effects } = step(
      two.room,
      timer(two.room, 'allGuessed'),
      at + 9_000 + ALL_GUESSED_MS,
    );
    expect(ended.phase).toBe('REVEAL');
    expect(ended.turn!.endReason).toBe('allGuessed');
    expect(effects).toContainEqual({
      type: 'fx',
      to: 'all',
      fx: { kind: 'turnEnd', reason: 'allGuessed' },
    });
  });

  it('a disconnected guesser does not hold the turn open', () => {
    const { room, pids, at } = drawing('banana');
    const away = step(room, { type: 'sys:disconnected', pid: pids[2]! }, at + 1_000).room;
    const { effects } = step(away, guess(pids[1]!, 'banana', at + 5_000), at + 5_000);
    expect(allGuessedAt(effects)).toEqual([at + 5_000 + ALL_GUESSED_MS]);
  });

  it('the last guesser without the word disconnecting schedules the early end', () => {
    const { room, pids, at } = drawing('banana');
    const r = step(room, guess(pids[1]!, 'banana', at + 5_000), at + 5_000).room;
    const { effects } = step(r, { type: 'sys:disconnected', pid: pids[2]! }, at + 7_000);
    expect(allGuessedAt(effects)).toEqual([at + 7_000 + ALL_GUESSED_MS]);
  });

  it('a disconnect before anyone is correct, or of a correct guesser or the drawer, schedules nothing new', () => {
    const { room, pids, at } = drawing('banana', { names: ['Ana', 'Ben', 'Cy', 'Dee'] });
    const early = step(room, { type: 'sys:disconnected', pid: pids[2]! }, at + 1_000);
    expect(allGuessedAt(early.effects)).toEqual([]);

    const r = step(room, guess(pids[1]!, 'banana', at + 5_000), at + 5_000).room;
    expect(
      allGuessedAt(step(r, { type: 'sys:disconnected', pid: pids[1]! }, at + 6_000).effects),
    ).toEqual([]);
    expect(
      allGuessedAt(step(r, { type: 'sys:disconnected', pid: pids[0]! }, at + 6_000).effects),
    ).toEqual([]);
  });

  it('a join during the 1.5 s window does not cancel it', () => {
    const { room, pids, at } = drawing('banana');
    let r = step(room, guess(pids[1]!, 'banana', at + 5_000), at + 5_000).room;
    r = step(r, guess(pids[2]!, 'banana', at + 6_000), at + 6_000).room;
    const windowTimer = timer(r, 'allGuessed');
    r = step(
      r,
      { type: 'player:join', by: NEW_PHONE, keyHash: 'key-Eve', name: 'Eve', avatar: '🦊' },
      at + 6_500,
    ).room;
    expect(r.phase).toBe('DRAWING');
    const ended = step(r, windowTimer, at + 6_000 + ALL_GUESSED_MS).room;
    expect(ended.phase).toBe('REVEAL');
    expect(ended.turn!.endReason).toBe('allGuessed');
  });

  it('a guesser reconnecting during the window does not cancel it', () => {
    const { room, pids, at } = drawing('banana');
    let r = step(room, { type: 'sys:disconnected', pid: pids[2]! }, at + 1_000).room;
    r = step(r, guess(pids[1]!, 'banana', at + 5_000), at + 5_000).room;
    const windowTimer = timer(r, 'allGuessed');
    r = step(r, { type: 'sys:connected', pid: pids[2]! }, at + 6_000).room;
    expect(step(r, windowTimer, at + 5_000 + ALL_GUESSED_MS).room.turn!.endReason).toBe(
      'allGuessed',
    );
  });

  it('a hint during the window is harmless and the turn still ends', () => {
    const { room, pids, at } = drawing('banana');
    let r = step(room, guess(pids[1]!, 'banana', at + 29_000), at + 29_000).room;
    r = step(r, guess(pids[2]!, 'banana', at + 29_500), at + 29_500).room;
    const windowTimer = timer(r, 'allGuessed');
    r = step(r, timer(r, 'hint'), at + 30_000).room;
    expect(step(r, windowTimer, at + 31_000).room.phase).toBe('REVEAL');
  });

  it('ends early when the only guessers left without the word, and the one with it, all disconnect', () => {
    const { room, pids, at } = drawing('banana');
    let r = step(room, guess(pids[1]!, 'banana', at + 5_000), at + 5_000).room;
    r = step(r, { type: 'sys:disconnected', pid: pids[1]! }, at + 6_000).room;
    const { effects } = step(r, { type: 'sys:disconnected', pid: pids[2]! }, at + 7_000);
    expect(allGuessedAt(effects)).toEqual([at + 7_000 + ALL_GUESSED_MS]);
  });

  it('a pause holds the early end: allGuessed is refused while paused', () => {
    const { room, pids, at } = drawing('banana');
    let r = step(room, guess(pids[1]!, 'banana', at + 5_000), at + 5_000).room;
    r = step(r, { type: 'sys:disconnected', pid: pids[2]! }, at + 6_000).room;
    const paused = step(r, { type: 'host:pause', by: SCREEN_HOST }, at + 6_500).room;
    expect(reduce(paused, timer(paused, 'allGuessed'), at + 7_500)).toEqual({
      ok: false,
      error: 'paused',
    });
    expect(reduce(paused, timer(paused, 'hint'), at + 30_000)).toEqual({
      ok: false,
      error: 'paused',
    });
  });

  it('works with two players: the one guesser gets it', () => {
    const { room, pids, at } = drawing('banana', { names: ['Ana', 'Ben'] });
    const { effects } = step(room, guess(pids[1]!, 'banana', at + 3_000), at + 3_000);
    expect(allGuessedAt(effects)).toEqual([at + 3_000 + ALL_GUESSED_MS]);
  });
});
