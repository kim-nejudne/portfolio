import type { Equal, Expect } from '@dojo/type-utils';
import { logAll, shout, visitAll, type Visit } from './index';

type cases = [
  Expect<Equal<Visit, (name: string) => void>>, // a visit's result is ignored, and the type says so
  Expect<Equal<Parameters<typeof visitAll>[1], Visit>>, // visitAll takes a Visit
];

test('shout upper-cases every name', () => {
  expect(shout(['ada', 'grace'])).toEqual(['ADA', 'GRACE']);
});

test('visitAll takes a callback that returns a value', () => {
  const seen: string[] = [];
  visitAll(['b', 'a', 'c'], (name) => seen.push(name));
  expect(seen).toEqual(['b', 'a', 'c']);
});

test('visitAll of no names calls nothing', () => {
  let calls = 0;
  visitAll([], () => calls++);
  expect(calls).toBe(0);
});

test('logAll still runs', () => {
  expect(() => logAll(['ada', 'grace'])).not.toThrow();
});
