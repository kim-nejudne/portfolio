// Feed masking (spec: Guess feed and rude guesses). Ordinary profanity, English and Tagalog, masked
// under `guessFeed: 'clean'`, and the matcher shared with `server/slurs.ts`. Pure and server-only:
// a masked guess leaves the server as `null` ("•••"), never as typed. Kim reviews this list (Kim
// checks, F15).
//
// Left out on purpose, because they are everyday words or drawable answers: "leche" (leche flan),
// "putahe" (a dish; only "puta" itself is listed), "gaga", "hayop" (animal), "ass" stays because
// "asses" and "class" are separate words.
import type { RoomSettings } from '../shared/types.js';
import { SLURS } from './slurs.js';

export const PROFANITY: readonly string[] = [
  // English
  '*fuck*',
  'fck',
  'fuk',
  'fuking',
  'fukin',
  'fcking',
  'phuck*',
  'shit',
  'shits',
  'shitty',
  'shithead*',
  'shitter',
  'bullshit*',
  'horseshit',
  'bitch*',
  'ass',
  'asshole*',
  'arse',
  'arsehole*',
  'jackass',
  'dumbass',
  'dick',
  'dicks',
  'dickhead*',
  'cock',
  'cocks',
  'cocksucker*',
  'pussy',
  'pussies',
  '*cunt*',
  'twat*',
  'wanker*',
  'wank',
  'bastard*',
  'whore*',
  'slut*',
  'tits',
  'titties',
  'boobs',
  'piss',
  'pissed',
  'damn',
  'goddamn*',
  'crap',
  'cum',
  'jizz*',
  'dildo*',
  'blowjob*',
  'handjob*',
  'porn*',
  'penis',
  'vagina',
  'anus',
  'testicle*',
  'scrotum',
  'boner',
  'horny',
  'sex',
  'sexy',
  'milf*',
  'stfu',
  'wtf',
  'motherfucker*',
  // Tagalog
  'putangina*',
  'putang*',
  'tangina*',
  'tanginamo',
  'puta',
  'putragis',
  'punyeta*',
  'pakshet',
  'pakyu',
  'pakingshet',
  'gago',
  'gagu',
  'ulol',
  'ulul',
  'olol',
  'tarantado',
  'tarantada',
  'kupal',
  'tite',
  'titi',
  'burat',
  'bayag',
  'puke',
  'pepe',
  'pekpek',
  'bilat',
  'kiki',
  'kantot*',
  'kinantot',
  'iyot',
  'jakol*',
  'hindot*',
  'tamod',
  'pokpok',
  'puday',
  'pwet',
  'bobo',
  'tanga',
  'inutil',
  'lintik',
  'bwisit',
  'buwisit',
  'hinayupak',
  'peste',
  'yawa',
  'pisti',
];

type GuessFeed = RoomSettings['guessFeed'];

/**
 * A wrong or close guess as it may be shown: as typed, or `null` (`•••`) when it has a slur, or
 * under `'clean'` a profane word. `'off'` hides the Screen's feed, and wherever a guess is still
 * shown (the drawer's latest guess, the reveal's "Almost:") it is masked as under `'clean'`.
 */
export function feedText(text: string, mode: GuessFeed): string | null {
  if (hasListedWord(text, SLURS)) return null;
  if (mode !== 'all' && hasListedWord(text, PROFANITY)) return null;
  return text;
}

// ---------- Matching ----------

/** Look-alikes read as letters: digits always, symbols only before a letter ("sh!t", not "hi!"). */
const DIGIT_SWAPS: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
};
const SYMBOL_SWAPS: Record<string, string> = {
  '@': 'a',
  '!': 'i',
  '|': 'i',
  $: 's',
  '+': 't',
  '*': 'u',
};

/**
 * The guess's words for matching: NFKD without marks, lowercase, look-alikes swapped, split on
 * anything but letters. Symbols swap only when a letter follows, so "@ss" and "sh!t" read as words
 * but the "!" in "hi!" stays punctuation.
 */
export function feedWords(text: string): string[] {
  const chars = [...text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()];
  // Right to left, so in "@$$hole" each symbol sees the letter its neighbour became.
  for (let i = chars.length - 1; i >= 0; i--) {
    const c = chars[i]!;
    const next = chars[i + 1];
    if (c in DIGIT_SWAPS) chars[i] = DIGIT_SWAPS[c]!;
    else if (c in SYMBOL_SWAPS && next !== undefined && /\p{L}/u.test(next))
      chars[i] = SYMBOL_SWAPS[c]!;
  }
  return chars
    .join('')
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
}

/** A word, its letter runs cut to two ("asssss" → "ass") and to one ("fuuuck" → "fuck"). */
function spellings(word: string): string[] {
  return [word, word.replace(/(\p{L})\1+/gu, '$1$1'), word.replace(/(\p{L})\1+/gu, '$1')];
}

function entryMatches(entry: string, word: string): boolean {
  const starts = entry.startsWith('*');
  const ends = entry.endsWith('*');
  const core = entry.slice(starts ? 1 : 0, ends ? -1 : undefined);
  if (starts && ends) return word.includes(core);
  if (ends) return word.startsWith(core);
  return word === core;
}

/**
 * Whether any word of `text`, or all its words run together ("f u c k", "puta ng ina"), matches an
 * entry of `list`, in any of its spellings.
 */
export function hasListedWord(text: string, list: readonly string[]): boolean {
  const words = feedWords(text);
  if (words.length === 0) return false;
  const candidates = [...words, ...(words.length > 1 ? [words.join('')] : [])].flatMap(spellings);
  return candidates.some((w) => list.some((entry) => entryMatches(entry, w)));
}
