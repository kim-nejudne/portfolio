import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  CATEGORY_NAME_MAX,
  DEFAULT_LEVEL_COUNT,
  GUIDANCE_MAX,
  LEVEL_COUNT_MAX,
  LEVEL_COUNT_MIN,
} from '#shared/constants.js';
import type { AdminJobsResponse, Difficulty, GenerationJob, JobLevel } from '#shared/types.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { LEVEL_LABELS, LEVELS } from '../lib/adminCategories.js';
import {
  JOB_POLL_MS,
  JobGoneError,
  STEP_LABELS,
  cancelJob,
  cost,
  doneRoute,
  jobEnded,
  keptText,
  levelSteps,
  loadJob,
  loadJobs,
  runningGeneration,
  stageText,
  startGenerate,
  startGenerateMore,
  startRegenerate,
  stopText,
  unsavedLevels,
  type LevelCounts,
  type StepState,
} from '../lib/adminJobs.js';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT, message } from '../lib/adminUi.js';

/** Polls missed in a row before the page says it cannot reach the server. */
const MISSES_SHOWN = 3;
export const UNREACHABLE_TEXT = 'Cannot reach the server. Still trying every second…';

type LevelInputs = Record<Difficulty, { on: boolean; count: string }>;

const freshLevels = (): LevelInputs => ({
  easy: { on: true, count: String(DEFAULT_LEVEL_COUNT) },
  medium: { on: true, count: String(DEFAULT_LEVEL_COUNT) },
  hard: { on: true, count: String(DEFAULT_LEVEL_COUNT) },
});

/** The first thing wrong with the form, or null when it can be sent. */
export function formProblem(name: string, guidance: string, levels: LevelInputs): string | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'Enter a name.';
  if (trimmed.length > CATEGORY_NAME_MAX) {
    return `The name can be at most ${CATEGORY_NAME_MAX} characters.`;
  }
  if (guidance.trim().length > GUIDANCE_MAX) {
    return `The guidance can be at most ${GUIDANCE_MAX} characters.`;
  }
  const ticked = LEVELS.filter((d) => levels[d].on);
  if (ticked.length === 0) return 'Pick at least one level.';
  for (const d of ticked) {
    const text = levels[d].count.trim();
    const count = Number(text);
    if (!/^\d+$/.test(text) || count < LEVEL_COUNT_MIN || count > LEVEL_COUNT_MAX) {
      return `${LEVEL_LABELS[d]} needs ${LEVEL_COUNT_MIN}–${LEVEL_COUNT_MAX} places per mode.`;
    }
  }
  return null;
}

type Follow = (jobId: string, replace?: boolean) => void;

function GenerateForm({ jobs, onFollow }: { jobs: AdminJobsResponse; onFollow: Follow }) {
  const [name, setName] = useState('');
  const [guidance, setGuidance] = useState('');
  const [levels, setLevels] = useState<LevelInputs>(freshLevels);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked =
    jobs.off ?? (jobs.levelsLeft < 1 ? 'Daily limit reached. Try again tomorrow (UTC).' : null);

  const setLevel = (d: Difficulty, change: Partial<LevelInputs[Difficulty]>) =>
    setLevels((current) => ({ ...current, [d]: { ...current[d], ...change } }));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (blocked || sending) return;
    const problem = formProblem(name, guidance, levels);
    if (problem) return setError(problem);
    setError(null);
    setSending(true);
    const picked: LevelCounts = Object.fromEntries(
      LEVELS.filter((d) => levels[d].on).map((d) => [d, { count: Number(levels[d].count) }]),
    );
    startGenerate({ name: name.trim(), guidance: guidance.trim(), levels: picked }).then(
      (id) => onFollow(id),
      (err: unknown) => {
        setSending(false);
        setError(message(err));
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="page-heading" className={CARD}>
      <h1 id="page-heading" className="text-3xl font-bold">
        Add category
      </h1>
      {blocked && (
        <p role="status" className="font-semibold text-delayed">
          {blocked}
        </p>
      )}
      <fieldset disabled={blocked !== null || sending} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-text-dim">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={CATEGORY_NAME_MAX}
            autoComplete="off"
            placeholder="Japan"
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-text-dim">Guidance (optional)</span>
          <textarea
            value={guidance}
            onChange={(event) => setGuidance(event.target.value)}
            maxLength={GUIDANCE_MAX}
            rows={3}
            placeholder="For example: include Hokkaido and Okinawa"
            className={`${INPUT} h-auto py-3`}
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold text-text-dim">Levels and places per mode</legend>
          {LEVELS.map((d) => (
            <div key={d} className="flex flex-wrap items-center gap-x-3">
              <label className="flex min-h-12 min-w-28 items-center gap-2 text-lg">
                <input
                  type="checkbox"
                  checked={levels[d].on}
                  onChange={(event) => setLevel(d, { on: event.target.checked })}
                  className="size-5 accent-amber"
                />
                {LEVEL_LABELS[d]}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={LEVEL_COUNT_MIN}
                max={LEVEL_COUNT_MAX}
                value={levels[d].count}
                onChange={(event) => setLevel(d, { count: event.target.value })}
                disabled={!levels[d].on}
                aria-label={`${LEVEL_LABELS[d]} places per mode`}
                className={`${INPUT} w-24`}
              />
              <span className="text-text-dim">cities and landmarks each</span>
            </div>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="text-delayed">
            {error}
          </p>
        )}
        <button type="submit" className={`${BUTTON_PRIMARY} self-start`}>
          {sending ? 'Starting…' : 'Generate'}
        </button>
      </fieldset>
      {!jobs.off && (
        <p className="text-text-dim">
          {jobs.levelsLeft} {jobs.levelsLeft === 1 ? 'level' : 'levels'} left today (UTC).
        </p>
      )}
    </form>
  );
}

/** No job in the URL: the form, unless a generation runs already, which is then followed. */
function StartView({ onFollow }: { onFollow: Follow }) {
  const [jobs, setJobs] = useState<AdminJobsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    loadJobs().then(
      (next) => {
        if (!live) return;
        const running = runningGeneration(next.jobs);
        // Started in another tab or before a reload: its progress, not a form that would be refused.
        if (running) return onFollow(running.id, true);
        setJobs(next);
      },
      (err: unknown) => live && setError(message(err)),
    );
    return () => {
      live = false;
    };
  }, [attempt, onFollow]);

  if (jobs) return <GenerateForm jobs={jobs} onFollow={onFollow} />;
  if (error) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-delayed">
          {error}
        </p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={BUTTON_SECONDARY}>
          Retry
        </button>
      </div>
    );
  }
  return (
    <p role="status" className="text-text-dim">
      Loading…
    </p>
  );
}

