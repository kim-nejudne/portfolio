// Cases adapted from type-challenges #00298, https://github.com/type-challenges/type-challenges/blob/main/questions/00298-medium-length-of-string/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { LengthOfString } from './index';

type cases = [
  Expect<Equal<LengthOfString<''>, 0>>, // the empty string
  Expect<Equal<LengthOfString<'kumiko'>, 6>>, // six letters
  Expect<Equal<LengthOfString<'reina'>, 5>>, // five letters
  Expect<Equal<LengthOfString<'Sound! Euphonium'>, 16>>, // spaces and punctuation count
  // Added in the dojo: the count is String#length's, in UTF-16 code units.
  Expect<Equal<LengthOfString<'😀'>, 2>>, // an emoji
];
