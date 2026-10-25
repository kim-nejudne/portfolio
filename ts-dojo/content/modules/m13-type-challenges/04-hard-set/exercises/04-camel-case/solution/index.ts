// A character is a letter when upper and lower case differ.
type IsLetter<C extends string> =
  Uppercase<C> extends Lowercase<C> ? false : true;

// Find the first underscore and the character after it. A letter there loses the underscore and
// is upper-cased. Anything else keeps the underscore, and the walk goes on from that
// character, so in '__bar' the second underscore still meets its b. A string with no
// underscore followed by a character is left as it is.
type Camelize<S extends string> =
  S extends `${infer Head}_${infer Next}${infer Rest}`
    ? IsLetter<Next> extends true
      ? `${Head}${Uppercase<Next>}${Camelize<Rest>}`
      : `${Head}_${Camelize<`${Next}${Rest}`>}`
    : S;

export type CamelCase<S extends string> = Camelize<Lowercase<S>>;
