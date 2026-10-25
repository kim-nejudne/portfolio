// EntryObject<E>: a [key, value] pair turned into an object type with that one property.
// Anything else, a key that can't be a property key included, gives never.
// The constraint on K is part of the match: a key that is not a PropertyKey takes the false
// branch, and in the true branch Record knows that K is one.
export type EntryObject<E> = E extends readonly [
  infer K extends PropertyKey,
  infer V,
]
  ? Record<K, V>
  : never;

export const user: EntryObject<['name', string]> = { name: 'Ada' };
