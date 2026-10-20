// The `/progress` overview (§6, §12 F9 "per-module counts, hints used and solutions viewed"):
// per lesson and per module, lessons complete, exercises passed, hints used and solutions
// viewed, and the course totals; plus §7's orphaned rows, the lessons and exercises the content
// no longer has (after the renames), which the counts ignore and the page lists. Pure.
import type { NavRegistry } from '@/pages/lesson/navigation';
import { lessonStateOf, moduleState } from './completion';
import type { ExerciseRow, LessonRow, LessonState } from './db';

export interface SummaryRegistry {
  tiers: NavRegistry['tiers'];
  module(id: string): { title: string; lessons: readonly string[] } | undefined;
  lesson(
    id: string,
  ): { title: string; exercises: readonly string[] } | undefined;
  exercise(id: string): object | undefined;
}

export interface Counts {
  exercisesPassed: number;
  exercisesTotal: number;
  hintsUsed: number;
  solutionsViewed: number;
}

export interface LessonSummary extends Counts {
  id: string;
  title: string;
  state: LessonState;
}

export interface ModuleSummary extends Counts {
  id: string;
  title: string;
  state: LessonState;
  lessonsComplete: number;
  lessonsTotal: number;
  lessons: LessonSummary[];
}

export interface ProgressSummary {
  modules: ModuleSummary[];
  totals: Counts & { lessonsComplete: number; lessonsTotal: number };
  orphans: { lessons: string[]; exercises: string[] };
}

function add<T extends Counts>(into: T, counts: Counts): T {
  into.exercisesPassed += counts.exercisesPassed;
  into.exercisesTotal += counts.exercisesTotal;
  into.hintsUsed += counts.hintsUsed;
  into.solutionsViewed += counts.solutionsViewed;
  return into;
}

const zero = (): Counts => ({
  exercisesPassed: 0,
  exercisesTotal: 0,
  hintsUsed: 0,
  solutionsViewed: 0,
});

export function summarize(
  registry: SummaryRegistry,
  lessonRows: readonly LessonRow[],
  exerciseRows: readonly ExerciseRow[],
): ProgressSummary {
  const lessonsById = new Map(lessonRows.map((row) => [row.id, row]));
  const exercisesById = new Map(exerciseRows.map((row) => [row.id, row]));
  const totals = { ...zero(), lessonsComplete: 0, lessonsTotal: 0 };
  const modules: ModuleSummary[] = [];
  for (const moduleId of registry.tiers.flatMap((tier) => tier.modules)) {
    const module = registry.module(moduleId);
    if (module === undefined) continue;
    const lessons = module.lessons.flatMap((lessonId): LessonSummary[] => {
      const lesson = registry.lesson(lessonId);
      if (lesson === undefined) return [];
      const rows = lesson.exercises.map((id) => exercisesById.get(id));
      return [
        {
          id: lessonId,
          title: lesson.title,
          state: lessonStateOf(lessonsById.get(lessonId)),
          exercisesPassed: rows.filter((row) => row?.state === 'passed').length,
          exercisesTotal: lesson.exercises.length,
          hintsUsed: rows.reduce((sum, row) => sum + (row?.hintsUsed ?? 0), 0),
          solutionsViewed: rows.filter((row) => row?.solutionViewed === true)
            .length,
        },
      ];
    });
    const summary: ModuleSummary = {
      id: moduleId,
      title: module.title,
      state: moduleState(lessons.map((lesson) => lesson.state)),
      lessonsComplete: lessons.filter((l) => l.state === 'complete').length,
      lessonsTotal: lessons.length,
      lessons,
      ...zero(),
    };
    for (const lesson of lessons) add(summary, lesson);
    add(totals, summary);
    totals.lessonsComplete += summary.lessonsComplete;
    totals.lessonsTotal += summary.lessonsTotal;
    modules.push(summary);
  }
  return {
    modules,
    totals,
    orphans: {
      lessons: lessonRows
        .filter((row) => registry.lesson(row.id) === undefined)
        .map((row) => row.id)
        .sort(),
      exercises: exerciseRows
        .filter((row) => registry.exercise(row.id) === undefined)
        .map((row) => row.id)
        .sort(),
    },
  };
}
