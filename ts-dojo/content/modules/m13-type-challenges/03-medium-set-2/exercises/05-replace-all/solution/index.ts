// Replace's match, then the same type again on After only: Before has no From in it (it stops
// at the first one), and To is pasted in without being searched.
export type ReplaceAll<
  S extends string,
  From extends string,
  To extends string,
> = From extends ''
  ? S
  : S extends `${infer Before}${From}${infer After}`
    ? `${Before}${To}${ReplaceAll<After, From, To>}`
    : S;
