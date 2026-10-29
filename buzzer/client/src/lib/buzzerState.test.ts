import { describe, expect, it } from 'vitest';
import { PLAYER_PALETTE } from '../../../shared/constants.js';
import type { PlayerChoiceView, PlayerTypedView, PlayerView } from '../../../shared/types.js';
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
    falseStart: false,
    falseStartMs: 0,
    winnerId: null,
    winnerName: null,
    pointsThisQuestion: 0,
    answerTimer: null,
    buzzTimer: null,
    tonight: null,
    results: null,
    teams: null,
    choice: null,
    typed: null,
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

function choice(overrides: Partial<PlayerChoiceView> = {}): PlayerChoiceView {
  return {
    choices: ['Paris', 'Rome'],
    answered: 0,
    expected: 3,
    timer: { seconds: 10 },
    mine: null,
    ...overrides,
  };
}

function typed(overrides: Partial<PlayerTypedView> = {}): PlayerTypedView {
  return {
    answered: 0,
    expected: 3,
    timer: { seconds: 10 },
    closed: false,
    mine: null,
    ...overrides,
  };
}

function canBuzzFor({ phase, lockedOut, hasBuzzed }: Omit<PlayerView, 'canBuzz'>): boolean {
  return (phase === 'OPEN' || phase === 'COLLECTING') && !lockedOut && !hasBuzzed;
}

