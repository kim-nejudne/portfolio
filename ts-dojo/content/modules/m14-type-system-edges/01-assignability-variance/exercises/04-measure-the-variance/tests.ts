import type { Equal, Expect } from '@dojo/type-utils';
import type { Variance } from './index';

interface User {
  id: string;
  name: string;
}

interface Admin extends User {
  permissions: string[];
}

interface Handlers<T> {
  handle: (value: T) => void;
}

interface MethodHandlers<T> {
  handle(value: T): void;
}

interface StrictMethodHandlers<in T> {
  handle(value: T): void;
}

interface Cell<in out T> {
  value: T;
}

// JSON.parse returns any, so Parsed is any without the keyword the rules forbid.
type Parsed = ReturnType<typeof JSON.parse>;

type cases = [
  Expect<Equal<Variance<() => Admin, () => User>, 'covariant'>>, // a return type
  Expect<Equal<Variance<readonly Admin[], readonly User[]>, 'covariant'>>, // a readonly array
  Expect<Equal<Variance<Admin[], User[]>, 'covariant'>>, // a mutable array, too
  Expect<Equal<Variance<Promise<Admin>, Promise<User>>, 'covariant'>>, // a promise
  Expect<Equal<Variance<{ owner: Admin }, { owner: User }>, 'covariant'>>, // a property
  Expect<
    Equal<
      Variance<(admin: Admin) => void, (user: User) => void>,
      'contravariant'
    >
  >, // a parameter
  Expect<Equal<Variance<Handlers<Admin>, Handlers<User>>, 'contravariant'>>, // a function-typed property
  Expect<
    Equal<Variance<MethodHandlers<Admin>, MethodHandlers<User>>, 'bivariant'>
  >, // a method parameter
  Expect<
    Equal<
      Variance<StrictMethodHandlers<Admin>, StrictMethodHandlers<User>>,
      'contravariant'
    >
  >, // a method parameter under in
  Expect<
    Equal<Variance<(admin: Admin) => Admin, (user: User) => User>, 'invariant'>
  >, // in and out at once
  Expect<Equal<Variance<Cell<Admin>, Cell<User>>, 'invariant'>>, // in out
  Expect<Equal<Variance<Admin, User>, 'covariant'>>, // the types themselves
  Expect<Equal<Variance<User, User>, 'bivariant'>>, // the same type
  Expect<Equal<Variance<string, number>, 'invariant'>>, // unrelated types
  Expect<Equal<Variance<'a', 'a' | 'b'>, 'covariant'>>, // a union on one side
  Expect<
    Equal<
      Variance<(key: 'a') => void, (key: 'a' | 'b') => void>,
      'contravariant'
    >
  >, // a union in a parameter
  Expect<Equal<Variance<'a' | 'b', 'b' | 'c'>, 'invariant'>>, // overlapping unions
  Expect<Equal<Variance<never, User>, 'covariant'>>, // never is assignable to every type
  Expect<Equal<Variance<User, unknown>, 'covariant'>>, // every type is assignable to unknown
  Expect<Equal<Variance<User, Parsed>, 'bivariant'>>, // any is assignable both ways
];
