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
  word,
  alt,
  difficulty: 1,
  lang,
});

const tsinelas = entry('tsinelas', ['chinelas', 'slippers', 'flip-flops'], 'tl');
const haloHalo = entry('halo-halo', [], 'tl');
const umbrella = entry('umbrella', ['payong'], 'en');
const mango = entry('mango', ['mangga'], 'en');
const pila = entry('pila', ['queue', 'line'], 'tl');
const sariSari = entry('sari-sari store', ['sari-sari', 'tindahan'], 'tl');
const kamote = entry('kamote', ['sweet potato'], 'tl');

describe('the matcher table (Test plan)', () => {
  it.each([
    [tsinelas, 'Tsinelas', 'correct'],
    [tsinelas, 'ang tsinelas!', 'correct'],
    [tsinelas, 'flip flops', 'correct'],
    [tsinelas, 'slippers', 'correct'],
    [tsinelas, 'tsinela', 'close'],
    [tsinelas, 'tsinelas ko', 'close'],
    [tsinelas, 'sapatos', 'wrong'],
    [haloHalo, 'halo halo', 'correct'],
    [haloHalo, 'HALOHALO', 'correct'],
    [haloHalo, 'halo', 'wrong'], // shorter than 60%
    [umbrella, 'umbrellas', 'correct'], // plural
    [umbrella, 'payong', 'correct'],
    [umbrella, 'umbrela', 'close'],
    [mango, 'mangoes', 'correct'], // plural
    [mango, 'manga', 'close'],
    [pila, 'lines', 'close'], // no plural rule for tl
    [sariSari, 'sari sari', 'correct'],
    [kamote, 'kamóte', 'correct'], // accents stripped
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
  it('makes "Halo halo!", "halo-halo" and "HALOHALO" all halohalo', () => {
    for (const s of ['Halo halo!', 'halo-halo', 'HALOHALO']) expect(normalize(s)).toBe('halohalo');
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

  it('drops leading filler words repeatedly, but not later ones', () => {
    expect(normalize('ang tsinelas')).toBe('tsinelas');
    expect(normalize('The a an mga mango')).toBe('mango');
    expect(normalize('si isang ng aso')).toBe('aso');
    expect(normalize('apple the')).toBe('applethe');
    expect(normalize('sari-sari ng bayan')).toBe('sarisaringbayan');
  });

  it('keeps a filler that is only the start of a word', () => {
    expect(normalize('angel')).toBe('angel');
    expect(normalize('ang-angel')).toBe('angel');
    expect(normalize('ange l')).toBe('angel');
  });

  it('keeps digits and letters of other scripts', () => {
    expect(normalize('7-Eleven')).toBe('7eleven');
    expect(normalize('ПРИВЕТ')).toBe('привет');
  });

  it('is empty for nothing but fillers, punctuation or emoji', () => {
    expect(normalize('the')).toBe('');
    expect(normalize('ang mga')).toBe('');
    expect(normalize('?!🙂')).toBe('');
  });
});

describe('accepting a guess', () => {
  it('accepts the word and each alternate, normalised, and drops empty forms', () => {
    expect(acceptedForms(tsinelas)).toEqual(['tsinelas', 'chinelas', 'slippers', 'flipflops']);
    expect(acceptedForms(entry('mango', ['the', '!!'], 'en'))).toEqual(['mango']);
  });

  it('takes a plural s or es on any accepted form of an English word only', () => {
    expect(isCorrect('payongs', umbrella)).toBe(true);
    expect(isCorrect('mangos', mango)).toBe(true);
    expect(isCorrect('the umbrellas!', umbrella)).toBe(true);
    expect(isCorrect('tsinelases', tsinelas)).toBe(false);
    expect(isCorrect('lines', pila)).toBe(false);
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
    const cat = entry('kalabaw', [], 'tl'); // 7 letters
    expect(isClose('kalbaw', cat)).toBe(true); // 1 deletion
    expect(isClose('kalbw', cat)).toBe(true); // 2
    expect(isClose('klbw', cat)).toBe(false); // 3
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
    expect(isClose('pandesal', pan)).toBe(true);
    expect(isClose('pa', pan)).toBe(true); // 1 edit
    const cave = entry('cavern', [], 'en');
    expect(isClose('cave', cave)).toBe(true); // 4 letters, 67%
    expect(isClose('ave', cave)).toBe(false); // 3 letters
  });

  it('matches against every accepted form, normalised', () => {
    expect(isClose('slipper', tsinelas)).toBe(true);
    expect(isClose('Flip-Flop!', tsinelas)).toBe(true);
    expect(isClose('mangg', mango)).toBe(true);
  });

  it('says correct, not close, for a correct guess', () => {
    expect(matchGuess('tsinelas', tsinelas)).toBe('correct');
    expect(matchGuess('umbrellas', umbrella)).toBe('correct');
  });
});
