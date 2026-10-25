import type { Equal, Expect } from '@dojo/type-utils';
import { pipe, repeat, type Step } from './index';

const double = (n: number) => n * 2;
const increment = (n: number) => n + 1;

type cases = [
  Expect<Equal<Step, (value: number) => number>>, // a Step is still a number in, a number out
];

// @ts-expect-error every step takes a number
const takesText = () => pipe(1, (text: string) => text.length); // takes a string

// @ts-expect-error every step returns a number
const returnsText = () => pipe(1, (n: number) => n.toFixed(2)); // returns a string

// @ts-expect-error repeat repeats a step
const notAStep = () => repeat(2); // 2 is not a step

// @ts-expect-error the count is a number
const textCount = () => repeat(double, 'twice'); // 'twice' is not a number

export { takesText, returnsText, notAStep, textCount };

test('pipe runs the steps in order', () => {
  expect(pipe(3, double, increment)).toBe(7);
});

test('pipe in the other order', () => {
  expect(pipe(3, increment, double)).toBe(8);
});

test('pipe with no steps returns the value', () => {
  expect(pipe(3)).toBe(3);
});

test('pipe takes steps spread from an array', () => {
  const steps = [double, double, increment];
  expect(pipe(1, ...steps)).toBe(5);
});

test('repeat applies a step twice by default', () => {
  expect(repeat(double)(3)).toBe(12);
});

test('repeat takes a count', () => {
  expect(repeat(increment, 5)(0)).toBe(5);
});

test('repeat with a count of 0 changes nothing', () => {
  expect(repeat(double, 0)(7)).toBe(7);
});

test('a repeated step is a step', () => {
  expect(pipe(1, repeat(double, 3), increment)).toBe(9);
});
