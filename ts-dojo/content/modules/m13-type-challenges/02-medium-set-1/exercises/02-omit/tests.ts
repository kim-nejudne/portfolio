// Cases adapted from type-challenges #00003, https://github.com/type-challenges/type-challenges/blob/main/questions/00003-medium-omit/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { MyOmit } from './index';

type cases = [
  Expect<Equal<Expected1, MyOmit<Todo, 'description'>>>, // one key
  Expect<Equal<Expected2, MyOmit<Todo, 'description' | 'completed'>>>, // two keys
  Expect<Equal<Expected3, MyOmit<Todo1, 'description' | 'completed'>>>, // readonly is kept
  // Added in the dojo: a key Todo doesn't have is an error.
  // @ts-expect-error
  MyOmit<Todo, 'description' | 'invalid'>, // a key Todo doesn't have
];

interface Todo {
  title: string;
  description: string;
  completed: boolean;
}

interface Todo1 {
  readonly title: string;
  description: string;
  completed: boolean;
}

interface Expected1 {
  title: string;
  completed: boolean;
}

interface Expected2 {
  title: string;
}

interface Expected3 {
  readonly title: string;
}
