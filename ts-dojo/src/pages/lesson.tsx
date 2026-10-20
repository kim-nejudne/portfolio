// `/l/:lesson` and `/l/:lesson/:exercise` (spec §6 Lesson page): theory and practice side by
// side, 40/60 by default, the split draggable, `:layout` for one pane full width (remembered
// per lesson and as the default, §7). `/l/:lesson` selects the first unfinished exercise and
// the URL always says which. Left: the theory pane (a focusable scroll region with the §6
// reading keys, the Check yourself questions answered in place, the `:done` button at the
// end). Right: the exercise strip, a notice line, then the editor exercise (src/pages/
// practice.tsx) or the `predict` question (src/pages/lesson/predict-panel.tsx). The page owns
// pane focus (§4 Focus and panes: `Ctrl-h/j/k/l`, `1 2 3`, `Esc`), moving between exercises and
// lessons, `:done` and `:layout`, and registers itself for the global keys and the palette.
// Matched as `l/*` because lesson ids contain a slash; see src/app/lesson-path.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router';
import { cn } from 'cn';
import { useAppActions } from '@/app/app-actions';
import type { GlobalAction } from '@/app/keys';
import { lessonHref, parseLessonPath } from '@/app/lesson-path';
import { setPageActions } from '@/app/page-actions';
import { readingKey, scrollTarget } from '@/app/reading-keys';
import { Button } from '@/components/ui/button';
import {
  isEditorExercise,
  type Exercise,
  type Lesson,
} from '@/content/build-registry';
import {
  LessonProgressContext,
  type LessonProgress,
} from '@/content/components/lesson-progress';
import { Theory } from '@/content/components/theory';
import { registry } from '@/content/registry';
import type { FocusDirection, LayoutMode, Pane } from '@/editor/host';
import { getActiveEditor } from '@/editor/registry';
import { doneOutcome, lessonShape, remainingMessage } from '@/store/completion';
import { getDb, type ExerciseRow } from '@/store/db';
import {
  answerQuestion,
  markTheoryRead,
  openLessonRow,
  refreshLessonState,
  setLessonLayout,
} from '@/store/progress';
import { browserStorage, readSettings, writeSettings } from '@/store/settings';
import { useLiveQuery } from '@/store/use-live-query';
import {
  LessonControllerContext,
  type LessonController,
} from './lesson/controller';
import {
  firstUnfinished,
  nextLesson,
  nextStep,
  prevLesson,
  prevStep,
  type NavStep,
} from './lesson/navigation';
import { runLessonAction } from './lesson/page-action';
import { paneInDirection, visiblePanes } from './lesson/panes';
import { PredictPanel } from './lesson/predict-panel';
import { Separator, SPLIT_DEFAULT } from './lesson/separator';
import { Placeholder } from './placeholder';
import { Practice } from './practice';

/** How long a first `g` waits for the second (`gg`), as the global sequences do. */
const G_TIMEOUT_MS = 1000;

/**
 * Set by an in-app move (`:next`, `] e`, `:lesson next`) to the pane the move came from: once
 * the new exercise is on screen that pane has the focus again (the theory pane, or the new
 * exercise's editor or question), so typing goes on without `1`, `2` or `Esc`. Module-level
 * because a move to another lesson mounts a new view. A direct load leaves the focus alone.
 */
const navigation: { focusOnArrival: Pane | null } = { focusOnArrival: null };

const FOCUS_KEYS: Partial<Record<GlobalAction, Pane>> = {
  focusTheory: 'theory',
  focusEditor: 'editor',
  focusOutput: 'output',
};
const DIRECTION_KEYS: Partial<Record<GlobalAction, FocusDirection>> = {
  focusLeft: 'left',
  focusDown: 'down',
  focusUp: 'up',
  focusRight: 'right',
};

/** The pane holding `element` (the focus by default), from the `data-pane` on each of the three. */
function focusedPane(
  element: Element | null = document.activeElement,
): Pane | null {
  const pane = element?.closest('[data-pane]')?.getAttribute('data-pane');
  return pane === 'theory' || pane === 'editor' || pane === 'output'
    ? pane
    : null;
}

export function LessonPage() {
  const { '*': splat } = useParams();
  const path = parseLessonPath(splat);
  const lesson = path === null ? undefined : registry.lesson(path.lesson);
  if (path === null || lesson === undefined) {
    return (
      <Placeholder
        title="Lesson not found"
        detail={`/l/${splat ?? ''}`}
        feature="F8 (lesson page)"
      />
    );
  }
  return (
    <LessonView
      key={lesson.id}
      lesson={lesson}
      exerciseFolder={path.exercise}
    />
  );
}

