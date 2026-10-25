// PropOf<T, K>: the type of property K in the members of T that have it.
// Members without K add nothing.
export type PropOf<T, K extends PropertyKey> = unknown;
