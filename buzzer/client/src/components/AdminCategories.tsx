import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { DIFFICULTY_LABELS } from '../../../shared/constants.js';
import type {
  AdminCategoriesResponse,
  AdminCategory,
  AdminCategoryLevel,
  Difficulty,
  GenerateJob,
} from '../../../shared/types.js';
import {
  categoryRoute,
  deleteCategory,
  levelRoute,
  loadCategories,
  loadJob,
  regenerateSet,
} from '../lib/adminCategories.js';
import { blockedBy, cost, ended, levelText, STAGE_TEXT } from '../lib/generationJob.js';
import {
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  BUTTON_SMALL,
  CARD,
  LINK,
  PILL,
} from '../lib/ui.js';
import { ConfirmButton } from './ConfirmButton.js';

/** How often a running job is asked for its progress, for the banner (F111). */
const JOB_POLL_MS = 2000;

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

type LevelStatus = AdminCategoryLevel['status'] | 'generating' | 'failed';

const STATUS_CLASS: Record<LevelStatus, string> = {
  live: 'text-ink',
  draft: 'text-accent',
  new: 'text-accent',
  generating: 'text-muted',
  failed: 'border-buzz text-buzz',
};

function StatusPill({ status }: { status: LevelStatus }) {
  return <span className={`${PILL} px-2 text-sm ${STATUS_CLASS[status]}`}>{status}</span>;
}

/** "Writing the questions · Medium, level 2 of 3 · $0.04 so far". */
export function jobProgress(job: GenerateJob): string {
  const parts = [STAGE_TEXT[job.state]];
  const level = levelText(job);
  if (level) parts.push(level);
  parts.push(`${cost(job.usage.costUsd)} so far`);
  return parts.join(' · ');
}

// ---------- The category list ----------

/** One row: a set of the category, or a level its job has not saved (generating or failed). */
type Row =
  | { kind: 'set'; level: AdminCategoryLevel; status: LevelStatus }
  | { kind: 'pending'; difficulty: Difficulty; status: 'generating' | 'failed' };

function rowsOf(category: AdminCategory): Row[] {
  const job = category.job;
  const running = job !== null && !ended(job);
  const rows: Row[] = category.levels.map((level) => {
    // A regenerate writes over its set: the set's row shows it.
    const target = job?.kind === 'regenerate' && job.setId === level.setId;
    const status: LevelStatus = !target ? level.status : running ? 'generating' : 'failed';
    return { kind: 'set', level, status };
  });
  if (job?.kind === 'generate' && job.state !== 'done') {
    // The levels the job has not saved yet: all still to come, or the one that failed.
    const unsaved = job.levels.filter(
      (l) => !job.finished.some((f) => f.difficulty === l.difficulty),
    );
    const shown = running ? unsaved : unsaved.slice(0, 1);
    for (const { difficulty } of shown) {
      rows.push({ kind: 'pending', difficulty, status: running ? 'generating' : 'failed' });
    }
  }
  return rows;
}

function countText(level: AdminCategoryLevel): string {
  if (level.wanted !== null && level.questions < level.wanted) {
    return `${level.questions} of ${level.wanted}`;
  }
  return `${level.questions} ${level.questions === 1 ? 'question' : 'questions'}`;
}

interface CategoryCardProps {
  category: AdminCategory;
  /** A job is running anywhere (one at a time), so nothing else may start. */
  busy: boolean;
  /** Why a regenerate cannot start (no key, the daily limit), or null. */
  blocked: string | null;
  onChanged: () => void;
  onStarted: (jobId: string) => void;
}

