// The admin's category and word edits (F81): ids from titles and words, the bulk-paste parser, and
// each edit's checks, which name the field they refuse. The routes run in http.adminCategories.test.ts.
import { describe, expect, it } from 'vitest';
import { categoriesFileSchema, type Category } from './categoryStore.js';
import {
  addBulk,
  addWord,
  AdminEditError,
  createCategory,
  deleteCategory,
  deleteWord,
  describeIssue,
  parseBulkPaste,
  parseLevel,
  patchCategory,
  patchWord,
  slugId,
} from './adminCategories.js';
import { adminWordBodySchema } from '../shared/schemas.js';

const food: Category = {
  id: 'en-food',
  title: 'Food',
  emoji: '🍔',
  defaultOn: true,
  hidden: false,
  words: [
    { id: 'doughnut', word: 'doughnut', alt: ['donut'], difficulty: 1 },
    { id: 'birthday-cake', word: 'birthday cake', alt: [], difficulty: 2 },
  ],
};
const animals: Category = {
  id: 'en-animals',
  title: 'Animals',
  emoji: '🐾',
  defaultOn: true,
  hidden: false,
  words: [{ id: 'cat', word: 'cat', alt: ['kitty'], difficulty: 1 }],
};
const CATS: readonly Category[] = Object.freeze([food, animals]);

/** The error an edit throws, so a test can check its status, field and message. */
function refusal(run: () => unknown): AdminEditError {
  try {
    run();
  } catch (err) {
    if (err instanceof AdminEditError) return err;
    throw err;
  }
  throw new Error('expected an AdminEditError');
}

/** Every result must still be a valid store file. */
const valid = (categories: readonly Category[]) =>
  expect(categoriesFileSchema.safeParse({ version: 1, categories }).success).toBe(true);

describe('slugId', () => {
  it('makes an [a-z0-9-] id from any text, accents and symbols included', () => {
    expect(slugId('Ice Cream!', new Set(), 'word')).toBe('ice-cream');
    expect(slugId('  Crème brûlée ', new Set(), 'word')).toBe('creme-brulee');
    expect(slugId('🍕', new Set(), 'word')).toBe('word');
  });

  it('adds -2, -3… to stay unique, within 40 characters', () => {
    expect(slugId('Food', new Set(['food']), 'category')).toBe('food-2');
    expect(slugId('Food', new Set(['food', 'food-2']), 'category')).toBe('food-3');
    const long = 'a'.repeat(60);
    const id = slugId(long, new Set(['a'.repeat(40)]), 'category');
    expect(id).toBe(`${'a'.repeat(38)}-2`);
    expect(id.length).toBeLessThanOrEqual(40);
  });
});

describe('parseLevel', () => {
  it('reads easy, medium and hard (or 1–3), defaulting to medium when empty', () => {
    expect(parseLevel('')).toBe(2);
    expect(parseLevel('Easy')).toBe(1);
    expect(parseLevel(' medium ')).toBe(2);
    expect(parseLevel('HARD')).toBe(3);
    expect(parseLevel('1')).toBe(1);
    expect(parseLevel('3')).toBe(3);
    expect(parseLevel('tricky')).toBeNull();
    expect(parseLevel('4')).toBeNull();
  });
});

describe('parseBulkPaste', () => {
  it('reads `word | level | alt, alt` with level and alternates optional', () => {
    const { entries, errors } = parseBulkPaste(
      'pizza\nhot dog | easy\n\n  airplane | hard | aeroplane, plane  \nkayak || canoe\n',
    );
    expect(errors).toEqual([]);
    expect(entries).toEqual([
      { line: 1, text: 'pizza', word: 'pizza', difficulty: 2, alt: [] },
      { line: 2, text: 'hot dog | easy', word: 'hot dog', difficulty: 1, alt: [] },
      {
        line: 4,
        text: 'airplane | hard | aeroplane, plane',
        word: 'airplane',
        difficulty: 3,
        alt: ['aeroplane', 'plane'],
      },
      { line: 5, text: 'kayak || canoe', word: 'kayak', difficulty: 2, alt: ['canoe'] },
    ]);
  });

  it('lists bad lines with the reason and keeps the good ones', () => {
    const { entries, errors } = parseBulkPaste(
      [
        'pizza | yummy',
        '| easy',
        'a | b | c | d',
        'spoon',
        'fork | easy | a1, b2, c3, d4, e5, f6, g7',
      ].join('\n'),
    );
    expect(entries.map((e) => e.word)).toEqual(['spoon']);
    expect(errors).toEqual([
      { line: 1, text: 'pizza | yummy', reason: 'Level must be easy, medium or hard' },
      { line: 2, text: '| easy', reason: 'Word is required' },
      { line: 3, text: 'a | b | c | d', reason: 'Use at most two | per line' },
      {
        line: 5,
        text: 'fork | easy | a1, b2, c3, d4, e5, f6, g7',
        reason: 'Alternates can be at most 6',
      },
    ]);
  });

  it('handles Windows line ends and ignores blank lines', () => {
    expect(parseBulkPaste('cat\r\n\r\ndog\r\n').entries.map((e) => [e.line, e.word])).toEqual([
      [1, 'cat'],
      [3, 'dog'],
    ]);
    expect(parseBulkPaste('   \n\n')).toEqual({ entries: [], errors: [] });
  });

  it('refuses a paste with too many lines as a whole', () => {
    const many = Array.from({ length: 1001 }, (_, i) => `word${i}`).join('\n');
    expect(() => parseBulkPaste(many)).toThrow(AdminEditError);
  });
});

