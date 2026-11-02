// Categories of the built-in sets (F110): every live set and draft with a `category`, folded
// case-insensitively. A set is counted by its draft when it has one, since that is what the admin
// sees and edits. Pure functions over the store's data; the routes and the job runner share them.

import { DIFFICULTIES } from '../../shared/constants.js';
import type {
  AdminCategory,
  AdminCategoryLevel,
  Difficulty,
  QuestionSet,
} from '../../shared/types.js';
import type { BuiltInData } from '../builtInStore.js';

/** "Rivers", " rivers " and "RIVERS" are one category. */
export function categoryKey(name: string): string {
  return name.trim().toLowerCase();
}

export interface CategorySet {
  /** The draft when there is one, else the live set. */
  set: QuestionSet;
  live: QuestionSet | undefined;
  draft: QuestionSet | undefined;
  status: AdminCategoryLevel['status'];
}

const DIFFICULTY_ORDER = new Map<Difficulty | null, number>([
  ...DIFFICULTIES.map((d, i) => [d, i] as const),
  [null, DIFFICULTIES.length],
]);

/** Every live set, then every new draft, each by its current version, in store order. */
function everySet(data: BuiltInData): CategorySet[] {
  const all: CategorySet[] = [];
  for (const live of data.sets) {
    const draft = Object.hasOwn(data.drafts, live.id) ? data.drafts[live.id] : undefined;
    all.push({ set: draft ?? live, live, draft, status: draft ? 'draft' : 'live' });
  }
  const liveIds = new Set(data.sets.map((s) => s.id));
  for (const draft of Object.values(data.drafts)) {
    if (!liveIds.has(draft.id)) all.push({ set: draft, live: undefined, draft, status: 'new' });
  }
  return all;
}

/**
 * The sets of one category, Easy to Hard (no difficulty last), then by title. Empty when the
 * category has none.
 */
export function setsInCategory(data: BuiltInData, key: string): CategorySet[] {
  return everySet(data)
    .filter(({ set }) => set.category !== undefined && categoryKey(set.category) === key)
    .sort(
      (a, b) =>
        DIFFICULTY_ORDER.get(a.set.difficulty ?? null)! -
          DIFFICULTY_ORDER.get(b.set.difficulty ?? null)! || a.set.title.localeCompare(b.set.title),
    );
}

/** The category's name as the first of its sets spells it, or null when no set has it. */
export function categoryName(data: BuiltInData, key: string): string | null {
  const first = everySet(data).find(
    ({ set }) => set.category !== undefined && categoryKey(set.category) === key,
  );
  return first ? first.set.category!.trim() : null;
}

/** Every question text in the category, live and draft, for the writer's avoid list. */
export function categoryQuestionTexts(data: BuiltInData, key: string): string[] {
  const texts = new Set<string>();
  for (const { live, draft } of setsInCategory(data, key)) {
    for (const version of [live, draft]) {
      if (version?.category === undefined || categoryKey(version.category) !== key) continue;
      for (const q of version.questions) if (q.text.trim()) texts.add(q.text.trim());
    }
  }
  return [...texts];
}

/**
 * `base`, or `base 2`, `base 3` … when a live set or draft already has that title (any case), so
 * a second Easy level of a category is "Rivers – Easy 2".
 */
export function uniqueTitle(data: BuiltInData, base: string): string {
  const taken = new Set(
    [...data.sets, ...Object.values(data.drafts)].map((s) => s.title.trim().toLowerCase()),
  );
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const title = `${base} ${n}`;
    if (!taken.has(title.toLowerCase())) return title;
  }
}

/** A category as the store alone knows it: the caller adds jobs and wanted counts. */
export interface ListedCategory {
  name: AdminCategory['name'];
  levels: Omit<AdminCategoryLevel, 'wanted'>[];
}

/** Every category with its levels, by name. Jobs are attached by the caller. */
export function listCategories(data: BuiltInData): ListedCategory[] {
  const byKey = new Map<string, ListedCategory>();
  for (const { set } of everySet(data)) {
    if (set.category === undefined || set.category.trim() === '') continue;
    const key = categoryKey(set.category);
    if (!byKey.has(key)) {
      byKey.set(key, {
        name: set.category.trim(),
        levels: setsInCategory(data, key).map(({ set: s, status: st }) => ({
          setId: s.id,
          title: s.title,
          difficulty: s.difficulty ?? null,
          questions: s.questions.length,
          status: st,
          // Only a draft can wait for review; a live set has nothing to review (F114).
          reviewed: !data.unreviewed.includes(s.id),
        })),
      });
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}
