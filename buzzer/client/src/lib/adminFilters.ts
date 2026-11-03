// The admin list's search and count chips, and the overview's counts (F121). Pure, over the
// categories of `GET /api/admin/categories`.

import type { AdminCategory } from '../../../shared/types.js';
import { runningJob } from './adminCategoryView.js';

/** A count chip. */
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
export function parseFilter(value: string | null): AdminFilter {
  return FILTERS.find((f) => f === value) ?? 'all';
}

/** Text as search compares it: accents dropped, lower case, spaces collapsed and trimmed. */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** A draft (new or draft) waits for Mark reviewed. */
export const needsReview = (category: AdminCategory): boolean =>
  category.levels.some((l) => l.status !== 'live' && !l.reviewed);

export const isGenerating = (category: AdminCategory): boolean => runningJob(category) !== null;

/** Hosts can play at least one of its levels: one is live and the category is not hidden. */
export const isLive = (category: AdminCategory): boolean =>
  !category.hidden && category.levels.some((l) => l.status === 'live');

/** Hidden from hosts (F126). */
export const isHidden = (category: AdminCategory): boolean => category.hidden;

export function inFilter(category: AdminCategory, filter: AdminFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'review':
      return needsReview(category);
    case 'generating':
      return isGenerating(category);
    case 'live':
      return isLive(category);
    case 'hidden':
      return isHidden(category);
  }
}

/** The category's name or a level's title holds the query; a blank query holds everything. */
export function matchesSearch(category: AdminCategory, query: string): boolean {
  const q = foldText(query);
  if (q === '') return true;
  return [category.name, ...category.levels.map((l) => l.title)].some((text) =>
    foldText(text).includes(q),
  );
}

/** Each chip's count among the categories the search keeps. */
export function filterCounts(
  categories: AdminCategory[],
  query: string,
): Record<AdminFilter, number> {
  const found = categories.filter((c) => matchesSearch(c, query));
  return Object.fromEntries(
    FILTERS.map((f) => [f, found.filter((c) => inFilter(c, f)).length]),
  ) as Record<AdminFilter, number>;
}

/** The categories the search and the chip both keep, in the order given. */
export const applyFilters = (
  categories: AdminCategory[],
  filter: AdminFilter,
  query: string,
): AdminCategory[] => categories.filter((c) => inFilter(c, filter) && matchesSearch(c, query));

/** The URL search for a filter and query: `?filter=review&q=riv`, leaving out All and blank. */
export function filterSearch(filter: AdminFilter, query: string): string {
  const params = new URLSearchParams();
  if (filter !== 'all') params.set('filter', filter);
  if (query !== '') params.set('q', query);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

export interface OverviewCounts {
  review: number;
  generating: number;
  live: number;
  hidden: number;
}

/** Every category, unfiltered: what needs review, what is generating, what is live or hidden. */
export function overviewCounts(categories: AdminCategory[]): OverviewCounts {
  return {
    review: categories.filter(needsReview).length,
    generating: categories.filter(isGenerating).length,
    live: categories.filter(isLive).length,
    hidden: categories.filter(isHidden).length,
  };
}

/** The phone's line above the list: "1 to review · 0 generating · 20 live", then "· 2 hidden". */
export function countsLine({ review, generating, live, hidden }: OverviewCounts): string {
  const line = `${review} to review · ${generating} generating · ${live} live`;
  return hidden > 0 ? `${line} · ${hidden} hidden` : line;
}
