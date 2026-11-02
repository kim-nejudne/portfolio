import { describe, expect, it } from 'vitest';
import { GENERATE_SEARCHES_MAX, QUESTION_TEXT_MAX } from '../../shared/constants.js';
import {
  type CheckItem,
  type FactChecker,
  type LevelRequest,
  type QuestionWriter,
  type WriteRequest,
  GenerationError,
  generateLevel,
} from './generator.js';
import { type Usage, pricedUsage } from './pricing.js';

const usage = (searches = 0): Usage =>
  pricedUsage('claude-haiku-5-5', {
    inputTokens: 1000,
    outputTokens: 100,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    searches,
  });

const request = (overrides: Partial<LevelRequest> = {}): LevelRequest => ({
  category: 'Rivers',
  guidance: '',
  difficulty: 'easy',
  count: 3,
  avoid: [],
  ...overrides,
});

/** A writer that answers each round from `rounds`, recording what it was asked. */
function fakeWriter(rounds: unknown[][]): QuestionWriter & { calls: WriteRequest[] } {
  const calls: WriteRequest[] = [];
  return {
    calls,
    write(req) {
      calls.push(structuredClone(req));
      const questions = rounds[calls.length - 1];
      if (!questions) throw new Error(`writer called ${calls.length} times`);
      return Promise.resolve({ questions, usage: usage() });
    },
  };
}

type Judge = (item: CheckItem) => unknown;

/** A checker that judges each item with `judge` (ok by default), recording what it was given. */
function fakeChecker(
  judge: Judge = (item) => ({ id: item.id, verdict: 'ok', reason: 'fine' }),
  searchesPerCall = 0,
): FactChecker & { calls: { items: CheckItem[]; maxSearches: number }[] } {
  const calls: { items: CheckItem[]; maxSearches: number }[] = [];
  return {
    calls,
    check(items, { maxSearches }) {
      calls.push({ items: structuredClone(items), maxSearches });
      return Promise.resolve({ verdicts: items.map(judge), usage: usage(searchesPerCall) });
    },
  };
}

const q = (n: number, extra: object = {}) => ({
  text: `Question ${n}?`,
  answer: `A${n}`,
  ...extra,
});

