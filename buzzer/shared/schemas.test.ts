import { describe, expect, it } from 'vitest';
import {
  ANSWER_MAX,
  ANSWER_SECONDS_CHOICES,
  AVATARS,
  BOARD_COLUMNS_MAX,
  BOARD_COLUMNS_MIN,
  BUZZ_SECONDS_CHOICES,
  CHOICE_TEXT_MAX,
  FALSE_START_MS_CHOICES,
  DEFAULT_SETTINGS,
  TEAM_COUNT_CHOICES,
  HOST_NOTES_MAX,
  ID_MAX,
  MAX_QUESTIONS_PER_SET,
  POINTS_MAX,
  POINTS_MIN,
  QUESTION_TEXT_MAX,
  SCORE_DELTA_MAX,
  SCOREBOARD_EVERY_MAX,
  SET_CATEGORY_MAX,
  SET_TITLE_MAX,
} from './constants.js';
import {
  clientPayloadSchemas,
  createRoomBodySchema,
  draftSetSchema,
  newGameBodySchema,
  playerNameSchema,
  questionSetSchema,
} from './schemas.js';
import type { Question, QuestionSet, RoomSettings } from './types.js';

const TOKEN = 'a'.repeat(43);

function question(overrides: Partial<Question> = {}): Question {
  return { id: 'q1', text: 'Capital of France?', answer: 'Paris', points: 100, ...overrides };
}

function set(overrides: Partial<QuestionSet> = {}): QuestionSet {
  return {
    id: 'set1',
    title: 'Pub quiz',
    questions: [question()],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    schemaVersion: 1,
    ...overrides,
  };
}

function manyQuestions(n: number): Question[] {
  return Array.from({ length: n }, (_, i) => question({ id: `q${i}` }));
}

describe('questionSetSchema', () => {
  it('accepts a valid set, including an image-only question with notes', () => {
    const valid = set({
      questions: [
        question(),
        question({ id: 'q2', text: '', imageId: 'img_1', hostNotes: 'Also: Lutetia' }),
      ],
    });
    expect(questionSetSchema.parse(valid)).toEqual(valid);
  });

  it('accepts exactly 100 questions and rejects 101', () => {
    expect(
      questionSetSchema.safeParse(set({ questions: manyQuestions(MAX_QUESTIONS_PER_SET) })).success,
    ).toBe(true);
    expect(
      questionSetSchema.safeParse(set({ questions: manyQuestions(MAX_QUESTIONS_PER_SET + 1) }))
        .success,
    ).toBe(false);
  });

  it('rejects a set with no questions', () => {
    expect(questionSetSchema.safeParse(set({ questions: [] })).success).toBe(false);
  });

  it('accepts 300-character question text and rejects 301', () => {
    const at = set({ questions: [question({ text: 'x'.repeat(QUESTION_TEXT_MAX) })] });
    const over = set({ questions: [question({ text: 'x'.repeat(QUESTION_TEXT_MAX + 1) })] });
    expect(questionSetSchema.safeParse(at).success).toBe(true);
    expect(questionSetSchema.safeParse(over).success).toBe(false);
  });

  it('rejects a question with neither text nor image', () => {
    expect(
      questionSetSchema.safeParse(set({ questions: [question({ text: '  ' })] })).success,
    ).toBe(false);
  });

  it('rejects a missing or blank answer', () => {
    const noAnswer: Partial<Question> = question();
    delete noAnswer.answer;
    expect(questionSetSchema.safeParse(set({ questions: [noAnswer as Question] })).success).toBe(
      false,
    );
    expect(
      questionSetSchema.safeParse(set({ questions: [question({ answer: ' ' })] })).success,
    ).toBe(false);
  });

  it('rejects over-long answers, host notes and titles', () => {
    const longAnswer = set({ questions: [question({ answer: 'x'.repeat(ANSWER_MAX + 1) })] });
    const longNotes = set({ questions: [question({ hostNotes: 'x'.repeat(HOST_NOTES_MAX + 1) })] });
    const longTitle = set({ title: 'x'.repeat(SET_TITLE_MAX + 1) });
    expect(questionSetSchema.safeParse(longAnswer).success).toBe(false);
    expect(questionSetSchema.safeParse(longNotes).success).toBe(false);
    expect(questionSetSchema.safeParse(longTitle).success).toBe(false);
  });

  it('accepts a set with category and difficulty, trimming the category', () => {
    const parsed = questionSetSchema.parse(set({ category: '  Science ', difficulty: 'hard' }));
    expect([parsed.category, parsed.difficulty]).toEqual(['Science', 'hard']);
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      expect(questionSetSchema.safeParse(set({ difficulty })).success, difficulty).toBe(true);
    }
  });

  it('accepts a set without category or difficulty (files from before F53)', () => {
    const parsed = questionSetSchema.parse(set());
    expect(parsed).not.toHaveProperty('category');
    expect(parsed).not.toHaveProperty('difficulty');
    expect(parsed.schemaVersion).toBe(1);
  });

  it('accepts a 40-character category and rejects 41, blank and non-string ones', () => {
    const ok = (category: unknown) => questionSetSchema.safeParse({ ...set(), category }).success;
    expect(ok('x'.repeat(SET_CATEGORY_MAX))).toBe(true);
    expect(ok(` ${'x'.repeat(SET_CATEGORY_MAX)} `)).toBe(true);
    expect(ok('x'.repeat(SET_CATEGORY_MAX + 1))).toBe(false);
    expect(ok('')).toBe(false);
    expect(ok('   ')).toBe(false);
    expect(ok(7)).toBe(false);
  });

  it('rejects a difficulty other than easy, medium or hard', () => {
    for (const difficulty of ['Easy', 'extreme', '', 2, null]) {
      expect(
        questionSetSchema.safeParse({ ...set(), difficulty }).success,
        String(difficulty),
      ).toBe(false);
    }
  });

  it('accepts points from 0 to 10000 and rejects 10001', () => {
    const pts = (points: number) =>
      questionSetSchema.safeParse(set({ questions: [question({ points })] })).success;
    expect(pts(POINTS_MIN)).toBe(true);
    expect(pts(POINTS_MAX)).toBe(true);
    expect(pts(POINTS_MAX + 1)).toBe(false);
  });

  it('rejects an image id with bad characters', () => {
    const bad = set({ questions: [question({ imageId: '../etc/passwd' })] });
    expect(questionSetSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects non-integer and negative points', () => {
    expect(
      questionSetSchema.safeParse(set({ questions: [question({ points: 99.5 })] })).success,
    ).toBe(false);
    expect(
      questionSetSchema.safeParse(set({ questions: [question({ points: -100 })] })).success,
    ).toBe(false);
  });

  it('rejects duplicate question ids', () => {
    expect(questionSetSchema.safeParse(set({ questions: [question(), question()] })).success).toBe(
      false,
    );
  });

  it('rejects an unknown schema version', () => {
    expect(questionSetSchema.safeParse({ ...set(), schemaVersion: 2 }).success).toBe(false);
  });
});

