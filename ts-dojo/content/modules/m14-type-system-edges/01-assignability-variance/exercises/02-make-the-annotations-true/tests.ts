import type {
  Equal,
  Expect,
  ExpectExtends,
  ExpectFalse,
} from '@dojo/type-utils';
import type { Admin, Cell, Sink, Source, Target, User } from './index';

// ExpectExtends<To, From> is true when a From is assignable to a To.
// SinkShape has Sink's members and no annotation of its own, so its variance shows the syntax.
interface SinkShape<T> extends Sink<T> {}

type cases = [
  Expect<ExpectExtends<Source<User>, Source<Admin>>>, // a source of admins is a source of users
  ExpectFalse<ExpectExtends<Source<Admin>, Source<User>>>, // a source of users may give a plain user
  Expect<ExpectExtends<Target<Admin>, Target<User>>>, // a target for users takes admins
  ExpectFalse<ExpectExtends<Target<User>, Target<Admin>>>, // a target for admins can't take every user
  Expect<ExpectExtends<Sink<Admin>, Sink<User>>>, // a sink for users takes admins
  ExpectFalse<ExpectExtends<Sink<User>, Sink<Admin>>>, // a sink for admins can't take every user
  ExpectFalse<ExpectExtends<Cell<User>, Cell<Admin>>>, // a cell of admins is not a cell of users
  ExpectFalse<ExpectExtends<Cell<Admin>, Cell<User>>>, // a cell of users is not a cell of admins
  Expect<ExpectExtends<Cell<User>, Cell<User>>>, // a cell of users is a cell of users
  Expect<Equal<keyof Cell<User>, 'value'>>, // Cell has only its value
  Expect<Equal<keyof Sink<User>, 'accept'>>, // Sink has only accept
  Expect<ExpectExtends<SinkShape<User>, SinkShape<Admin>>>, // accept is still a method
  Expect<Equal<Cell<Admin>['value'], Admin>>, // the value has the type argument's type
];
