import type { Equal, Expect } from '@dojo/type-utils';
import { createCounter, type Counter } from './index';

type cases = [
  Expect<Equal<Parameters<Counter>, []>>, // called with no arguments
  Expect<Equal<ReturnType<Counter>, number>>, // calling it returns the count
  Expect<Equal<Counter['count'], number>>, // count is a number
  Expect<Equal<ReturnType<Counter['reset']>, void>>, // reset returns nothing
  Expect<Equal<Parameters<Counter['reset']>, []>>, // reset takes no arguments
  Expect<Equal<Counter, { (): number; count: number; reset(): void }>>, // one object type with a call signature
];

// @ts-expect-error
const withArgument = (counter: Counter) => counter(2); // a call takes no arguments

// @ts-expect-error
const bare: Counter = () => 1; // a plain function has no count or reset

test('each call adds one and returns the new count', () => {
  const counter = createCounter(0);
  for (let n = 1; n <= 10; n++) {
    expect(counter()).toBe(n);
    expect(counter.count).toBe(n);
  }
});

test('the count starts at start', () => {
  for (const start of [-3, 0, 5, 41, 1000]) {
    const counter = createCounter(start);
    expect(counter.count).toBe(start);
    expect(counter()).toBe(start + 1);
    expect(counter()).toBe(start + 2);
  }
});

test('reset goes back to start', () => {
  const counter = createCounter(7);
  counter();
  counter();
  expect(counter.reset()).toBeUndefined();
  expect(counter.count).toBe(7);
  expect(counter()).toBe(8);
});

test('every counter keeps its own count', () => {
  const a = createCounter(0);
  const b = createCounter(100);
  a();
  a();
  b();
  expect(a.count).toBe(2);
  expect(b.count).toBe(101);
  a.reset();
  expect(a.count).toBe(0);
  expect(b.count).toBe(101);
});

test('a counter is a function', () => {
  expect(typeof createCounter(1)).toBe('function');
});

export { withArgument, bare };
