// U is a naked type parameter, so the conditional runs once per member: a member whose type
// property is assignable to T stays, every other member becomes never and drops out.
export type LookUp<U, T> = U extends { type: T } ? U : never;
