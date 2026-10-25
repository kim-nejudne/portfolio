export class SettingsBuilder<T extends object> {
  readonly #values: T;

  constructor(values: T) {
    this.#values = values;
  }

  // Record the key and the type of its value, and reject a key that is already set.
  set(key: string, value: unknown): SettingsBuilder<T> {
    throw new Error(`set is not implemented: ${key}, ${String(value)}`);
  }

  build(): T {
    throw new Error('build is not implemented');
  }
}

export const settings = (): SettingsBuilder<{}> => new SettingsBuilder({});
