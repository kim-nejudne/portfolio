// Cases adapted from type-challenges #00007, https://github.com/type-challenges/type-challenges/blob/main/questions/00007-easy-readonly/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { MyReadonly } from './index';

type cases = [
  Expect<Equal<MyReadonly<Todo1>, Readonly<Todo1>>>, // every property readonly
  // Added in the dojo: a second type, with an optional property.
  Expect<Equal<MyReadonly<Draft>, Expected2>>, // optional properties stay optional
];

interface Todo1 {
  title: string;
  description: string;
  completed: boolean;
  meta: {
    author: string;
  };
}

interface Draft {
  id: number;
  body?: string;
}

interface Expected2 {
  readonly id: number;
  readonly body?: string;
}

// Added in the dojo: an assignment is rejected.
declare const todo: MyReadonly<Todo1>;

// @ts-expect-error
todo.title = 'changed'; // a readonly property can't be assigned
