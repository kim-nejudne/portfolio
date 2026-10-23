// Mapping over keyof T keeps each property's readonly and ?, and the as clause sends the
// keys in K to never, which drops them. K extends keyof T rejects keys T doesn't have.
export type MyOmit<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never : P]: T[P];
};
