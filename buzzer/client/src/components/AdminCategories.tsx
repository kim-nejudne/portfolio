import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  GENERATE_COUNT_DEFAULT,
  GENERATE_COUNT_MAX,
  GENERATE_COUNT_MIN,
  GENERATE_GUIDANCE_MAX,
  SET_CATEGORY_MAX,
} from '../../../shared/constants.js';
import type {
  AdminCategoriesResponse,
  AdminCategory,
  AdminCategoryLevel,
  Difficulty,
  GenerateJob,
  GenerateJobState,
} from '../../../shared/types.js';
import {
  deleteCategory,
  loadCategories,
  loadJob,
  publishCategory,
  regenerateSet,
  startGeneration,
} from '../lib/adminCategories.js';
import {
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  BUTTON_SMALL,
  CARD,
  FIELD,
  LABEL,
  LINK,
  PILL,
} from '../lib/ui.js';
import { ConfirmButton } from './ConfirmButton.js';

/** How often a running job is asked for its progress (Done-when: every 2 s). */
const JOB_POLL_MS = 2000;

export const GENERATION_OFF_TEXT = 'Generation is not set up';
export const DAILY_LIMIT_TEXT = 'Daily limit reached';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

const STAGE_TEXT: Record<GenerateJobState, string> = {
  queued: 'Waiting to start',
  writing: 'Writing the questions',
  checking: 'Checking the facts',
  'topping up': 'Replacing dropped questions',
  done: 'Done',
  failed: 'Failed',
};

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

/** "$0.02", or "under $0.01". */
function cost(usd: number): string {
  return usd > 0 && usd < 0.01 ? 'under $0.01' : `$${usd.toFixed(2)}`;
}

/** "Writing the questions · Medium, level 2 of 3 · $0.04 so far". */
export function jobProgress(job: GenerateJob): string {
  const parts = [STAGE_TEXT[job.state]];
  if (job.currentLevel) {
    const at = job.levels.findIndex((l) => l.difficulty === job.currentLevel) + 1;
    const label = DIFFICULTY_LABELS[job.currentLevel];
    parts.push(job.levels.length > 1 ? `${label}, level ${at} of ${job.levels.length}` : label);
  }
  parts.push(`${cost(job.usage.costUsd)} so far`);
  return parts.join(' · ');
}

// ---------- Add category ----------

interface LevelInput {
  on: boolean;
  count: string;
}

type LevelInputs = Record<Difficulty, LevelInput>;

const freshLevels = (): LevelInputs => ({
  easy: { on: true, count: String(GENERATE_COUNT_DEFAULT) },
  medium: { on: true, count: String(GENERATE_COUNT_DEFAULT) },
  hard: { on: true, count: String(GENERATE_COUNT_DEFAULT) },
});

/** The first thing wrong with the form, or null when it can be sent. */
export function formProblem(name: string, guidance: string, levels: LevelInputs): string | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'Enter a category name.';
  if (trimmed.length > SET_CATEGORY_MAX) {
    return `The name can be at most ${SET_CATEGORY_MAX} characters.`;
  }
  if (guidance.trim().length > GENERATE_GUIDANCE_MAX) {
    return `The guidance can be at most ${GENERATE_GUIDANCE_MAX} characters.`;
  }
  const ticked = DIFFICULTIES.filter((d) => levels[d].on);
  if (ticked.length === 0) return 'Tick at least one level.';
  for (const d of ticked) {
    const text = levels[d].count.trim();
    const count = Number(text);
    if (!/^\d+$/.test(text) || count < GENERATE_COUNT_MIN || count > GENERATE_COUNT_MAX) {
      return `${DIFFICULTY_LABELS[d]} needs ${GENERATE_COUNT_MIN}–${GENERATE_COUNT_MAX} questions.`;
    }
  }
  return null;
}

interface AddCategoryFormProps {
  names: string[];
  /** Why the form is off, or null when a generation can start. */
  blocked: string | null;
  /** A new try: the last generation's outcome is no longer news. */
  onSubmit: () => void;
  onStarted: (jobId: string) => void;
}

