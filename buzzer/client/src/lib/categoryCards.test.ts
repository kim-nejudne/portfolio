import { describe, expect, it } from 'vitest';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import { STARTER_SETS } from '../../../shared/starterSets/index.js';
import type { Difficulty, QuestionSet } from '../../../shared/types.js';
import {
  cardMeta,
  findPick,
  firstPick,
  keyToPick,
  pickerSections,
  resolveLevel,
  searchSections,
  ticketOf,
  type CategoryCard,
  type PickerItem,
} from './categoryCards.js';
import { keywordEmoji } from './categoryEmoji.js';

const question = { id: 'q', text: 'Q?', answer: 'A', points: 100 };

function set(id: string, fields: Partial<QuestionSet> = {}): QuestionSet {
  return {
    id,
    title: id,
    questions: [question],
    createdAt: 0,
    updatedAt: 0,
    ...fields,
  } as QuestionSet;
}

const level = (id: string, category: string, difficulty: Difficulty, count = 1) =>
  set(id, {
    category,
    difficulty,
    title: `${category} – ${difficulty}`,
    questions: Array(count).fill(question),
  });

const keyOf = (s: QuestionSet) => `k:${s.id}`;
const sections = (mine: QuestionSet[], builtIn: QuestionSet[] | null, emoji = {}) =>
  pickerSections(mine, builtIn, emoji, keyOf);
const label = (item: PickerItem) =>
  item.kind === 'tile' ? `tile ${item.set.id}` : `card ${item.name}`;

describe('pickerSections', () => {
  it('groups the 60 starters into 20 cards of Easy, Medium and Hard, after the sample tile', () => {
    const { builtIn } = sections([], [SAMPLE_SET, ...STARTER_SETS]);
    expect(builtIn).toHaveLength(21);
    expect(label(builtIn[0]!)).toBe(`tile ${SAMPLE_SET.id}`);
    const animals = builtIn[1] as CategoryCard;
    expect(animals.name).toBe('Animals');
    expect(Object.keys(animals.levels)).toEqual(['easy', 'medium', 'hard']);
    expect(animals.levels.medium!.key).toBe('k:starter-animals-medium');
  });

  it('a set without a level, and a second set at a level, are plain tiles where they stood', () => {
    const { builtIn } = sections(
      [],
      [
        level('m-easy', 'Math', 'easy'),
        set('m-free', { category: 'Math' }),
        level('m-easy-2', ' math ', 'easy'),
        level('m-hard', 'MATH', 'hard'),
      ],
    );
    expect(builtIn.map(label)).toEqual(['card Math', 'tile m-free', 'tile m-easy-2']);
    const card = builtIn[0] as CategoryCard;
    expect(Object.keys(card.levels).sort()).toEqual(['easy', 'hard']);
    // Every set is somewhere: none is dropped.
    expect(findPick(sections([], [level('x', 'A', 'easy')]), 'k:x')).toBeTruthy();
  });

  it('a levelled set with no category is a tile', () => {
    const { builtIn } = sections([], [set('loose', { difficulty: 'easy' })]);
    expect(builtIn.map(label)).toEqual(['tile loose']);
  });

  it("this browser's sets are tiles in the order given, and never join a card", () => {
    const { yours, builtIn } = sections([set('fresh'), level('old', 'Math', 'easy')], null);
    expect(yours.map(label)).toEqual(['tile fresh', 'tile old']);
    expect(yours.every((tile) => tile.mine)).toBe(true);
    expect(builtIn).toEqual([]);
  });
});

describe('emoji', () => {
  it('a card takes the stored emoji, else the keyword map, else 🎯', () => {
    const { builtIn } = sections(
      [],
      [
        level('a', 'Math', 'easy'),
        level('b', 'General Knowledge', 'easy'),
        level('c', 'Philippine Showbiz Chika', 'easy'),
        level('d', 'Zzyzx', 'easy'),
      ],
      { math: '🦉' },
    );
    expect(builtIn.map((item) => item.emoji)).toEqual(['🦉', '🧠', '🎬', '🎯']);
  });

  it('the sample is 🎲, even with a stored emoji for its category', () => {
    const { builtIn } = sections([], [SAMPLE_SET], { 'general knowledge': '🦉' });
    expect(builtIn[0]!.emoji).toBe('🎲');
  });

  it("a built-in tile takes its category's emoji, else its title's keyword, else 🎯", () => {
    const { builtIn } = sections(
      [],
      [
        set('a', { category: 'Rivers' }),
        set('b', { category: 'Zzyzx', title: 'Movie night' }),
        set('c', { title: 'Zzyzx' }),
      ],
      { rivers: '🌊' },
    );
    expect(builtIn.map((item) => item.emoji)).toEqual(['🌊', '🎬', '🎯']);
  });

  it("this browser's sets use the keyword map on their category, then title, else 📝", () => {
    const { yours } = sections(
      [
        set('a', { category: 'Science', title: 'Movie night', updatedAt: 3 }),
        set('b', { title: 'Friday math quiz', updatedAt: 2 }),
        set('c', { title: "Lola's 80th", updatedAt: 1 }),
      ],
      null,
      { science: '🦉' },
    );
    expect(yours.map((tile) => tile.emoji)).toEqual(['🔬', '🧮', '📝']);
  });

  it('the keyword map matches at a word start, folding case and accents', () => {
    expect(keywordEmoji('Mathematics')).toBe('🧮');
    expect(keywordEmoji('Aftermath')).toBeUndefined();
    expect(keywordEmoji('MATEMÁTICAS')).toBeUndefined();
    expect(keywordEmoji('Philippine History')).toBe('📜');
    expect(keywordEmoji('Philippine TV & Pop Culture')).toBe('📺');
    expect(keywordEmoji('World History')).toBe('🏛️');
    expect(keywordEmoji('Pinoy Henyo')).toBe('🇵🇭');
    expect(keywordEmoji('Party Games')).toBe('🎮');
    expect(keywordEmoji('Star Wars')).toBe('🚀');
    expect(keywordEmoji('Computers & Tech')).toBe('💻');
    // A short keyword must be the whole word, not the start of another.
    for (const text of ['Singapore', 'Starter pack', 'Warm-up', 'Bandwidth', 'Technique'])
      expect(keywordEmoji(text), text).toBeUndefined();
    expect(keywordEmoji(undefined)).toBeUndefined();
  });

  it('every starter category gets an emoji of its own from the keyword map', () => {
    const { builtIn } = sections([], STARTER_SETS);
    const emoji = builtIn.map((item) => item.emoji);
    expect(emoji).not.toContain('🎯');
    expect(new Set(emoji).size).toBe(emoji.length);
  });
});

