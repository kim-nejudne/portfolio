// Cases adapted from type-challenges #00274, https://github.com/type-challenges/type-challenges/blob/main/questions/00274-extreme-integers-comparator/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { Comparator, Comparison } from './index';

type cases = [
  Expect<Equal<Comparator<5, 5>, Comparison.Equal>>, // 5 = 5
  Expect<Equal<Comparator<5, 6>, Comparison.Lower>>, // 5 < 6
  Expect<Equal<Comparator<5, 8>, Comparison.Lower>>, // 5 < 8
  Expect<Equal<Comparator<5, 0>, Comparison.Greater>>, // 5 > 0
  Expect<Equal<Comparator<-5, 0>, Comparison.Lower>>, // -5 < 0
  Expect<Equal<Comparator<0, 0>, Comparison.Equal>>, // 0 = 0
  Expect<Equal<Comparator<0, -5>, Comparison.Greater>>, // 0 > -5
  Expect<Equal<Comparator<5, -3>, Comparison.Greater>>, // 5 > -3
  Expect<Equal<Comparator<5, -7>, Comparison.Greater>>, // 5 > -7
  Expect<Equal<Comparator<-5, -7>, Comparison.Greater>>, // -5 > -7
  Expect<Equal<Comparator<-5, -3>, Comparison.Lower>>, // -5 < -3
  Expect<Equal<Comparator<-25, -30>, Comparison.Greater>>, // -25 > -30
  Expect<Equal<Comparator<15, -23>, Comparison.Greater>>, // 15 > -23
  Expect<Equal<Comparator<40, 37>, Comparison.Greater>>, // 40 > 37
  Expect<Equal<Comparator<-36, 36>, Comparison.Lower>>, // -36 < 36
  Expect<Equal<Comparator<27, 27>, Comparison.Equal>>, // 27 = 27
  Expect<Equal<Comparator<-38, -38>, Comparison.Equal>>, // -38 = -38

  Expect<Equal<Comparator<1, 100>, Comparison.Lower>>, // 1 < 100
  Expect<Equal<Comparator<100, 1>, Comparison.Greater>>, // 100 > 1
  Expect<Equal<Comparator<-100, 1>, Comparison.Lower>>, // -100 < 1
  Expect<Equal<Comparator<1, -100>, Comparison.Greater>>, // 1 > -100
  Expect<Equal<Comparator<-100, -1>, Comparison.Lower>>, // -100 < -1
  Expect<Equal<Comparator<-1, -100>, Comparison.Greater>>, // -1 > -100

  // Extra tests if you like to challenge yourself! (Cases like the others here.)
  Expect<
    Equal<Comparator<9007199254740992, 9007199254740992>, Comparison.Equal>
  >, // 2^53 = 2^53
  Expect<
    Equal<Comparator<-9007199254740992, -9007199254740992>, Comparison.Equal>
  >, // -2^53 = -2^53
  Expect<
    Equal<Comparator<9007199254740991, 9007199254740992>, Comparison.Lower>
  >, // 2^53 - 1 < 2^53
  Expect<
    Equal<Comparator<9007199254740992, 9007199254740991>, Comparison.Greater>
  >, // 2^53 > 2^53 - 1
  Expect<
    Equal<Comparator<-9007199254740992, -9007199254740991>, Comparison.Lower>
  >, // -2^53 < -(2^53 - 1)
  Expect<
    Equal<Comparator<-9007199254740991, -9007199254740992>, Comparison.Greater>
  >, // -(2^53 - 1) > -2^53
  Expect<Equal<Comparator<3.1415, 3.1415>, Comparison.Equal>>, // 3.1415 = 3.1415
  Expect<Equal<Comparator<3.1415, 3.1414>, Comparison.Greater>>, // 3.1415 > 3.1414
  Expect<Equal<Comparator<0, 3.1414>, Comparison.Lower>>, // 0 < 3.1414
  Expect<Equal<Comparator<31.415, 3.1415>, Comparison.Greater>>, // 31.415 > 3.1415

  // Added in the dojo.
  Expect<Equal<Comparator<10, 9>, Comparison.Greater>>, // 10 > 9
  Expect<Equal<Comparator<-10, -9>, Comparison.Lower>>, // -10 < -9
  Expect<Equal<Comparator<19, 91>, Comparison.Lower>>, // 19 < 91
  Expect<Equal<Comparator<2, 2.5>, Comparison.Lower>>, // 2 < 2.5
  Expect<Equal<Comparator<-0.5, 0.5>, Comparison.Lower>>, // -0.5 < 0.5
  Expect<Equal<Comparator<1000000, 999999>, Comparison.Greater>>, // 1000000 > 999999
];
