// F04's hard-coded word list, so a turn can run before word packs (F17) and the deck (F18).
// Server state only: never send any of it to a Screen or guesser.
import type { WordEntry } from '../shared/types.js';

const WORDS: [word: string, difficulty: WordEntry['difficulty']][] = [
  ['apple', 1],
  ['house', 1],
  ['cat', 1],
  ['sun', 1],
  ['fish', 1],
  ['tree', 1],
  ['car', 1],
  ['banana', 1],
  ['umbrella', 2],
  ['guitar', 2],
  ['rainbow', 2],
  ['bicycle', 2],
  ['volcano', 2],
  ['snowman', 2],
  ['mango', 2],
  ['lighthouse', 3],
  ['jellyfish', 3],
  ['astronaut', 3],
  ['waterfall', 3],
  ['fireworks', 3],
];

/** Frozen, so a turn holding one of these entries can never change the shared list. */
export const V0_WORDS: readonly WordEntry[] = Object.freeze(
  WORDS.map(([word, difficulty]) => {
    const entry: WordEntry = { id: `v0/${word}`, word, alt: [], difficulty, lang: 'en' };
    Object.freeze(entry.alt);
    return Object.freeze(entry);
  }),
);
