// T is unconstrained, so check it is an array (readonly takes both kinds) before indexing it
// with number, which reads every element type at once. The empty tuple has none: never.
export type TupleToUnion<T> = T extends readonly unknown[] ? T[number] : never;