describe('questionSetSchema: category board (F89)', () => {
  /** `columns` columns of three questions each, c1q1…; ids on the board by default. */
  function boardSet(columns: number, board?: QuestionSet['board']): QuestionSet {
    const ids = Array.from({ length: columns }, (_, c) => [1, 2, 3].map((r) => `c${c}q${r}`));
    return set({
      questions: ids.flat().map((id) => question({ id })),
      board: board ?? {
        columns: ids.map((questionIds, c) => ({ title: `Category ${c + 1}`, questionIds })),
      },
    });
  }

  it('accepts 2 to 6 columns of three questions, and keeps the board', () => {
    for (const columns of [BOARD_COLUMNS_MIN, BOARD_COLUMNS_MAX]) {
      const parsed = questionSetSchema.parse(boardSet(columns));
      expect(parsed.board?.columns).toHaveLength(columns);
    }
  });

  it('refuses fewer than 2 or more than 6 columns', () => {
    expect(questionSetSchema.safeParse(boardSet(BOARD_COLUMNS_MIN - 1)).success).toBe(false);
    expect(questionSetSchema.safeParse(boardSet(BOARD_COLUMNS_MAX + 1)).success).toBe(false);
  });

  it('refuses a column without exactly three questions', () => {
    const valid = boardSet(2);
    for (const questionIds of [
      ['c0q1', 'c0q2'],
      ['c0q1', 'c0q2', 'c0q3', 'c1q1'],
    ]) {
      const columns = [{ title: 'Short', questionIds }, valid.board!.columns[1]!];
      const result = questionSetSchema.safeParse({ ...valid, board: { columns } });
      expect(result.success, questionIds.join()).toBe(false);
    }
  });

  it('trims a column title and refuses a blank or over-long one', () => {
    const valid = boardSet(2);
    const titled = (title: string) => ({
      ...valid,
      board: { columns: [{ ...valid.board!.columns[0]!, title }, valid.board!.columns[1]!] },
    });
    expect(questionSetSchema.parse(titled('  Rivers ')).board!.columns[0]!.title).toBe('Rivers');
    expect(questionSetSchema.safeParse(titled('x'.repeat(SET_CATEGORY_MAX))).success).toBe(true);
    for (const title of ['', '   ', 'x'.repeat(SET_CATEGORY_MAX + 1)]) {
      expect(questionSetSchema.safeParse(titled(title)).success, title).toBe(false);
    }
  });

  it('refuses a tile that is not a question of the set', () => {
    const valid = boardSet(2);
    const columns = [
      { title: 'A', questionIds: ['c0q1', 'c0q2', 'missing'] },
      valid.board!.columns[1]!,
    ];
    const result = questionSetSchema.safeParse({ ...valid, board: { columns } });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('A board tile must be a question of the set');
    expect(result.error?.issues[0]?.path).toEqual(['board', 'columns', 0, 'questionIds', 2]);
  });

  it('refuses a question on the board twice, in one column or across two', () => {
    const valid = boardSet(2);
    for (const [first, second] of [
      [
        ['c0q1', 'c0q1', 'c0q3'],
        ['c1q1', 'c1q2', 'c1q3'],
      ],
      [
        ['c0q1', 'c0q2', 'c0q3'],
        ['c1q1', 'c0q2', 'c1q3'],
      ],
    ]) {
      const columns = [
        { title: 'A', questionIds: first! },
        { title: 'B', questionIds: second! },
      ];
      const result = questionSetSchema.safeParse({ ...valid, board: { columns } });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('A question can be on the board only once');
    }
  });

  it('allows questions off the board, and a set with no board at all', () => {
    const valid = boardSet(2);
    const extra = { ...valid, questions: [...valid.questions, question({ id: 'spare' })] };
    expect(questionSetSchema.safeParse(extra).success).toBe(true);
    expect(questionSetSchema.parse(set()).board).toBeUndefined();
  });

  it('room creation checks the board too', () => {
    const valid = boardSet(2);
    const columns = [{ title: 'A', questionIds: ['x', 'y', 'z'] }, valid.board!.columns[1]!];
    const body = { set: { ...valid, board: { columns } }, settings: DEFAULT_SETTINGS };
    expect(createRoomBodySchema.safeParse(body).success).toBe(false);
    expect(createRoomBodySchema.safeParse({ ...body, set: valid }).success).toBe(true);
  });
});

