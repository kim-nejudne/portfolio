// Cases adapted from type-challenges #00008, https://github.com/type-challenges/type-challenges/blob/main/questions/00008-medium-readonly-2/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Alike, Expect } from '@dojo/type-utils';
import type { MyReadonly2 } from './index';

type cases = [
  Expect<Alike<MyReadonly2<Todo1>, Readonly<Todo1>>>, // no K: every key
  Expect<Alike<MyReadonly2<Todo1, 'title' | 'description'>, Expected>>, // two keys, one optional
  Expect<Alike<MyReadonly2<Todo2, 'title' | 'description'>, Expected>>, // a key already readonly
  Expect<Alike<MyReadonly2<Todo2, 'description'>, Expected>>, // readonly title is kept
];

// @ts-expect-error
type error = MyReadonly2<Todo1, 'title' | 'invalid'>; // a key Todo1 doesn't have

interface Todo1 {
  title: string;
  description?: string;
  completed: boolean;
}

interface Todo2 {
  readonly title: string;
  description?: string;
  completed: boolean;
}

interface Expected {
  readonly title: string;
  readonly description?: string;
  completed: boolean;
}
