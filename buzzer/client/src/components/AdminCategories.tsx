import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useMatch, useSearchParams } from 'react-router';
import type { AdminCategoriesResponse, AdminCategory, GenerateJob } from '../../../shared/types.js';
import { categoryKey, categoryRoute, loadCategories } from '../lib/adminCategories.js';
import {
  categoryBadge,
  dotState,
  DOT_TEXT,
  jobProgress,
  listOrder,
  questionsText,
  rowName,
  rowsOf,
  totalQuestions,
  type Badge,
  type DotState,
} from '../lib/adminCategoryView.js';
import {
  applyFilters,
  countsLine,
  filterCounts,
  filterSearch,
  FILTER_LABELS,
  FILTERS,
  overviewCounts,
  parseFilter,
  type AdminFilter,
} from '../lib/adminFilters.js';
import { blockedBy } from '../lib/generationJob.js';
import { useJobPolling } from '../lib/useJobPolling.js';
import { HOVER } from '../lib/hover.js';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT, LINK, PILL } from '../lib/ui.js';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

const DOT_CLASS: Record<DotState, string> = {
  live: 'border-win bg-win',
  draft: 'border-accent bg-accent',
  review: 'border-warn bg-transparent',
  generating: 'border-muted bg-transparent motion-safe:animate-pulse',
  failed: 'border-buzz bg-buzz',
};

const BADGE_CLASS: Record<Badge, string> = {
  'Needs review': 'border-warn text-warn',
  Generating: 'text-muted',
  Failed: 'border-buzz text-buzz',
};

const LEGEND: DotState[] = ['live', 'draft', 'review', 'generating', 'failed'];

/** What the dots' colours mean, for eyes and touch screens that never see a `title`. */
function DotLegend() {
  return (
    <p aria-hidden className="flex flex-wrap gap-x-3 text-sm text-muted">
      {LEGEND.map((state) => (
        <span key={state} className="flex items-center gap-1">
          <span className={`inline-block size-2.5 rounded-full border-2 ${DOT_CLASS[state]}`} />
          {DOT_TEXT[state]}
        </span>
      ))}
    </p>
  );
}

/**
 * One compact row of the list (ADM-01): a link to the category page holding its name, a dot per
 * level (Easy, Medium, Hard), its question total and at most one badge. Nothing else to press.
 */
