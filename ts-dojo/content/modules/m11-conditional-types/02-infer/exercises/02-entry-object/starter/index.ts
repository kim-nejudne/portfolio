// EntryObject<E>: a [key, value] pair turned into an object type with that one property.
// Anything else, a key that can't be a property key included, gives never.
export type EntryObject<E> = E extends readonly [infer K, infer V]
  ? Record<K, V>
  : never;

export const user: EntryObject<['name', string]> = { name: 'Ada' };
