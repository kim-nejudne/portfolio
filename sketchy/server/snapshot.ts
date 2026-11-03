// What a room needs from the CategoryStore (spec: Room state, Categories at game start; Words,
// Word selection; Host controls, Categories). Pure: the gateway and the HTTP layer call these with
// `store.read()`; the reducer never reads the store, it gets a finished `GameSnapshot` with the
// action. Nothing here is hidden-category data for a view: hidden categories are filtered out first.
import type { CategoryInfo, GameSnapshot, LobbyCategoryView, WordEntry } from '../shared/types.js';
import type { Category } from './categoryStore.js';
import { normalize } from './match.js';

/** Anything that can hand out the store's current categories (the CategoryStore, or a test list). */
export interface CategoryReader {
  read(): readonly Category[];
}

/** Title order, as the picker and the dedupe use it: by title, then by id so it is total. */
function byTitle(a: Category, b: Category): number {
  return a.title.localeCompare(b.title, 'en') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** The categories a host can pick: not hidden, in title order. */
function visible(categories: readonly Category[]): Category[] {
  return categories.filter((c) => !c.hidden).sort(byTitle);
}

/** The lobby picker's list (the `host` block in LOBBY): visible categories, in title order. */
export function lobbyCategories(categories: readonly Category[]): LobbyCategoryView[] {
  return visible(categories).map((c) => ({
    id: c.id,
    title: c.title,
    emoji: c.emoji,
    wordCount: c.words.length,
    defaultOn: c.defaultOn,
  }));
}

/** A new room's `settings.categories`: every visible `defaultOn` category, in title order. */
export function defaultCategoryIds(categories: readonly Category[]): string[] {
  return visible(categories)
    .filter((c) => c.defaultOn)
    .map((c) => c.id);
}

/**
 * A new room's categories when the host's device asks for its last pick: the ids that still name
 * a visible category, in the order given. When none is left (or none was asked for), the defaults.
 */
export function resolveCategoryIds(
  categories: readonly Category[],
  wanted: readonly string[] | undefined,
): string[] {
  const ids = new Set(visible(categories).map((c) => c.id));
  const kept = (wanted ?? []).filter((id) => ids.has(id));
  return kept.length > 0 ? kept : defaultCategoryIds(categories);
}

/**
 * The game's frozen snapshot of the chosen categories (Word selection): ids that were deleted or
 * hidden are dropped, the rest go in title order, and each normalised word is kept once, from the
 * first category in that order (its `categoryId` is the one shown in the turn). Word ids are
 * `<categoryId>/<wordId>`. Deep-frozen: rooms share it by reference, so a later store edit or a
 * reducer bug can't change a running game's words.
 */
export function buildSnapshot(
  categories: readonly Category[],
  chosen: readonly string[],
): GameSnapshot {
  const wanted = new Set(chosen);
  const picked = visible(categories).filter((c) => wanted.has(c.id));
  const seen = new Set<string>();
  const words: WordEntry[] = [];
  for (const c of picked) {
    for (const w of c.words) {
      const form = normalize(w.word);
      if (seen.has(form)) continue;
      seen.add(form);
      words.push(
        Object.freeze({
          id: `${c.id}/${w.id}`,
          word: w.word,
          alt: Object.freeze([...w.alt]) as string[],
          difficulty: w.difficulty,
          lang: 'en',
          categoryId: c.id,
        }),
      );
    }
  }
  const infos: CategoryInfo[] = picked.map((c) =>
    Object.freeze({ id: c.id, title: c.title, emoji: c.emoji }),
  );
  return Object.freeze({ categories: Object.freeze(infos), words: Object.freeze(words) });
}
