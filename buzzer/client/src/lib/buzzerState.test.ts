import { describe, expect, it } from 'vitest';
import { PLAYER_PALETTE } from '../../../shared/constants.js';
import type { PlayerView } from '../../../shared/types.js';
import { buzzerState } from './buzzerState.js';

function view(overrides: Partial<PlayerView> = {}): PlayerView {
  const base: Omit<PlayerView, 'canBuzz'> = {
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
    answerTimer: null,
    // As the server sets it: the list in LOBBY only.
    lobby:
      (overrides.phase ?? 'LOBBY') === 'LOBBY'
        ? [{ id: 'p1', name: 'Ana', color: PLAYER_PALETTE[0], connected: true }]
        : null,
    ...overrides,
  };
  // As the server sets it, unless a test says otherwise.
  return { canBuzz: canBuzzFor(base), ...base };
}

function canBuzzFor({ phase, lockedOut, hasBuzzed }: Omit<PlayerView, 'canBuzz'>): boolean {
  return (phase === 'OPEN' || phase === 'COLLECTING') && !lockedOut && !hasBuzzed;
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
        label: 'Buzzers open!',
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

  describe('with an answer time set', () => {
    const timer = { seconds: 5, up: false };
    const won = view({ phase: 'BUZZED', questionIndex: 0, winnerId: 'p1', answerTimer: timer });
    const lost = view({ phase: 'BUZZED', questionIndex: 0, winnerId: 'p2', winnerName: 'Ben' });

    it('tells the winner to answer, with the seconds left', () => {
      expect(buzzerState(won, true, { secondsLeft: 4, up: false })).toEqual({
        kind: 'won',
        label: 'You’re first! Answer now',
        secondsLeft: 4,
        live: false,
      });
    });

    it('tells the winner the time is up once the server says so', () => {
      expect(buzzerState(won, true, { secondsLeft: 0, up: true })).toEqual({
        kind: 'won',
        label: 'Time’s up!',
        live: false,
      });
    });

    it('leaves everyone else’s phone unchanged', () => {
      for (const countdown of [
        { secondsLeft: 3, up: false },
        { secondsLeft: 0, up: true },
      ]) {
        expect(buzzerState({ ...lost, answerTimer: timer }, false, countdown)).toEqual(
          buzzerState(lost, false),
        );
      }
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

  it('greys out a player who joined during this opening, in OPEN and in COLLECTING', () => {
    for (const phase of ['OPEN', 'COLLECTING'] as const) {
      expect(buzzerState(view({ phase, questionIndex: 0, canBuzz: false }), false)).toEqual({
        kind: 'idle',
        label: 'Get ready… you can buzz from the next question',
        live: false,
      });
    }
  });

  it('is live again for the late joiner once the next opening lets them buzz', () => {
    expect(buzzerState(view({ phase: 'OPEN', questionIndex: 1, canBuzz: true }), false).live).toBe(
      true,
    );
  });

  it('keeps the locked-out and pressed looks ahead of the late-joiner label', () => {
    const out = view({ phase: 'OPEN', questionIndex: 0, lockedOut: true, canBuzz: false });
    const buzzed = view({ phase: 'COLLECTING', questionIndex: 0, hasBuzzed: true, canBuzz: false });
    expect(buzzerState(out, false).kind).toBe('out');
    expect(buzzerState(buzzed, false).kind).toBe('pressed');
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
