// The CategoryStore → room helpers (F78): the lobby's picker list, a new room's default pick and
// the game's frozen snapshot (Room state, Categories at game start; Words, Word selection).
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { seedCategories, type Category } from './categoryStore.js';
import { allowedWords } from './deck.js';
import { loadPacks } from './packs.js';
import {
  buildSnapshot,
  defaultCategoryIds,
  lobbyCategories,
  resolveCategoryIds,
} from './snapshot.js';

const word = (id: string, w: string, difficulty: 1 | 2 | 3 = 1, alt: string[] = []) => ({
  id,
  word: w,
  alt,
  difficulty,
});

function category(id: string, title: string, extra: Partial<Category> = {}): Category {
  return {
    id,
    title,
    emoji: '🎨',
    defaultOn: true,
    hidden: false,
    words: [word('a', `${id}-a`), word('b', `${id}-b`, 2)],
    ...extra,
  };
}

// Store order is not title order: Zoo, Food (hidden), Animals, Spicy (off by default).
const STORE: Category[] = [
  category('zoo', 'Zoo'),
  category('food', 'Food', { hidden: true }),
  category('animals', 'Animals', { emoji: '🐾' }),
  category('spicy', 'Spicy', { defaultOn: false }),
];

describe('lobbyCategories: the picker list', () => {
  it('lists the visible categories in title order, with their word count and no words', () => {
    expect(lobbyCategories(STORE)).toEqual([
      { id: 'animals', title: 'Animals', emoji: '🐾', wordCount: 2, defaultOn: true },
      { id: 'spicy', title: 'Spicy', emoji: '🎨', wordCount: 2, defaultOn: false },
      { id: 'zoo', title: 'Zoo', emoji: '🎨', wordCount: 2, defaultOn: true },
    ]);
    expect(JSON.stringify(lobbyCategories(STORE))).not.toMatch(/food|-a|-b|hidden/);
  });
});

describe("a new room's categories", () => {
  it('defaults to every visible defaultOn category, in title order', () => {
    expect(defaultCategoryIds(STORE)).toEqual(['animals', 'zoo']);
  });

  it("takes the host's remembered pick, ignoring ids that no longer exist or are hidden", () => {
    expect(resolveCategoryIds(STORE, ['spicy', 'gone', 'food', 'zoo'])).toEqual(['spicy', 'zoo']);
  });

  it('falls back to the defaults when nothing of the pick is left, or there is none', () => {
    expect(resolveCategoryIds(STORE, ['gone', 'food'])).toEqual(['animals', 'zoo']);
    expect(resolveCategoryIds(STORE, [])).toEqual(['animals', 'zoo']);
    expect(resolveCategoryIds(STORE, undefined)).toEqual(['animals', 'zoo']);
  });

  it('seeds Spicy off and every family pack on from the shipped packs', () => {
    const shipped = seedCategories(
      loadPacks(fileURLToPath(new URL('../data/packs', import.meta.url))),
    );
    const ids = defaultCategoryIds(shipped);
    expect(ids).not.toContain('en-spicy');
    expect(ids).toHaveLength(shipped.length - 1);
  });
});

describe('buildSnapshot: the game’s words', () => {
  it('keeps the chosen visible categories in title order, dropping deleted and hidden ids', () => {
    const snap = buildSnapshot(STORE, ['zoo', 'food', 'gone', 'animals']);
    expect(snap.categories).toEqual([
      { id: 'animals', title: 'Animals', emoji: '🐾' },
      { id: 'zoo', title: 'Zoo', emoji: '🎨' },
    ]);
    expect(snap.words.map((w) => w.id)).toEqual(['animals/a', 'animals/b', 'zoo/a', 'zoo/b']);
    expect(snap.words[0]).toEqual({
      id: 'animals/a',
      word: 'animals-a',
      alt: [],
      difficulty: 1,
      lang: 'en',
      categoryId: 'animals',
    });
  });

  it('is empty when no chosen category is left', () => {
    expect(buildSnapshot(STORE, ['food', 'gone'])).toEqual({ categories: [], words: [] });
  });

  it('keeps one copy of each normalised word, from the first category in title order', () => {
    const pets = category('pets', 'Pets', {
      words: [word('cat', 'The Cat', 3, ['kitty']), word('dog', 'dog')],
    });
    const animals = category('animals', 'Animals', {
      words: [word('cat', 'cat'), word('ice', 'ice-cream')],
    });
    const food = category('food', 'Food', { words: [word('ice', 'Ice cream', 2)] });
    const snap = buildSnapshot([pets, food, animals], ['pets', 'food', 'animals']);
    expect(snap.words.map((w) => [w.id, w.categoryId])).toEqual([
      ['animals/cat', 'animals'],
      ['animals/ice', 'animals'],
      ['pets/dog', 'pets'],
    ]);
  });

  it('is frozen, so a later store edit never changes a running game’s words', () => {
    const store: Category[] = [category('zoo', 'Zoo')];
    const snap = buildSnapshot(store, ['zoo']);
    const before = JSON.stringify(snap);
    // The admin edits the category after the game started: words, title and all.
    store[0] = { ...store[0]!, title: 'Renamed', words: [word('z', 'zebra')] };
    store.push(category('extra', 'Extra'));
    expect(JSON.stringify(snap)).toBe(before);
    expect(allowedWords(snap.words, 'mixed').map((w) => w.word)).toEqual(['zoo-a', 'zoo-b']);
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.words)).toBe(true);
    expect(Object.isFrozen(snap.words[0])).toBe(true);
    expect(Object.isFrozen(snap.words[0]!.alt)).toBe(true);
    expect(Object.isFrozen(snap.categories[0])).toBe(true);
  });

  it('deals the shipped spicy words only when Spicy is ticked', () => {
    const shipped = seedCategories(
      loadPacks(fileURLToPath(new URL('../data/packs', import.meta.url))),
    );
    const isSpicy = (w: { categoryId: string | null }) => w.categoryId === 'en-spicy';
    const byDefault = buildSnapshot(shipped, defaultCategoryIds(shipped));
    expect(byDefault.words.length).toBeGreaterThan(300);
    expect(byDefault.words.filter(isSpicy)).toEqual([]);
    const withSpicy = buildSnapshot(shipped, [...defaultCategoryIds(shipped), 'en-spicy']);
    expect(withSpicy.words.filter(isSpicy).length).toBeGreaterThanOrEqual(60);
    expect(withSpicy.words.every((w) => w.lang === 'en')).toBe(true);
  });
});
