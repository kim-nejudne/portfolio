import { describe, expect, it } from 'vitest';
import type { Buzz, Phase, Room } from '../shared/types.js';
import { T0, makePlayer, makeQuestion, makeRoom, makeSet, withPlayers } from './test/rooms.js';
import { reduce, type Action } from './reducer.js';
import { toView } from './views.js';

const buzz = (playerId: string, at: number): Buzz => ({
  playerId,
  receivedAt: at,
  oneWayMs: 0,
  adjustedAt: at,
});

/** Three players on question 2 of 3, in `phase`; p1 buzzed first and p2 second. */
function midGame(phase: Phase, overrides: Partial<Room> = {}): Room {
  return withPlayers(
    makeRoom({
      phase,
      questionIndex: 1,
      openingCounter: 1,
      buzzes: phase === 'COLLECTING' || phase === 'BUZZED' ? [buzz('p1', 10), buzz('p2', 30)] : [],
      winnerId: phase === 'BUZZED' ? 'p1' : null,
      ...overrides,
    }),
    [
      makePlayer('p1', { name: 'Ana', score: 100, joinedAt: T0 + 1 }),
      makePlayer('p2', { name: 'Bob', score: 300, joinedAt: T0 + 2, rttMs: 40 }),
      makePlayer('p3', { name: 'Cy', score: 100, joinedAt: T0 + 3, connected: false }),
    ],
  );
}

/** Every view a non-host socket could receive for `room`. */
function publicViews(room: Room): string[] {
  return [
    JSON.stringify(toView(room, 'screen')),
    ...Object.keys(room.players).map((id) => JSON.stringify(toView(room, 'player', id))),
  ];
}

const SECRETS = (n: number) => [`Answer-${n}-secret`, `Notes-${n}-secret`];

describe('toView: answers and notes never leak before reveal', () => {
  it('leaves the first question’s answer and notes out of Screen and Player views in LOBBY', () => {
    const room = withPlayers(makeRoom(), [makePlayer('p1'), makePlayer('p2')]);
    for (const json of publicViews(room)) {
      for (const secret of [...SECRETS(1), ...SECRETS(2), ...SECRETS(3)]) {
        expect(json).not.toContain(secret);
      }
    }
  });

  for (const phase of ['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED'] as const) {
    it(`leaves every answer and note out of Screen and Player views in ${phase}`, () => {
      for (const json of publicViews(midGame(phase))) {
        for (const secret of [...SECRETS(1), ...SECRETS(2), ...SECRETS(3)]) {
          expect(json).not.toContain(secret);
        }
      }
    });
  }

  it('shows the current answer after reveal but never notes or the next answer', () => {
    for (const json of publicViews(midGame('REVEAL'))) {
      expect(json).toContain('Answer-2-secret');
      for (const secret of ['Notes-2-secret', ...SECRETS(3)]) {
        expect(json).not.toContain(secret);
      }
    }
  });

  it('leaves the answer out after host:end ends the game on an unrevealed question', () => {
    const room = midGame('FINAL', { buzzes: [buzz('p1', 10)], winnerId: 'p1' });
    for (const json of publicViews(room)) {
      for (const secret of [...SECRETS(1), ...SECRETS(2), ...SECRETS(3)]) {
        expect(json).not.toContain(secret);
      }
    }
  });

  it('never sends the host token hash to any role', () => {
    const room = midGame('BUZZED');
    for (const json of [...publicViews(room), JSON.stringify(toView(room, 'host'))]) {
      expect(json).not.toContain(room.hostTokenHash);
    }
  });
});

