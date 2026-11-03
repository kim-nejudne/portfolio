// The admin's category and word edits (F81; spec: Admin, Category editor). Pure: each edit takes
// the store's current categories and returns the next ones, or throws an `AdminEditError` that
// names the field it refuses. The routes run these inside `CategoryStore.update`, which checks the
// whole file again with the same schema before it writes, so nothing here can store a word the
// server would refuse at start. Admin-only: the messages may quote a word, so they go to the admin
// who sent it and nowhere else (DECISIONS 103).
import type { z } from 'zod';
import { ADMIN_BULK_LINES_MAX, WORD_ALT_MAX } from '../shared/constants.js';
import type {
  AdminBulkLineError,
  AdminCategoryCreateBody,
  AdminCategoryPatchBody,
  AdminWordBody,
  AdminWordPatchBody,
  WordLevel,
} from '../shared/types.js';
import { categorySchema, type Category, type CategoryWord } from './categoryStore.js';
import { normalize } from './match.js';
import { PACK_ID_MAX, packWordSchema } from './packs.js';

/** An edit the admin can't make: the HTTP status, the message and the body field it names. */
export class AdminEditError extends Error {
  override name = 'AdminEditError';
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

export const NO_CATEGORY = 'There is no such category.';
export const NO_WORD = 'There is no such word in this category.';

const LABELS: Readonly<Record<string, string>> = {
  title: 'Title',
  emoji: 'Emoji',
  defaultOn: 'Default on',
  hidden: 'Hidden',
  word: 'Word',
  difficulty: 'Level',
  alt: 'Alternates',
  text: 'Text',
  id: 'Id',
};

/**
 * One zod issue as the admin reads it, with the body field it belongs to: "Word is required",
 * "Alternate 2 must keep at least 3 letters…", `Unknown field "gloss"`.
 */
export function describeIssue(issue: z.core.$ZodIssue): { field?: string; message: string } {
  if (issue.code === 'unrecognized_keys') {
    const key = issue.keys[0] ?? '';
    return { field: key, message: `Unknown field ${JSON.stringify(key)}` };
  }
  const [field, index] = issue.path;
  if (typeof field !== 'string') return { message: issue.message };
  const label =
    field === 'alt' && typeof index === 'number'
      ? `Alternate ${index + 1}`
      : (LABELS[field] ?? field);
  return { field, message: `${label} ${issue.message}` };
}

/** Throws the first issue as a 400 that names its field. */
function refuse(issues: readonly z.core.$ZodIssue[]): never {
  const { field, message } = describeIssue(issues[0]!);
  throw new AdminEditError(400, message, field);
}

/**
 * An `[a-z0-9-]` id of at most 40 characters made from `text` (accents dropped, everything else a
 * dash), or `fallback` when nothing is left; `-2`, `-3`… keep it out of `taken`.
 */
export function slugId(text: string, taken: ReadonlySet<string>, fallback: string): string {
  const slug =
    text
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, PACK_ID_MAX)
      .replace(/^-+|-+$/g, '') || fallback;
  if (!taken.has(slug)) return slug;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const id = `${slug.slice(0, PACK_ID_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!taken.has(id)) return id;
  }
}

/** A pasted level: easy, medium or hard, or 1–3, any case; empty is medium. Null when unknown. */
export function parseLevel(text: string): WordLevel | null {
  switch (text.trim().toLowerCase()) {
    case '':
    case 'medium':
    case '2':
      return 2;
    case 'easy':
    case '1':
      return 1;
    case 'hard':
    case '3':
      return 3;
    default:
      return null;
  }
}

export interface BulkEntry {
  /** 1-based line number in the paste. */
  line: number;
  /** The line as pasted, trimmed. */
  text: string;
  word: string;
  difficulty: WordLevel;
  alt: string[];
}

/**
 * Bulk paste: one word per line, `word | level | alt, alt`, level and alternates optional. Blank
 * lines are skipped. A line that can't be read is listed with the reason; the word rules
 * themselves (length, 3 letters) are checked when the words are added (`addBulk`).
 */
export function parseBulkPaste(text: string): {
  entries: BulkEntry[];
  errors: AdminBulkLineError[];
} {
  const lines = text.split(/\r?\n/);
  if (lines.length > ADMIN_BULK_LINES_MAX) {
    throw new AdminEditError(400, `Paste at most ${ADMIN_BULK_LINES_MAX} lines at a time.`, 'text');
  }
  const entries: BulkEntry[] = [];
  const errors: AdminBulkLineError[] = [];
  lines.forEach((raw, i) => {
    const line = i + 1;
    const trimmed = raw.trim();
    if (trimmed === '') return;
    const fail = (reason: string) => errors.push({ line, text: trimmed, reason });
    const parts = trimmed.split('|').map((p) => p.trim());
    if (parts.length > 3) return fail('Use at most two | per line');
    const [word = '', levelText = '', altText = ''] = parts;
    if (word === '') return fail('Word is required');
    const difficulty = parseLevel(levelText);
    if (difficulty === null) return fail('Level must be easy, medium or hard');
    const alt = altText
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a !== '');
    if (alt.length > WORD_ALT_MAX) return fail(`Alternates can be at most ${WORD_ALT_MAX}`);
    entries.push({ line, text: trimmed, word, difficulty, alt });
  });
  return { entries, errors };
}

/** The category with this id, or a 404. */
function find(categories: readonly Category[], id: string): Category {
  const category = categories.find((c) => c.id === id);
  if (!category) throw new AdminEditError(404, NO_CATEGORY);
  return category;
}

/** `categories` with `next` in place of the category with its id. */
function replace(categories: readonly Category[], next: Category): Category[] {
  return categories.map((c) => (c.id === next.id ? next : c));
}

/** Checks a category with the store's own schema, naming the field it refuses. */
function checked(category: Category): Category {
  const result = categorySchema.safeParse(category);
  if (!result.success) refuse(result.error.issues);
  return result.data;
}

/** Alternates without repeats, and without the word itself (by `normalize`). */
function cleanAlts(word: string, alt: readonly string[]): string[] {
  const seen = new Set([normalize(word)]);
  return alt.filter((a) => {
    const form = normalize(a);
    if (seen.has(form)) return false;
    seen.add(form);
    return true;
  });
}

/**
 * One word checked with the store's word schema (`packWordSchema`), its alternates cleaned. Throws
 * a 400 naming `word`, `alt` or `difficulty`.
 */
function checkedWord(word: CategoryWord): CategoryWord {
  const text = word.word.trim();
  const alt = cleanAlts(
    text,
    word.alt.map((a) => a.trim()),
  );
  const result = packWordSchema.safeParse({ ...word, word: text, alt });
  if (!result.success) refuse(result.error.issues);
  return result.data;
}

/** Throws a 409 when `word` is already a word of `category` (other than `exceptId`). */
function checkUnique(category: Category, word: string, exceptId?: string): void {
  const form = normalize(word.trim());
  if (category.words.some((w) => w.id !== exceptId && normalize(w.word) === form)) {
    throw new AdminEditError(
      409,
      `Word ${JSON.stringify(word.trim())} is already in this category`,
      'word',
    );
  }
}

export interface CategoryEdit {
  categories: Category[];
  category: Category;
}

/**
 * A new, empty category at the end, its id made from the title. New categories are off by
 * default and not hidden unless the body says so (DECISIONS 107).
 */
export function createCategory(
  categories: readonly Category[],
  body: AdminCategoryCreateBody,
): CategoryEdit {
  const id = slugId(body.title, new Set(categories.map((c) => c.id)), 'category');
  const category = checked({
    id,
    title: body.title.trim(),
    emoji: body.emoji.trim(),
    defaultOn: body.defaultOn ?? false,
    hidden: body.hidden ?? false,
    words: [],
  });
  return { categories: [...categories, category], category };
}

/** Rename, emoji, `defaultOn`, `hidden`. The id and words never change. */
export function patchCategory(
  categories: readonly Category[],
  id: string,
  body: AdminCategoryPatchBody,
): CategoryEdit {
  const current = find(categories, id);
  const category = checked({
    ...current,
    ...(body.title !== undefined && { title: body.title.trim() }),
    ...(body.emoji !== undefined && { emoji: body.emoji.trim() }),
    ...(body.defaultOn !== undefined && { defaultOn: body.defaultOn }),
    ...(body.hidden !== undefined && { hidden: body.hidden }),
  });
  return { categories: replace(categories, category), category };
}

export function deleteCategory(categories: readonly Category[], id: string): Category[] {
  find(categories, id);
  return categories.filter((c) => c.id !== id);
}

/** A new word at the end of the category: medium and no alternates unless given. */
export function addWord(
  categories: readonly Category[],
  id: string,
  body: AdminWordBody,
): CategoryEdit {
  const current = find(categories, id);
  checkUnique(current, body.word);
  const word = checkedWord({
    id: slugId(body.word, new Set(current.words.map((w) => w.id)), 'word'),
    word: body.word,
    alt: body.alt ?? [],
    difficulty: body.difficulty ?? 2,
  });
  const category = checked({ ...current, words: [...current.words, word] });
  return { categories: replace(categories, category), category };
}

/** Edits a word's text, level or alternates; its id stays, so `usedIds` still hold. */
export function patchWord(
  categories: readonly Category[],
  id: string,
  wordId: string,
  body: AdminWordPatchBody,
): CategoryEdit {
  const current = find(categories, id);
  const before = current.words.find((w) => w.id === wordId);
  if (!before) throw new AdminEditError(404, NO_WORD);
  if (body.word !== undefined) checkUnique(current, body.word, wordId);
  const word = checkedWord({
    id: wordId,
    word: body.word ?? before.word,
    alt: body.alt ?? before.alt,
    difficulty: body.difficulty ?? before.difficulty,
  });
  const category = checked({
    ...current,
    words: current.words.map((w) => (w.id === wordId ? word : w)),
  });
  return { categories: replace(categories, category), category };
}

export function deleteWord(
  categories: readonly Category[],
  id: string,
  wordId: string,
): CategoryEdit {
  const current = find(categories, id);
  if (!current.words.some((w) => w.id === wordId)) throw new AdminEditError(404, NO_WORD);
  const category = { ...current, words: current.words.filter((w) => w.id !== wordId) };
  return { categories: replace(categories, category), category };
}

export interface BulkEdit extends CategoryEdit {
  added: number;
  duplicates: number;
  errors: AdminBulkLineError[];
}

/**
 * Bulk paste into one category: the good lines are added in order, each bad line is listed with
 * its reason, and a word already in the category (or earlier in the paste) is skipped and counted.
 * The same word in another category is fine (DECISIONS 100). With nothing added, the category is
 * returned as it was.
 */
export function addBulk(categories: readonly Category[], id: string, text: string): BulkEdit {
  const current = find(categories, id);
  const { entries, errors } = parseBulkPaste(text);
  const forms = new Set(current.words.map((w) => normalize(w.word)));
  const ids = new Set(current.words.map((w) => w.id));
  const added: CategoryWord[] = [];
  let duplicates = 0;
  for (const entry of entries) {
    const form = normalize(entry.word);
    if (forms.has(form)) {
      duplicates++;
      continue;
    }
    let word: CategoryWord;
    try {
      word = checkedWord({
        id: slugId(entry.word, ids, 'word'),
        word: entry.word,
        alt: entry.alt,
        difficulty: entry.difficulty,
      });
    } catch (err) {
      if (!(err instanceof AdminEditError)) throw err;
      errors.push({ line: entry.line, text: entry.text, reason: err.message });
      continue;
    }
    forms.add(form);
    ids.add(word.id);
    added.push(word);
  }
  errors.sort((a, b) => a.line - b.line);
  if (added.length === 0) {
    return { categories: [...categories], category: current, added: 0, duplicates, errors };
  }
  const category = checked({ ...current, words: [...current.words, ...added] });
  return {
    categories: replace(categories, category),
    category,
    added: added.length,
    duplicates,
    errors,
  };
}
