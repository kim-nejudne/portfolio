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
