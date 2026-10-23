import type { Equal, Expect } from '@dojo/type-utils';
import { shortest, shortestList, shortestWord } from './index';

type Named = { length: number; name: string };

type cases = [
  Expect<Equal<typeof shortestWord, string | undefined>>, // the shortest word is a string
  Expect<Equal<typeof shortestList, number[] | undefined>>, // the shortest list is a number[]
  Expect<Equal<ReturnType<typeof shortest<Named>>, Named | undefined>>, // any type with a length works, and comes back whole
];

// @ts-expect-error
shortest([1, 2, 3]); // numbers have no length

// @ts-expect-error
shortest([{ name: 'Ada' }]); // neither does an object without one

test('the shortest word and the shortest list', () => {
  expect(shortestWord).toBe('fig');
  expect(shortestList).toEqual([3]);
});

test('words of many lengths, in any position', () => {
  for (let size = 1; size <= 6; size++) {
    for (let position = 0; position < size; position++) {
      const words = Array.from({ length: size }, (_, i) =>
        i === position ? 'x' : 'x'.repeat(i + 2),
      );
      expect(shortest(words)).toBe('x');
    }
  }
});

test('the first one wins a tie', () => {
  const first = { length: 2, name: 'first' };
  const second = { length: 2, name: 'second' };
  expect(shortest([{ length: 5, name: 'long' }, first, second])).toBe(first);
});

test('an empty list gives undefined', () => {
  expect(shortest([])).toBeUndefined();
});