describe('draftSetSchema (F107)', () => {
  it('takes an unplayable set as the editor saves it: blank title, answer and choices', () => {
    const draft = set({
      title: '',
      questions: [
        question({ text: '', answer: '' }),
        question({ id: 'q2', mode: 'choice', choices: ['', 'B'], answer: '' }),
      ],
    });
    expect(draftSetSchema.parse(draft)).toEqual(draft);
  });

  it('takes a set with no questions, and keeps what was typed untrimmed', () => {
    const draft = set({ title: '  Quiz ', questions: [] });
    expect(draftSetSchema.parse(draft)).toEqual(draft);
  });

  it('refuses a picture', () => {
    const result = draftSetSchema.safeParse(set({ questions: [question({ imageId: 'img-1' })] }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['questions', 0, 'imageId'],
      message: 'Built-in sets cannot have pictures',
    });
  });

  it.each([
    ['title', set({ title: 'x'.repeat(SET_TITLE_MAX + 1) })],
    ['category', set({ category: 'x'.repeat(SET_CATEGORY_MAX + 1) })],
    ['question text', set({ questions: [question({ text: 'x'.repeat(QUESTION_TEXT_MAX + 1) })] })],
    ['answer', set({ questions: [question({ answer: 'x'.repeat(ANSWER_MAX + 1) })] })],
    ['host notes', set({ questions: [question({ hostNotes: 'x'.repeat(HOST_NOTES_MAX + 1) })] })],
    ['a choice', set({ questions: [question({ choices: ['x'.repeat(CHOICE_TEXT_MAX + 1)] })] })],
    ['five choices', set({ questions: [question({ choices: ['a', 'b', 'c', 'd', 'e'] })] })],
    ['points', set({ questions: [question({ points: POINTS_MAX + 1 })] })],
    [
      'question count',
      set({
        questions: Array.from({ length: MAX_QUESTIONS_PER_SET + 1 }, (_, i) =>
          question({ id: `q${i}` }),
        ),
      }),
    ],
    ['id', set({ id: 'bad id' })],
  ])('refuses a draft past its bounds: %s', (_name, draft) => {
    expect(draftSetSchema.safeParse(draft).success).toBe(false);
  });
});

