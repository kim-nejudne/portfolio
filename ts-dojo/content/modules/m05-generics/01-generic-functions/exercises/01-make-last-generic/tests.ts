import type { Equal, Expect } from '@dojo/type-utils';
import { last, lastName, lastScore } from './index';

type cases = [
  Expect<Equal<typeof lastScore, number | undefined>>, // the last score is a number
  Expect<Equal<typeof lastName, string | undefined>>, // the last name is a string
  Expect<Equal<ReturnType<typeof last<boolean>>, boolean | undefined>>, // any element type works
];

test('the last score and the last name', () => {
  expect(lastScore).toBe(4);
  expect(lastName).toBe('Hedy');
});

test('last of lists of many lengths', () => {
  for (let length = 1; length <= 8; length++) {
    const numbers = Array.from({ length }, (_, i) => i * 3);
    expect(last(numbers)).toBe((length - 1) * 3);
  }
});

test('last of an empty list is undefined', () => {
  expect(last([])).toBeUndefined();
});

test('last returns the item itself', () => {
  const ada = { name: 'Ada' };
  const grace = { name: 'Grace' };
  expect(last([ada, grace])).toBe(grace);
});
