import type { Equal, Expect } from '@dojo/type-utils';
import { join } from './index';
import type { Join } from './index';

type Ten = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
type Hundred = [
  ...Ten,
  ...Ten,
  ...Ten,
  ...Ten,
  ...Ten,
  ...Ten,
  ...Ten,
  ...Ten,
  ...Ten,
  ...Ten,
];

const ids: number[] = [3, 4, 5];
const slash: string = '/';
const flags = ['on', 1, false] as const;

// Never called: the calls are here for their types.
const path = () => join(['a', 'b'], '/');
const mixed = () => join(['x', 2, true], ', ');
const withArray = () => join(ids, '-');
const anySeparator = () => join(['x', 'y'], slash);
const empty = () => join([], '-');
const asConst = () => join(flags, '|');

type cases = [
  Expect<Equal<Join<['a', 1, true], '-'>, 'a-1-true'>>, // Join: three parts
  Expect<Equal<Join<['a', 'b', 'c'], ''>, 'abc'>>, // Join: an empty separator
  Expect<Equal<Join<[7], '-'>, '7'>>, // Join: one part
  Expect<Equal<Join<[], '-'>, ''>>, // Join: no parts
  Expect<Equal<Join<['', 'a'], '-'>, '-a'>>, // Join: an empty first part
  Expect<Equal<Join<['a', ''], '-'>, 'a-'>>, // Join: an empty last part
  Expect<Equal<Join<readonly ['x', 'y'], ' + '>, 'x + y'>>, // Join: readonly
  Expect<Equal<Join<['a' | 'b', 'c'], '-'>, 'a-c' | 'b-c'>>, // Join: a union part
  Expect<Equal<Join<number[], '-'>, string>>, // Join: an array
  Expect<Equal<Join<[1, ...string[]], '-'>, string>>, // Join: a rest element
  Expect<
    Equal<
      Join<Hundred, ''>,
      '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789'
    >
  >, // Join: 100 parts
  Expect<
    Equal<
      Join<Hundred, ','>,
      '0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9'
    >
  >, // Join: 100 parts and a separator
  Expect<Equal<ReturnType<typeof path>, 'a/b'>>, // join: literal parts
  Expect<Equal<ReturnType<typeof mixed>, 'x, 2, true'>>, // join: mixed parts
  Expect<Equal<ReturnType<typeof withArray>, string>>, // join: an array argument
  Expect<Equal<ReturnType<typeof anySeparator>, `x${string}y`>>, // join: a string separator
  Expect<Equal<ReturnType<typeof empty>, ''>>, // join: an empty tuple
  Expect<Equal<ReturnType<typeof asConst>, 'on|1|false'>>, // join: an as const tuple
];

// @ts-expect-error
const notAPart = () => join([{}], '-'); // an object is not a Part

export { path, mixed, withArray, anySeparator, empty, asConst, notAPart };

test('joins parts with the separator', () => {
  expect(join(['a', 'b'], '/')).toBe('a/b');
  expect(join(['x', 2, true], ', ')).toBe('x, 2, true');
  expect(join(flags, '|')).toBe('on|1|false');
});

test('handles empty and single parts', () => {
  expect(join([], '-')).toBe('');
  expect(join([7], '-')).toBe('7');
  expect(join(['', 'a'], '-')).toBe('-a');
});

test('joins arrays and long lists', () => {
  expect(join(ids, '-')).toBe('3-4-5');
  const many = Array.from({ length: 100 }, (_, i) => i % 10);
  expect(join(many, '')).toBe(
    '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789',
  );
});
