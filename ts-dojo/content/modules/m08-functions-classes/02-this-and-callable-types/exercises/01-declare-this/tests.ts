import type { Equal, Expect } from '@dojo/type-utils';
import { first, vote, type Tally } from './index';

type cases = [
  Expect<Equal<ThisParameterType<typeof vote>, Tally>>, // this is a Tally
  Expect<Equal<Parameters<typeof vote>, [by: number]>>, // by is the only parameter
  Expect<Equal<ReturnType<typeof vote>, string>>, // it still returns a string
];

// @ts-expect-error
const plain = () => vote(1); // a plain call has no tally

// @ts-expect-error
const wrongThis = () => vote.call({ name: 'spaces' }, 1); // a tally needs its votes

test('the line at the bottom', () => {
  expect(first).toBe('tabs: 2');
});

test('vote adds to the tally it is called with', () => {
  const tally: Tally = { name: 'spaces', votes: 0 };
  for (let n = 1; n <= 5; n++) {
    expect(vote.call(tally, n)).toBe(`spaces: ${(n * (n + 1)) / 2}`);
  }
  expect(tally.votes).toBe(15);
});

test('two tallies are counted separately', () => {
  const a = { name: 'a', votes: 10, vote };
  const b = { name: 'b', votes: 0, vote };
  expect(a.vote(1)).toBe('a: 11');
  expect(b.vote(3)).toBe('b: 3');
  expect(a.vote(-2)).toBe('a: 9');
  expect(b.votes).toBe(3);
});

test('this is not a real parameter', () => {
  expect(vote.length).toBe(1);
});

export { plain, wrongThis };
