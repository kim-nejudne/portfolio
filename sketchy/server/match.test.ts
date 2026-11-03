import { describe, expect, it } from 'vitest';
import { GUESS_MAX } from '../shared/constants.js';
import type { WordEntry } from '../shared/types.js';
import {
  acceptedForms,
  editDistance,
  guessRejection,
  isClose,
  isCorrect,
  matchGuess,
  normalize,
} from './match.js';

const entry = (word: string, alt: string[], lang: WordEntry['lang']): WordEntry => ({
  id: `test/${word}`,
  categoryId: null,
  word,
  alt,
  difficulty: 1,
  lang,
});

const umbrella = entry('umbrella', ['brolly'], 'en');
const iceCream = entry('ice cream', ['icecream'], 'en');
const airplane = entry('airplane', ['aeroplane', 'plane'], 'en');
const doughnut = entry('doughnut', ['donut'], 'en');
const mango = entry('mango', [], 'en');
const jalapeno = entry('jalapeño', [], 'en');
const pizzaNight = entry('pizza night', [], 'custom');
const slippers = entry('slippers', ['flip-flops', 'sandals'], 'en');

describe('the matcher table (Test plan)', () => {
  it.each([
    [umbrella, 'Umbrella', 'correct'],
    [umbrella, 'the umbrella!', 'correct'],
    [umbrella, 'umbrellas', 'correct'], // plural
    [umbrella, 'brolly', 'correct'],
    [umbrella, 'umbrela', 'close'],
    [umbrella, 'umbrella hat', 'close'],
    [umbrella, 'raincoat', 'wrong'],
    [iceCream, 'ice-cream', 'correct'],
    [iceCream, 'ICECREAM', 'correct'],
    [iceCream, 'ice', 'wrong'], // shorter than 60%
    [airplane, 'aeroplane', 'correct'], // UK spelling
    [airplane, 'planes', 'correct'], // plural
    [doughnut, 'donuts', 'correct'], // plural of an alternate
    [doughnut, 'dougnut', 'close'],
    [mango, 'mangoes', 'correct'], // plural
    [mango, 'manga', 'close'],
    [jalapeno, 'jalapeno', 'correct'], // accents stripped
    [pizzaNight, 'pizza nights', 'close'], // no plural rule for custom words
  ] as const)('%# %o: %s is %s', (word, guess, expected) => {
    expect(matchGuess(guess, word)).toBe(expected);
    expect(isCorrect(guess, word)).toBe(expected === 'correct');
    if (expected !== 'correct') expect(isClose(guess, word)).toBe(expected === 'close');
  });

  it('rejects an empty guess (any word)', () => {
    expect(guessRejection('   ')).toBe('emptyGuess');
    expect(guessRejection('')).toBe('emptyGuess');
  });

  it('rejects a guess of 41 characters (any word) and takes one of 40', () => {
    expect(guessRejection('a'.repeat(GUESS_MAX + 1))).toBe('guessTooLong');
    expect(guessRejection('a'.repeat(GUESS_MAX))).toBeNull();
    // Counted after trimming, as the schema counts it.
    expect(guessRejection(` ${'a'.repeat(GUESS_MAX)} `)).toBeNull();
  });
});

describe('normalize', () => {
  it('makes "Ice cream!", "ice-cream" and "ICECREAM" all icecream', () => {
    for (const s of ['Ice cream!', 'ice-cream', 'ICECREAM']) expect(normalize(s)).toBe('icecream');
    expect(normalize('the umbrella')).toBe('umbrella');
  });

  it('strips accents and combining marks (ñ → n, é → e)', () => {
    expect(normalize('Niño')).toBe('nino');
    expect(normalize('café')).toBe('cafe');
    expect(normalize('ñ')).toBe('n');
  });

  it('turns punctuation, apostrophes and emoji into spaces, then drops the spaces', () => {
    expect(normalize("  rock 'n' roll 🎸 ")).toBe('rocknroll');
    expect(normalize('ice\tcream\n')).toBe('icecream');
  });

  it('drops the leading fillers the, a and an repeatedly, but not later ones', () => {
    expect(normalize('the slippers')).toBe('slippers');
    expect(normalize('The a an mango')).toBe('mango');
    expect(normalize('an apple')).toBe('apple');
    expect(normalize('apple the')).toBe('applethe');
    expect(normalize('cat in the hat')).toBe('catinthehat');
  });

  it('drops only English fillers: other short words stay', () => {
    for (const word of ['ang', 'si', 'mga', 'ng', 'isang'])
      expect(normalize(`${word} mango`), word).toBe(`${word}mango`);
  });

  it('keeps a filler that is only the start of a word', () => {
    expect(normalize('angel')).toBe('angel');
    expect(normalize('the-angel')).toBe('angel');
    expect(normalize('anchor')).toBe('anchor');
    expect(normalize('theater')).toBe('theater');
  });

  it('keeps digits and letters of other scripts', () => {
    expect(normalize('7-Eleven')).toBe('7eleven');
    expect(normalize('ПРИВЕТ')).toBe('привет');
  });

  it('is empty for nothing but fillers, punctuation or emoji', () => {
    expect(normalize('the')).toBe('');
    expect(normalize('the an a')).toBe('');
    expect(normalize('?!🙂')).toBe('');
  });
});

