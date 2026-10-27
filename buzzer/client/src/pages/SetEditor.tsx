import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ANSWER_MAX,
  HOST_NOTES_MAX,
  QUESTION_TEXT_MAX,
  SET_TITLE_MAX,
} from '../../../shared/constants.js';
import type { Question, QuestionSet } from '../../../shared/types.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { type SaveStatus, useAutosave } from '../lib/autosave.js';
import { getSet, saveSet } from '../lib/db.js';
import {
  addQuestion,
  canAddQuestion,
  duplicateQuestion,
  moveQuestion,
  parsePoints,
  POINTS_ERROR,
  QUESTION_CAP_MESSAGE,
  type QuestionErrors,
  questionErrors,
  removeQuestion,
  titleError,
} from '../lib/setEditor.js';

const LOAD_ERROR = 'Could not load this set in this browser.';

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: 'Saved',
  pending: 'Saving…',
  error: "Couldn't save. Your next change will try again.",
};

const smallButton =
  'rounded-xl border-2 border-edge px-3 py-2 text-base transition active:scale-95 disabled:opacity-40';
const field =
  'w-full rounded-xl border-2 border-edge bg-bg px-3 py-2 text-lg text-ink aria-invalid:border-red-400';

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'error' } | { state: 'ready' };

/** Set editor `/sets/:setId`. Every change is saved to this browser after 500 ms. */
export function SetEditor() {
  const { setId = '' } = useParams();
  // A new id gets a fresh editor, so no edit can land on the previous set's state.
  return <Editor key={setId} setId={setId} />;
}

function Editor({ setId }: { setId: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [set, setSet] = useState<QuestionSet | null>(null);
  // Errors show once a field has been left, so a fresh card is not red before it is written.
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const { status, schedule } = useAutosave((next: QuestionSet) => saveSet(next));

  useEffect(() => {
    let live = true;
    getSet(setId).then(
      (found) => {
        if (!live) return;
        setSet(found ?? null);
        setLoad({ state: found ? 'ready' : 'missing' });
      },
      () => live && setLoad({ state: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [setId]);

  if (load.state !== 'ready' || set === null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-10">
        <h1 className="font-display text-4xl text-accent">Edit set</h1>
        {load.state === 'loading' && <p className="text-muted">Loading…</p>}
        {load.state === 'missing' && <p role="alert">This set no longer exists.</p>}
        {load.state === 'error' && (
          <p role="alert" className="text-lg text-red-400">
            {LOAD_ERROR}
          </p>
        )}
        <BackLink />
      </main>
    );
  }

  const change = (next: QuestionSet) => {
    setSet(next);
    schedule(next);
  };
  const changeQuestions = (questions: Question[]) => change({ ...set, questions });
  const touch = (key: string) =>
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));

  const add = () => {
    const questions = addQuestion(set.questions);
    setFocusId(questions.at(-1)!.id);
    changeQuestions(questions);
  };

  const canAdd = canAddQuestion(set.questions);
  const titleProblem = touched.has('title') ? titleError(set.title) : undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BackLink />
        <p role="status" className={status === 'error' ? 'text-red-400' : 'text-muted'}>
          {STATUS_TEXT[status]}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-sm tracking-widest text-muted uppercase">Edit set</h1>
        <label htmlFor="set-title" className="sr-only">
          Set title
        </label>
        <input
          id="set-title"
          value={set.title}
          maxLength={SET_TITLE_MAX}
          onChange={(event) => change({ ...set, title: event.target.value })}
          onBlur={() => touch('title')}
          aria-invalid={titleProblem !== undefined}
          aria-describedby={titleProblem ? 'set-title-error' : undefined}
          className={`${field} font-display text-3xl`}
        />
        <FieldError id="set-title-error" message={titleProblem} />
      </div>

      {set.questions.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-edge p-8 text-center text-lg text-muted">
          No questions yet. Tap <strong className="text-ink">Add question</strong> to write the
          first.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {set.questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              number={index + 1}
              isFirst={index === 0}
              isLast={index === set.questions.length - 1}
              canDuplicate={canAdd}
              autoFocus={question.id === focusId}
              touched={touched}
              onTouch={touch}
              onChange={(next) =>
                changeQuestions(set.questions.map((q, i) => (i === index ? next : q)))
              }
              onMove={(delta) => changeQuestions(moveQuestion(set.questions, index, delta))}
              onDuplicate={() => changeQuestions(duplicateQuestion(set.questions, index))}
              onDelete={() => changeQuestions(removeQuestion(set.questions, index))}
            />
          ))}
        </ol>
      )}

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className="rounded-2xl bg-accent px-5 py-3 font-display text-xl text-accent-ink transition active:scale-95 disabled:opacity-40"
        >
          Add question
        </button>
        {!canAdd && <p className="text-muted">{QUESTION_CAP_MESSAGE}</p>}
      </div>
    </main>
  );
}

