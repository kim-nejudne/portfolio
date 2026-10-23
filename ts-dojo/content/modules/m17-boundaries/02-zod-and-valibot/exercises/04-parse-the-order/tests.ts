import type { Equal, Expect } from '@dojo/type-utils';
import type { z } from 'zod';
import {
  Email,
  Order,
  Sku,
  parseOrder,
  type OrderInput,
  type Result,
} from './index';

type cases = [
  Expect<Equal<z.output<typeof Email>, string & z.$brand<'Email'>>>, // Email's output is branded
  Expect<Equal<z.input<typeof Email>, string>>, // Email's input is a plain string
  Expect<Equal<z.output<typeof Sku>, string & z.$brand<'Sku'>>>, // Sku's output is branded
  Expect<
    Equal<
      z.output<typeof Order>,
      {
        id: string;
        email: string & z.$brand<'Email'>;
        placedAt: Date;
        lines: { sku: string & z.$brand<'Sku'>; quantity: number }[];
      }
    >
  >, // the parsed order
  Expect<
    Equal<
      OrderInput,
      {
        id: string;
        email: string;
        placedAt: string;
        lines: { sku: string; quantity: number }[];
      }
    >
  >, // the order as it arrives
  Expect<Equal<ReturnType<typeof parseOrder>, Result<z.output<typeof Order>>>>, // parseOrder returns a Result
];

// @ts-expect-error
const email: Email = 'ada@example.com'; // a plain string is no Email

// @ts-expect-error
const sku: Sku = 'ABC-1234'; // a plain string is no Sku

export { email, sku };

const good = {
  id: 'o-17',
  email: ' Ada@Example.com ',
  placedAt: '2026-03-01',
  lines: [
    { sku: 'ABC-1234', quantity: 2, note: 'gift' },
    { sku: 'XYZ-0007', quantity: 99 },
  ],
  customer: 'ada',
};

function pathsOf(input: unknown): string[] {
  const result = parseOrder(input);
  return result.ok
    ? []
    : result.errors.map((issue) => issue.path.map(String).join('.')).sort();
}

test('parseOrder parses an order, normalising and dropping what it does not name', () => {
  expect(parseOrder(good)).toEqual({
    ok: true,
    value: {
      id: 'o-17',
      email: 'ada@example.com',
      placedAt: new Date('2026-03-01'),
      lines: [
        { sku: 'ABC-1234', quantity: 2 },
        { sku: 'XYZ-0007', quantity: 99 },
      ],
    },
  });
});

test('parseOrder parses generated orders', () => {
  for (let size = 1; size <= 6; size++) {
    const lines = Array.from({ length: size }, (_, i) => ({
      sku: `SK${String.fromCharCode(65 + size + i)}-${String(1000 + size * 37 + i)}`,
      quantity: size * 11 + i,
    }));
    const day = String(size + 9);
    const result = parseOrder({
      id: `o-${size}`,
      email: `Buyer${size}@Shop.example`,
      placedAt: `2026-04-${day}`,
      lines,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        id: `o-${size}`,
        email: `buyer${size}@shop.example`,
        placedAt: new Date(`2026-04-${day}`),
        lines,
      },
    });
  }
});

test('parseOrder reports each issue as its path and message', () => {
  expect(parseOrder({ ...good, email: 'ada' })).toEqual({
    ok: false,
    errors: [{ path: ['email'], message: 'Invalid email address' }],
  });
  expect(
    parseOrder({
      ...good,
      lines: [good.lines[0], { sku: 'abc-1234', quantity: 1 }],
    }),
  ).toEqual({
    ok: false,
    errors: [
      { path: ['lines', 1, 'sku'], message: 'expected a SKU like ABC-1234' },
    ],
  });
  const result = parseOrder(null);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors).toHaveLength(1);
    expect(Object.keys(result.errors[0]).sort()).toEqual(['message', 'path']);
    expect(result.errors[0].path).toEqual([]);
  }
});

test('parseOrder rejects bad SKUs and quantities', () => {
  for (const bad of [
    'ABC1234',
    'AB-1234',
    'ABCD-1234',
    'ABC-123',
    'ABC-12345',
    '',
    'abc-1234',
  ]) {
    expect(pathsOf({ ...good, lines: [{ sku: bad, quantity: 1 }] })).toEqual([
      'lines.0.sku',
    ]);
  }
  for (const quantity of [0, 100, 2.5, -1, '3']) {
    expect(
      pathsOf({ ...good, lines: [{ sku: 'ABC-1234', quantity }] }),
    ).toEqual(['lines.0.quantity']);
  }
});

test('parseOrder rejects a bad id, date or empty lines', () => {
  expect(pathsOf({ ...good, id: '' })).toEqual(['id']);
  for (const placedAt of ['2026-02-30', '01/03/2026', 'yesterday', 20260301]) {
    expect(pathsOf({ ...good, placedAt })).toEqual(['placedAt']);
  }
  expect(pathsOf({ ...good, lines: [] })).toEqual(['lines']);
});

test('parseOrder reports every issue it finds', () => {
  expect(
    pathsOf({
      id: '',
      email: 7,
      placedAt: 'x',
      lines: [{ sku: 'abc', quantity: 0 }],
    }),
  ).toEqual(['email', 'id', 'lines.0.quantity', 'lines.0.sku', 'placedAt']);
});
