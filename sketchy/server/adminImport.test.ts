// Export and import (F82; spec: Admin, Category editor; Word pack format): a category as a pack
// file and back, a repo pack (with its `rating`) importing as a category, the id clash (ask, then
// rename or replace), and invalid files refused with the store's own messages.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ADMIN_IMPORT_ISSUES_MAX } from '../shared/constants.js';
import {
  AdminEditError,
  AdminImportError,
  categoryToPack,
  copyTitle,
  importCategory,
} from './adminCategories.js';
import { categoriesFileSchema, seedCategories, type Category } from './categoryStore.js';
import { loadPacks, packFileSchema, packsDirFor } from './packs.js';
import { TEST_CATEGORIES } from './test/packs.js';

const REPO_PACKS = packsDirFor(import.meta.url, false);
const repoPack = (id: string): unknown =>
  JSON.parse(readFileSync(`${REPO_PACKS}/${id}.json`, 'utf8')) as unknown;

const SPACE: Category = {
  id: 'space',
  title: 'Space',
  emoji: '🚀',
  defaultOn: true,
  hidden: true,
  words: [
    { id: 'rocket', word: 'rocket', alt: [], difficulty: 1 },
    { id: 'astronaut', word: 'astronaut', alt: ['spaceman', 'cosmonaut'], difficulty: 3 },
  ],
};

/** The thrown error, for its fields. */
function refusal(run: () => unknown): AdminImportError {
  try {
    run();
  } catch (err) {
    expect(err).toBeInstanceOf(AdminImportError);
    return err as AdminImportError;
  }
  throw new Error('expected a refusal');
}

const valid = (categories: readonly Category[]) =>
  expect(categoriesFileSchema.safeParse({ version: 1, categories }).success).toBe(true);

describe('categoryToPack', () => {
  it('is the pack format: schemaVersion 1, language en, no rating, no emoji or flags', () => {
    expect(categoryToPack(SPACE)).toEqual({
      schemaVersion: 1,
      id: 'space',
      title: 'Space',
      language: 'en',
      words: [
        { id: 'rocket', word: 'rocket', difficulty: 1 },
        { id: 'astronaut', word: 'astronaut', alt: ['spaceman', 'cosmonaut'], difficulty: 3 },
      ],
    });
  });

  it('with a rating added, is a valid seed pack (packs:check’s schema)', () => {
    const pack = categoryToPack(SPACE);
    expect(packFileSchema.safeParse({ ...pack, rating: 'family' }).success).toBe(true);
  });

  it('gives plain copies, not the store’s frozen arrays', () => {
    const frozen = Object.freeze({ ...SPACE, words: Object.freeze([...SPACE.words]) });
    const pack = categoryToPack(frozen as Category);
    expect(Object.isFrozen(pack.words)).toBe(false);
  });
});

describe('copyTitle', () => {
  it('adds " (copy)", cutting a long title to stay within 40 characters', () => {
    expect(copyTitle('Food')).toBe('Food (copy)');
    const long = copyTitle('x'.repeat(40));
    expect(long).toHaveLength(40);
    expect(long.endsWith(' (copy)')).toBe(true);
  });
});

