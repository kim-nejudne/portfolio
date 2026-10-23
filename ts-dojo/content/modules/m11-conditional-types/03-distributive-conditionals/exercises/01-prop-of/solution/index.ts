// PropOf<T, K>: the type of property K in the members of T that have it.
// Members without K add nothing.
// T is naked, so the outer condition splits a union and T is one member in the branch; the
// inner condition reads K only from a member that has it.
export type PropOf<T, K extends PropertyKey> = T extends unknown
  ? K extends keyof T
    ? T[K]
    : never
  : never;
