import type { Equal, Expect } from '@dojo/type-utils';
import { biggest, largest, SIZES } from './index';

type cases = [
  Expect<Equal<typeof SIZES, readonly number[]>>, // SIZES is still read-only
  Expect<Equal<typeof largest, (sizes: readonly number[]) => number>>, // largest accepts a read-only list
];

test('the largest size on offer', () => {
  expect(biggest).toBe(20);
});

test('largest reads any list', () => {
  expect(largest([3, 9, 4])).toBe(9);
});

test('the sizes are unchanged', () => {
  expect(SIZES).toEqual([12, 14, 16, 20]);
});