describe('importCategory', () => {
  it('export then import round trip: the same id, title and words', () => {
    const file = JSON.parse(JSON.stringify(categoryToPack(SPACE))) as unknown;
    const { categories, category, replaced } = importCategory(TEST_CATEGORIES, file);
    expect(replaced).toBe(false);
    expect(category).toEqual({
      ...SPACE,
      // Emoji and flags are not in a pack: a new category gets 🎨, off and visible.
      emoji: '🎨',
      defaultOn: false,
      hidden: false,
    });
    expect(categories.map((c) => c.id)).toEqual([...TEST_CATEGORIES.map((c) => c.id), 'space']);
    valid(categories);
    // And out again, it is the same file.
    expect(categoryToPack(category)).toEqual(categoryToPack(SPACE));
  });

  it('imports an exported empty category', () => {
    const empty = { ...SPACE, words: [] };
    const { category } = importCategory([], categoryToPack(empty));
    expect(category.words).toEqual([]);
  });

  it('imports a repo pack, its rating ignored, with the seed emoji', () => {
    const raw = repoPack('en-food') as { rating: string; words: unknown[]; title: string };
    expect(raw.rating).toBe('family');
    const { category } = importCategory(TEST_CATEGORIES, raw);
    expect(category).toMatchObject({
      id: 'en-food',
      title: raw.title,
      emoji: '🍔',
      defaultOn: false,
      hidden: false,
    });
    expect(category.words).toHaveLength(raw.words.length);
    expect('rating' in category).toBe(false);
    expect(category.words[0]).toEqual({ id: 'banana', word: 'banana', alt: [], difficulty: 1 });
  });

  it('every repo pack imports into an empty store', () => {
    for (const pack of loadPacks(REPO_PACKS)) {
      const { category } = importCategory([], repoPack(pack.id));
      expect(category.words).toHaveLength(pack.words.length);
    }
  });

  it('drops alternates that repeat, or equal the word, as the editor does', () => {
    const file = categoryToPack(SPACE);
    file.words[1]!.alt = ['spaceman', 'Space-man', 'astronaut', 'cosmonaut'];
    const { category } = importCategory([], file);
    expect(category.words[1]!.alt).toEqual(['spaceman', 'cosmonaut']);
  });

  it('a rating of any value is ignored', () => {
    const file = { ...categoryToPack(SPACE), rating: 'whatever' };
    expect(importCategory([], file).category.id).toBe('space');
  });

  describe('an id clash', () => {
    const store = seedCategories(loadPacks(REPO_PACKS));

    it('asks first: 409 naming the category that has the id, and nothing changes', () => {
      const err = refusal(() => importCategory(store, repoPack('en-food')));
      expect(err.status).toBe(409);
      expect(err.field).toBe('id');
      expect(err.clash).toEqual({ id: 'en-food', title: 'Food and Drinks' });
      expect(err.message).toContain('en-food');
    });

    it('rename: a new id beside the old category, which stays as it was', () => {
      const { categories, category, replaced } = importCategory(
        store,
        repoPack('en-food'),
        'rename',
      );
      expect(replaced).toBe(false);
      expect(category.id).toBe('en-food-2');
      expect(category.title).toBe('Food and Drinks (copy)');
      expect(categories).toHaveLength(store.length + 1);
      expect(categories.find((c) => c.id === 'en-food')).toBe(
        store.find((c) => c.id === 'en-food'),
      );
      expect(categories.at(-1)).toBe(category);
      valid(categories);
      // A second rename takes the next free id.
      expect(importCategory(categories, repoPack('en-food'), 'rename').category.id).toBe(
        'en-food-3',
      );
    });

    it('replace: the file’s title and words, keeping emoji, flags and place', () => {
      const before: Category[] = store.map((c) =>
        c.id === 'en-food' ? { ...c, emoji: '🥐', defaultOn: false, hidden: true } : c,
      );
      const file = { ...categoryToPack(SPACE), id: 'en-food', title: 'New food' };
      const { categories, category, replaced } = importCategory(before, file, 'replace');
      expect(replaced).toBe(true);
      expect(category).toEqual({
        id: 'en-food',
        title: 'New food',
        emoji: '🥐',
        defaultOn: false,
        hidden: true,
        words: SPACE.words,
      });
      expect(categories.map((c) => c.id)).toEqual(before.map((c) => c.id));
      valid(categories);
    });

    it('rename or replace without a clash just imports', () => {
      for (const onClash of ['rename', 'replace'] as const) {
        const { category, replaced } = importCategory([], categoryToPack(SPACE), onClash);
        expect(category.id).toBe('space');
        expect(replaced).toBe(false);
      }
    });
  });

  describe('invalid files are refused with the store’s messages', () => {
    /** A pack file as JSON gives it: any field can be changed or removed. */
    type Json = Record<string, unknown> & { words: Record<string, unknown>[] };
    const base = () => JSON.parse(JSON.stringify(categoryToPack(SPACE))) as Json;

    it.each([
      [
        'a word too short',
        (f: Json) => (f.words[0]!.word = 'ab'),
        'words.0.word: must keep at least 3 letters',
      ],
      ['a word field the format does not have', (f: Json) => (f.words[0]!.gloss = 'x'), 'words.0'],
      ['another language', (f: Json) => (f.language = 'sv'), 'language'],
      ['another schemaVersion', (f: Json) => (f.schemaVersion = 2), 'schemaVersion'],
      ['a bad id', (f: Json) => (f.id = 'Space!'), 'id: use only a-z, 0-9 and -'],
      [
        'a repeated word id',
        (f: Json) => (f.words[1]!.id = 'rocket'),
        'duplicate word id "rocket"',
      ],
      ['a fourth level', (f: Json) => (f.words[0]!.difficulty = 4), 'words.0.difficulty'],
      [
        'seven alternates',
        (f: Json) => (f.words[1]!.alt = ['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff', 'ggg']),
        'words.1.alt',
      ],
      ['an emoji (not in the pack format)', (f: Json) => (f.emoji = '🚀'), 'emoji'],
      ['no title', (f: Json) => delete f.title, 'title'],
    ])('%s', (_name, spoil, line) => {
      const file = base();
      spoil(file);
      const err = refusal(() => importCategory(TEST_CATEGORIES, file));
      expect(err.status).toBe(400);
      expect(err.message).toBe('This file is not a valid category.');
      expect(err.issues!.join('\n')).toContain(line);
    });

    it('a word twice (by normalize) is refused, naming both, as the editor refuses it', () => {
      const file = base();
      file.words.push({ id: 'rocket-2', word: 'Rocket!', difficulty: 2 });
      const err = refusal(() => importCategory([], file));
      expect(err.status).toBe(400);
      expect(err.issues).toEqual(['words.2.word: "Rocket!" repeats words.0']);
    });

    it('quotes the word a problem belongs to, as start-up does', () => {
      const file = base();
      file.words[1]!.alt = ['ok word', 'x'.repeat(31)];
      const err = refusal(() => importCategory([], file));
      expect(err.issues).toContainEqual(expect.stringContaining('words.1.alt.1'));
      expect(err.issues!.join('\n')).toContain('("astronaut")');
    });

    it('lists at most 20 problems, then how many more', () => {
      const file = base();
      file.words = Array.from({ length: 30 }, (_, i) => ({
        id: `w${i}`,
        word: 'ab',
        difficulty: 1,
      }));
      const err = refusal(() => importCategory([], file));
      expect(err.issues).toHaveLength(ADMIN_IMPORT_ISSUES_MAX + 1);
      expect(err.issues!.at(-1)).toBe('…and 10 more.');
    });

    it.each([
      ['null', null],
      ['a string', 'hello'],
      ['a number', 3],
    ])('%s', (_name, raw) => {
      const err = refusal(() => importCategory([], raw));
      expect(err.status).toBe(400);
      expect(err.message).toBe('This file is not a valid category.');
    });

    it('an Export all file (several categories) says to import one category’s file', () => {
      const err = refusal(() => importCategory([], [categoryToPack(SPACE)]));
      expect(err.status).toBe(400);
      expect(err.message).toMatch(/Export all/);
    });

    it('is an AdminEditError, so the routes answer it the same way', () => {
      expect(refusal(() => importCategory([], null))).toBeInstanceOf(AdminEditError);
    });
  });
});
