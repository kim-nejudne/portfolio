import type { Equal, Expect } from '@dojo/type-utils';
import type { PropOf } from './index';

type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number }
  | { kind: 'rect'; width: number; height: number; label?: string };
type Kinds = 'circle' | 'square' | 'rect';

type Item = { id: string; tags: string[] } | Record<string, boolean>;
type Ab = { a: 1 } | { a: 2 } | { b: 3 };

type cases = [
  Expect<Equal<PropOf<Shape, 'radius'>, number>>, // a key in one member
  Expect<Equal<PropOf<Shape, 'kind'>, Kinds>>, // a key in every member
  Expect<Equal<PropOf<Shape, 'color'>, never>>, // a key in no member
  Expect<Equal<PropOf<Shape, 'label'>, string | undefined>>, // optional keeps undefined
  Expect<Equal<PropOf<Shape, 'radius' | 'kind'>, number | Kinds>>, // a union of keys
  Expect<Equal<PropOf<{ a: 1; b: 'x' }, 'b'>, 'x'>>, // a single object
  Expect<Equal<PropOf<Ab, 'a'>, 1 | 2>>, // one answer per member
  Expect<Equal<PropOf<Item, 'tags'>, string[] | boolean>>, // an index signature
  Expect<Equal<PropOf<[string, number], 0>, string>>, // a tuple element by index
  Expect<Equal<PropOf<never, 'a'>, never>>, // nothing in, nothing out
];

// @ts-expect-error
type NotAKey = PropOf<Shape, { kind: 'circle' }>; // a key must be a property key
