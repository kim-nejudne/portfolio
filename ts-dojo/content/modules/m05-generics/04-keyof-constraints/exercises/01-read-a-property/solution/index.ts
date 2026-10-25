/** The value of the property `key` of `obj`. */
export function prop<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