function CategoryRow({
  category,
  open,
  search,
}: {
  category: AdminCategory;
  open: boolean;
  /** The list's `?filter=&q=`, kept on the category page so the list pane keeps it (F121). */
  search: string;
}) {
  const rows = rowsOf(category);
  const badge = categoryBadge(category);
  return (
    <li>
      <Link
        to={categoryRoute(category.name) + search}
        aria-current={open ? 'page' : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-[14px] border-2 px-3 py-2 hover:border-accent ${
          open ? 'border-accent bg-surface' : 'border-edge'
        }`}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-lg text-ink">{category.name}</span>
          <span className="flex items-center gap-2 text-sm text-muted">
            {rows.length > 0 && (
              <span className="flex items-center gap-1" aria-hidden>
                {rows.map((row) => {
                  const state = dotState(row);
                  return (
                    <span
                      key={row.kind === 'set' ? row.level.setId : `pending-${row.difficulty}`}
                      title={`${rowName(row)}: ${DOT_TEXT[state]}`}
                      className={`inline-block size-2.5 rounded-full border-2 ${DOT_CLASS[state]}`}
                    />
                  );
                })}
              </span>
            )}
            <span className="sr-only">
              {rows.map((row) => `${rowName(row)} ${DOT_TEXT[dotState(row)]}`).join(', ')}
              {rows.length > 0 && '. '}
            </span>
            <span>{questionsText(totalQuestions(category))}</span>
          </span>
        </span>
        {badge && (
          <span className={`${PILL} shrink-0 px-2 text-sm whitespace-nowrap ${BADGE_CLASS[badge]}`}>
            {badge}
          </span>
        )}
      </Link>
    </li>
  );
}

const CHIP = `min-h-11 shrink-0 rounded-full border-2 border-edge px-4 text-base font-bold whitespace-nowrap text-muted transition active:scale-95 aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink ${HOVER}`;

/**
 * The search box and count chips above the list (F121). Both live in the URL (`?filter=&q=`), so
 * Back to the list keeps them. Each change replaces the history entry rather than adding one.
 */
function ListFilters({
  categories,
  filter,
  query,
  onChange,
}: {
  categories: AdminCategory[];
  filter: AdminFilter;
  query: string;
  onChange: (filter: AdminFilter, query: string) => void;
}) {
  const counts = filterCounts(categories, query);
  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={query}
        onChange={(event) => onChange(filter, event.target.value)}
        aria-label="Search categories"
        placeholder="Search category or level"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className={`${INPUT} py-2 text-lg placeholder:text-muted`}
      />
      {/* One row that scrolls sideways on a phone, never wraps. */}
      <div
        role="group"
        aria-label="Show"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-color:var(--color-edge)_transparent] [scrollbar-width:thin]"
      >
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => onChange(f, query)}
            className={CHIP}
          >
            {FILTER_LABELS[f]} {counts[f]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- The dashboard ----------

/**
 * The signed-in admin's category list (F111, F120): **Add category** (the form lives on
 * `/admin/generate` since F115), a banner linking to a running generation's progress, and a
 * compact row per category, those that need attention first. Each row opens the category page,
 * where its levels and actions are. `/admin` on a phone; the list pane from `lg`.
 */
export function AdminCategories({ showCounts = false }: { showCounts?: boolean } = {}) {
  // From `lg` the list stays mounted beside the open page (F119): a page that publishes, deletes or
  // starts a job changes what it shows, so it is read again on every move to another page.
  const { pathname } = useLocation();
  const openMatch = useMatch('/admin/categories/:name/*');
  const openName = openMatch?.params.name ?? null;
  const [params, setParams] = useSearchParams();
  const filter = parseFilter(params.get('filter'));
  const query = params.get('q') ?? '';
  const search = filterSearch(filter, query);
  const [data, setData] = useState<AdminCategoriesResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [job, setJob] = useState<GenerateJob | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(() => {
    loadCategories().then(
      (next) => {
        if (!mounted.current) return;
        setData(next);
        setLoadError(null);
        setJob(next.generation.running);
      },
      (err: unknown) => {
        if (mounted.current) setLoadError(message(err));
      },
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  // While a job runs, its banner follows it every 2 s; when it ends, the list is read again.
  useJobPolling(job?.id ?? null, setJob, () => {
    setJob(null);
    refresh();
  });

  if (data === null) {
    return loadError ? (
      <div className="flex flex-col gap-3">
        <p role="alert" className="text-lg text-buzz">
          {loadError}
        </p>
        <button type="button" onClick={refresh} className={BUTTON_SECONDARY}>
          Retry
        </button>
      </div>
    ) : (
      <p className="text-lg text-muted">Loading categories…</p>
    );
  }

  const { generation } = data;
  const blocked = blockedBy(generation);
  const left = Math.max(0, generation.dailyLimit - generation.usedToday);
  const ordered = listOrder(data.categories);
  const shown = applyFilters(ordered, filter, query);
  const setFilters = (nextFilter: AdminFilter, nextQuery: string) =>
    setParams(new URLSearchParams(filterSearch(nextFilter, nextQuery)), { replace: true });

  return (
    <>
      {showCounts && (
        <p className="text-lg text-muted">{countsLine(overviewCounts(data.categories))}</p>
      )}
      <div className="flex flex-col gap-2">
        {/* The page's only gold button, at the top of the list (ADM-05). */}
        <Link to="/admin/generate" className={`${BUTTON_PRIMARY} text-center text-2xl`}>
          <span aria-hidden>+ </span>Add category
        </Link>
        {blocked ? (
          <p className="text-muted">{blocked}</p>
        ) : (
          <p className="text-muted">
            {left} of {generation.dailyLimit} levels left today (UTC).
          </p>
        )}
      </div>
      <div role="status" aria-live="polite" className="empty:hidden">
        {job && (
          <p className={`${CARD} flex flex-col gap-1 p-4 text-lg`}>
            <Link
              to={`/admin/generate?job=${encodeURIComponent(job.id)}`}
              className={`${LINK} font-bold text-ink`}
            >
              Generating {job.category}
            </Link>
            <span className="text-muted">{jobProgress(job)}</span>
          </p>
        )}
      </div>
      {loadError && (
        <p role="alert" className="text-lg text-buzz">
          {loadError}
        </p>
      )}
      <section aria-labelledby="categories-heading" className="flex flex-col gap-3">
        <h2 id="categories-heading" className="font-display text-2xl">
          Categories
        </h2>
        {data.categories.length === 0 ? (
          <p className="text-lg text-muted">No categories yet.</p>
        ) : (
          <>
            <ListFilters categories={ordered} filter={filter} query={query} onChange={setFilters} />
            {shown.length === 0 ? (
              <p className="flex flex-wrap items-center gap-x-3 text-lg text-muted">
                No categories match.
                <Link
                  to={{ search: '' }}
                  replace
                  className={`${LINK} inline-flex min-h-11 items-center text-ink`}
                >
                  Clear
                </Link>
              </p>
            ) : (
              <>
                <DotLegend />
                <ul aria-labelledby="categories-heading" className="flex flex-col gap-2">
                  {shown.map((category) => (
                    <CategoryRow
                      key={category.name}
                      category={category}
                      search={search}
                      open={
                        openName !== null && categoryKey(openName) === categoryKey(category.name)
                      }
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
