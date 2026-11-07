import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useMatch, useSearchParams } from 'react-router';
import type {
  AdminCategoriesResponse,
  AdminCategoryRow,
  AdminJobsResponse,
  GenerationHistoryTotals,
  AdminLevelState,
  GenerationJob,
} from '#shared/types.js';
import {
  DOT_TEXT,
  FILTER_LABELS,
  FILTERS,
  LEVEL_LABELS,
  LEVELS,
  categoryBadge,
  countsText,
  filterCounts,
  filterSearch,
  inFilter,
  isLive,
  listOrder,
  loadCategories,
  matchesSearch,
  needsReview,
  parseFilter,
  type AdminFilter,
  type Badge,
  onCategoriesChanged,
} from '../lib/adminCategories.js';
import { cost } from '../lib/adminJobs.js';
import { loadHistory } from '../lib/adminHistory.js';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, LINK, message } from '../lib/adminUi.js';

/**
 * The categories, read on mount and again on every move to another admin page (the list pane
 * stays mounted beside pages that will change what it shows).
 */
function useAdminCategories() {
  const { pathname } = useLocation();
  const [data, setData] = useState<AdminCategoriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(() => {
    loadCategories().then(
      (next) => {
        if (!mounted.current) return;
        setData(next);
        setError(null);
      },
      (err: unknown) => {
        if (mounted.current) setError(message(err));
      },
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => refresh(), [refresh, pathname]);
  useEffect(() => onCategoriesChanged(refresh), [refresh]);

  return { data, error, refresh };
}

/** The first read: skeleton rows, or the error with Retry. */
function Loading({
  error,
  retry,
  rows = 4,
}: {
  error: string | null;
  retry: () => void;
  rows?: number;
}) {
  if (error) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-delayed">
          {error}
        </p>
        <button type="button" onClick={retry} className={BUTTON_SECONDARY}>
          Retry
        </button>
      </div>
    );
  }
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">Loading categories…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="h-16 rounded-card border border-line bg-board-panel motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}

const DOT_CLASS: Record<AdminLevelState, string> = {
  live: 'border-on-time bg-on-time',
  draft: 'border-amber bg-amber',
  review: 'border-amber bg-transparent',
  missing: 'border-text-dim bg-transparent',
};

const BADGE_CLASS: Record<Badge, string> = {
  Generating: 'border-amber text-amber',
  'Needs review': 'border-amber text-amber',
  Failed: 'border-delayed text-delayed',
  Hidden: 'border-line text-text-dim',
};

const DOT = 'inline-block size-3 rounded-full border-2';

/** What the dots mean, for eyes and touch screens that never see a `title`. */
function DotLegend() {
  return (
    <p aria-hidden className="flex flex-wrap gap-x-3 text-sm text-text-dim">
      {(Object.keys(DOT_CLASS) as AdminLevelState[]).map((state) => (
        <span key={state} className="flex items-center gap-1">
          <span className={`${DOT} ${DOT_CLASS[state]}`} />
          {DOT_TEXT[state]}
        </span>
      ))}
    </p>
  );
}

