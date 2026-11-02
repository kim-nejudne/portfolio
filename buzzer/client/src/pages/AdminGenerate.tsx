import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { AdminCategoriesResponse, GenerateJob } from '../../../shared/types.js';
import { AddCategoryForm } from '../components/AddCategoryForm.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { GenerateProgress } from '../components/GenerateProgress.js';
import { PageShell } from '../components/PageShell.js';
import {
  cancelJob,
  JobGoneError,
  loadCategories,
  loadJob,
  regenerateSet,
  startGeneration,
} from '../lib/adminCategories.js';
import { useAdminSession } from '../lib/adminSession.js';
import { blockedBy, ended, unsavedLevels } from '../lib/generationJob.js';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, LINK } from '../lib/ui.js';

/** How often a running job is asked for its progress, as on the dashboard before (F111). */
export const JOB_POLL_MS = 2000;

/** Polls missed in a row before the page says it cannot reach the server. */
const MISSES_SHOWN = 3;
export const UNREACHABLE_TEXT = 'Cannot reach the server. Still trying every 2 seconds…';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

const categoryPath = (name: string) => `/admin/categories/${encodeURIComponent(name)}`;

/** Where a finished job leads: the category's review, or the level's list for a regenerate. */
export function doneRoute(job: GenerateJob): string {
  if (job.kind === 'generate' || job.setId === null) return categoryPath(job.category);
  return `${categoryPath(job.category)}/${encodeURIComponent(job.setId)}`;
}

interface FollowProps {
  /** Follow another job: one just started, or one already running. */
  onFollow: (jobId: string, replace?: boolean) => void;
}

/** No job in the URL: the form, unless a job runs already, which is then followed instead. */
function StartView({ onFollow }: FollowProps) {
  const [data, setData] = useState<AdminCategoriesResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    loadCategories().then(
      (next) => {
        if (!live) return;
        // Started in another tab, or before a reload: its progress, not a form that would be refused.
        if (next.generation.running) return onFollow(next.generation.running.id, true);
        setData(next);
        setLoadError(null);
      },
      (err: unknown) => {
        if (live) setLoadError(message(err));
      },
    );
    return () => {
      live = false;
    };
  }, [attempt, onFollow]);

  if (data === null) {
    return loadError ? (
      <div className="flex flex-col gap-3">
        <p role="alert" className="text-lg text-buzz">
          {loadError}
        </p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={BUTTON_SECONDARY}>
          Retry
        </button>
      </div>
    ) : (
      <p className="text-lg text-muted">Loading…</p>
    );
  }

  const { generation } = data;
  const left = Math.max(0, generation.dailyLimit - generation.usedToday);
  return (
    <>
      <AddCategoryForm
        names={data.categories.map((c) => c.name)}
        blocked={blockedBy(generation)}
        onStarted={(id) => onFollow(id)}
      />
      {generation.enabled && (
        <p className="-mt-3 text-muted">
          {left} of {generation.dailyLimit} levels left today (UTC).
        </p>
      )}
    </>
  );
}

