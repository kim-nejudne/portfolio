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
export function Versioned<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    get version(): number {
      throw new Error('not implemented');
    }

    bump(): void {
      throw new Error('not implemented');
    }

    get label(): string {
      throw new Error('not implemented');
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
export const TrackedDoc = Tagged(Doc);
