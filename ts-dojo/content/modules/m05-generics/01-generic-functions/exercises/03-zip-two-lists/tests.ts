import type { Equal, Expect } from '@dojo/type-utils';
import { zip } from './index';

const names: readonly string[] = ['Ada', 'Grace', 'Hedy'];
const years: readonly number[] = [1815, 1906, 1914];

const born = zip(names, years);
const flags = zip([true, false], ['on', 'off']);

type cases = [
  Expect<Equal<typeof born, [string, number][]>>, // a string list and a number list give string-number pairs
  Expect<Equal<typeof flags, [boolean, string][]>>, // the pair types follow the arguments
  Expect<
    Equal<
      ReturnType<typeof zip<string, number | null>>,
      [string, number | null][]
    >
  >, // explicit type arguments, left list first
];

// @ts-expect-error
const swapped: [number, string][] = zip(names, years); // the left list's items come first

test('pairs items at the same index', () => {
  expect(born).toEqual([
    ['Ada', 1815],
    ['Grace', 1906],
    ['Hedy', 1914],
  ]);
});

test('stops at the end of the shorter list', () => {
  expect(zip(['a', 'b', 'c'], [1])).toEqual([['a', 1]]);
  expect(zip([1], ['a', 'b', 'c'])).toEqual([[1, 'a']]);
  expect(zip([], [1, 2])).toEqual([]);
  expect(zip([1, 2], [])).toEqual([]);
});

test('lists of many lengths', () => {
  for (let leftLength = 0; leftLength <= 5; leftLength++) {
    for (let rightLength = 0; rightLength <= 5; rightLength++) {
      const left = Array.from({ length: leftLength }, (_, i) => i);
      const right = Array.from({ length: rightLength }, (_, i) => `r${i}`);
      const expected = Array.from(
        { length: Math.min(leftLength, rightLength) },
        (_, i) => [i, `r${i}`],
      );
      expect(zip(left, right)).toEqual(expected);
    }
  }
});

test('returns a new array and leaves the lists alone', () => {
  const left = [1, 2];
  const right = ['a', 'b'];
  const pairs = zip(left, right);
  expect(pairs).not.toBe(left);
  expect(left).toEqual([1, 2]);
  expect(right).toEqual(['a', 'b']);
});

export { swapped };
