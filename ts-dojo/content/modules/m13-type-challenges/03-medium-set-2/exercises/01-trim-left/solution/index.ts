// The characters that count as whitespace.
type Whitespace = ' ' | '\n' | '\t';

// A union in the pattern matches a string that starts with any of its members. Each match takes
// off one character, and the recursion stops at the first character that isn't whitespace.
export type TrimLeft<S extends string> = S extends `${Whitespace}${infer Rest}`
  ? TrimLeft<Rest>
  : S;
