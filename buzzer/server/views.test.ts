import { describe, expect, it } from 'vitest';
import type { Buzz, Phase, Room } from '../shared/types.js';
import {
  T0,
  makeBoardSet,
  makePlayer,
  makeQuestion,
  makeRoom,
  makeSet,
  withPlayers,
} from './test/rooms.js';
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

/** `midGame`, with avatars for Ana and Bob; Cy picked none. */
function withAvatars(phase: Phase): Room {
  const room = midGame(phase);
  return withPlayers(room, [
    { ...room.players.p1!, avatar: '🦊' },
    { ...room.players.p2!, avatar: '🐼' },
    room.players.p3!,
  ]);
}

const SECRETS = (n: number) => [`Answer-${n}-secret`, `Notes-${n}-secret`];

/** `midGame`'s players on a 2 × 3 board (q1–q6), started: in BOARD with no tile played. */
function boardGame(): Room {
  return run(midGame('LOBBY', { set: makeBoardSet(2), questionIndex: -1 }), { type: 'host:start' });
}

/** `midGame`'s question 2 as a choice question: B ("Lyon") is correct. */
function choiceGame(phase: Phase, overrides: Partial<Room> = {}): Room {
  const set = makeSet();
  set.questions[1] = makeQuestion(2, {
    mode: 'choice',
    choices: ['Paris', 'Lyon', 'Nice', 'Metz'],
    correctChoice: 1,
    answer: 'Lyon',
  });
  return midGame(phase, { set, ...overrides });
}

/** The choice question answering since `T0 + 10_000`, Ana on A (wrong); Bob yet to answer. */
function answering(): Room {
  const steps: Action[] = [
    { type: 'host:open' },
    { type: 'player:answer', playerId: 'p1', choice: 0 },
  ];
  return steps.reduce((room, action) => {
    const result = reduce(room, action, T0 + 10_000);
    if (!result.ok) throw new Error(result.error);
    return result.room;
  }, choiceGame('QUESTION'));
}

/** `answering`, then Bob picks B (correct), which closes it: REVEAL. */
function choiceRevealed(): Room {
  const result = reduce(
    answering(),
    { type: 'player:answer', playerId: 'p2', choice: 1 },
    T0 + 11_000,
  );
  if (!result.ok) throw new Error(result.error);
  return result.room;
}

/** `midGame`'s question 2 as a typed question: "Answer-2-secret", or the notes' alternative. */
function typedGame(phase: Phase, overrides: Partial<Room> = {}): Room {
  const set = makeSet();
  set.questions[1] = makeQuestion(2, { mode: 'typed', hostNotes: 'Alt-2-secret' });
  return midGame(phase, { set, ...overrides });
}

function run(room: Room, ...actions: Action[]): Room {
  return actions.reduce((r, action) => {
    const result = reduce(r, action, T0 + 10_000);
    if (!result.ok) throw new Error(result.error);
    return result.room;
  }, room);
}

const typedAnswer = (playerId: string, text: string): Action => ({
  type: 'player:answer',
  playerId,
  text,
});

/** The typed question answering, Ana on "Ana-typed-guess"; Bob yet to answer. */
function typedAnswering(): Room {
  return run(typedGame('QUESTION'), { type: 'host:open' }, typedAnswer('p1', 'Ana-typed-guess'));
}

