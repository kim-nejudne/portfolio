// Cases adapted from type-challenges #03057, https://github.com/type-challenges/type-challenges/blob/main/questions/03057-easy-push/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { Push } from './index';

type cases = [
  Expect<Equal<Push<[], 1>, [1]>>, // onto the empty tuple
  Expect<Equal<Push<[1, 2], '3'>, [1, 2, '3']>>, // onto a pair
  Expect<Equal<Push<['1', 2, '3'], boolean>, ['1', 2, '3', boolean]>>, // a union element
];

// The original's `errors` tuple, renamed: only aliases whose name starts with `cases` hold cases.
type casesErrors = [
  // @ts-expect-error
  Expect<Equal<Push<number[], string>, string[]>>, // an array doesn't become string[]
  // @ts-expect-error
  Expect<Equal<Push<string[], number>, [string, number]>>, // an array isn't a one-element tuple
];
