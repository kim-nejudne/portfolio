import type { Equal, Expect, ExpectValidArgs } from '@dojo/type-utils';
import type { Callback, Callbackify } from './index';

type cases = [
  Expect<
    Equal<
      Callbackify<(id: number) => Promise<string>>,
      (id: number, callback: Callback<string>) => void
    >
  >, // one parameter
  Expect<
    Equal<
      Callbackify<(from: string, to: string) => Promise<boolean>>,
      (from: string, to: string, callback: Callback<boolean>) => void
    >
  >, // two parameters
  Expect<
    Equal<Callbackify<() => Promise<void>>, (callback: Callback<void>) => void>
  >, // no parameters: the callback is the only one
  Expect<
    Equal<
      Callbackify<(query: string, limit?: number) => Promise<string[]>>,
      (
        query: string,
        limit: number | undefined,
        callback: Callback<string[]>,
      ) => void
    >
  >, // an optional parameter before the callback becomes required
  Expect<
    Equal<
      Callbackify<(id: number, ...tags: string[]) => Promise<0 | 1>>,
      (
        ...args: [id: number, ...tags: string[], callback: Callback<0 | 1>]
      ) => void
    >
  >, // a rest parameter: the callback comes after it
  Expect<
    Equal<
      Callbackify<((a: string) => Promise<1>) | ((b: number) => Promise<2>)>,
      | ((a: string, callback: Callback<1>) => void)
      | ((b: number, callback: Callback<2>) => void)
    >
  >, // each member of a union
  Expect<Equal<Callbackify<(id: number) => string>, never>>, // no promise
  Expect<Equal<Callbackify<Promise<string>>, never>>, // not a function
  Expect<Equal<Callbackify<never>, never>>, // no functions at all
  Expect<ExpectValidArgs<typeof getName, [1, Callback<string>]>>, // a call with an id and a callback
];

declare const getName: Callbackify<(id: number) => Promise<string>>;

// @ts-expect-error
const noCallback = () => getName(1); // the callback is required

// @ts-expect-error
const callbackFirst = () => getName(() => {}, 1); // the callback comes last

// @ts-expect-error
const wrongResult = () => getName(1, (e, n: number) => n); // the result is a string

export { noCallback, callbackFirst, wrongResult };
