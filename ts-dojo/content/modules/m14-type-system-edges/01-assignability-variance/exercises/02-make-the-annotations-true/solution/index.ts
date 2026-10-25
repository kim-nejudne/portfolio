export interface User {
  id: string;
  name: string;
}

export interface Admin extends User {
  permissions: string[];
}

// Values only come out: a source of admins is a source of users.
export interface Source<out T> {
  read: () => T;
}

// Values only go in: a target that takes any user takes admins too.
export interface Target<in T> {
  write: (value: T) => void;
}

// Values only go in, like Target, but declared with method syntax. Make it as strict as Target.
// `in` replaces the method's two-way check with a one-way one.
export interface Sink<in T> {
  accept(value: T): void;
}

// Read and written: no direction is safe. Make it invariant, and keep `value` its only member.
// The property alone would be checked covariantly; `in out` forbids both directions.
export interface Cell<in out T> {
  value: T;
}
