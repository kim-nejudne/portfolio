// K defaults to every key. The first object makes the keys in K readonly; because K is
// constrained by keyof T, it keeps their ?. The second maps over keyof T and drops the keys in
// K, so the rest keep their own modifiers, an existing readonly included.
export type MyReadonly2<T, K extends keyof T = keyof T> = {
  readonly [P in K]: T[P];
} & {
  [P in keyof T as P extends K ? never : P]: T[P];
};
