import type { Equal, Expect } from '@dojo/type-utils';
import { zip } from './index';
import type { Zip } from './index';

const ids: number[] = [3, 4, 5];
const origin = [0, 1] as const;

// Never called: the calls are here for their types.
const tuples = () => zip([1, 'a'], [true, null]);
const longerFirst = () => zip([1, 2, 3], ['x']);
const withArray = () => zip(ids, ['a', 'b']);
const emptyFirst = () => zip([], [1]);
const asConst = () => zip(origin, ['a', 'b'] as const);

type cases = [
  Expect<Equal<Zip<[1, 2], ['a', 'b']>, [[1, 'a'], [2, 'b']]>>, // Zip: equal lengths
  Expect<Equal<Zip<[1, 2, 3], ['a']>, [[1, 'a']]>>, // Zip: B is shorter
  Expect<Equal<Zip<[true], [1, 2, 3]>, [[true, 1]]>>, // Zip: A is shorter
  Expect<Equal<Zip<[], ['a']>, []>>, // Zip: A is empty
  Expect<Equal<Zip<['a'], []>, []>>, // Zip: B is empty
  Expect<
    Equal<
      Zip<[string, number, boolean], [null, undefined, bigint]>,
      [[string, null], [number, undefined], [boolean, bigint]]
    >
  >, // Zip: three pairs
  Expect<
    Equal<Zip<readonly [1, 2], readonly ['a', 'b']>, [[1, 'a'], [2, 'b']]>
  >, // Zip: readonly in, mutable out
  Expect<Equal<Zip<number[], ['a', 'b']>, [number, 'a' | 'b'][]>>, // Zip: an array first
  Expect<Equal<Zip<[1, 2], string[]>, [1 | 2, string][]>>, // Zip: an array second
  Expect<Equal<Zip<[1, ...string[]], [true]>, [1 | string, true][]>>, // Zip: a rest element
  Expect<Equal<ReturnType<typeof tuples>, [[number, boolean], [string, null]]>>, // zip: tuples
  Expect<Equal<ReturnType<typeof longerFirst>, [[number, string]]>>, // zip: stops at the shorter
  Expect<Equal<ReturnType<typeof withArray>, [number, string][]>>, // zip: an array argument
  Expect<Equal<ReturnType<typeof emptyFirst>, []>>, // zip: an empty tuple
  Expect<Equal<ReturnType<typeof asConst>, [[0, 'a'], [1, 'b']]>>, // zip: as const tuples
];

// @ts-expect-error
const notAnArray = () => zip([1], 'ab'); // a string is not an array

export { tuples, longerFirst, withArray, emptyFirst, asConst, notAnArray };

test('pairs elements by position', () => {
  expect(zip([1, 'a'], [true, null])).toEqual([
    [1, true],
    ['a', null],
  ]);
  expect(zip(origin, ['a', 'b'] as const)).toEqual([
    [0, 'a'],
    [1, 'b'],
  ]);
});

test('stops at the end of the shorter one', () => {
  expect(zip([1, 2, 3], ['x'])).toEqual([[1, 'x']]);
  expect(zip(['x'], [1, 2, 3])).toEqual([['x', 1]]);
  expect(zip(ids, ['a', 'b'])).toEqual([
    [3, 'a'],
    [4, 'b'],
  ]);
});

test('gives no pairs when either side is empty', () => {
  expect(zip([], [1])).toEqual([]);
  expect(zip([1], [])).toEqual([]);
  expect(zip([], [])).toHaveLength(0);
});

test('keeps undefined elements', () => {
  expect(zip([undefined, 2], ['a', undefined])).toEqual([
    [undefined, 'a'],
    [2, undefined],
  ]);
});

test('returns a new array each call', () => {
  const left = [1, 2];
  const first = zip(left, left);
  const second = zip(left, left);
  expect(first === second).toBe(false);
  expect(first).toEqual([
    [1, 1],
    [2, 2],
  ]);
});
