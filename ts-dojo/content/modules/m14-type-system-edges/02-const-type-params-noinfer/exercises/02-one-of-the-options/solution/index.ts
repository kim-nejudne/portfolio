// Returns input when it is one of options, and fallback otherwise.
// NoInfer: T comes from the options alone, and the fallback is checked against them.
export function oneOf<T extends string>(
  options: readonly T[],
  fallback: NoInfer<T>,
  input: string,
): T {
  // find compares T with string and hands back the option, already a T.
  return options.find((option) => option === input) ?? fallback;
}
