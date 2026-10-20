// `/l/:lesson` and `/l/:lesson/:exercise` (spec §6): theory and practice side by side. F6 hosts
// the theory pane (the lesson's MDX with its objectives and the §3 components) and lists the
// exercises; F7 opens an editor exercise named in the URL in the practice pane (the editor, the
// output pane, `:w` and `:test`, src/pages/practice.tsx); F8 builds the exercise strip, the
// panes' keys, `predict` answering and `:done` around it. Matched as `l/*` because lesson ids
// contain a slash; see src/app/lesson-path.ts.
import { Link, useParams } from 'react-router';
import { cn } from 'cn';
import { lessonHref, parseLessonPath } from '@/app/lesson-path';
import {
  isEditorExercise,
  type Exercise,
  type Lesson,
} from '@/content/build-registry';
import { registry } from '@/content/registry';
import { Theory } from '@/content/components/theory';
import { Placeholder } from './placeholder';
import { Practice } from './practice';

function ExerciseList({
  lesson,
  exercises,
  current,
}: {
  lesson: Lesson;
  exercises: Exercise[];
  current: string | undefined;
}) {
  return (
    <>
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Exercises
      </h2>
      <ol
        className="exercise-list mt-2 list-decimal pl-6 text-sm"
        data-current={current ?? ''}
      >
        {exercises.map((exercise) => (
          <li
            key={exercise.id}
            data-exercise={exercise.folder}
            data-kind={exercise.kind}
            aria-current={exercise.folder === current ? 'step' : undefined}
          >
            <Link to={lessonHref(lesson.id, exercise.folder)}>
              {exercise.title}
            </Link>
            <span className="ml-2 text-muted-foreground">
              {exercise.kind} · {exercise.minutes} min
            </span>
          </li>
        ))}
      </ol>
    </>
  );
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
  const exercises = lesson.exercises
    .map((id) => registry.exercise(id))
    .filter((exercise) => exercise !== undefined);
  const current =
    path.exercise === undefined
      ? undefined
      : exercises.find((exercise) => exercise.folder === path.exercise);
  const practicing = current !== undefined && isEditorExercise(current);
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col lg:flex-row',
        practicing ? 'overflow-hidden' : 'gap-6 overflow-auto px-6 py-6',
      )}
    >
      <div
        className={cn(
          practicing && 'min-h-0 overflow-auto px-6 py-6 lg:basis-2/5',
        )}
      >
        <Theory lesson={lesson} />
      </div>
      <aside
        className={cn(
          'practice',
          practicing
            ? 'flex min-h-0 flex-col border-t lg:basis-3/5 lg:border-t-0 lg:border-l'
            : 'shrink-0 lg:w-80',
        )}
        aria-label="Practice"
      >
        <div className={cn(practicing && 'shrink-0 px-3 pt-2 pb-1')}>
          <ExerciseList
            lesson={lesson}
            exercises={exercises}
            current={path.exercise}
          />
        </div>
        {path.exercise !== undefined && current === undefined && (
          <p role="status" className="mt-3 text-sm text-destructive">
            This lesson has no exercise named {path.exercise}.
          </p>
        )}
        {current !== undefined && !isEditorExercise(current) && (
          <p className="mt-3 text-xs text-muted-foreground">
            A predict exercise is answered here with j, k and Enter (F8).
          </p>
        )}
        {practicing && <Practice key={current.id} exercise={current} />}
        {current === undefined && path.exercise === undefined && (
          <p className="mt-3 text-xs text-muted-foreground">
            Open an exercise to practise it here.
          </p>
        )}
      </aside>
    </div>
  );
}
