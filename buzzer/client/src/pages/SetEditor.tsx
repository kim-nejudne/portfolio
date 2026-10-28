import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { type ClipboardEvent, type DragEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ANSWER_MAX,
  HOST_NOTES_MAX,
  QUESTION_TEXT_MAX,
  SET_TITLE_MAX,
} from '../../../shared/constants.js';
import type { Question, QuestionSet } from '../../../shared/types.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { QuestionPreview } from '../components/QuestionPreview.js';
import { type SaveStatus, useAutosave } from '../lib/autosave.js';
import { addImage, deleteImages, getSet, saveSet } from '../lib/db.js';
import { HOVER } from '../lib/hover.js';
import { IMAGE_INPUT_TYPES, shrinkImage } from '../lib/imagePipeline.js';
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
  reorderQuestions,
  setQuestionImage,
  titleError,
  unusedImageIds,
} from '../lib/setEditor.js';
import { useStoredImageUrl } from '../lib/useStoredImageUrl.js';

const LOAD_ERROR = 'Could not load this set in this browser.';

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: 'Saved',
  pending: 'Saving…',
  error: "Couldn't save. Your next change will try again.",
};

const smallButton = `min-h-11 rounded-xl border-2 border-edge bg-surface px-3 py-2 text-base font-bold transition not-disabled:active:scale-95 disabled:opacity-40 ${HOVER}`;
const field =
  'w-full rounded-xl border-2 border-edge bg-bg px-3 py-2 text-lg text-ink aria-invalid:border-buzz';

