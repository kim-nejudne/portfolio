import type { Equal, Expect } from '@dojo/type-utils';
import type { Loud } from './index';

type Profile = {
  readonly name: 'ada';
  age: 36;
  role: 'admin' | 'editor';
  tags: 'math'[];
};

type cases = [
  Expect<
    Equal<
      Loud<Profile>,
      {
        readonly name: 'ADA';
        age: 36;
        role: 'ADMIN' | 'EDITOR';
        tags: 'math'[];
      }
    >
  >, // strings in capitals, a number and an array as they are, readonly kept
  Expect<
    Equal<
      Loud<{ title: string; pages: number; done: boolean }>,
      { title: Uppercase<string>; pages: number; done: boolean }
    >
  >, // any string, and properties that are not strings
  Expect<Equal<Loud<{ x: 1; y: 2 }>, { x: 1; y: 2 }>>, // no strings, nothing to change
  Expect<Equal<Loud<{}>, {}>>, // no properties at all
];

// @ts-expect-error
const quiet: Loud<{ lang: 'en' }> = { lang: 'en' }; // must be 'EN'

export { quiet };
