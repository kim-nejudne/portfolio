// Seen holds one element per character taken off so far, and starts empty. The pattern takes
// off one character at a time; when none is left, the tuple's length is the string's. The
// recursive call is the whole branch (tail position), so strings of up to about a thousand
// characters work (12.4, Recursion limits).
export type LengthOfString<
  S extends string,
  Seen extends unknown[] = [],
> = S extends `${infer _First}${infer Rest}`
  ? LengthOfString<Rest, [...Seen, unknown]>
  : Seen['length'];
