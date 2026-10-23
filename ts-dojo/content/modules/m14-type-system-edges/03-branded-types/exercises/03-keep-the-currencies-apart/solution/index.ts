// The brand's key. It exists only in types: never use it as a value.
declare const currency: unique symbol;

export type Currency = 'USD' | 'EUR' | 'SEK';

// An amount in the minor unit of currency C: cents, or öre for SEK.
// C is phantom: the brand member is the only place it appears, and it has no run-time value.
export type Money<C extends Currency> = number & { readonly [currency]: C };

// Returns minor as an amount in code, and throws a RangeError when minor isn't whole.
export function money<C extends Currency>(code: C, minor: number): Money<C> {
  if (!Number.isInteger(minor)) {
    throw new RangeError(
      `${minor} ${code} is not a whole number of minor units`,
    );
  }
  return minor as Money<C>;
}

// Adds two amounts in the same currency.
// NoInfer: C comes from a alone, so b is checked against it instead of joining a union.
export function add<C extends Currency>(
  a: Money<C>,
  b: NoInfer<Money<C>>,
): Money<C> {
  // A sum is a plain number again; two amounts in C add up to an amount in C.
  return (a + b) as Money<C>;
}

// Writes the amount in major units with two decimals, then the code: '2.50 USD'.
// C comes from the code, and the amount must be in that currency.
export function format<C extends Currency>(
  code: C,
  amount: NoInfer<Money<C>>,
): string {
  return `${(amount / 100).toFixed(2)} ${code}`;
}
