// `/m/:module` (spec §6 Module page): the module's summary, then its lessons in order with their
// state (§1: not started, in progress, complete) from the store. F8 builds this much so a
// completed lesson shows (§12 F8 criterion 3); F9 adds the prerequisites with their state,
// the objectives on expand and `j`/`k`/`Enter`. An unknown id keeps the F1 placeholder.
import { Link, useParams } from 'react-router';
import { lessonHref } from '@/app/lesson-path';
import { registry } from '@/content/registry';
import { lessonStateOf, moduleState } from '@/store/completion';
import { getDb, type LessonState } from '@/store/db';
import { useLiveQuery } from '@/store/use-live-query';
import { Placeholder } from './placeholder';

export const STATE_LABEL: Record<LessonState, string> = {
  'not-started': 'not started',
  'in-progress': 'in progress',
  complete: 'complete',
};

export function ModulePage() {
  const { module: id } = useParams();
  const module = id === undefined ? undefined : registry.module(id);
  const lessonIds = module?.lessons ?? [];
  const rows = useLiveQuery(`module:${id ?? ''}`, () =>
    getDb().lessons.bulkGet([...lessonIds]),
  );
  if (module === undefined) {
    return (
      <Placeholder
        title={`Module ${id ?? ''}`.trim()}
        feature="F9 (roadmap, modules and progress)"
      />
    );
  }
  const states = lessonIds.map((_, i) => lessonStateOf(rows?.[i]));
  return (
    <section
      className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-8"
      data-module={module.id}
      data-state={moduleState(states)}
    >
      <h1 className="text-2xl font-semibold tracking-tight">{module.title}</h1>
      <p className="text-sm text-muted-foreground">{module.summary}</p>
      <ol
        className="module-lessons mt-2 flex flex-col gap-1 text-sm"
        aria-label="Lessons"
      >
        {lessonIds.map((lessonId, i) => {
          const lesson = registry.lesson(lessonId);
          const state = states[i] ?? 'not-started';
          return (
            <li
              key={lessonId}
              data-lesson={lessonId}
              data-state={state}
              className="flex items-baseline gap-3"
            >
              <Link
                to={lessonHref(lessonId)}
                className="underline-offset-2 hover:underline"
              >
                {lesson?.title ?? lessonId}
              </Link>
              <span className="text-xs text-muted-foreground">
                {lesson?.minutes ?? 0} min
              </span>
              <span className="ml-auto text-xs" data-field="state">
                {STATE_LABEL[state]}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
