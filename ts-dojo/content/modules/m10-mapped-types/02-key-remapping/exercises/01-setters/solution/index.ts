// Setters<T>: a required, writable set method for every string key of T.
// K & string turns number and symbol keys into never, which drops them.
export type Setters<T> = {
  -readonly [K in keyof T as `set${Capitalize<K & string>}`]-?: (
    value: T[K],
  ) => void;
};