/** One job's progress, polled every 2 s until it ends. Keyed by the job id. */
function JobView({ jobId, onFollow }: FollowProps & { jobId: string }) {
  const navigate = useNavigate();
  const [job, setJob] = useState<GenerateJob | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Polls missed in a row: after a few, the page says it is still trying.
  const [missed, setMissed] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const fetchJob = () => {
      loadJob(jobId).then(
        (next) => {
          if (stopped) return;
          setJob(next);
          setMissed(0);
          // Replace: Back from the review should not land on a finished job that leads away again.
          if (next.state === 'done') navigate(doneRoute(next), { replace: true });
          else if (!ended(next)) timer = setTimeout(fetchJob, JOB_POLL_MS);
        },
        (err: unknown) => {
          if (stopped) return;
          if (err instanceof JobGoneError) setGone(err.message);
          // A missed poll (a blip, a restart) is tried again; a 401 has already signed out.
          else {
            setMissed((n) => n + 1);
            timer = setTimeout(fetchJob, JOB_POLL_MS);
          }
        },
      );
    };
    fetchJob();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [jobId, navigate]);

  if (gone) {
    return (
      <section className={`flex flex-col gap-4 ${CARD}`}>
        <h1 className="font-display text-2xl">Generation</h1>
        <p role="alert" className="text-lg text-buzz">
          {gone}
        </p>
        <Link to="/admin/generate" className={`${BUTTON_PRIMARY} text-center text-xl`}>
          Add category
        </Link>
      </section>
    );
  }
  const unreachable = missed >= MISSES_SHOWN && (
    <p role="alert" className="text-lg text-buzz">
      {UNREACHABLE_TEXT}
    </p>
  );
  if (job === null) {
    return unreachable || <p className="text-lg text-muted">Loading the generation…</p>;
  }

  function cancel() {
    setCancelling(true);
    setError(null);
    cancelJob(jobId).then(
      // A queued job is cancelled at once; a running one ends after its current call.
      (next) => setJob(next),
      (err: unknown) => {
        setCancelling(false);
        setError(message(err));
      },
    );
  }

  function tryAgain(failed: GenerateJob) {
    setWorking(true);
    setError(null);
    const start =
      failed.kind === 'generate' || failed.setId === null
        ? startGeneration({
            category: failed.category,
            ...(failed.guidance ? { guidance: failed.guidance } : {}),
            levels: unsavedLevels(failed),
          })
        : regenerateSet(failed.setId);
    start.then(
      (id) => onFollow(id),
      (err: unknown) => {
        setWorking(false);
        setError(message(err));
      },
    );
  }

  const stopped = job.state === 'failed' || job.state === 'cancelled';
  const savedSome = job.kind === 'generate' && job.finished.length > 0;
  // Every level saved, yet failed (a late error): there is no rest to try.
  const nothingLeft = job.kind === 'generate' && unsavedLevels(job).length === 0;
  let actions;
  if (stopped) {
    actions = (
      <>
        {savedSome && (
          <Link
            to={categoryPath(job.category)}
            className={`${BUTTON_PRIMARY} text-center text-xl sm:flex-1`}
          >
            Review what was saved
          </Link>
        )}
        {!nothingLeft && (
          <button
            type="button"
            onClick={() => tryAgain(job)}
            disabled={working}
            className={savedSome ? BUTTON_SECONDARY : `${BUTTON_PRIMARY} text-xl sm:flex-1`}
          >
            {working ? 'Starting…' : savedSome ? 'Try the rest again' : 'Try again'}
          </button>
        )}
      </>
    );
  } else if (!ended(job)) {
    actions = (
      <ConfirmButton
        label={cancelling ? 'Cancelling…' : 'Cancel'}
        confirmLabel="Stop generating"
        ariaLabel={cancelling ? undefined : 'Cancel the generation'}
        onConfirm={cancel}
        disabled={cancelling}
        className={BUTTON_SECONDARY}
      />
    );
  }

  return (
    <>
      <GenerateProgress job={job} cancelling={cancelling} actions={actions} />
      {unreachable}
      {error && (
        <p role="alert" className="text-lg text-buzz">
          {error}
        </p>
      )}
    </>
  );
}

function GeneratePage() {
  const [params, setParams] = useSearchParams();
  const jobId = params.get('job');
  const onFollow = useCallback(
    (id: string, replace = false) => setParams({ job: id }, { replace }),
    [setParams],
  );
  return jobId ? (
    <JobView key={jobId} jobId={jobId} onFollow={onFollow} />
  ) : (
    <StartView onFollow={onFollow} />
  );
}

/**
 * `/admin/generate` (F115): Add category, and once started the job's progress until it is done,
 * which leads to its review. `?job=<id>` follows a job; without one, a running job is followed.
 * Signed-in admin only, like the built-in editor.
 */
export function AdminGenerate() {
  const session = useAdminSession();
  return (
    <PageShell
      header={
        <Link to="/admin" className={`${LINK} text-lg`}>
          ← Admin
        </Link>
      }
    >
      {session.kind === 'signedIn' ? (
        <GeneratePage />
      ) : (
        <>
          <h1 className="font-display text-3xl">Add category</h1>
          {session.kind === 'loading' ? (
            <p className="text-muted">Loading…</p>
          ) : (
            <p role="alert" className="text-lg">
              Only the admin can generate categories.{' '}
              <Link to="/admin" className={LINK}>
                Sign in as admin
              </Link>
            </p>
          )}
        </>
      )}
    </PageShell>
  );
}
