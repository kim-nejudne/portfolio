import type { ReactNode } from 'react';
import { DIFFICULTY_LABELS } from '../../../shared/constants.js';
import type { GenerateJob } from '../../../shared/types.js';
import {
  cost,
  ended,
  jobSteps,
  levelProgress,
  levelText,
  STAGE_TEXT,
  type LevelProgress,
} from '../lib/generationJob.js';
import { CARD } from '../lib/ui.js';

/** "Moons", or "Rivers – Medium" for a regenerate, which writes one level again. */
export function jobTitle(job: GenerateJob): string {
  const [first] = job.levels;
  return job.kind === 'generate' || !first
    ? job.category
    : `${job.category} – ${DIFFICULTY_LABELS[first.difficulty]}`;
}

function StepBar({ job }: { job: GenerateJob }) {
  const { total, done, running } = jobSteps(job);
  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} steps done`}
        className="flex gap-3"
      >
        {job.levels.map((level, i) => (
          <div key={level.difficulty} className="flex flex-1 gap-1">
            {[0, 1].map((k) => {
              const step = i * 2 + k;
              const state = step === running ? 'running' : step < done ? 'done' : 'waiting';
              return (
                <span
                  key={k}
                  data-step={state}
                  title={k === 0 ? 'Write' : 'Check'}
                  className={`relative h-3 flex-1 overflow-hidden rounded-full ${
                    state === 'done'
                      ? 'bg-accent'
                      : state === 'running'
                        ? 'bg-accent/40'
                        : 'bg-edge'
                  }`}
                >
                  {state === 'running' && (
                    <span className="absolute inset-0 bg-linear-to-r from-transparent via-ink/70 to-transparent motion-safe:animate-shimmer" />
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="flex gap-3 text-sm text-muted">
        {job.levels.map((level) => (
          <span key={level.difficulty} className="flex-1">
            {DIFFICULTY_LABELS[level.difficulty]}
          </span>
        ))}
      </div>
    </div>
  );
}

const MARK: Record<LevelProgress['status'], string> = {
  done: '✓',
  running: '●',
  waiting: '○',
  failed: '✕',
  cancelled: '✕',
  skipped: '○',
};

function levelStatusText(level: LevelProgress): string {
  switch (level.status) {
    case 'done':
      return level.questions < level.count
        ? `Done · ${level.questions} of ${level.count}`
        : `Done · ${level.questions} ${level.questions === 1 ? 'question' : 'questions'}`;
    case 'running':
      return 'In progress';
    case 'waiting':
      return 'Waiting';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'skipped':
      return 'Not started';
  }
}

function Checklist({ job }: { job: GenerateJob }) {
  return (
    <ul aria-label="Levels" className="flex flex-col gap-2">
      {levelProgress(job).map((level) => (
        <li
          key={level.difficulty}
          className={`flex items-center gap-3 text-lg ${
            level.status === 'done' || level.status === 'running' ? '' : 'text-muted'
          } ${level.status === 'failed' || level.status === 'cancelled' ? 'text-buzz' : ''}`}
        >
          <span
            aria-hidden="true"
            className={`w-5 text-center ${level.status === 'done' ? 'text-accent' : ''} ${
              level.status === 'running' ? 'text-accent motion-safe:animate-pulse' : ''
            }`}
          >
            {MARK[level.status]}
          </span>
          <span className="font-bold">{DIFFICULTY_LABELS[level.difficulty]}</span>
          <span>{levelStatusText(level)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Why a failed or cancelled job stopped, naming the level it stopped on. */
export function stopText(job: GenerateJob): string {
  const stopped = levelProgress(job).find((l) => l.status === 'failed' || l.status === 'cancelled');
  const label = stopped ? DIFFICULTY_LABELS[stopped.difficulty] : null;
  if (job.state === 'cancelled') {
    return label ? `Cancelled at ${label}.` : 'Cancelled.';
  }
  const why = job.error ?? 'unknown error';
  return label ? `${label} failed: ${why}` : `Failed: ${why}`;
}

interface GenerateProgressProps {
  job: GenerateJob;
  /** The admin pressed Cancel and the running call has not ended yet. */
  cancelling: boolean;
  /** Cancel while it runs; Review, Try again and the like once it stopped. */
  actions: ReactNode;
}

/**
 * A generation's progress on `/admin/generate` (F115): the stepped bar, the stage, a checklist of
 * the levels and the cost so far; once failed or cancelled, the level it stopped on and why.
 */
export function GenerateProgress({ job, cancelling, actions }: GenerateProgressProps) {
  const over = ended(job);
  const stopped = job.state === 'failed' || job.state === 'cancelled';
  const level = levelText(job);
  return (
    <section aria-labelledby="generate-heading" className={`flex flex-col gap-5 ${CARD}`}>
      <h1 id="generate-heading" className="font-display text-2xl">
        {job.kind === 'generate' ? 'Generating' : 'Regenerating'} {jobTitle(job)}
      </h1>
      <StepBar job={job} />
      {stopped ? (
        <p role="alert" className="text-xl text-buzz">
          {stopText(job)}
        </p>
      ) : (
        <div role="status" aria-live="polite" className="flex flex-col gap-1">
          <p className="text-xl">{cancelling ? 'Cancelling…' : STAGE_TEXT[job.state]}</p>
          {level && <p className="text-muted">{level}</p>}
        </div>
      )}
      <Checklist job={job} />
      <p className="text-muted">
        {over ? `Cost: ${cost(job.usage.costUsd)}` : `${cost(job.usage.costUsd)} so far`}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div>
    </section>
  );
}
