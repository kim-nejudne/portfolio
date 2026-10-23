// The characters that count as whitespace.
type Whitespace = ' ' | '\n' | '\t';

// The extends side is a union of two patterns, one for each end, and both name what is left
// Rest. Whichever matches, one whitespace character comes off and the type runs again.
export type Trim<S extends string> = S extends
  `${Whitespace}${infer Rest}` | `${infer Rest}${Whitespace}`
  ? Trim<Rest>
  : S;
