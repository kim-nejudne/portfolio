// An empty From would leave `${infer Before}${infer After}`, which matches any string with a
// character in it, so it is handled first. Otherwise Before stops at the first From, and the
// pattern fails when From isn't there at all.
export type Replace<
  S extends string,
  From extends string,
  To extends string,
> = From extends ''
  ? S
  : S extends `${infer Before}${From}${infer After}`
    ? `${Before}${To}${After}`
    : S;
