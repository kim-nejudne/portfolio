import type { Equal, Expect } from '@dojo/type-utils';
import type { Editable, Snapshot } from './index';

type Account = {
  readonly id: string;
  owner: string;
  nickname?: string;
  readonly closedAt?: Date;
  note: string | undefined;
};

type Point = { readonly x: number; y?: number };

type cases = [
  Expect<
    Equal<
      Editable<Account>,
      {
        id: string;
        owner: string;
        nickname: string;
        closedAt: Date;
        note: string | undefined;
      }
    >
  >, // writable and required, and note keeps the undefined it declares
  Expect<Equal<Editable<Point>, { x: number; y: number }>>, // a second type
  Expect<Equal<Editable<{ a: 1 }>, { a: 1 }>>, // nothing to change
  Expect<Equal<Editable<{}>, {}>>, // no properties
  Expect<Equal<Editable<string>, string>>, // a primitive passes through
  Expect<
    Equal<
      Snapshot<Account>,
      {
        readonly id?: string;
        readonly owner?: string;
        readonly nickname?: string;
        readonly closedAt?: Date;
        readonly note?: string | undefined;
      }
    >
  >, // read-only and optional
  Expect<Equal<Snapshot<Point>, { readonly x?: number; readonly y?: number }>>, // a second type
  Expect<Equal<Snapshot<{}>, {}>>, // no properties
  Expect<Equal<Snapshot<number>, number>>, // a primitive passes through
];

const corner: Editable<Point> = { x: 0, y: 0 };

// @ts-expect-error
const noY: Editable<Point> = { x: 1 }; // y is required now

const empty: Snapshot<Point> = {};

// @ts-expect-error
empty.y = 1; // y is read-only

export { corner, noY, empty };
