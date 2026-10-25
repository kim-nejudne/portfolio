// A tuple of N elements (12.4). Here N is never more than 19.
type BuildTuple<
  N extends number,
  Acc extends unknown[] = [],
> = Acc['length'] extends N ? Acc : BuildTuple<N, [...Acc, unknown]>;

type Ten = BuildTuple<10>;

// Addition starts at the last digit, and a pattern reads from the first, so turn the strings
// around before adding. Tail-recursive, so a long number is fine (12.4).
type Reverse<
  S extends string,
  Acc extends string = '',
> = S extends `${infer H}${infer R}` ? Reverse<R, `${H}${Acc}`> : Acc;

// The first digit and the rest. A number that has run out reads as 0.
type Head<S extends string> = S extends `${infer H}${infer R}`
  ? [H, R]
  : ['0', ''];

// A digit as a tuple of that many elements.
type Digit<D extends string> = D extends `${infer N extends number}`
  ? BuildTuple<N>
  : [];

// One column: two digits and a carry give the digit to write and the carry to pass on.
type AddColumn<A extends string, B extends string, Carry extends unknown[]> = [
  ...Digit<A>,
  ...Digit<B>,
  ...Carry,
] extends infer Total extends unknown[]
  ? Total extends [...Ten, ...infer Rest]
    ? [`${Rest['length']}`, [unknown]]
    : [`${Total['length']}`, []]
  : never;

// A and B reversed: add column by column, writing each digit in front of Acc, until both
// numbers and the carry have run out.
type AddReversed<
  A extends string,
  B extends string,
  Carry extends unknown[] = [],
  Acc extends string = '',
> = [A, B, Carry] extends ['', '', []]
  ? Acc
  : [Head<A>, Head<B>] extends [
        [infer DA extends string, infer RA extends string],
        [infer DB extends string, infer RB extends string],
      ]
    ? AddColumn<DA, DB, Carry> extends [
        infer D extends string,
        infer Next extends unknown[],
      ]
      ? AddReversed<RA, RB, Next, `${D}${Acc}`>
      : never
    : never;

// `${A}` writes a string, a number or a bigint as its digits.
export type Sum<
  A extends string | number | bigint,
  B extends string | number | bigint,
> = AddReversed<Reverse<`${A}`>, Reverse<`${B}`>>;
