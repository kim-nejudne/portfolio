// The admin category list (spec: Admin dashboard `/admin`): loading it, and the pure rules for its
// badges, order, search and filter chips, over the rows of `GET /api/admin/categories`.

import type {
  AdminCategoriesResponse,
  AdminCategoryRow,
  AdminLevelState,
  Difficulty,
} from '#shared/types.js';
import { UNREACHABLE, adminSessionEnded, errorFrom } from './adminSession.js';

export const LEVELS: readonly Difficulty[] = ['easy', 'medium', 'hard'];
export const LEVEL_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};
export const DOT_TEXT: Record<AdminLevelState, string> = {
  live: 'Live',
  draft: 'Draft',
  review: 'Needs review',
  missing: 'Missing',
};

/** `GET /api/admin/categories`. A 401 signs the page out (a restart, or the 12 h are up). */
export async function loadCategories(): Promise<AdminCategoriesResponse> {
  let response: Response;
  try {
    response = await fetch('/api/admin/categories');
  } catch {
    throw new Error(UNREACHABLE);
  }
  if (response.status === 401) adminSessionEnded();
  if (!response.ok) throw await errorFrom(response, 'Could not load the categories');
  return (await response.json()) as AdminCategoriesResponse;
}

/** A draft level waits for Mark reviewed. */
export const needsReview = (c: AdminCategoryRow): boolean =>
  LEVELS.some((d) => c.levels[d].state === 'review');

/** Hosts can play it: not hidden, and a level has a live version (a draft over it or not). */
export const isLive = (c: AdminCategoryRow): boolean =>
  !c.hidden && LEVELS.some((d) => c.levels[d].published);

// Generating and Failed arrive with jobs (F42).
export type Badge = 'Needs review' | 'Hidden';

/** At most one badge: what asks the admin to act wins. */
export function categoryBadge(c: AdminCategoryRow): Badge | null {
  if (needsReview(c)) return 'Needs review';
  if (c.hidden) return 'Hidden';
  return null;
}

/** Categories that need attention first, then the rest, each by name. */
export function listOrder(categories: readonly AdminCategoryRow[]): AdminCategoryRow[] {
  const byName = (a: AdminCategoryRow, b: AdminCategoryRow) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  return [
    ...categories.filter(needsReview).sort(byName),
    ...categories.filter((c) => !needsReview(c)).sort(byName),
  ];
}

/** "Cities 15/15/12 · Landmarks 15/14/15", Easy/Medium/Hard; a missing level is "–". */
export function countsText(c: AdminCategoryRow): string {
  const counts = (kind: 'city' | 'landmark') =>
    LEVELS.map((d) => (c.levels[d].state === 'missing' ? '–' : String(c.levels[d][kind]))).join(
      '/',
    );
  return `Cities ${counts('city')} · Landmarks ${counts('landmark')}`;
}

export type AdminFilter = 'all' | 'review' | 'generating' | 'live' | 'hidden';
export const FILTERS: readonly AdminFilter[] = ['all', 'review', 'generating', 'live', 'hidden'];
export const FILTER_LABELS: Record<AdminFilter, string> = {
  all: 'All',
  review: 'Needs review',
  generating: 'Generating',
  live: 'Live',
  hidden: 'Hidden',
};

/** The `?filter=` of the URL, or All for none or an unknown one. */
export const parseFilter = (value: string | null): AdminFilter =>
  FILTERS.find((f) => f === value) ?? 'all';

export function inFilter(c: AdminCategoryRow, filter: AdminFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'review':
      return needsReview(c);
    case 'generating':
      return false; // no jobs until F42
    case 'live':
      return isLive(c);
    case 'hidden':
      return c.hidden;
  }
}

/** Accents dropped, lower case, spaces collapsed and trimmed. */
const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const matchesSearch = (c: AdminCategoryRow, query: string): boolean =>
  fold(c.name).includes(fold(query));

/** Each chip's count among the categories the search keeps. */
export function filterCounts(
  categories: readonly AdminCategoryRow[],
  query: string,
): Record<AdminFilter, number> {
  const found = categories.filter((c) => matchesSearch(c, query));
  return Object.fromEntries(
    FILTERS.map((f) => [f, found.filter((c) => inFilter(c, f)).length]),
  ) as Record<AdminFilter, number>;
}

/** `?filter=review&q=jap`, or empty for All and no search: the list keeps them across pages. */
export function filterSearch(filter: AdminFilter, query: string): string {
  const params = new URLSearchParams();
  if (filter !== 'all') params.set('filter', filter);
  if (query !== '') params.set('q', query);
  const text = params.toString();
  return text ? `?${text}` : '';
}