describe('toView: screen', () => {
  it('lists players ranked, with shared ranks for equal scores', () => {
    const view = toView(midGame('OPEN'), 'screen');
    expect(view.players.map((p) => [p.name, p.rank])).toEqual([
      ['Bob', 1],
      ['Ana', 2],
      ['Cy', 2],
    ]);
    expect(view.players[2]).toEqual({
      id: 'p3',
      name: 'Cy',
      color: '#EF4444',
      score: 100,
      connected: false,
      rank: 2,
    });
  });

  it('carries the current question without answer or notes', () => {
    const view = toView(midGame('OPEN'), 'screen');
    expect(view.question).toEqual({ id: 'q2', text: 'Question 2 text', points: 100 });
  });

  it('carries the image id of an image question', () => {
    const set = makeSet();
    set.questions[1] = makeQuestion(2, { text: '', imageId: 'img1' });
    expect(toView(midGame('QUESTION', { set }), 'screen').question).toMatchObject({
      text: '',
      imageId: 'img1',
    });
  });

  it('has no question in LOBBY', () => {
    expect(toView(makeRoom(), 'screen').question).toBeNull();
  });

  it("carries the next question's image id for preloading, the first question's in LOBBY", () => {
    const set = makeSet();
    set.questions[0] = makeQuestion(1, { imageId: 'img1' });
    set.questions[2] = makeQuestion(3, { text: '', imageId: 'img3' });
    expect(toView(makeRoom({ set }), 'screen').nextImageId).toBe('img1');
    expect(toView(midGame('REVEAL', { set }), 'screen').nextImageId).toBe('img3');
    expect(toView(midGame('OPEN', { set, questionIndex: 0 }), 'screen').nextImageId).toBeNull();
    expect(toView(midGame('OPEN', { set, questionIndex: 2 }), 'screen').nextImageId).toBeNull();
  });

  it('carries the room state the Screen renders', () => {
    const view = toView(midGame('BUZZED', { lockedOut: ['p3'], showScoreboard: true }), 'screen');
    expect(view).toMatchObject({
      role: 'screen',
      code: 'ABCD',
      title: 'Pub Quiz',
      phase: 'BUZZED',
      questionIndex: 1,
      questionCount: 3,
      openingCounter: 1,
      winnerId: 'p1',
      lockedOut: ['p3'],
      showScoreboard: true,
      settings: {
        wrongPenalty: false,
        autoOpenBuzzers: false,
        scoreboardEvery: 5,
        answerSeconds: 0,
      },
    });
  });

  it('lists the other buzzes in rank order with their gap to the winner', () => {
    const room = midGame('BUZZED', { buzzes: [buzz('p2', 60), buzz('p1', 10), buzz('p3', 30)] });
    expect(toView(room, 'screen').alsoBuzzed).toEqual([
      { playerId: 'p3', gapMs: 20 },
      { playerId: 'p2', gapMs: 50 },
    ]);
  });

  it('keeps the announced winner first even if a late buzz has a lower adjusted time', () => {
    const room = midGame('BUZZED', { winnerId: 'p2', buzzes: [buzz('p1', 10), buzz('p2', 30)] });
    expect(toView(room, 'screen').alsoBuzzed).toEqual([{ playerId: 'p1', gapMs: -20 }]);
  });

  it('has no also-buzzed list before a winner is picked', () => {
    expect(toView(midGame('COLLECTING'), 'screen').alsoBuzzed).toEqual([]);
    expect(toView(midGame('OPEN'), 'host').alsoBuzzed).toEqual([]);
  });
});

describe('toView: host', () => {
  it('carries the current and next question with answers and notes', () => {
    const view = toView(midGame('OPEN'), 'host');
    expect(view.question).toEqual(makeQuestion(2));
    expect(view.nextQuestion).toEqual(makeQuestion(3));
  });

  it('previews the first question as next in LOBBY', () => {
    const view = toView(makeRoom(), 'host');
    expect(view.question).toBeNull();
    expect(view.nextQuestion).toEqual(makeQuestion(1));
  });

  it('has no next question on the last question', () => {
    expect(toView(midGame('OPEN', { questionIndex: 2 }), 'host').nextQuestion).toBeNull();
  });

  it('carries buzzes, judgements and each player’s RTT', () => {
    const judgements = [
      { questionIndex: 0, playerId: 'p2', result: 'correct', pointsDelta: 100 },
    ] as const;
    const view = toView(midGame('BUZZED', { judgements: [...judgements] }), 'host');
    expect(view.buzzes).toEqual([buzz('p1', 10), buzz('p2', 30)]);
    expect(view.judgements).toEqual(judgements);
    expect(view.players.find((p) => p.id === 'p2')).toMatchObject({ rttMs: 40, rank: 1 });
  });

  it('lists players in join order, each still carrying its rank', () => {
    const view = toView(midGame('OPEN'), 'host');
    expect(view.players.map((p) => [p.name, p.rank])).toEqual([
      ['Ana', 2],
      ['Bob', 1],
      ['Cy', 2],
    ]);
  });

  it('keeps join order after score changes, while the Screen re-ranks', () => {
    let room = midGame('OPEN');
    for (const delta of [500, -200]) {
      const result = reduce(room, { type: 'host:adjustScore', playerId: 'p3', delta }, T0 + 10);
      if (!result.ok) throw new Error(result.error);
      room = result.room;
    }
    expect(room.players.p3!.score).toBe(400);
    expect(toView(room, 'host').players.map((p) => [p.id, p.rank])).toEqual([
      ['p1', 3],
      ['p2', 2],
      ['p3', 1],
    ]);
    expect(toView(room, 'screen').players.map((p) => p.id)).toEqual(['p3', 'p2', 'p1']);
    expect(toView(room, 'player', 'p1').me.rank).toBe(3);
  });

  it('breaks a join-time tie by id', () => {
    const room = withPlayers(makeRoom({ phase: 'QUESTION', questionIndex: 0 }), [
      makePlayer('pb', { name: 'B', score: 0, joinedAt: T0 + 1 }),
      makePlayer('pa', { name: 'A', score: 300, joinedAt: T0 + 1 }),
    ]);
    expect(toView(room, 'host').players.map((p) => p.id)).toEqual(['pa', 'pb']);
  });
});

