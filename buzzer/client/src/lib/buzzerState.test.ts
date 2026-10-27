import { describe, expect, it } from 'vitest';
import { PLAYER_PALETTE } from '../../../shared/constants.js';
import type { PlayerView } from '../../../shared/types.js';
import { buzzerState } from './buzzerState.js';

function view(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    role: 'player',
    code: 'WXYZ',
    phase: 'LOBBY',
    questionIndex: -1,
    questionCount: 10,
    openingCounter: 0,
    me: { id: 'p1', name: 'Ana', color: PLAYER_PALETTE[0], score: 0, rank: 1 },
    playerCount: 3,
    hasBuzzed: false,
    lockedOut: false,
    winnerId: null,
    winnerName: null,
    pointsThisQuestion: 0,
    ...overrides,
  };
}

describe('buzzerState', () => {
  it('waits for the host in the lobby', () => {
    expect(buzzerState(view(), false)).toEqual({
      kind: 'idle',
      label: 'You’re in! Waiting for the host',
      live: false,
    });
  });

  it('says get ready while the question is shown and buzzers are locked', () => {
    expect(buzzerState(view({ phase: 'QUESTION', questionIndex: 0 }), false)).toEqual({
      kind: 'idle',
      label: 'Get ready…',
      live: false,
    });
  });

  it('is live while buzzers are open and this player has not buzzed', () => {
    for (const phase of ['OPEN', 'COLLECTING'] as const) {
      expect(buzzerState(view({ phase, questionIndex: 0 }), false)).toEqual({
        kind: 'live',
        label: 'BUZZ!',
        live: true,
      });
    }
  });

  it('shows the pressed state as soon as the player presses, before the server replies', () => {
    expect(buzzerState(view({ phase: 'OPEN', questionIndex: 0 }), true)).toEqual({
      kind: 'pressed',
      label: 'Buzzed…',
      live: false,
    });
  });

  it('stays pressed once the server has counted the buzz', () => {
    const state = buzzerState(
      view({ phase: 'COLLECTING', questionIndex: 0, hasBuzzed: true }),
      false,
    );
    expect(state).toMatchObject({ kind: 'pressed', label: 'Buzzed…', live: false });
  });

  it('tells the winner to answer', () => {
    const won = view({ phase: 'BUZZED', questionIndex: 0, winnerId: 'p1', winnerName: 'Ana' });
    expect(buzzerState(won, true)).toEqual({
      kind: 'won',
      label: 'You’re first! Answer now',
      live: false,
    });
  });

  it('names the winner to everyone else', () => {
    const lost = view({ phase: 'BUZZED', questionIndex: 0, winnerId: 'p2', winnerName: 'Ben' });
    expect(buzzerState(lost, false)).toEqual({
      kind: 'lost',
      label: 'Ben buzzed first',
      live: false,
    });
  });

  it('is never live for a locked-out player, even with buzzers open', () => {
    expect(
      buzzerState(view({ phase: 'OPEN', questionIndex: 0, lockedOut: true }), false).live,
    ).toBe(false);
  });
});

describe('buzzerState results', () => {
  it('shows "Locked out this round" with buzzers open after a wrong answer', () => {
    for (const phase of ['OPEN', 'COLLECTING'] as const) {
      expect(buzzerState(view({ phase, questionIndex: 0, lockedOut: true }), false)).toEqual({
        kind: 'out',
        label: 'Locked out this round',
        live: false,
      });
    }
  });

  it('a winner judged wrong is locked out during the wait before the reopen', () => {
    const waiting = view({
      phase: 'BUZZED',
      questionIndex: 0,
      winnerId: 'p1',
      winnerName: 'Ana',
      lockedOut: true,
    });
    expect(buzzerState(waiting, true)).toMatchObject({
      kind: 'out',
      label: 'Locked out this round',
    });
  });

  it('a locked-out player stays locked out when someone else wins the next buzz', () => {
    const lost = view({
      phase: 'BUZZED',
      questionIndex: 0,
      winnerId: 'p2',
      winnerName: 'Ben',
      lockedOut: true,
    });
    expect(buzzerState(lost, false).kind).toBe('out');
  });

  it('shows the answer and "+100" at reveal when this player scored', () => {
    const revealed = view({
      phase: 'REVEAL',
      questionIndex: 0,
      answer: 'Paris',
      pointsThisQuestion: 100,
    });
    expect(buzzerState(revealed, false)).toEqual({
      kind: 'revealed',
      label: 'Paris',
      detail: '+100',
      live: false,
    });
  });

  it('shows only the answer at reveal when this player did not score', () => {
    const revealed = view({ phase: 'REVEAL', questionIndex: 0, answer: 'Paris' });
    expect(buzzerState(revealed, false)).toEqual({ kind: 'revealed', label: 'Paris', live: false });
  });

  it('shows a penalty at reveal as "−100"', () => {
    const revealed = view({
      phase: 'REVEAL',
      questionIndex: 0,
      answer: 'Paris',
      pointsThisQuestion: -100,
    });
    expect(buzzerState(revealed, false).detail).toBe('−100');
  });

  it('shows the final rank out of all players and the final score when the game is over', () => {
    const final = view({
      phase: 'FINAL',
      questionIndex: 9,
      me: { id: 'p1', name: 'Ana', color: PLAYER_PALETTE[0], score: 300, rank: 2 },
      playerCount: 5,
    });
    expect(buzzerState(final, false)).toEqual({
      kind: 'final',
      label: '2nd of 5',
      detail: '300 points',
      live: false,
    });
  });
});
