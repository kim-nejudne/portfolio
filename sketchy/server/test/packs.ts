// Word packs for tests. `TEST_PACKS` is what `makeRoom` deals from: the old v0 list as an English
// family pack (so guess tests keep their words), a small Tagalog pack with glosses and an English
// spicy pack. Frozen like loaded packs.
import type { WordEntry, WordPack } from '../../shared/types.js';

type Row = [word: string, difficulty: WordEntry['difficulty'], gloss?: string];

/** A frozen pack shaped like `parsePack` output: ids `<packId>/<slug>`, `lang` from the pack. */
export function testPack(
  id: string,
  language: WordPack['language'],
  rating: WordPack['rating'],
  rows: readonly Row[],
): WordPack {
  return Object.freeze({
    id,
    title: id,
    language,
    rating,
    words: Object.freeze(
      rows.map(([word, difficulty, gloss]) =>
        Object.freeze({
          id: `${id}/${word.replace(/\s+/g, '-')}`,
          word,
          alt: Object.freeze([]) as unknown as string[],
          difficulty,
          lang: language,
          ...(gloss !== undefined && { gloss }),
        } satisfies WordEntry),
      ),
    ),
  });
}

export const EN_PACK = testPack('test-en', 'en', 'family', [
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
]);

export const TL_PACK = testPack('test-tl', 'tl', 'family', [
  ['tsinelas', 1],
  ['walis', 1],
  ['salakot', 2, "wide woven farmer's hat"],
  ['banig', 2, 'woven sleeping mat'],
  ['harana', 3, "singing under someone's window"],
  ['bayanihan', 3, 'neighbours carrying a house'],
]);

export const SPICY_PACK = testPack('test-spicy', 'en', 'spicy', [
  ['hangover', 1],
  ['karaoke fight', 2],
  ['walk of shame', 3],
]);

export const TEST_PACKS: readonly WordPack[] = Object.freeze([EN_PACK, TL_PACK, SPICY_PACK]);
