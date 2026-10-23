// Cases adapted from type-challenges #00011, https://github.com/type-challenges/type-challenges/blob/main/questions/00011-easy-tuple-to-object/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { TupleToObject } from './index';

const tuple = ['tesla', 'model 3', 'model X', 'model Y'] as const;
const tupleNumber = [1, 2, 3, 4] as const;
const sym1 = Symbol(1);
const sym2 = Symbol(2);
const tupleSymbol = [sym1, sym2] as const;
const tupleMix = [1, '2', 3, '4', sym1] as const;

type cases = [
  Expect<
    Equal<
      TupleToObject<typeof tuple>,
      {
        tesla: 'tesla';
        'model 3': 'model 3';
        'model X': 'model X';
        'model Y': 'model Y';
      }
    >
  >, // strings
  Expect<Equal<TupleToObject<typeof tupleNumber>, { 1: 1; 2: 2; 3: 3; 4: 4 }>>, // numbers
  Expect<
    Equal<
      TupleToObject<typeof tupleSymbol>,
      { [sym1]: typeof sym1; [sym2]: typeof sym2 }
    >
  >, // unique symbols
  Expect<
    Equal<
      TupleToObject<typeof tupleMix>,
      { 1: 1; '2': '2'; 3: 3; '4': '4'; [sym1]: typeof sym1 }
    >
  >, // a mix
];

// @ts-expect-error
type error = TupleToObject<[[1, 2], {}]>; // elements that can't be keys
