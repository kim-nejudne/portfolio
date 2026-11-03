import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ANSWER_MAX,
  DIFFICULTY_LABELS,
  GENERATE_NOTE_MAX,
  HOST_NOTES_MAX,
  QUESTION_TEXT_MAX,
} from '../../../shared/constants.js';
import { questionSchema } from '../../../shared/schemas.js';
import type {
  AdminCategoriesResponse,
  DraftQuestionBody,
  GenerateJob,
  Question,
  QuestionSet,
} from '../../../shared/types.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { PageShell } from '../components/PageShell.js';
import { loadDraft } from '../lib/adminBuiltIns.js';
import {
  cancelJob,
  categoryKey,
  categoryRoute,
  loadCategories,
  loadSetJobs,
  markReviewed,
  removeQuestion,
  saveQuestion,
  startReplace,
} from '../lib/adminCategories.js';
import {
  addJobs,
  cardJob,
  follow,
  followedActive,
  ordinal,
  queuedCount,
  started,
  withArrived,
  type CardJob,
  type FollowedJobs,
} from '../lib/levelJobs.js';
import { useAdminSession } from '../lib/adminSession.js';
import {
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_PRIMARY_SMALL,
  BUTTON_SECONDARY,
  BUTTON_SMALL,
  CARD,
  FIELD,
  LABEL,
  LINK,
  PILL,
} from '../lib/ui.js';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** How often the list reads its jobs while one is queued or running (F118), as on the dashboard. */
const JOB_POLL_MS = 2000;
/** Polls missed in a row before the page says it cannot reach the server. */
const MISSES_SHOWN = 3;

/** Whether Replace and Add can start a job: yes, not today (the cap), or never (no API key). */
type CanReplace = 'yes' | 'limit' | 'off';

/** Undo's body: the old question's text, answer and notes, through the per-question PUT. */
function undoBody(old: Question): DraftQuestionBody {
  return old.hostNotes
    ? { text: old.text, answer: old.answer, hostNotes: old.hostNotes }
    : { text: old.text, answer: old.answer };
}

/** The level's name in "Mark <level> reviewed": its difficulty, or the set's title without one. */
function levelName(set: QuestionSet): string {
  return set.difficulty ? DIFFICULTY_LABELS[set.difficulty] : set.title.trim() || 'Untitled set';
}

type Fields = { text: string; answer: string; hostNotes: string };
type FieldErrors = Partial<Record<keyof Fields, string>>;

/**
 * The edited fields checked by the shared question schema, as the server will check them on
 * Publish: the body to send, or each field's first problem.
 */
export function checkEdit(
  question: Question,
  fields: Fields,
): { ok: true; body: DraftQuestionBody } | { ok: false; errors: FieldErrors } {
  const notes = fields.hostNotes.trim();
  const parsed = questionSchema.safeParse({
    ...question,
    text: fields.text,
    answer: fields.answer,
    hostNotes: notes || undefined,
  });
  if (parsed.success) {
    const { text, answer, hostNotes } = parsed.data;
    return { ok: true, body: hostNotes ? { text, answer, hostNotes } : { text, answer } };
  }
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (field === 'text' || field === 'answer' || field === 'hostNotes') {
      errors[field] ??= issue.message;
    }
  }
  return { ok: false, errors };
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  max: number;
  error?: string;
  multiline?: boolean;
  disabled?: boolean;
  hint?: string;
  onChange: (value: string) => void;
}

