// Search, difficulty chips and category groups for every set list (Set list `/sets`; DECISIONS F55).
// Pure: the lists keep the order they are given in.

import type { Difficulty, QuestionSet } from '../../../shared/types.js';

/** A difficulty chip: one of the levels, or `none` for the sets without one. */
export type DifficultyChip = Difficulty | 'none';

export const DIFFICULTY_CHIPS: readonly DifficultyChip[] = ['easy', 'medium', 'hard', 'none'];

export interface SetFilter {
  query: string;
  /** The chips that are on. None on keeps every difficulty. */
  difficulties: readonly DifficultyChip[];
}

/** The heading of the sets without a category. */
export const NO_CATEGORY = 'Other';

export interface CategoryGroup {
  category: string;
  sets: QuestionSet[];
}

/** Lower case without accents, so "CAFÉ" finds "Cafe". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// SPEC-QUESTION: the roadmap expects "anim" at Easy to leave one set, but it also finds Anime & Manga
// – Easy (DECISIONS F55).
/** The sets whose title or category holds every word of the search, at any chosen difficulty. */
export function filterSets(sets: readonly QuestionSet[], filter: SetFilter): QuestionSet[] {
  const words = fold(filter.query).split(/\s+/).filter(Boolean);
  const chips = new Set(filter.difficulties);
  return sets.filter((set) => {
    if (chips.size > 0 && !chips.has(set.difficulty ?? 'none')) return false;
    const haystack = fold(`${set.title} ${set.category ?? ''}`);
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * The sets by category, each group where its first set stood. Spellings that differ only in case
 * or surrounding spaces share a group, headed by the first spelling; no category goes under "Other",
 * with any set whose category is "Other".
 */
export function groupByCategory(sets: readonly QuestionSet[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const set of sets) {
    // A set filed under "Other" by hand joins the sets without a category.
    const category = set.category?.trim() || NO_CATEGORY;
    const key = category.toLowerCase();
    const group = groups.get(key);
    if (group) group.sets.push(set);
    else groups.set(key, { category, sets: [set] });
  }
  return [...groups.values()];
}
