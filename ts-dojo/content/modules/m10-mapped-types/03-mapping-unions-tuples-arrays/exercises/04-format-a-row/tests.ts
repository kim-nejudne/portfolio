import type { Equal, Expect } from '@dojo/type-utils';
import { formatRow, type Formatters } from './index';

type Person = [name: string, age: number, admin: boolean];

type cases = [
  Expect<
    Equal<
      Formatters<[string, number]>,
      [(value: string) => string, (value: number) => string]
    >
  >, // one formatter per element, typed by its position
  Expect<
    Equal<
      Formatters<readonly ['id', 'name']>,
      readonly [(value: 'id') => string, (value: 'name') => string]
    >
  >, // a readonly tuple, with literal elements
  Expect<
    Equal<
      Formatters<[a: Date, b?: number]>,
      [a: (value: Date) => string, b?: (value: number | undefined) => string]
    >
  >, // labels and an optional element
  Expect<Equal<Formatters<number[]>, ((value: number) => string)[]>>, // an array
  Expect<Equal<Formatters<[]>, []>>, // the empty tuple
  Expect<Equal<Formatters<{ id: number }>, { id: (value: number) => string }>>, // an object type
  Expect<
    Equal<
      Formatters<[string] | [number, number]>,
      | [(value: string) => string]
      | [(value: number) => string, (value: number) => string]
    >
  >, // a union, member by member
];

declare const person: Person;
const name = (value: string) => value.toUpperCase();
const age = (value: number) => `${value} years`;
const admin = (value: boolean) => (value ? 'admin' : 'member');

// @ts-expect-error
const tooFew = () => formatRow(person, [name, age]); // one formatter per cell

// @ts-expect-error
const swapped = () => formatRow(person, [age, name, admin]); // each formatter fits its cell

// @ts-expect-error
const notARow = () => formatRow({ id: 1 }, { id: age }); // a row is an array

test('each cell is formatted by the formatter at its position', () => {
  const ada: Person = ['Ada', 36, true];
  expect(formatRow(ada, [name, age, admin])).toEqual([
    'ADA',
    '36 years',
    'admin',
  ]);
  const alan: Person = ['Alan', 41, false];
  expect(formatRow(alan, [name, age, admin])).toEqual([
    'ALAN',
    '41 years',
    'member',
  ]);
});

test('the formatters can be written in the call, typed by their positions', () => {
  const row: [string, number] = ['tea', 2.5];
  const cells = formatRow(row, [
    (item) => item.padEnd(5, '.'),
    (price) => price.toFixed(2),
  ]);
  expect(cells).toEqual(['tea..', '2.50']);
});

test('a readonly row from as const works too', () => {
  const header = ['name', 'age'] as const;
  expect(
    formatRow(header, [(cell) => cell, (cell) => cell.toUpperCase()]),
  ).toEqual(['name', 'AGE']);
});

test('an array row takes one formatter per element', () => {
  const scores: number[] = [9.5, 7, 10];
  const formatters = scores.map(() => (score: number) => score.toFixed(1));
  expect(formatRow(scores, formatters)).toEqual(['9.5', '7.0', '10.0']);
});

test('an empty row gives no cells', () => {
  const empty: [] = [];
  expect(formatRow(empty, [])).toEqual([]);
});

export { tooFew, swapped, notARow };
