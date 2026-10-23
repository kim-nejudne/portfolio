/** A first-in, first-out queue that starts with the given items. */
export function createQueue(...initial: unknown[]): {
  push(item: unknown): void;
  shift(): unknown;
  size(): number;
} {
  throw new Error(`not implemented for ${initial.length} items`);
}
