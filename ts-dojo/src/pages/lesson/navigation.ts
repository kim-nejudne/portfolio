// Where `:next`, `:prev`, `:lesson next/prev`, `] e`, `[ e`, `g n` and `g p` go (§4 Ex commands,
// §6 Global keys), and which exercise `/l/:lesson` selects (§6: "first unfinished exercise
// selected"). The course order is the roadmap's: tiers in order, their modules, the modules'
// lessons. Pure over the registry's lookups.
import type { Registry } from '@/content/build-registry';
import type { ExerciseState } from '@/store/db';

/** What the navigation needs from the registry (a test builds a small one). */
export interface NavRegistry {
  tiers: readonly { id: string; title: string; modules: readonly string[] }[];
  module(id: string): { lessons: readonly string[] } | undefined;
  lesson(id: string): { exercises: readonly string[] } | undefined;
  exercise(id: string): { folder: string } | undefined;
}

export type NavStep =
  | { kind: 'exercise'; lesson: string; exercise: string }
  /** A lesson's own page: its first unfinished exercise is selected there. */
  | { kind: 'lesson'; lesson: string }
  | { kind: 'none'; reason: string };

export function lessonOrder(registry: NavRegistry | Registry): string[] {
  return registry.tiers.flatMap((tier) =>
    tier.modules.flatMap((id) => [...(registry.module(id)?.lessons ?? [])]),
  );
}

function neighbour(
  registry: NavRegistry,
  lessonId: string,
  delta: 1 | -1,
): string | null {
  const order = lessonOrder(registry);
  const at = order.indexOf(lessonId);
  if (at === -1) return null;
  return order[at + delta] ?? null;
}

export function nextLesson(
  registry: NavRegistry,
  lessonId: string,
): string | null {
  return neighbour(registry, lessonId, 1);
}

export function prevLesson(
  registry: NavRegistry,
  lessonId: string,
): string | null {
  return neighbour(registry, lessonId, -1);
}

/** The lesson's exercise folders, in order. */
export function exerciseFolders(
  registry: NavRegistry,
  lessonId: string,
): string[] {
  return (registry.lesson(lessonId)?.exercises ?? []).flatMap((id) => {
    const folder = registry.exercise(id)?.folder;
    return folder === undefined ? [] : [folder];
  });
}

/** `:next` / `] e`: the next exercise; past the lesson's last one, the next lesson. */
export function nextStep(
  registry: NavRegistry,
  lessonId: string,
  folder: string,
): NavStep {
  const folders = exerciseFolders(registry, lessonId);
  const following = folders[folders.indexOf(folder) + 1];
  if (folders.includes(folder) && following !== undefined) {
    return { kind: 'exercise', lesson: lessonId, exercise: following };
  }
  const next = nextLesson(registry, lessonId);
  return next === null
    ? { kind: 'none', reason: 'this is the last exercise of the course' }
    : { kind: 'lesson', lesson: next };
}

/** `:prev` / `[ e`: the previous exercise; before the first one, the previous lesson's last. */
export function prevStep(
  registry: NavRegistry,
  lessonId: string,
  folder: string,
): NavStep {
  const folders = exerciseFolders(registry, lessonId);
  const at = folders.indexOf(folder);
  const preceding = at > 0 ? folders[at - 1] : undefined;
  if (preceding !== undefined) {
    return { kind: 'exercise', lesson: lessonId, exercise: preceding };
  }
  const previous = prevLesson(registry, lessonId);
  if (previous === null) {
    return { kind: 'none', reason: 'this is the first exercise of the course' };
  }
  const last = exerciseFolders(registry, previous).at(-1);
  return last === undefined
    ? { kind: 'lesson', lesson: previous }
    : { kind: 'exercise', lesson: previous, exercise: last };
}

/** §6: the exercise `/l/:lesson` selects; the first one when every exercise is passed. */
export function firstUnfinished(
  registry: NavRegistry,
  lessonId: string,
  states: Readonly<Record<string, ExerciseState>>,
): string | null {
  const ids = registry.lesson(lessonId)?.exercises ?? [];
  const open = ids.find((id) => states[id] !== 'passed') ?? ids[0];
  return open === undefined ? null : (registry.exercise(open)?.folder ?? null);
}
