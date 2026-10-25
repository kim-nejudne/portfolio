export type Constructor<T = {}> = new (...args: any[]) => T;

/** Adds tags, each kept once, in the order they were first added. */
export function Tagged<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    #tags = new Set<string>();

    get tags(): string[] {
      return [...this.#tags];
    }

    tag(name: string): this {
      this.#tags.add(name);
      return this;
    }
  };
}

/** Adds a version number to anything with an id. */
export function Versioned<TBase extends Constructor<{ id: string }>>(
  Base: TBase,
) {
  return class extends Base {
    #version = 1;

    get version(): number {
      return this.#version;
    }

    bump(): this {
      this.#version += 1;
      return this;
    }

    get label(): string {
      return `${this.id}@v${this.#version}`;
    }
  };
}

export class Doc {
  constructor(
    readonly id: string,
    public title: string,
  ) {}
}

/** Doc with both mixins. */
export const TrackedDoc = Tagged(Versioned(Doc));
