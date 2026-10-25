import type { Equal, Expect } from '@dojo/type-utils';
import { Money } from './money';
import './format';

type cases = [
  Expect<Equal<Money['format'], () => string>>, // format takes nothing and returns a string
  Expect<Equal<Money['plus'], (other: Money) => Money>>, // plus takes a Money and returns one
  Expect<Equal<Money['cents'], number>>, // the class's own members are still there
];

// @ts-expect-error
const noDollars = () => new Money(100, 'USD').plus(100); // plus needs a Money

export { noDollars };

test('formats amounts', () => {
  expect(new Money(450, 'EUR').format()).toBe('4.50 EUR');
  expect(new Money(5, 'SEK').format()).toBe('0.05 SEK');
  expect(new Money(129900, 'USD').format()).toBe('1299.00 USD');
});

test('adds amounts in the same currency', () => {
  for (let a = 0; a <= 1000; a += 250) {
    for (let b = 1; b <= 900; b += 299) {
      const sum = new Money(a, 'EUR').plus(new Money(b, 'EUR'));
      expect(sum).toBeInstanceOf(Money);
      expect(sum.cents).toBe(a + b);
      expect(sum.currency).toBe('EUR');
    }
  }
  expect(new Money(450, 'EUR').plus(new Money(1200, 'EUR')).format()).toBe(
    '16.50 EUR',
  );
});

test('plus leaves both amounts as they are', () => {
  const a = new Money(300, 'EUR');
  const b = new Money(200, 'EUR');
  a.plus(b);
  expect([a.cents, b.cents]).toEqual([300, 200]);
});

test('refuses to add two currencies', () => {
  expect(() => new Money(100, 'EUR').plus(new Money(100, 'USD'))).toThrow(
    'currency mismatch',
  );
});

test('the methods live on the prototype, not on each instance', () => {
  expect(Object.keys(new Money(1, 'EUR'))).toEqual(['cents', 'currency']);
  expect(typeof Money.prototype.format).toBe('function');
  expect(typeof Money.prototype.plus).toBe('function');
});