function AddCategoryForm({ names, blocked, onSubmit, onStarted }: AddCategoryFormProps) {
  const [name, setName] = useState('');
  const [guidance, setGuidance] = useState('');
  const [levels, setLevels] = useState<LevelInputs>(freshLevels);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const off = blocked !== null || sending;

  const setLevel = (d: Difficulty, change: Partial<LevelInput>) =>
    setLevels((current) => ({ ...current, [d]: { ...current[d], ...change } }));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (off) return;
    onSubmit();
    const problem = formProblem(name, guidance, levels);
    if (problem) return setError(problem);
    setError(null);
    setSending(true);
    const body = {
      category: name.trim(),
      ...(guidance.trim() ? { guidance: guidance.trim() } : {}),
      levels: DIFFICULTIES.filter((d) => levels[d].on).map((difficulty) => ({
        difficulty,
        count: Number(levels[difficulty].count),
      })),
    };
    startGeneration(body).then(
      (jobId) => {
        setSending(false);
        setName('');
        setGuidance('');
        setLevels(freshLevels());
        onStarted(jobId);
      },
      (err: unknown) => {
        setSending(false);
        setError(message(err));
      },
    );
  }

  return (
    <form
      onSubmit={submit}
      aria-labelledby="add-category-heading"
      noValidate
      className={`flex flex-col gap-4 ${CARD}`}
    >
      <h2 id="add-category-heading" className="font-display text-2xl">
        Add category
      </h2>
      {blocked && <p className="text-lg text-muted">{blocked}</p>}
      <fieldset disabled={off} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className={LABEL}>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            list="admin-category-names"
            maxLength={SET_CATEGORY_MAX}
            autoComplete="off"
            className={FIELD}
          />
        </label>
        <datalist id="admin-category-names">
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>Guidance (optional)</span>
          <textarea
            value={guidance}
            onChange={(event) => setGuidance(event.target.value)}
            maxLength={GENERATE_GUIDANCE_MAX}
            rows={3}
            placeholder="For example: rivers of Europe and Asia, no trick questions"
            className={FIELD}
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className={`${LABEL} mb-2`}>Levels</legend>
          {DIFFICULTIES.map((d) => (
            <div key={d} className="flex items-center gap-3">
              <label className="flex min-h-11 min-w-28 items-center gap-2 text-lg">
                <input
                  type="checkbox"
                  checked={levels[d].on}
                  onChange={(event) => setLevel(d, { on: event.target.checked })}
                  className="size-5"
                />
                {DIFFICULTY_LABELS[d]}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={GENERATE_COUNT_MIN}
                max={GENERATE_COUNT_MAX}
                value={levels[d].count}
                onChange={(event) => setLevel(d, { count: event.target.value })}
                disabled={!levels[d].on}
                aria-label={`${DIFFICULTY_LABELS[d]} questions`}
                className={`${FIELD} w-24`}
              />
              <span className="text-muted">questions</span>
            </div>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="text-lg text-buzz">
            {error}
          </p>
        )}
        <button type="submit" className={`${BUTTON_PRIMARY} text-xl`}>
          {sending ? 'Starting…' : 'Generate'}
        </button>
      </fieldset>
    </form>
  );
}

// ---------- The category list ----------

/** One row: a set of the category, or a level its job has not saved (generating or failed). */
type Row =
  | { kind: 'set'; level: AdminCategoryLevel; status: LevelStatus }
  | { kind: 'pending'; difficulty: Difficulty; status: 'generating' | 'failed' };

