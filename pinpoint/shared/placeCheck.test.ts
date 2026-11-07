import { describe, expect, it } from 'vitest';
import type { Place } from '#shared/types.js';
import { categoryOffered, placeShortfall, shortText } from '#shared/placeCheck.js';

const japan = {
  name: 'Japan',
  counts: {
    easy: { city: 30, landmark: 6 },
    medium: { city: 12, landmark: 1 },
    hard: { city: 8, landmark: 0 },
  },
};

describe('placeShortfall', () => {
  it('passes when every level the plan needs has enough places', () => {
    expect(placeShortfall(japan, 'name', 'easy', 15)).toBeNull();
    expect(placeShortfall(japan, 'name', 'mixed', 15)).toBeNull(); // 5 · 5 · 5
    expect(placeShortfall(japan, 'name', 'hard', 5)).toBeNull();
  });

  it('names the level, its count and the rounds it needs for one level', () => {
    expect(placeShortfall(japan, 'name', 'hard', 10)).toBe(
      'Japan · Hard has 8 cities; this game needs 10.',
    );
    expect(placeShortfall(japan, 'picture', 'easy', 10)).toBe(
      'Japan · Easy has 6 landmarks; this game needs 10.',
    );
    expect(placeShortfall(japan, 'picture', 'medium', 5)).toBe(
      'Japan · Medium has 1 landmark; this game needs 5.',
    );
  });

  it("checks each level's share of a Mixed game, first short level first", () => {
    // Mixed 5 needs 2 easy, 1 medium, 2 hard.
    expect(placeShortfall(japan, 'picture', 'mixed', 5)).toBe(
      'Japan · Hard has 0 landmarks; this game needs 2.',
    );
    const thin = { name: 'Alps', counts: { easy: { city: 2, landmark: 0 } } };
    expect(placeShortfall(thin, 'name', 'mixed', 10)).toBe(
      'Alps · Easy has 2 cities; this game needs 3.',
    );
  });
});

describe('categoryOffered', () => {
  it('needs MIN_PLACES_TO_OFFER places at some level in the mode', () => {
    expect(categoryOffered(japan, 'name')).toBe(true);
    expect(categoryOffered(japan, 'picture')).toBe(true); // easy has 6
    expect(categoryOffered({ name: 'X', counts: { hard: { city: 4, landmark: 9 } } }, 'name')).toBe(
      false,
    );
  });
});

describe('shortText', () => {
  const at = (kind: 'city' | 'landmark', n: number) =>
    Array.from({ length: n }, () => ({ kind }) as Place);

  it('names each short mode as "12 of 15 landmarks", and nothing for a full level', () => {
    expect(
      shortText({ places: [...at('city', 15), ...at('landmark', 12)], short: { landmark: 15 } }),
    ).toEqual(['12 of 15 landmarks']);
    expect(shortText({ places: [], short: { city: 1, landmark: 5 } })).toEqual([
      '0 of 1 city',
      '0 of 5 landmarks',
    ]);
    expect(shortText({ places: at('city', 15) })).toEqual([]);
  });
});
