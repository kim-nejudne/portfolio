import type {
  Equal,
  Expect,
  ExpectExtends,
  ExpectFalse,
} from '@dojo/type-utils';
import { add, format, money, type Money } from './index';

declare const usd: Money<'USD'>;
declare const eur: Money<'EUR'>;
declare const sek: Money<'SEK'>;

const kronor = () => money('SEK', 4900);
const dollars = () => add(usd, usd);

// ExpectExtends<To, From> is true when a From is assignable to a To.
type cases = [
  ExpectFalse<ExpectExtends<Money<'EUR'>, Money<'USD'>>>, // dollars are no euros
  ExpectFalse<ExpectExtends<Money<'USD'>, Money<'SEK'>>>, // kronor are no dollars
  ExpectFalse<ExpectExtends<Money<'SEK'>, Money<'EUR'>>>, // euros are no kronor
  ExpectFalse<ExpectExtends<Money<'USD'>, number>>, // a plain number is no amount
  Expect<ExpectExtends<number, Money<'USD'>>>, // an amount is still a number
  Expect<Equal<ReturnType<typeof kronor>, Money<'SEK'>>>, // money takes the currency from the code
  Expect<Equal<ReturnType<typeof dollars>, Money<'USD'>>>, // a sum stays in its currency
];

// @ts-expect-error
const mixed = () => add(usd, eur); // two currencies

// @ts-expect-error
const mixedBack = () => add(sek, usd); // two currencies, the other way

// @ts-expect-error
const plain = () => add(usd, 100); // a plain number

// @ts-expect-error
const wrongCode = () => format('EUR', usd); // a code that isn't the amount's

export { kronor, dollars, mixed, mixedBack, plain, wrongCode };

test('money keeps whole minor units', () => {
  expect(money('USD', 250)).toBe(250);
  expect(money('SEK', 0)).toBe(0);
  expect(money('EUR', -199)).toBe(-199);
});

test('money rejects a number that is not whole', () => {
  expect(() => money('USD', 2.5)).toThrow();
  expect(() => money('EUR', Number.NaN)).toThrow();
  expect(() => money('SEK', Number.POSITIVE_INFINITY)).toThrow();
});

test('add sums two amounts in one currency', () => {
  expect(add(money('USD', 250), money('USD', 199))).toBe(449);
  expect(add(money('SEK', 4900), money('SEK', -900))).toBe(4000);
});

test('format writes major units and the code', () => {
  expect(format('USD', money('USD', 250))).toBe('2.50 USD');
  expect(format('EUR', money('EUR', 199))).toBe('1.99 EUR');
  expect(format('SEK', add(money('SEK', 4900), money('SEK', 5)))).toBe(
    '49.05 SEK',
  );
});

test('an amount is still a number', () => {
  const total: number = add(money('USD', 100), money('USD', 25));
  expect(Math.max(total, money('USD', 99))).toBe(125);
});
