import type { Equal, Expect } from '@dojo/type-utils';
import { traced } from './index';

function pad(text: string, width: number, fill = ' '): string {
  return text.padStart(width, fill);
}
function sum(...values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
function ready(): boolean {
  return true;
}

const padCalls: unknown[][] = [];
const sumCalls: unknown[][] = [];
const tracedPad = traced(pad, (args) => padCalls.push(args));
const tracedSum = traced(sum, (args) => sumCalls.push(args));
const tracedReady = traced(ready, () => {});
const counted = Object.assign((n: number) => n * 2, { calls: 0 });
const tracedCounted = traced(counted, () => {});

declare function logPadCall(
  args: [text: string, width: number, fill?: string],
): void;
const withLogger = () => traced(pad, logPadCall); // a logger for pad's arguments fits

type cases = [
  Expect<
    Equal<
      typeof tracedPad,
      (text: string, width: number, fill?: string) => string
    >
  >, // pad's parameters and return type
  Expect<Equal<typeof tracedSum, (...values: number[]) => number>>, // a rest parameter
  Expect<Equal<typeof tracedReady, () => boolean>>, // no parameters
  Expect<Equal<typeof tracedCounted, (n: number) => number>>, // a new function: fn's own properties don't come along
];

// @ts-expect-error
const noWidth = () => tracedPad('a'); // width is required

// @ts-expect-error
const notANumber = () => tracedSum(1, '2'); // sum takes numbers

// @ts-expect-error
const tooMany = () => tracedReady(1); // ready takes nothing

// @ts-expect-error
const wrongLogger = () => traced(pad, (args: [number]) => args); // onCall gets pad's arguments

export { withLogger, noWidth, notANumber, tooMany, wrongLogger };

test('returns what fn returns', () => {
  expect(tracedPad('7', 3, '0')).toBe('007');
  expect(tracedPad('ok', 4)).toBe('  ok');
  expect(tracedSum(1, 2, 3)).toBe(6);
  expect(tracedSum()).toBe(0);
  expect(tracedReady()).toBe(true);
});

test('onCall gets the arguments as they were passed', () => {
  padCalls.length = 0;
  sumCalls.length = 0;
  tracedPad('a', 2);
  tracedPad('b', 3, '-');
  tracedSum(4, 5);
  tracedSum();
  expect(padCalls).toEqual([
    ['a', 2],
    ['b', 3, '-'],
  ]);
  expect(sumCalls).toEqual([[4, 5], []]);
});

test('onCall runs before fn, once per call', () => {
  const order: string[] = [];
  const shout = traced(
    (word: string) => {
      order.push(`fn ${word}`);
      return word.toUpperCase();
    },
    (args) => order.push(`onCall ${String(args)}`),
  );
  expect(shout('hi')).toBe('HI');
  expect(shout('yo')).toBe('YO');
  expect(order).toEqual(['onCall hi', 'fn hi', 'onCall yo', 'fn yo']);
});