/** `typedAnswering`, then Bob types the alternative, which locks the answers (still ANSWERING). */
function typedClosed(): Room {
  return run(typedAnswering(), typedAnswer('p2', 'alt-2-SECRET'));
}

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

  it("carries each player's avatar, and no avatar key for a player without one", () => {
    const view = toView(withAvatars('OPEN'), 'screen');
    expect(view.players.map((p) => [p.name, p.avatar])).toEqual([
      ['Bob', '🐼'],
      ['Ana', '🦊'],
      ['Cy', undefined],
    ]);
    expect(view.players[2]).not.toHaveProperty('avatar');
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

  it('carries the set’s category and difficulty for the title card, null when unset', () => {
    const set = { ...makeSet(), category: 'Science', difficulty: 'hard' as const };
    expect(toView(midGame('QUESTION', { set }), 'screen')).toMatchObject({
      category: 'Science',
      difficulty: 'hard',
    });
    expect(toView(midGame('QUESTION'), 'screen')).toMatchObject({
      category: null,
      difficulty: null,
    });
  });

  it('carries hostDevices, the count of connected host remotes', () => {
    expect(toView(makeRoom(), 'screen').hostDevices).toBe(0);
    expect(toView(makeRoom({ hostDevices: 2 }), 'screen').hostDevices).toBe(2);
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

  it("carries each player's avatar, and no avatar key for a player without one", () => {
    const view = toView(withAvatars('LOBBY'), 'host');
    expect(view.players.map((p) => [p.name, p.avatar])).toEqual([
      ['Ana', '🦊'],
      ['Bob', '🐼'],
      ['Cy', undefined],
    ]);
    expect(view.players[2]).not.toHaveProperty('avatar');
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

describe('toView: canJudge, canUndo and canChangeTeams match what the reducer accepts', () => {
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
    // Bob buzzes the reopened question and is judged correct: two judgements on the stack.
    const twice = after(
      reopened,
      { type: 'player:buzz', playerId: 'p2', receivedAt: 5000 },
      { type: 'windowClosed', questionIndex: 1, openingCounter: reopened.openingCounter },
      { type: 'host:judge', result: 'correct' },
    );
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
      ['BUZZED after one undo of two judgements', after(twice, { type: 'host:undo' })],
      ['BUZZED after both undos', after(twice, { type: 'host:undo' }, { type: 'host:undo' })],
      ['ANSWERING a choice question', answering()],
      ['REVEAL after a choice question', choiceRevealed()],
      ['ANSWERING a typed question', typedAnswering()],
      ['ANSWERING a typed question, closed', typedClosed()],
      ['REVEAL after a typed question', run(typedClosed(), { type: 'host:reveal' })],
      ['BOARD', boardGame()],
    ];
  }

  it.each(rooms())('in %s, for the host and the Screen', (_name, room) => {
    for (const view of [toView(room, 'host'), toView(room, 'screen')]) {
      expect(view.canJudge).toBe(reduce(room, JUDGE_WRONG, NOW).ok);
      expect(view.canUndo).toBe(reduce(room, { type: 'host:undo' }, NOW).ok);
      expect(view.canChangeTeams).toBe(
        reduce(room, { type: 'host:settings', settings: { teams: 2 } }, NOW).ok,
      );
    }
  });

  it('keeps canUndo on after the first of two undos and off after the second', () => {
    const byName = Object.fromEntries(rooms());
    const flag = (name: string) => toView(byName[name] as Room, 'host').canUndo;
    expect(flag('BUZZED after one undo of two judgements')).toBe(true);
    expect(flag('BUZZED after both undos')).toBe(false);
  });

  it('covers both answers of each flag', () => {
    const views = rooms().map(([, room]) => toView(room, 'host'));
    expect(new Set(views.map((v) => v.canJudge))).toEqual(new Set([true, false]));
    expect(new Set(views.map((v) => v.canUndo))).toEqual(new Set([true, false]));
    expect(new Set(views.map((v) => v.canChangeTeams))).toEqual(new Set([true, false]));
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

  it('names the player judged half, at the reveal, for the Screen and the host', () => {
    expect(scorer(after(midGame('BUZZED'), { type: 'host:judge', result: 'half' }))).toEqual([
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

  it('carries the player’s own avatar in `me`, and no avatar key without one', () => {
    const room = withAvatars('OPEN');
    expect(toView(room, 'player', 'p1').me).toEqual({
      id: 'p1',
      name: 'Ana',
      color: room.players.p1!.color,
      avatar: '🦊',
      score: 100,
      rank: 2,
    });
    expect(toView(room, 'player', 'p3').me).not.toHaveProperty('avatar');
  });

  it("carries each player's avatar in the LOBBY list, and no avatar key without one", () => {
    const lobby = toView(withAvatars('LOBBY'), 'player', 'p3').lobby!;
    expect(lobby.map((p) => [p.name, p.avatar])).toEqual([
      ['Ana', '🦊'],
      ['Bob', '🐼'],
      ['Cy', undefined],
    ]);
    expect(lobby[2]).not.toHaveProperty('avatar');
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

  it('shows whether the player false-started this question (F71)', () => {
    const room = midGame('QUESTION', { falseStarts: ['p1'] });
    expect(toView(room, 'player', 'p1').falseStart).toBe(true);
    expect(toView(room, 'player', 'p2').falseStart).toBe(false);
  });

  it('gives the phone the room’s false start wait, so it can show "Too early!" (F72)', () => {
    expect(toView(midGame('QUESTION'), 'player', 'p1').falseStartMs).toBe(0);
    const on = midGame('QUESTION', {
      settings: { ...midGame('QUESTION').settings, falseStartMs: 1000 },
    });
    expect(toView(on, 'player', 'p1').falseStartMs).toBe(1000);
  });

  it('gives the phone and the Screen the room’s language (F91)', () => {
    expect(toView(midGame('QUESTION'), 'player', 'p1').copy).toBe('en');
    const taglish = midGame('QUESTION', {
      settings: { ...midGame('QUESTION').settings, copy: 'taglish' },
    });
    expect(toView(taglish, 'player', 'p1').copy).toBe('taglish');
    expect(toView(taglish, 'screen').settings.copy).toBe('taglish');
  });

  it('lists every false starter in press order for the Screen and the host (F72)', () => {
    const room = midGame('OPEN', { falseStarts: ['p2', 'p1'] });
    expect(toView(room, 'screen').falseStarts).toEqual(['p2', 'p1']);
    expect(toView(room, 'host').falseStarts).toEqual(['p2', 'p1']);
    expect(toView(midGame('OPEN'), 'screen').falseStarts).toEqual([]);
  });

  it('turns falseStart on with a press in QUESTION and off at the next question', () => {
    const shown = midGame('QUESTION', {
      settings: { ...midGame('QUESTION').settings, falseStartMs: 500 },
    });
    const pressed = reduce(shown, { type: 'player:buzz', playerId: 'p2', receivedAt: 5 }, T0);
    if (!pressed.ok) throw new Error(pressed.error);
    expect(toView(pressed.room, 'player', 'p2').falseStart).toBe(true);
    const revealed = reduce(pressed.room, { type: 'host:reveal' }, T0);
    if (!revealed.ok) throw new Error(revealed.error);
    const next = reduce(revealed.room, { type: 'host:next' }, T0);
    if (!next.ok) throw new Error(next.error);
    expect(toView(next.room, 'player', 'p2').falseStart).toBe(false);
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

describe('toView: session', () => {
  /** Game 2's lobby after Ana 100, Bob 300 and Dee 300 (who left since) finished game 1. */
  function secondGame(overrides: Partial<Room> = {}): Room {
    return midGame('LOBBY', {
      questionIndex: -1,
      session: {
        gameNumber: 2,
        totals: { p1: 100, p2: 300, p4: 300 },
        players: {
          p1: { name: 'Ana', color: '#EF4444', avatar: '🦊', joinedAt: T0 + 1 },
          p2: { name: 'Bob', color: '#EF4444', joinedAt: T0 + 2 },
          p4: { name: 'Dee', color: '#22C55E', joinedAt: T0 + 4 },
        },
        carried: {},
      },
      ...overrides,
    });
  }

  it('is null on the Screen and the host remote during the first game', () => {
    const room = midGame('OPEN');
    expect(toView(room, 'screen').session).toBeNull();
    expect(toView(room, 'host').session).toBeNull();
  });

  it('ranks the totals from game 2 on, ties in join order, players who left included', () => {
    const expected = {
      gameNumber: 2,
      totals: [
        { id: 'p2', name: 'Bob', color: '#EF4444', total: 300, rank: 1 },
        { id: 'p4', name: 'Dee', color: '#22C55E', total: 300, rank: 1 },
        { id: 'p1', name: 'Ana', color: '#EF4444', avatar: '🦊', total: 100, rank: 3 },
      ],
    };
    expect(toView(secondGame(), 'screen').session).toEqual(expected);
    expect(toView(secondGame(), 'host').session).toEqual(expected);
  });

  it('lists nobody before a game has been tallied', () => {
    const room = secondGame({ session: { gameNumber: 2, totals: {}, players: {}, carried: {} } });
    expect(toView(room, 'screen').session).toEqual({ gameNumber: 2, totals: [] });
  });

  it('leaves out a total with no recorded player rather than failing the view', () => {
    const room = secondGame();
    const orphan = {
      ...room,
      session: { ...room.session, totals: { ...room.session.totals, p9: 50 } },
    };
    expect(toView(orphan, 'screen').session?.totals.map((t) => t.id)).toEqual(['p2', 'p4', 'p1']);
  });

  it('never reaches the phone, nor sends carried scores anywhere', () => {
    const room = secondGame();
    expect(toView(room, 'player', 'p1')).not.toHaveProperty('session');
    expect(JSON.stringify(toView(room, 'screen'))).not.toContain('carried');
    expect(JSON.stringify(toView(room, 'host'))).not.toContain('carried');
  });

  it('gives the phone only its own total and night rank, ties shared, players who left counted', () => {
    expect(toView(secondGame(), 'player', 'p2').tonight).toEqual({ total: 300, rank: 1, count: 3 });
    expect(toView(secondGame(), 'player', 'p1').tonight).toEqual({ total: 100, rank: 3, count: 3 });
    expect(JSON.stringify(toView(secondGame(), 'player', 'p1'))).not.toContain('Dee');
  });

  it('gives the phone the results card data in FINAL only: title, top 10 and the night', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      makePlayer(`q${i}`, { name: `P${i}`, score: 10 * i, joinedAt: T0 + 10 + i }),
    );
    const room = withPlayers(secondGame({ phase: 'FINAL' }), many);
    const results = toView(room, 'player', 'q0').results;
    expect(results?.title).toBe('Pub Quiz');
    expect(results?.ranking.count).toBe(12);
    expect(results?.ranking.rows.map((p) => p.name)).toEqual([
      'P11',
      'P10',
      'P9',
      'P8',
      'P7',
      'P6',
      'P5',
      'P4',
      'P3',
      'P2',
    ]);
    expect(results?.ranking.rows[0]).toEqual({
      id: 'q11',
      name: 'P11',
      color: expect.any(String),
      score: 110,
      connected: true,
      rank: 1,
    });
    expect(results?.tonight).toEqual({
      rows: toView(room, 'screen').session?.totals,
      count: 3,
    });
    for (const phase of ['LOBBY', 'OPEN', 'REVEAL'] as const) {
      expect(toView({ ...room, phase }, 'player', 'q0').results).toBeNull();
    }
  });

  it('gives the phone no night in the results card in game 1, and never an RTT, answer or note', () => {
    const results = toView(midGame('FINAL'), 'player', 'p1').results;
    expect(results?.tonight).toBeNull();
    expect(results?.ranking.rows.map((p) => p.name)).toEqual(['Bob', 'Ana', 'Cy']);
    expect(JSON.stringify(results)).not.toContain('rttMs');
    for (const secret of [...SECRETS(1), ...SECRETS(2), ...SECRETS(3)]) {
      expect(JSON.stringify(results)).not.toContain(secret);
    }
  });

  it('gives the phone no night line in game 1, nor to a player not yet tallied', () => {
    expect(toView(midGame('FINAL'), 'player', 'p1').tonight).toBeNull();
    // Cy (p3) joined game 2 and has no total until its FINAL.
    expect(toView(secondGame(), 'player', 'p3').tonight).toBeNull();
  });

  it('shows the night so far at the FINAL of game 3, Keep scores on then off', () => {
    const act = (room: Room, action: Action): Room => {
      const result = reduce(room, action, T0);
      if (!result.ok) throw new Error(result.error);
      return result.room;
    };
    let room = midGame('LOBBY', { questionIndex: -1 });
    for (const keepScores of [true, false]) {
      room = act(
        act(act(room, { type: 'host:start' }), {
          type: 'host:adjustScore',
          playerId: 'p3',
          delta: 50,
        }),
        { type: 'host:end' },
      );
      room = act(room, { type: 'host:newGame', set: makeSet(), keepScores });
    }
    room = act(act(room, { type: 'host:start' }), { type: 'host:end' });
    const totals = toView(room, 'screen').session?.totals.map((t) => [t.name, t.total, t.rank]);
    // Game 1: Ana 100, Bob 300, Cy 150. Game 2 adds Cy's 50 only, not what was carried. Game 3: 0.
    expect(totals).toEqual([
      ['Bob', 300, 1],
      ['Cy', 200, 2],
      ['Ana', 100, 3],
    ]);
  });
});

describe('toView: teams', () => {
  /** Four players on 3 teams: Ana and Dee on Red, Bob on Blue, Green empty. */
  function teamGame(overrides: Partial<Room> = {}): Room {
    const room = midGame('REVEAL', overrides);
    return withPlayers({ ...room, settings: { ...room.settings, teams: 3 } }, [
      makePlayer('p4', { name: 'Dee', score: 200, joinedAt: T0 + 4, team: 0 }),
      makePlayer('p2', { name: 'Bob', score: 300, joinedAt: T0 + 2, team: 1 }),
      makePlayer('p1', { name: 'Ana', score: 100, joinedAt: T0 + 1, team: 0 }),
    ]);
  }

  it('lists every team in index order with name, colour, summed score, rank and members', () => {
    expect(toView(teamGame(), 'screen').teams).toEqual([
      { index: 0, name: 'Red', color: '#EF4444', score: 300, rank: 1, memberIds: ['p1', 'p4'] },
      { index: 1, name: 'Blue', color: '#3B82F6', score: 300, rank: 1, memberIds: ['p2'] },
      { index: 2, name: 'Green', color: '#22C55E', score: 0, rank: 3, memberIds: [] },
    ]);
  });

  it('gives the Screen, the host and every phone the same teams', () => {
    const room = teamGame();
    const screen = toView(room, 'screen').teams;
    expect(toView(room, 'host').teams).toEqual(screen);
    for (const id of ['p1', 'p2', 'p4']) expect(toView(room, 'player', id).teams).toEqual(screen);
  });

  it('a team score follows its members’ scores as they change', () => {
    const result = reduce(teamGame(), { type: 'host:adjustScore', playerId: 'p2', delta: 50 }, T0);
    if (!result.ok) throw new Error(result.error);
    const { room } = result;
    expect(toView(room, 'screen').teams?.map((t) => [t.score, t.rank])).toEqual([
      [300, 2],
      [350, 1],
      [0, 3],
    ]);
  });

  it('carries no teams while teams are off', () => {
    const room = midGame('REVEAL');
    expect(toView(room, 'screen').teams).toBeNull();
    expect(toView(room, 'host').teams).toBeNull();
    expect(toView(room, 'player', 'p1').teams).toBeNull();
  });

  it('carries no answer or note in a team list before reveal', () => {
    const room = teamGame({ phase: 'BUZZED', winnerId: 'p1' });
    for (const json of publicViews(room)) {
      for (const secret of [...SECRETS(1), ...SECRETS(2), ...SECRETS(3)]) {
        expect(json).not.toContain(secret);
      }
    }
  });
});

describe('toView: choice questions', () => {
  it('Screen and Player views carry the choices but never correctChoice or counts before REVEAL', () => {
    for (const room of [choiceGame('QUESTION'), answering()]) {
      for (const json of publicViews(room)) {
        expect(json).toContain('"choices":["Paris","Lyon","Nice","Metz"]');
        expect(json).not.toContain('correctChoice');
        expect(json).not.toContain('counts');
        // The answer is a choice's text, so look for the field rather than its value.
        expect(json).not.toContain('"answer"');
        for (const secret of SECRETS(2)) expect(json).not.toContain(secret);
      }
    }
  });

  it('a phone gets its own pick and nobody else’s', () => {
    const room = answering();
    expect(toView(room, 'player', 'p1').choice?.mine).toBe(0);
    expect(toView(room, 'player', 'p2').choice?.mine).toBeNull();
    for (const json of publicViews(room)) expect(json).not.toContain('"answers"');
  });

  it('counts N of M answered: M is the connected players and anyone who answered', () => {
    const view = toView(answering(), 'screen').choice;
    expect(view).toMatchObject({ answered: 1, expected: 2 });
  });

  it('carries the answer time in seconds only, while answering', () => {
    const screen = toView(answering(), 'screen');
    expect(screen.choice?.timer).toEqual({ seconds: 10 });
    expect(JSON.stringify(screen)).not.toContain('endsAt');
    expect(toView(choiceRevealed(), 'screen').choice?.timer).toBeNull();
  });

  it('at REVEAL the Screen and phones get the correct choice and the count per choice', () => {
    const room = choiceRevealed();
    expect(room.phase).toBe('REVEAL');
    const screen = toView(room, 'screen');
    expect(screen.choice).toMatchObject({ correctChoice: 1, counts: [1, 1, 0, 0] });
    expect(screen.question?.answer).toBe('Lyon');
    const bob = toView(room, 'player', 'p2');
    expect(bob.choice).toMatchObject({ correctChoice: 1, counts: [1, 1, 0, 0], mine: 1 });
    expect(bob.pointsThisQuestion).toBe(100);
    expect(toView(room, 'player', 'p1').pointsThisQuestion).toBe(0);
  });

  it('the host view carries everything while answering', () => {
    const host = toView(answering(), 'host');
    expect(host.choice).toEqual({
      choices: ['Paris', 'Lyon', 'Nice', 'Metz'],
      answered: 1,
      expected: 2,
      timer: { seconds: 10 },
      correctChoice: 1,
      counts: [1, 0, 0, 0],
      answers: { p1: 0 },
    });
  });

  it('is null for a buzz question and in the lobby', () => {
    for (const room of [midGame('OPEN'), makeRoom()]) {
      expect(toView(room, 'screen').choice).toBeNull();
      expect(toView(room, 'host').choice).toBeNull();
    }
    expect(toView(midGame('OPEN'), 'player', 'p1').choice).toBeNull();
  });
});

describe('toView: typed questions', () => {
  it('Screen and Player views carry no answers, groups, answer or notes before REVEAL', () => {
    for (const room of [typedGame('QUESTION'), typedAnswering(), typedClosed()]) {
      expect(room.phase).not.toBe('REVEAL');
      const others = [
        JSON.stringify(toView(room, 'screen')),
        JSON.stringify(toView(room, 'player', 'p2')),
        JSON.stringify(toView(room, 'player', 'p3')),
      ];
      for (const json of [...others, JSON.stringify(toView(room, 'player', 'p1'))]) {
        expect(json).not.toContain('"groups"');
        expect(json).not.toContain('"answer"');
        expect(json).not.toContain('"answers"');
        expect(json).not.toContain('preMarked');
        for (const secret of [...SECRETS(2), 'Alt-2-secret']) expect(json).not.toContain(secret);
      }
      // Ana's text reaches only Ana's own phone.
      for (const json of others) expect(json).not.toContain('Ana-typed-guess');
    }
  });

  it('a phone gets its own answer and nobody else’s', () => {
    const room = typedClosed();
    expect(toView(room, 'player', 'p1').typed?.mine).toBe('Ana-typed-guess');
    expect(toView(room, 'player', 'p2').typed?.mine).toBe('alt-2-SECRET');
    expect(toView(room, 'player', 'p3').typed?.mine).toBeNull();
  });

  it('carries N of M answered, the time while open, and closed once locked', () => {
    expect(toView(typedAnswering(), 'screen').typed).toEqual({
      answered: 1,
      expected: 2,
      timer: { seconds: 10 },
      closed: false,
    });
    expect(toView(typedClosed(), 'screen').typed).toEqual({
      answered: 2,
      expected: 2,
      timer: null,
      closed: true,
    });
  });

  it('the host view groups the answers with their pre-marks at every phase', () => {
    expect(toView(typedClosed(), 'host').typed?.groups).toEqual([
      {
        key: 'alt-2-secret',
        text: 'alt-2-SECRET',
        playerIds: ['p2'],
        preMarked: true,
        correct: true,
      },
      {
        key: 'ana-typed-guess',
        text: 'Ana-typed-guess',
        playerIds: ['p1'],
        preMarked: false,
        correct: false,
      },
    ]);
    expect(toView(typedGame('QUESTION'), 'host').typed?.groups).toEqual([]);
  });

  it('at REVEAL the Screen and phones get the groups, without pre-marks', () => {
    const room = run(typedClosed(), { type: 'host:reveal' });
    expect(room.phase).toBe('REVEAL');
    const screen = toView(room, 'screen');
    expect(screen.typed?.groups).toEqual([
      { key: 'alt-2-secret', text: 'alt-2-SECRET', playerIds: ['p2'], correct: true },
      { key: 'ana-typed-guess', text: 'Ana-typed-guess', playerIds: ['p1'], correct: false },
    ]);
    expect(screen.question?.answer).toBe('Answer-2-secret');
    const bob = toView(room, 'player', 'p2');
    expect(bob.typed?.groups).toHaveLength(2);
    expect(bob.pointsThisQuestion).toBe(100);
  });

  it('is null for buzz and choice questions', () => {
    for (const room of [midGame('OPEN'), answering(), makeRoom()]) {
      expect(toView(room, 'screen').typed).toBeNull();
      expect(toView(room, 'host').typed).toBeNull();
    }
    expect(toView(answering(), 'player', 'p1').typed).toBeNull();
  });
});

describe('toView: category board', () => {
  it('is null for the Screen and the host when the set has no board', () => {
    const room = midGame('QUESTION');
    expect(toView(room, 'screen').board).toBeNull();
    expect(toView(room, 'host').board).toBeNull();
  });

  it('carries the columns with each tile’s index, points and used flag, in every phase', () => {
    const lobby = midGame('LOBBY', { set: makeBoardSet(2), questionIndex: -1 });
    const played = run(boardGame(), { type: 'host:pick', questionIndex: 4 });
    const tiles = (used: boolean[]) =>
      [0, 1, 2].map((r) => ({ points: (r + 1) * 100, used: used[r] ?? false }));
    for (const view of [toView(lobby, 'screen'), toView(lobby, 'host')]) {
      expect(view.board).toEqual({
        columns: [
          { title: 'Category 1', tiles: tiles([]).map((t, r) => ({ ...t, questionIndex: r })) },
          { title: 'Category 2', tiles: tiles([]).map((t, r) => ({ ...t, questionIndex: r + 3 })) },
        ],
      });
    }
    for (const view of [toView(played, 'screen'), toView(played, 'host')]) {
      expect(view.board!.columns[1]!.tiles.map((t) => t.used)).toEqual([false, true, false]);
      expect(view.board!.columns[0]!.tiles.map((t) => t.used)).toEqual([false, false, false]);
    }
  });

  it('keeps a played tile used back on the board, and the phase reads BOARD', () => {
    const room = run(boardGame(), { type: 'host:pick', questionIndex: 0 }, { type: 'host:prev' });
    for (const view of [toView(room, 'screen'), toView(room, 'host')]) {
      expect(view.phase).toBe('BOARD');
      expect(view.board!.columns[0]!.tiles[0]!.used).toBe(true);
    }
    expect(toView(room, 'player', 'p1').phase).toBe('BOARD');
  });

  it('shows no question in BOARD, and no next question or image on a board set', () => {
    const room = boardGame();
    expect(toView(room, 'screen').question).toBeNull();
    expect(toView(room, 'host').question).toBeNull();
    expect(toView(room, 'host').nextQuestion).toBeNull();
    expect(toView(room, 'screen').nextImageId).toBeNull();
    const picked = run(room, { type: 'host:pick', questionIndex: 1 });
    expect(toView(picked, 'host').question?.id).toBe('q2');
    expect(toView(picked, 'host').nextQuestion).toBeNull();
  });

  it('leaks no question text, answer or notes through the board before a tile is played', () => {
    for (const view of publicViews(boardGame())) {
      for (let n = 1; n <= 6; n++) {
        for (const secret of [...SECRETS(n), `Question ${n} text`]) {
          expect(view).not.toContain(secret);
        }
      }
    }
  });
});