function Field({ id, label, value, max, error, multiline, disabled, hint, onChange }: FieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  const props = {
    id,
    value,
    maxLength: max,
    disabled,
    'aria-invalid': error !== undefined,
    'aria-describedby': describedBy || undefined,
    className: FIELD,
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        <span className="text-sm text-muted" aria-hidden="true">
          {value.length}/{max}
        </span>
      </div>
      {multiline ? (
        <textarea
          rows={3}
          {...props}
          className={`${FIELD} md:field-sizing-content`}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input {...props} onChange={(event) => onChange(event.target.value)} />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-buzz">
          {error}
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-5 shrink-0 rounded-full border-[3px] border-accent border-t-transparent motion-safe:animate-spin"
    />
  );
}

interface NoteFormProps {
  id: string;
  label: string;
  submitLabel: string;
  /** Starts the job; a refusal rejects with the server's message, shown under the form. */
  onSubmit: (note: string) => Promise<void>;
  onCancel: () => void;
}

/** Replace's and Add's optional note for the writer ("too easy"), at most 200 characters. */
function NoteForm({ id, label, submitLabel, onSubmit, onCancel }: NoteFormProps) {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setSending(true);
        setError(null);
        // On success the parent closes the form.
        onSubmit(note).catch((err: unknown) => {
          setSending(false);
          setError(message(err));
        });
      }}
    >
      <Field id={id} label={label} value={note} max={GENERATE_NOTE_MAX} onChange={setNote} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={sending} className={BUTTON_PRIMARY_SMALL}>
          {sending ? 'Sending…' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={sending} className={BUTTON_SMALL}>
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-buzz">
          {error}
        </p>
      )}
    </form>
  );
}

interface JobLineProps {
  job: Extract<CardJob, { kind: 'queued' | 'running' }>;
  /** What is being done, for the running line and the Cancel button's name. */
  doing: string;
  cancelLabel: string;
  cancelling: boolean;
  onCancel: () => void;
}

/** "Queued · 2nd" or a spinner while it runs, with Cancel. */
function JobLine({ job, doing, cancelLabel, cancelling, onCancel }: JobLineProps) {
  let text: string;
  if (cancelling) text = 'Cancelling…';
  else if (job.kind === 'running') text = `${doing}…`;
  else text = job.position === null ? 'Queued' : `Queued · ${ordinal(job.position)}`;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p role="status" className="mr-auto flex items-center gap-2 font-semibold">
        {job.kind === 'running' && <Spinner />}
        {text}
      </p>
      <button
        type="button"
        onClick={onCancel}
        disabled={cancelling}
        aria-label={cancelLabel}
        className={BUTTON_SMALL}
      >
        Cancel
      </button>
    </div>
  );
}

interface CardProps {
  setId: string;
  question: Question;
  number: number;
  job: CardJob | null;
  canReplace: CanReplace;
  cancelling: boolean;
  onSaved: (question: Question) => void;
  onRemoved: () => void;
  onReplace: (note: string) => Promise<void>;
  onCancelJob: (jobId: string) => Promise<void>;
  onUndo: (jobId: string, old: Question) => Promise<void>;
}

