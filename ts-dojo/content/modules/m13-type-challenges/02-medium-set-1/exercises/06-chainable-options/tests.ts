// Cases adapted from type-challenges #00012, https://github.com/type-challenges/type-challenges/blob/main/questions/00012-medium-chainable-options/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Alike, Expect } from '@dojo/type-utils';
import type { Chainable } from './index';

declare const a: Chainable;

const result1 = a
  .option('foo', 123)
  .option('bar', { value: 'Hello World' })
  .option('name', 'type-challenges')
  .get();

// The original chains `.option('name', 'another name')` straight into the erroring call.
// The dojo splits each chain after its first option, so the error is a case of its own.
const named = a.option('name', 'another name');

// @ts-expect-error
const result2 = named.option('name', 'last name').get(); // a key set twice

// @ts-expect-error
const result3 = named.option('name', 123).get(); // a key set twice, with a new type

type cases = [
  Expect<Alike<typeof result1, Expected1>>, // three options
  Expect<Alike<typeof result2, Expected2>>, // the repeated key, same type
  Expect<Alike<typeof result3, Expected3>>, // the repeated key, new type
];

type Expected1 = {
  foo: number;
  bar: {
    value: string;
  };
  name: string;
};

type Expected2 = {
  name: string;
};

type Expected3 = {
  name: number;
};
