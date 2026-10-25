import type { Equal, Expect } from '@dojo/type-utils';
import { Database, shop } from './index';

type Reading = { [K in `sensor${1 | 2 | 3}`]: number } & {
  id: number;
  site: string;
  note: string | null;
  ok: boolean;
};

// Rows from a fixed pseudo-random sequence.
let seed = 7;
const next = () => (seed = (seed * 48271) % 2147483647) % 100;
const rows: Reading[] = Array.from({ length: 30 }, (_, id) => ({
  id,
  sensor1: next(),
  sensor2: next(),
  sensor3: next(),
  site: `site ${'abcde'[next() % 5]}`,
  note: id % 3 === 0 ? null : `note ${id}`,
  ok: id % 2 === 0,
}));
const readings = new Database<{ readings: Reading }>({ readings: rows }).from(
  'readings',
);

const products = shop.from('products');

const byLevel = () =>
  readings.select('id', 'site', 'sensor2', 'note').orderBy('sensor2', 'desc');
type Sorted = ReturnType<typeof byLevel>;

type cases = [
  Expect<Equal<keyof Sorted, 'run'>>, // after orderBy, only run
  Expect<
    Equal<
      ReturnType<Sorted['run']>,
      Pick<Reading, 'id' | 'site' | 'sensor2' | 'note'>[]
    >
  >, // run returns the output rows
];

// @ts-expect-error
const okBelow = () => readings.where('ok', '<', true); // a boolean has no order

// @ts-expect-error
const noteAbove = () => readings.where('note', '>', 'a'); // nor a column that can be null

// @ts-expect-error
const discontinued = () => products.where('discontinued', '>', false); // in any table

// @ts-expect-error
const sortNote = () => readings.select('note').orderBy('note', 'asc'); // can't sort what may be null

// @ts-expect-error
const sortOk = () => readings.orderBy('ok', 'desc'); // nor booleans

// @ts-expect-error
const sortHidden = () => readings.select('site').orderBy('sensor1', 'asc'); // only output columns

// @ts-expect-error
const sortTwice = () => byLevel().orderBy('site', 'asc'); // orderBy once

// @ts-expect-error
const whereAfter = () => byLevel().where('ok', '=', true); // where comes first

export {
  okBelow,
  noteAbove,
  discontinued,
  sortNote,
  sortOk,
  sortHidden,
  sortTwice,
  whereAfter,
};

const ids = (list: readonly { id: number }[]) =>
  list.map((row) => row.id).toSorted((a, b) => a - b);

test('every operator filters', () => {
  for (let limit = 10; limit < 100; limit += 20) {
    const below = readings.where('sensor1', '<', limit).select('id').run();
    const above = readings.where('sensor3', '>', limit).select('id').run();
    const other = readings.where('sensor2', '!=', limit).select('id').run();
    expect(ids(below)).toEqual(ids(rows.filter((r) => r.sensor1 < limit)));
    expect(ids(above)).toEqual(ids(rows.filter((r) => r.sensor3 > limit)));
    expect(ids(other)).toEqual(ids(rows.filter((r) => r.sensor2 !== limit)));
  }
});

test('equality works on every column', () => {
  const noted = readings.where('note', '!=', null).where('ok', '=', true).run();
  expect(ids(noted)).toEqual(ids(rows.filter((r) => r.note !== null && r.ok)));
  const before = readings.where('site', '<', 'site c').select('id').run();
  expect(ids(before)).toEqual(ids(rows.filter((r) => r.site < 'site c')));
});

test('orderBy sorts numbers both ways', () => {
  const down = byLevel().run();
  expect(down.map((row) => row.sensor2)).toEqual(
    rows.map((r) => r.sensor2).toSorted((a, b) => b - a),
  );
  expect(ids(down)).toEqual(ids(rows));
  const up = readings
    .where('ok', '=', false)
    .select('id', 'sensor3')
    .orderBy('sensor3', 'asc')
    .run();
  const odd = rows.filter((r) => !r.ok);
  expect(up.map((row) => row.sensor3)).toEqual(
    odd.map((r) => r.sensor3).toSorted((a, b) => a - b),
  );
  expect(ids(up)).toEqual(ids(odd));
});

test('orderBy sorts strings', () => {
  const sites = readings.select('site').orderBy('site', 'asc').run();
  expect(sites.map((row) => row.site)).toEqual(
    rows.map((r) => r.site).toSorted(),
  );
});

test('orderBy leaves the query it was called on alone', () => {
  const base = readings.select('id', 'sensor1');
  base.orderBy('sensor1', 'desc').run();
  expect(base.run().map((row) => row.id)).toEqual(rows.map((r) => r.id));
});

test('the shop sorts its products', () => {
  const sorted = products
    .where('price', '>', 5)
    .select('name', 'price')
    .orderBy('price', 'desc')
    .run();
  expect(sorted).toEqual([
    { name: 'Lamp', price: 35 },
    { name: 'Notebook', price: 6 },
  ]);
});