const DRAG_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'To move a question, press Space or Enter on its handle. Use the up and down arrow keys to move it, then Space or Enter to drop it, or Escape to cancel.',
};

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
  // The newest set, for an image that finishes storing after more edits were made.
  const latest = useRef<QuestionSet | null>(null);
  // Errors show once a field has been left, so a fresh card is not red before it is written.
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  // SPEC-QUESTION: when an unused blob is deleted is unspecified (DECISIONS F29).
  // Images no question uses any more (removed, replaced, or their question deleted). They leave
  // this browser only once a saved set no longer references them, so a failed or pending save never
  // points at a deleted blob. A failed delete only leaves an unused blob behind.
  const unusedImages = useRef(new Set<string>());
  const { status, schedule } = useAutosave(async (next: QuestionSet) => {
    await saveSet(next);
    const inUse = new Set(next.questions.map((q) => q.imageId));
    const gone = [...unusedImages.current].filter((id) => !inUse.has(id));
    if (gone.length === 0) return;
    for (const id of gone) unusedImages.current.delete(id);
    await deleteImages(gone).catch(() => {});
  });
  // The handle drags by pointer, or by keyboard: Space or Enter, the arrows, then Space or Enter.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    let live = true;
    getSet(setId).then(
      (found) => {
        if (!live) return;
        latest.current = found ?? null;
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
          <p role="alert" className="text-lg text-buzz">
            {LOAD_ERROR}
          </p>
        )}
        <BackLink />
      </main>
    );
  }

  const change = (next: QuestionSet) => {
    latest.current = next;
    setSet(next);
    schedule(next);
  };
  const changeQuestions = (questions: Question[]) => {
    const current = latest.current ?? set;
    for (const id of unusedImageIds(current.questions, questions)) unusedImages.current.add(id);
    change({ ...current, questions });
  };
  const changeImage = (questionId: string, imageId: string | undefined) => {
    const current = latest.current ?? set;
    if (!current.questions.some((q) => q.id === questionId)) {
      // The question was deleted while its image was being stored, so no saved set has it.
      if (imageId !== undefined) deleteImages([imageId]).catch(() => {});
      return;
    }
    changeQuestions(setQuestionImage(current.questions, questionId, imageId));
  };
  const touch = (key: string) =>
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));

  const add = () => {
    const questions = addQuestion(set.questions);
    setFocusId(questions.at(-1)!.id);
    changeQuestions(questions);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over) changeQuestions(reorderQuestions(set.questions, String(active.id), String(over.id)));
  };
  // Positions as they were when the drag started; the list changes only on the drop.
  const numberOf = (id: UniqueIdentifier) => set.questions.findIndex((q) => q.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up question ${numberOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `Question ${numberOf(active.id)} is over position ${numberOf(over.id)}.`
        : `Question ${numberOf(active.id)} is not over a position.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Question ${numberOf(active.id)} dropped at position ${numberOf(over.id)}.`
        : `Question ${numberOf(active.id)} dropped where it was.`,
    onDragCancel: ({ active }) => `Moving question ${numberOf(active.id)} was cancelled.`,
  };

  const canAdd = canAddQuestion(set.questions);
  const titleProblem = touched.has('title') ? titleError(set.title) : undefined;

  return (
    <>
      <main
        inert={previewIndex !== null}
        className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-10"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <BackLink />
          <p
            role="status"
            aria-label="Save status"
            className={status === 'error' ? 'text-buzz' : 'text-muted'}
          >
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

        <Link
          to={`/sets/${encodeURIComponent(set.id)}/print`}
          className={`${smallButton} self-start`}
        >
          Print answer sheet
        </Link>

        {set.questions.length === 0 ? (
          <p className="rounded-[20px] border-2 border-dashed border-edge p-8 text-center text-lg text-muted">
            No questions yet. Tap <strong className="text-ink">Add question</strong> to write the
            first.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            accessibility={{ announcements, screenReaderInstructions: DRAG_INSTRUCTIONS }}
          >
            <SortableContext items={set.questions} strategy={verticalListSortingStrategy}>
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
                    onPreview={() => setPreviewIndex(index)}
                    onImage={(imageId) => changeImage(question.id, imageId)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={add}
            disabled={!canAdd}
            className={`rounded-2xl bg-accent px-5 py-3 font-display text-xl text-accent-ink transition not-disabled:active:scale-95 disabled:opacity-40 ${HOVER}`}
          >
            Add question
          </button>
          {!canAdd && <p className="text-muted">{QUESTION_CAP_MESSAGE}</p>}
        </div>
      </main>
      {previewIndex !== null && previewIndex < set.questions.length && (
        <QuestionPreview
          set={set}
          index={previewIndex}
          onIndex={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </>
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
    <p id={id} className="text-buzz">
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
  onPreview: () => void;
  onImage: (imageId: string | undefined) => void;
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
  onPreview,
  onImage,
}: QuestionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });
  // The field keeps what was typed; only a valid number reaches the saved question.
  const [pointsText, setPointsText] = useState(String(question.points));
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const pointsValid = parsePoints(pointsText).ok;
  const errors = questionErrors(question);
  const shown: QuestionErrors = {};
  for (const key of ['text', 'answer', 'hostNotes'] as const) {
    if (touched.has(`${question.id}:${key}`)) shown[key] = errors[key];
  }

  const base = `q-${question.id}`;
  const label = `Question ${number}`;

  // Pick, drop and paste all end here: shrink, store, then point the question at the new image.
  const addImageFile = async (file: File) => {
    if (imageBusy) return;
    setImageBusy(true);
    setImageError(null);
    try {
      const result = await shrinkImage(file);
      if (!result.ok) {
        setImageError(result.error);
        return;
      }
      onImage(await addImage(result.blob));
    } catch {
      setImageError("Couldn't save the image in this browser.");
    } finally {
      setImageBusy(false);
    }
  };

  const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');
  const onDragOver = (event: DragEvent<HTMLLIElement>) => {
    if (!hasFiles(event)) return;
    // Without this the browser opens the dropped file in place of the editor.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDropping(true);
  };
  const onDragLeave = (event: DragEvent<HTMLLIElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false);
  };
  const onDrop = (event: DragEvent<HTMLLIElement>) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    setDropping(false);
    const file = event.dataTransfer.files[0];
    if (file) void addImageFile(file);
  };
  // SPEC-QUESTION: which paste wins is unspecified (DECISIONS F29).
  // A pasted image file becomes the question's image. Text pasted into a field stays text, even
  // when the clipboard also carries a picture of it (as office apps do).
  const onPaste = (event: ClipboardEvent<HTMLLIElement>) => {
    const file = [...event.clipboardData.files].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    const intoText =
      event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    if (intoText && event.clipboardData.types.includes('text/plain')) return;
    event.preventDefault();
    void addImageFile(file);
  };

  const setNotes = (value: string) => {
    const next: Question = { ...question, hostNotes: value };
    if (value === '') delete next.hostNotes;
    onChange(next);
  };

  return (
    <li
      ref={setNodeRef}
      aria-label={label}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPaste={onPaste}
      className={`flex flex-col gap-4 rounded-[20px] border-2 bg-surface p-5 ${
        isDragging
          ? 'relative z-10 border-accent shadow-2xl'
          : dropping
            ? 'border-accent'
            : 'border-edge'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Drag to reorder question ${number}`}
            className={`${smallButton} cursor-grab touch-none active:cursor-grabbing`}
          >
            ⠿
          </button>
          <h2 className="font-display text-2xl">{label}</h2>
        </div>
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
            aria-label={`Preview question ${number}`}
            onClick={onPreview}
            className={smallButton}
          >
            Preview
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
      <ImageField
        id={`${base}-image`}
        number={number}
        imageId={question.imageId}
        busy={imageBusy}
        error={imageError}
        onFile={(file) => void addImageFile(file)}
        onRemove={() => {
          setImageError(null);
          onImage(undefined);
        }}
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

interface ImageFieldProps {
  id: string;
  number: number;
  imageId: string | undefined;
  busy: boolean;
  error: string | null;
  onFile: (file: File) => void;
  onRemove: () => void;
}

/** The question's optional image: a thumbnail with Remove, or a picker. Drop and paste work on the whole card. */
function ImageField({ id, number, imageId, busy, error, onFile, onRemove }: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const src = useStoredImageUrl(imageId);

  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-2">
      <p id={`${id}-label`} className="font-semibold">
        Image (optional)
      </p>
      {imageId !== undefined ? (
        <div className="flex flex-wrap items-center gap-3">
          {src ? (
            <img
              src={src}
              alt={`Image for question ${number}`}
              className="h-32 max-w-full rounded-xl border-2 border-edge bg-bg object-contain"
            />
          ) : (
            <div className="h-32 w-48 rounded-xl border-2 border-edge bg-bg" aria-hidden="true" />
          )}
          <button
            type="button"
            aria-label={`Remove image from question ${number}`}
            onClick={onRemove}
            disabled={busy}
            className={smallButton}
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-edge p-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-describedby={`${id}-hint`}
            className={smallButton}
          >
            Add image
          </button>
          <p id={`${id}-hint`} className="text-sm text-muted">
            Or drop an image on this card, or paste one. PNG, JPEG, WebP or GIF.
          </p>
        </div>
      )}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={IMAGE_INPUT_TYPES.join(',')}
        aria-label={`Choose an image for question ${number}`}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared, so choosing the same file again still fires a change.
          event.target.value = '';
          if (file) onFile(file);
        }}
      />
      {busy && (
        <p role="status" className="text-muted">
          Shrinking image…
        </p>
      )}
      {error && (
        <p role="alert" className="text-buzz">
          {error}
        </p>
      )}
    </div>
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
