// The cards and tiles of **Host a game** and **New game** (F131): one card per built-in category
// with its levels, a plain tile for every other set, and this browser's sets as tiles of their own.
// Pure, so the grouping, the emoji and the search are tested without a DOM.

import { DIFFICULTIES } from '../../../shared/constants.js';
import { SAMPLE_SET_ID } from '../../../shared/sampleSet.js';
import type { Difficulty, QuestionSet } from '../../../shared/types.js';
import { keywordEmoji } from './categoryEmoji.js';
import { DIFFICULTY_LABELS, questionCount } from './setLabels.js';

/** The emoji of a built-in with none stored and no keyword, and of the sample, and of a My set. */
export const FALLBACK_EMOJI = '🎯';
export const SAMPLE_EMOJI = '🎲';
export const MY_SET_EMOJI = '📝';

/** The level a card's body picks before the host has chosen one. */
export const FIRST_LEVEL: Difficulty = 'medium';

/** A set with its picker key (`hostableRows`'s `keyOf`). */
export interface KeyedSet {
  key: string;
  set: QuestionSet;
}

/** A built-in category with at most one set per level. */
export interface CategoryCard {
  kind: 'category';
  /** The category's `categoryKey`: trimmed, lower case. */
  id: string;
  /** The category as its first set spells it. */
  name: string;
  emoji: string;
  levels: Partial<Record<Difficulty, KeyedSet>>;
}

/** One set on its own: a built-in with no level or a second one at a level, or a My set. */
export interface SetTile extends KeyedSet {
  kind: 'tile';
  emoji: string;
  mine: boolean;
}

export type PickerItem = CategoryCard | SetTile;

export interface PickerSections {
  /** This browser's sets, in the order given (newest first). */
  yours: SetTile[];
  /** The built-in cards and tiles, each where its first set stood. */
  builtIn: PickerItem[];
}

/** The server's `categoryKey`: categories that differ only in case or spaces are one. */
export function categoryId(category: string): string {
  return category.trim().toLowerCase();
}

/** A built-in category's emoji: the one stored by the admin, else the keyword map, else 🎯. */
export function builtInEmoji(
  category: string,
  categoryEmoji: Readonly<Record<string, string>>,
): string {
  return categoryEmoji[categoryId(category)] ?? keywordEmoji(category) ?? FALLBACK_EMOJI;
}

/** A built-in tile's emoji: 🎲 for the sample, else its category's, else its title's keyword. */
function builtInTileEmoji(set: QuestionSet, categoryEmoji: Readonly<Record<string, string>>) {
  if (set.id === SAMPLE_SET_ID) return SAMPLE_EMOJI;
  const category = set.category?.trim();
  const fromCategory = category && (categoryEmoji[categoryId(category)] ?? keywordEmoji(category));
  return fromCategory || keywordEmoji(set.title) || FALLBACK_EMOJI;
}

/** A My set's emoji: the keyword map on its category, then its title, else 📝. */
export function mySetEmoji(set: QuestionSet): string {
  return keywordEmoji(set.category) ?? keywordEmoji(set.title) ?? MY_SET_EMOJI;
}

/**
 * The picker's sections. A built-in with a category and a level joins its category's card unless
 * the card already has a set at that level; every other built-in is a tile, so no set is dropped.
 */
export function pickerSections(
  mine: readonly QuestionSet[],
  builtIn: readonly QuestionSet[] | null,
  categoryEmoji: Readonly<Record<string, string>>,
  keyOf: (set: QuestionSet) => string,
): PickerSections {
  // In the order given: `listSets` is newest first, and a game just saved is put first.
  const yours: SetTile[] = mine.map((set) => ({
    kind: 'tile',
    key: keyOf(set),
    set,
    emoji: mySetEmoji(set),
    mine: true,
  }));

  const items: PickerItem[] = [];
  const cards = new Map<string, CategoryCard>();
  for (const set of builtIn ?? []) {
    const category = set.category?.trim();
    const level = set.difficulty;
    const card = category ? cards.get(categoryId(category)) : undefined;
    if (category && level && !card?.levels[level]) {
      const keyed = { key: keyOf(set), set };
      if (card) card.levels[level] = keyed;
      else {
        const created: CategoryCard = {
          kind: 'category',
          id: categoryId(category),
          name: category,
          emoji: builtInEmoji(category, categoryEmoji),
          levels: { [level]: keyed },
        };
        cards.set(created.id, created);
        items.push(created);
      }
      continue;
    }
    const emoji = builtInTileEmoji(set, categoryEmoji);
    items.push({ kind: 'tile', key: keyOf(set), set, emoji, mine: false });
  }
  return { yours, builtIn: items };
}

