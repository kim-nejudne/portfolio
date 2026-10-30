// F34: reactions through the reducer (spec: Transitions table `player:react`; After a correct guess).
import { describe, expect, it } from 'vitest';
import type { Action, Room } from '../shared/types.js';
import { reduce } from './reducer.js';
import { asPlayer, inPhase, SCREEN, SCREEN_HOST, secretWord, started, step } from './test/rooms.js';

const react = (pid: string, emoji: '😂' | '🔥' = '😂'): Action => ({
  type: 'player:react',
  by: asPlayer(pid),
  emoji,
});

/** Ben gets the word 2 s in; Ana draws, Cy hasn't got it. */
function benGotIt() {
  const { room, pids, at } = started();
  const [ana, ben, cy] = pids as [string, string, string];
  const guessed = step(
    room,
    {
      type: 'player:guess',
      by: asPlayer(ben),
      text: secretWord(room),
      receivedAt: at + 2000,
      oneWayMs: 0,
    },
    at + 2000,
  ).room;
  return { room: guessed, ana, ben, cy, at: at + 3000 };
}

describe('player:react', () => {
  it('sends a correct guesser’s reaction to the Screens only, and changes nothing else', () => {
    const { room, ben, at } = benGotIt();
    const res = step(room, react(ben, '🔥'), at);
    expect(res.effects).toEqual([
      { type: 'fx', to: 'screen', fx: { kind: 'reaction', pid: ben, emoji: '🔥' } },
    ]);
    expect(res.room).toEqual(room);
  });

  it('refuses a guesser who hasn’t got the word yet, and the drawer, during DRAWING', () => {
    const { room, ana, cy, at } = benGotIt();
    expect(reduce(room, react(cy), at)).toEqual({ ok: false, error: 'notGuessed' });
    expect(reduce(room, react(ana), at)).toEqual({ ok: false, error: 'notGuessed' });
  });

  it('lets anyone react at the reveal, the drawer and those who missed included', () => {
    const room = inPhase('REVEAL');
    for (const pid of Object.keys(room.players)) {
      expect(step(room, react(pid), 0).effects).toEqual([
        { type: 'fx', to: 'screen', fx: { kind: 'reaction', pid, emoji: '😂' } },
      ]);
    }
  });

  it('refuses every other phase', () => {
    for (const phase of ['CHOOSING', 'SCOREBOARD', 'FINAL'] as const) {
      const room = inPhase(phase);
      const pid = Object.keys(room.players)[0]!;
      expect(reduce(room, react(pid), 0)).toEqual({ ok: false, error: 'wrongPhase' });
    }
  });

  it('refuses a reaction while paused', () => {
    const { room, ben, at } = benGotIt();
    const paused: Room = step(room, { type: 'host:pause', by: SCREEN_HOST }, at).room;
    expect(reduce(paused, react(ben), at + 100)).toEqual({ ok: false, error: 'paused' });
  });

  it('refuses a Screen and an unknown player', () => {
    const { room, at } = benGotIt();
    expect(reduce(room, { type: 'player:react', by: SCREEN, emoji: '😂' }, at)).toEqual({
      ok: false,
      error: 'notPlayer',
    });
    expect(reduce(room, react('nobody'), at)).toEqual({ ok: false, error: 'unknownPlayer' });
  });
});
