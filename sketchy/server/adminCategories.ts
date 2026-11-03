// The admin's category and word edits (F81; spec: Admin, Category editor). Pure: each edit takes
// the store's current categories and returns the next ones, or throws an `AdminEditError` that
// names the field it refuses. The routes run these inside `CategoryStore.update`, which checks the
// whole file again with the same schema before it writes, so nothing here can store a word the
// server would refuse at start. Admin-only: the messages may quote a word, so they go to the admin
// who sent it and nowhere else (DECISIONS 103).
import type { z } from 'zod';
import {
  ADMIN_BULK_LINES_MAX,
  ADMIN_IMPORT_EMOJI,
  ADMIN_IMPORT_ISSUES_MAX,
  CATEGORY_TITLE_MAX,
  WORD_ALT_MAX,
} from '../shared/constants.js';
import type {
  AdminBulkLineError,
  AdminCategoryCreateBody,
  AdminCategoryPatchBody,
  AdminImportClash,
  AdminPackFile,
  AdminWordBody,
  AdminWordPatchBody,
  WordLevel,
} from '../shared/types.js';
import {
  categorySchema,
  SEED_CATEGORIES,
  type Category,
  type CategoryWord,
} from './categoryStore.js';
import { normalize } from './match.js';
import { PACK_ID_MAX, packImportSchema, packIssueLines, packWordSchema } from './packs.js';

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

// ---------- Export and import (F82) ----------

/**
 * A refused import: an `AdminEditError` with the file's problems, one line each in the store's
 * words (`issues`), or the category that already has the file's id (`clash`, a 409).
 */
export class AdminImportError extends AdminEditError {
  override name = 'AdminImportError';
  constructor(
    status: 400 | 409,
    message: string,
    readonly details: { field?: string; issues?: string[]; clash?: { id: string; title: string } },
  ) {
    super(status, message, details.field);
  }
  get issues() {
    return this.details.issues;
  }
  get clash() {
    return this.details.clash;
  }
}

export const IMPORT_INVALID = 'This file is not a valid category.';
export const IMPORT_SEVERAL =
  'This file holds several categories (an Export all file). Import one category’s file.';

/**
 * A category as a word pack: the export format (spec: Word pack format). Emoji, `defaultOn` and
 * `hidden` are not in a pack; `alt` is left out when empty, as the seed packs write it.
 */
export function categoryToPack(category: Category): AdminPackFile {
  return {
    schemaVersion: 1,
    id: category.id,
    title: category.title,
    language: 'en',
    words: category.words.map((w) => ({
      id: w.id,
      word: w.word,
      ...(w.alt.length > 0 && { alt: [...w.alt] }),
      difficulty: w.difficulty,
    })),
  };
}

const COPY_SUFFIX = ' (copy)';

/** "Food (copy)", the title cut to keep within the limit. */
export function copyTitle(title: string): string {
  return `${title.slice(0, CATEGORY_TITLE_MAX - COPY_SUFFIX.length).trimEnd()}${COPY_SUFFIX}`;
}

export interface ImportEdit extends CategoryEdit {
  /** Whether the file replaced the category that had its id. */
  replaced: boolean;
}

/** The file's problems, at most `ADMIN_IMPORT_ISSUES_MAX` lines and then how many more. */
function cappedIssues(lines: readonly string[]): string[] {
  if (lines.length <= ADMIN_IMPORT_ISSUES_MAX) return [...lines];
  const more = lines.length - ADMIN_IMPORT_ISSUES_MAX;
  return [...lines.slice(0, ADMIN_IMPORT_ISSUES_MAX), `…and ${more} more.`];
}

/**
 * Imports one pack-format file (an export, or a repo pack whose `rating` is ignored) as a category.
 * The file is checked with the pack's own schema, and like the editor refuses a word twice and
 * drops an alternate that repeats; a refusal lists every problem and changes nothing. A new category is added at the end with its seed emoji (🎨 for any other id), off and
 * visible, as a new category is (DECISIONS 107). When a category already has the file's id:
 * without `onClash` it is a 409 that names it; `rename` adds it beside under a fresh id
 * (`en-food-2`) titled "… (copy)"; `replace` swaps in the file's title and words, keeping that category's emoji,
 * `defaultOn`, `hidden` and place.
 */
export function importCategory(
  categories: readonly Category[],
  raw: unknown,
  onClash?: AdminImportClash,
): ImportEdit {
  if (Array.isArray(raw)) throw new AdminImportError(400, IMPORT_SEVERAL, {});
  const result = packImportSchema.safeParse(raw);
  if (!result.success) {
    throw new AdminImportError(400, IMPORT_INVALID, {
      issues: cappedIssues(packIssueLines(raw, result.error.issues)),
    });
  }
  const { id, title } = result.data;
  // The editor's own word rules on top of the pack's: no word twice (by `normalize`), and
  // alternates without repeats or the word itself.
  const firstOf = new Map<string, number>();
  const repeats: string[] = [];
  result.data.words.forEach((w, i) => {
    const form = normalize(w.word);
    const first = firstOf.get(form);
    if (first === undefined) firstOf.set(form, i);
    else repeats.push(`words.${i}.word: ${JSON.stringify(w.word)} repeats words.${first}`);
  });
  if (repeats.length > 0) {
    throw new AdminImportError(400, IMPORT_INVALID, { issues: cappedIssues(repeats) });
  }
  const words = result.data.words.map((w) => ({ ...w, alt: cleanAlts(w.word, w.alt) }));
  const existing = categories.find((c) => c.id === id);

  if (existing && onClash === 'replace') {
    const category = checked({ ...existing, title, words });
    return { categories: replace(categories, category), category, replaced: true };
  }
  if (existing && onClash !== 'rename') {
    throw new AdminImportError(
      409,
      `A category with the id ${JSON.stringify(id)} already exists (“${existing.title}”). Import it as a copy, or replace that category.`,
      { field: 'id', clash: { id, title: existing.title } },
    );
  }
  const category = checked({
    id: existing ? slugId(id, new Set(categories.map((c) => c.id)), 'category') : id,
    // A copy says so, so the list and the lobby don't show two of the same title.
    title: existing ? copyTitle(title) : title,
    emoji: SEED_CATEGORIES[id]?.emoji ?? ADMIN_IMPORT_EMOJI,
    defaultOn: false,
    hidden: false,
    words,
  });
  return { categories: [...categories, category], category, replaced: false };
}
