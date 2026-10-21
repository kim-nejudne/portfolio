import type { Equal, Expect } from '@dojo/type-utils';
import { euros, formatAll, percent, type Format } from './index';

type cases = [
  Expect<Equal<Format, (value: number) => string>>, // Format is unchanged
  Expect<Equal<typeof euros, Format>>, // euros takes a number and returns a string
  Expect<Equal<typeof percent, Format>>, // percent takes a number and returns a string
];

test('euros formats with two decimals', () => {
  expect(formatAll([3, 4.5], euros)).toEqual(['€3.00', '€4.50']);
});

test('percent formats a fraction', () => {
  expect(formatAll([0.25, 1], percent)).toEqual(['25%', '100%']);
});

test('formatAll of no values is empty', () => {
  expect(formatAll([], euros)).toEqual([]);
});
