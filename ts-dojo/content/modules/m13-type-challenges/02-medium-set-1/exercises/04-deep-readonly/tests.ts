// Cases adapted from type-challenges #00009, https://github.com/type-challenges/type-challenges/blob/main/questions/00009-medium-deep-readonly/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { DeepReadonly } from './index';

type cases = [
  Expect<Equal<DeepReadonly<X1>, Expected1>>, // nested objects, a function, tuples
  Expect<Equal<DeepReadonly<X2>, Expected2>>, // a union
  // Added in the dojo: arrays, and arrays of objects.
  Expect<Equal<DeepReadonly<X3>, Expected3>>, // arrays
];

type X1 = {
  a: () => 22;
  b: string;
  c: {
    d: boolean;
    e: {
      g: {
        h: {
          i: true;
          j: 'string';
        };
        k: 'hello';
      };
      l: [
        'hi',
        {
          m: ['hey'];
        },
      ];
    };
  };
};

type X2 = { a: string } | { b: number };

type X3 = { tags: string[]; rows: { id: number }[] };

type Expected1 = {
  readonly a: () => 22;
  readonly b: string;
  readonly c: {
    readonly d: boolean;
    readonly e: {
      readonly g: {
        readonly h: {
          readonly i: true;
          readonly j: 'string';
        };
        readonly k: 'hello';
      };
      readonly l: readonly [
        'hi',
        {
          readonly m: readonly ['hey'];
        },
      ];
    };
  };
};

type Expected2 = { readonly a: string } | { readonly b: number };

type Expected3 = {
  readonly tags: readonly string[];
  readonly rows: readonly { readonly id: number }[];
};
