import type { Equal, Expect } from '@dojo/type-utils';
import { average, recorded } from './index';

type cases = [
  Expect<
    Equal<
      typeof recorded,
      (scores: readonly (number | undefined)[]) => number[]
    >
  >, // recorded returns numbers only
];

test('recorded drops the players who did not play', () => {
  expect(recorded([7, undefined, 3, undefined])).toEqual([7, 3]);
  expect(recorded([undefined, undefined])).toEqual([]);
  expect(recorded([])).toEqual([]);
});

test('recorded keeps a score of 0', () => {
  expect(recorded([0])).toEqual([0]);
  expect(recorded([4, 0, undefined, 0, 9])).toEqual([4, 0, 0, 9]);
});

test('recorded keeps negative and fractional scores in order', () => {
  for (let n = 1; n <= 8; n++) {
    const scores = [n, undefined, -n, 0, n / 2];
    expect(recorded(scores)).toEqual([n, -n, 0, n / 2]);
  }
});

test('average counts a 0 as a score', () => {
  expect(average([10, 0, undefined, 20])).toBe(10);
  expect(average([0, 0, 6])).toBe(2);
  expect(average([0])).toBe(0);
});

test('average of no recorded scores is 0', () => {
  expect(average([])).toBe(0);
  expect(average([undefined, undefined])).toBe(0);
});