describe('questionSchema: choice questions', () => {
  const choice = (overrides: Partial<Question> = {}) =>
    question({
      mode: 'choice',
      choices: ['Lyon', 'Paris', 'Nice'],
      correctChoice: 1,
      answer: '',
      ...overrides,
    });
  const parse = (q: Question) => questionSetSchema.safeParse(set({ questions: [q] }));
  const paths = (q: Question) => {
    const result = parse(q);
    return result.success ? [] : result.error.issues.map((i) => i.path.slice(2).join('.'));
  };

  it('accepts 2 to 4 choices with a correct one, and sets the answer to its trimmed text', () => {
    const parsed = parse(choice({ choices: [' Lyon ', ' Paris ', 'Nice'], answer: 'stale' }));
    expect(parsed.success && parsed.data.questions[0]).toMatchObject({
      mode: 'choice',
      choices: ['Lyon', 'Paris', 'Nice'],
      correctChoice: 1,
      answer: 'Paris',
    });
    expect(parse(choice({ choices: ['Yes', 'No'], correctChoice: 0 })).success).toBe(true);
    expect(parse(choice({ choices: ['A', 'B', 'C', 'D'], correctChoice: 3 })).success).toBe(true);
  });

  it('rejects a choice question without choices or without a correct choice', () => {
    const noChoices = choice();
    delete noChoices.choices;
    const noCorrect = choice();
    delete noCorrect.correctChoice;
    expect(paths(noChoices)).toEqual(['choices']);
    expect(paths(noCorrect)).toEqual(['correctChoice']);
  });

  it('rejects a correct choice out of range', () => {
    expect(paths(choice({ correctChoice: 3 }))).toEqual(['correctChoice']);
    expect(paths(choice({ choices: ['A', 'B', 'C', 'D'], correctChoice: 4 }))).toEqual([
      'correctChoice',
    ]);
    expect(paths(choice({ correctChoice: -1 }))).toEqual(['correctChoice']);
    expect(paths(choice({ correctChoice: 0.5 }))).toEqual(['correctChoice']);
  });

  it('rejects fewer than 2 or more than 4 choices, and blank or over-long ones', () => {
    expect(paths(choice({ choices: ['Paris'], correctChoice: 0 }))).toEqual(['choices']);
    expect(paths(choice({ choices: ['A', 'B', 'C', 'D', 'E'], correctChoice: 0 }))).toEqual([
      'choices',
    ]);
    expect(paths(choice({ choices: ['Lyon', '  ', 'Nice'] }))).toEqual(['choices.1']);
    expect(
      parse(choice({ choices: ['x'.repeat(CHOICE_TEXT_MAX), 'y'], correctChoice: 0 })).success,
    ).toBe(true);
    expect(
      paths(choice({ choices: ['x'.repeat(CHOICE_TEXT_MAX + 1), 'y'], correctChoice: 0 })),
    ).toEqual(['choices.0']);
  });

  it('accepts buzz and typed modes, which still need an answer', () => {
    expect(parse(question({ mode: 'buzz' })).success).toBe(true);
    expect(parse(question({ mode: 'typed' })).success).toBe(true);
    expect(paths(question({ mode: 'typed', answer: ' ' }))).toEqual(['answer']);
    expect(paths(question({ mode: 'quiz' as Question['mode'] }))).toEqual(['mode']);
  });

  it('drops choices left on a question that is not a choice question', () => {
    const parsed = questionSetSchema.parse(
      set({ questions: [question({ choices: ['Lyon', 'Paris'], correctChoice: 1 })] }),
    );
    expect(parsed.questions[0]).toEqual(question());
  });
});

