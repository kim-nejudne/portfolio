// A key is optional exactly when {} fits the object of that one property: { bar?: string }
// accepts {}, { foo: undefined } doesn't. The as clause drops the optional keys, and mapping
// over keyof T keeps readonly on the ones that stay.
export type GetRequired<T> = {
  [K in keyof T as {} extends Pick<T, K> ? never : K]: T[K];
};
