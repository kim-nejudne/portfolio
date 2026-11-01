import { describe, expect, it } from 'vitest';
import { CUSTOM_WORDS_MAX } from '../../../shared/constants.js';
import { parseCustomWords } from './customWords.js';

describe('parseCustomWords: the custom words box', () => {
  it('splits on lines and commas, trims, and drops blank entries', () => {
    expect(parseCustomWords('Aunt Mabel\n  grandma , grandpa,\n\n, Uncle Joe ')).toEqual({
      ok: true,
      words: ['Aunt Mabel', 'grandma', 'grandpa', 'Uncle Joe'],
    });
    expect(parseCustomWords(' \n , ')).toEqual({ ok: true, words: [] });
  });

  it('names a word over 30 characters', () => {
    const long = 'a'.repeat(31);
    expect(parseCustomWords(`grandma\n${long}`)).toEqual({
      ok: false,
      error: 'tooLong',
      word: long,
    });
    expect(parseCustomWords('a'.repeat(30))).toEqual({ ok: true, words: ['a'.repeat(30)] });
  });

  it(`refuses more than ${CUSTOM_WORDS_MAX} words at once`, () => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(',');
    expect(parseCustomWords(words(CUSTOM_WORDS_MAX + 1))).toEqual({ ok: false, error: 'tooMany' });
    expect(parseCustomWords(words(CUSTOM_WORDS_MAX)).ok).toBe(true);
  });
});
