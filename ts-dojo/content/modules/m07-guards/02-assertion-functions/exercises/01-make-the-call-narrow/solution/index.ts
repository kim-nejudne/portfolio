/** Throws a RangeError unless value is a price: a finite number that is zero or more. */
export function assertIsPrice(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`not a price: ${String(value)}`);
  }
}

/** The price with tax added, at a rate such as 0.2 for 20%. */
export function addTax(price: unknown, rate: number): number {
  assertIsPrice(price);
  return price * (1 + rate);
}
