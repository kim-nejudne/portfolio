export type Part = string | number | boolean;

// Join<['a', 1, true], '-'> is 'a-1-true'.
export type Join<T extends readonly Part[], D extends string> = string;

/** Joins parts with separator, like Array.prototype.join. */
export function join(parts: readonly Part[], separator: string): string {
  throw new Error(`not implemented: ${parts.length} ${separator}`);
}
