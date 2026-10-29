// **Build a game** (Set list `/sets`; DECISIONS F57): draws questions from chosen categories and
// difficulties into a one-off set. Pure apart from `imagesOf`, which picks a module-level loader.

import { nanoid } from 'nanoid';
import { MAX_QUESTIONS_PER_SET, SET_TITLE_MAX } from '../../../shared/constants.js';
import type { Difficulty, Question, QuestionSet } from '../../../shared/types.js';
import { checkPlayable, imagesOf, type LoadImage } from './hostRoom.js';
import { groupByCategory, NO_CATEGORY } from './setFilter.js';

/** A row's difficulty: one level, or `any` for every question of the category. */
export type DifficultyPick = Difficulty | 'any';

/** One builder row: how many questions of a category and difficulty. */
export interface GamePick {
  category: string;
  difficulty: DifficultyPick;
  count: number;
}

/** The category a built game is filed under. */
export const MIXED_CATEGORY = 'Mixed';

/** The most questions one row asks for. */
export const PICK_COUNT_MAX = 15;

export const GAME_LIMIT_MESSAGE = `A game holds up to ${MAX_QUESTIONS_PER_SET} questions.`;

export const NO_MATCH_MESSAGE = 'No questions match these picks.';

export interface Shortfall {
  /** The row's index in the picks. */
  pick: number;
  asked: number;
  got: number;
}

export type BuildResult =
  | {
      ok: true;
      set: QuestionSet;
      /** Rows that asked for more questions than there are: each took all it could. */
      shortfalls: Shortfall[];
      /** Each image from wherever its source set keeps it (the bundle or this browser). */
      loadImage: LoadImage;
    }
  | { ok: false; error: string };

interface Entry {
  question: Question;
  category: string; // the group key: trimmed, lower case
  difficulty: Difficulty | undefined;
  source: QuestionSet;
}

/** The group key, as `groupByCategory` forms it: no category and "Other" share one. */
function categoryKey(category: string | undefined): string {
  return (category?.trim() || NO_CATEGORY).toLowerCase();
}

/** The sets a game can draw from: only playable ones, as the room would accept them. */
function playable(sets: readonly QuestionSet[]): QuestionSet[] {
  return sets.flatMap((set) => {
    const checked = checkPlayable(set);
    return checked.ok ? [checked.set] : [];
  });
}

/** The categories the builder offers, one per spelling ignoring case, A–Z. */
export function builderCategories(sets: readonly QuestionSet[]): string[] {
  return groupByCategory(playable(sets))
    .map((group) => group.category)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Every question once. A copy of a set (Duplicate, Duplicate to My sets) repeats its questions, so
 * the same text, answer and host notes count once, ignoring case. A copy's pictures get fresh ids,
 * so a picture-only card is known by its answer and notes alone.
 */
function pool(sets: readonly QuestionSet[]): Entry[] {
  const seen = new Set<string>();
  const entries: Entry[] = [];
  for (const source of playable(sets)) {
    for (const question of source.questions) {
      const key = [question.text, question.answer, question.hostNotes ?? '']
        .join('\n')
        .toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        question,
        category: categoryKey(source.category),
        difficulty: source.difficulty,
        source,
      });
    }
  }
  return entries;
}

/** Fisher–Yates on a copy. `random` returns [0, 1), as `Math.random` does. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Draws each row's questions without repeats. Rows with a set difficulty draw before "any" rows,
 * so an "any" row never takes questions a narrower row needs, and how many each row gets does not
 * depend on `random`.
 */
function draw(
  entries: readonly Entry[],
  picks: readonly GamePick[],
  random: () => number,
): { drawn: Entry[]; got: number[] } {
  const remaining = new Set(entries);
  const got = picks.map(() => 0);
  const drawn: Entry[] = [];
  const order = picks
    .map((pick, index) => ({ pick, index }))
    .sort((a, b) => Number(a.pick.difficulty === 'any') - Number(b.pick.difficulty === 'any'));
  for (const { pick, index } of order) {
    const key = categoryKey(pick.category);
    const candidates = [...remaining].filter(
      (entry) =>
        entry.category === key &&
        (pick.difficulty === 'any' || entry.difficulty === pick.difficulty),
    );
    const taken = shuffle(candidates, random).slice(0, Math.max(0, pick.count));
    for (const entry of taken) remaining.delete(entry);
    drawn.push(...taken);
    got[index] = taken.length;
  }
  return { drawn, got };
}

/** How many questions each row would get, for the builder's running total. */
export function pickCounts(sets: readonly QuestionSet[], picks: readonly GamePick[]): number[] {
  return draw(pool(sets), picks, () => 0).got;
}

/** "Mixed: Animals, History" for the rows that drew questions, cut to fit the title limit. */
function mixedTitle(picks: readonly GamePick[]): string {
  const names = new Map<string, string>();
  for (const pick of picks) {
    const name = pick.category.trim() || NO_CATEGORY;
    if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }
  const title = `${MIXED_CATEGORY}: ${[...names.values()].join(', ')}`;
  return title.length <= SET_TITLE_MAX ? title : `${title.slice(0, SET_TITLE_MAX - 1)}…`;
}

/**
 * A playable set drawn from `sets`: each row's questions without repeats, shuffled together, each
 * keeping its points, picture and notes. Titled "Mixed: <categories>", filed under "Mixed", with
 * no difficulty. Fails when nothing matches or the draw is over the 100-question limit.
 */
export function buildGame(
  sets: readonly QuestionSet[],
  picks: readonly GamePick[],
  { random = Math.random, now = Date.now(), id = nanoid() } = {},
): BuildResult {
  const { drawn, got } = draw(pool(sets), picks, random);
  if (drawn.length === 0) return { ok: false, error: NO_MATCH_MESSAGE };
  if (drawn.length > MAX_QUESTIONS_PER_SET) return { ok: false, error: GAME_LIMIT_MESSAGE };

  const entries = shuffle(drawn, random);
  // Questions from different sets may share an id; the schema wants them unique within a set.
  const questions = entries.map(({ question }, index) => ({ ...question, id: `q${index + 1}` }));

  const sourceOf = new Map<string, QuestionSet>();
  for (const { question, source } of entries) {
    if (question.imageId !== undefined && !sourceOf.has(question.imageId)) {
      sourceOf.set(question.imageId, source);
    }
  }
  const loadImage: LoadImage = async (imageId) => {
    const source = sourceOf.get(imageId);
    return source ? imagesOf(source)(imageId) : undefined;
  };

  return {
    ok: true,
    set: {
      id,
      title: mixedTitle(picks.filter((_, index) => got[index]! > 0)),
      category: MIXED_CATEGORY,
      questions,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    shortfalls: picks.flatMap((pick, index) =>
      got[index]! < pick.count ? [{ pick: index, asked: pick.count, got: got[index]! }] : [],
    ),
    loadImage,
  };
}
