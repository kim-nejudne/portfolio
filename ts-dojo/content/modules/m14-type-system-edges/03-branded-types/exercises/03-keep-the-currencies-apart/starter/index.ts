// The brand's key. It exists only in types: never use it as a value.
declare const currency: unique symbol;

export type Currency = 'USD' | 'EUR' | 'SEK';

// An amount in the minor unit of currency C: cents, or öre for SEK.
// C should keep currencies apart, but nothing in the type uses it yet.
export type Money<C extends Currency> = number;

// Returns minor as an amount in code, and throws a RangeError when minor isn't whole.
export function money<C extends Currency>(code: C, minor: number): Money<C> {
  throw new Error('not implemented');
}

// Adds two amounts in the same currency.
export function add<C extends Currency>(a: Money<C>, b: Money<C>): Money<C> {
  throw new Error('not implemented');
}

// Writes the amount in major units with two decimals, then the code: '2.50 USD'.
export function format<C extends Currency>(code: C, amount: Money<C>): string {
  throw new Error('not implemented');
}
