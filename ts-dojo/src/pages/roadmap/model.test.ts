// §6 Roadmap: "A card shows the title, lessons complete out of total, minutes remaining and a
// progress ring. States: not started (muted), in progress (accent ring), complete (filled)";
// "A module whose prerequisites are not complete shows Recommended first"; "Keys: `j`/`k` move
// between cards in reading order, `h`/`l` within a band". Pure over a small registry.
import { describe, expect, it } from 'vitest';
import type { LessonState } from '@/store/db';
import {
  moduleCard,
  moduleStates,
  moveCard,
  readingOrder,
  recommendedFirst,
  type RoadmapRegistry,
} from './model';

const REGISTRY: RoadmapRegistry = {
  tiers: [
    { id: 't1', title: 'One', modules: ['a', 'b', 'c'] },
    { id: 't2', title: 'Two', modules: ['d'] },
  ],
  module: (id) =>
    ({
      a: { title: 'A', lessons: ['a/1', 'a/2', 'a/3'], prerequisites: [] },
      b: { title: 'B', lessons: ['b/1'], prerequisites: ['a'] },
      c: { title: 'C', lessons: ['c/1'], prerequisites: [] },
      d: { title: 'D', lessons: ['d/1', 'd/2'], prerequisites: ['a', 'b'] },
    })[id],
  lesson: (id) =>
    ({
      'a/1': { minutes: 10 },
      'a/2': { minutes: 15 },
      'a/3': { minutes: 20 },
      'b/1': { minutes: 5 },
      'c/1': { minutes: 7 },
      'd/1': { minutes: 8 },
      'd/2': { minutes: 9 },
    })[id],
};

const STATES: Record<string, LessonState> = {
  'a/1': 'complete',
  'a/2': 'in-progress',
  'b/1': 'complete',
};
const lessonState = (id: string): LessonState => STATES[id] ?? 'not-started';

describe('moduleCard', () => {
  it('counts lessons complete, minutes left, the ring fraction and the state', () => {
    const states = moduleStates(REGISTRY, lessonState);
    expect(moduleCard(REGISTRY, 'a', lessonState, states)).toEqual({
      id: 'a',
      title: 'A',
      tier: 't1',
      lessonsComplete: 1,
      lessonsTotal: 3,
      minutesLeft: 35,
      progress: 1 / 3,
      state: 'in-progress',
      recommendedFirst: [],
      optionalLessons: 0,
    });
    expect(moduleCard(REGISTRY, 'b', lessonState, states)).toMatchObject({
      lessonsComplete: 1,
      minutesLeft: 0,
      progress: 1,
      state: 'complete',
    });
    expect(moduleCard(REGISTRY, 'c', lessonState, states)).toMatchObject({
      progress: 0,
      state: 'not-started',
      minutesLeft: 7,
    });
  });
});

describe('optional lessons (pre-F13)', () => {
  // Module e: two core lessons, both complete, and one optional lesson not started.
  const registry: RoadmapRegistry = {
    tiers: [{ id: 't1', title: 'One', modules: ['e', 'f'] }],
    module: (id) =>
      ({
        e: {
          title: 'E',
          lessons: ['e/1', 'e/2', 'e/3'],
          prerequisites: [],
        },
        f: { title: 'F', lessons: ['f/1'], prerequisites: ['e'] },
      })[id],
    lesson: (id) =>
      ({
        'e/1': { minutes: 10 },
        'e/2': { minutes: 15 },
        'e/3': { minutes: 20, optional: true },
        'f/1': { minutes: 5 },
      })[id],
  };
  const done: Record<string, LessonState> = {
    'e/1': 'complete',
    'e/2': 'complete',
  };
  const stateOf = (id: string): LessonState => done[id] ?? 'not-started';

  it('the card counts core lessons only and names the optional ones', () => {
    const states = moduleStates(registry, stateOf);
    expect(states.get('e')).toBe('complete');
    expect(moduleCard(registry, 'e', stateOf, states)).toMatchObject({
      lessonsComplete: 2,
      lessonsTotal: 2,
      minutesLeft: 0,
      progress: 1,
      state: 'complete',
      optionalLessons: 1,
    });
  });

  it('an unfinished optional lesson does not hold back the modules that follow', () => {
    const states = moduleStates(registry, stateOf);
    expect(recommendedFirst(registry, 'f', states)).toEqual([]);
  });

  it('an optional lesson alone puts its module in progress, not complete', () => {
    const only = (id: string): LessonState =>
      id === 'e/3' ? 'complete' : 'not-started';
    const states = moduleStates(registry, only);
    expect(moduleCard(registry, 'e', only, states)).toMatchObject({
      lessonsComplete: 0,
      lessonsTotal: 2,
      minutesLeft: 25,
      state: 'in-progress',
    });
  });
});

describe('recommendedFirst', () => {
  it('lists the prerequisites that are not complete, in their order', () => {
    const states = moduleStates(REGISTRY, lessonState);
    expect(recommendedFirst(REGISTRY, 'd', states)).toEqual([
      { id: 'a', title: 'A' },
    ]);
    expect(recommendedFirst(REGISTRY, 'b', states)).toEqual([
      { id: 'a', title: 'A' },
    ]);
    const allDone = moduleStates(REGISTRY, () => 'complete');
    expect(recommendedFirst(REGISTRY, 'd', allDone)).toEqual([]);
  });
});

describe('readingOrder and moveCard', () => {
  const bands = readingOrder(REGISTRY);

  it('is the bands top to bottom, each left to right', () => {
    expect(bands).toEqual([['a', 'b', 'c'], ['d']]);
  });

  it('j and k step through the reading order across bands and stop at the ends', () => {
    expect(moveCard(bands, 'a', 'j')).toBe('b');
    expect(moveCard(bands, 'c', 'j')).toBe('d');
    expect(moveCard(bands, 'd', 'j')).toBe('d');
    expect(moveCard(bands, 'd', 'k')).toBe('c');
    expect(moveCard(bands, 'a', 'k')).toBe('a');
  });

  it('h and l stay within the band and stop at its ends', () => {
    expect(moveCard(bands, 'a', 'l')).toBe('b');
    expect(moveCard(bands, 'c', 'l')).toBe('c');
    expect(moveCard(bands, 'b', 'h')).toBe('a');
    expect(moveCard(bands, 'a', 'h')).toBe('a');
    expect(moveCard(bands, 'd', 'l')).toBe('d');
    expect(moveCard(bands, 'd', 'h')).toBe('d');
  });

  it('with no card selected, any of the four selects the first card', () => {
    for (const key of ['j', 'k', 'h', 'l'] as const) {
      expect(moveCard(bands, null, key)).toBe('a');
      expect(moveCard(bands, 'nowhere', key)).toBe('a');
    }
    expect(moveCard([], null, 'j')).toBeNull();
  });
});
