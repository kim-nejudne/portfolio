// Amounts of money in whole cents. This file is right as it is: leave it alone.
export type Currency = 'EUR' | 'USD';

export interface Money {
  cents: number;
  currency: Currency;
}

export function money(cents: number, currency: Currency): Money {
  checkCents(cents);
  return { cents, currency };
}

export function add(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`cannot add ${a.currency} to ${b.currency}`);
  }
  return money(a.cents + b.cents, a.currency);
}

/** For the files of this package only: the barrel does not export it. */
export function checkCents(cents: number): void {
  if (!Number.isInteger(cents)) {
    throw new Error(`not a whole number of cents: ${cents}`);
  }
}
