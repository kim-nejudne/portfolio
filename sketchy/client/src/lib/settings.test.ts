import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../shared/constants.js';
import { loadCategoryPick, presetOf, saveCategoryPick, toggleCategory } from './settings.js';

describe('presetOf', () => {
  it('names Classic for the defaults', () => {
    expect(presetOf(DEFAULT_SETTINGS)).toBe('classic');
  });

  it('names Quick and Party Night from their time, rounds and hints', () => {
    expect(presetOf({ ...DEFAULT_SETTINGS, drawSeconds: 45, cycles: 1 })).toBe('quick');
    expect(presetOf({ ...DEFAULT_SETTINGS, drawSeconds: 80, cycles: 3 })).toBe('partyNight');
  });

  it('ignores the settings no preset sets', () => {
    expect(
      presetOf({ ...DEFAULT_SETTINGS, difficulty: 'easy', categories: ['x'], guessFeed: 'off' }),
    ).toBe('classic');
  });

  it('is null once a preset value is changed by hand', () => {
    expect(presetOf({ ...DEFAULT_SETTINGS, drawSeconds: 100 })).toBeNull();
    expect(presetOf({ ...DEFAULT_SETTINGS, hints: false })).toBeNull();
  });
});

describe('the host’s category pick (F78)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function memoryStorage() {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  }

  it('a tap adds a category at the end or takes it out', () => {
    expect(toggleCategory(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(toggleCategory(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('remembers the last pick on this device', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(loadCategoryPick()).toBeNull();
    saveCategoryPick(['en-food', 'en-animals']);
    expect(loadCategoryPick()).toEqual(['en-food', 'en-animals']);
    // An empty pick could never start a game without custom words: the next room gets the defaults.
    saveCategoryPick([]);
    expect(loadCategoryPick()).toBeNull();
  });

  it('keeps only ids POST /api/rooms accepts, so a stored pick never blocks a new room', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    storage.setItem('sketchy:categories', JSON.stringify(['ok', 3, '', 'x'.repeat(41), 'fine']));
    expect(loadCategoryPick()).toEqual(['ok', 'fine']);
    storage.setItem(
      'sketchy:categories',
      JSON.stringify(Array.from({ length: 150 }, (_, i) => `c${i}`)),
    );
    expect(loadCategoryPick()).toHaveLength(100);
    storage.setItem('sketchy:categories', '{not json');
    expect(loadCategoryPick()).toBeNull();
    storage.setItem('sketchy:categories', '{"a":1}');
    expect(loadCategoryPick()).toBeNull();
  });

  it('fails quietly when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadCategoryPick()).toBeNull();
    expect(() => saveCategoryPick(['a'])).not.toThrow();
  });
});
