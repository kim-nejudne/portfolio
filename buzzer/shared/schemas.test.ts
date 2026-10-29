import { describe, expect, it } from 'vitest';
import {
  ANSWER_MAX,
  ANSWER_SECONDS_CHOICES,
  DEFAULT_SETTINGS,
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

  it('rejects a ping without a numeric time', () => {
    expect(clientPayloadSchemas.ping.safeParse({ t: '1' }).success).toBe(false);
    expect(clientPayloadSchemas.ping.safeParse(undefined).success).toBe(false);
  });
});
