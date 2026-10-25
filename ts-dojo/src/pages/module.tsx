// `/m/:module` (spec §6 Module page): "The module's summary, prerequisites with their state,
// then its lessons in order: state, title, minutes, objectives on expand. `j`/`k`/`Enter`."
// A module whose prerequisites are not complete says "Recommended first: …" here as on its
// roadmap card, and opens all the same. `j`/`k` move the focus between the lessons; the focused
// lesson expands to show its objectives and, from §1's lesson `prerequisites`, its own
// "Recommended first" note; `Enter` opens it (the link's own activation). Nothing is focused on
// load. An unknown id says so. An optional lesson (`optional: true`, pre-F13 fixes) carries an
// "optional" tag, and the module's state ignores it.
import { Link, useParams } from 'react-router';
import { lessonHref } from '@/app/lesson-path';
import { usePageKeys } from '@/app/use-page-keys';
import { registry } from '@/content/registry';
import { lessonStateOf, moduleState } from '@/store/completion';
import { getDb, type LessonRow, type LessonState } from '@/store/db';
import { useLiveQuery } from '@/store/use-live-query';
import {
  moduleLessons,
  moduleStates,
  moveCard,
  recommendedFirst,
} from './roadmap/model';

export const STATE_LABEL: Record<LessonState, string> = {
  'not-started': 'not started',
  'in-progress': 'in progress',
  complete: 'complete',
};

/** The tag an optional lesson carries on the module page and on /progress. */
export function OptionalTag() {
  return (
    <span
      className="ml-2 border px-1 text-xs text-muted-foreground"
      data-field="optional"
    >
      optional
    </span>
  );
}

export function ModulePage() {
  const { module: id } = useParams();
  const module = id === undefined ? undefined : registry.module(id);
  // Every lesson row: the prerequisites' states need other modules' lessons too.
  const rows = useLiveQuery('module', () => getDb().lessons.toArray());

  usePageKeys((key) => {
    if (module === undefined || (key !== 'j' && key !== 'k')) return false;
    const active = document.activeElement;
    const current =
      active instanceof HTMLElement
        ? (active.dataset['lessonLink'] ?? null)
        : null;
    const next = moveCard([module.lessons], current, key);
    const element =
      next === null
        ? null
        : document.querySelector<HTMLElement>(
            `a[data-lesson-link="${CSS.escape(next)}"]`,
          );
    if (element === null) return false;
    element.focus();
    element.scrollIntoView({ block: 'nearest' });
    return true;
  });

  if (module === undefined) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-6 py-10">
        <h1 className="prompt-heading text-2xl font-semibold">
          Module not found
        </h1>
        <p className="font-mono text-sm text-muted-foreground">/m/{id ?? ''}</p>
      </section>
    );
  }

  const byId = new Map<string, LessonRow>(
    (rows ?? []).map((row) => [row.id, row]),
  );
  const lessonState = (lessonId: string) => lessonStateOf(byId.get(lessonId));
  const states = moduleStates(registry, lessonState);
  const lessonStates = module.lessons.map(lessonState);
  const { core, optional } = moduleLessons(registry, module.lessons);
  const pending = recommendedFirst(registry, module.id, states);

  return (
    <section
      className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8"
      data-module={module.id}
      data-state={moduleState(core.map(lessonState), optional.map(lessonState))}
    >
      <div className="flex flex-col gap-1">
        <h1 className="prompt-heading text-2xl font-semibold">
          {module.title}
        </h1>
        <p className="text-sm text-muted-foreground">{module.summary}</p>
      </div>

      {module.prerequisites.length > 0 && (
        <section aria-label="Prerequisites" className="flex flex-col gap-1">
          <h2 className="section-heading text-sm font-semibold">
            Prerequisites
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {module.prerequisites.map((prerequisite) => {
              const state = states.get(prerequisite) ?? 'not-started';
              return (
                <li
                  key={prerequisite}
                  data-prerequisite={prerequisite}
                  data-state={state}
                  className="flex items-baseline gap-3"
                >
                  <Link
                    to={`/m/${prerequisite}`}
                    className="text-link underline underline-offset-2 hover:text-foreground"
                  >
                    {registry.module(prerequisite)?.title ?? prerequisite}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {STATE_LABEL[state]}
                  </span>
                </li>
              );
            })}
          </ul>
          {pending.length > 0 && (
            <p className="text-sm" data-field="recommended">
              Recommended first: {pending.map((m) => m.title).join(', ')}
            </p>
          )}
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        <kbd>j</kbd> <kbd>k</kbd> move, <kbd>Enter</kbd> opens
      </p>
      <ol
        className="module-lessons flex flex-col gap-1 text-sm"
        aria-label="Lessons"
      >
        {module.lessons.map((lessonId, i) => {
          const lesson = registry.lesson(lessonId);
          const state = lessonStates[i] ?? 'not-started';
          const before = (lesson?.prerequisites ?? []).filter(
            (p) => lessonState(p) !== 'complete',
          );
          return (
            <li
              key={lessonId}
              data-lesson={lessonId}
              data-state={state}
              className="group flex flex-col border-l-2 border-transparent px-2 py-1 focus-within:border-link focus-within:bg-selection"
            >
              <div className="flex items-baseline gap-3">
                <Link
                  to={lessonHref(lessonId)}
                  data-lesson-link={lessonId}
                  className="text-link underline underline-offset-2 outline-none hover:text-foreground focus-visible:text-foreground"
                >
                  {lesson?.title ?? lessonId}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {lesson?.minutes ?? 0} min
                </span>
                {lesson?.optional === true && <OptionalTag />}
                <span className="ml-auto text-xs" data-field="state">
                  {STATE_LABEL[state]}
                </span>
              </div>
              <div
                className="hidden flex-col gap-1 py-1 group-focus-within:flex"
                data-field="details"
              >
                <ul className="list-disc pl-5 text-xs text-muted-foreground">
                  {(lesson?.objectives ?? []).map((objective) => (
                    <li key={objective}>{objective}</li>
                  ))}
                </ul>
                {before.length > 0 && (
                  <p className="text-xs" data-field="lesson-recommended">
                    Recommended first:{' '}
                    {before
                      .map((p) => registry.lesson(p)?.title ?? p)
                      .join(', ')}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
