import { describe, expect, it } from 'vitest';
import {
  type CheckItem,
  type RequestUsage,
  type WordChecker,
  type WordRequest,
  type WordWriter,
  GenerationError,
  UNEXPECTED_ERROR,
  generateWords,
} from './generator.js';

const used = (model: string): RequestUsage => ({
  model,
  inputTokens: 10,
  outputTokens: 5,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
});

function writerOf(words: unknown[], emoji?: unknown): WordWriter & { asked: WordRequest[] } {
  const asked: WordRequest[] = [];
  return {
    asked,
    write(request) {
      asked.push(request);
      return Promise.resolve({
        words,
        ...(emoji === undefined ? {} : { emoji }),
        usage: [used('w')],
      });
    },
  };
}

/** Keeps every word except those named in `drop`; `verdicts` replaces the answer entirely. */
function checkerOf(
  drop: string[] = [],
  verdicts?: unknown[],
): WordChecker & { seen: CheckItem[][] } {
  const seen: CheckItem[][] = [];
  return {
    seen,
    check(_title, items) {
      seen.push([...items]);
      return Promise.resolve({
        verdicts:
          verdicts ??
          items.map((i) => ({ id: i.id, keep: !drop.includes(i.word), reason: 'checked' })),
        usage: [used('c')],
      });
    },
  };
}

const ask = (over: Partial<WordRequest> = {}): WordRequest => ({
  title: 'Kitchen',
  count: 5,
  avoid: [],
  wantEmoji: true,
  ...over,
});