function LessonView({
  lesson,
  exerciseFolder,
}: {
  lesson: Lesson;
  exerciseFolder: string | undefined;
}) {
  const navigate = useNavigate();
  const app = useAppActions();
  const exercises = useMemo(
    () =>
      lesson.exercises
        .map((id) => registry.exercise(id))
        .filter((exercise) => exercise !== undefined),
    [lesson],
  );
  const shape = useMemo(() => lessonShape(lesson, registry), [lesson]);

  // The §7 rows, live. `undefined` while loading; a missing row reads as `{ row: undefined }`.
  const lessonRow = useLiveQuery(`lesson:${lesson.id}`, async () => ({
    row: await getDb().lessons.get(lesson.id),
  }));
  const exerciseRows = useLiveQuery(`exercises:${lesson.id}`, async () => {
    const rows = await getDb().exercises.bulkGet(lesson.exercises);
    return Object.fromEntries(lesson.exercises.map((id, i) => [id, rows[i]]));
  });

  // §6: `/l/:lesson` selects the first unfinished exercise, and the URL says so.
  useEffect(() => {
    if (exerciseFolder !== undefined || exerciseRows === undefined) return;
    const states = Object.fromEntries(
      Object.entries(exerciseRows).flatMap(([id, row]) =>
        row === undefined ? [] : [[id, row.state]],
      ),
    );
    const first = firstUnfinished(registry, lesson.id, states);
    if (first !== null) {
      void navigate(lessonHref(lesson.id, first), { replace: true });
    }
  }, [exerciseFolder, exerciseRows, lesson.id, navigate]);

  const current = exercises.find((e) => e.folder === exerciseFolder);

  // Opening the lesson on an exercise (§7 lessons: state, lastOpenedAt, lastExerciseId).
  useEffect(() => {
    if (current === undefined) return;
    void openLessonRow(lesson.id, current.id);
  }, [lesson.id, current]);

  // `:layout`: this lesson's choice, else the last one anywhere, else the 40/60 split.
  const [layoutChoice, setLayoutChoice] = useState<LayoutMode | null>(null);
  const layout: LayoutMode =
    layoutChoice ??
    lessonRow?.row?.layout ??
    readSettings(browserStorage()).layout ??
    'split';
  const [ratio, setRatio] = useState(SPLIT_DEFAULT);
  const [notice, setNotice] = useState('');

  const theoryRef = useRef<HTMLElement>(null);
  const outputRef = useRef<HTMLElement>(null);
  const questionRef = useRef<HTMLElement>(null);
  const hasOutput = current !== undefined && isEditorExercise(current);

  // The controller reads the latest values through a ref, so it is created once per lesson.
  const latest = useRef({ layout, current, hasOutput, lessonRow });
  useEffect(() => {
    latest.current = { layout, current, hasOutput, lessonRow };
  });

  const controller = useMemo<LessonController>(() => {
    const notify = (text: string): void => {
      setNotice(text);
      getActiveEditor()?.notify(text);
    };
    const go = (step: NavStep): void => {
      if (step.kind !== 'none') {
        navigation.focusOnArrival = focusedPane() ?? 'editor';
      }
      if (step.kind === 'none') notify(step.reason);
      else if (step.kind === 'lesson') void navigate(lessonHref(step.lesson));
      else void navigate(lessonHref(step.lesson, step.exercise));
    };
    const focusElement = (pane: Pane): void => {
      const { current: exercise } = latest.current;
      if (pane === 'theory') theoryRef.current?.focus();
      else if (pane === 'output') outputRef.current?.focus();
      else if (exercise !== undefined && !isEditorExercise(exercise)) {
        questionRef.current?.focus();
      } else getActiveEditor()?.focus();
    };
    const setLayout = (mode: LayoutMode): void => {
      flushSync(() => setLayoutChoice(mode));
      void setLessonLayout(lesson.id, mode);
      writeSettings({ layout: mode });
    };
    const self: LessonController = {
      lessonId: lesson.id,
      shape,
      focusPane(pane) {
        const state = latest.current;
        if (pane === 'output' && !state.hasOutput) {
          notify('a predict exercise has no output pane');
          return;
        }
        // A pane the layout hides comes back with the split.
        if (!visiblePanes(state.layout, state.hasOutput).includes(pane)) {
          setLayout('split');
        }
        focusElement(pane);
      },
      focusDirection(from, direction) {
        const state = latest.current;
        const target = paneInDirection(
          from,
          direction,
          state.layout,
          state.hasOutput,
        );
        if (target !== null) focusElement(target);
      },
      next() {
        const exercise = latest.current.current;
        if (exercise !== undefined) {
          go(nextStep(registry, lesson.id, exercise.folder));
        }
      },
      prev() {
        const exercise = latest.current.current;
        if (exercise !== undefined) {
          go(prevStep(registry, lesson.id, exercise.folder));
        }
      },
      lesson(direction) {
        const target =
          direction === 'next'
            ? nextLesson(registry, lesson.id)
            : prevLesson(registry, lesson.id);
        if (target === null) {
          notify(
            `this is the ${direction === 'next' ? 'last' : 'first'} lesson`,
          );
        } else {
          navigation.focusOnArrival = focusedPane() ?? 'editor';
          void navigate(lessonHref(target));
        }
      },
      done() {
        void (async () => {
          const outcome = doneOutcome(
            shape,
            await getDb().lessons.get(lesson.id),
          );
          if (outcome.kind === 'questions') {
            if (latest.current.layout === 'practice') setLayout('split');
            const question = theoryRef.current?.querySelector<HTMLElement>(
              `[data-check-id="${CSS.escape(outcome.first)}"]`,
            );
            question?.scrollIntoView({ block: 'center' });
            question?.focus();
            notify(remainingMessage(outcome.remaining));
            return;
          }
          await markTheoryRead(lesson.id);
          const state = await refreshLessonState(shape);
          notify(
            state === 'complete'
              ? 'Theory read. Lesson complete.'
              : 'Theory read.',
          );
        })();
      },
      layout(mode) {
        const before = focusedPane();
        setLayout(mode);
        if (
          before !== null &&
          !visiblePanes(mode, latest.current.hasOutput).includes(before)
        ) {
          focusElement(mode === 'theory' ? 'theory' : 'editor');
        }
        notify(`layout: ${mode}`);
      },
      notify,
      refreshCompletion() {
        void refreshLessonState(shape).then((state) => {
          if (state === 'complete') notify('Lesson complete.');
        });
      },
    };
    return self;
  }, [lesson.id, navigate, shape]);

  // After an in-app move, the pane it came from takes the focus again once the exercise is
  // mounted (the editor's own effect has run by now: children's effects run first).
  useEffect(() => {
    const from = navigation.focusOnArrival;
    if (from === null) return;
    if (current === undefined || exerciseRows === undefined) return;
    navigation.focusOnArrival = null;
    if (from === 'theory' || latest.current.layout === 'theory') {
      if (theoryRef.current?.contains(document.activeElement) !== true) {
        theoryRef.current?.focus();
      }
    } else controller.focusPane('editor');
  }, [controller, current, exerciseRows]);

  // The global keys and the palette reach this page while it is mounted.
  useEffect(
    () =>
      setPageActions({
        key(action) {
          const pane = FOCUS_KEYS[action];
          if (pane !== undefined) {
            controller.focusPane(pane);
            return true;
          }
          const direction = DIRECTION_KEYS[action];
          if (direction !== undefined) {
            controller.focusDirection(focusedPane() ?? 'editor', direction);
            return true;
          }
          switch (action) {
            case 'exerciseNext':
              controller.next();
              return true;
            case 'exercisePrev':
              controller.prev();
              return true;
            case 'lessonNext':
              controller.lesson('next');
              return true;
            case 'lessonPrev':
              controller.lesson('prev');
              return true;
            default:
              return false;
          }
        },
        ex(action, origin) {
          const from = focusedPane(origin) ?? 'editor';
          if (runLessonAction(action, controller, app, from)) return true;
          const exercise = latest.current.current;
          if (exercise === undefined || isEditorExercise(exercise))
            return false;
          controller.notify(
            `:${action.type} has nothing to act on in a predict exercise`,
          );
          return true;
        },
      }),
    [app, controller],
  );

  // §1 Check yourself answers, stored per lesson (§7 lessons.questions).
  const progress = useMemo<LessonProgress>(() => {
    const questions = lessonRow?.row?.questions ?? {};
    return {
      answers: Object.fromEntries(
        Object.entries(questions).map(([id, answer]) => [
          id,
          answer.answerIndex,
        ]),
      ),
      answer: (questionId, index, correct) => {
        void answerQuestion(lesson.id, questionId, index, correct);
      },
    };
  }, [lessonRow, lesson.id]);

  // §6 theory keys: `j k gg G Ctrl-d Ctrl-u` scroll the pane (a focused question or code block
  // handles its own `j`/`k`/`Enter` first).
  const pendingG = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTheoryKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.defaultPrevented || event.repeat) return;
    const target = event.target as HTMLElement;
    if (
      target.closest('button, a, input, textarea, [data-question]') !== null
    ) {
      return;
    }
    const afterG = pendingG.current !== null;
    if (pendingG.current !== null) clearTimeout(pendingG.current);
    pendingG.current = null;
    const scroll = readingKey(event, afterG);
    if (scroll === null) return;
    if (scroll === 'pendingG') {
      pendingG.current = setTimeout(() => {
        pendingG.current = null;
      }, G_TIMEOUT_MS);
      return;
    }
    const pane = event.currentTarget;
    event.preventDefault();
    pane.scrollTo({ top: scrollTarget(scroll, pane) });
  };

  const theoryRead = lessonRow?.row?.theoryReadAt !== undefined;
  const missing = exerciseFolder !== undefined && current === undefined;

  return (
    <LessonControllerContext value={controller}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="flex min-h-0 flex-1 flex-col md:flex-row"
          data-layout={layout}
        >
          {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- the theory pane is a §4 focus target with the §6 reading keys */}
          <section
            ref={theoryRef}
            data-pane="theory"
            aria-label="Theory pane"
            tabIndex={0}
            onKeyDown={onTheoryKeyDown}
            className={cn(
              'min-h-0 min-w-0 overflow-auto px-6 py-6 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              layout === 'practice' && 'hidden',
              layout === 'theory' && 'flex-1',
            )}
            style={
              layout === 'split' ? { flex: `0 0 ${String(ratio)}%` } : undefined
            }
          >
            <LessonProgressContext value={progress}>
              <Theory lesson={lesson} />
            </LessonProgressContext>
            <div className="mt-8 flex items-center gap-3 border-t pt-4">
              <Button
                type="button"
                variant={theoryRead ? 'secondary' : 'default'}
                data-testid="done"
                data-read={theoryRead ? 'true' : 'false'}
                onClick={() => controller.done()}
              >
                {theoryRead ? 'Theory read' : 'Mark theory read (:done)'}
              </Button>
              {shape.questionIds.length > 0 && !theoryRead && (
                <span className="text-xs text-muted-foreground">
                  Answer every Check yourself question first.
                </span>
              )}
            </div>
          </section>
          {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
          {layout === 'split' && (
            <Separator ratio={ratio} onChange={setRatio} />
          )}
          <aside
            aria-label="Practice"
            className={cn(
              'practice flex min-h-0 min-w-0 flex-1 flex-col border-t md:border-t-0',
              layout === 'theory' && 'hidden',
            )}
          >
            <ExerciseStrip
              lesson={lesson}
              exercises={exercises}
              rows={exerciseRows}
              current={exerciseFolder}
            />
            {missing && (
              <p className="px-3 text-sm text-destructive">
                This lesson has no exercise named {exerciseFolder}.
              </p>
            )}
            {current !== undefined && exerciseRows === undefined && (
              <p className="px-3 text-sm text-muted-foreground">
                loading the exercise
              </p>
            )}
            {current !== undefined &&
              exerciseRows !== undefined &&
              (isEditorExercise(current) ? (
                <Practice
                  key={current.id}
                  exercise={current}
                  row={exerciseRows[current.id]}
                  outputRef={outputRef}
                />
              ) : (
                <PredictPanel
                  key={current.id}
                  exercise={current}
                  row={exerciseRows[current.id]}
                  questionRef={questionRef}
                />
              ))}
          </aside>
        </div>
        {/* Under both panes, so a notice shows whichever pane `:layout` hides. */}
        <p
          role="status"
          aria-label="lesson notice"
          className="min-h-5 shrink-0 border-t px-3 text-xs text-muted-foreground"
        >
          {notice}
        </p>
      </div>
    </LessonControllerContext>
  );
}

