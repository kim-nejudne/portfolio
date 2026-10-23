import type { Equal, Expect } from '@dojo/type-utils';
import { compose, loud, pipe, price, shout, slug } from './index';

const double = (n: number) => n * 2;
const length = (text: string) => text.length;

type cases = [
  Expect<Equal<typeof slug, string>>, // two steps
  Expect<Equal<typeof price, string>>, // three steps
  Expect<Equal<typeof shout, (a: number) => string>>, // compose takes what its last function takes
  Expect<Equal<typeof loud, string>>, // and returns what its first function returns
];

// @ts-expect-error
const twoLinks = () => pipe(4, double, length); // a number can't go into length

// @ts-expect-error
const threeLinks = () => pipe(4, double, double, length); // nor at the end

// @ts-expect-error
const backwards = () => compose(length, double); // double's result can't go into length

export { twoLinks, threeLinks, backwards };

test('pipe runs its functions left to right', () => {
  expect(slug).toBe('hello-typed-world');
  expect(price).toBe('   19.50');
  expect(pipe(3, double, double, double)).toBe(24);
  expect(pipe('kept')).toBe('kept');
});

test('compose runs its functions right to left', () => {
  expect(loud).toBe('2.5!');
  expect(compose(double, length)('four')).toBe(8);
  expect(compose(length)('abc')).toBe(3);
});
