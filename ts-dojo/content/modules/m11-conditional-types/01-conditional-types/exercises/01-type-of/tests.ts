import type { Equal, Expect } from '@dojo/type-utils';
import type { TypeOf } from './index';

class Point {
  x = 0;
  y = 0;
}

type cases = [
  Expect<Equal<TypeOf<string>, 'string'>>, // string
  Expect<Equal<TypeOf<'hi'>, 'string'>>, // a string literal
  Expect<Equal<TypeOf<number>, 'number'>>, // number
  Expect<Equal<TypeOf<-1>, 'number'>>, // a number literal
  Expect<Equal<TypeOf<bigint>, 'bigint'>>, // bigint
  Expect<Equal<TypeOf<10n>, 'bigint'>>, // a bigint literal
  Expect<Equal<TypeOf<boolean>, 'boolean'>>, // boolean
  Expect<Equal<TypeOf<false>, 'boolean'>>, // a boolean literal
  Expect<Equal<TypeOf<symbol>, 'symbol'>>, // symbol
  Expect<Equal<TypeOf<typeof Symbol.iterator>, 'symbol'>>, // a unique symbol
  Expect<Equal<TypeOf<undefined>, 'undefined'>>, // undefined
  Expect<Equal<TypeOf<() => void>, 'function'>>, // a function type
  Expect<Equal<TypeOf<(a: string, b: number) => boolean>, 'function'>>, // with parameters
  Expect<Equal<TypeOf<typeof Point>, 'function'>>, // a class is a function
  Expect<Equal<TypeOf<typeof Map>, 'function'>>, // so is a built-in constructor
  Expect<Equal<TypeOf<Point>, 'object'>>, // an instance is an object
  Expect<Equal<TypeOf<{ name: string }>, 'object'>>, // an object type
  Expect<Equal<TypeOf<{ call(): void }>, 'object'>>, // an object with a method is not callable
  Expect<Equal<TypeOf<string[]>, 'object'>>, // an array
  Expect<Equal<TypeOf<readonly [1, 2]>, 'object'>>, // a readonly tuple
  Expect<Equal<TypeOf<Date>, 'object'>>, // a Date
  Expect<Equal<TypeOf<null>, 'object'>>, // typeof null is 'object'
  Expect<Equal<TypeOf<'a' | 1 | null>, 'string' | 'number' | 'object'>>, // one answer per member
  Expect<Equal<TypeOf<string | (() => void)>, 'string' | 'function'>>, // a string or a function
  Expect<Equal<TypeOf<never>, never>>, // the empty union gives no answer
];

// @ts-expect-error
const wrong: TypeOf<null> = 'null'; // typeof null is not 'null'

export { wrong };
