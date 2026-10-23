import type { Equal, Expect } from '@dojo/type-utils';
import type { Mutable, Nullable } from './index';

type Profile = {
  readonly id: number;
  name: string;
  bio?: string;
  readonly tags: string[];
};

type Point = { readonly x: number; readonly y: number };

type cases = [
  Expect<
    Equal<
      Nullable<Profile>,
      {
        readonly id: number | null;
        name: string | null;
        bio?: string | null;
        readonly tags: string[] | null;
      }
    >
  >, // every property also takes null, modifiers kept
  Expect<
    Equal<
      Nullable<Point>,
      { readonly x: number | null; readonly y: number | null }
    >
  >, // a second type
  Expect<Equal<Nullable<{}>, {}>>, // no properties, nothing to change
  Expect<
    Equal<
      Mutable<Profile>,
      { id: number; name: string; bio?: string; tags: string[] }
    >
  >, // readonly removed, ? kept
  Expect<Equal<Mutable<Point>, { x: number; y: number }>>, // a writable point
  Expect<Equal<Mutable<{ a?: 1 }>, { a?: 1 }>>, // nothing readonly, nothing to change
];

const blank: Nullable<Profile> = { id: null, name: null, tags: null };

// @ts-expect-error
const noName: Nullable<Profile> = { id: 1, tags: [] }; // name is still required

// @ts-expect-error
const undefinedName: Nullable<Profile> = { id: 1, name: undefined, tags: [] }; // null, not undefined

const origin: Mutable<Point> = { x: 0, y: 0 };

// @ts-expect-error
origin.y = 'four'; // y is still a number

export { blank, noName, undefinedName, origin };
