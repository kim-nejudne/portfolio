// T is a bare type parameter, so the conditional distributes: each member of T is tested on its
// own, and the members that give never drop out of the union.
export type MyExclude<T, U> = T extends U ? never : T;