const SEGMENT: Record<StepState, string> = {
  done: 'bg-amber',
  running: 'step-shimmer',
  waiting: 'bg-line',
};

const MARK: Record<JobLevel['state'], string> = {
  saved: '✓',
  running: '●',
  waiting: '○',
  failed: '✕',
  cancelled: '✕',
};

const STATE_WORD: Record<JobLevel['state'], string> = {
  saved: 'Saved',
  running: 'In progress',
  waiting: 'Waiting',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/** A level of the checklist: its mark, state, places kept so far and its stepped bar. */
function LevelProgress({ level }: { level: JobLevel }) {
  const steps = levelSteps(level);
  const done = steps.filter((s) => s.state === 'done').length;
  const running = steps.find((s) => s.state === 'running');
  const name = LEVEL_LABELS[level.level];
  const stopped = level.state === 'failed' || level.state === 'cancelled';
  return (
    <li className="flex flex-col gap-2">
      <p
        className={`flex flex-wrap items-baseline gap-x-3 text-lg ${
          level.state === 'waiting' ? 'text-text-dim' : ''
        } ${stopped ? 'text-delayed' : ''}`}
      >
        <span
          aria-hidden
          className={`w-5 text-center ${level.state === 'saved' ? 'text-amber' : ''}`}
        >
          {MARK[level.state]}
        </span>
        <span className="font-bold">{name}</span>
        <span>{STATE_WORD[level.state]}</span>
        <span className="text-text-dim tabular-nums">{keptText(level.kept, level.count)}</span>
      </p>
      <div
        role="progressbar"
        aria-label={`${name} steps`}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done}
        aria-valuetext={`${running ? `${STEP_LABELS[running.step]}, ` : ''}${done} of ${steps.length} steps done`}
        className="flex gap-1 sm:pl-8"
      >
        {steps.map(({ step, state }) => (
          <span key={step} data-step={state} className="flex min-w-0 flex-1 flex-col gap-1">
            <span className={`h-2 rounded-full ${SEGMENT[state]}`} />
            <span
              aria-hidden
              className={`truncate ${state === 'waiting' ? 'text-text-dim' : 'text-text'}`}
            >
              {STEP_LABELS[step]}
            </span>
          </span>
        ))}
      </div>
    </li>
  );
}

function Progress({
  job,
  cancelling,
  children,
}: {
  job: GenerationJob;
  cancelling: boolean;
  children: ReactNode;
}) {
  const stopped = job.state === 'failed' || job.state === 'cancelled';
  const stage = stageText(job);
  const title =
    job.kind === 'regenerate' && job.levels[0]
      ? `Regenerating ${job.category} · ${LEVEL_LABELS[job.levels[0].level]}`
      : `Generating ${job.category}`;
  return (
    <section aria-labelledby="page-heading" className={CARD}>
      <h1 id="page-heading" className="text-3xl font-bold break-words">
        {title}
      </h1>
      {stopped ? (
        <p role="alert" className="text-lg font-semibold text-delayed">
          {stopText(job)}
        </p>
      ) : (
        <div role="status" className="flex flex-col gap-1">
          <p className="text-xl">
            {cancelling
              ? 'Cancelling…'
              : (stage?.stage ?? (job.state === 'done' ? 'Done' : 'Starting'))}
          </p>
          {stage && <p className="text-text-dim">{stage.level}</p>}
        </div>
      )}
      <ul aria-label="Levels" className="flex flex-col gap-4">
        {job.levels.map((level) => (
          <LevelProgress key={level.level} level={level} />
        ))}
      </ul>
      <p className="text-text-dim tabular-nums">
        {jobEnded(job) ? `Cost: ${cost(job.costUsd)}` : `${cost(job.costUsd)} so far`}
      </p>
      <div className="flex flex-wrap gap-3">{children}</div>
    </section>
  );
}

