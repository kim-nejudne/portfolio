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
  CHOICE_LETTERS,
  CHOICE_TEXT_MAX,
  DIFFICULTIES,
  HOST_NOTES_MAX,
  QUESTION_TEXT_MAX,
  SET_CATEGORY_MAX,
  SET_TITLE_MAX,
} from '../../../shared/constants.js';
import type { Question, QuestionMode, QuestionSet } from '../../../shared/types.js';
import { Icon } from '../components/Icon.js';
import { OverflowMenu } from '../components/OverflowMenu.js';
import { PageShell } from '../components/PageShell.js';
import { PasteQuestions } from '../components/PasteQuestions.js';
import { QuestionPreview } from '../components/QuestionPreview.js';
import { type SaveStatus, useAutosave } from '../lib/autosave.js';
import { loadBuiltInSets } from '../lib/builtInSets.js';
import { addPasted, type PastedQuestion } from '../lib/bulkPaste.js';
import { addImage, deleteImages, getSet, listSets, saveSet } from '../lib/db.js';
import { HOVER } from '../lib/hover.js';
import { BUTTON_ICON, BUTTON_PRIMARY_SMALL, BUTTON_SMALL, FIELD, LINK } from '../lib/ui.js';
import { cardDomId, useCurrentCard } from '../lib/useCurrentCard.js';
import { usePointerFine } from '../lib/usePointerFine.js';
import { IMAGE_INPUT_TYPES, shrinkImage } from '../lib/imagePipeline.js';
import {
  addChoice,
  addQuestion,
  canAddChoice,
  canAddQuestion,
  canRemoveChoice,
  categoriesInUse,
  duplicateQuestion,
  MODE_LABELS,
  moveQuestion,
  needsAttention,
  outlineText,
  parsePoints,
  POINTS_ERROR,
  QUESTION_CAP_MESSAGE,
  type QuestionErrors,
  questionErrors,
  removeChoice,
  removeQuestion,
  reorderQuestions,
  setChoiceText,
  setCorrectChoice,
  setMode,
  setQuestionImage,
  titleError,
  unusedImageIds,
  withCategory,
  withDifficulty,
} from '../lib/setEditor.js';
import { DIFFICULTY_LABELS } from '../lib/setLabels.js';
import { useStoredImageUrl } from '../lib/useStoredImageUrl.js';