/** The card's levels that have a set, Easy to Hard. */
export function levelsOf(card: CategoryCard): Difficulty[] {
  return DIFFICULTIES.filter((level) => card.levels[level] !== undefined);
}

/**
 * The level a click on a card's body picks: `wanted` when the card has it, else the nearest one it
 * has, the easier on a tie.
 */
export function resolveLevel(card: CategoryCard, wanted: Difficulty): Difficulty {
  const at = DIFFICULTIES.indexOf(wanted);
  const [nearest] = levelsOf(card).sort(
    (a, b) =>
      Math.abs(DIFFICULTIES.indexOf(a) - at) - Math.abs(DIFFICULTIES.indexOf(b) - at) ||
      DIFFICULTIES.indexOf(a) - DIFFICULTIES.indexOf(b),
  );
  // A card is only made with a set, so it always has a level.
  return nearest ?? wanted;
}

/** The key a click on an item picks: a tile's own, or a card's set at `resolveLevel`. */
export function keyToPick(item: PickerItem, wanted: Difficulty): string {
  if (item.kind === 'tile') return item.key;
  return item.levels[resolveLevel(item, wanted)]!.key;
}

/** Every key an item holds. */
export function keysOf(item: PickerItem): string[] {
  return item.kind === 'tile' ? [item.key] : levelsOf(item).map((l) => item.levels[l]!.key);
}

/** The key picked when the picker opens: the newest My set, else the first built-in item's. */
export function firstPick(sections: PickerSections): string | null {
  const first = sections.yours[0] ?? sections.builtIn[0];
  return first ? keyToPick(first, FIRST_LEVEL) : null;
}

/** Lower case without accents, so "CAFÉ" finds "Cafe". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function haystack(item: PickerItem): string {
  if (item.kind === 'tile') return `${item.set.title} ${item.set.category ?? ''}`;
  return [item.name, ...Object.values(item.levels).map((keyed) => keyed.set.title)].join(' ');
}

/** The items whose category or set titles hold every word of the search. A card stays whole. */
export function searchSections(sections: PickerSections, query: string): PickerSections {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const matches = (item: PickerItem) => {
    const text = fold(haystack(item));
    return words.every((word) => text.includes(word));
  };
  return { yours: sections.yours.filter(matches), builtIn: sections.builtIn.filter(matches) };
}

/** The item holding `key`, with its set and, on a card, the level. */
export function findPick(
  sections: PickerSections,
  key: string | null,
): { item: PickerItem; set: QuestionSet; level?: Difficulty } | undefined {
  if (key === null) return undefined;
  for (const item of [...sections.yours, ...sections.builtIn]) {
    if (item.kind === 'tile') {
      if (item.key === key) return { item, set: item.set };
      continue;
    }
    const level = levelsOf(item).find((l) => item.levels[l]!.key === key);
    if (level) return { item, set: item.levels[level]!.set, level };
  }
  return undefined;
}

/** A chip on the picked-set ticket; `level` ones are gold. */
export interface TicketChip {
  label: string;
  level?: boolean;
}

/** What the picked-set ticket shows. */
export interface Ticket {
  emoji: string;
  kicker: string;
  title: string;
  chips: TicketChip[];
}

/** The ticket of a pick: a card shows its category with the level; a tile its set's title. */
export function ticketOf(pick: NonNullable<ReturnType<typeof findPick>>, playable = true): Ticket {
  const { item, set } = pick;
  const level: TicketChip[] = set.difficulty
    ? [{ label: DIFFICULTY_LABELS[set.difficulty], level: true }]
    : [];
  const chips = [...level, { label: questionCount(set.questions.length) }];
  if (!playable) chips.push({ label: 'Not playable yet' });
  if (item.kind === 'category')
    return { emoji: item.emoji, kicker: 'Built-in category', title: item.name, chips };
  return {
    emoji: item.emoji,
    kicker: item.mine ? 'Your set' : 'Built-in set',
    title: set.title,
    chips,
  };
}

/** A card's line under its name: "15 questions each", or the range when the levels differ. */
export function cardMeta(card: CategoryCard): string {
  const counts = levelsOf(card).map((l) => card.levels[l]!.set.questions.length);
  const low = Math.min(...counts);
  const high = Math.max(...counts);
  if (counts.length === 1) return questionCount(low);
  return low === high ? `${questionCount(low)} each` : `${low}–${high} questions`;
}