function BackLink() {
  return (
    <Link to="/sets" className="text-lg text-muted underline underline-offset-4 hover:text-ink">
      ← My question sets
    </Link>
  );
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="text-red-400">
      {message}
    </p>
  );
}

interface QuestionCardProps {
  question: Question;
  number: number;
  isFirst: boolean;
  isLast: boolean;
  canDuplicate: boolean;
  autoFocus: boolean;
  touched: ReadonlySet<string>;
  onTouch: (key: string) => void;
  onChange: (question: Question) => void;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function QuestionCard({
  question,
  number,
  isFirst,
  isLast,
  canDuplicate,
  autoFocus,
  touched,
  onTouch,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: QuestionCardProps) {
  // The field keeps what was typed; only a valid number reaches the saved question.
  const [pointsText, setPointsText] = useState(String(question.points));
  const pointsValid = parsePoints(pointsText).ok;
  const errors = questionErrors(question);
  const shown: QuestionErrors = {};
  for (const key of ['text', 'answer', 'hostNotes'] as const) {
    if (touched.has(`${question.id}:${key}`)) shown[key] = errors[key];
  }

  const base = `q-${question.id}`;
  const label = `Question ${number}`;

  const setNotes = (value: string) => {
    const next: Question = { ...question, hostNotes: value };
    if (value === '') delete next.hostNotes;
    onChange(next);
  };

  return (
    <li
      aria-label={label}
      className="flex flex-col gap-4 rounded-3xl border-2 border-edge bg-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl">{label}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-label={`Move question ${number} up`}
            onClick={() => onMove(-1)}
            disabled={isFirst}
            className={smallButton}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`Move question ${number} down`}
            onClick={() => onMove(1)}
            disabled={isLast}
            className={smallButton}
          >
            ↓
          </button>
          <button
            type="button"
            aria-label={`Duplicate question ${number}`}
            onClick={onDuplicate}
            disabled={!canDuplicate}
            className={smallButton}
          >
            Duplicate
          </button>
          <ConfirmButton
            label="Delete"
            confirmLabel="Confirm delete"
            ariaLabel={`Delete question ${number}`}
            onConfirm={onDelete}
            className={smallButton}
          />
        </div>
      </div>

      <TextField
        id={`${base}-text`}
        label="Question"
        multiline
        value={question.text}
        max={QUESTION_TEXT_MAX}
        error={shown.text}
        autoFocus={autoFocus}
        onChange={(text) => onChange({ ...question, text })}
        onBlur={() => onTouch(`${question.id}:text`)}
      />
      <TextField
        id={`${base}-answer`}
        label="Answer"
        value={question.answer}
        max={ANSWER_MAX}
        error={shown.answer}
        onChange={(answer) => onChange({ ...question, answer })}
        onBlur={() => onTouch(`${question.id}:answer`)}
      />
      <TextField
        id={`${base}-notes`}
        label="Host notes (optional)"
        hint="Other accepted answers, pronunciation. Only the host sees these."
        multiline
        value={question.hostNotes ?? ''}
        max={HOST_NOTES_MAX}
        error={shown.hostNotes}
        onChange={setNotes}
        onBlur={() => onTouch(`${question.id}:hostNotes`)}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor={`${base}-points`} className="font-semibold">
          Points
        </label>
        <input
          id={`${base}-points`}
          inputMode="numeric"
          value={pointsText}
          onChange={(event) => {
            setPointsText(event.target.value);
            const parsed = parsePoints(event.target.value);
            if (parsed.ok && parsed.points !== question.points) {
              onChange({ ...question, points: parsed.points });
            }
          }}
          aria-invalid={!pointsValid}
          aria-describedby={pointsValid ? undefined : `${base}-points-error`}
          className={`${field} w-32`}
        />
        <FieldError id={`${base}-points-error`} message={pointsValid ? undefined : POINTS_ERROR} />
      </div>
    </li>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  hint?: string;
  multiline?: boolean;
  value: string;
  max: number;
  error: string | undefined;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function TextField({
  id,
  label,
  hint,
  multiline,
  value,
  max,
  error,
  autoFocus,
  onChange,
  onBlur,
}: TextFieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  const props = {
    id,
    value,
    maxLength: max,
    autoFocus,
    onBlur,
    'aria-invalid': error !== undefined,
    'aria-describedby': describedBy || undefined,
    className: field,
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
        <textarea rows={2} {...props} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input {...props} onChange={(event) => onChange(event.target.value)} />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