describe('describeIssue', () => {
  it('names the field in words', () => {
    const issues = adminWordBodySchema.safeParse({ word: '', alt: ['ok', ''], difficulty: 5 })
      .error!.issues;
    expect(issues.map(describeIssue)).toEqual([
      { field: 'word', message: 'Word is required' },
      { field: 'difficulty', message: 'Level must be easy, medium or hard' },
      { field: 'alt', message: 'Alternate 2 is required' },
    ]);
  });

  it('names an unknown field', () => {
    const issues = adminWordBodySchema.safeParse({ word: 'cat', gloss: 'x' }).error!.issues;
    expect(describeIssue(issues[0]!)).toEqual({ field: 'gloss', message: 'Unknown field "gloss"' });
  });
});

describe('createCategory', () => {
  it('adds an empty category with an id from the title, off by default and not hidden', () => {
    const { categories, category } = createCategory(CATS, { title: ' Space ', emoji: '🚀' });
    expect(category).toEqual({
      id: 'space',
      title: 'Space',
      emoji: '🚀',
      defaultOn: false,
      hidden: false,
      words: [],
    });
    expect(categories).toEqual([food, animals, category]);
    valid(categories);
  });

  it('keeps ids unique when the title is taken', () => {
    expect(createCategory(CATS, { title: 'Food', emoji: '🍕' }).category.id).toBe('food');
    const once = createCategory(CATS, { title: 'en food', emoji: '🍕' });
    expect(once.category.id).toBe('en-food-2');
  });

  it('takes defaultOn and hidden when given', () => {
    const { category } = createCategory(CATS, {
      title: 'Space',
      emoji: '🚀',
      defaultOn: true,
      hidden: true,
    });
    expect([category.defaultOn, category.hidden]).toEqual([true, true]);
  });
});

describe('patchCategory', () => {
  it('renames, sets the emoji, defaultOn and hidden, and keeps the id and words', () => {
    const { categories, category } = patchCategory(CATS, 'en-food', {
      title: 'Snacks',
      emoji: '🍿',
      defaultOn: false,
      hidden: true,
    });
    expect(category).toEqual({
      ...food,
      title: 'Snacks',
      emoji: '🍿',
      defaultOn: false,
      hidden: true,
    });
    expect(categories[1]).toBe(animals);
    valid(categories);
  });

  it('is 404 for an unknown category', () => {
    const err = refusal(() => patchCategory(CATS, 'nope', { hidden: true }));
    expect([err.status, err.message]).toEqual([404, 'There is no such category.']);
  });
});

describe('deleteCategory', () => {
  it('removes the category and its words', () => {
    expect(deleteCategory(CATS, 'en-food')).toEqual([animals]);
    expect(refusal(() => deleteCategory(CATS, 'nope')).status).toBe(404);
  });
});

