// Chainable: option(key, value) adds an option and returns the builder; get() returns them all.
export type Chainable = {
  option(key: string, value: unknown): Chainable;
  get(): unknown;
};
