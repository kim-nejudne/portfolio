import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type {
  AdminCategoriesResponse,
  GenerateJob,
  GenerationHistoryTotals,
} from '../../../shared/types.js';
import { AdminTile as Tile } from './AdminTile.js';
import { categoryRoute, loadCategories } from '../lib/adminCategories.js';
import { jobProgress, listOrder } from '../lib/adminCategoryView.js';
import { needsReview, overviewCounts } from '../lib/adminFilters.js';
import { loadHistory } from '../lib/adminHistory.js';
import { cost, GENERATION_OFF_TEXT } from '../lib/generationJob.js';
import { useJobPolling } from '../lib/useJobPolling.js';
import { BUTTON_SECONDARY, LINK } from '../lib/ui.js';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

const left = ({ usedToday, dailyLimit }: { usedToday: number; dailyLimit: number }) =>
  Math.max(0, dailyLimit - usedToday);

/** A spend tile's figure: "$0.04", or a quiet dash when the history could not be read. */
function Spend({
  totals,
  pick,
}: {
  totals: GenerationHistoryTotals | 'failed' | null;
  pick: (t: GenerationHistoryTotals) => number;
}) {
  if (totals === null) return <span className="text-lg text-muted">…</span>;
  if (totals === 'failed') return <span className="text-lg text-muted">Could not read</span>;
  return <span className="font-display text-4xl">{cost(pick(totals))}</span>;
}

/**
 * The overview in the detail pane of `/admin` from `lg` (F121): tiles for what needs review, what
 * is generating and what is left of today's limits, the categories to review as links, and the
 * running generation's progress, followed every 2 s. Read from `GET /api/admin/categories`.
 * Spend today and over 30 days come from `GET /api/admin/history` (F128), read again with the
 * categories when a job ends; a failed read leaves the rest of the overview as it is.
 */
export function AdminOverview() {
  const [data, setData] = useState<AdminCategoriesResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [job, setJob] = useState<GenerateJob | null>(null);
  const [spend, setSpend] = useState<GenerationHistoryTotals | 'failed' | null>(null);
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
    loadHistory().then(
      (next) => {
        if (mounted.current) setSpend(next.totals);
      },
      () => {
        if (mounted.current) setSpend('failed');
      },
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  useJobPolling(job?.id ?? null, setJob, () => {
    setJob(null);
    refresh();
  });

  if (data === null) {
    return loadError ? (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-lg text-buzz">
          {loadError}
        </p>
        <button type="button" onClick={refresh} className={BUTTON_SECONDARY}>
          Retry
        </button>
      </div>
    ) : (
      <p className="text-lg text-muted">Loading the overview…</p>
    );
  }

  const { generation } = data;
  const counts = overviewCounts(data.categories);
  const toReview = listOrder(data.categories).filter(needsReview);

  return (
    <section aria-labelledby="overview-heading" className="flex flex-col gap-4">
      <h1 id="overview-heading" className="font-display text-3xl">
        Overview
      </h1>
      <dl className="grid grid-cols-3 gap-3">
        <Tile label="Needs review">
          <span className="font-display text-4xl">{counts.review}</span>
        </Tile>
        <Tile label="Generating">
          <span className="font-display text-4xl">{counts.generating}</span>
        </Tile>
        <Tile label="Left today">
          {generation.enabled ? (
            <>
              <span className="text-lg">
                {left(generation)} of {generation.dailyLimit} levels
              </span>
              <span className="text-lg">
                {left(generation.replacements)} of {generation.replacements.dailyLimit} replacements
              </span>
            </>
          ) : (
            <span className="text-lg text-muted">{GENERATION_OFF_TEXT}</span>
          )}
        </Tile>
        <Tile label="Spend today">
          <Spend totals={spend} pick={(t) => t.todayUsd} />
        </Tile>
        <Tile label="Last 30 days">
          <Spend totals={spend} pick={(t) => t.last30DaysUsd} />
        </Tile>
      </dl>
      <div role="status" aria-live="polite" className="empty:hidden">
        {job && (
          <p className="text-lg">
            <Link
              to={`/admin/generate?job=${encodeURIComponent(job.id)}`}
              className={`${LINK} font-bold text-ink`}
            >
              Generating {job.category}
            </Link>
            <span className="text-muted"> · {jobProgress(job)}</span>
          </p>
        )}
      </div>
      {loadError && (
        <p role="alert" className="text-lg text-buzz">
          {loadError}
        </p>
      )}
      <section aria-labelledby="to-review-heading" className="flex flex-col gap-2">
        <h2 id="to-review-heading" className="font-display text-2xl">
          Needs review
        </h2>
        {toReview.length === 0 ? (
          <p className="text-lg text-muted">Nothing needs review.</p>
        ) : (
          <ul aria-labelledby="to-review-heading" className="flex flex-col">
            {toReview.map((category) => (
              <li key={category.name}>
                <Link
                  to={categoryRoute(category.name)}
                  className={`${LINK} inline-flex min-h-11 items-center text-lg text-ink`}
                >
                  {category.name}
                  <span aria-hidden>&nbsp;→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
