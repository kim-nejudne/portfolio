// ValueOf<T>: the union of the types of T's property values.
export type ValueOf<T> = unknown;

// ElementOf<T>: the type of the elements of the array or tuple type T, readonly ones included.
// A type that is not an array, such as string, is rejected.
export type ElementOf<T> = unknown;
