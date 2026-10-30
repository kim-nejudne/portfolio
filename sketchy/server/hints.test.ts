import { describe, expect, it } from 'vitest';
import { hintCap, hintCount, letterIndexes, pickHint } from './hints.js';
import { createRng } from './rng.js';
import { maskWord } from './views.js';

describe('letterIndexes', () => {
  it('lists the positions the mask blanks, skipping spaces, hyphens and apostrophes', () => {
    expect(letterIndexes('bahay kubo')).toEqual([0, 1, 2, 3, 4, 6, 7, 8, 9]);
    expect(letterIndexes("jack-o'lantern")).not.toContain(4);
    expect(letterIndexes("jack-o'lantern")).not.toContain(6);
    for (const word of ['bahay kubo', "jack-o'lantern", 'pan de sal', '7-eleven', 'piña']) {
      const blanks = maskWord(word, []).flatMap((ch, i) => (ch === '_' ? [i] : []));
      expect(letterIndexes(word)).toEqual(blanks);
    }
  });

  it('counts NFC code points, so a decomposed ñ is one letter', () => {
    expect(letterIndexes('piña')).toEqual([0, 1, 2, 3]);
  });
});

describe('hintCap', () => {
  it('gives no hints under 4 letters', () => {
    expect(hintCap('cat')).toBe(0);
    expect(hintCap('ox')).toBe(0);
    // Spaces don't count: 3 letters.
    expect(hintCap('a b c')).toBe(0);
  });

  it('caps hints at a third of the letters, rounded down', () => {
    expect(hintCap('tree')).toBe(1);
    expect(hintCap('apple')).toBe(1);
    expect(hintCap('banana')).toBe(2);
    expect(hintCap('bahay kubo')).toBe(3);
    expect(hintCap('umbrella')).toBe(2);
  });
});

describe('hintCount', () => {
  it('is one per mark (50% and 75%), but never past the cap', () => {
    expect(hintCount('cat')).toBe(0);
    expect(hintCount('tree')).toBe(1);
    expect(hintCount('banana')).toBe(2);
    expect(hintCount('bahay kubo')).toBe(2);
  });
});

describe('pickHint', () => {
  it('picks an unrevealed letter, never a space', () => {
    for (let seed = 0; seed < 200; seed++) {
      const index = pickHint('bahay kubo', [], createRng(seed))!;
      expect(letterIndexes('bahay kubo')).toContain(index);
    }
  });

  it('never repeats a revealed letter', () => {
    for (let seed = 0; seed < 200; seed++) {
      const index = pickHint('banana', [0], createRng(seed));
      expect(index).not.toBe(0);
      expect(index).not.toBeNull();
    }
  });

  it('returns null once the cap is reached', () => {
    expect(pickHint('tree', [2], createRng(1))).toBeNull();
    expect(pickHint('banana', [0, 3], createRng(1))).toBeNull();
    expect(pickHint('cat', [], createRng(1))).toBeNull();
  });

  it('is deterministic for a seed and covers every letter over many seeds', () => {
    expect(pickHint('umbrella', [], createRng(7))).toBe(pickHint('umbrella', [], createRng(7)));
    const seen = new Set<number>();
    for (let seed = 0; seed < 500; seed++) seen.add(pickHint('umbrella', [], createRng(seed))!);
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});
