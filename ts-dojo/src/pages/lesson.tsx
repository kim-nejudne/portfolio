// `/l/:lesson` and `/l/:lesson/:exercise` (spec §6): theory and practice side by side. F6 hosts
// the theory pane (the lesson's MDX with its objectives and the §3 components) and lists the
// exercises; F7 and F8 build the practice pane, the exercise strip, the panes' keys and `:done`
// around it. Matched as `l/*` because lesson ids contain a slash; see src/app/lesson-path.ts.
import { Link, useParams } from 'react-router';
import { lessonHref, parseLessonPath } from '@/app/lesson-path';
import { registry } from '@/content/registry';
import { Theory } from '@/content/components/theory';
import { Placeholder } from './placeholder';

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
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto px-6 py-6 lg:flex-row">
      <Theory lesson={lesson} />
      <aside className="practice shrink-0 lg:w-80" aria-label="Practice">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Exercises
        </h2>
        <ol
          className="exercise-list mt-2 list-decimal pl-6 text-sm"
          data-current={path.exercise ?? ''}
        >
          {exercises.map((exercise) => (
            <li
              key={exercise.id}
              data-exercise={exercise.folder}
              data-kind={exercise.kind}
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
        <p className="mt-3 text-xs text-muted-foreground">
          The editor, the prompt and the verdict open here at F7 and F8.
        </p>
      </aside>
    </div>
  );
}