function CategoryCard({ category, busy, blocked, onChanged, onStarted }: CategoryCardProps) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const job = category.job;
  const generatingHere = job !== null && !ended(job);
  const headingId = `category-${category.name.replace(/\W+/g, '-')}`;

  function remove() {
    setWorking(true);
    setError(null);
    deleteCategory(category.name).then(
      () => {
        setWorking(false);
        onChanged();
      },
      (err: unknown) => {
        setWorking(false);
        setError(message(err));
        onChanged();
      },
    );
  }

  function regenerate(setId: string) {
    setWorking(true);
    setError(null);
    regenerateSet(setId).then(
      (jobId) => {
        setWorking(false);
        onStarted(jobId);
      },
      (err: unknown) => {
        setWorking(false);
        setError(message(err));
      },
    );
  }

  return (
    <li aria-labelledby={headingId} className={`flex flex-col gap-3 ${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={headingId} className="mr-auto font-display text-xl">
          {category.name}
        </h3>
        {/* Publishing moved to the review, which needs every level reviewed first (F116). */}
        <Link
          to={categoryRoute(category.name)}
          aria-label={`Review ${category.name}`}
          className={`${BUTTON_SMALL} flex items-center`}
        >
          Review
        </Link>
        <ConfirmButton
          label="Delete"
          confirmLabel={
            category.levels.length === 0
              ? 'Clear it'
              : `Delete ${category.levels.length} ${category.levels.length === 1 ? 'set' : 'sets'}`
          }
          ariaLabel={`Delete ${category.name}`}
          onConfirm={remove}
          // A failed new category has no set, only its failure to clear.
          disabled={working || generatingHere || (category.levels.length === 0 && job === null)}
          className={BUTTON_DANGER}
          cancelClassName={BUTTON_SMALL}
        />
      </div>
      <ul className="flex flex-col gap-2">
        {rowsOf(category).map((row) =>
          row.kind === 'set' ? (
            <li key={row.level.setId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link
                to={levelRoute(category.name, row.level.setId)}
                className={`${LINK} text-lg text-ink`}
              >
                {row.level.title.trim() || 'Untitled set'}
              </Link>
              <span className="text-muted">{countText(row.level)}</span>
              <StatusPill status={row.status} />
              {row.level.difficulty !== null && (
                <span className="ml-auto">
                  <ConfirmButton
                    label="Regenerate"
                    confirmLabel="Write it again"
                    ariaLabel={`Regenerate ${row.level.title.trim() || 'Untitled set'}`}
                    onConfirm={() => regenerate(row.level.setId)}
                    disabled={working || busy || blocked !== null}
                    className={BUTTON_SMALL}
                  />
                </span>
              )}
            </li>
          ) : (
            <li key={`pending-${row.difficulty}`} className="flex flex-wrap items-center gap-3">
              <span className="text-lg text-muted">
                {category.name} – {DIFFICULTY_LABELS[row.difficulty]}
              </span>
              <StatusPill status={row.status} />
            </li>
          ),
        )}
      </ul>
      {job?.state === 'failed' && job.error && <p className="text-buzz">{job.error}</p>}
      {error && (
        <p role="alert" className="text-buzz">
          {error}
        </p>
      )}
    </li>
  );
}

// ---------- The dashboard ----------

/**
 * The signed-in admin's category list (F111): **Add category** (the form lives on
 * `/admin/generate` since F115), a banner linking to a running generation's progress, and a card
 * per category with each level's status and actions. `/admin` on a phone; the list pane from `lg`.
 */
export function AdminCategories() {
  const navigate = useNavigate();
  // From `lg` the list stays mounted beside the open page (F119): a page that publishes, deletes or
  // starts a job changes what it shows, so it is read again on every move to another page.
  const { pathname } = useLocation();
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
  const jobId = job?.id ?? null;
  useEffect(() => {
    if (jobId === null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const poll = () => {
      timer = setTimeout(() => {
        loadJob(jobId).then(
          (next) => {
            if (stopped) return;
            if (ended(next)) {
              setJob(null);
              refresh();
            } else {
              setJob(next);
              poll();
            }
          },
          // A missed poll (a blip, a restart) is tried again; a 401 has already signed out.
          () => {
            if (!stopped) poll();
          },
        );
      }, JOB_POLL_MS);
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [jobId, refresh]);

  const started = (id: string) => navigate(`/admin/generate?job=${encodeURIComponent(id)}`);

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
  const busy = job !== null;
  const blocked = blockedBy(generation);
  const left = Math.max(0, generation.dailyLimit - generation.usedToday);

  return (
    <>
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
          <ul className="flex flex-col gap-3">
            {data.categories.map((category) => (
              <CategoryCard
                key={category.name}
                category={category}
                busy={busy}
                blocked={blocked}
                onChanged={refresh}
                onStarted={started}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