/** §6: "the exercise strip at the top (one chip per exercise with its state)". */
function ExerciseStrip({
  lesson,
  exercises,
  rows,
  current,
}: {
  lesson: Lesson;
  exercises: Exercise[];
  rows: Record<string, ExerciseRow | undefined> | undefined;
  current: string | undefined;
}) {
  return (
    <nav aria-label="Exercises" className="shrink-0 px-3 pt-2">
      <ol
        className="exercise-list m-0 flex list-none flex-wrap gap-1.5 p-0 text-xs"
        data-current={current ?? ''}
      >
        {exercises.map((exercise, index) => {
          const state = rows?.[exercise.id]?.state ?? 'untouched';
          const selected = exercise.folder === current;
          return (
            <li
              key={exercise.id}
              data-exercise={exercise.folder}
              data-kind={exercise.kind}
              data-state={state}
              aria-current={selected ? 'step' : undefined}
            >
              <Link
                to={lessonHref(lesson.id, exercise.folder)}
                tabIndex={-1}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5',
                  selected
                    ? 'border-ring bg-accent text-accent-foreground'
                    : 'text-muted-foreground',
                )}
              >
                <span aria-hidden>
                  {state === 'passed'
                    ? '✓'
                    : state === 'in-progress'
                      ? '•'
                      : '○'}
                </span>
                <span>
                  {index + 1}. {exercise.title}
                </span>
                <span className="text-muted-foreground">
                  {exercise.kind} · {exercise.minutes} min
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
