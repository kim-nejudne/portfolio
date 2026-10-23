// Cases adapted from type-challenges #00270, https://github.com/type-challenges/type-challenges/blob/main/questions/00270-hard-typed-get/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { Get } from './index';

type cases = [
  Expect<Equal<Get<Data, 'hello'>, 'world'>>, // a top-level key
  Expect<Equal<Get<Data, 'foo.bar.count'>, 6>>, // three steps
  Expect<Equal<Get<Data, 'foo.bar'>, { value: 'foobar'; count: 6 }>>, // an object
  Expect<Equal<Get<Data, 'foo.baz'>, false>>, // a key with a dot in it

  Expect<Equal<Get<Data, 'no.existed'>, never>>, // no such path
  // Added in the dojo.
  Expect<Equal<Get<Data, 'foo.bar.nope'>, never>>, // the last step fails
  Expect<Equal<Get<Data, 'hello' | 'foo.included'>, 'world' | true>>, // a union of paths
];

type Data = {
  foo: {
    bar: {
      value: 'foobar';
      count: 6;
    };
    included: true;
  };
  'foo.baz': false;
  hello: 'world';
};