describe('toView: canJudge and canUndo match what the reducer accepts', () => {
  const NOW = T0 + 10_000;
  const JUDGE_WRONG: Action = { type: 'host:judge', result: 'wrong' };
  const after = (room: Room, ...actions: Action[]) =>
    actions.reduce((r, action) => {
      const result = reduce(r, action, NOW);
      if (!result.ok) throw new Error(result.error);
      return result.room;
    }, room);

  /** Rooms across a question: before a buzz, buzzed, judged, waiting, reopened, revealed, moved on. */
  function rooms(): [string, Room][] {
    const buzzed = midGame('BUZZED');
    const wrong = after(buzzed, JUDGE_WRONG);
    const reopened = after(wrong, {
      type: 'reopen',
      questionIndex: wrong.questionIndex,
      openingCounter: wrong.openingCounter,
      at: wrong.reopenAt!,
    });
    const correct = after(buzzed, { type: 'host:judge', result: 'correct' });
    return [
      ['LOBBY', makeRoom()],
      ['QUESTION', midGame('QUESTION')],
      ['OPEN', midGame('OPEN')],
      ['BUZZED, unjudged', buzzed],
      ['BUZZED, waiting for the reopen', wrong],
      ['OPEN after a reopen', reopened],
      ['REVEAL after a correct answer', correct],
      ['REVEAL by host:reveal', after(buzzed, { type: 'host:reveal' })],
      ['the next question', after(correct, { type: 'host:next' })],
      ['FINAL', after(correct, { type: 'host:end' })],
      ['BUZZED after an undo', after(wrong, { type: 'host:undo' })],
    ];
  }

  it.each(rooms())('in %s, for the host and the Screen', (_name, room) => {
    for (const view of [toView(room, 'host'), toView(room, 'screen')]) {
      expect(view.canJudge).toBe(reduce(room, JUDGE_WRONG, NOW).ok);
      expect(view.canUndo).toBe(reduce(room, { type: 'host:undo' }, NOW).ok);
    }
  });

  it('covers both answers of each flag', () => {
    const views = rooms().map(([, room]) => toView(room, 'host'));
    expect(new Set(views.map((v) => v.canJudge))).toEqual(new Set([true, false]));
    expect(new Set(views.map((v) => v.canUndo))).toEqual(new Set([true, false]));
  });
});