describe('resolveLevel', () => {
  const card = (levels: Difficulty[]) =>
    sections(
      [],
      levels.map((l) => level(l, 'Math', l)),
    ).builtIn[0] as CategoryCard;

  it('picks the wanted level when the card has it', () => {
    expect(resolveLevel(card(['easy', 'medium', 'hard']), 'hard')).toBe('hard');
  });

  it('else the nearest level, the easier on a tie', () => {
    expect(resolveLevel(card(['easy', 'hard']), 'medium')).toBe('easy');
    expect(resolveLevel(card(['medium']), 'easy')).toBe('medium');
    expect(resolveLevel(card(['easy', 'medium']), 'hard')).toBe('medium');
    expect(resolveLevel(card(['hard']), 'easy')).toBe('hard');
  });

  it("keyToPick gives a card's set at that level and a tile's own key", () => {
    expect(keyToPick(card(['easy', 'hard']), 'hard')).toBe('k:hard');
    const tile = sections([set('t')], null).yours[0]!;
    expect(keyToPick(tile, 'easy')).toBe('k:t');
  });
});

describe('firstPick', () => {
  it('picks the newest My set, else the first built-in at Medium', () => {
    expect(firstPick(sections([set('mine')], STARTER_SETS))).toBe('k:mine');
    expect(firstPick(sections([], STARTER_SETS))).toBe('k:starter-animals-medium');
    expect(firstPick(sections([], [SAMPLE_SET, ...STARTER_SETS]))).toBe(`k:${SAMPLE_SET.id}`);
    expect(firstPick(sections([], null))).toBeNull();
  });
});

describe('searchSections', () => {
  const all = sections([set('Pub quiz')], [SAMPLE_SET, ...STARTER_SETS]);
  const labels = (query: string) => {
    const found = searchSections(all, query);
    return [...found.yours, ...found.builtIn].map(label);
  };

  it('finds a card by its category, folding case and accents', () => {
    expect(labels('ÁNIMALS')).toEqual(['card Animals']);
  });

  it('finds a card by one of its set titles, and keeps the card whole', () => {
    const found = searchSections(all, 'space easy');
    expect(found.builtIn.map(label)).toEqual(['card Space & Astronomy']);
    expect(Object.keys((found.builtIn[0] as CategoryCard).levels)).toHaveLength(3);
  });

  it('every word must match, in either section', () => {
    expect(labels('pub')).toEqual(['tile Pub quiz']);
    expect(labels('philippine history')).toEqual(['card Philippine History']);
    expect(labels('zzz')).toEqual([]);
  });

  it('an empty search keeps everything', () => {
    expect(labels('  ')).toHaveLength(1 + 21);
  });
});

describe('ticketOf', () => {
  it('a card shows the category, Built-in category, the level in gold and the count', () => {
    const all = sections([], [level('m', 'Math', 'easy', 15)]);
    expect(ticketOf(findPick(all, 'k:m')!)).toEqual({
      emoji: '🧮',
      kicker: 'Built-in category',
      title: 'Math',
      chips: [{ label: 'Easy', level: true }, { label: '15 questions' }],
    });
  });

  it('a tile shows its title, whose it is, and a draft is marked', () => {
    const all = sections([set('Round two', { questions: [] })], [SAMPLE_SET]);
    expect(ticketOf(findPick(all, 'k:Round two')!, false)).toEqual({
      emoji: '📝',
      kicker: 'Your set',
      title: 'Round two',
      chips: [{ label: '0 questions' }, { label: 'Not playable yet' }],
    });
    expect(ticketOf(findPick(all, `k:${SAMPLE_SET.id}`)!).kicker).toBe('Built-in set');
  });
});

describe('cardMeta', () => {
  it('reads "N questions each", a range, or one count', () => {
    const meta = (sets: QuestionSet[]) => cardMeta(sections([], sets).builtIn[0] as CategoryCard);
    expect(meta([level('a', 'M', 'easy', 15), level('b', 'M', 'hard', 15)])).toBe(
      '15 questions each',
    );
    expect(meta([level('a', 'M', 'easy', 10), level('b', 'M', 'hard', 15)])).toBe(
      '10–15 questions',
    );
    expect(meta([level('a', 'M', 'easy', 1)])).toBe('1 question');
  });
});