describe('generateLevel', () => {
  it('returns the questions the checker passes, with the usage of every call', async () => {
    const writer = fakeWriter([[q(1), q(2, { hostNotes: 'Also accept: B' }), q(3)]]);
    const checker = fakeChecker();
    const result = await generateLevel(request(), { writer, checker });
    expect(result.questions).toEqual([q(1), q(2, { hostNotes: 'Also accept: B' }), q(3)]);
    expect(result.short).toBe(false);
    expect(result.usage.inputTokens).toBe(2000);
    expect(result.usage.costUsd).toBeCloseTo(usage().costUsd * 2);
    expect(writer.calls).toHaveLength(1);
    expect(checker.calls[0]!.items.map((i) => i.id)).toEqual(['q1', 'q2', 'q3']);
  });

  it('applies a fix to the answer and host notes silently', async () => {
    const writer = fakeWriter([[q(1), q(2), q(3)]]);
    const checker = fakeChecker((item) =>
      item.id === 'q2'
        ? { id: 'q2', verdict: 'fix', answer: 'Nile', hostNotes: 'Also accept: Nil', reason: 'x' }
        : { id: item.id, verdict: 'ok', reason: 'fine' },
    );
    const result = await generateLevel(request(), { writer, checker });
    expect(result.questions[1]).toEqual({
      text: 'Question 2?',
      answer: 'Nile',
      hostNotes: 'Also accept: Nil',
    });
    expect(result.short).toBe(false);
  });

  it('keeps the written answer when a fix only changes the notes', async () => {
    const writer = fakeWriter([[q(1), q(2), q(3)]]);
    const checker = fakeChecker((item) => ({
      id: item.id,
      verdict: 'fix',
      hostNotes: 'Also accept: X',
      reason: 'x',
    }));
    const result = await generateLevel(request(), { writer, checker });
    expect(result.questions[0]).toEqual(q(1, { hostNotes: 'Also accept: X' }));
  });

  it('tops up a dropped question with a new round, and checks only the new one', async () => {
    const writer = fakeWriter([[q(1), q(2), q(3)], [q(4)]]);
    const checker = fakeChecker((item) => ({
      id: item.id,
      verdict: item.text === 'Question 2?' ? 'drop' : 'ok',
      reason: 'x',
    }));
    const result = await generateLevel(request(), { writer, checker });
    expect(result.questions.map((x) => x.text)).toEqual([
      'Question 1?',
      'Question 3?',
      'Question 4?',
    ]);
    expect(result.short).toBe(false);
    expect(writer.calls[1]!.count).toBe(1);
    expect(checker.calls[1]!.items.map((i) => i.text)).toEqual(['Question 4?']);
  });

  it('stops after 2 extra rounds and returns the level short', async () => {
    const writer = fakeWriter([[q(1), q(2), q(3)], [q(4), q(5)], [q(6)]]);
    const checker = fakeChecker((item) => ({
      id: item.id,
      verdict: item.text === 'Question 1?' ? 'ok' : 'drop',
      reason: 'x',
    }));
    const result = await generateLevel(request(), { writer, checker });
    expect(writer.calls).toHaveLength(3);
    expect(writer.calls.map((c) => c.count)).toEqual([3, 2, 2]);
    expect(result.questions.map((x) => x.text)).toEqual(['Question 1?']);
    expect(result.short).toBe(true);
  });

  it('passes the avoid list on, and adds every question written so far in later rounds', async () => {
    const writer = fakeWriter([[q(1), q(2), q(3)], [q(4)]]);
    const checker = fakeChecker((item) => ({
      id: item.id,
      verdict: item.text === 'Question 3?' ? 'drop' : 'ok',
      reason: 'x',
    }));
    await generateLevel(
      request({ avoid: ['Old one?'], guidance: 'Rivers of Africa', difficulty: 'hard' }),
      { writer, checker },
    );
    expect(writer.calls[0]).toEqual({
      category: 'Rivers',
      guidance: 'Rivers of Africa',
      difficulty: 'hard',
      count: 3,
      avoid: ['Old one?'],
    });
    expect(writer.calls[1]!.avoid).toEqual([
      'Old one?',
      'Question 1?',
      'Question 2?',
      'Question 3?',
    ]);
  });

  it('drops a question that repeats one in the avoid list or this level', async () => {
    const writer = fakeWriter([
      [q(1), { text: '  question 1? ', answer: 'B' }, { text: 'OLD ONE', answer: 'C' }],
      [q(2), q(3)],
    ]);
    const checker = fakeChecker();
    const result = await generateLevel(request({ avoid: ['Old one?'] }), { writer, checker });
    expect(result.questions.map((x) => x.text)).toEqual([
      'Question 1?',
      'Question 2?',
      'Question 3?',
    ]);
    expect(checker.calls[0]!.items).toHaveLength(1);
  });

  it('counts malformed items and a malformed or missing verdict as drops', async () => {
    const writer = fakeWriter([
      [
        q(1),
        { text: 'No answer?' },
        { text: 'x'.repeat(QUESTION_TEXT_MAX + 1), answer: 'A' },
        { text: '   ', answer: 'A' },
        'not an object',
        q(2),
        q(3),
      ],
      [q(4), q(5)],
      [],
    ]);
    const checker = fakeChecker((item) => {
      if (item.text === 'Question 2?') return { id: item.id, verdict: 'maybe', reason: 'x' };
      if (item.text === 'Question 3?') return { id: 'nope', verdict: 'ok', reason: 'x' };
      return { id: item.id, verdict: 'ok', reason: 'x' };
    });
    const result = await generateLevel(request(), { writer, checker });
    expect(checker.calls[0]!.items.map((i) => i.text)).toEqual([
      'Question 1?',
      'Question 2?',
      'Question 3?',
    ]);
    expect(result.questions.map((x) => x.text)).toEqual([
      'Question 1?',
      'Question 4?',
      'Question 5?',
    ]);
    expect(result.short).toBe(false);
  });

  it('drops a fix whose answer breaks the limits', async () => {
    const writer = fakeWriter([[q(1), q(2), q(3)], [q(4)]]);
    const checker = fakeChecker((item) =>
      item.id === 'q1' && item.text === 'Question 1?'
        ? { id: 'q1', verdict: 'fix', answer: '  ', reason: 'x' }
        : { id: item.id, verdict: 'ok', reason: 'x' },
    );
    const result = await generateLevel(request(), { writer, checker });
    expect(result.questions.map((x) => x.text)).toEqual([
      'Question 2?',
      'Question 3?',
      'Question 4?',
    ]);
  });

  it('trims items, drops empty notes and unknown keys, and checks no more than it needs', async () => {
    const writer = fakeWriter([
      [{ text: ' Q1? ', answer: ' A ', hostNotes: '  ', extra: 1 }, q(2), q(3), q(4)],
    ]);
    const checker = fakeChecker();
    const result = await generateLevel(request(), { writer, checker });
    expect(result.questions[0]).toEqual({ text: 'Q1?', answer: 'A' });
    expect(checker.calls[0]!.items).toHaveLength(3);
  });

  it('writes again when a round returns nothing usable', async () => {
    const writer = fakeWriter([[], [q(1), q(2), q(3)]]);
    const checker = fakeChecker();
    const result = await generateLevel(request(), { writer, checker });
    expect(checker.calls).toHaveLength(1);
    expect(result.questions).toHaveLength(3);
  });

  it('gives the checker what is left of the level’s search budget', async () => {
    const writer = fakeWriter([[q(1), q(2), q(3)], [q(4)], [q(5)]]);
    const checker = fakeChecker(
      (item) => ({
        id: item.id,
        verdict: item.text === 'Question 1?' ? 'ok' : 'drop',
        reason: 'x',
      }),
      7,
    );
    const result = await generateLevel(request(), { writer, checker });
    expect(checker.calls.map((c) => c.maxSearches)).toEqual([GENERATE_SEARCHES_MAX, 3, 0]);
    expect(result.usage.searches).toBe(21);
  });

  it('fails the level with the plain message of a refusal, keeping the usage so far', async () => {
    const writer: QuestionWriter = {
      write: () => Promise.reject(new GenerationError('Claude declined to write these questions.')),
    };
    await expect(generateLevel(request(), { writer, checker: fakeChecker() })).rejects.toThrow(
      'Claude declined to write these questions.',
    );

    const failing: FactChecker = {
      check: () => Promise.reject(new GenerationError('The fact check failed.', usage(2))),
    };
    const err: unknown = await generateLevel(request(), {
      writer: fakeWriter([[q(1), q(2), q(3)]]),
      checker: failing,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GenerationError);
    expect((err as GenerationError).usage.searches).toBe(2);
    expect((err as GenerationError).usage.inputTokens).toBe(2000);
  });

  it('turns an unexpected error into a plain one', async () => {
    const writer: QuestionWriter = { write: () => Promise.reject(new TypeError('boom')) };
    await expect(generateLevel(request(), { writer, checker: fakeChecker() })).rejects.toThrow(
      new GenerationError('Question generation failed unexpectedly. Try again.'),
    );
  });

  it('refuses a count below 1', async () => {
    await expect(
      generateLevel(request({ count: 0 }), { writer: fakeWriter([]), checker: fakeChecker() }),
    ).rejects.toThrow(RangeError);
  });
});
