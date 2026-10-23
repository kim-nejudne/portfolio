/** What get returns: the item, or a message saying why there is none. */
export type Result<T, E = string> =
  { ok: true; value: T } | { ok: false; error: E };

/** Items with a string id, in the order their ids were first added. */
export class Repository<T extends { id: string }> {
  private items = new Map<string, T>();

  /** Adds the item, or replaces the item with the same id, keeping its place. */
  add(item: T): void {
    this.items.set(item.id, item);
  }

  /** The item with this id, or an error saying there is none. */
  get(id: string): Result<T> {
    const item = this.items.get(id);
    if (item === undefined) {
      return { ok: false, error: `No item with id ${id}.` };
    }
    return { ok: true, value: item };
  }

  /** Calls fn on every item, in order, and returns what it returned. */
  map<U>(fn: (item: T) => U): U[] {
    const results: U[] = [];
    for (const item of this.items.values()) {
      results.push(fn(item));
    }
    return results;
  }

  /** The number of items. */
  size(): number {
    return this.items.size;
  }

  /** A new repository holding these items, added in order. */
  static from<U extends { id: string }>(items: readonly U[]): Repository<U> {
    const repository = new Repository<U>();
    for (const item of items) {
      repository.add(item);
    }
    return repository;
  }
}
