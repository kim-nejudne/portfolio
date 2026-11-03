import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ANSWER_MAX,
  DIFFICULTY_LABELS,
  HOST_NOTES_MAX,
  QUESTION_TEXT_MAX,
} from '../../../shared/constants.js';
import { questionSchema } from '../../../shared/schemas.js';
import type { DraftQuestionBody, Question, QuestionSet } from '../../../shared/types.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { PageShell } from '../components/PageShell.js';
import { loadDraft } from '../lib/adminBuiltIns.js';
import {
  categoryKey,
  categoryRoute,
  loadCategories,
  markReviewed,
  removeQuestion,
  saveQuestion,
} from '../lib/adminCategories.js';
import { useAdminSession } from '../lib/adminSession.js';
import {
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  BUTTON_SMALL,
  CARD,
  FIELD,
  LABEL,
  LINK,
} from '../lib/ui.js';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

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

interface CardProps {
  setId: string;
  question: Question;
  number: number;
  onSaved: (question: Question) => void;
  onRemoved: () => void;
}

function QuestionCard({ setId, question, number, onSaved, onRemoved }: CardProps) {
  // null while the card only shows the question.
  const [fields, setFields] = useState<Fields | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `q-${question.id}`;
  const choice = question.mode === 'choice';

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

  const heading = `Question ${number}`;
  return (
    <li>
      <article aria-label={heading} className={`flex flex-col gap-3 ${CARD} p-4 md:p-6`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="font-display text-xl">{heading}</h2>
          <span className="mr-auto text-muted">{question.points} points</span>
          {fields === null && (
            <>
              <button
                type="button"
                onClick={edit}
                disabled={working}
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
                disabled={working}
                className={BUTTON_DANGER}
                cancelClassName={BUTTON_SMALL}
              />
            </>
          )}
        </div>

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

function LevelReview({ name, setId }: { name: string; setId: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    Promise.all([loadDraft(setId), loadCategories()]).then(
      ([draft, catalog]) => {
        if (!live) return;
        if (!draft) return setLoaded({ kind: 'missing' });
        if (!draft.draft) return setLoaded({ kind: 'live', set: draft.set });
        const level = catalog.categories
          .find((c) => categoryKey(c.name) === categoryKey(name))
          ?.levels.find((l) => l.setId === setId);
        setLoaded({ kind: 'draft', set: draft.set, reviewed: level?.reviewed ?? false });
      },
      (err: unknown) => {
        if (live) setLoaded({ kind: 'failed', error: message(err) });
      },
    );
    return () => {
      live = false;
    };
  }, [name, setId, attempt]);

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
  // Each change applies to the latest list, not the one this render saw: another card may have
  // been saved or removed meanwhile.
  const changeQuestions = (change: (questions: Question[]) => Question[]) =>
    setLoaded((now) =>
      now.kind === 'draft'
        ? { ...now, set: { ...now.set, questions: change(now.set.questions) } }
        : now,
    );

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
      <div className="flex flex-col gap-2">
        {reviewed ? (
          <p role="status" className="font-display text-xl text-win">
            ✓ Reviewed
          </p>
        ) : (
          <button
            type="button"
            onClick={mark}
            disabled={marking}
            className={`${BUTTON_PRIMARY} text-xl`}
          >
            Mark {level} reviewed
          </button>
        )}
        {markError && (
          <p role="alert" className="text-buzz">
            {markError}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-x-6">
        {back}
        {editor}
      </div>
    </>
  );
}

/**
 * `/admin/categories/:name/:setId` (F117): a draft level's questions as cards, each edited in
 * place or removed through the per-question routes, never a whole-set save, then **Mark <level>
 * reviewed**. Signed-in admin only, like the category review.
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
