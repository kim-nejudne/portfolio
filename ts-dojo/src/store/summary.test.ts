// §6 `/progress` "Progress overview" and §12 F9 "shows per-module counts, hints used and
// solutions viewed", plus §7 "A removed lesson keeps its rows; they are ignored and listed on
// /progress under orphaned". Pure over the registry and the rows.
import { describe, expect, it } from 'vitest';
import type { ExerciseRow, LessonRow } from './db';
import { summarize, type SummaryRegistry } from './summary';

const REGISTRY: SummaryRegistry = {
  tiers: [{ id: 't', title: 'T', modules: ['m1', 'm2'] }],
  module: (id) =>
    ({
      m1: { title: 'One', lessons: ['m1/a', 'm1/b'] },
      m2: { title: 'Two', lessons: ['m2/c'] },
    })[id],
  lesson: (id) =>
    ({
      'm1/a': { title: 'A', exercises: ['m1/a/01', 'm1/a/02'] },
      'm1/b': { title: 'B', exercises: ['m1/b/01'] },
      'm2/c': { title: 'C', exercises: ['m2/c/01', 'm2/c/02'] },
    })[id],
  exercise: (id) =>
    ['m1/a/01', 'm1/a/02', 'm1/b/01', 'm2/c/01', 'm2/c/02'].includes(id)
      ? {}
      : undefined,
};

function exercise(id: string, patch: Partial<ExerciseRow>): ExerciseRow {
  return {
    id,
    lessonId: id.split('/').slice(0, 2).join('/'),
    state: 'in-progress',
    hintsUsed: 0,
    solutionViewed: false,
    files: {},
    updatedAt: 1,
    ...patch,
  };
}

const LESSONS: LessonRow[] = [
  { id: 'm1/a', state: 'complete' },
  { id: 'm1/b', state: 'in-progress' },
  { id: 'm9/gone', state: 'in-progress' },
];
const EXERCISES: ExerciseRow[] = [
  exercise('m1/a/01', { state: 'passed', hintsUsed: 2 }),
  exercise('m1/a/02', { state: 'passed', solutionViewed: true }),
  exercise('m1/b/01', { hintsUsed: 1, solutionViewed: true }),
  exercise('m9/gone/01', { hintsUsed: 3 }),
  exercise('m1/a/09-removed', { state: 'passed' }),
];

describe('summarize with an optional lesson (pre-F13)', () => {
  const registry: SummaryRegistry = {
    ...REGISTRY,
    module: (id) =>
      id === 'm1'
        ? { title: 'One', lessons: ['m1/a', 'm1/b'] }
        : REGISTRY.module(id),
    lesson: (id) =>
      id === 'm1/b'
        ? { title: 'B', exercises: ['m1/b/01'], optional: true }
        : REGISTRY.lesson(id),
  };

  it('counts core lessons for the module and marks the optional lesson', () => {
    const summary = summarize(registry, LESSONS, EXERCISES);
    const [one] = summary.modules;
    expect(one).toMatchObject({
      state: 'complete',
      lessonsComplete: 1,
      lessonsTotal: 1,
    });
    expect(one?.lessons.map((l) => [l.id, l.optional])).toEqual([
      ['m1/a', false],
      ['m1/b', true],
    ]);
    expect(summary.totals).toMatchObject({
      lessonsComplete: 1,
      lessonsTotal: 2,
    });
  });
});

describe('summarize', () => {
  it('counts per lesson and per module: lessons complete, exercises passed, hints used, solutions viewed', () => {
    const summary = summarize(REGISTRY, LESSONS, EXERCISES);
    expect(summary.modules.map((m) => m.id)).toEqual(['m1', 'm2']);
    const [one, two] = summary.modules;
    expect(one).toMatchObject({
      title: 'One',
      state: 'in-progress',
      lessonsComplete: 1,
      lessonsTotal: 2,
      exercisesPassed: 2,
      exercisesTotal: 3,
      hintsUsed: 3,
      solutionsViewed: 2,
    });
    expect(one?.lessons).toEqual([
      {
        id: 'm1/a',
        title: 'A',
        state: 'complete',
        optional: false,
        exercisesPassed: 2,
        exercisesTotal: 2,
        hintsUsed: 2,
        solutionsViewed: 1,
      },
      {
        id: 'm1/b',
        title: 'B',
        state: 'in-progress',
        optional: false,
        exercisesPassed: 0,
        exercisesTotal: 1,
        hintsUsed: 1,
        solutionsViewed: 1,
      },
    ]);
    expect(two).toMatchObject({
      state: 'not-started',
      lessonsComplete: 0,
      lessonsTotal: 1,
      exercisesPassed: 0,
      exercisesTotal: 2,
      hintsUsed: 0,
      solutionsViewed: 0,
    });
  });

  it('totals the course, leaving orphaned rows out of the counts', () => {
    expect(summarize(REGISTRY, LESSONS, EXERCISES).totals).toEqual({
      lessonsComplete: 1,
      lessonsTotal: 3,
      exercisesPassed: 2,
      exercisesTotal: 5,
      hintsUsed: 3,
      solutionsViewed: 2,
    });
  });

  it('lists the rows the content no longer has as orphaned', () => {
    expect(summarize(REGISTRY, LESSONS, EXERCISES).orphans).toEqual({
      lessons: ['m9/gone'],
      exercises: ['m1/a/09-removed', 'm9/gone/01'],
    });
  });
});
