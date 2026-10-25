// Cases adapted from type-challenges #00005, https://github.com/type-challenges/type-challenges/blob/main/questions/00005-extreme-readonly-keys/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { GetReadonlyKeys } from './index';

type cases = [
  Expect<Equal<'title', GetReadonlyKeys<Todo1>>>, // one readonly key
  Expect<Equal<'title' | 'description', GetReadonlyKeys<Todo2>>>, // two, beside an optional key
  // Added in the dojo.
  Expect<Equal<GetReadonlyKeys<{ a: 1; b?: 2 }>, never>>, // no readonly keys
  Expect<Equal<GetReadonlyKeys<{}>, never>>, // no keys at all
  Expect<Equal<GetReadonlyKeys<{ readonly a?: 1; b: 1 }>, 'a'>>, // readonly and optional
  Expect<
    Equal<
      GetReadonlyKeys<{ readonly a: undefined; readonly b: unknown; c: 1 }>,
      'a' | 'b'
    >
  >, // undefined and unknown values
];

interface Todo1 {
  readonly title: string;
  description: string;
  completed: boolean;
}

interface Todo2 {
  readonly title: string;
  readonly description: string;
  completed?: boolean;
}
