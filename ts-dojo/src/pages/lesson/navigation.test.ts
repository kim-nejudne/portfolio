// §1, §4 `:next`/`:prev`/`:lesson`, §6 `/l/:lesson` (first unfinished exercise): the lesson
// order is the roadmap's (tiers, then their modules, then the modules' lessons); `:next` past
// a lesson's last exercise opens the next lesson, `:prev` before its first opens the previous
// lesson's last exercise; at either end of the course nothing moves and the reason is given.
import { describe, expect, it } from 'vitest';
import type { NavRegistry } from './navigation';
import {
  firstUnfinished,
  lessonOrder,
  nextLesson,
  nextStep,
  prevLesson,
  prevStep,
} from './navigation';

const exercises: Record<string, { folder: string }> = {};
const lessons: Record<string, { exercises: string[] }> = {};
function lesson(id: string, folders: string[]): void {
  lessons[id] = { exercises: folders.map((f) => `${id}/${f}`) };
  for (const f of folders) exercises[`${id}/${f}`] = { folder: f };
}
lesson('m1/a', ['01-x', '02-y']);
lesson('m1/b', ['01-z']);
lesson('m2/c', ['01-p', '02-q', '03-r']);

const REGISTRY: NavRegistry = {
  tiers: [
    { id: 't0', title: 'T0', modules: ['m1'] },
    { id: 't1', title: 'T1', modules: ['m2'] },
  ],
  module: (id) =>
    id === 'm1'
      ? { lessons: ['m1/a', 'm1/b'] }
      : id === 'm2'
        ? { lessons: ['m2/c'] }
        : undefined,
  lesson: (id) => lessons[id],
  exercise: (id) => exercises[id],
};

describe('lessonOrder, nextLesson, prevLesson', () => {
  it('follows the roadmap: tiers, modules, lessons', () => {
    expect(lessonOrder(REGISTRY)).toEqual(['m1/a', 'm1/b', 'm2/c']);
    expect(nextLesson(REGISTRY, 'm1/b')).toBe('m2/c');
    expect(nextLesson(REGISTRY, 'm2/c')).toBeNull();
    expect(prevLesson(REGISTRY, 'm1/b')).toBe('m1/a');
    expect(prevLesson(REGISTRY, 'm1/a')).toBeNull();
  });
});

describe('nextStep and prevStep', () => {
  it('moves within a lesson', () => {
    expect(nextStep(REGISTRY, 'm1/a', '01-x')).toEqual({
      kind: 'exercise',
      lesson: 'm1/a',
      exercise: '02-y',
    });
    expect(prevStep(REGISTRY, 'm2/c', '03-r')).toEqual({
      kind: 'exercise',
      lesson: 'm2/c',
      exercise: '02-q',
    });
  });

  it('past the last exercise opens the next lesson; before the first, the previous lesson’s last exercise', () => {
    expect(nextStep(REGISTRY, 'm1/a', '02-y')).toEqual({
      kind: 'lesson',
      lesson: 'm1/b',
    });
    expect(nextStep(REGISTRY, 'm1/b', '01-z')).toEqual({
      kind: 'lesson',
      lesson: 'm2/c',
    });
    expect(prevStep(REGISTRY, 'm2/c', '01-p')).toEqual({
      kind: 'exercise',
      lesson: 'm1/b',
      exercise: '01-z',
    });
    expect(prevStep(REGISTRY, 'm1/b', '01-z')).toEqual({
      kind: 'exercise',
      lesson: 'm1/a',
      exercise: '02-y',
    });
  });

  it('stops at either end of the course with the reason', () => {
    expect(nextStep(REGISTRY, 'm2/c', '03-r')).toEqual({
      kind: 'none',
      reason: 'this is the last exercise of the course',
    });
    expect(prevStep(REGISTRY, 'm1/a', '01-x')).toEqual({
      kind: 'none',
      reason: 'this is the first exercise of the course',
    });
  });
});

describe('firstUnfinished', () => {
  it('is the first exercise not passed, or the first one when all are passed', () => {
    const ids = lessons['m2/c']?.exercises ?? [];
    expect(firstUnfinished(REGISTRY, 'm2/c', {})).toBe('01-p');
    expect(
      firstUnfinished(REGISTRY, 'm2/c', {
        [ids[0] as string]: 'passed',
        [ids[1] as string]: 'in-progress',
      }),
    ).toBe('02-q');
    expect(
      firstUnfinished(
        REGISTRY,
        'm2/c',
        Object.fromEntries(ids.map((id) => [id, 'passed'])),
      ),
    ).toBe('01-p');
    expect(firstUnfinished(REGISTRY, 'missing', {})).toBeNull();
  });
});
