// infer N extends number reads the whole string as a number literal; a string that isn't a
// number doesn't match. S is a naked type parameter, so a union is read member by member.
export type ToNumber<S extends string> = S extends `${infer N extends number}`
  ? N
  : never;
