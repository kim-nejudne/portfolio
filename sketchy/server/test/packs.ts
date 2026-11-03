// Word packs and categories for tests: the old v0 list as an English family pack (so guess tests
// keep their words) and an English spicy pack, frozen like loaded packs. `TEST_CATEGORIES` is the
// same two as a CategoryStore holds them (spicy off by default), and `TEST_SNAPSHOT` is what
// `host:start` carries in reducer tests: the family category alone, as a new room picks it.
import type { GameSnapshot, WordEntry, WordPack } from '../../shared/types.js';
import type { Category } from '../categoryStore.js';
import { buildSnapshot, type CategoryReader } from '../snapshot.js';

type Row = [word: string, difficulty: WordEntry['difficulty']];

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
      rows.map(([word, difficulty]) =>
        Object.freeze({
          id: `${id}/${word.replace(/\s+/g, '-')}`,
          word,
          alt: Object.freeze([]) as unknown as string[],
          difficulty,
          lang: language,
          categoryId: id,
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

export const SPICY_PACK = testPack('test-spicy', 'en', 'spicy', [
  ['hangover', 1],
  ['pillow fight', 2],
  ['walk of shame', 3],
]);

export const TEST_PACKS: readonly WordPack[] = Object.freeze([EN_PACK, SPICY_PACK]);

/** A pack as the store keeps it: short word ids, plus the store's own fields. */
export function testCategory(
  pack: WordPack,
  defaultOn: boolean,
  extra: Partial<Category> = {},
): Category {
  return {
    id: pack.id,
    title: pack.title,
    emoji: '🎨',
    defaultOn,
    hidden: false,
    words: pack.words.map((w) => ({
      id: w.id.slice(pack.id.length + 1),
      word: w.word,
      alt: [...w.alt],
      difficulty: w.difficulty,
    })),
    ...extra,
  };
}

export const TEST_CATEGORIES: readonly Category[] = Object.freeze([
  testCategory(EN_PACK, true),
  testCategory(SPICY_PACK, false),
]);

/** A CategoryStore stand-in for the gateway and HTTP tests. */
export const testCategories = (
  categories: readonly Category[] = TEST_CATEGORIES,
): CategoryReader => ({
  read: () => categories,
});

/** The family category alone: what a new room's `host:start` snapshots. */
export const TEST_SNAPSHOT: GameSnapshot = buildSnapshot(TEST_CATEGORIES, [EN_PACK.id]);

/** A new room's settings as the HTTP layer resolves them against `TEST_CATEGORIES`. */
export const TEST_ROOM_SETTINGS = Object.freeze({ categories: [EN_PACK.id] });