describe('generateWords', () => {
  it('drafts the kept words with level, alternates and the emoji, and reports both stages', async () => {
    const stages: string[] = [];
    const result = await generateWords(ask(), {
      writer: writerOf(
        [
          { word: 'kettle', level: 'easy', alt: [] },
          { word: 'frying pan', level: 'medium', alt: ['skillet', 'fry pan'] },
          { word: 'washing up', level: 'hard', alt: ['doing the dishes'] },
        ],
        '🍳',
      ),
      checker: checkerOf(),
      onStage: (s) => stages.push(s),
    });
    expect(result).toEqual({
      words: [
        { word: 'kettle', alt: [], difficulty: 1 },
        { word: 'frying pan', alt: ['skillet', 'fry pan'], difficulty: 2 },
        { word: 'washing up', alt: ['doing the dishes'], difficulty: 3 },
      ],
      emoji: '🍳',
      usage: [used('w'), used('c')],
    });
    expect(stages).toEqual(['writing', 'checking']);
  });

  it('drops the words the checker drops, and any word it gives no verdict for', async () => {
    const checker = checkerOf(['colander']);
    const result = await generateWords(ask(), {
      writer: writerOf([
        { word: 'kettle', level: 'easy', alt: [] },
        { word: 'colander', level: 'hard', alt: [] },
      ]),
      checker,
    });
    expect(result.words.map((w) => w.word)).toEqual(['kettle']);

    const partial = await generateWords(ask(), {
      writer: writerOf([
        { word: 'kettle', level: 'easy', alt: [] },
        { word: 'toaster', level: 'easy', alt: [] },
      ]),
      checker: checkerOf([], [{ id: 'w2', keep: true, reason: 'fine' }, { id: 'w1' }]),
    });
    expect(partial.words.map((w) => w.word)).toEqual(['toaster']);
  });

  it('never repeats a word or an alternate from the avoid list (top-up)', async () => {
    const checker = checkerOf();
    const result = await generateWords(ask({ avoid: ['doughnut', 'donut', 'Kettle'] }), {
      writer: writerOf([
        { word: 'donut', level: 'easy', alt: [] },
        { word: 'the kettle', level: 'easy', alt: [] },
        { word: 'toaster', level: 'easy', alt: ['Doughnut', 'toast maker'] },
      ]),
      checker,
    });
    expect(result.words).toEqual([{ word: 'toaster', alt: ['toast maker'], difficulty: 1 }]);
    // The repeats never even reach the checker.
    expect(checker.seen[0]!.map((i) => i.word)).toEqual(['toaster']);
  });

  it('drops a repeated word and a word that is another word’s alternate', async () => {
    const result = await generateWords(ask(), {
      writer: writerOf([
        { word: 'airplane', level: 'easy', alt: ['aeroplane', 'plane'] },
        { word: 'Airplane!', level: 'easy', alt: [] },
        { word: 'plane', level: 'easy', alt: [] },
        { word: 'jet', level: 'easy', alt: ['airplane'] },
      ]),
      checker: checkerOf(),
    });
    expect(result.words).toEqual([
      { word: 'airplane', alt: ['aeroplane', 'plane'], difficulty: 1 },
      { word: 'jet', alt: [], difficulty: 1 },
    ]);
  });

  it('runs the pack rules last: a word that breaks them is dropped, a bad alternate left out', async () => {
    const result = await generateWords(ask({ count: 10 }), {
      writer: writerOf([
        { word: 'ox', level: 'easy', alt: [] },
        { word: 'a much too long word for this game here', level: 'easy', alt: [] },
        {
          word: 'television',
          level: 'easy',
          alt: [
            'tv',
            'telly',
            'a',
            'b1',
            'tele',
            'teevee',
            'idiot box',
            'goggle box',
            'small screen',
          ],
        },
      ]),
      checker: checkerOf(),
    });
    expect(result.words).toEqual([
      {
        word: 'television',
        alt: ['telly', 'tele', 'teevee', 'idiot box', 'goggle box', 'small screen'],
        difficulty: 1,
      },
    ]);
  });

  it('skips malformed items, and keeps at most the count asked for', async () => {
    const checker = checkerOf();
    const result = await generateWords(ask({ count: 2 }), {
      writer: writerOf([
        'kettle',
        { word: 'spoon', level: 'tiny', alt: [] },
        { word: 'fork', level: 'easy' },
        { word: 'ladle', level: 'medium', alt: null },
        { word: 'whisk', level: 'medium', alt: [] },
      ]),
      checker,
    });
    expect(result.words.map((w) => w.word)).toEqual(['fork', 'ladle']);
    expect(checker.seen[0]).toHaveLength(2);
  });

  it('ignores a missing or invalid emoji, and asks for none when not wanted', async () => {
    const words = [{ word: 'kettle', level: 'easy', alt: [] }];
    const bad = await generateWords(ask(), { writer: writerOf(words, 'ab'), checker: checkerOf() });
    expect(bad).not.toHaveProperty('emoji');
    const writer = writerOf(words, '🍳');
    const more = await generateWords(ask({ wantEmoji: false }), { writer, checker: checkerOf() });
    expect(more).not.toHaveProperty('emoji');
    expect(writer.asked[0]!.wantEmoji).toBe(false);
  });

  it('skips the checker when nothing usable was written', async () => {
    const checker = checkerOf();
    const result = await generateWords(ask(), { writer: writerOf([]), checker });
    expect(result.words).toEqual([]);
    expect(checker.seen).toEqual([]);
  });

  it('a checker failure keeps the writer’s usage on the error', async () => {
    const err = await generateWords(ask(), {
      writer: writerOf([{ word: 'kettle', level: 'easy', alt: [] }]),
      checker: {
        check: () => Promise.reject(new GenerationError('Claude declined.', [used('c')])),
      },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GenerationError);
    expect((err as GenerationError).message).toBe('Claude declined.');
    expect((err as GenerationError).usage).toEqual([used('w'), used('c')]);
  });

  it('turns any other failure into a plain message', async () => {
    const err = await generateWords(ask(), {
      writer: { write: () => Promise.reject(new TypeError('boom')) },
      checker: checkerOf(),
    }).catch((e: unknown) => e);
    expect((err as GenerationError).message).toBe(UNEXPECTED_ERROR);
  });
});
