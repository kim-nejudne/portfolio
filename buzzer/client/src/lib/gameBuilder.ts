// **Build a game** (Set list `/sets`; DECISIONS F57): draws questions from chosen categories and
// difficulties into a one-off set. Pure apart from `imagesOf`, which picks a module-level loader.

import { nanoid } from 'nanoid';
import {
  BOARD_COLUMNS_MAX,
  BOARD_COLUMNS_MIN,
  DIFFICULTIES,
  MAX_QUESTIONS_PER_SET,
  SET_TITLE_MAX,
} from '../../../shared/constants.js';
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

export const BOARD_SIZE_MESSAGE = `Choose ${BOARD_COLUMNS_MIN} to ${BOARD_COLUMNS_MAX} categories.`;

/** The category a board's title starts with, as "Mixed: …" does for a mixed game. */
export const BOARD_TITLE_PREFIX = 'Board';

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

/** "Mixed: Animals, History" for the categories that drew questions, cut to fit the title limit. */
function gameTitle(prefix: string, categories: readonly string[]): string {
  const names = new Map<string, string>();
  for (const category of categories) {
    const name = category.trim() || NO_CATEGORY;
    if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }
  const title = `${prefix}: ${[...names.values()].join(', ')}`;
  return title.length <= SET_TITLE_MAX ? title : `${title.slice(0, SET_TITLE_MAX - 1)}…`;
}

/** Each picture from the set its question was drawn from. */
function imageLoader(entries: readonly Entry[]): LoadImage {
  const sourceOf = new Map<string, QuestionSet>();
  for (const { question, source } of entries) {
    if (question.imageId !== undefined && !sourceOf.has(question.imageId)) {
      sourceOf.set(question.imageId, source);
    }
  }
  return async (imageId) => {
    const source = sourceOf.get(imageId);
    return source ? imagesOf(source)(imageId) : undefined;
  };
}

/** Questions from different sets may share an id; the schema wants them unique within a set. */
function renumbered(entries: readonly Entry[]): Question[] {
  return entries.map(({ question }, index) => ({ ...question, id: `q${index + 1}` }));
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
  return {
    ok: true,
    set: {
      id,
      title: gameTitle(
        MIXED_CATEGORY,
        picks.filter((_, index) => got[index]! > 0).map((pick) => pick.category),
      ),
      category: MIXED_CATEGORY,
      questions: renumbered(entries),
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    shortfalls: picks.flatMap((pick, index) =>
      got[index]! < pick.count ? [{ pick: index, asked: pick.count, got: got[index]! }] : [],
    ),
    loadImage: imageLoader(entries),
  };
}

/** One question per level for a category: a board column's picks, Easy, Medium, Hard. */
function columnPicks(category: string): GamePick[] {
  return DIFFICULTIES.map((difficulty) => ({ category, difficulty, count: 1 }));
}

/**
 * The categories a board can use: those with a playable question at every level, A–Z, as
 * `builderCategories` spells them (DECISIONS F90).
 */
export function boardCategories(sets: readonly QuestionSet[]): string[] {
  const entries = pool(sets);
  return builderCategories(sets).filter(
    (category) =>
      draw(entries, columnPicks(category), () => 0).drawn.length === DIFFICULTIES.length,
  );
}

/**
 * A category board drawn from `sets` (DECISIONS F90): one column per category in the order given,
 * each one Easy, Medium and Hard question from top to bottom, keeping its points (the starters'
 * 100, 200, 300). Titled "Board: <categories>" and filed under "Mixed". Fails on fewer than 2 or
 * more than 6 categories, a category named twice, or one without a question at every level.
 */
export function buildBoard(
  sets: readonly QuestionSet[],
  categories: readonly string[],
  { random = Math.random, now = Date.now(), id = nanoid() } = {},
): BuildResult {
  if (categories.length < BOARD_COLUMNS_MIN || categories.length > BOARD_COLUMNS_MAX) {
    return { ok: false, error: BOARD_SIZE_MESSAGE };
  }
  const keys = categories.map(categoryKey);
  if (new Set(keys).size !== keys.length) {
    return { ok: false, error: 'Each category can be on the board once.' };
  }
  const { drawn, got } = draw(pool(sets), categories.flatMap(columnPicks), random);
  const short = categories.findIndex((_, c) =>
    got.slice(c * DIFFICULTIES.length, (c + 1) * DIFFICULTIES.length).some((n) => n === 0),
  );
  if (short !== -1) {
    return { ok: false, error: `${categories[short]} has no question at every level.` };
  }
  // `draw` keeps the picks' order, so the questions run column by column, Easy to Hard.
  const questions = renumbered(drawn);
  return {
    ok: true,
    set: {
      id,
      title: gameTitle(BOARD_TITLE_PREFIX, categories),
      category: MIXED_CATEGORY,
      questions,
      board: {
        columns: categories.map((category, c) => ({
          title: category.trim() || NO_CATEGORY,
          questionIds: questions
            .slice(c * DIFFICULTIES.length, (c + 1) * DIFFICULTIES.length)
            .map((question) => question.id),
        })),
      },
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    shortfalls: [],
    loadImage: imageLoader(drawn),
  };
}
