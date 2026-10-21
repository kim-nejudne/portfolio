import type { Equal, Expect } from '@dojo/type-utils';
import { retry } from './index';

type cases = [
  Expect<Equal<Parameters<typeof retry>[0], (n: number) => boolean>>, // attempt takes its number and says whether it worked
  Expect<Equal<Parameters<typeof retry>[1], (n: number) => void>>, // what onFailure returns is ignored
  Expect<Equal<Parameters<typeof retry>[2], number | undefined>>, // times is an optional number
  Expect<Equal<ReturnType<typeof retry>, boolean>>, // retry says whether an attempt worked
];

const works = () => true;
const ignore = () => {};

// @ts-expect-error an attempt must say whether it worked
const noAnswer = () => retry(ignore, ignore); // attempt returns nothing

// @ts-expect-error the number of attempts is a number
const textTimes = () => retry(works, ignore, 'twice'); // times is a string

export { noAnswer, textTimes };

/** An attempt that records its number and works from attempt `from` on. */
function worksFrom(from: number, tried: number[]) {
  return (n: number) => {
    tried.push(n);
    return n >= from;
  };
}

test('the first attempt works', () => {
  const failures: number[] = [];
  expect(retry(works, (n: number) => failures.push(n))).toBe(true);
  expect(failures).toEqual([]);
});

test('stops at the first attempt that works', () => {
  const tried: number[] = [];
  const failures: number[] = [];
  const worked = retry(worksFrom(2, tried), (n: number) => failures.push(n));
  expect(worked).toBe(true);
  expect(tried).toEqual([1, 2]);
  expect(failures).toEqual([1]);
});

test('makes 3 attempts unless told otherwise', () => {
  const tried: number[] = [];
  const failures: number[] = [];
  const worked = retry(worksFrom(4, tried), (n: number) => failures.push(n));
  expect(worked).toBe(false);
  expect(tried).toEqual([1, 2, 3]);
  expect(failures).toEqual([1, 2, 3]);
});

test('takes the number of attempts', () => {
  expect(retry(worksFrom(5, []), ignore, 5)).toBe(true);
  expect(retry(worksFrom(5, []), ignore, 4)).toBe(false);
});

test('makes no attempt when times is 0', () => {
  const tried: number[] = [];
  expect(retry(worksFrom(1, tried), ignore, 0)).toBe(false);
  expect(tried).toEqual([]);
});