describe('toView: scorerId', () => {
  const NOW = T0 + 10_000;
  const after = (room: Room, ...actions: Action[]) =>
    actions.reduce((r, action) => {
      const result = reduce(r, action, NOW);
      if (!result.ok) throw new Error(result.error);
      return result.room;
    }, room);
  const scorer = (room: Room) => [toView(room, 'screen').scorerId, toView(room, 'host').scorerId];

  it('names the player judged correct, at the reveal, for the Screen and the host', () => {
    expect(scorer(after(midGame('BUZZED'), { type: 'host:judge', result: 'correct' }))).toEqual([
      'p1',
      'p1',
    ]);
  });

  it('is null before anyone is judged correct, after a wrong answer, and after a skip', () => {
    const buzzed = midGame('BUZZED');
    expect(scorer(buzzed)).toEqual([null, null]);
    expect(scorer(after(buzzed, { type: 'host:judge', result: 'wrong' }))).toEqual([null, null]);
    expect(scorer(after(buzzed, { type: 'host:reveal' }))).toEqual([null, null]);
  });

  it('names the player who answered after someone else was wrong', () => {
    const wrong = after(midGame('BUZZED'), { type: 'host:judge', result: 'wrong' });
    const second = after(wrong, {
      type: 'reopen',
      questionIndex: 1,
      openingCounter: 1,
      at: wrong.reopenAt!,
    });
    // p2 wins the reopened buzz; the window closes with them alone.
    const room = { ...second, phase: 'BUZZED' as const, buzzes: [buzz('p2', 50)], winnerId: 'p2' };
    expect(scorer(after(room, { type: 'host:judge', result: 'correct' }))).toEqual(['p2', 'p2']);
  });

  it('is null again after the correct judgement is undone, and on the next question', () => {
    const correct = after(midGame('BUZZED'), { type: 'host:judge', result: 'correct' });
    expect(scorer(after(correct, { type: 'host:undo' }))).toEqual([null, null]);
    expect(scorer(after(correct, { type: 'host:next' }))).toEqual([null, null]);
  });

  it('is null when the scorer has been kicked', () => {
    const correct = after(midGame('BUZZED'), { type: 'host:judge', result: 'correct' });
    expect(scorer(after(correct, { type: 'host:kick', playerId: 'p1' }))).toEqual([null, null]);
  });
});

describe('toView: player canBuzz matches what the reducer counts', () => {
  const NOW = T0 + 10_000;
  /** p3 joined during opening 1; the room is on opening 1 unless `overrides` move it on. */
  function late(overrides: Partial<Room> = {}): Room {
    const room = midGame('OPEN', overrides);
    const p3 = makePlayer('p3', { name: 'Cy', joinedAt: T0 + 3, joinedAtOpening: 1 });
    return { ...room, players: { ...room.players, p3 } };
  }

  /** [case, room, player, expected canBuzz]. */
  const cases: [string, Room, string, boolean][] = [
    ['LOBBY', makeRoom({ players: midGame('LOBBY').players }), 'p1', false],
    ['QUESTION', midGame('QUESTION'), 'p1', false],
    ['OPEN', midGame('OPEN'), 'p1', true],
    ['OPEN, locked out', midGame('OPEN', { lockedOut: ['p1'] }), 'p1', false],
    ['COLLECTING, not buzzed yet', midGame('COLLECTING'), 'p3', true],
    ['COLLECTING, already buzzed', midGame('COLLECTING'), 'p2', false],
    ['OPEN, joined this opening', late(), 'p3', false],
    ['COLLECTING, joined this opening', late({ phase: 'COLLECTING' }), 'p3', false],
    ['OPEN, joined during the previous opening', late({ openingCounter: 2 }), 'p3', true],
    ['BUZZED, a late press', midGame('BUZZED'), 'p3', false],
    ['REVEAL', midGame('REVEAL'), 'p1', false],
    ['FINAL', midGame('FINAL'), 'p1', false],
  ];

  it.each(cases)('in %s', (_name, room, playerId, expected) => {
    expect(toView(room, 'player', playerId).canBuzz).toBe(expected);
    // Counts: the buzz joins this opening's window. A late BUZZED press is only recorded.
    const result = reduce(room, { type: 'player:buzz', playerId, receivedAt: 1_000 }, NOW);
    if (!result.ok) throw new Error(result.error);
    const counted =
      (room.phase === 'OPEN' || room.phase === 'COLLECTING') &&
      result.room.buzzes.length > room.buzzes.length;
    expect(counted).toBe(expected);
  });
});

