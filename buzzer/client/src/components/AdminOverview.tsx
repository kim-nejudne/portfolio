import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { AdminCategoriesResponse, GenerateJob } from '../../../shared/types.js';
import { categoryRoute, loadCategories } from '../lib/adminCategories.js';
import { jobProgress, listOrder } from '../lib/adminCategoryView.js';
import { needsReview, overviewCounts } from '../lib/adminFilters.js';
import { GENERATION_OFF_TEXT } from '../lib/generationJob.js';
import { useJobPolling } from '../lib/useJobPolling.js';
import { BUTTON_SECONDARY, CARD, LABEL, LINK } from '../lib/ui.js';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

const left = ({ usedToday, dailyLimit }: { usedToday: number; dailyLimit: number }) =>
  Math.max(0, dailyLimit - usedToday);

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={`${CARD} flex flex-col gap-1 p-4`}>
      <dt className={LABEL}>{label}</dt>
      <dd className="flex flex-col">{children}</dd>
    </div>
  );
}

/**
 * The overview in the detail pane of `/admin` from `lg` (F121): tiles for what needs review, what
 * is generating and what is left of today's limits, the categories to review as links, and the
 * running generation's progress, followed every 2 s. Read from `GET /api/admin/categories`.
 */
export function AdminOverview() {
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
