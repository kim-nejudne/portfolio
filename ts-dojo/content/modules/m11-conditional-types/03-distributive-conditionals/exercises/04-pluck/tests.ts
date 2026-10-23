import type { Equal, Expect } from '@dojo/type-utils';
import { pluck, type AllKeys, type Column } from './index';

type Row =
  | { kind: 'user'; id: number; name: string }
  | { kind: 'team'; id: number; members: number; name?: string };
type RowKeys = 'kind' | 'id' | 'name' | 'members';
type Kinds = 'user' | 'team';

interface Point {
  x: number;
  y: number;
}

type MembersColumn = ReturnType<typeof pluck<Row, 'members'>>;
type YColumn = ReturnType<typeof pluck<Point, 'y'>>;

type cases = [
  Expect<Equal<AllKeys<Row>, RowKeys>>, // every key of any member
  Expect<Equal<AllKeys<Point>, 'x' | 'y'>>, // one interface
  Expect<Equal<AllKeys<never>, never>>, // no members, no keys
  Expect<Equal<Column<Row, 'id'>, number>>, // in every row
  Expect<Equal<Column<Row, 'kind'>, Kinds>>, // one answer per member
  Expect<Equal<Column<Row, 'members'>, number | undefined>>, // missing from users
  Expect<Equal<Column<Row, 'name'>, string | undefined>>, // optional in teams
  Expect<Equal<Column<Row, 'kind' | 'members'>, Kinds | number | undefined>>, // a union of keys
  Expect<Equal<Column<Point, 'x'>, number>>, // one interface
  Expect<Equal<Column<{ a: 1 } | { b: 2 }, 'c'>, undefined>>, // in no row
  Expect<Equal<Column<never, 'a'>, never>>, // no rows
  Expect<Equal<MembersColumn, (number | undefined)[]>>, // pluck returns a column
  Expect<Equal<YColumn, number[]>>, // a column of numbers
];

const team = { kind: 'team', id: 2, members: 3 } as const;
const rows: Row[] = [
  { kind: 'user', id: 1, name: 'Ada' },
  team,
  { kind: 'team', id: 3, members: 8, name: 'core' },
];

const misuse = () => {
  // @ts-expect-error
  pluck(rows, 'email'); // a key no row has
  // @ts-expect-error
  pluck([1, 2], 'x'); // rows must be objects
};

test('a key every row has', () => {
  expect(pluck(rows, 'id')).toEqual([1, 2, 3]);
  expect(pluck(rows, 'kind')).toEqual(['user', 'team', 'team']);
});

test('a key some rows lack gives undefined there', () => {
  expect(pluck(rows, 'members')).toEqual([undefined, 3, 8]);
  expect(pluck(rows, 'name')).toEqual(['Ada', undefined, 'core']);
});

test('rows of one type', () => {
  const points: Point[] = [
    { x: 1, y: 2 },
    { x: 3, y: 4 },
  ];
  expect(pluck(points, 'y')).toEqual([2, 4]);
  expect(pluck(points, 'x')).toEqual([1, 3]);
});

test('many rows, in order', () => {
  const many: Row[] = [5, 1, 4, 2, 3].map((id): Row =>
    id % 2 === 0
      ? { kind: 'team', id, members: id * 10 }
      : { kind: 'user', id, name: `user ${id}` },
  );
  expect(pluck(many, 'id')).toEqual([5, 1, 4, 2, 3]);
  expect(pluck(many, 'members')).toEqual([
    undefined,
    undefined,
    40,
    20,
    undefined,
  ]);
});

test('no rows give an empty column', () => {
  const none: Row[] = [];
  expect(pluck(none, 'id')).toEqual([]);
});

test('pluck does not change its rows', () => {
  pluck(rows, 'name');
  expect(rows[1]).toBe(team);
  expect(rows).toHaveLength(3);
});

export { misuse };
