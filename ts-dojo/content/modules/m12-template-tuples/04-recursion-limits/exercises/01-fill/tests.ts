import type { Equal, Expect } from '@dojo/type-utils';
import type { Fill } from './index';

type cases = [
  Expect<Equal<Fill<3, 'x'>, ['x', 'x', 'x']>>, // three copies
  Expect<Equal<Fill<1, [1]>, [[1]]>>, // one element, itself a tuple
  Expect<Equal<Fill<0, boolean>, []>>, // zero elements
  Expect<Equal<Fill<2, string | number>, [string | number, string | number]>>, // a union element
  Expect<Equal<Fill<5, null>, [null, null, null, null, null]>>, // five copies
  Expect<Equal<Fill<number, string>, string[]>>, // plain number
  Expect<Equal<Fill<60, true>['length'], 60>>, // past the nesting limit
  Expect<Equal<Fill<800, 0>['length'], 800>>, // well past it
  Expect<Equal<Fill<800, 0>[799], 0>>, // the last of 800 is still T
];
