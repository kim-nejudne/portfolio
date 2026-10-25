export enum Comparison {
  Greater,
  Equal,
  Lower,
}

// A < B for two digits: A comes somewhere before B in '0123456789'.
type DigitLess<
  A extends string,
  B extends string,
> = '0123456789' extends `${string}${A}${string}${B}${string}` ? true : false;

// Which string has more characters, walking both at once: no counting, so no limit but the
// tail-call budget (12.4).
type CompareLength<
  A extends string,
  B extends string,
> = A extends `${string}${infer RA}`
  ? B extends `${string}${infer RB}`
    ? CompareLength<RA, RB>
    : Comparison.Greater
  : B extends ''
    ? Comparison.Equal
    : Comparison.Lower;

// Digit by digit from the left. The first pair that differs decides; a string that runs out
// first is the smaller, which is right for the digits after a decimal point.
type CompareDigits<
  A extends string,
  B extends string,
> = A extends `${infer HA}${infer RA}`
  ? B extends `${infer HB}${infer RB}`
    ? HA extends HB
      ? CompareDigits<RA, RB>
      : DigitLess<HA, HB> extends true
        ? Comparison.Lower
        : Comparison.Greater
    : Comparison.Greater
  : B extends ''
    ? Comparison.Equal
    : Comparison.Lower;

// The whole part and the digits after the point ('' when there is no point).
type Parts<S extends string> = S extends `${infer Whole}.${infer Fraction}`
  ? [Whole, Fraction]
  : [S, ''];

// Two numbers without signs: the longer whole part is greater; with equal lengths, the
// digits of the whole part decide, then those of the fraction.
type CompareUnsigned<A extends string, B extends string> =
  Parts<A> extends [infer WA extends string, infer FA extends string]
    ? Parts<B> extends [infer WB extends string, infer FB extends string]
      ? CompareLength<WA, WB> extends Comparison.Equal
        ? CompareDigits<WA, WB> extends Comparison.Equal
          ? CompareDigits<FA, FB>
          : CompareDigits<WA, WB>
        : CompareLength<WA, WB>
      : never
    : never;

type Flip<C extends Comparison> = C extends Comparison.Greater
  ? Comparison.Lower
  : C extends Comparison.Lower
    ? Comparison.Greater
    : C;

// The signs first: a negative number is lower than any other, and between two negative
// numbers the one with the greater digits is the lower.
export type Comparator<
  A extends number,
  B extends number,
> = `${A}` extends `-${infer DigitsA}`
  ? `${B}` extends `-${infer DigitsB}`
    ? Flip<CompareUnsigned<DigitsA, DigitsB>>
    : Comparison.Lower
  : `${B}` extends `-${string}`
    ? Comparison.Greater
    : CompareUnsigned<`${A}`, `${B}`>;
