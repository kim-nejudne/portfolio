// The identity mapped type: homomorphic, so it keeps every modifier, and it turns an
// intersection into one object type.
type Simplify<T> = { [P in keyof T]: T[P] };

// PartialBy<T, K>: the properties of T named by K become optional; the rest stay as they are.
// Omit and Pick keep readonly (Pick is homomorphic), and Partial adds the ? to K's part only.
export type PartialBy<T, K extends keyof T> = Simplify<
  Omit<T, K> & Partial<Pick<T, K>>
>;

// RequiredBy<T, K>: the properties of T named by K become required; the rest stay as they are.
export type RequiredBy<T, K extends keyof T> = Simplify<
  Omit<T, K> & Required<Pick<T, K>>
>;
