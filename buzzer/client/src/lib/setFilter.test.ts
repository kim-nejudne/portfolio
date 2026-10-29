import { describe, expect, it } from 'vitest';
import { BUILT_IN_SETS } from '../../../shared/builtInSets.js';
import type { Difficulty, QuestionSet } from '../../../shared/types.js';
import { filterSets, groupByCategory, NO_CATEGORY, type SetFilter } from './setFilter.js';

function set(id: string, title: string, category?: string, difficulty?: Difficulty): QuestionSet {
  return {
    id,
    title,
    questions: [],
    createdAt: 1,
    updatedAt: 1,
    schemaVersion: 1,
    ...(category === undefined ? {} : { category }),
    ...(difficulty === undefined ? {} : { difficulty }),
  };
}

const ALL: SetFilter = { query: '', difficulties: [] };
const titles = (sets: readonly QuestionSet[]) => sets.map((s) => s.title);

describe('filterSets search', () => {
  const sets = [
    set('a', 'Pub quiz'),
    set('b', 'Birds', 'Animals', 'easy'),
    set('c', 'Kapitbahay trivia', 'Philippine TV & Pop Culture'),
  ];

  it('keeps every set for an empty or blank search', () => {
    expect(titles(filterSets(sets, ALL))).toEqual(['Pub quiz', 'Birds', 'Kapitbahay trivia']);
    expect(titles(filterSets(sets, { ...ALL, query: '   ' }))).toHaveLength(3);
  });

  it('matches the title or the category, ignoring case', () => {
    expect(titles(filterSets(sets, { ...ALL, query: 'PUB' }))).toEqual(['Pub quiz']);
    expect(titles(filterSets(sets, { ...ALL, query: 'animals' }))).toEqual(['Birds']);
  });

  it('needs every word somewhere in the title or the category', () => {
    expect(titles(filterSets(sets, { ...ALL, query: 'pop trivia' }))).toEqual([
      'Kapitbahay trivia',
    ]);
    expect(filterSets(sets, { ...ALL, query: 'pop quiz' })).toEqual([]);
  });

  it('ignores accents on both sides', () => {
    const accented = [set('p', 'Pokémon Quiz'), set('q', 'Cafe culture', 'Kultura')];
    expect(titles(filterSets(accented, { ...ALL, query: 'pokemon' }))).toEqual(['Pokémon Quiz']);
    expect(titles(filterSets(accented, { ...ALL, query: 'CAFÉ' }))).toEqual(['Cafe culture']);
  });
});

describe('filterSets difficulty chips', () => {
  const sets = [
    set('e', 'Easy one', undefined, 'easy'),
    set('m', 'Medium one', undefined, 'medium'),
    set('h', 'Hard one', undefined, 'hard'),
    set('n', 'No level'),
  ];

  it('keeps every difficulty when no chip is on', () => {
    expect(filterSets(sets, ALL)).toHaveLength(4);
  });

  it('keeps sets at any chosen difficulty', () => {
    const picked = filterSets(sets, { ...ALL, difficulties: ['easy', 'hard'] });
    expect(titles(picked)).toEqual(['Easy one', 'Hard one']);
  });

  it('None keeps the sets without a difficulty', () => {
    expect(titles(filterSets(sets, { ...ALL, difficulties: ['none'] }))).toEqual(['No level']);
    const both = filterSets(sets, { ...ALL, difficulties: ['medium', 'none'] });
    expect(titles(both)).toEqual(['Medium one', 'No level']);
  });

  it('combines with the search', () => {
    const picked = filterSets(sets, { query: 'one', difficulties: ['easy', 'none'] });
    expect(titles(picked)).toEqual(['Easy one']);
  });
});

describe('filterSets on the built-in library', () => {
  it('"animal" at Easy leaves only Animals – Easy', () => {
    const picked = filterSets(BUILT_IN_SETS, { query: 'animal', difficulties: ['easy'] });
    expect(titles(picked)).toEqual(['Animals – Easy']);
  });

  it('"anim" at Easy also finds Anime & Manga – Easy (DECISIONS F55)', () => {
    const picked = filterSets(BUILT_IN_SETS, { query: 'anim', difficulties: ['easy'] });
    expect(titles(picked)).toEqual(['Animals – Easy', 'Anime & Manga – Easy']);
  });

  it('None keeps only the sample among the built-ins', () => {
    expect(titles(filterSets(BUILT_IN_SETS, { ...ALL, difficulties: ['none'] }))).toEqual([
      'Sample: General Knowledge',
    ]);
  });
});

describe('groupByCategory', () => {
  it('groups by category, in the order each first appears, keeping the list order', () => {
    const groups = groupByCategory([
      set('1', 'Cats', 'Animals'),
      set('2', 'Tagalog films', 'Movies'),
      set('3', 'Dogs', 'Animals'),
      set('4', 'Oscars', 'Movies'),
    ]);
    expect(groups.map((g) => [g.category, titles(g.sets)])).toEqual([
      ['Animals', ['Cats', 'Dogs']],
      ['Movies', ['Tagalog films', 'Oscars']],
    ]);
  });

  it(`puts sets without a category under "${NO_CATEGORY}", where the first of them stood`, () => {
    const groups = groupByCategory([
      set('1', 'Pub quiz'),
      set('2', 'Cats', 'Animals'),
      set('3', 'Blank category', '  '),
    ]);
    expect(groups.map((g) => [g.category, titles(g.sets)])).toEqual([
      [NO_CATEGORY, ['Pub quiz', 'Blank category']],
      ['Animals', ['Cats']],
    ]);
  });

  it(`puts a set whose category is "${NO_CATEGORY}" in the same group as the uncategorised ones`, () => {
    const groups = groupByCategory([set('1', 'Pub quiz'), set('2', 'Misc', 'other')]);
    expect(groups.map((g) => [g.category, titles(g.sets)])).toEqual([
      [NO_CATEGORY, ['Pub quiz', 'Misc']],
    ]);
  });

  it('treats spellings that differ only in case or spaces as one category, under the first', () => {
    const groups = groupByCategory([set('1', 'A', 'Science '), set('2', 'B', 'science')]);
    expect(groups.map((g) => [g.category, titles(g.sets)])).toEqual([['Science', ['A', 'B']]]);
  });

  it('keeps the built-in order: the sample, then each category at Easy, Medium and Hard', () => {
    const groups = groupByCategory(BUILT_IN_SETS);
    expect(groups).toHaveLength(21);
    expect(groups[0]).toEqual({ category: NO_CATEGORY, sets: [BUILT_IN_SETS[0]] });
    expect(titles(groups[1]!.sets)).toEqual([
      'Animals – Easy',
      'Animals – Medium',
      'Animals – Hard',
    ]);
    expect(groups.flatMap((g) => g.sets)).toEqual(BUILT_IN_SETS);
  });

  it('returns no groups for no sets', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
