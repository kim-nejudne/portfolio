// T holds the options added so far, starting from none. option infers its key and value: a
// key T already has makes the key parameter never, so the call is an error, and the result
// drops the old key before adding the new one, so the newer type wins either way.
export type Chainable<T = {}> = {
  option<K extends string, V>(
    key: K extends keyof T ? never : K,
    value: V,
  ): Chainable<Omit<T, K> & Record<K, V>>;
  get(): T;
};