describe('addWord', () => {
  it('appends a medium word with no alternates by default, id from the word', () => {
    const { category } = addWord(CATS, 'en-food', { word: 'Ice cream' });
    expect(category.words.at(-1)).toEqual({
      id: 'ice-cream',
      word: 'Ice cream',
      alt: [],
      difficulty: 2,
    });
  });

  it('takes a level and alternates, dropping repeats and the word itself', () => {
    const { category, categories } = addWord(CATS, 'en-food', {
      word: 'french fries',
      difficulty: 1,
      alt: ['fries', 'chips', 'Fries', 'French-fries'],
    });
    expect(category.words.at(-1)).toEqual({
      id: 'french-fries',
      word: 'french fries',
      alt: ['fries', 'chips'],
      difficulty: 1,
    });
    valid(categories);
  });

  it('refuses a word already in the category (409), naming the word field', () => {
    const err = refusal(() => addWord(CATS, 'en-food', { word: 'Doughnut!' }));
    expect([err.status, err.field, err.message]).toEqual([
      409,
      'word',
      'Word "Doughnut!" is already in this category',
    ]);
  });

  it('allows a word that another category has', () => {
    const { category } = addWord(CATS, 'en-food', { word: 'cat' });
    expect(category.words.at(-1)!.word).toBe('cat');
  });

  it('runs the store word rules and names the field', () => {
    const word = refusal(() => addWord(CATS, 'en-food', { word: 'a b' }));
    expect([word.status, word.field]).toEqual([400, 'word']);
    expect(word.message).toMatch(/^Word must keep at least 3 letters/);
    const alt = refusal(() => addWord(CATS, 'en-food', { word: 'pancake', alt: ['crepe', '!!'] }));
    expect([alt.status, alt.field]).toEqual([400, 'alt']);
    expect(alt.message).toMatch(/^Alternate 2 must keep at least 3 letters/);
  });

  it('gives a word whose id is taken a fresh one', () => {
    // A renamed word keeps its id, so a new word can want the same one.
    const renamed = patchWord(CATS, 'en-food', 'doughnut', { word: 'cruller' });
    const { category } = addWord(renamed.categories, 'en-food', { word: 'doughnut' });
    expect(category.words.at(-1)!.id).toBe('doughnut-2');
  });

  it('is 404 for an unknown category', () => {
    expect(refusal(() => addWord(CATS, 'nope', { word: 'cat' })).status).toBe(404);
  });
});

describe('patchWord', () => {
  it('edits the word, level and alternates and keeps its id', () => {
    const { category } = patchWord(CATS, 'en-food', 'doughnut', {
      word: 'donut',
      difficulty: 3,
      alt: ['doughnut'],
    });
    expect(category.words[0]).toEqual({
      id: 'doughnut',
      word: 'donut',
      alt: ['doughnut'],
      difficulty: 3,
    });
  });

  it('keeps the parts it is not given', () => {
    const { category } = patchWord(CATS, 'en-food', 'doughnut', { difficulty: 2 });
    expect(category.words[0]).toEqual({ ...food.words[0], difficulty: 2 });
  });

  it('refuses to turn a word into another word of the category', () => {
    const err = refusal(() => patchWord(CATS, 'en-food', 'doughnut', { word: 'Birthday Cake' }));
    expect([err.status, err.field]).toEqual([409, 'word']);
  });

  it('may keep its own word with a new spelling of case', () => {
    expect(
      patchWord(CATS, 'en-food', 'doughnut', { word: 'Doughnut' }).category.words[0]!.word,
    ).toBe('Doughnut');
  });

  it('is 404 for an unknown word or category', () => {
    expect(refusal(() => patchWord(CATS, 'en-food', 'nope', { difficulty: 1 })).message).toBe(
      'There is no such word in this category.',
    );
    expect(refusal(() => patchWord(CATS, 'nope', 'cat', { difficulty: 1 })).status).toBe(404);
  });
});

describe('deleteWord', () => {
  it('removes one word', () => {
    const { category } = deleteWord(CATS, 'en-food', 'doughnut');
    expect(category.words.map((w) => w.id)).toEqual(['birthday-cake']);
    expect(refusal(() => deleteWord(CATS, 'en-food', 'nope')).status).toBe(404);
  });
});

describe('addBulk', () => {
  it('adds the good lines, lists the bad ones and counts duplicates within the category', () => {
    const result = addBulk(
      CATS,
      'en-food',
      [
        'pizza | easy | pizza pie',
        'doughnut',
        'hot dog | yummy',
        'Pizza',
        'cat',
        'ab',
        'pancake | hard',
      ].join('\n'),
    );
    expect(result.added).toBe(3);
    expect(result.duplicates).toBe(2);
    expect(result.errors).toEqual([
      { line: 3, text: 'hot dog | yummy', reason: 'Level must be easy, medium or hard' },
      {
        line: 6,
        text: 'ab',
        reason: expect.stringMatching(/^Word must keep at least 3 letters/) as string,
      },
    ]);
    expect(result.category.words.slice(2)).toEqual([
      { id: 'pizza', word: 'pizza', alt: ['pizza pie'], difficulty: 1 },
      { id: 'cat', word: 'cat', alt: [], difficulty: 2 },
      { id: 'pancake', word: 'pancake', alt: [], difficulty: 3 },
    ]);
    valid(result.categories);
  });

  it('adds nothing and changes nothing when every line is bad', () => {
    const result = addBulk(CATS, 'en-food', 'doughnut\n| easy');
    expect([result.added, result.duplicates, result.errors.length]).toEqual([0, 1, 1]);
    expect(result.category).toBe(food);
  });

  it('is 404 for an unknown category', () => {
    expect(refusal(() => addBulk(CATS, 'nope', 'cat')).status).toBe(404);
  });
});
