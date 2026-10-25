export type Part = string | number | boolean;

// Join<['a', 1, true], '-'> is 'a-1-true'.
export type Join<
  T extends readonly Part[],
  D extends string,
> = number extends T['length']
  ? string // an array: the number of parts isn't known
  : T extends readonly [infer H extends Part, ...infer R extends Part[]]
    ? JoinRest<R, D, `${H}`> // the first part starts the accumulator
    : ''; // an empty tuple

// Adds the separator and the next part to Acc, one part per step.
type JoinRest<
  T extends readonly Part[],
  D extends string,
  Acc extends string,
> = T extends readonly [infer H extends Part, ...infer R extends Part[]]
  ? JoinRest<R, D, `${Acc}${D}${H}`> // a tail call
  : Acc;

/** Joins parts with separator, like Array.prototype.join. */
export function join<T extends Part[], D extends string>(
  parts: readonly [...T], // [...T] infers a tuple from a tuple argument
  separator: D,
): Join<T, D> {
  // The compiler can't follow Join through Array.prototype.join; the tests check that they agree.
  return parts.join(separator) as Join<T, D>;
}
