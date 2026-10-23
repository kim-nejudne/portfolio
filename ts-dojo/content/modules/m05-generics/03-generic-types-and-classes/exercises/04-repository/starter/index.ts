/** What get returns: the item, or a message saying why there is none. */
export type Result<T, E = string> =
  { ok: true; value: T } | { ok: false; error: E };

/** Items with a string id, in the order their ids were first added. */
export class Repository {
  /** Adds the item, or replaces the item with the same id, keeping its place. */
  add(item: unknown): void {
    throw new Error(`not implemented: add ${String(item)}`);
  }

  /** The item with this id, or an error saying there is none. */
  get(id: string): Result<unknown> {
    throw new Error(`not implemented: get ${id}`);
  }

  /** Calls fn on every item, in order, and returns what it returned. */
  map(fn: (item: unknown) => unknown): unknown[] {
    throw new Error(`not implemented: map ${fn.name}`);
  }

  /** The number of items. */
  size(): number {
    throw new Error('not implemented: size');
  }

  /** A new repository holding these items, added in order. */
  static from(items: readonly unknown[]): Repository {
    throw new Error(`not implemented: from ${items.length} items`);
  }
}
