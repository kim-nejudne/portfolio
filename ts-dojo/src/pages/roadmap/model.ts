// The roadmap as data (§6 Roadmap): one card per module with lessons complete out of total,
// minutes remaining (the `minutes` of the lessons not complete), the ring's fraction (lessons
// complete over total) and the §1 state; the prerequisites not yet complete for "Recommended
// first"; and the keyboard moves, `j`/`k` through the reading order (bands top to bottom, each
// left to right) and `h`/`l` within a band, both stopping at the ends. The module page reuses
// `moveCard` with its lessons as one band. Pure over a small registry interface.
import { moduleState } from '@/store/completion';
import type { LessonState } from '@/store/db';

export interface RoadmapRegistry {
  tiers: readonly { id: string; title: string; modules: readonly string[] }[];
  module(id: string):
    | {
        title: string;
        lessons: readonly string[];
        prerequisites: readonly string[];
      }
    | undefined;
  lesson(id: string): { minutes: number } | undefined;
}

export interface ModuleCard {
  id: string;
  title: string;
  tier: string;
  lessonsComplete: number;
  lessonsTotal: number;
  minutesLeft: number;
  /** 0 to 1: lessons complete over total. */
  progress: number;
  state: LessonState;
  recommendedFirst: { id: string; title: string }[];
}

/** Every module's §1 state from its lessons' states. */
export function moduleStates(
  registry: RoadmapRegistry,
  lessonState: (lessonId: string) => LessonState,
): ReadonlyMap<string, LessonState> {
  const states = new Map<string, LessonState>();
  for (const id of registry.tiers.flatMap((tier) => tier.modules)) {
    const module = registry.module(id);
    if (module !== undefined) {
      states.set(id, moduleState(module.lessons.map(lessonState)));
    }
  }
  return states;
}

/** §6 "Recommended first: …": the module's prerequisites that are not complete. */
export function recommendedFirst(
  registry: RoadmapRegistry,
  moduleId: string,
  states: ReadonlyMap<string, LessonState>,
): { id: string; title: string }[] {
  return (registry.module(moduleId)?.prerequisites ?? []).flatMap((id) => {
    const prerequisite = registry.module(id);
    if (prerequisite === undefined || states.get(id) === 'complete') return [];
    return [{ id, title: prerequisite.title }];
  });
}

export function moduleCard(
  registry: RoadmapRegistry,
  moduleId: string,
  lessonState: (lessonId: string) => LessonState,
  states: ReadonlyMap<string, LessonState>,
): ModuleCard | null {
  const module = registry.module(moduleId);
  if (module === undefined) return null;
  const tier = registry.tiers.find((t) => t.modules.includes(moduleId));
  const complete = module.lessons.filter(
    (id) => lessonState(id) === 'complete',
  );
  const minutesLeft = module.lessons
    .filter((id) => lessonState(id) !== 'complete')
    .reduce((sum, id) => sum + (registry.lesson(id)?.minutes ?? 0), 0);
  return {
    id: moduleId,
    title: module.title,
    tier: tier?.id ?? '',
    lessonsComplete: complete.length,
    lessonsTotal: module.lessons.length,
    minutesLeft,
    progress:
      module.lessons.length === 0 ? 0 : complete.length / module.lessons.length,
    state: states.get(moduleId) ?? 'not-started',
    recommendedFirst: recommendedFirst(registry, moduleId, states),
  };
}

/** The module ids per band, top to bottom, each band left to right. */
export function readingOrder(registry: RoadmapRegistry): string[][] {
  return registry.tiers.map((tier) =>
    tier.modules.filter((id) => registry.module(id) !== undefined),
  );
}

export type CardKey = 'j' | 'k' | 'h' | 'l';

/** The card a key selects from `current` (null: nothing selected yet, which selects the first). */
export function moveCard(
  bands: readonly (readonly string[])[],
  current: string | null,
  key: CardKey,
): string | null {
  const order = bands.flat();
  const at = current === null ? -1 : order.indexOf(current);
  if (at === -1 || current === null) return order[0] ?? null;
  if (key === 'j') return order[at + 1] ?? current;
  if (key === 'k') return order[at - 1] ?? current;
  const band = bands.find((b) => b.includes(current)) ?? [];
  const inBand = band.indexOf(current);
  return band[inBand + (key === 'l' ? 1 : -1)] ?? current;
}
