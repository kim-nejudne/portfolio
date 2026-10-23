export interface User {
  id: string;
  name: string;
}

export interface Admin extends User {
  permissions: string[];
}

// Values only come out: a source of admins is a source of users.
export interface Source<in T> {
  read: () => T;
}

// Values only go in: a target that takes any user takes admins too.
export interface Target<out T> {
  write: (value: T) => void;
}

// Values only go in, like Target, but declared with method syntax. Make it as strict as Target.
export interface Sink<T> {
  accept(value: T): void;
}

// Read and written: no direction is safe. Make it invariant, and keep `value` its only member.
export interface Cell<T> {
  value: T;
}