/** One row: a link to the category page with its emoji, name, level dots, counts and badge. */
function CategoryRow({
  category,
  open,
  search,
  jobs,
}: {
  category: AdminCategoryRow;
  open: boolean;
  search: string;
  jobs: readonly GenerationJob[];
}) {
  const badge = categoryBadge(category, jobs);
  return (
    <li>
      <Link
        to={`/admin/categories/${encodeURIComponent(category.id)}${search}`}
        aria-current={open ? 'page' : undefined}
        className={`flex min-h-12 items-center gap-3 rounded-card border px-3 py-2 [@media(hover:hover)]:hover:border-amber ${
          open ? 'border-amber bg-board-panel' : 'border-line'
        }`}
      >
        {/* A fixed slot, so names line up whether or not a category has an emoji yet. */}
        <span aria-hidden className="w-8 shrink-0 text-center text-2xl">
          {category.emoji}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold text-text">{category.name}</span>
            <span className="flex shrink-0 items-center gap-1" aria-hidden>
              {LEVELS.map((d) => (
                <span
                  key={d}
                  title={`${LEVEL_LABELS[d]}: ${DOT_TEXT[category.levels[d].state]}`}
                  className={`${DOT} ${DOT_CLASS[category.levels[d].state]}`}
                />
              ))}
            </span>
          </span>
          <span className="sr-only">
            {LEVELS.map((d) => `${LEVEL_LABELS[d]} ${DOT_TEXT[category.levels[d].state]}`).join(
              ', ',
            )}
            .
          </span>
          <span className="text-text-dim tabular-nums">{countsText(category)}</span>
        </span>
        {badge && (
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 font-semibold whitespace-nowrap ${BADGE_CLASS[badge]}`}
          >
            {badge}
          </span>
        )}
      </Link>
    </li>
  );
}

const CHIP =
  'min-h-12 shrink-0 rounded-full border border-line px-4 font-semibold whitespace-nowrap text-text-dim active:scale-[0.96] [@media(hover:hover)]:hover:text-text aria-pressed:border-amber aria-pressed:bg-amber aria-pressed:text-board-bg';

/** The search box and count chips. Both live in the URL (`?filter=&q=`), replacing the entry. */
function ListFilters({
  categories,
  filter,
  query,
  jobs,
  onChange,
}: {
  categories: AdminCategoryRow[];
  filter: AdminFilter;
  query: string;
  jobs: readonly GenerationJob[];
  onChange: (filter: AdminFilter, query: string) => void;
}) {
  const counts = filterCounts(categories, query, jobs);
  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={query}
        onChange={(event) => onChange(filter, event.target.value)}
        aria-label="Search categories"
        placeholder="Search categories"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className={INPUT}
      />
      {/* One row that scrolls sideways when narrow, never wraps. */}
      <div
        role="group"
        aria-label="Show"
        className="-mx-1.5 -my-1.5 flex gap-2 overflow-x-auto px-1.5 py-1.5"
      >
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => onChange(f, query)}
            className={CHIP}
          >
            {FILTER_LABELS[f]} <span className="tabular-nums">{counts[f]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The category list: **Add category** at the top, then a row per category, those needing review
 * first, with search and filter chips. `/admin` on a phone; the left pane from 1024 px.
 */
export function AdminCategories({
  showCounts = false,
  jobs: jobsData = null,
}: {
  showCounts?: boolean;
  /** The frame's `GET /api/admin/jobs`, for the Generating and Failed badges and chip. */
  jobs?: AdminJobsResponse | null;
} = {}) {
  const jobs = jobsData?.jobs ?? [];
  const openMatch = useMatch('/admin/categories/:id/*');
  const openId = openMatch?.params.id ?? null;
  const [params, setParams] = useSearchParams();
  const filter = parseFilter(params.get('filter'));
  const query = params.get('q') ?? '';
  const search = filterSearch(filter, query);
  const { data, error, refresh } = useAdminCategories();

  const add = (
    // The list's only amber button.
    <Link to="/admin/generate" className={BUTTON_PRIMARY}>
      <span aria-hidden>+&nbsp;</span>Add category
    </Link>
  );

  if (data === null) {
    return (
      <>
        {add}
        <Loading error={error} retry={refresh} />
      </>
    );
  }

  const ordered = listOrder(data.categories);
  const shown = ordered.filter((c) => inFilter(c, filter, jobs) && matchesSearch(c, query));
  const setFilters = (nextFilter: AdminFilter, nextQuery: string) =>
    setParams(new URLSearchParams(filterSearch(nextFilter, nextQuery)), { replace: true });

  return (
    <>
      {showCounts && <p className="text-text-dim">{countsLine(data.categories)}</p>}
      {add}
      {error && (
        <p role="alert" className="text-delayed">
          {error}
        </p>
      )}
      <section aria-labelledby="categories-heading" className="flex flex-col gap-3">
        <h2 id="categories-heading" className="text-xl font-bold">
          Categories
        </h2>
        {data.categories.length === 0 ? (
          <p className="flex flex-wrap items-center gap-x-2 text-text-dim">
            No categories yet:
            <Link to="/admin/generate" className={LINK}>
              Add category
            </Link>
          </p>
        ) : (
          <>
            <ListFilters
              categories={ordered}
              filter={filter}
              query={query}
              jobs={jobs}
              onChange={setFilters}
            />
            {shown.length === 0 ? (
              <p className="flex flex-wrap items-center gap-x-3 text-text-dim">
                No categories match.
                <Link to={{ search: '' }} replace className={LINK}>
                  Clear
                </Link>
              </p>
            ) : (
              <>
                <DotLegend />
                <ul aria-labelledby="categories-heading" className="flex flex-col gap-2">
                  {shown.map((category) => (
                    <CategoryRow
                      key={category.id}
                      category={category}
                      search={search}
                      jobs={jobs}
                      open={category.id === openId}
                    />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}

/** The phone's overview in one line: "4 categories · 2 live · 1 needs review · 1 hidden". */
function countsLine(categories: AdminCategoryRow[]): string {
  const n = categories.length;
  return [
    `${n} ${n === 1 ? 'category' : 'categories'}`,
    `${categories.filter(isLive).length} live`,
    `${categories.filter(needsReview).length} ${categories.filter(needsReview).length === 1 ? 'needs' : 'need'} review`,
    `${categories.filter((c) => c.hidden).length} hidden`,
  ].join(' · ');
}

export function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-line bg-board-panel p-4">
      <dt className="text-text-dim">{label}</dt>
      <dd className="board-face text-4xl text-text">{value}</dd>
    </div>
  );
}

/** Spend today, over 30 days and in all (estimates, by the UTC day each job ended). */
export function SpendTiles({ totals }: { totals: GenerationHistoryTotals }) {
  return (
    <dl aria-label="Spend" className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      <Tile label="Today" value={cost(totals.todayUsd)} />
      <Tile label="Last 30 days" value={cost(totals.last30DaysUsd)} />
      <Tile label="All time" value={cost(totals.allTimeUsd)} />
    </dl>
  );
}

/** The spend totals, read on mount and again on every page move (a job may have ended). */
function useSpend() {
  const { pathname } = useLocation();
  const [totals, setTotals] = useState<GenerationHistoryTotals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    loadHistory(0).then(
      (next) => {
        if (!live) return;
        setTotals(next.totals);
        setError(null);
      },
      (err: unknown) => {
        if (live) setError(message(err));
      },
    );
    return () => {
      live = false;
    };
  }, [pathname, tick]);
  return { totals, error, retry: () => setTick((n) => n + 1) };
}

/** The job running now with a link to it, how many wait, or "No job running." */
function RunningJob({ jobs }: { jobs: AdminJobsResponse }) {
  const running = jobs.jobs.find((j) => j.state === 'running');
  const waiting = jobs.jobs.filter((j) => j.state === 'queued').length;
  const level = running?.levels[0]?.level;
  return (
    <section aria-labelledby="running-heading" className="flex flex-col gap-2">
      <h2 id="running-heading" className="text-xl font-bold">
        Running
      </h2>
      {!running ? (
        <p className="text-text-dim">No job running.</p>
      ) : running.kind === 'generate' || running.kind === 'regenerate' || !level ? (
        <Link to={`/admin/generate?job=${encodeURIComponent(running.id)}`} className={LINK}>
          Generating {running.category}
        </Link>
      ) : (
        <Link
          to={`/admin/categories/${encodeURIComponent(running.categoryId ?? '')}/${level}`}
          className={LINK}
        >
          {running.kind === 'replace' ? 'Replacing a place in' : 'Adding a place to'}{' '}
          {running.category} · {LEVEL_LABELS[level]}
        </Link>
      )}
      {waiting > 0 && <p className="text-text-dim">{waiting} waiting in the queue.</p>}
    </section>
  );
}

/** What is left of today's limits, or why generation is off. */
function Limits({ jobs }: { jobs: AdminJobsResponse }) {
  return (
    <section aria-labelledby="limits-heading" className="flex flex-col gap-2">
      <h2 id="limits-heading" className="text-xl font-bold">
        Left today (UTC)
      </h2>
      {jobs.off ? (
        <p className="text-text-dim">{jobs.off}</p>
      ) : (
        <dl aria-label="Left today (UTC)" className="grid grid-cols-2 gap-3">
          <Tile label="Levels" value={jobs.levelsLeft} />
          <Tile label="Replacements" value={jobs.replacementsLeft} />
        </dl>
      )}
    </section>
  );
}

function Spend() {
  const { totals, error, retry } = useSpend();
  return (
    <section aria-labelledby="spend-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <h2 id="spend-heading" className="text-xl font-bold">
          Spend
        </h2>
        <Link to="/admin/history" className={LINK}>
          History
        </Link>
      </div>
      {totals ? (
        <SpendTiles totals={totals} />
      ) : error ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-delayed">{error}</p>
          <button type="button" onClick={retry} className={BUTTON_SECONDARY}>
            Retry
          </button>
        </div>
      ) : (
        <p className="text-text-dim">Loading…</p>
      )}
    </section>
  );
}

/**
 * The open page of `/admin` from 1024 px: counts, what needs review, a running job, what is left
 * of today's limits, and spend.
 */
export function AdminOverview({ jobs }: { jobs: AdminJobsResponse | null }) {
  const { data, error, refresh } = useAdminCategories();
  return (
    <section aria-labelledby="overview-heading" className="flex flex-col gap-6">
      <h1 id="overview-heading" className="text-3xl font-bold">
        Overview
      </h1>
      {data === null ? (
        <Loading error={error} retry={refresh} rows={2} />
      ) : (
        <OverviewBody categories={data.categories} />
      )}
      {jobs && <RunningJob jobs={jobs} />}
      {jobs && <Limits jobs={jobs} />}
      <Spend />
    </section>
  );
}

function OverviewBody({ categories }: { categories: AdminCategoryRow[] }) {
  const toReview = listOrder(categories).filter(needsReview);
  return (
    <>
      <dl aria-label="Counts" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile label="Categories" value={categories.length} />
        <Tile label="Live" value={categories.filter(isLive).length} />
        <Tile label="Needs review" value={toReview.length} />
        <Tile label="Hidden" value={categories.filter((c) => c.hidden).length} />
      </dl>
      <section aria-labelledby="to-review-heading" className="flex flex-col gap-2">
        <h2 id="to-review-heading" className="text-xl font-bold">
          Needs review
        </h2>
        {toReview.length === 0 ? (
          <p className="text-text-dim">Nothing needs review.</p>
        ) : (
          <ul aria-labelledby="to-review-heading" className="flex flex-col">
            {toReview.map((c) => (
              <li key={c.id}>
                <Link to={`/admin/categories/${encodeURIComponent(c.id)}`} className={LINK}>
                  {c.emoji && <span aria-hidden>{c.emoji}&nbsp;</span>}
                  {c.name}
                  <span className="font-normal text-text-dim">
                    &nbsp;·{' '}
                    {LEVELS.filter((d) => c.levels[d].state === 'review')
                      .map((d) => LEVEL_LABELS[d])
                      .join(', ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