const LOAD_ERROR = 'Could not load this set in this browser.';

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: 'Saved',
  pending: 'Saving…',
  error: "Couldn't save. Your next change will try again.",
};

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
  const [pasting, setPasting] = useState(false);
  // Suggestions for the Category field: what this browser's sets already use.
  const [categories, setCategories] = useState<string[]>([]);
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

  // Below a jumped-to card's `scroll-mt-32` (128px), so the card above it is out of the band.
  const currentId = useCurrentCard(set?.questions.map((q) => q.id) ?? [], 136);
  // A new card (Add, or the first pasted one) comes into view under the toolbar; its own autofocus
  // has put the cursor in it.
  useEffect(() => {
    if (focusId) document.getElementById(cardDomId(focusId))?.scrollIntoView?.({ block: 'center' });
  }, [focusId]);

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
    // Without suggestions the field still takes any category, so a failed read is ignored. The
    // built-in sets' categories are suggested too, though they are not stored (DECISIONS F54); a
    // failed fetch of them leaves this browser's own.
    Promise.all([listSets(), loadBuiltInSets().catch(() => [])]).then(
      ([sets, builtIn]) => live && setCategories(categoriesInUse([...sets, ...builtIn])),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [setId]);

  if (load.state !== 'ready' || set === null) {
    return (
      <PageShell
        header={
          <Link to="/sets" className={`${LINK} text-lg`}>
            ← Question sets
          </Link>
        }
      >
        <h1 className="font-display text-4xl text-accent">Edit set</h1>
        {load.state === 'loading' && <p className="text-muted">Loading…</p>}
        {load.state === 'missing' && <p role="alert">This set no longer exists.</p>}
        {load.state === 'error' && (
          <p role="alert" className="text-lg text-buzz">
            {LOAD_ERROR}
          </p>
        )}
      </PageShell>
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
  const addFromPaste = (pasted: PastedQuestion[]) => {
    const questions = addPasted(set.questions, pasted);
    // The first new card takes focus, which brings the added questions into view.
    const first = questions[set.questions.length];
    if (first) setFocusId(first.id);
    setPasting(false);
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
  const attention = set.questions.filter(needsAttention);
  const currentIndex = set.questions.findIndex((q) => q.id === currentId);
  const openPaste = () => setPasting((open) => !open);
  const openPreview = () => setPreviewIndex(Math.max(currentIndex, 0));
  const printTo = `/sets/${encodeURIComponent(set.id)}/print`;

  return (
    <>
      {/* The preview covers the page, so `inert` keeps focus and clicks out of the editor behind it. */}
      <div inert={previewIndex !== null}>
        <PageShell width="wide">
          {/* EDT-01: the status and the actions stay on screen at every scroll position. Solid, not
              blurred: a backdrop filter would pin the phone's fixed Add button inside the bar. */}
          <section
            aria-label="Set toolbar"
            className="sticky top-0 z-20 -mx-4 -mt-6 flex flex-col border-b-2 border-edge bg-bg px-4 py-2 short:-mt-3 md:-mx-8 md:-mt-10 md:px-8"
          >
            <div className="flex items-center gap-2 md:gap-3">
              <Link to="/sets" aria-label="Question sets" className={`${BUTTON_ICON} text-xl`}>
                <span aria-hidden="true">←</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  const field = document.getElementById('set-title');
                  field?.scrollIntoView?.({ block: 'center' });
                  field?.focus({ preventScroll: true });
                }}
                className={`flex min-h-11 min-w-0 flex-1 items-center rounded-xl border-2 border-transparent px-2 text-left font-display text-lg md:text-xl ${HOVER}`}
              >
                <span className="truncate">{set.title.trim() || 'Untitled set'}</span>
                <span className="sr-only">, go to the set title</span>
              </button>
              <p
                role="status"
                aria-label="Save status"
                className={`flex shrink items-center gap-1 text-right leading-tight ${
                  status === 'error' ? 'max-w-40 text-sm text-buzz md:max-w-56' : 'text-muted'
                }`}
              >
                {STATUS_TEXT[status]}
                {status === 'saved' && <Icon name="check" className="size-5 text-win" />}
              </p>
              <div className="hidden items-center gap-2 md:flex">
                <button
                  type="button"
                  aria-label="Paste questions"
                  onClick={openPaste}
                  disabled={!canAdd}
                  aria-expanded={pasting && canAdd}
                  className={BUTTON_SMALL}
                >
                  Paste
                </button>
                <button
                  type="button"
                  aria-label="Preview set"
                  onClick={openPreview}
                  disabled={set.questions.length === 0}
                  className={BUTTON_SMALL}
                >
                  Preview
                </button>
                <Link to={printTo} aria-label="Print answer sheet" className={BUTTON_SMALL}>
                  Print
                </Link>
              </div>
              <div className="md:hidden">
                <OverflowMenu
                  label="More set actions"
                  trigger={<Icon name="more" />}
                  triggerClassName={BUTTON_ICON}
                  items={[
                    { label: 'Paste questions', onSelect: openPaste, disabled: !canAdd },
                    {
                      label: 'Preview set',
                      onSelect: openPreview,
                      disabled: set.questions.length === 0,
                    },
                    { label: 'Print answer sheet', to: printTo },
                  ]}
                />
              </div>
              {/* On a phone this is the sticky bottom button; from `md` it sits in the bar. */}
              <button
                type="button"
                onClick={add}
                disabled={!canAdd}
                className={`${BUTTON_PRIMARY_SMALL} fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 py-3 text-lg shadow-lg md:static md:py-2 md:text-base md:shadow-none`}
              >
                Add question
              </button>
            </div>
            {attention.length > 0 && (
              // EDT-10: one click from the bar to the first question with a problem.
              <button
                type="button"
                onClick={() => jumpTo(attention[0]!.id)}
                className={`flex min-h-11 items-center gap-2 self-start rounded-xl border-2 border-transparent px-2 text-buzz ${HOVER}`}
              >
                <span aria-hidden="true" className="size-2.5 rounded-full bg-buzz" />
                {attention.length === 1
                  ? '1 question needs attention'
                  : `${attention.length} questions need attention`}
              </button>
            )}
          </section>

          {pasting && canAdd && (
            <PasteQuestions
              count={set.questions.length}
              onAdd={addFromPaste}
              onCancel={() => setPasting(false)}
            />
          )}

          <div className="flex flex-col gap-6 pb-20 md:pb-0 lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
            <QuestionOutline questions={set.questions} currentId={currentId} onJump={jumpTo} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 lg:col-start-2 lg:max-w-none">
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
                  className={`${FIELD} scroll-mt-28 font-display text-3xl`}
                />
                <FieldError id="set-title-error" message={titleProblem} />
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex min-w-48 flex-1 flex-col gap-1">
                  <label htmlFor="set-category" className="font-semibold">
                    Category <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <input
                    id="set-category"
                    list="set-categories"
                    value={set.category ?? ''}
                    maxLength={SET_CATEGORY_MAX}
                    onChange={(event) => change(withCategory(set, event.target.value))}
                    // Trimmed once the field is left, so typing "Pop Culture" keeps its space.
                    onBlur={() => {
                      const trimmed = set.category?.trim();
                      if (trimmed !== set.category) change(withCategory(set, trimmed ?? ''));
                    }}
                    className={FIELD}
                  />
                  <datalist id="set-categories">
                    {categories.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="set-difficulty" className="font-semibold">
                    Difficulty <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <select
                    id="set-difficulty"
                    value={set.difficulty ?? ''}
                    onChange={(event) =>
                      change(
                        withDifficulty(
                          set,
                          DIFFICULTIES.find((d) => d === event.target.value) ?? '',
                        ),
                      )
                    }
                    className={`${FIELD} w-auto`}
                  >
                    <option value="">None</option>
                    {DIFFICULTIES.map((difficulty) => (
                      <option key={difficulty} value={difficulty}>
                        {DIFFICULTY_LABELS[difficulty]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {set.questions.length === 0 ? (
                <p className="rounded-[20px] border-2 border-dashed border-edge p-8 text-center text-lg text-muted">
                  No questions yet. Use <strong className="text-ink">Add question</strong> to write
                  the first, or <strong className="text-ink">Paste questions</strong> to bring in
                  many.
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
                          onMove={(delta) =>
                            changeQuestions(moveQuestion(set.questions, index, delta))
                          }
                          onDuplicate={() =>
                            changeQuestions(duplicateQuestion(set.questions, index))
                          }
                          onDelete={() => changeQuestions(removeQuestion(set.questions, index))}
                          onPreview={() => setPreviewIndex(index)}
                          onImage={(imageId) => changeImage(question.id, imageId)}
                        />
                      ))}
                    </ol>
                  </SortableContext>
                </DndContext>
              )}
              {!canAdd && <p className="text-center text-muted">{QUESTION_CAP_MESSAGE}</p>}
            </div>
          </div>
        </PageShell>
      </div>
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

/** Scrolls question `id`'s card under the toolbar and puts the cursor in its question (EDT-02). */
function jumpTo(id: string) {
  document.getElementById(cardDomId(id))?.scrollIntoView?.({ block: 'start' });
  document.getElementById(`q-${id}-text`)?.focus({ preventScroll: true });
}

interface QuestionOutlineProps {
  questions: readonly Question[];
  currentId: string | null;
  onJump: (id: string) => void;
}

/**
 * The `lg` outline (EDT-02): one entry per question with its number, its first words, its mode and
 * a red dot when it needs attention. It only navigates; the cards stay the one list to reorder.
 */
function QuestionOutline({ questions, currentId, onJump }: QuestionOutlineProps) {
  return (
    <nav
      aria-label="Question outline"
      className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto"
    >
      <ol className="flex flex-col gap-1">
        {questions.map((question, index) => {
          const flagged = needsAttention(question);
          return (
            <li key={question.id}>
              <button
                type="button"
                aria-current={question.id === currentId ? 'true' : undefined}
                onClick={() => onJump(question.id)}
                className={`flex min-h-11 w-full items-center gap-2 rounded-xl border-2 border-transparent px-2 text-left aria-[current]:border-accent aria-[current]:bg-surface ${HOVER}`}
              >
                <span className="w-6 shrink-0 text-right font-bold text-muted tabular-nums">
                  {index + 1}
                </span>
                {flagged && (
                  <span className="size-2.5 shrink-0 rounded-full bg-buzz">
                    <span className="sr-only">Needs attention:</span>
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{outlineText(question)}</span>
                <span className="shrink-0 rounded-full border-2 border-edge px-2 text-sm text-muted">
                  {MODE_LABELS[question.mode ?? 'buzz']}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
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
  const choices = question.mode === 'choice' ? (question.choices ?? []) : null;
  choices?.forEach((_, index) => {
    const key = `choice${index}` as const;
    if (touched.has(`${question.id}:${key}`)) shown[key] = errors[key];
  });

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
      id={cardDomId(question.id)}
      aria-label={label}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPaste={onPaste}
      className={`relative flex scroll-mt-32 flex-col gap-3 rounded-[20px] border-2 bg-surface p-3 sm:p-4 md:gap-4 md:p-5 ${
        isDragging
          ? 'z-10 border-accent shadow-2xl'
          : dropping
            ? 'border-accent outline-2 outline-accent'
            : 'border-edge'
      }`}
    >
      {/* EDT-04: one line at 375px. The less common actions wait in the menu, Delete last. */}
      <div className="flex items-center gap-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder question ${number}`}
          className={`${BUTTON_ICON} cursor-grab touch-none active:cursor-grabbing`}
        >
          <Icon name="grip" />
        </button>
        <h2 className="min-w-0 flex-1 truncate font-display text-lg sm:text-xl md:text-2xl">
          {label}
        </h2>
        {/* An eye on a phone, so "Question N" keeps the room; the word from `sm`. */}
        <button
          type="button"
          aria-label={`Preview question ${number}`}
          onClick={onPreview}
          className={`${BUTTON_SMALL} flex min-w-11 items-center justify-center`}
        >
          <Icon name="eye" className="size-6 sm:hidden" />
          <span className="hidden sm:inline">Preview</span>
        </button>
        <OverflowMenu
          label={`More actions for question ${number}`}
          trigger={<Icon name="more" />}
          triggerClassName={BUTTON_ICON}
          items={[
            { label: 'Move up', onSelect: () => onMove(-1), disabled: isFirst },
            { label: 'Move down', onSelect: () => onMove(1), disabled: isLast },
            { label: 'Duplicate', onSelect: onDuplicate, disabled: !canDuplicate },
            { label: 'Delete', confirmLabel: 'Confirm delete', onSelect: onDelete },
          ]}
        />
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

      {/* EDT-03: the short fields share a row: Mode and Points, then the image beside them at `md`. */}
      <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-[10rem_8rem_minmax(0,1fr)] md:gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${base}-mode`} className="font-semibold">
            Mode
          </label>
          <select
            id={`${base}-mode`}
            value={question.mode ?? 'buzz'}
            onChange={(event) => onChange(setMode(question, event.target.value as QuestionMode))}
            className={FIELD}
          >
            <option value="buzz">Buzz</option>
            <option value="choice">Choice</option>
            <option value="typed">Typed</option>
          </select>
        </div>
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
            className={FIELD}
          />
        </div>
        <div className="col-span-2 md:col-span-1">
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
        </div>
        {!pointsValid && (
          <div className="col-span-2 md:col-span-3">
            <FieldError id={`${base}-points-error`} message={POINTS_ERROR} />
          </div>
        )}
      </div>

      {/* The answer (or the choices) beside the notes at `lg`. */}
      <div className="grid items-start gap-3 md:gap-4 lg:grid-cols-2">
        {choices ? (
          <ChoicesField
            id={base}
            question={question}
            choices={choices}
            errors={shown}
            correctError={errors.correctChoice}
            onChange={onChange}
            onTouch={(index) => onTouch(`${question.id}:choice${index}`)}
          />
        ) : (
          <TextField
            id={`${base}-answer`}
            label="Answer"
            value={question.answer}
            max={ANSWER_MAX}
            error={shown.answer}
            onChange={(answer) => onChange({ ...question, answer })}
            onBlur={() => onTouch(`${question.id}:answer`)}
          />
        )}
        <TextField
          id={`${base}-notes`}
          {...(question.mode === 'typed' ? TYPED_NOTES : NOTES)}
          multiline
          value={question.hostNotes ?? ''}
          max={HOST_NOTES_MAX}
          error={shown.hostNotes}
          onChange={setNotes}
          onBlur={() => onTouch(`${question.id}:hostNotes`)}
        />
      </div>

      {dropping && (
        // EDT-09: the whole card takes the file. Decorative: the drop itself reports any problem.
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[18px] bg-bg/85 p-4 text-center font-display text-2xl text-accent"
        >
          Drop image for {label}
        </div>
      )}
    </li>
  );
}

interface ChoicesFieldProps {
  id: string;
  question: Question;
  choices: string[];
  errors: QuestionErrors;
  correctError: string | undefined;
  onChange: (question: Question) => void;
  onTouch: (index: number) => void;
}

/** A choice question's 2–4 choices, lettered A–D, with a radio for the correct one. */
function ChoicesField({
  id,
  question,
  choices,
  errors,
  correctError,
  onChange,
  onTouch,
}: ChoicesFieldProps) {
  return (
    <fieldset
      aria-describedby={`${id}-choices-hint${correctError ? ` ${id}-correct-error` : ''}`}
      className="flex flex-col gap-2"
    >
      <legend className="font-semibold">Choices</legend>
      <p id={`${id}-choices-hint`} className="text-sm text-muted">
        Mark the correct one. Players see them as A to D.
      </p>
      {choices.map((choice, index) => {
        const letter = CHOICE_LETTERS[index]!;
        const inputId = `${id}-choice-${index}`;
        const error = errors[`choice${index}`];
        return (
          <div key={index} className="flex flex-col gap-1">
            {/* EDT-06: a 44px label round the radio, and a 44px ×, leave the text 220px at 375. */}
            <div className="flex items-center gap-1">
              <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg">
                <input
                  type="radio"
                  name={`${id}-correct`}
                  checked={question.correctChoice === index}
                  onChange={() => onChange(setCorrectChoice(question, index))}
                  aria-label={`Choice ${letter} is correct`}
                  className="size-5 shrink-0 accent-accent"
                />
                <span aria-hidden="true" className="w-4 font-display text-xl">
                  {letter}
                </span>
                <span aria-hidden="true" className="hidden pr-1 text-sm text-muted sm:inline">
                  Correct
                </span>
              </label>
              <label htmlFor={inputId} className="sr-only">
                Choice {letter}
              </label>
              <input
                id={inputId}
                value={choice}
                maxLength={CHOICE_TEXT_MAX}
                onChange={(event) => onChange(setChoiceText(question, index, event.target.value))}
                onBlur={() => onTouch(index)}
                aria-invalid={error !== undefined}
                aria-describedby={error ? `${inputId}-error` : undefined}
                className={`${FIELD} min-w-0 flex-1`}
              />
              {canRemoveChoice(question) && (
                <button
                  type="button"
                  aria-label={`Remove choice ${letter}`}
                  onClick={() => onChange(removeChoice(question, index))}
                  className={`${BUTTON_ICON} shrink-0`}
                >
                  <Icon name="x" className="size-5" />
                </button>
              )}
            </div>
            <FieldError id={`${inputId}-error`} message={error} />
          </div>
        );
      })}
      <FieldError id={`${id}-correct-error`} message={correctError} />
      {canAddChoice(question) && (
        <button
          type="button"
          onClick={() => onChange(addChoice(question))}
          className={`${BUTTON_SMALL} self-start`}
        >
          Add choice
        </button>
      )}
    </fieldset>
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
  const pointerFine = usePointerFine();

  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-1">
      <p id={`${id}-label`} className="font-semibold">
        Image (optional)
      </p>
      {imageId !== undefined ? (
        <div className="flex flex-wrap items-center gap-3">
          {src ? (
            <img
              src={src}
              alt={`Image for question ${number}`}
              className="h-24 max-w-full rounded-xl border-2 border-edge bg-bg object-contain md:h-16"
            />
          ) : (
            <div
              className="h-24 w-36 rounded-xl border-2 border-edge bg-bg md:h-16 md:w-28"
              aria-hidden="true"
            />
          )}
          <button
            type="button"
            aria-label={`Remove image from question ${number}`}
            onClick={onRemove}
            disabled={busy}
            className={BUTTON_SMALL}
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-describedby={`${id}-hint`}
            className={BUTTON_SMALL}
          >
            Add image
          </button>
          {/* EDT-09: the hint names the drop where there is a mouse to drag with. */}
          <p id={`${id}-hint`} className="text-sm text-muted">
            {pointerFine ? 'Drop or paste an image' : 'PNG, JPEG, WebP or GIF'}
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

const NOTES = {
  label: 'Host notes (optional)',
  hint: 'Other accepted answers, pronunciation. Only the host sees these.',
};

/** A typed question's notes are its alternatives, one per line, which pre-mark answers (F87). */
const TYPED_NOTES = {
  label: 'Other accepted answers (optional)',
  hint: 'One per line. Typed answers that match the answer or a line here start marked correct. Only the host sees these.',
};

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
        // EDT-03: from `md` a text box is as tall as its text, one line when short, so a card fits
        // in 420px; browsers without `field-sizing` keep the two rows.
        <textarea
          rows={2}
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
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
