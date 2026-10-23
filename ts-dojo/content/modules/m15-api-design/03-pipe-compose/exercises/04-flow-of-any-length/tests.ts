import type { Equal, Expect } from '@dojo/type-utils';
import { flow } from './index';

const add = (a: number, b: number) => a + b;
const inc = (n: number) => n + 1;
const fixed = (n: number) => n.toFixed(2);
const length = (text: string) => text.length;
const pad = (text: string, width: number, fill = ' ') =>
  text.padStart(width, fill);

const total = flow(add, fixed, length);
const onlyAdd = flow(add);
const padded = flow(pad, (text: string) => text.length);
// Twelve functions: far more than any list of overloads would cover.
const long = flow(add, inc, inc, inc, inc, inc, inc, inc, inc, inc, inc, fixed);

type cases = [
  Expect<Equal<typeof total, (a: number, b: number) => number>>, // add's parameters, length's result
  Expect<Equal<typeof onlyAdd, (a: number, b: number) => number>>, // one function is itself
  Expect<
    Equal<typeof padded, (text: string, width: number, fill?: string) => number>
  >, // an optional parameter stays optional
  Expect<Equal<typeof long, (a: number, b: number) => string>>, // any length
];

// @ts-expect-error
const firstLink = () => flow(add, length); // a number can't go into length

// @ts-expect-error
const lateLink = () => flow(length, inc, inc, length); // nor further on

// @ts-expect-error
const empty = () => flow(); // at least one function

// @ts-expect-error
const wrongArgs = () => total(1, '2'); // the first function's parameters

export { firstLink, lateLink, empty, wrongArgs };

test('runs the functions left to right', () => {
  expect(total(2, 3)).toBe(4);
  expect(onlyAdd(2, 3)).toBe(5);
  expect(long(1, 2)).toBe('13.00');
});

test('the first function gets every argument', () => {
  expect(padded('ab', 5, '_')).toBe(5);
  expect(padded('abcdef', 3)).toBe(6);
  const shout = flow(
    (text: string, times: number) => text.repeat(times),
    (text: string) => text.toUpperCase(),
  );
  expect(shout('ha', 3)).toBe('HAHAHA');
});

test('a flow can be called again and again', () => {
  const next = flow(inc, inc);
  expect([1, 2, 3].map((n) => next(n))).toEqual([3, 4, 5]);
});
