import type { Equal, Expect } from '@dojo/type-utils';
import {
  arrayOf,
  line,
  ok,
  order,
  quantity,
  string,
  type Line,
  type Order,
  type Parser,
  type Quantity,
  type Result,
} from './index';

type cases = [
  Expect<Equal<typeof quantity, Parser<Quantity>>>, // quantity parses a Quantity
  Expect<Equal<typeof arrayOf, <T>(item: Parser<T>) => Parser<T[]>>>, // arrayOf is generic
  Expect<Equal<ReturnType<typeof line>, Result<Line>>>, // line returns a Result of Line
  Expect<Equal<ReturnType<typeof order>, Result<Order>>>, // order returns a Result of Order
];

// @ts-expect-error
const plain: Quantity = 5; // a plain number is no Quantity

export { plain };

function fails(path: (string | number)[], message: string) {
  return { ok: false, error: { path, message } };
}

test('quantity accepts whole numbers from 1 to 99', () => {
  for (let n = 1; n <= 99; n += 7) {
    expect(quantity(n)).toEqual({ ok: true, value: n });
  }
  expect(quantity(99)).toEqual({ ok: true, value: 99 });
});

test('quantity rejects everything else', () => {
  for (const input of [
    0,
    100,
    -1,
    2.5,
    Number.NaN,
    '3',
    null,
    undefined,
    [3],
  ]) {
    expect(quantity(input)).toEqual(
      fails([], 'expected a whole number from 1 to 99'),
    );
  }
});

test('arrayOf parses every element with its parser', () => {
  const words = Array.from({ length: 9 }, (_, i) => `word${i * 3}`);
  expect(arrayOf(string)(words)).toEqual({ ok: true, value: words });
  expect(arrayOf(quantity)([1, 2, 3])).toEqual({ ok: true, value: [1, 2, 3] });
  expect(arrayOf(string)([])).toEqual({ ok: true, value: [] });
});

test('arrayOf nests', () => {
  const grid = [['a', 'b'], [], ['c']];
  expect(arrayOf(arrayOf(string))(grid)).toEqual({ ok: true, value: grid });
  expect(arrayOf(arrayOf(string))([['a'], ['b', 7]])).toEqual(
    fails([1, 1], 'expected a string'),
  );
});

test('arrayOf rejects what is no array', () => {
  for (const input of [null, 'abc', 3, { 0: 'a', length: 1 }, undefined]) {
    expect(arrayOf(string)(input)).toEqual(fails([], 'expected an array'));
  }
});

test('arrayOf stops at the first element that fails', () => {
  for (let bad = 0; bad < 6; bad++) {
    const seen: unknown[] = [];
    const spy: Parser<number> = (input) => {
      seen.push(input);
      return typeof input === 'number' ? ok(input) : quantity(input);
    };
    const input = [0, 1, 2, 3, 4, 5].map((n) => (n === bad ? `x${n}` : n));
    expect(arrayOf(spy)(input)).toEqual(
      fails([bad], 'expected a whole number from 1 to 99'),
    );
    expect(seen).toHaveLength(bad + 1);
  }
});

test('line keeps exactly the sku and the quantity', () => {
  expect(line({ sku: 'A-1', quantity: 2, price: 9.5 })).toEqual({
    ok: true,
    value: { sku: 'A-1', quantity: 2 },
  });
});

test('line reports the field that failed', () => {
  expect(line({ quantity: 2 })).toEqual(fails(['sku'], 'expected a string'));
  expect(line({ sku: 'A-1', quantity: 0 })).toEqual(
    fails(['quantity'], 'expected a whole number from 1 to 99'),
  );
  expect(line(null)).toEqual(fails([], 'expected an object'));
  expect(line(['A-1', 2])).toEqual(fails([], 'expected an object'));
});

test('order parses a whole order and drops what it does not name', () => {
  const data: unknown = JSON.parse(
    '{"id":"o-17","customer":"ada","lines":[{"sku":"A-1","quantity":2,"note":"gift"},{"sku":"B-7","quantity":1}]}',
  );
  expect(order(data)).toEqual({
    ok: true,
    value: {
      id: 'o-17',
      lines: [
        { sku: 'A-1', quantity: 2 },
        { sku: 'B-7', quantity: 1 },
      ],
    },
  });
});

test('order parses generated orders', () => {
  for (let size = 0; size < 6; size++) {
    const lines = Array.from({ length: size }, (_, i) => ({
      sku: `S-${size}${i}`,
      quantity: i + size + 1,
    }));
    expect(order({ id: `o-${size}`, lines })).toEqual({
      ok: true,
      value: { id: `o-${size}`, lines },
    });
  }
});

test('order reports the path to what failed', () => {
  const good = { sku: 'A-1', quantity: 2 };
  expect(order({ lines: [] })).toEqual(fails(['id'], 'expected a string'));
  expect(order({ id: 'o-1' })).toEqual(fails(['lines'], 'expected an array'));
  expect(
    order({ id: 'o-1', lines: [good, { sku: 'B', quantity: 120 }] }),
  ).toEqual(
    fails(['lines', 1, 'quantity'], 'expected a whole number from 1 to 99'),
  );
  expect(order({ id: 'o-1', lines: [good, good, { quantity: 1 }] })).toEqual(
    fails(['lines', 2, 'sku'], 'expected a string'),
  );
  expect(order({ id: 'o-1', lines: [good, 'A-1'] })).toEqual(
    fails(['lines', 1], 'expected an object'),
  );
  expect(order('o-1')).toEqual(fails([], 'expected an object'));
});
