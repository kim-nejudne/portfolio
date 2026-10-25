// ChangeHandlers<T>: an optional, writable on...Change handler for every data property of T
// whose key is a string that doesn't start with an underscore.
// The as clause drops a key by mapping it to never, first by name, then by value type; the
// keys it keeps get their new name. K & string drops number and symbol keys.
export type ChangeHandlers<T> = {
  -readonly [
    K in keyof T as K extends `_${string}`
      ? never
      : T[K] extends Function
        ? never
        : `on${Capitalize<K & string>}Change`
  ]+?: (value: T[K]) => void;
};