describe('createRoomBodySchema', () => {
  it('accepts a set with the default settings', () => {
    expect(createRoomBodySchema.safeParse({ set: set(), settings: DEFAULT_SETTINGS }).success).toBe(
      true,
    );
  });

  it('rejects a body without settings', () => {
    expect(createRoomBodySchema.safeParse({ set: set() }).success).toBe(false);
  });

  it('accepts every answer time choice and rejects any other or a missing one', () => {
    const body = (answerSeconds: unknown) => ({
      set: set(),
      settings: { ...DEFAULT_SETTINGS, answerSeconds },
    });
    for (const seconds of ANSWER_SECONDS_CHOICES) {
      expect(createRoomBodySchema.safeParse(body(seconds)).success, String(seconds)).toBe(true);
    }
    for (const seconds of [1, 4, 15, -3, 3.5, '5', null]) {
      expect(createRoomBodySchema.safeParse(body(seconds)).success, String(seconds)).toBe(false);
    }
    const withoutTimer: Partial<RoomSettings> = { ...DEFAULT_SETTINGS };
    delete withoutTimer.answerSeconds;
    expect(createRoomBodySchema.safeParse({ set: set(), settings: withoutTimer }).success).toBe(
      false,
    );
  });

  it('accepts every buzz time choice and rejects any other or a missing one', () => {
    const body = (buzzSeconds: unknown) => ({
      set: set(),
      settings: { ...DEFAULT_SETTINGS, buzzSeconds },
    });
    for (const seconds of BUZZ_SECONDS_CHOICES) {
      expect(createRoomBodySchema.safeParse(body(seconds)).success, String(seconds)).toBe(true);
    }
    for (const seconds of [1, 3, 25, 60, -5, 7.5, '10', null]) {
      expect(createRoomBodySchema.safeParse(body(seconds)).success, String(seconds)).toBe(false);
    }
    const withoutTimer: Partial<RoomSettings> = { ...DEFAULT_SETTINGS };
    delete withoutTimer.buzzSeconds;
    expect(createRoomBodySchema.safeParse({ set: set(), settings: withoutTimer }).success).toBe(
      false,
    );
  });

  it('accepts every false-start wait and rejects any other or a missing one', () => {
    const body = (falseStartMs: unknown) => ({
      set: set(),
      settings: { ...DEFAULT_SETTINGS, falseStartMs },
    });
    for (const ms of FALSE_START_MS_CHOICES) {
      expect(createRoomBodySchema.safeParse(body(ms)).success, String(ms)).toBe(true);
    }
    for (const ms of [1, 250, 750, 2000, -500, 0.5, '500', null]) {
      expect(createRoomBodySchema.safeParse(body(ms)).success, String(ms)).toBe(false);
    }
    const without: Partial<RoomSettings> = { ...DEFAULT_SETTINGS };
    delete without.falseStartMs;
    expect(createRoomBodySchema.safeParse({ set: set(), settings: without }).success).toBe(false);
    expect(clientPayloadSchemas['host:settings'].safeParse({ falseStartMs: 500 }).success).toBe(
      true,
    );
    expect(clientPayloadSchemas['host:settings'].safeParse({ falseStartMs: 300 }).success).toBe(
      false,
    );
  });

  it('accepts every team count and rejects any other or a missing one', () => {
    const body = (teams: unknown) => ({ set: set(), settings: { ...DEFAULT_SETTINGS, teams } });
    for (const teams of TEAM_COUNT_CHOICES) {
      expect(createRoomBodySchema.safeParse(body(teams)).success, String(teams)).toBe(true);
    }
    for (const teams of [1, 5, -2, 2.5, '2', null]) {
      expect(createRoomBodySchema.safeParse(body(teams)).success, String(teams)).toBe(false);
    }
    const without: Partial<RoomSettings> = { ...DEFAULT_SETTINGS };
    delete without.teams;
    expect(createRoomBodySchema.safeParse({ set: set(), settings: without }).success).toBe(false);
    expect(clientPayloadSchemas['host:settings'].safeParse({ teams: 4 }).success).toBe(true);
    expect(clientPayloadSchemas['host:settings'].safeParse({ teams: 1 }).success).toBe(false);
  });

  it('takes 5 to 30 whole seconds for a choice question, and requires it (F85)', () => {
    const body = (choiceSeconds: unknown) => ({
      set: set(),
      settings: { ...DEFAULT_SETTINGS, choiceSeconds },
    });
    for (const choiceSeconds of [5, 10, 17, 30]) {
      expect(
        createRoomBodySchema.safeParse(body(choiceSeconds)).success,
        String(choiceSeconds),
      ).toBe(true);
    }
    for (const choiceSeconds of [4, 31, 0, 7.5, '10', null]) {
      expect(
        createRoomBodySchema.safeParse(body(choiceSeconds)).success,
        String(choiceSeconds),
      ).toBe(false);
    }
    const without: Partial<RoomSettings> = { ...DEFAULT_SETTINGS };
    delete without.choiceSeconds;
    expect(createRoomBodySchema.safeParse({ set: set(), settings: without }).success).toBe(false);
    expect(clientPayloadSchemas['host:settings'].safeParse({ choiceSeconds: 20 }).success).toBe(
      true,
    );
    expect(clientPayloadSchemas['host:settings'].safeParse({ choiceSeconds: 3 }).success).toBe(
      false,
    );
  });

  it('player:answer takes a choice index A–D, nothing else (F85)', () => {
    const answer = clientPayloadSchemas['player:answer'];
    for (const choice of [0, 1, 2, 3]) expect(answer.safeParse({ choice }).success).toBe(true);
    for (const choice of [-1, 4, 1.5, 'A', null]) {
      expect(answer.safeParse({ choice }).success, String(choice)).toBe(false);
    }
    expect(answer.safeParse({}).success).toBe(false);
  });

  it('player:answer takes a typed text of 1–80 characters, trimmed (F87)', () => {
    const answer = clientPayloadSchemas['player:answer'];
    expect(answer.parse({ text: '  Beyoncé  ' })).toEqual({ text: 'Beyoncé' });
    expect(answer.safeParse({ text: 'x'.repeat(80) }).success).toBe(true);
    for (const text of ['', '   ', 'x'.repeat(81), 7, null]) {
      expect(answer.safeParse({ text }).success, String(text)).toBe(false);
    }
  });

  it('host:markTyped takes a list of group keys, up to one per player (F87)', () => {
    const markTyped = clientPayloadSchemas['host:markTyped'];
    expect(markTyped.safeParse({ groups: [] }).success).toBe(true);
    expect(markTyped.safeParse({ groups: ['beyonce', 'queen b'] }).success).toBe(true);
    expect(
      markTyped.safeParse({ groups: Array.from({ length: 51 }, (_, i) => `g${i}`) }).success,
    ).toBe(false);
    expect(markTyped.safeParse({ groups: ['x'.repeat(81)] }).success).toBe(false);
    expect(markTyped.safeParse({ groups: 'beyonce' }).success).toBe(false);
    expect(markTyped.safeParse({}).success).toBe(false);
  });

  it('host:pick takes a question index, a whole number within a set (F89)', () => {
    const pick = clientPayloadSchemas['host:pick'];
    expect(pick.parse({ questionIndex: 0 })).toEqual({ questionIndex: 0 });
    expect(pick.safeParse({ questionIndex: MAX_QUESTIONS_PER_SET - 1 }).success).toBe(true);
    for (const questionIndex of [-1, MAX_QUESTIONS_PER_SET, 1.5, '2', null]) {
      expect(pick.safeParse({ questionIndex }).success, String(questionIndex)).toBe(false);
    }
    expect(pick.safeParse({}).success).toBe(false);
  });

  it('host:settings takes a preset’s five keys in one payload (F73)', () => {
    const settings = clientPayloadSchemas['host:settings'];
    const party = {
      autoOpenBuzzers: true,
      wrongPenalty: false,
      answerSeconds: 0,
      buzzSeconds: 0,
      falseStartMs: 0,
    };
    const competitive = {
      autoOpenBuzzers: false,
      wrongPenalty: true,
      answerSeconds: 5,
      buzzSeconds: 10,
      falseStartMs: 500,
    };
    expect(settings.parse(party)).toEqual(party);
    expect(settings.parse(competitive)).toEqual(competitive);
  });

  it('requires the standings switch in a new room', () => {
    const withoutStandings: Partial<RoomSettings> = { ...DEFAULT_SETTINGS };
    delete withoutStandings.showStandings;
    expect(createRoomBodySchema.safeParse({ set: set(), settings: withoutStandings }).success).toBe(
      false,
    );
  });
});

