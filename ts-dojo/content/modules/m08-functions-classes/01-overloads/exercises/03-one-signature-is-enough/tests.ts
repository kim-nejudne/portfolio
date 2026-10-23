import type { Equal, Expect } from '@dojo/type-utils';
import { characters, last, lastFlag, total } from './index';

const lastWord = last(['a', 'b']);
const lastNumber = last([1, 2, 3]);
const lastDate = last([new Date(0)]);
const lastPoint = last([{ x: 1, y: 2 }]);
const frozen: readonly number[] = [4, 5];
const lastFrozen = last(frozen);

type cases = [
  Expect<
    Equal<typeof characters, (input: string | readonly string[]) => number>
  >, // characters has one signature
  Expect<Equal<typeof last, <T>(items: readonly T[]) => T | undefined>>, // last has one generic signature
  Expect<Equal<typeof lastFlag, boolean | undefined>>, // last of booleans
  Expect<Equal<typeof lastWord, string | undefined>>, // last of strings
  Expect<Equal<typeof lastNumber, number | undefined>>, // last of numbers
  Expect<Equal<typeof lastDate, Date | undefined>>, // last of dates
  Expect<Equal<typeof lastPoint, { x: number; y: number } | undefined>>, // last of objects
  Expect<Equal<typeof lastFrozen, number | undefined>>, // last of a readonly list
];

test('the two exports at the bottom', () => {
  expect(total).toBe(6);
  expect(lastFlag).toBe(false);
});

test('characters counts a string', () => {
  for (let n = 0; n <= 10; n++) {
    expect(characters('x'.repeat(n))).toBe(n);
  }
});

test('characters counts every string in a list', () => {
  expect(characters(['ab', '', 'cde'])).toBe(5);
  expect(characters([])).toBe(0);
  expect(characters(['x'.repeat(7), 'y'.repeat(4)])).toBe(11);
});

test('last returns the last element', () => {
  expect(lastWord).toBe('b');
  expect(lastNumber).toBe(3);
  expect(lastFrozen).toBe(5);
  const point = { x: 1, y: 2 };
  expect(last([{ x: 0, y: 0 }, point])).toBe(point);
  for (let n = 1; n <= 8; n++) {
    const items = Array.from({ length: n }, (_, i) => i * 10);
    expect(last(items)).toBe((n - 1) * 10);
  }
});

test('last of an empty list is undefined', () => {
  expect(last([])).toBeUndefined();
});