function QuestionCard({
  setId,
  question,
  number,
  job,
  canReplace,
  cancelling,
  onSaved,
  onRemoved,
  onReplace,
  onCancelJob,
  onUndo,
}: CardProps) {
  // null while the card only shows the question.
  const [fields, setFields] = useState<Fields | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const base = `q-${question.id}`;
  const choice = question.mode === 'choice';
  // A queued or running replacement owns the question until it ends.
  const pending = job?.kind === 'queued' || job?.kind === 'running';

  function edit() {
    setFields({
      text: question.text,
      answer: question.answer,
      hostNotes: question.hostNotes ?? '',
    });
    setErrors({});
    setError(null);
  }

  function cancel() {
    setFields(null);
    setErrors({});
    setError(null);
  }

  function save() {
    if (!fields) return;
    const checked = checkEdit(question, fields);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setError(null);
    setWorking(true);
    saveQuestion(setId, question.id, checked.body).then(
      (set) => {
        setWorking(false);
        const saved = set.questions.find((q) => q.id === question.id);
        setFields(null);
        if (saved) onSaved(saved);
      },
      (err: unknown) => {
        // The edit stays open, with what the admin typed, under the server's message.
        setWorking(false);
        setError(message(err));
      },
    );
  }

  function remove() {
    setError(null);
    setWorking(true);
    removeQuestion(setId, question.id).then(onRemoved, (err: unknown) => {
      setWorking(false);
      setError(message(err));
    });
  }

  /** Cancel, or Undo: the button stays busy until the answer, and a refusal shows on the card. */
  function act(run: () => Promise<void>) {
    setError(null);
    setWorking(true);
    run().then(
      () => setWorking(false),
      (err: unknown) => {
        setWorking(false);
        setError(message(err));
      },
    );
  }

  const heading = `Question ${number}`;
  return (
    <li>
      <article aria-label={heading} className={`flex flex-col gap-3 ${CARD} p-4 md:p-6`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="font-display text-xl">{heading}</h2>
          <span className="mr-auto text-muted">{question.points} points</span>
          {job?.kind === 'added' && <span className={`${PILL} px-3 py-1 text-sm`}>Added</span>}
          {fields === null && !replacing && (
            <>
              <button
                type="button"
                onClick={edit}
                disabled={working || pending}
                aria-label={`Edit question ${number}`}
                className={BUTTON_SMALL}
              >
                Edit
              </button>
              <ConfirmButton
                label="Remove"
                confirmLabel="Confirm remove"
                ariaLabel={`Remove question ${number}`}
                onConfirm={remove}
                disabled={working || pending}
                className={BUTTON_DANGER}
                cancelClassName={BUTTON_SMALL}
              />
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setReplacing(true);
                }}
                disabled={working || pending || canReplace !== 'yes'}
                aria-label={canReplace === 'limit' ? undefined : `Replace question ${number}`}
                className={BUTTON_SMALL}
              >
                {canReplace === 'limit' ? 'Daily limit reached' : 'Replace'}
              </button>
            </>
          )}
        </div>

        {(job?.kind === 'queued' || job?.kind === 'running') && (
          <JobLine
            job={job}
            doing="Writing a new question"
            cancelLabel={`Cancel replacing question ${number}`}
            cancelling={cancelling || working}
            onCancel={() => act(() => onCancelJob(job.jobId))}
          />
        )}
        {job?.kind === 'replaced' && (
          <div className="flex flex-wrap items-center gap-3">
            <p role="status" className="mr-auto font-semibold text-win">
              Replaced
            </p>
            <button
              type="button"
              onClick={() => act(() => onUndo(job.jobId, job.old))}
              disabled={working}
              aria-label={`Undo replacing question ${number}`}
              className={BUTTON_SMALL}
            >
              Undo
            </button>
          </div>
        )}
        {job?.kind === 'failed' && (
          <p role="alert" className="text-buzz">
            The replacement failed: {job.error}
          </p>
        )}
        {replacing && (
          <NoteForm
            id={`${base}-note`}
            label="Why replace? (optional)"
            submitLabel="Replace"
            onCancel={() => setReplacing(false)}
            onSubmit={(note) => onReplace(note).then(() => setReplacing(false))}
          />
        )}

        {fields === null ? (
          <dl className="flex flex-col gap-2">
            <div>
              <dt className="sr-only">Question</dt>
              <dd className="text-lg whitespace-pre-wrap">
                {question.text || <span className="text-muted">(Picture only)</span>}
              </dd>
            </div>
            <div>
              <dt className={LABEL}>Answer</dt>
              <dd className="text-lg font-bold whitespace-pre-wrap">{question.answer}</dd>
            </div>
            {question.hostNotes && (
              <div>
                <dt className={LABEL}>{question.mode === 'typed' ? 'Also accepted' : 'Notes'}</dt>
                <dd className="whitespace-pre-wrap text-muted">{question.hostNotes}</dd>
              </div>
            )}
          </dl>
        ) : (
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <Field
              id={`${base}-text`}
              label="Question"
              multiline
              value={fields.text}
              max={QUESTION_TEXT_MAX}
              error={errors.text}
              onChange={(text) => setFields({ ...fields, text })}
            />
            <Field
              id={`${base}-answer`}
              label="Answer"
              value={fields.answer}
              max={ANSWER_MAX}
              error={errors.answer}
              disabled={choice}
              hint={
                choice
                  ? "A choice question's answer is its correct choice. Change the choices in the full editor."
                  : undefined
              }
              onChange={(answer) => setFields({ ...fields, answer })}
            />
            <Field
              id={`${base}-notes`}
              // A typed question's notes are its other accepted answers (F87), as in the editor.
              label={
                question.mode === 'typed' ? 'Other accepted answers (optional)' : 'Notes (optional)'
              }
              multiline
              value={fields.hostNotes}
              max={HOST_NOTES_MAX}
              error={errors.hostNotes}
              onChange={(hostNotes) => setFields({ ...fields, hostNotes })}
            />
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={working} className={`${BUTTON_PRIMARY} py-3 text-lg`}>
                {working ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={working}
                className={BUTTON_SECONDARY}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="text-buzz">
            {error}
          </p>
        )}
      </article>
    </li>
  );
}

