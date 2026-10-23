import { Money } from './money';

// An augmentation of './money': this Money interface merges with the class's instance type.
declare module './money' {
  interface Money {
    /** '4.50 EUR' for new Money(450, 'EUR'). */
    format(): string;
    /** The sum of two amounts in the same currency. */
    plus(other: Money): Money;
  }
}

// The augmentation is types only: the methods themselves go on the prototype. Inside the
// function expressions, `this` is a Money.
Money.prototype.format = function () {
  return `${(this.cents / 100).toFixed(2)} ${this.currency}`;
};

Money.prototype.plus = function (other) {
  if (other.currency !== this.currency) {
    throw new Error(
      `currency mismatch: ${this.currency} and ${other.currency}`,
    );
  }
  return new Money(this.cents + other.cents, this.currency);
};
