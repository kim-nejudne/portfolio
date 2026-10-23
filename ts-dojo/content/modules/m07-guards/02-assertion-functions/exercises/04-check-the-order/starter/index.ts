export type LineItem = { sku: string; quantity: number };
export type Order = { id: string; items: LineItem[]; coupon?: string };

export class OrderChecker {
  constructor(readonly maxQuantity: number) {}

  /** Throws a TypeError unless value is a LineItem whose quantity is a whole number from 1 to maxQuantity. */
  assertLineItem(value: unknown): asserts value is LineItem {
    throw new Error(`not implemented for ${typeof value}`);
  }

  /** Throws a TypeError unless value is an Order whose every item passes assertLineItem. */
  assertOrder(value: unknown): asserts value is Order {
    throw new Error(`not implemented for ${typeof value}`);
  }
}

/** Parses the text, checks it with the checker, and returns the sum of the quantities. */
export function totalQuantity(json: string, checker: OrderChecker): number {
  throw new Error(`not implemented for ${json} and ${checker.maxQuantity}`);
}
