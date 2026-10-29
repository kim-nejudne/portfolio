import { describe, expect, it } from 'vitest';
import { BUILT_IN_SETS } from '../../../shared/builtInSets.js';
import { MAX_QUESTIONS_PER_SET } from '../../../shared/constants.js';
import { SAMPLE_FLAG_ID, SAMPLE_HEXAGON_ID, SAMPLE_SET } from '../../../shared/sampleSet.js';
import type { Difficulty, Question, QuestionSet } from '../../../shared/types.js';
import {
  BOARD_SIZE_MESSAGE,
  boardCategories,
  buildBoard,
  buildGame,
  builderCategories,
  GAME_LIMIT_MESSAGE,
  NO_MATCH_MESSAGE,
  pickCounts,
  type GamePick,
} from './gameBuilder.js';
import { checkPlayable } from './hostRoom.js';

function questions(prefix: string, count: number, points = 100): Question[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `q${i + 1}`,
    text: `${prefix} question ${i + 1}?`,
    answer: `${prefix} ${i + 1}`,
    points,
  }));
}

function set(
  id: string,
  category: string | undefined,
  difficulty: Difficulty | undefined,
  qs: Question[],
): QuestionSet {
  return {
    id,
    title: `${category ?? 'Other'} ${difficulty ?? ''}`,
    questions: qs,
    createdAt: 1,
    updatedAt: 1,
    schemaVersion: 1,
    ...(category === undefined ? {} : { category }),
    ...(difficulty === undefined ? {} : { difficulty }),
  };
}

const SETS = [
  set('ae', 'Animals', 'easy', questions('ae', 10, 100)),
  set('am', 'Animals', 'medium', questions('am', 10, 200)),
  set('he', 'History', 'easy', questions('he', 10, 100)),
  set('sc', 'Science', 'hard', questions('sc', 4, 300)),
];

