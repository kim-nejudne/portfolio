// Client<T>: every property of T as a function that returns a promise.
// A method keeps its parameters; any other property takes none and gives its value.
// A rest parameter matches the whole parameter list as a tuple, which is spread again, and
// Awaited keeps a promise that a method already returns from being wrapped twice.
export type Client<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : () => Promise<Awaited<T[K]>>;
};

type Call = (...args: unknown[]) => Promise<unknown>;

/** The client a remote copy of `api` would have: every call returns a promise. */
export function remote<T extends object>(api: T): Client<T>;
// The implementation has plain types: its body can't be checked against Client<T> while T is
// unknown, so the tests check what each call does.
export function remote(api: Record<string, unknown>): Record<string, Call> {
  const client: Record<string, Call> = {};
  for (const key of Object.keys(api)) {
    client[key] = async (...args) => {
      const value = api[key];
      return typeof value === 'function' ? value.apply(api, args) : value;
    };
  }
  return client;
}
