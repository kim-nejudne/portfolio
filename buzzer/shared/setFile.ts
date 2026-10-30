// Reading a set file the same way in the browser (Import JSON, F102) and on the server (Import to
// built-ins, F106): the title rule, a zod issue's path as the host reads it, and a set's label in a
// many-set file.

import { SET_CATEGORY_MAX } from './constants.js';
import type { Difficulty, QuestionSet } from './types.js';

/** "schemaVersion" → "Schema version". */
function sentenceCase(key: string): string {
  const words = key.replace(/([A-Z])/g, ' $1').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A zod issue path as the host reads it: "Question 3 › answer", "Image img-1", "Title". */
export function describePath(path: readonly PropertyKey[]): string {
  const [first, second, ...rest] = path.map(String);
  if (first === undefined) return 'File';
  if (first === 'questions' && typeof path[1] === 'number') {
    return [`Question ${(path[1] as number) + 1}`, ...rest].join(' › ');
  }
  if (first === 'images' && second !== undefined) return [`Image ${second}`, ...rest].join(' › ');
  return [sentenceCase(first), ...(second === undefined ? [] : [second]), ...rest].join(' › ');
}

/** 'Set 2 “Pub quiz”', or 'Set 2' when the entry has no usable title. */
export function entryLabel(entry: unknown, index: number): string {
  const title = (entry as { title?: unknown } | null)?.title;
  return typeof title === 'string' && title.trim() !== ''
    ? `Set ${index + 1} “${title.trim()}”`
    : `Set ${index + 1}`;
}

/** "Animals – Easy", "Animals - easy", "Animals — EASY": the topic, then the level (F102). */
const TITLE_LEVEL = /^(.+?)\s+[–—-]\s+(easy|medium|hard)$/i;

/**
 * A set with neither `category` nor `difficulty` gets both from a "<topic> – <level>" title, the
 * starter files' naming (F102). The category is left off when the topic is longer than allowed.
 */
export function fillFromTitle(set: QuestionSet): QuestionSet {
  if (set.category !== undefined || set.difficulty !== undefined) return set;
  const match = TITLE_LEVEL.exec(set.title.trim());
  if (!match) return set;
  const category = match[1]!.trim();
  const difficulty = match[2]!.toLowerCase() as Difficulty;
  // SPEC-QUESTION: the spec has no title rule; a topic too long for a category keeps only the level
  // (DECISIONS F102).
  return category.length <= SET_CATEGORY_MAX
    ? { ...set, category, difficulty }
    : { ...set, difficulty };
}