describe('newGameBodySchema', () => {
  it('accepts a set with keepScores on or off', () => {
    for (const keepScores of [true, false]) {
      expect(newGameBodySchema.safeParse({ set: set(), keepScores }).success).toBe(true);
    }
  });

  it('rejects a missing or non-boolean keepScores', () => {
    for (const keepScores of [undefined, null, 'true', 1]) {
      expect(
        newGameBodySchema.safeParse({ set: set(), keepScores }).success,
        String(keepScores),
      ).toBe(false);
    }
  });

  it('rejects a missing or unplayable set', () => {
    expect(newGameBodySchema.safeParse({ keepScores: false }).success).toBe(false);
    expect(
      newGameBodySchema.safeParse({ set: set({ questions: [] }), keepScores: false }).success,
    ).toBe(false);
  });
});

describe('player names', () => {
  it('trims whitespace, then allows 1 to 16 characters', () => {
    expect(playerNameSchema.parse('  Ada  ')).toBe('Ada');
    expect(playerNameSchema.safeParse('x'.repeat(16)).success).toBe(true);
  });

  it('rejects over-long and blank names', () => {
    expect(playerNameSchema.safeParse('x'.repeat(17)).success).toBe(false);
    expect(playerNameSchema.safeParse('   ').success).toBe(false);
  });

  it('rejects names made of invisible or control characters', () => {
    expect(playerNameSchema.safeParse('​​').success).toBe(false);
    expect(playerNameSchema.safeParse('Ada\u0007').success).toBe(false);
    expect(playerNameSchema.safeParse('Zoë 🐝').success).toBe(true);
  });
});

