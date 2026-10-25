import type { Equal, Expect } from '@dojo/type-utils';
import { discounts, orderTotal, type PriceList, type Tier } from './index';

type cases = [
  Expect<Equal<typeof discounts, Record<Tier, number>>>, // discounts needs every tier
  Expect<Equal<PriceList, Record<string, number | undefined>>>, // a read of a price list may be undefined
];

const prices: PriceList = {
  espresso: 300,
  croissant: 250,
  tea: 200,
  muffin: 333,
  water: 0,
};

test('the discounts are 0, 5 and 10 percent', () => {
  expect(discounts).toEqual({ basic: 0, silver: 5, gold: 10 });
});

test('basic pays the full price', () => {
  expect(orderTotal({ espresso: 2, croissant: 1 }, prices, 'basic')).toBe(850);
});

test('silver gets 5 percent off', () => {
  expect(orderTotal({ espresso: 1, tea: 3 }, prices, 'silver')).toBe(855);
});

test('gold gets 10 percent off', () => {
  expect(orderTotal({ croissant: 4, tea: 1 }, prices, 'gold')).toBe(1080);
});

test('the total is rounded to a whole cent', () => {
  expect(orderTotal({ muffin: 1 }, prices, 'gold')).toBe(300);
});

test('an empty order costs nothing', () => {
  expect(orderTotal({}, prices, 'silver')).toBe(0);
});

test('free water is still on the price list', () => {
  expect(orderTotal({ water: 2, espresso: 1 }, prices, 'basic')).toBe(300);
});

const tiers: Tier[] = ['basic', 'silver', 'gold'];

// Worked out by hand: q espressos at 300, one muffin at 333, less the discount, rounded.
const expected: Record<Tier, (espressos: number) => number> = {
  basic: (q) => 300 * q + 333,
  silver: (q) => 285 * q + 316,
  gold: (q) => 270 * q + 300,
};

test('any number of espressos, at every tier', () => {
  for (const tier of tiers) {
    for (let q = 1; q <= 12; q++) {
      expect(orderTotal({ espresso: q, muffin: 1 }, prices, tier)).toBe(
        expected[tier](q),
      );
    }
  }
});

test('the prices come from the price list it is given', () => {
  for (let price = 50; price <= 1000; price += 50) {
    expect(orderTotal({ tea: 2 }, { tea: price }, 'basic')).toBe(2 * price);
  }
});

test('a product with no price throws, naming it', () => {
  expect(() => orderTotal({ espresso: 1, scone: 2 }, prices, 'basic')).toThrow(
    'scone',
  );
});