/** The unsaved levels again: a new category, more levels of an existing one, or the regenerate. */
function tryAgain(job: GenerationJob): Promise<string> {
  const levels = unsavedLevels(job);
  const [level] = job.levels;
  if (job.kind === 'regenerate' && job.categoryId && level) {
    return startRegenerate(job.categoryId, level.level, level.count, job.guidance);
  }
  if (job.categoryId) return startGenerateMore(job.categoryId, { guidance: job.guidance, levels });
  return startGenerate({ name: job.category, guidance: job.guidance, levels });
}

/** One job's progress, polled every second until it ends. Keyed by the job id. */
function JobView({ jobId, onFollow }: { jobId: string; onFollow: Follow }) {
  const navigate = useNavigate();
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [missed, setMissed] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const poll = () => {
      loadJob(jobId).then(
        (next) => {
          if (stopped) return;
          setMissed(0);
          // Replace: Back from the review should not land on a job that leads away again.
          if (next.state === 'done') return navigate(doneRoute(next), { replace: true });
          setJob(next);
          if (!jobEnded(next)) timer = setTimeout(poll, JOB_POLL_MS);
        },
        (err: unknown) => {
          if (stopped) return;
          if (err instanceof JobGoneError) return setGone(err.message);
          setMissed((n) => n + 1);
          timer = setTimeout(poll, JOB_POLL_MS);
        },
      );
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [jobId, navigate]);

  if (gone) {
    return (
      <section aria-labelledby="page-heading" className={CARD}>
        <h1 id="page-heading" className="text-3xl font-bold">
          Generation
        </h1>
        <p role="alert" className="text-delayed">
          {gone}
        </p>
        <Link to="/admin/generate" className={`${BUTTON_PRIMARY} self-start`}>
          Add category
        </Link>
      </section>
    );
  }
  const unreachable = missed >= MISSES_SHOWN && (
    <p role="alert" className="text-delayed">
      {UNREACHABLE_TEXT}
    </p>
  );
  if (job === null) {
    return (
      unreachable || (
        <p role="status" className="text-text-dim">
          Loading the generation…
        </p>
      )
    );
  }

  function cancel() {
    setCancelling(true);
    setError(null);
    cancelJob(jobId).then(setJob, (err: unknown) => {
      setCancelling(false);
      setError(message(err));
    });
  }

  function again(failed: GenerationJob) {
    setWorking(true);
    setError(null);
    tryAgain(failed).then(
      (id) => onFollow(id),
      (err: unknown) => {
        setWorking(false);
        setError(message(err));
      },
    );
  }

  const stopped = job.state === 'failed' || job.state === 'cancelled';
  const savedSome = job.levels.some((l) => l.state === 'saved') && job.categoryId !== null;
  const rest = Object.keys(unsavedLevels(job)).length > 0;
  return (
    <>
      <Progress job={job} cancelling={cancelling}>
        {stopped ? (
          <>
            {savedSome && (
              <Link to={doneRoute(job)} className={BUTTON_PRIMARY}>
                Review what was saved
              </Link>
            )}
            {rest && (
              <button
                type="button"
                onClick={() => again(job)}
                disabled={working}
                className={savedSome ? BUTTON_SECONDARY : BUTTON_PRIMARY}
              >
                {working ? 'Starting…' : savedSome ? 'Try the rest again' : 'Try again'}
              </button>
            )}
          </>
        ) : (
          !jobEnded(job) && (
            <ConfirmButton
              label={cancelling ? 'Cancelling…' : 'Cancel'}
              confirmLabel="Stop generating"
              ariaLabel={cancelling ? undefined : 'Cancel the generation'}
              onConfirm={cancel}
              disabled={cancelling}
              className={BUTTON_SECONDARY}
            />
          )
        )}
      </Progress>
      {unreachable}
      {error && (
        <p role="alert" className="text-delayed">
          {error}
        </p>
      )}
    </>
  );
}

/**
 * `/admin/generate` (spec: Generate page): the form, then the job's progress until it is done,
 * which leads to the category (a regenerate: the level's review). `?job=<id>` follows a job, so
 * leaving and coming back resumes it; without one, a running generation is followed.
 */
export function AdminGenerate() {
  const [params, setParams] = useSearchParams();
  const jobId = params.get('job');
  const onFollow = useCallback<Follow>(
    (id, replace = false) => setParams({ job: id }, { replace }),
    [setParams],
  );
  return jobId ? (
    <JobView key={jobId} jobId={jobId} onFollow={onFollow} />
  ) : (
    <StartView onFollow={onFollow} />
  );
}