function rowsOf(category: AdminCategory): Row[] {
  const job = category.job;
  const running = job !== null && job.state !== 'failed' && job.state !== 'done';
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

type CardError = { text: string; problems?: string[]; setId?: string };

function CategoryCard({ category, busy, blocked, onChanged, onStarted }: CategoryCardProps) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<CardError | null>(null);
  const job = category.job;
  const generatingHere = job !== null && job.state !== 'done' && job.state !== 'failed';
  const drafts = category.levels.filter((l) => l.status !== 'live').length;
  const headingId = `category-${category.name.replace(/\W+/g, '-')}`;

  function act(run: () => Promise<CardError | null>) {
    setWorking(true);
    setError(null);
    run().then(
      (problem) => {
        setWorking(false);
        setError(problem);
        onChanged();
      },
      (err: unknown) => {
        setWorking(false);
        setError({ text: message(err) });
        onChanged();
      },
    );
  }

  const publish = () =>
    act(async () => {
      const result = await publishCategory(category.name);
      if (result.ok) return null;
      return { text: result.error, problems: result.problems, setId: result.setId };
    });

  const remove = () =>
    act(async () => {
      await deleteCategory(category.name);
      return null;
    });

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
        setError({ text: message(err) });
      },
    );
  }

  return (
    <li aria-labelledby={headingId} className={`flex flex-col gap-3 ${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={headingId} className="mr-auto font-display text-xl">
          {category.name}
        </h3>
        <ConfirmButton
          label="Publish all"
          confirmLabel={`Publish ${drafts} ${drafts === 1 ? 'set' : 'sets'}`}
          ariaLabel={`Publish all of ${category.name}`}
          onConfirm={publish}
          disabled={working || generatingHere || drafts === 0}
          className={BUTTON_SMALL}
        />
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
              <Link to={`/admin/sets/${row.level.setId}`} className={`${LINK} text-lg text-ink`}>
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
        <div role="alert" className="flex flex-col gap-1 text-buzz">
          <p>{error.text}</p>
          {error.problems && (
            <ul className="list-disc pl-6">
              {error.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {error.setId && (
            <Link to={`/admin/sets/${error.setId}`} className={LINK}>
              Open it in the editor
            </Link>
          )}
        </div>
      )}
    </li>
  );
}

// ---------- The dashboard ----------

type Outcome = { kind: 'done' | 'failed'; text: string } | null;

/** Why generation cannot start now, or null. */
function blockedBy(generation: AdminCategoriesResponse['generation']): string | null {
  if (!generation.enabled) {
    return `${GENERATION_OFF_TEXT}: the server has no BUZZR_ANTHROPIC_API_KEY.`;
  }
  if (generation.usedToday >= generation.dailyLimit) {
    return `${DAILY_LIMIT_TEXT}: ${generation.dailyLimit} levels a day. Try again tomorrow (UTC).`;
  }
  return null;
}

/**
 * The signed-in admin's dashboard below the session card (F111): Add category, the progress of a
 * running generation, and the category list with each level's status and actions.
 */
export function AdminCategories() {
  const [data, setData] = useState<AdminCategoriesResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [job, setJob] = useState<GenerateJob | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const mounted = useRef(true);

  const refresh = useCallback(() => {
    loadCategories().then(
      (next) => {
        if (!mounted.current) return;
        setData(next);
        setLoadError(null);
        const running = next.generation.running;
        // A job started elsewhere (another tab, before a reload) is followed too.
        if (running) {
          setJobId((current) => current ?? running.id);
          setJob((current) => current ?? running);
        }
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

  // Polls the job every 2 s until it is done or failed, then refreshes the list.
  useEffect(() => {
    if (jobId === null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const poll = () => {
      timer = setTimeout(() => {
        loadJob(jobId).then(
          (next) => {
            if (stopped) return;
            setJob(next);
            if (next.state === 'done' || next.state === 'failed') {
              setJobId(null);
              setJob(null);
              setOutcome(
                next.state === 'done'
                  ? { kind: 'done', text: doneText(next) }
                  : { kind: 'failed', text: `Generation failed: ${next.error ?? 'unknown error'}` },
              );
              refresh();
            } else {
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

  const started = (id: string) => {
    setOutcome(null);
    setJob(null);
    setJobId(id);
    refresh();
  };

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
  const busy = jobId !== null;
  const blocked = blockedBy(generation);
  const formBlocked =
    blocked ?? (busy ? 'A generation is running. The form opens again when it ends.' : null);
  const left = Math.max(0, generation.dailyLimit - generation.usedToday);

  return (
    <>
      <AddCategoryForm
        names={data.categories.map((c) => c.name)}
        blocked={formBlocked}
        onSubmit={() => setOutcome(null)}
        onStarted={started}
      />
      {generation.enabled && (
        <p className="-mt-3 text-muted">
          {left} of {generation.dailyLimit} levels left today (UTC).
        </p>
      )}
      <div role="status" aria-live="polite" className="empty:hidden">
        {busy && (
          <p className={`${CARD} p-4 text-lg`}>
            <strong>Generating {job?.category ?? '…'}</strong>
            {job && <>: {jobProgress(job)}</>}
          </p>
        )}
        {!busy && outcome?.kind === 'done' && <p className="text-lg">{outcome.text}</p>}
      </div>
      {!busy && outcome?.kind === 'failed' && (
        <p role="alert" className="text-lg text-buzz">
          {outcome.text}
        </p>
      )}
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

/** "Rivers is ready: 3 levels saved as drafts, 1 short." */
function doneText(job: GenerateJob): string {
  const n = job.finished.length;
  const what = job.kind === 'regenerate' ? 'written again as a draft' : 'saved as drafts';
  const levels = `${n} ${n === 1 ? 'level' : 'levels'} ${what}`;
  const short = job.short.length > 0 ? `, ${job.short.length} short` : '';
  return `${job.category} is ready: ${levels}${short} (${cost(job.usage.costUsd)}).`;
}
