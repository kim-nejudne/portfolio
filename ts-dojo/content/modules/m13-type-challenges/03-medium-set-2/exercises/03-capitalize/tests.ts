// Cases adapted from type-challenges #00110, https://github.com/type-challenges/type-challenges/blob/main/questions/00110-medium-capitalize/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { MyCapitalize } from './index';

type cases = [
  Expect<Equal<MyCapitalize<'foobar'>, 'Foobar'>>, // a word
  Expect<Equal<MyCapitalize<'FOOBAR'>, 'FOOBAR'>>, // already upper case
  Expect<Equal<MyCapitalize<'foo bar'>, 'Foo bar'>>, // only the first word
  Expect<Equal<MyCapitalize<''>, ''>>, // the empty string
  Expect<Equal<MyCapitalize<'a'>, 'A'>>, // a
  Expect<Equal<MyCapitalize<'b'>, 'B'>>, // b
  Expect<Equal<MyCapitalize<'c'>, 'C'>>, // c
  Expect<Equal<MyCapitalize<'d'>, 'D'>>, // d
  Expect<Equal<MyCapitalize<'e'>, 'E'>>, // e
  Expect<Equal<MyCapitalize<'f'>, 'F'>>, // f
  Expect<Equal<MyCapitalize<'g'>, 'G'>>, // g
  Expect<Equal<MyCapitalize<'h'>, 'H'>>, // h
  Expect<Equal<MyCapitalize<'i'>, 'I'>>, // i
  Expect<Equal<MyCapitalize<'j'>, 'J'>>, // j
  Expect<Equal<MyCapitalize<'k'>, 'K'>>, // k
  Expect<Equal<MyCapitalize<'l'>, 'L'>>, // l
  Expect<Equal<MyCapitalize<'m'>, 'M'>>, // m
  Expect<Equal<MyCapitalize<'n'>, 'N'>>, // n
  Expect<Equal<MyCapitalize<'o'>, 'O'>>, // o
  Expect<Equal<MyCapitalize<'p'>, 'P'>>, // p
  Expect<Equal<MyCapitalize<'q'>, 'Q'>>, // q
  Expect<Equal<MyCapitalize<'r'>, 'R'>>, // r
  Expect<Equal<MyCapitalize<'s'>, 'S'>>, // s
  Expect<Equal<MyCapitalize<'t'>, 'T'>>, // t
  Expect<Equal<MyCapitalize<'u'>, 'U'>>, // u
  Expect<Equal<MyCapitalize<'v'>, 'V'>>, // v
  Expect<Equal<MyCapitalize<'w'>, 'W'>>, // w
  Expect<Equal<MyCapitalize<'x'>, 'X'>>, // x
  Expect<Equal<MyCapitalize<'y'>, 'Y'>>, // y
  Expect<Equal<MyCapitalize<'z'>, 'Z'>>, // z
  // Added in the dojo: a union is capitalized member by member.
  Expect<Equal<MyCapitalize<'foo' | 'bar'>, 'Foo' | 'Bar'>>, // a union
];