describe('toView: player', () => {
  it('carries the player’s own name, colour, score and rank', () => {
    const view = toView(midGame('OPEN'), 'player', 'p3');
    expect(view.me).toEqual({ id: 'p3', name: 'Cy', color: '#EF4444', score: 100, rank: 2 });
    expect(view.playerCount).toBe(3);
  });

  it("lists every player's id, name, colour and connection in join order in LOBBY", () => {
    // Bob joined first but has the lower id: join order wins, and scores do not reorder it.
    const room = withPlayers(makeRoom(), [
      makePlayer('p1', { name: 'Ana', joinedAt: T0 + 2, score: 300 }),
      makePlayer('p2', { name: 'Bob', joinedAt: T0 + 1, connected: false }),
    ]);
    expect(toView(room, 'player', 'p1').lobby).toEqual([
      { id: 'p2', name: 'Bob', color: room.players.p2!.color, connected: false },
      { id: 'p1', name: 'Ana', color: room.players.p1!.color, connected: true },
    ]);
  });

  it.each(['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED', 'REVEAL', 'FINAL'] as const)(
    'has no lobby list in %s',
    (phase) => {
      expect(toView(midGame(phase), 'player', 'p1').lobby).toBeNull();
    },
  );

  it('names the buzz winner', () => {
    const view = toView(midGame('BUZZED'), 'player', 'p2');
    expect(view).toMatchObject({ winnerId: 'p1', winnerName: 'Ana', hasBuzzed: true });
  });

  it('shows whether the player is locked out', () => {
    const room = midGame('OPEN', { lockedOut: ['p1'] });
    expect(toView(room, 'player', 'p1').lockedOut).toBe(true);
    expect(toView(room, 'player', 'p2').lockedOut).toBe(false);
  });

  it('shows whether the player has buzzed this opening', () => {
    const room = midGame('COLLECTING');
    expect(toView(room, 'player', 'p2').hasBuzzed).toBe(true);
    expect(toView(room, 'player', 'p3').hasBuzzed).toBe(false);
  });

  it('sums the player’s points on the current question only', () => {
    const room = midGame('REVEAL', {
      judgements: [
        { questionIndex: 0, playerId: 'p1', result: 'correct', pointsDelta: 100 },
        { questionIndex: 1, playerId: 'p1', result: 'wrong', pointsDelta: -100 },
        { questionIndex: 1, playerId: 'p2', result: 'correct', pointsDelta: 100 },
      ],
    });
    expect(toView(room, 'player', 'p1').pointsThisQuestion).toBe(-100);
  });

  it('carries no question text', () => {
    expect(JSON.stringify(toView(midGame('OPEN'), 'player', 'p1'))).not.toContain(
      'Question 2 text',
    );
  });

  it('throws for a player who is not in the room', () => {
    expect(() => toView(midGame('OPEN'), 'player', 'nobody')).toThrow();
  });
});

describe('toView: buzzTimer', () => {
  const ENDS_AT = T0 + 876_543;

  it('gives every role the seconds, never endsAt', () => {
    const room = midGame('OPEN', { buzzTimer: { seconds: 20, endsAt: ENDS_AT } });
    const views = [
      toView(room, 'screen'),
      toView(room, 'host'),
      ...Object.keys(room.players).map((id) => toView(room, 'player', id)),
    ];
    for (const view of views) {
      expect(view.buzzTimer).toEqual({ seconds: 20 });
      const json = JSON.stringify(view);
      expect(json).not.toContain('endsAt');
      expect(json).not.toContain(String(ENDS_AT));
    }
  });

  it('is null in every view when no timer runs', () => {
    const room = midGame('OPEN');
    expect(toView(room, 'screen').buzzTimer).toBeNull();
    expect(toView(room, 'host').buzzTimer).toBeNull();
    expect(toView(room, 'player', 'p2').buzzTimer).toBeNull();
  });
});

describe('toView: answerTimer', () => {
  const ENDS_AT = T0 + 987_654;
  const timed = (up: boolean) =>
    midGame('BUZZED', { answerTimer: { seconds: 7, endsAt: ENDS_AT, up } });

  it.each([false, true])('gives every role seconds and up (%s), never endsAt', (up) => {
    const room = timed(up);
    const views = [
      toView(room, 'screen'),
      toView(room, 'host'),
      ...Object.keys(room.players).map((id) => toView(room, 'player', id)),
    ];
    for (const view of views) {
      expect(view.answerTimer).toEqual({ seconds: 7, up });
      const json = JSON.stringify(view);
      expect(json).not.toContain('endsAt');
      expect(json).not.toContain(String(ENDS_AT));
    }
  });

  it('is null in every view when no timer runs', () => {
    const room = midGame('BUZZED');
    expect(toView(room, 'screen').answerTimer).toBeNull();
    expect(toView(room, 'host').answerTimer).toBeNull();
    expect(toView(room, 'player', 'p2').answerTimer).toBeNull();
  });
});