describe('buzzerState', () => {
  it('offers a test buzz in the lobby: a practice press, not a buzz', () => {
    expect(buzzerState(view(), false)).toEqual({
      kind: 'practice',
      label: 'Tap to test your buzzer',
      live: false,
    });
  });

  it('stays a test buzz in the lobby after a local press', () => {
    expect(buzzerState(view(), true).kind).toBe('practice');
  });

  it('waits on the category board with a grey "Get ready…" that sends nothing (F89)', () => {
    const board = view({ phase: 'BOARD', falseStartMs: 1000 });
    for (const pressed of [false, true]) {
      expect(buzzerState(board, pressed)).toEqual({
        kind: 'idle',
        label: 'Get ready…',
        live: false,
      });
    }
  });

  it('asks for a pick while a choice question takes answers, with no buzzer', () => {
    const answering = view({ phase: 'ANSWERING', questionIndex: 0, choice: choice() });
    expect(buzzerState(answering, true)).toEqual({
      kind: 'choice',
      label: 'Pick your answer',
      live: false,
    });
  });

  it('says "Answer sent" once this player picked, from the server or a local tap', () => {
    const sent = view({ phase: 'ANSWERING', questionIndex: 0, choice: choice({ mine: 1 }) });
    expect(buzzerState(sent, false).label).toBe('Answer sent');
    const tapped = view({ phase: 'ANSWERING', questionIndex: 0, choice: choice() });
    expect(buzzerState(tapped, false, null, false, 0).label).toBe('Answer sent');
  });

  it('a typed question shows no buzzer, so no false start before it opens (F87)', () => {
    const shown = view({ phase: 'QUESTION', questionIndex: 0, falseStartMs: 500, typed: typed() });
    expect(buzzerState(shown, true)).toEqual({ kind: 'idle', label: 'Get ready…', live: false });
  });

  it('asks for a typed answer while the answers are open (F88)', () => {
    const answering = view({ phase: 'ANSWERING', questionIndex: 0, typed: typed() });
    expect(buzzerState(answering, true)).toEqual({
      kind: 'typed',
      label: 'Type your answer',
      live: false,
    });
  });

  it('says "Answer sent" once the server has this player\'s typed answer, open or closed (F88)', () => {
    const open = view({ phase: 'ANSWERING', questionIndex: 0, typed: typed({ mine: 'Paris' }) });
    expect(buzzerState(open, false).label).toBe('Answer sent');
    const closed = view({
      phase: 'ANSWERING',
      questionIndex: 0,
      typed: typed({ mine: 'Paris', closed: true, timer: null }),
    });
    expect(buzzerState(closed, false)).toEqual({
      kind: 'typed',
      label: 'Answer sent',
      live: false,
    });
  });

  it('says "Answers closed" to a player who sent nothing before the lock (F88)', () => {
    const closed = view({
      phase: 'ANSWERING',
      questionIndex: 0,
      typed: typed({ closed: true, timer: null }),
    });
    expect(buzzerState(closed, false).label).toBe('Answers closed');
  });

  it('says "Correct!" with the points when this player\'s typed group was marked right (F88)', () => {
    const revealed = view({
      phase: 'REVEAL',
      questionIndex: 0,
      answer: 'Paris',
      pointsThisQuestion: 100,
      typed: typed({
        timer: null,
        closed: true,
        mine: 'paris ',
        groups: [
          { key: 'paris', text: 'Paris', playerIds: ['p2', 'p1'], correct: true },
          { key: 'rome', text: 'Rome', playerIds: ['p3'], correct: false },
        ],
      }),
    });
    expect(buzzerState(revealed, false)).toEqual({
      kind: 'revealed',
      caption: 'Your answer',
      label: 'Correct!',
      detail: '+100',
      live: false,
    });
  });

  it("shows the right answer when this player's typed group was not marked right (F88)", () => {
    const revealed = view({
      phase: 'REVEAL',
      questionIndex: 0,
      answer: 'Paris',
      typed: typed({
        timer: null,
        closed: true,
        mine: 'Rome',
        groups: [
          { key: 'paris', text: 'Paris', playerIds: ['p2'], correct: true },
          { key: 'rome', text: 'Rome', playerIds: ['p1'], correct: false },
        ],
      }),
    });
    expect(buzzerState(revealed, false)).toEqual({ kind: 'revealed', label: 'Paris', live: false });
  });

  it('never shows "Too early!" before a choice question opens, even with false starts on', () => {
    const shown = view({
      phase: 'QUESTION',
      questionIndex: 0,
      falseStartMs: 500,
      choice: choice({ timer: null }),
    });
    expect(buzzerState(shown, true)).toEqual({ kind: 'idle', label: 'Get ready…', live: false });
  });

  it('says "Correct!" with the points at the reveal of a choice this player got right', () => {
    const revealed = view({
      phase: 'REVEAL',
      questionIndex: 0,
      answer: 'Rome',
      pointsThisQuestion: 100,
      choice: choice({ timer: null, mine: 1, correctChoice: 1, counts: [1, 2] }),
    });
    expect(buzzerState(revealed, false)).toEqual({
      kind: 'revealed',
      caption: 'Your answer',
      label: 'Correct!',
      detail: '+100',
      live: false,
    });
  });

  it('shows the right answer at the reveal of a choice this player missed or got wrong', () => {
    const wrong = view({
      phase: 'REVEAL',
      questionIndex: 0,
      answer: 'Rome',
      pointsThisQuestion: -100,
      choice: choice({ timer: null, mine: 0, correctChoice: 1, counts: [1, 2] }),
    });
    expect(buzzerState(wrong, false)).toEqual({
      kind: 'revealed',
      label: 'Rome',
      detail: '−100',
      live: false,
    });
    const none = view({
      phase: 'REVEAL',
      questionIndex: 0,
      answer: 'Rome',
      choice: choice({ timer: null, correctChoice: 1, counts: [1, 2] }),
    });
    expect(buzzerState(none, false)).toEqual({ kind: 'revealed', label: 'Rome', live: false });
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

describe('buzzerState false start', () => {
  const question = (overrides: Partial<PlayerView> = {}) =>
    view({ phase: 'QUESTION', questionIndex: 0, falseStartMs: 500, ...overrides });

  it('takes a press in QUESTION with the setting on, still grey and saying get ready', () => {
    expect(buzzerState(question(), false)).toEqual({
      kind: 'idle',
      label: 'Get ready…',
      live: true,
    });
  });

  it('takes no press in QUESTION with the setting off', () => {
    expect(buzzerState(question({ falseStartMs: 0 }), false).live).toBe(false);
  });

  it('shows "Too early!" as soon as the player presses early, before the server replies', () => {
    expect(buzzerState(question(), true)).toEqual({
      kind: 'early',
      label: 'Too early!',
      live: false,
    });
  });

  it('shows "Too early!" for a false start the server recorded', () => {
    expect(buzzerState(question({ falseStart: true }), false).kind).toBe('early');
  });

  it('stays "Too early!" and sends nothing after the opening until the wait ends', () => {
    for (const phase of ['OPEN', 'COLLECTING'] as const) {
      const open = view({ phase, questionIndex: 0, falseStartMs: 500, falseStart: true });
      expect(buzzerState(open, false, null, true)).toEqual({
        kind: 'early',
        label: 'Too early!',
        live: false,
      });
      expect(buzzerState(open, false, null, false)).toMatchObject({ kind: 'live', live: true });
    }
  });

  it('never holds a player who did not press early', () => {
    const open = view({ phase: 'OPEN', questionIndex: 0, falseStartMs: 500 });
    expect(buzzerState(open, false, null, true).kind).toBe('live');
  });

  it('shows the winner to a false starter still waiting', () => {
    const lost = view({
      phase: 'BUZZED',
      questionIndex: 0,
      falseStartMs: 500,
      falseStart: true,
      winnerId: 'p2',
      winnerName: 'Ben',
    });
    expect(buzzerState(lost, false, null, true).kind).toBe('lost');
  });
});
