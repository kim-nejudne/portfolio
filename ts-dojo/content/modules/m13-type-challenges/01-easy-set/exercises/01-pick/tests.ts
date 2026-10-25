// Cases adapted from type-challenges #00004, https://github.com/type-challenges/type-challenges/blob/main/questions/00004-easy-pick/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { MyPick } from './index';

type cases = [
  Expect<Equal<Expected1, MyPick<Todo, 'title'>>>, // one key
  Expect<Equal<Expected2, MyPick<Todo, 'title' | 'completed'>>>, // two keys
  // @ts-expect-error
  MyPick<Todo, 'title' | 'completed' | 'invalid'>, // a key Todo doesn't have
  // Added in the dojo: a picked property keeps its readonly or ?.
  Expect<Equal<MyPick<Note, 'id' | 'tag'>, Expected3>>, // modifiers are kept
];

interface Todo {
  title: string;
  description: string;
  completed: boolean;
}

interface Expected1 {
  title: string;
}

interface Expected2 {
  title: string;
  completed: boolean;
}

interface Note {
  readonly id: number;
  tag?: string;
  body: string;
}

interface Expected3 {
  readonly id: number;
  tag?: string;
}
