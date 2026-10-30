// Guess matching (spec: Guess matching). Pure and server-only: guesses are checked here and
// nowhere else, so no client ever needs the word to tell right from wrong.
import { GUESS_MAX } from '../shared/constants.js';
import type { WordEntry } from '../shared/types.js';

/** Dropped from the start of a guess or word, repeatedly ("ang tsinelas" → "tsinelas"). */
const FILLERS = new Set(['the', 'a', 'an', 'ang', 'si', 'mga', 'ng', 'isang']);

/**
 * NFKD and strip combining marks, lowercase, everything but letters and digits to spaces, drop
 * leading filler words, then drop the spaces: "Halo halo!", "halo-halo" → "halohalo".
 */
export function normalize(s: string): string {
  const words = s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ');
  let start = 0;
  while (start < words.length && FILLERS.has(words[start]!)) start++;
  return words.slice(start).join('');
}

type Matchable = Pick<WordEntry, 'word' | 'alt' | 'lang'>;

/**
 * `normalize(word)` and each `normalize(alt)`, without repeats. A form that normalises to nothing
 * (an alternate of only fillers or punctuation) is dropped, so an empty guess can never match.
 */
export function acceptedForms(word: Pick<WordEntry, 'word' | 'alt'>): string[] {
  // SPEC-QUESTION: a word that normalises to nothing ("The") can't be guessed at all; packs:check
  // (F17) and custom words should refuse it (DECISIONS 37).
  return [...new Set([word.word, ...word.alt].map(normalize))].filter((f) => f !== '');
}

/** Why a guess is refused before matching: empty after normalisation, or over 40 characters. */
export function guessRejection(text: string): 'emptyGuess' | 'guessTooLong' | null {
  // Counted as the schema counts it: trimmed, in UTF-16 units.
  if (text.trim().length > GUESS_MAX) return 'guessTooLong';
  if (normalize(text) === '') return 'emptyGuess';
  return null;
}

function correctNormalized(g: string, forms: string[], lang: WordEntry['lang']): boolean {
  if (g === '') return false;
  return forms.some(
    (f) => g === f || (lang === 'en' && (g === `${f}s` || g === `${f}es`)), // umbrellas, mangoes
  );
}

function closeNormalized(g: string, forms: string[]): boolean {
  if (g === '') return false;
  const gLen = [...g].length;
  return forms.some((f) => {
    const fLen = [...f].length;
    if (editDistance(g, f) <= (fLen <= 6 ? 1 : 2)) return true;
    return g.includes(f) || (f.includes(g) && gLen >= 4 && gLen >= 0.6 * fLen);
  });
}

/** `normalize(guess)` equals an accepted form, or for an English word that form plus s or es. */
export function isCorrect(guess: string, word: Matchable): boolean {
  return correctNormalized(normalize(guess), acceptedForms(word), word.lang);
}

/**
 * Near enough to an accepted form for "So close!": within 1 edit of a form of up to 6 letters
 * or 2 edits from 7, or containing the form, or inside it with at least 4 letters and 60% of
 * its length. Meant for guesses that aren't correct; `matchGuess` checks correct first.
 */
export function isClose(guess: string, word: Matchable): boolean {
  return closeNormalized(normalize(guess), acceptedForms(word));
}

/** One normalisation for both checks, in order: correct, then close, else wrong. */
export function matchGuess(guess: string, word: Matchable): 'correct' | 'close' | 'wrong' {
  const g = normalize(guess);
  const forms = acceptedForms(word);
  if (correctNormalized(g, forms, word.lang)) return 'correct';
  return closeNormalized(g, forms) ? 'close' : 'wrong';
}

/**
 * Damerau–Levenshtein distance in its optimal string alignment form: insertions, deletions,
 * substitutions and swaps of two neighbouring letters each cost 1. By code point.
 */
export function editDistance(a: string, b: string): number {
  const s = [...a];
  const t = [...b];
  // Three rows: two back for the swap, the previous one and the current one.
  let before = new Array<number>(t.length + 1).fill(0);
  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    const row = new Array<number>(t.length + 1);
    row[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let d = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1])
        d = Math.min(d, before[j - 2]! + 1);
      row[j] = d;
    }
    before = prev;
    prev = row;
  }
  return prev[t.length]!;
}
