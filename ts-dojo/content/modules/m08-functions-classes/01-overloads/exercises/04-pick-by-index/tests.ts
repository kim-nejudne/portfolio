import type { Equal, Expect, ExpectValidArgs } from '@dojo/type-utils';
import { pick } from './index';

const letters = ['a', 'b', 'c'];

const one = pick(letters, 0);
const several = pick(letters, [0, 2]);
const flag = pick([true, false], -1);
const dates = pick([new Date(0)], [0, 0]);
const frozen: readonly number[] = [1, 2, 3];
const fromFrozen = pick(frozen, 1);

type cases = [
  Expect<Equal<typeof one, string | undefined>>, // one index gives the element or undefined
  Expect<Equal<typeof several, (string | undefined)[]>>, // a list of indexes gives an array
  Expect<Equal<typeof flag, boolean | undefined>>, // any element type
  Expect<Equal<typeof dates, (Date | undefined)[]>>, // any element type, several
  Expect<Equal<typeof fromFrozen, number | undefined>>, // a readonly list
  Expect<
    ExpectValidArgs<
      typeof pick,
      [readonly string[], number | readonly number[]]
    >
  >, // either kind of which is accepted
  Expect<
    Equal<
      ReturnType<typeof pick<string>>,
      string | undefined | (string | undefined)[]
    >
  >, // either kind of which gives either result
];

// @ts-expect-error
const byName = () => pick(letters, '0'); // an index is a number

// @ts-expect-error
const sure: string = pick(letters, 0); // the element may be missing

// @ts-expect-error
const sureList: string[] = pick(letters, [0]); // so may each entry

test('one index returns that element', () => {
  for (let i = 0; i < letters.length; i++) {
    expect(pick(letters, i)).toBe(letters[i]);
  }
});

test('a negative index counts from the end', () => {
  expect(pick(letters, -1)).toBe('c');
  expect(pick(letters, -3)).toBe('a');
  expect(pick([10, 20, 30, 40], -2)).toBe(30);
});

test('an index past either end gives undefined', () => {
  expect(pick(letters, 3)).toBeUndefined();
  expect(pick(letters, -4)).toBeUndefined();
  expect(pick([], 0)).toBeUndefined();
});

test('a list of indexes returns one entry per index, in order', () => {
  expect(pick(letters, [2, 0, 5])).toEqual(['c', 'a', undefined]);
  expect(pick(letters, [1, 1, -1])).toEqual(['b', 'b', 'c']);
  expect(pick(letters, [])).toEqual([]);
  const numbers = Array.from({ length: 10 }, (_, i) => i * i);
  const indexes = [9, 3, -1, 0, 12, -10, 5];
  expect(pick(numbers, indexes)).toEqual(indexes.map((i) => numbers.at(i)));
});

test('a single index returns the element itself, not an array', () => {
  expect(Array.isArray(pick(letters, 0))).toBe(false);
  expect(Array.isArray(pick(letters, [0]))).toBe(true);
  const lists = [[1], [2, 3]];
  expect(pick(lists, 1)).toBe(lists[1]);
});

test('pick does not change its arguments', () => {
  const list = ['x', 'y', 'z'];
  const indexes = [2, 0];
  pick(list, indexes);
  expect(list).toEqual(['x', 'y', 'z']);
  expect(indexes).toEqual([2, 0]);
});

export { byName, sure, sureList };
