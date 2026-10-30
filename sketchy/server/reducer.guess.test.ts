// F15: near misses and the guess feed through the reducer and the views (spec: Guess matching,
// Guess feed and rude guesses; Data model, Role views).
import { describe, expect, it } from 'vitest';
import { GUESS_FEED_CHOICES, GUESS_INTERVAL_MS } from '../shared/constants.js';
import type { Action, Effect, Room, RoomSettings } from '../shared/types.js';
import { toView } from './views.js';
import { asPlayer, secretWord, started, step } from './test/rooms.js';

type Mode = RoomSettings['guessFeed'];

const guess = (pid: string, text: string, at: number): Action => ({
  type: 'player:guess',
  by: asPlayer(pid),
  text,
  receivedAt: at,
  oneWayMs: 0,
});

const drawUp = (room: Room): Action => ({
  type: 'timer',
  timer: 'drawUp',
  turnId: room.turn!.id,
  epoch: room.timerEpoch,
});

function withFeed(room: Room, mode: Mode): Room {
  return { ...room, settings: { ...room.settings, guessFeed: mode } };
}

/** Plays guesses in order, a limit apart, collecting every effect. */
function play(room: Room, start: number, moves: [pid: string, text: string][]) {
  const effects: Effect[] = [];
  moves.forEach(([pid, text], i) => {
    const at = start + (i + 1) * GUESS_INTERVAL_MS;
    const res = step(room, guess(pid, text, at), at);
    room = res.room;
    effects.push(...res.effects);
  });
  return { room, effects };
}

const screenFx = (effects: Effect[]) =>
  effects.filter((e) => e.type === 'fx' && e.to === 'screen').map((e) => e.type === 'fx' && e.fx);

describe('close guesses', () => {
  it('sends nearMiss to the guesser only and keeps the guess out of the feed and every view', () => {
    const { room: r0, pids, at } = started();
    const [drawer, ben, cy] = pids as [string, string, string];
    const close = `${secretWord(r0)} ko`;
    const { room, effects } = play(r0, at, [[ben, close]]);

    expect(effects.filter((e) => e.type === 'fx')).toEqual([
      { type: 'fx', to: { pid: ben }, fx: { kind: 'nearMiss' } },
    ]);
    expect(room.turn!.feed).toEqual([]);
    expect(room.turn!.closeGuesses.map((g) => g.text)).toEqual([close]);
    const now = at + 5_000;
    for (const view of [
      toView(room, { kind: 'screen', isHost: true }, now),
      toView(room, { kind: 'player', pid: drawer }, now),
      toView(room, { kind: 'player', pid: ben }, now),
      toView(room, { kind: 'player', pid: cy }, now),
    ]) {
      expect(JSON.stringify(view)).not.toContain(close);
    }
  });

  it('shows close guesses at the reveal, masked per guessFeed', () => {
    const { room: r0, pids, at } = started();
    const word = secretWord(r0);
    const { room } = play(withFeed(r0, 'clean'), at, [
      [pids[1]!, `${word} gago`],
      [pids[2]!, `${word} ko`],
    ]);
    const reveal = step(room, drawUp(room), room.turn!.endsAt! + 300).room;
    const view = toView(reveal, { kind: 'screen', isHost: false }, reveal.turn!.endsAt! + 400);
    expect(view.almost).toEqual([
      { pid: pids[1], text: null },
      { pid: pids[2], text: `${word} ko` },
    ]);
  });
});

describe('the feed under each guessFeed mode', () => {
  const rude = 'putangina';
  const slur = 'faggot';
  const plain = 'payong';

  /** What a Screen sees of a turn with these three wrong guesses, and the Screen fx sent. */
  function fed(mode: Mode) {
    const { room: r0, pids, at } = started();
    const [, ben, cy] = pids as [string, string, string];
    const { room, effects } = play(withFeed(r0, mode), at, [
      [ben, plain],
      [cy, rude],
      [ben, slur],
    ]);
    const screen = toView(room, { kind: 'screen', isHost: false }, at + 5_000);
    const drawer = toView(room, { kind: 'player', pid: pids[0]! }, at + 5_000);
    return { room, screen, drawer, fx: screenFx(effects), ben, cy };
  }

  it("'all' shows rude guesses as typed and masks only slurs", () => {
    const { screen, fx, ben, cy } = fed('all');
    expect(screen.feed).toEqual([
      { pid: ben, text: plain },
      { pid: cy, text: rude },
      { pid: ben, text: null },
    ]);
    expect(fx).toEqual([
      { kind: 'wrongGuess', pid: ben, text: plain },
      { kind: 'wrongGuess', pid: cy, text: rude },
      { kind: 'wrongGuess', pid: ben, text: null },
    ]);
  });

  it("'clean' also masks profanity", () => {
    const { screen, fx, ben, cy } = fed('clean');
    expect(screen.feed).toEqual([
      { pid: ben, text: plain },
      { pid: cy, text: null },
      { pid: ben, text: null },
    ]);
    expect(fx.map((f) => f && 'text' in f && f.text)).toEqual([plain, null, null]);
  });

  it("'off' hides the feed and sends the Screen's wrong-guess fx without text", () => {
    const { screen, fx, ben, cy } = fed('off');
    expect(screen.feed).toEqual([]);
    expect(fx).toEqual([
      { kind: 'wrongGuess', pid: ben, text: null },
      { kind: 'wrongGuess', pid: cy, text: null },
      { kind: 'wrongGuess', pid: ben, text: null },
    ]);
  });

  it.each(GUESS_FEED_CHOICES)(
    "never leaves a masked guess as typed in any view under '%s'",
    (mode) => {
      const { room } = fed(mode);
      const pids = Object.keys(room.players);
      for (const pid of pids) {
        const json = JSON.stringify(toView(room, { kind: 'player', pid }, 0));
        expect(json).not.toContain(slur);
      }
      expect(JSON.stringify(toView(room, { kind: 'screen', isHost: true }, 0))).not.toContain(slur);
    },
  );

  it('masks the drawer’s latest guess the same way, as under clean when the feed is off', () => {
    expect(fed('all').drawer.lastGuess).toEqual({ pid: expect.any(String), text: null });
    const { room: r0, pids, at } = started();
    for (const mode of GUESS_FEED_CHOICES) {
      const { room } = play(withFeed(r0, mode), at, [[pids[1]!, rude]]);
      const view = toView(room, { kind: 'player', pid: pids[0]! }, at + 5_000);
      expect(view.lastGuess).toEqual({ pid: pids[1], text: mode === 'all' ? rude : null });
    }
  });

  it('masks what is already in the feed when the setting changes mid-turn', () => {
    const { room, cy } = fed('all');
    const view = toView(withFeed(room, 'clean'), { kind: 'screen', isHost: false }, 0);
    expect(view.feed.find((g) => g.pid === cy)).toEqual({ pid: cy, text: null });
    // Stored as typed, so switching back shows it again.
    expect(toView(room, { kind: 'screen', isHost: false }, 0).feed[1]).toEqual({
      pid: cy,
      text: rude,
    });
  });

  it('never feeds a correct guess', () => {
    const { room: r0, pids, at } = started();
    const { room, effects } = play(r0, at, [[pids[1]!, secretWord(r0)]]);
    expect(room.turn!.feed).toEqual([]);
    expect(screenFx(effects).some((f) => f && f.kind === 'wrongGuess')).toBe(false);
    expect(toView(room, { kind: 'screen', isHost: false }, at + 5_000).feed).toEqual([]);
  });
});
