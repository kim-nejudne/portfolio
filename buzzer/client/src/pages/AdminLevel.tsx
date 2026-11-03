import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
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
import { QuestionPreview } from '../components/QuestionPreview.js';
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
  progressLine,
  queuedCount,
  started,
  withArrived,
  type CardJob,
  type FollowedJobs,
} from '../lib/levelJobs.js';
import {
  CANCEL_HINT,
  FORM_KEYS,
  REVIEW_KEYS,
  formAction,
  isTyping,
  reviewAction,
  saveHint,
  stepCard,
  type ReviewAction,
} from '../lib/reviewKeys.js';
import { reviewWarnings, warningCount, type ReviewLevel } from '../lib/reviewWarnings.js';
import { useDesktopLayout } from '../lib/useMediaQuery.js';
import { usePointerFine } from '../lib/usePointerFine.js';
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

/** A shortcut's hint after a button's label (F125); the button's name stays the label. */
function Kbd({ children }: { children: string }) {
  return (
    <kbd aria-hidden="true" className="ml-2 font-mono text-sm opacity-70">
      {children}
    </kbd>
  );
}

/** The Save hint for this device: ⌘+Enter on Apple, else Ctrl+Enter. */
const SAVE_HINT = saveHint(typeof navigator === 'undefined' ? '' : navigator.platform);

/**
 * Ctrl/⌘+Enter and Esc in a form (F125), when the keys are on. `save` and `cancel` do nothing
 * while the form is busy.
 */
function formKeys(keysOn: boolean, save: (form: HTMLFormElement) => void, cancel: () => void) {
  if (!keysOn) return undefined;
  return (event: KeyboardEvent<HTMLFormElement>) => {
    const action = formAction(event);
    if (!action) return;
    event.preventDefault();
    if (action === 'save') save(event.currentTarget);
    else cancel();
  };
}

/** The card's button for a page shortcut: the key handler clicks it, so disabled stays inert. */
const keyTarget = (action: ReviewAction) => ({ 'data-review-key': action });

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
  /** The F125 keys are on: Ctrl/⌘+Enter sends, Esc cancels, with hints on the buttons. */
  keysOn: boolean;
}

/** Replace's and Add's optional note for the writer ("too easy"), at most 200 characters. */
function NoteForm({ id, label, submitLabel, onSubmit, onCancel, keysOn }: NoteFormProps) {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      data-review-form=""
      className="flex flex-col gap-3"
      onKeyDown={formKeys(
        keysOn,
        (form) => {
          if (!sending) form.requestSubmit();
        },
        () => {
          if (!sending) onCancel();
        },
      )}
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
        <button
          type="submit"
          disabled={sending}
          aria-keyshortcuts={keysOn ? FORM_KEYS.save.aria : undefined}
          className={BUTTON_PRIMARY_SMALL}
        >
          {sending ? 'Sending…' : submitLabel}
          {keysOn && !sending && <Kbd>{SAVE_HINT}</Kbd>}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={sending}
          aria-keyshortcuts={keysOn ? FORM_KEYS.cancel.aria : undefined}
          className={BUTTON_SMALL}
        >
          Cancel
          {keysOn && <Kbd>{CANCEL_HINT}</Kbd>}
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
  /** Duplicate and long-text warnings (F123), shown under the question; they never block. */
  warnings: readonly string[];
  canReplace: CanReplace;
  cancelling: boolean;
  onSaved: (question: Question) => void;
  onRemoved: () => void;
  /** Opens the Screen's render of this question (F124). */
  onPreview: () => void;
  onReplace: (note: string) => Promise<void>;
  onCancelJob: (jobId: string) => Promise<void>;
  onUndo: (jobId: string, old: Question) => Promise<void>;
  /** The F125 shortcuts are on: hints on the buttons, and Ctrl/⌘+Enter and Esc in the forms. */
  keysOn: boolean;
}

