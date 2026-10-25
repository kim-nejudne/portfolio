// Returns input when it is one of options, and fallback otherwise.
export function oneOf<T extends string>(
  options: readonly T[],
  fallback: T,
  input: string,
): T {
  throw new Error('not implemented');
}
