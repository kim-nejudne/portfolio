import type { Equal, Expect } from '@dojo/type-utils';
import type { Setters } from './index';

declare const tag: unique symbol;

type Account = {
  readonly id: number;
  email?: string;
  0: 'first';
  [tag]: boolean;
};

type cases = [
  Expect<
    Equal<
      Setters<{ name: string; age?: number }>,
      {
        setName: (value: string) => void;
        setAge: (value: number | undefined) => void;
      }
    >
  >, // the prompt's example
  Expect<
    Equal<
      Setters<Account>,
      {
        setId: (value: number) => void;
        setEmail: (value: string | undefined) => void;
      }
    >
  >, // writable and required, and no setter for the number or symbol key
  Expect<
    Equal<
      Setters<{ firstName: string; URL: string }>,
      { setFirstName: (value: string) => void; setURL: (value: string) => void }
    >
  >, // only the first letter changes
  Expect<
    Equal<
      Setters<{ mode: 'light' | 'dark' }>,
      { setMode: (value: 'light' | 'dark') => void }
    >
  >, // the value keeps its literal types
  Expect<Equal<Setters<{}>, {}>>, // no properties
  Expect<Equal<Setters<{ 1: string }>, {}>>, // only a number key
];

type Count = Setters<{ count: number }>;

// @ts-expect-error
const misspelled = (s: Count) => s.setcount(1); // the C is uppercase

// @ts-expect-error
const text = (s: Count) => s.setCount('1'); // a count is a number

export { misspelled, text };
