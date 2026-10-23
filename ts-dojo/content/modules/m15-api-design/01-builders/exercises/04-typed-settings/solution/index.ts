// One object type instead of a pile of intersections (10.1).
export type Simplify<T> = { [K in keyof T]: T[K] };

export class SettingsBuilder<T extends object> {
  readonly #values: T;

  constructor(values: T) {
    this.#values = values;
  }

  // What callers see: the key and its value type are recorded, and a key already set is rejected.
  set<K extends string, V>(
    key: Exclude<K, keyof T>,
    value: V,
  ): SettingsBuilder<Simplify<T & Record<K, V>>>;
  // The implementation signature is looser (8.1): a computed key of a generic type is typed with
  // a string index signature, which the overload's return type can't take without a cast.
  set(key: string, value: unknown): SettingsBuilder<object> {
    return new SettingsBuilder({ ...this.#values, [key]: value });
  }

  build(): T {
    return { ...this.#values };
  }
}

export const settings = (): SettingsBuilder<{}> => new SettingsBuilder({});