describe('client event payloads', () => {
  it('accepts a valid payload for every event', () => {
    const valid: { [E in keyof typeof clientPayloadSchemas]: unknown } = {
      'screen:join': { code: 'ABCD' },
      'host:join': { code: 'ABCD', hostToken: TOKEN },
      'player:join': { code: 'ABCD', playerId: 'V1StGXR8_Z5jdHi6B-myT', name: 'Ada' },
      ping: { t: 1234.5 },
      'player:buzz': {},
      'player:practice': {},
      'player:rename': { name: 'Ada' },
      'player:leave': {},
      'player:answer': { choice: 3 },
      'host:start': {},
      'host:open': {},
      'host:judge': { result: 'wrong' },
      'host:reveal': {},
      'host:next': {},
      'host:prev': {},
      'host:scoreboard': { show: true },
      'host:undo': {},
      'host:adjustScore': { playerId: 'p1', delta: -100 },
      'host:kick': { playerId: 'p1' },
      'host:settings': { scoreboardEvery: 0 },
      'host:setTeam': { playerId: 'p1', team: 3 },
      'host:pick': { questionIndex: 4 },
      'host:markTyped': { groups: ['paris', 'paris france'] },
      'host:end': {},
    };
    for (const [event, payload] of Object.entries(valid)) {
      const schema = clientPayloadSchemas[event as keyof typeof clientPayloadSchemas];
      expect(schema.safeParse(payload).success, event).toBe(true);
    }
  });

  it('upper-cases a typed room code and rejects look-alike letters', () => {
    expect(clientPayloadSchemas['screen:join'].parse({ code: ' abcd ' }).code).toBe('ABCD');
    for (const code of ['ABCI', 'ABCL', 'ABCO', 'ABC', 'ABCDE', 'AB1D']) {
      expect(clientPayloadSchemas['screen:join'].safeParse({ code }).success, code).toBe(false);
    }
  });

  it('lets the Screen join with an optional host token (DECISIONS #2)', () => {
    expect(
      clientPayloadSchemas['screen:join'].safeParse({ code: 'ABCD', hostToken: TOKEN }).success,
    ).toBe(true);
    expect(
      clientPayloadSchemas['screen:join'].safeParse({ code: 'ABCD', hostToken: 'short' }).success,
    ).toBe(false);
  });

  it('rejects a host join with a malformed token', () => {
    for (const hostToken of ['a'.repeat(42), 'a'.repeat(44), `${'a'.repeat(42)}+`]) {
      expect(
        clientPayloadSchemas['host:join'].safeParse({ code: 'ABCD', hostToken }).success,
        hostToken,
      ).toBe(false);
    }
  });

  it('trims a new name and holds it to the join rules', () => {
    expect(clientPayloadSchemas['player:rename'].parse({ name: '  Ada  ' }).name).toBe('Ada');
    for (const name of ['', '   ', 'x'.repeat(17), 'Ada\u0007']) {
      expect(clientPayloadSchemas['player:rename'].safeParse({ name }).success, name).toBe(false);
    }
  });

  it('accepts a join with each avatar, or with none', () => {
    const join = { code: 'ABCD', playerId: 'p1', name: 'Ada' };
    expect(clientPayloadSchemas['player:join'].parse(join)).not.toHaveProperty('avatar');
    for (const avatar of AVATARS) {
      expect(clientPayloadSchemas['player:join'].parse({ ...join, avatar }).avatar).toBe(avatar);
    }
  });

  it('rejects a join with an avatar outside the list', () => {
    const join = { code: 'ABCD', playerId: 'p1', name: 'Ada' };
    for (const avatar of ['🐝', 'A', '', '🦊🦊', '🦊\uFE0F', 1, null]) {
      expect(
        clientPayloadSchemas['player:join'].safeParse({ ...join, avatar }).success,
        String(avatar),
      ).toBe(false);
    }
  });

  it('rejects a join with an over-long name', () => {
    const payload = { code: 'ABCD', playerId: 'p1', name: 'x'.repeat(17) };
    expect(clientPayloadSchemas['player:join'].safeParse(payload).success).toBe(false);
  });

  it('rejects player ids that are too long or contain bad characters', () => {
    for (const playerId of ['x'.repeat(ID_MAX + 1), 'a b', 'a/b', '']) {
      const join = { code: 'ABCD', playerId, name: 'Ada' };
      expect(clientPayloadSchemas['player:join'].safeParse(join).success, playerId).toBe(false);
      expect(clientPayloadSchemas['host:kick'].safeParse({ playerId }).success, playerId).toBe(
        false,
      );
    }
  });

  it('bounds a manual score change', () => {
    const adjust = (delta: number) =>
      clientPayloadSchemas['host:adjustScore'].safeParse({ playerId: 'p1', delta }).success;
    expect(adjust(SCORE_DELTA_MAX)).toBe(true);
    expect(adjust(-SCORE_DELTA_MAX - 1)).toBe(false);
    expect(adjust(SCORE_DELTA_MAX + 1)).toBe(false);
  });

  it('accepts correct, half and wrong judgements', () => {
    for (const result of ['correct', 'half', 'wrong']) {
      expect(clientPayloadSchemas['host:judge'].safeParse({ result }).success, result).toBe(true);
    }
  });

  it('host:setTeam takes a team index 0 to 3 and nothing else', () => {
    const setTeam = clientPayloadSchemas['host:setTeam'];
    for (const team of [0, 1, 2, 3]) {
      expect(setTeam.safeParse({ playerId: 'p1', team }).success, String(team)).toBe(true);
    }
    for (const team of [-1, 4, 1.5, '1', null]) {
      expect(setTeam.safeParse({ playerId: 'p1', team }).success, String(team)).toBe(false);
    }
    expect(setTeam.safeParse({ team: 0 }).success).toBe(false);
    expect(setTeam.safeParse({ playerId: 'p 1', team: 0 }).success).toBe(false);
  });

  it('rejects an unknown judgement and a non-integer score change', () => {
    expect(clientPayloadSchemas['host:judge'].safeParse({ result: 'maybe' }).success).toBe(false);
    expect(
      clientPayloadSchemas['host:adjustScore'].safeParse({ playerId: 'p1', delta: 0.5 }).success,
    ).toBe(false);
  });

  it('rejects unknown and out-of-range settings', () => {
    expect(clientPayloadSchemas['host:settings'].safeParse({ hostTokenHash: 'x' }).success).toBe(
      false,
    );
    expect(clientPayloadSchemas['host:settings'].safeParse({ scoreboardEvery: -1 }).success).toBe(
      false,
    );
    expect(clientPayloadSchemas['host:settings'].safeParse({ wrongPenalty: 'yes' }).success).toBe(
      false,
    );
    for (const scoreboardEvery of [SCOREBOARD_EVERY_MAX + 1, 2.5]) {
      expect(
        clientPayloadSchemas['host:settings'].safeParse({ scoreboardEvery }).success,
        String(scoreboardEvery),
      ).toBe(false);
    }
  });

  it('accepts an answer time from the choices only', () => {
    const settings = clientPayloadSchemas['host:settings'];
    for (const answerSeconds of ANSWER_SECONDS_CHOICES) {
      expect(settings.safeParse({ answerSeconds }).success, String(answerSeconds)).toBe(true);
    }
    for (const answerSeconds of [2, 6, 11, 30, 5.5, '3']) {
      expect(settings.safeParse({ answerSeconds }).success, String(answerSeconds)).toBe(false);
    }
  });

  it('accepts a buzz time from the choices only', () => {
    const settings = clientPayloadSchemas['host:settings'];
    for (const buzzSeconds of BUZZ_SECONDS_CHOICES) {
      expect(settings.safeParse({ buzzSeconds }).success, String(buzzSeconds)).toBe(true);
    }
    for (const buzzSeconds of [3, 7, 25, 45, 10.5, '5']) {
      expect(settings.safeParse({ buzzSeconds }).success, String(buzzSeconds)).toBe(false);
    }
  });

  it('accepts the standings switch as a boolean only', () => {
    const settings = clientPayloadSchemas['host:settings'];
    for (const showStandings of [true, false]) {
      expect(settings.safeParse({ showStandings }).success).toBe(true);
    }
    for (const showStandings of [1, 'true', null]) {
      expect(settings.safeParse({ showStandings }).success, String(showStandings)).toBe(false);
    }
  });

  it('accepts the phone and Screen language as English or Taglish only', () => {
    const settings = clientPayloadSchemas['host:settings'];
    for (const copy of ['en', 'taglish']) {
      expect(settings.safeParse({ copy }).success, copy).toBe(true);
    }
    for (const copy of ['tl', 'EN', '', null, 1]) {
      expect(settings.safeParse({ copy }).success, String(copy)).toBe(false);
    }
    const withoutCopy: Partial<RoomSettings> = { ...DEFAULT_SETTINGS };
    delete withoutCopy.copy;
    expect(createRoomBodySchema.safeParse({ set: set(), settings: withoutCopy }).success).toBe(
      false,
    );
  });

  it('rejects a ping without a numeric time', () => {
    expect(clientPayloadSchemas.ping.safeParse({ t: '1' }).success).toBe(false);
    expect(clientPayloadSchemas.ping.safeParse(undefined).success).toBe(false);
  });
});
