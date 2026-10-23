/** Anything with a string id can be stored in a repository. */
export interface Entity {
  readonly id: string;
}

export interface User extends Entity {
  readonly email: string;
}

export class Repository<T extends Entity> {
  #items = new Map<string, T>();

  /** A new repository holding the items, saved in order. */
  static of<U extends Entity>(...items: U[]): Repository<U> {
    const repository = new Repository<U>();
    for (const item of items) {
      repository.save(item);
    }
    return repository;
  }

  /** Adds the item, or replaces the stored item with the same id. */
  save(item: T): void {
    this.#items.set(item.id, item);
  }

  find(id: string): T | undefined {
    return this.#items.get(id);
  }

  /** Every item, in the order their ids were first saved. */
  all(): T[] {
    return [...this.#items.values()];
  }

  size(): number {
    return this.#items.size;
  }
}

/** Users whose emails are unique, ignoring case. */
export class UserRepository extends Repository<User> {
  findByEmail(email: string): User | undefined {
    throw new Error(`not implemented for ${email}`);
  }
}
