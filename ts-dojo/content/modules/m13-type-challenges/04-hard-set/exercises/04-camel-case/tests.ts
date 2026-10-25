// Cases adapted from type-challenges #00114, https://github.com/type-challenges/type-challenges/blob/main/questions/00114-hard-camelcase/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { CamelCase } from './index';

type cases = [
  Expect<Equal<CamelCase<'foobar'>, 'foobar'>>, // no underscore
  Expect<Equal<CamelCase<'FOOBAR'>, 'foobar'>>, // upper case, lowered
  Expect<Equal<CamelCase<'foo_bar'>, 'fooBar'>>, // one underscore
  Expect<Equal<CamelCase<'foo__bar'>, 'foo_Bar'>>, // two underscores
  Expect<Equal<CamelCase<'foo_$bar'>, 'foo_$bar'>>, // no letter after the underscore
  Expect<Equal<CamelCase<'foo_bar_'>, 'fooBar_'>>, // a trailing underscore
  Expect<Equal<CamelCase<'foo_bar__'>, 'fooBar__'>>, // two trailing underscores
  Expect<Equal<CamelCase<'foo_bar_$'>, 'fooBar_$'>>, // a trailing symbol
  Expect<Equal<CamelCase<'foo_bar_hello_world'>, 'fooBarHelloWorld'>>, // four words
  Expect<Equal<CamelCase<'HELLO_WORLD_WITH_TYPES'>, 'helloWorldWithTypes'>>, // upper snake case
  Expect<Equal<CamelCase<'-'>, '-'>>, // a symbol
  Expect<Equal<CamelCase<''>, ''>>, // the empty string
  Expect<Equal<CamelCase<'😎'>, '😎'>>, // an emoji
];
