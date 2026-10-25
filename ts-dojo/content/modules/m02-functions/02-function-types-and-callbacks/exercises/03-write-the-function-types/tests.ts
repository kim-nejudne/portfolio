import type { Equal, Expect } from '@dojo/type-utils';
import type { Predicate, Prefixer, Reducer, Subscribe } from './index';

type cases = [
  Expect<Equal<Predicate, (value: number) => boolean>>, // Predicate: a number in, a boolean out
  Expect<Equal<Reducer, (total: number, value: number) => number>>, // Reducer: two numbers in, a number out
  Expect<Equal<Subscribe, (listener: (message: string) => void) => void>>, // Subscribe takes a listener
  Expect<Equal<Prefixer, (prefix: string) => (text: string) => string>>, // Prefixer returns a function
];

// @ts-expect-error a Prefixer returns a function, not a string
const plain: Prefixer = (prefix: string) => prefix; // returns a plain string

export { plain };