describe('accepting a guess', () => {
  it('accepts the word and each alternate, normalised, and drops empty forms', () => {
    expect(acceptedForms(slippers)).toEqual(['slippers', 'flipflops', 'sandals']);
    expect(acceptedForms(entry('mango', ['the', '!!'], 'en'))).toEqual(['mango']);
  });

  it('takes a plural s or es on any accepted form of an English word only', () => {
    expect(isCorrect('brollys', umbrella)).toBe(true);
    expect(isCorrect('mangos', mango)).toBe(true);
    expect(isCorrect('the umbrellas!', umbrella)).toBe(true);
    expect(isCorrect('pizza nights', pizzaNight)).toBe(false);
    expect(isCorrect('mangoess', mango)).toBe(false);
    expect(isCorrect('mangoz', mango)).toBe(false);
    expect(isCorrect('custom words', entry('custom word', [], 'custom'))).toBe(false);
  });

  it('never accepts an empty guess, even against a word that normalises to nothing', () => {
    const empty = entry('the', [], 'en');
    expect(isCorrect('', empty)).toBe(false);
    expect(isCorrect('the', empty)).toBe(false);
    expect(isCorrect('s', empty)).toBe(false);
    expect(isClose('the', empty)).toBe(false);
    expect(isClose('anything', empty)).toBe(false);
  });
});

describe('near misses', () => {
  it('allows 1 edit for forms of up to 6 letters and 2 from 7', () => {
    const seven = entry('buffalo', [], 'en'); // 7 letters
    expect(isClose('bufalo', seven)).toBe(true); // 1 deletion
    expect(isClose('bufal', seven)).toBe(true); // 2
    expect(isClose('bfal', seven)).toBe(false); // 3
    const six = entry('banana', [], 'en'); // 6 letters
    expect(isClose('banan', six)).toBe(true);
    expect(isClose('bnan', six)).toBe(false); // 2 edits
  });

  it('counts a swap of two neighbouring letters as one edit', () => {
    expect(editDistance('mango', 'mnago')).toBe(1);
    expect(isClose('mnago', mango)).toBe(true);
    expect(editDistance('abc', 'ca')).toBe(3); // optimal string alignment
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('kitten', 'sitting')).toBe(3);
  });

  it('is close when the guess contains a form, or is at least 4 letters and 60% of it', () => {
    const lighthouse = entry('lighthouse', [], 'en'); // 10 letters: 6 needed
    expect(isClose('big lighthouse', lighthouse)).toBe(true);
    expect(isClose('lighth', lighthouse)).toBe(true); // 6 of 10
    expect(isClose('lightho', lighthouse)).toBe(true);
    expect(isClose('light', lighthouse)).toBe(false); // 5 of 10
    const pan = entry('pan', [], 'en');
    expect(isClose('pancake', pan)).toBe(true);
    expect(isClose('pa', pan)).toBe(true); // 1 edit
    const cave = entry('cavern', [], 'en');
    expect(isClose('cave', cave)).toBe(true); // 4 letters, 67%
    expect(isClose('ave', cave)).toBe(false); // 3 letters
  });

  it('matches against every accepted form, normalised', () => {
    expect(isClose('slipper', slippers)).toBe(true);
    expect(isClose('Flip-Flop!', slippers)).toBe(true);
    expect(isClose('brolli', umbrella)).toBe(true);
  });

  it('says correct, not close, for a correct guess', () => {
    expect(matchGuess('sandals', slippers)).toBe('correct');
    expect(matchGuess('umbrellas', umbrella)).toBe('correct');
  });
});
