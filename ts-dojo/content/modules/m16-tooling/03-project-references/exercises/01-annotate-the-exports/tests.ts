import type { Equal, Expect } from '@dojo/type-utils';
import { EMPTY, sizeOf, summarize } from './index';

type cases = [
  Expect<Equal<ReturnType<typeof sizeOf>, 'small' | 'medium' | 'large'>>, // sizeOf keeps its three sizes
  Expect<
    Equal<
      ReturnType<typeof summarize>,
      { total: number; sizes: ('small' | 'medium' | 'large')[] }
    >
  >, // summarize keeps its inferred shape
  Expect<Equal<typeof EMPTY, ReturnType<typeof summarize>>>, // EMPTY has the type summarize returns
];

test('sizeOf picks the size at each boundary', () => {
  expect(sizeOf(0)).toBe('small');
  expect(sizeOf(9)).toBe('small');
  expect(sizeOf(10)).toBe('medium');
  expect(sizeOf(99)).toBe('medium');
  expect(sizeOf(100)).toBe('large');
  expect(sizeOf(5000)).toBe('large');
});

test('summarize adds the counts and sizes each one', () => {
  expect(summarize([3, 40, 250])).toEqual({
    total: 293,
    sizes: ['small', 'medium', 'large'],
  });
  expect(summarize([7])).toEqual({ total: 7, sizes: ['small'] });
});

test('EMPTY is the summary of no counts', () => {
  expect(EMPTY).toEqual({ total: 0, sizes: [] });
});