/** A fixed sequence of [0, 1) values, so a shuffle is repeatable. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

function built(sets: readonly QuestionSet[], picks: GamePick[], seed = 1) {
  const result = buildGame(sets, picks, { random: seeded(seed), now: 5, id: 'mixed' });
  if (!result.ok) throw new Error(result.error);
  return result;
}

const answers = (set: QuestionSet) => set.questions.map((q) => q.answer);

describe('buildGame draws', () => {
  it('takes each row’s count from its category and difficulty, keeping points', () => {
    const { set } = built(SETS, [
      { category: 'Animals', difficulty: 'medium', count: 3 },
      { category: 'History', difficulty: 'easy', count: 2 },
    ]);
    expect(set.questions).toHaveLength(5);
    const animals = set.questions.filter((q) => q.answer.startsWith('am '));
    const history = set.questions.filter((q) => q.answer.startsWith('he '));
    expect(animals).toHaveLength(3);
    expect(history).toHaveLength(2);
    expect(animals.every((q) => q.points === 200)).toBe(true);
    expect(history.every((q) => q.points === 100)).toBe(true);
  });

  it('“any” draws from every difficulty of the category', () => {
    const { set } = built(SETS, [{ category: 'Animals', difficulty: 'any', count: 20 }]);
    expect(set.questions).toHaveLength(20);
  });

  it('matches categories ignoring case and spaces, and files no category under Other', () => {
    const sets = [...SETS, set('o', undefined, undefined, questions('o', 2))];
    expect(
      built(sets, [{ category: ' animals ', difficulty: 'easy', count: 1 }]).set.questions[0]!
        .answer,
    ).toMatch(/^ae /);
    expect(answers(built(sets, [{ category: 'Other', difficulty: 'any', count: 5 }]).set)).toEqual(
      expect.arrayContaining(['o 1', 'o 2']),
    );
  });

  it('is titled Mixed: <categories>, filed under Mixed, with no difficulty', () => {
    const { set } = built(SETS, [
      { category: 'History', difficulty: 'easy', count: 1 },
      { category: 'Animals', difficulty: 'easy', count: 1 },
      { category: 'history', difficulty: 'easy', count: 1 },
    ]);
    expect(set).toMatchObject({
      id: 'mixed',
      title: 'Mixed: History, Animals',
      category: 'Mixed',
      createdAt: 5,
      updatedAt: 5,
      schemaVersion: 1,
    });
    expect(set).not.toHaveProperty('difficulty');
  });

  it('names only the categories that gave questions', () => {
    const { set } = built(SETS, [
      { category: 'Science', difficulty: 'easy', count: 3 },
      { category: 'Animals', difficulty: 'easy', count: 2 },
    ]);
    expect(set.title).toBe('Mixed: Animals');
  });

  it('skips draft sets, which a room would refuse', () => {
    const draft = set('d', 'Drafts', 'easy', [
      { id: 'q1', text: 'No answer?', answer: '', points: 100 },
    ]);
    expect(buildGame([draft], [{ category: 'Drafts', difficulty: 'any', count: 1 }])).toEqual({
      ok: false,
      error: NO_MATCH_MESSAGE,
    });
    expect(builderCategories([draft, ...SETS])).toEqual(['Animals', 'History', 'Science']);
  });

  it('builds a set that passes checkPlayable from the built-in library', () => {
    const { set } = built(BUILT_IN_SETS, [
      { category: 'Animals', difficulty: 'easy', count: 3 },
      { category: 'World History', difficulty: 'medium', count: 3 },
      { category: 'Science', difficulty: 'hard', count: 3 },
    ]);
    expect(set.questions).toHaveLength(9);
    expect(checkPlayable(set)).toEqual({ ok: true, set });
  });
});

describe('buildGame without repeats', () => {
  it('never draws a question twice, even across overlapping rows', () => {
    const { set, shortfalls } = built(SETS, [
      { category: 'Animals', difficulty: 'any', count: 15 },
      { category: 'Animals', difficulty: 'easy', count: 10 },
    ]);
    expect(new Set(answers(set)).size).toBe(set.questions.length);
    // The easy row draws first, so it gets all ten and "any" takes what is left.
    expect(set.questions).toHaveLength(20);
    expect(shortfalls).toEqual([{ pick: 0, asked: 15, got: 10 }]);
  });

  it('gives questions fresh ids, unique within the set', () => {
    const { set } = built(SETS, [
      { category: 'Animals', difficulty: 'easy', count: 3 },
      { category: 'History', difficulty: 'easy', count: 3 },
    ]);
    expect(set.questions.map((q) => q.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6']);
  });

  it('counts a copied set’s questions once', () => {
    const copy = { ...SETS[3]!, id: 'copy', title: 'Science (copy)' };
    const { set, shortfalls } = built(
      [...SETS, copy],
      [{ category: 'Science', difficulty: 'hard', count: 8 }],
    );
    expect(set.questions).toHaveLength(4);
    expect(shortfalls).toEqual([{ pick: 0, asked: 8, got: 4 }]);
  });

  it('counts a copied picture-only card once, though its picture has a fresh id', () => {
    const copy: QuestionSet = {
      ...SAMPLE_SET,
      id: 'sample-copy',
      title: 'Sample (copy)',
      questions: SAMPLE_SET.questions.map((q) =>
        q.imageId === undefined ? q : { ...q, imageId: `copy-${q.imageId}` },
      ),
    };
    const { set } = built(
      [copy, SAMPLE_SET],
      [{ category: 'Other', difficulty: 'any', count: 15 }],
    );
    expect(set.questions).toHaveLength(SAMPLE_SET.questions.length);
    expect(set.questions.filter((q) => q.text === '')).toHaveLength(1);
  });

  it('keeps two picture-only cards with different answers', () => {
    const cards = set('p', 'Flags', 'easy', [
      { id: 'q1', text: '', imageId: 'img-1', answer: 'France', points: 100 },
      { id: 'q2', text: '', imageId: 'img-2', answer: 'Italy', points: 100 },
    ]);
    expect(
      built([cards], [{ category: 'Flags', difficulty: 'easy', count: 5 }]).set.questions,
    ).toHaveLength(2);
  });
});

describe('buildGame seeded shuffle', () => {
  const picks: GamePick[] = [
    { category: 'Animals', difficulty: 'any', count: 6 },
    { category: 'History', difficulty: 'easy', count: 6 },
  ];

  it('gives the same game for the same random source', () => {
    expect(built(SETS, picks, 7).set).toEqual(built(SETS, picks, 7).set);
  });

  it('gives a different draw and order for another source', () => {
    expect(answers(built(SETS, picks, 7).set)).not.toEqual(answers(built(SETS, picks, 8).set));
  });

  it('mixes the rows together rather than one after the other', () => {
    const order = answers(built(SETS, picks, 3).set).map((a) => a.slice(0, 1));
    expect(order.join('')).not.toMatch(/^(a{6}h{6}|h{6}a{6})$/);
  });
});

describe('buildGame shortfall', () => {
  it('takes all there are and reports the row', () => {
    const { set, shortfalls } = built(SETS, [
      { category: 'Animals', difficulty: 'easy', count: 2 },
      { category: 'Science', difficulty: 'hard', count: 9 },
    ]);
    expect(set.questions).toHaveLength(6);
    expect(shortfalls).toEqual([{ pick: 1, asked: 9, got: 4 }]);
  });

  it('pickCounts gives each row’s count, the same as the draw', () => {
    const picks: GamePick[] = [
      { category: 'Animals', difficulty: 'any', count: 15 },
      { category: 'Animals', difficulty: 'easy', count: 10 },
      { category: 'Science', difficulty: 'easy', count: 3 },
    ];
    expect(pickCounts(SETS, picks)).toEqual([10, 10, 0]);
  });

  it('fails when nothing matches', () => {
    expect(buildGame(SETS, [{ category: 'Science', difficulty: 'easy', count: 3 }])).toEqual({
      ok: false,
      error: NO_MATCH_MESSAGE,
    });
    expect(buildGame(SETS, [])).toEqual({ ok: false, error: NO_MATCH_MESSAGE });
  });
});

describe('buildGame limit', () => {
  it(`refuses more than ${MAX_QUESTIONS_PER_SET} questions`, () => {
    const big = Array.from({ length: 8 }, (_, i) =>
      set(`b${i}`, `Cat ${i}`, 'easy', questions(`b${i}`, 15)),
    );
    const picks = big.map((s) => ({
      category: s.category!,
      difficulty: 'easy' as const,
      count: 15,
    }));
    expect(buildGame(big, picks)).toEqual({ ok: false, error: GAME_LIMIT_MESSAGE });
    expect(buildGame(big, picks.slice(0, 6)).ok).toBe(true);
    const exact = buildGame(big, [...picks.slice(0, 6), { ...picks[6]!, count: 10 }]);
    expect(exact.ok && exact.set.questions).toHaveLength(MAX_QUESTIONS_PER_SET);
  });

  it('cuts a long title to fit', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      set(`l${i}`, `A rather long category name ${i}`, 'easy', questions(`l${i}`, 1)),
    );
    const { set: game } = built(
      many,
      many.map((s) => ({ category: s.category!, difficulty: 'easy', count: 1 })),
    );
    expect(game.title).toHaveLength(100);
    expect(game.title.endsWith('…')).toBe(true);
    expect(checkPlayable(game).ok).toBe(true);
  });
});

describe('buildGame images', () => {
  it('keeps each question’s image and notes, and loads the sample’s pictures from the bundle', async () => {
    const stored = set('st', 'Other', undefined, [
      { id: 'q1', text: 'Whose picture?', imageId: 'stored-img', answer: 'Mine', points: 100 },
    ]);
    const { set: game, loadImage } = built(
      [SAMPLE_SET, stored],
      [{ category: 'Other', difficulty: 'any', count: 20 }],
    );
    expect(game.questions).toHaveLength(SAMPLE_SET.questions.length + 1);
    const byAnswer = new Map(game.questions.map((q) => [q.answer, q]));
    for (const question of SAMPLE_SET.questions) {
      expect(byAnswer.get(question.answer)).toEqual({ ...question, id: expect.any(String) });
    }
    expect(await loadImage(SAMPLE_HEXAGON_ID)).toBeInstanceOf(Blob);
    expect(await loadImage(SAMPLE_FLAG_ID)).toBeInstanceOf(Blob);
    expect(await loadImage('not-in-this-game')).toBeUndefined();
  });
});

describe('buildBoard (board mode)', () => {
  const BOARD_SETS = [
    ...SETS,
    set('ah', 'Animals', 'hard', questions('ah', 10, 300)),
    set('hm', 'History', 'medium', questions('hm', 10, 200)),
    set('hh', 'History', 'hard', questions('hh', 10, 300)),
    set('sm', 'Science', 'medium', questions('sm', 4, 200)),
  ];

  function board(sets: readonly QuestionSet[], categories: string[], seed = 1) {
    const result = buildBoard(sets, categories, { random: seeded(seed), now: 5, id: 'board' });
    if (!result.ok) throw new Error(result.error);
    return result;
  }

  it('offers only the categories with a question at every level', () => {
    expect(boardCategories(BOARD_SETS)).toEqual(['Animals', 'History']);
    expect(boardCategories(SETS)).toEqual([]);
  });

  it('draws one Easy, Medium and Hard question per category into a column, in the order picked', () => {
    const { set } = board(BOARD_SETS, ['History', 'Animals']);
    expect(set.board!.columns.map((c) => c.title)).toEqual(['History', 'Animals']);
    const byId = new Map(set.questions.map((q) => [q.id, q]));
    const column = (c: number) =>
      set.board!.columns[c]!.questionIds.map((id) => byId.get(id)!.answer.split(' ')[0]);
    expect(column(0)).toEqual(['he', 'hm', 'hh']);
    expect(column(1)).toEqual(['ae', 'am', 'ah']);
  });

  it('keeps each question’s points: 100, 200, 300 from top to bottom', () => {
    const { set } = board(BOARD_SETS, ['Animals', 'History']);
    const points = new Map(set.questions.map((q) => [q.id, q.points]));
    for (const column of set.board!.columns) {
      expect(column.questionIds.map((id) => points.get(id))).toEqual([100, 200, 300]);
    }
  });

  it('is titled Board: <categories>, filed under Mixed, every question on a tile', () => {
    const { set } = board(BOARD_SETS, ['Animals', 'History']);
    expect(set.title).toBe('Board: Animals, History');
    expect(set.category).toBe('Mixed');
    expect(set.difficulty).toBeUndefined();
    expect(set.questions.map((q) => q.id)).toEqual(
      set.board!.columns.flatMap((c) => c.questionIds),
    );
    expect(checkPlayable(set)).toEqual({ ok: true, set });
  });

  it('draws differently for another random source', () => {
    const answersOf = (seed: number) =>
      answers(board(BOARD_SETS, ['Animals', 'History'], seed).set);
    expect(answersOf(1)).toEqual(answersOf(1));
    expect([2, 3, 4, 5].some((seed) => answersOf(seed).join() !== answersOf(1).join())).toBe(true);
  });

  it('builds a playable 6-column board from the built-in library', () => {
    const categories = boardCategories(BUILT_IN_SETS).slice(0, 6);
    expect(categories).toHaveLength(6);
    const { set } = board(BUILT_IN_SETS, categories);
    expect(set.questions).toHaveLength(18);
    expect(new Set(set.questions.map((q) => q.answer)).size).toBe(18);
    expect(checkPlayable(set)).toEqual({ ok: true, set });
  });

  it('refuses fewer than 2 or more than 6 categories', () => {
    expect(buildBoard(BOARD_SETS, ['Animals'])).toEqual({ ok: false, error: BOARD_SIZE_MESSAGE });
    const seven = Array.from({ length: 7 }, (_, i) => `C${i}`);
    expect(buildBoard(BOARD_SETS, seven)).toEqual({ ok: false, error: BOARD_SIZE_MESSAGE });
  });

  it('refuses a category twice, ignoring case', () => {
    expect(buildBoard(BOARD_SETS, ['Animals', ' animals'])).toEqual({
      ok: false,
      error: 'Each category can be on the board once.',
    });
  });

  it('refuses a category missing a level', () => {
    expect(buildBoard(BOARD_SETS, ['Animals', 'Science'])).toEqual({
      ok: false,
      error: 'Science has no question at every level.',
    });
  });
});
