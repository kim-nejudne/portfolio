// Two infers side by side: First takes exactly one character and Rest takes what is left.
// The empty string doesn't match and comes back as it is. The conditional is on the naked S,
// so a union is capitalized one member at a time.
export type MyCapitalize<S extends string> =
  S extends `${infer First}${infer Rest}` ? `${Uppercase<First>}${Rest}` : S;
