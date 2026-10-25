// KeysOfType<T, V>: the keys of T whose property type, as a whole, is assignable to V.
export type KeysOfType<T, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

// PickByValue<T, V>: the properties of T whose type is assignable to V, modifiers kept.
export type PickByValue<T, V> = Pick<T, KeysOfType<T, V>>;