function QuestionCard({
  setId,
  question,
  number,
  job,
  warnings,
  canReplace,
  cancelling,
  onSaved,
  onRemoved,
  onPreview,
  onReplace,
  onCancelJob,
  onUndo,
  keysOn,
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
  const article = useRef<HTMLElement>(null);
  const editing = fields !== null;
  const formOpen = editing || replacing;
  const wasOpen = useRef(false);

  // An opened form takes focus at its first field, since its button is gone. A closed one gives it
  // back to the card if it was lost with the form, so j/k (F125) go on from this card.
  useEffect(() => {
    if (formOpen && !wasOpen.current) {
      document.getElementById(editing ? `${base}-text` : `${base}-note`)?.focus();
    } else if (!formOpen && wasOpen.current) {
      const now = document.activeElement;
      if (!now || now === document.body || !now.isConnected) {
        article.current?.focus({ preventScroll: true });
      }
    }
    wasOpen.current = formOpen;
  }, [formOpen, editing, base]);

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
      <article
        ref={article}
        aria-label={heading}
        // Focusable for j/k and for focus coming back from a closed form (F125). The scroll margins
        // keep a card clear of the sticky footer when it is scrolled into view.
        tabIndex={-1}
        data-review-card=""
        className={`flex scroll-mt-4 scroll-mb-40 flex-col gap-3 ${CARD} p-4 md:p-6`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="font-display text-xl">{heading}</h2>
          <span className="mr-auto text-muted">{question.points} points</span>
          {job?.kind === 'added' && <span className={`${PILL} px-3 py-1 text-sm`}>Added</span>}
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
            keysOn={keysOn}
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
            data-review-form=""
            className="flex flex-col gap-3"
            onKeyDown={formKeys(
              keysOn,
              () => {
                if (!working) save();
              },
              () => {
                if (!working) cancel();
              },
            )}
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
              <button
                type="submit"
                disabled={working}
                aria-keyshortcuts={keysOn ? FORM_KEYS.save.aria : undefined}
                className={`${BUTTON_PRIMARY} py-3 text-lg`}
              >
                {working ? 'Saving…' : 'Save'}
                {keysOn && !working && <Kbd>{SAVE_HINT}</Kbd>}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={working}
                aria-keyshortcuts={keysOn ? FORM_KEYS.cancel.aria : undefined}
                className={BUTTON_SECONDARY}
              >
                Cancel
                {keysOn && <Kbd>{CANCEL_HINT}</Kbd>}
              </button>
            </div>
          </form>
        )}

        {fields === null && warnings.length > 0 && (
          <ul aria-label={`Warnings for question ${number}`} className="flex flex-col gap-1">
            {warnings.map((line) => (
              <li key={line} className="font-semibold text-warn">
                <span aria-hidden="true">⚠ </span>
                {line}
              </li>
            ))}
          </ul>
        )}

        {fields === null && !replacing && (
          // Edit · Replace · Preview · Remove, the destructive one last (ADM-04).
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={edit}
              disabled={working || pending}
              aria-label={`Edit question ${number}`}
              aria-keyshortcuts={keysOn ? REVIEW_KEYS.edit.aria : undefined}
              className={BUTTON_SMALL}
              {...keyTarget('edit')}
            >
              Edit
              {keysOn && <Kbd>{REVIEW_KEYS.edit.hint}</Kbd>}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setReplacing(true);
              }}
              disabled={working || pending || canReplace !== 'yes'}
              aria-label={canReplace === 'limit' ? undefined : `Replace question ${number}`}
              aria-keyshortcuts={
                keysOn && canReplace === 'yes' ? REVIEW_KEYS.replace.aria : undefined
              }
              className={BUTTON_SMALL}
              {...keyTarget('replace')}
            >
              {canReplace === 'limit' ? 'Daily limit reached' : 'Replace'}
              {keysOn && canReplace === 'yes' && <Kbd>{REVIEW_KEYS.replace.hint}</Kbd>}
            </button>
            <button
              type="button"
              id={previewId(question.id)}
              onClick={onPreview}
              aria-label={`Preview question ${number}`}
              aria-keyshortcuts={keysOn ? REVIEW_KEYS.preview.aria : undefined}
              className={BUTTON_SMALL}
              {...keyTarget('preview')}
            >
              Preview
              {keysOn && <Kbd>{REVIEW_KEYS.preview.hint}</Kbd>}
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
          </div>
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

/** A card's Preview button, where focus lands when the preview closes on that question. */
const previewId = (questionId: string) => `q-${questionId}-preview`;

const NONE_FOLLOWED: FollowedJobs = new Map();
const NO_WARNINGS: readonly string[] = [];

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
  // The questions saved through Edit on this visit, for the footer's "1 edited".
  const [edited, setEdited] = useState<ReadonlySet<string>>(new Set());
  // The category's other levels, for the duplicate warnings (F123); one that fails to load is left out.
  const [others, setOthers] = useState<readonly ReviewLevel[]>([]);
  // The question the Screen preview shows (F124), null while it is closed.
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  // The question shown when the preview closed: focus goes to its card's Preview button.
  const focusAfterPreview = useRef<string | null>(null);
  // A reload or an arriving job that shortens the list under the preview closes it, so the app
  // root is never left inert with no dialog to close.
  const shownCount = loaded.kind === 'draft' ? loaded.set.questions.length : 0;
  if (previewIndex !== null && previewIndex >= shownCount) setPreviewIndex(null);
  const previewing = previewIndex !== null && previewIndex < shownCount;

  // The preview covers the window, but the admin header and list pane sit outside this page, so
  // the whole app behind it is inert while it is open. On close, focus goes to the Preview button
  // of the question last shown (←/→ may have moved on from the one that opened it).
  useEffect(() => {
    if (!previewing) {
      const id = focusAfterPreview.current;
      focusAfterPreview.current = null;
      if (id) document.getElementById(previewId(id))?.focus();
      return;
    }
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    return () => root?.removeAttribute('inert');
  }, [previewing]);

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
        const levels =
          catalog.categories.find((c) => categoryKey(c.name) === categoryKey(name))?.levels ?? [];
        const level = levels.find((l) => l.setId === setId);
        // Each other level as hosts will get it next: its draft when it has one, else live.
        Promise.all(
          levels
            .filter((l) => l.setId !== setId)
            .map((l) => loadDraft(l.setId).catch(() => undefined)),
        ).then((sets) => {
          if (!live) return;
          setOthers(
            sets.flatMap((other) =>
              other ? [{ name: levelName(other.set), questions: other.set.questions }] : [],
            ),
          );
        });
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

  const draftSet = loaded.kind === 'draft' ? loaded.set : null;
  const warnings = useMemo(
    () =>
      draftSet
        ? reviewWarnings({ name: levelName(draftSet), questions: draftSet.questions }, others)
        : new Map<string, string[]>(),
    [draftSet, others],
  );

  const busy = [...followed.values()].some(followedActive);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(poll, JOB_POLL_MS);
    return () => clearInterval(timer);
  }, [busy, poll]);

  // Review shortcuts (F125): a laptop only, and held back while the preview (with its own keys)
  // is open. The handler finds the cards and buttons in the page, so a disabled or hidden button
  // is never pressed by a key.
  const desktop = useDesktopLayout();
  const pointerFine = usePointerFine();
  const keysOn = desktop && pointerFine;
  const listRef = useRef<HTMLUListElement>(null);
  const markRef = useRef<HTMLButtonElement>(null);
  const reviewing = loaded.kind === 'draft';
  useEffect(() => {
    if (!keysOn || !reviewing || previewing) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || isTyping(event.target)) return;
      // An open menu or dialog keeps its own keys.
      if (
        event.target instanceof Element &&
        event.target.closest('[role="menu"], [role="dialog"]')
      ) {
        return;
      }
      const action = reviewAction(event);
      if (!action) return;
      if (action === 'mark') {
        // Not with an edit or a note open: its unsaved text would be left behind.
        if (!markRef.current || document.querySelector('[data-review-form]')) return;
        event.preventDefault();
        markRef.current.click();
        return;
      }
      const cards = [
        ...(listRef.current?.querySelectorAll<HTMLElement>('[data-review-card]') ?? []),
      ];
      const focused = document.activeElement;
      const current = cards.findIndex((card) => card.contains(focused));
      if (action === 'next' || action === 'prev') {
        const to = stepCard(current, cards.length, action === 'next' ? 1 : -1);
        const card = to === null ? undefined : cards[to];
        if (!card) return;
        event.preventDefault();
        card.focus({ preventScroll: true });
        card.scrollIntoView?.({ block: 'nearest' });
        return;
      }
      const button = cards[current]?.querySelector<HTMLButtonElement>(
        `[data-review-key="${action}"]`,
      );
      if (!button) return;
      event.preventDefault();
      button.click();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [keysOn, reviewing, previewing]);

  // The category above the heading, as the way back, in every state and at every width (F122).
  const back = (
    <Link to={categoryRoute(name)} className={`${LINK} self-start text-lg`}>
      ← {name}
    </Link>
  );
  const editor = (
    <Link to={`/admin/sets/${encodeURIComponent(setId)}`} className={`${LINK} text-lg`}>
      Open in the full editor
    </Link>
  );

  if (loaded.kind === 'loading') {
    return (
      <>
        {back}
        <p className="text-lg text-muted">Loading…</p>
      </>
    );
  }
  if (loaded.kind === 'failed') {
    return (
      <div className="flex flex-col gap-3">
        {back}
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
        {back}
        <h1 className="font-display text-3xl">
          {loaded.kind === 'live' ? loaded.set.title : 'Review'}
        </h1>
        <p className="text-lg">
          {loaded.kind === 'live'
            ? 'This set is live and has no draft to review.'
            : 'There is no set with this id.'}
        </p>
        {loaded.kind === 'live' && editor}
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
  const progress = progressLine(followed, set.questions.filter((q) => edited.has(q.id)).length);
  const warned = warningCount(warnings);
  return (
    <>
      <div className="flex flex-col gap-1">
        {back}
        <h1 className="font-display text-3xl">{level}</h1>
        <p className="text-muted">
          {count} {count === 1 ? 'question' : 'questions'}
        </p>
        {keysOn && count > 0 && (
          <p className="text-sm text-muted">
            <kbd className="font-mono">{REVIEW_KEYS.next.hint}</kbd> or{' '}
            <kbd className="font-mono">↓</kbd> next question,{' '}
            <kbd className="font-mono">{REVIEW_KEYS.prev.hint}</kbd> or{' '}
            <kbd className="font-mono">↑</kbd> previous
          </p>
        )}
      </div>
      {count === 0 ? (
        <p className="text-lg text-muted">This level has no questions.</p>
      ) : (
        <ul ref={listRef} aria-label="Questions" className="flex flex-col gap-4">
          {set.questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              setId={setId}
              question={question}
              number={index + 1}
              job={cardJob(followed, question.id)}
              warnings={warnings.get(question.id) ?? NO_WARNINGS}
              canReplace={canReplace}
              cancelling={[...cancelling].some(
                (id) => followed.get(id)?.questionId === question.id && isCancelling(id),
              )}
              onPreview={() => setPreviewIndex(index)}
              onReplace={(note) => start(question.id, note)}
              onCancelJob={cancel}
              onUndo={undo}
              keysOn={keysOn}
              onSaved={(saved) => {
                setEdited((now) => new Set(now).add(saved.id));
                changeQuestions((questions) =>
                  questions.map((q) => (q.id === saved.id ? saved : q)),
                );
              }}
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
              keysOn={keysOn}
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
        {misses >= MISSES_SHOWN && (
          <p role="alert" className="text-buzz">
            Cannot reach the server. Still trying every 2 seconds…
          </p>
        )}
      </section>
      {busy && (
        <p className="text-muted">
          Mark reviewed and the full editor wait until the replacements finish.
        </p>
      )}
      {busy ? (
        // The editor saves the whole set, which would undo a replacement landing meanwhile.
        <span aria-disabled="true" className="self-start text-lg text-muted">
          Open in the full editor
        </span>
      ) : (
        <div className="self-start">{editor}</div>
      )}
      {/* In flow, not fixed: it sticks to the foot of the window (the detail pane at lg+) and,
          at the end of the page, sits after the content, so nothing can hide under it. */}
      <footer
        aria-label="Review progress"
        className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t-2 border-edge bg-bg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:gap-4 short:flex-row short:items-center short:gap-4 short:pt-2 short:pb-2 md:-mx-8 md:px-8"
      >
        {/* At `short:` the progress and what is left share one line, the latter in brief. */}
        <div className="flex min-w-0 flex-col sm:mr-auto short:mr-auto short:flex-row short:items-baseline short:gap-3">
          {progress && (
            <p role="status" className="font-semibold">
              {progress}
            </p>
          )}
          {warned > 0 && (
            <p className="font-semibold text-warn">
              {warned} {warned === 1 ? 'warning' : 'warnings'}
            </p>
          )}
          <p className="text-muted">
            <span className="short:hidden">
              {canReplace === 'off'
                ? 'Replacing and adding questions needs generation, which is not set up on this server.'
                : `${left} of ${allowance?.dailyLimit ?? 0} replacements left today (UTC).`}
            </span>
            <span className="hidden short:inline">
              {canReplace === 'off'
                ? 'No generation'
                : `${left} of ${allowance?.dailyLimit ?? 0} left today`}
            </span>
          </p>
          {markError && (
            <p role="alert" className="text-buzz">
              {markError}
            </p>
          )}
        </div>
        {reviewed ? (
          <p role="status" className="shrink-0 font-display text-xl text-win">
            ✓ Reviewed
          </p>
        ) : (
          <button
            ref={markRef}
            type="button"
            onClick={mark}
            disabled={marking || busy}
            aria-keyshortcuts={keysOn ? REVIEW_KEYS.mark.aria : undefined}
            className={`${BUTTON_PRIMARY} shrink-0 text-lg`}
          >
            Mark {level} reviewed
            {keysOn && <Kbd>{REVIEW_KEYS.mark.hint}</Kbd>}
          </button>
        )}
      </footer>
      {previewing &&
        // On the body, outside the inert app root.
        createPortal(
          <QuestionPreview
            set={set}
            index={previewIndex}
            onIndex={setPreviewIndex}
            onClose={() => {
              focusAfterPreview.current = set.questions[previewIndex]?.id ?? null;
              setPreviewIndex(null);
            }}
          />,
          document.body,
        )}
    </>
  );
}

/**
 * `/admin/categories/:name/:setId` (F117): a draft level's questions as cards, each edited in
 * place or removed through the per-question routes, never a whole-set save, then **Mark <level>
 * reviewed**. Each card can be replaced by Claude and one more added (F118): the jobs queue on the
 * server, the page polls them, and a finished one swaps in with Undo. Inside `AdminLayout`, which
 * lets only the signed-in admin through (F119).
 */
export function AdminLevel() {
  const { name = '', setId = '' } = useParams();
  return <LevelReview key={setId} name={name} setId={setId} />;
}
