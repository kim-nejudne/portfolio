// A function is returned whole: mapped over, it would turn into {}. Anything else goes through
// a homomorphic mapped type, which leaves primitives alone, keeps arrays and tuples as readonly
// arrays and tuples, and recurses into every property. The conditional on the naked T also
// distributes, so each member of a union is made readonly on its own.
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : { readonly [K in keyof T]: DeepReadonly<T[K]> };
