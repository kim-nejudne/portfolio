// Client<T>: every property of T as a function that returns a promise.
// A method keeps its parameters; any other property takes none and gives its value.
export type Client<T> = {
  [K in keyof T]: (...args: unknown[]) => Promise<unknown>;
};

/** The client a remote copy of `api` would have: every call returns a promise. */
export function remote<T extends object>(api: T): Client<T> {
  throw new Error(`not implemented: ${Object.keys(api).join(', ')}`);
}