type Loaded =
  | { kind: 'loading' }
  | { kind: 'failed'; error: string }
  | { kind: 'missing' }
  | { kind: 'live'; set: QuestionSet }
  | { kind: 'draft'; set: QuestionSet; reviewed: boolean };

const NONE_FOLLOWED: FollowedJobs = new Map();

/** The day's replacements, from the category list's `generation`. */
interface Allowance {
  enabled: boolean;
  usedToday: number;
  dailyLimit: number;
}

const allowanceOf = (catalog: AdminCategoriesResponse): Allowance => ({
  enabled: catalog.generation.enabled,
  ...catalog.generation.replacements,
});

function LevelReview({ name, setId }: { name: string; setId: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // The replacements and additions followed on this visit (F118). The ref is the truth for async
  // answers; the state renders it. Undo lasts as long as this page does.
  const followedRef = useRef<FollowedJobs>(NONE_FOLLOWED);
  const [followed, setFollowedState] = useState<FollowedJobs>(NONE_FOLLOWED);
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [cancelling, setCancelling] = useState<ReadonlySet<string>>(new Set());
  const [misses, setMisses] = useState(0);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const setFollowed = useCallback((next: FollowedJobs) => {
    followedRef.current = next;
    setFollowedState(next);
  }, []);

  // Each change applies to the latest list, not the one a render saw: another card may have been
  // saved or removed meanwhile.
  const changeQuestions = useCallback(
    (change: (questions: Question[]) => Question[]) =>
      setLoaded((now) =>
        now.kind === 'draft'
          ? { ...now, set: { ...now.set, questions: change(now.set.questions) } }
          : now,
      ),
    [],
  );

  /** The day's count read again when a job starts, runs or ends; a miss keeps the last one. */
  const refreshAllowance = useCallback(() => {
    loadCategories().then(
      (catalog) => setAllowance(allowanceOf(catalog)),
      () => undefined,
    );
  }, []);

  /** Takes a poll's (or a cancel's) jobs: an ended replacement swaps in, an addition appends. */
  const take = useCallback(
    (jobs: readonly GenerateJob[]) => {
      const { followed: next, ended, changed } = follow(followedRef.current, jobs);
      if (!changed) return;
      setFollowed(next);
      for (const job of ended) changeQuestions((questions) => withArrived(questions, job));
      refreshAllowance();
    },
    [setFollowed, changeQuestions, refreshAllowance],
  );

  const poll = useCallback(() => {
    loadSetJobs(setId).then(
      (jobs) => {
        setMisses(0);
        take(jobs);
      },
      () => setMisses((n) => n + 1),
    );
  }, [setId, take]);

  useEffect(() => {
    let live = true;
    Promise.all([loadDraft(setId), loadCategories(), loadSetJobs(setId)]).then(
      ([draft, catalog, jobs]) => {
        if (!live) return;
        setFollowed(NONE_FOLLOWED);
        if (!draft) return setLoaded({ kind: 'missing' });
        if (!draft.draft) return setLoaded({ kind: 'live', set: draft.set });
        const level = catalog.categories
          .find((c) => categoryKey(c.name) === categoryKey(name))
          ?.levels.find((l) => l.setId === setId);
        setAllowance(allowanceOf(catalog));
        // Jobs queued or running from an earlier visit or another tab are followed from here.
        setFollowed(follow(new Map(), jobs).followed);
        setLoaded({ kind: 'draft', set: draft.set, reviewed: level?.reviewed ?? false });
      },
      (err: unknown) => {
        if (live) setLoaded({ kind: 'failed', error: message(err) });
      },
    );
    return () => {
      live = false;
    };
  }, [name, setId, attempt, setFollowed]);

  const busy = [...followed.values()].some(followedActive);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(poll, JOB_POLL_MS);
    return () => clearInterval(timer);
  }, [busy, poll]);

  const back = (
    <Link to={categoryRoute(name)} className={`${LINK} text-lg`}>
      Back to {name}
    </Link>
  );
  const editor = (
    <Link to={`/admin/sets/${encodeURIComponent(setId)}`} className={`${LINK} text-lg`}>
      Open in the full editor
    </Link>
  );

  if (loaded.kind === 'loading') return <p className="text-lg text-muted">Loading…</p>;
  if (loaded.kind === 'failed') {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl">Review</h1>
        <p role="alert" className="text-lg text-buzz">
          {loaded.error}
        </p>
        <button type="button" onClick={retry} className={BUTTON_SECONDARY}>
          Retry
        </button>
      </div>
    );
  }
  if (loaded.kind !== 'draft') {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl">
          {loaded.kind === 'live' ? loaded.set.title : 'Review'}
        </h1>
        <p className="text-lg">
          {loaded.kind === 'live'
            ? 'This set is live and has no draft to review.'
            : 'There is no set with this id.'}
        </p>
        <div className="flex flex-wrap gap-x-6">
          {back}
          {loaded.kind === 'live' && editor}
        </div>
      </div>
    );
  }

  const { set, reviewed } = loaded;
  const level = levelName(set);
  const left = allowance
    ? Math.max(0, allowance.dailyLimit - allowance.usedToday - queuedCount(followed))
    : 0;
  let canReplace: CanReplace = 'yes';
  if (!allowance?.enabled) canReplace = 'off';
  else if (left === 0) canReplace = 'limit';

  /** Replace (a question) or Add (null): the job is followed at once and polled. */
  async function start(questionId: string | null, note: string): Promise<void> {
    const jobId = await startReplace(setId, questionId, note);
    setFollowed(started(followedRef.current, jobId, questionId));
    poll();
  }

  async function cancel(jobId: string): Promise<void> {
    const job = await cancelJob(jobId);
    if (followedActive({ questionId: null, job, undone: false })) {
      setCancelling((now) => new Set(now).add(jobId));
    }
    take([job]);
  }

  async function undo(jobId: string, old: Question): Promise<void> {
    const saved = await saveQuestion(setId, old.id, undoBody(old));
    const back = saved.questions.find((q) => q.id === old.id);
    if (back) changeQuestions((questions) => questions.map((q) => (q.id === back.id ? back : q)));
    const entry = followedRef.current.get(jobId);
    if (entry) setFollowed(new Map(followedRef.current).set(jobId, { ...entry, undone: true }));
  }

  const adds = addJobs(followed);
  // A running job's cancel lands after its current API call: "Cancelling…" until a poll says so.
  const isCancelling = (jobId: string) => {
    const entry = followed.get(jobId);
    return cancelling.has(jobId) && entry !== undefined && followedActive(entry);
  };

  function mark() {
    setMarking(true);
    setMarkError(null);
    markReviewed(setId).then(
      () => {
        setMarking(false);
        setLoaded((now) => (now.kind === 'draft' ? { ...now, reviewed: true } : now));
      },
      (err: unknown) => {
        setMarking(false);
        setMarkError(message(err));
      },
    );
  }

  const count = set.questions.length;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl">{set.title.trim() || 'Untitled set'}</h1>
        <p className="text-muted">
          {count} {count === 1 ? 'question' : 'questions'}
        </p>
      </div>
      {count === 0 ? (
        <p className="text-lg text-muted">This level has no questions.</p>
      ) : (
        <ul aria-label="Questions" className="flex flex-col gap-4">
          {set.questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              setId={setId}
              question={question}
              number={index + 1}
              job={cardJob(followed, question.id)}
              canReplace={canReplace}
              cancelling={[...cancelling].some(
                (id) => followed.get(id)?.questionId === question.id && isCancelling(id),
              )}
              onReplace={(note) => start(question.id, note)}
              onCancelJob={cancel}
              onUndo={undo}
              onSaved={(saved) =>
                changeQuestions((questions) =>
                  questions.map((q) => (q.id === saved.id ? saved : q)),
                )
              }
              onRemoved={() =>
                changeQuestions((questions) => questions.filter((q) => q.id !== question.id))
              }
            />
          ))}
        </ul>
      )}
      <section aria-label="Add a question" className="flex flex-col gap-3">
        {adds.map((job, index) =>
          job.kind === 'failed' ? (
            <p key={job.jobId} role="alert" className="text-buzz">
              Could not add a question: {job.error}
            </p>
          ) : job.kind === 'queued' || job.kind === 'running' ? (
            <div key={job.jobId} className={`${CARD} p-4`}>
              <JobLine
                job={job}
                doing="Writing a new question"
                cancelLabel={`Cancel adding question ${index + 1}`}
                cancelling={isCancelling(job.jobId)}
                onCancel={() => {
                  setAddError(null);
                  cancel(job.jobId).catch((err: unknown) => setAddError(message(err)));
                }}
              />
            </div>
          ) : null,
        )}
        {adding ? (
          <div className={`${CARD} p-4`}>
            <NoteForm
              id="add-note"
              label="Anything the new question should be? (optional)"
              submitLabel="Add"
              onCancel={() => setAdding(false)}
              onSubmit={(note) => start(null, note).then(() => setAdding(false))}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setAdding(true);
            }}
            disabled={canReplace !== 'yes'}
            className={`${BUTTON_SECONDARY} self-start`}
          >
            {canReplace === 'limit' ? 'Daily limit reached' : 'Add a question'}
          </button>
        )}
        {addError && (
          <p role="alert" className="text-buzz">
            {addError}
          </p>
        )}
        <p className="text-muted">
          {canReplace === 'off'
            ? 'Replacing and adding questions needs generation, which is not set up on this server.'
            : `${left} of ${allowance?.dailyLimit ?? 0} replacements left today (UTC).`}
        </p>
        {misses >= MISSES_SHOWN && (
          <p role="alert" className="text-buzz">
            Cannot reach the server. Still trying every 2 seconds…
          </p>
        )}
      </section>
      <div className="flex flex-col gap-2">
        {reviewed ? (
          <p role="status" className="font-display text-xl text-win">
            ✓ Reviewed
          </p>
        ) : (
          <button
            type="button"
            onClick={mark}
            disabled={marking || busy}
            className={`${BUTTON_PRIMARY} text-xl`}
          >
            Mark {level} reviewed
          </button>
        )}
        {busy && (
          <p className="text-muted">
            Mark reviewed and the full editor wait until the replacements finish.
          </p>
        )}
        {markError && (
          <p role="alert" className="text-buzz">
            {markError}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-x-6">
        {back}
        {busy ? (
          // The editor saves the whole set, which would undo a replacement landing meanwhile.
          <span aria-disabled="true" className="text-lg text-muted">
            Open in the full editor
          </span>
        ) : (
          editor
        )}
      </div>
    </>
  );
}

/**
 * `/admin/categories/:name/:setId` (F117): a draft level's questions as cards, each edited in
 * place or removed through the per-question routes, never a whole-set save, then **Mark <level>
 * reviewed**. Each card can be replaced by Claude and one more added (F118): the jobs queue on the
 * server, the page polls them, and a finished one swaps in with Undo. Signed-in admin only.
 */
export function AdminLevel() {
  const session = useAdminSession();
  const { name = '', setId = '' } = useParams();
  return (
    <PageShell
      header={
        <Link to={categoryRoute(name)} className={`${LINK} text-lg`}>
          ← {name}
        </Link>
      }
    >
      {session.kind === 'signedIn' ? (
        <LevelReview name={name} setId={setId} />
      ) : (
        <>
          <h1 className="font-display text-3xl">Review</h1>
          {session.kind === 'loading' ? (
            <p className="text-muted">Loading…</p>
          ) : (
            <p role="alert" className="text-lg">
              Only the admin can review categories.{' '}
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
