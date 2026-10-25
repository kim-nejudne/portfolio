import type { Equal, Expect } from '@dojo/type-utils';
import { tally } from './index';

type cases = [
  Expect<Equal<ReturnType<typeof tally>, Record<string, number>>>, // tally returns a count for any option name
];

test('counts the votes for each option', () => {
  expect(tally(['tea', 'coffee', 'tea'])).toEqual({ tea: 2, coffee: 1 });
});

test('a single vote counts once', () => {
  expect(tally(['juice'])).toEqual({ juice: 1 });
});

test('counts any number of votes', () => {
  for (let n = 1; n <= 10; n++) {
    const votes = [
      ...Array.from({ length: n }, () => 'yes'),
      ...Array.from({ length: n + 2 }, () => 'no'),
    ];
    expect(tally(votes)).toEqual({ yes: n, no: n + 2 });
  }
});

test('no votes, no options', () => {
  expect(tally([])).toEqual({});
});
