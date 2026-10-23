import type { Equal, Expect } from '@dojo/type-utils';
import { Database, shop } from './index';

const products = shop.from('products');
const listed = products.select('sku', 'name as title').run();
const swapped = products.select('name as price', 'price as name').run();
const plain = shop.from('orders').select('id', 'customer').run();
const keyed = (n: number) => products.select('sku', `price as price_${n}`);

type Reading = { [K in `sensor${1 | 2 | 3}`]: number } & { site: string };
const readings = new Database<{ readings: Reading }>({
  readings: Array.from({ length: 6 }, (_, n) => ({
    sensor1: n,
    sensor2: n * 10,
    sensor3: n * 100,
    site: `site ${n}`,
  })),
});
const renamed = readings
  .from('readings')
  .select('sensor2 as level', 'site as where')
  .run();

type cases = [
  Expect<Equal<typeof listed, { sku: string; title: string }[]>>, // a column and an alias
  Expect<Equal<typeof swapped, { price: string; name: number }[]>>, // names can swap
  Expect<Equal<typeof plain, { id: number; customer: string | null }[]>>, // plain columns only
  Expect<Equal<typeof renamed, { level: number; where: string }[]>>, // another table
  Expect<
    Equal<
      ReturnType<ReturnType<typeof keyed>['run']>,
      { sku: string; [alias: `price_${number}`]: number }[]
    >
  >, // an alias from a pattern
];

// @ts-expect-error
const typo = () => products.select('nmae as title'); // the column must exist

// @ts-expect-error
const shout = () => products.select('name AS title'); // as is lower case

// @ts-expect-error
const unlisted = () => products.select('title'); // a plain spec is a column

// @ts-expect-error
const sensor = () => readings.from('readings').select('sensor4 as s'); // not a sensor

export { typo, shout, unlisted, sensor };

test('a column and an alias', () => {
  expect(listed).toEqual([
    { sku: 'P-1', title: 'Pen' },
    { sku: 'P-2', title: 'Notebook' },
    { sku: 'P-3', title: 'Lamp' },
  ]);
});

test('names can swap', () => {
  expect(swapped[2]).toEqual({ price: 'Lamp', name: 35 });
});

test('only the specs are copied', () => {
  expect(plain).toEqual([
    { id: 1, customer: 'Ada' },
    { id: 2, customer: null },
  ]);
  expect(renamed.map((row) => Object.keys(row))).toEqual(
    Array.from({ length: 6 }, () => ['level', 'where']),
  );
});

test('aliases made at run time', () => {
  for (let n = 0; n < 5; n++) {
    const rows = keyed(n).where('stock', '>', n).run();
    expect(rows).toEqual([
      { sku: 'P-1', [`price_${n}`]: 2 },
      ...(n < 4 ? [{ sku: 'P-3', [`price_${n}`]: 35 }] : []),
    ]);
  }
});

test('where still tests the source columns', () => {
  const rows = readings
    .from('readings')
    .where('sensor3', '>', 250)
    .select('sensor1 as n')
    .run();
  expect(rows).toEqual([{ n: 3 }, { n: 4 }, { n: 5 }]);
});
