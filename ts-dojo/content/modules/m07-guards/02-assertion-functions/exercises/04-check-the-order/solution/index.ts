export type LineItem = { sku: string; quantity: number };
export type Order = { id: string; items: LineItem[]; coupon?: string };

export class OrderChecker {
  constructor(readonly maxQuantity: number) {}

  /** Throws a TypeError unless value is a LineItem whose quantity is a whole number from 1 to maxQuantity. */
  assertLineItem(value: unknown): asserts value is LineItem {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('sku' in value) ||
      !('quantity' in value) ||
      typeof value.sku !== 'string' ||
      typeof value.quantity !== 'number' ||
      !Number.isInteger(value.quantity) ||
      value.quantity < 1 ||
      value.quantity > this.maxQuantity
    ) {
      throw new TypeError('not a line item');
    }
  }

  /** Throws a TypeError unless value is an Order whose every item passes assertLineItem. */
  assertOrder(value: unknown): asserts value is Order {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('id' in value) ||
      !('items' in value) ||
      typeof value.id !== 'string' ||
      !Array.isArray(value.items) ||
      ('coupon' in value && typeof value.coupon !== 'string')
    ) {
      throw new TypeError('not an order');
    }
    for (const item of value.items) {
      this.assertLineItem(item);
    }
  }
}

/** Parses the text, checks it with the checker, and returns the sum of the quantities. */
export function totalQuantity(json: string, checker: OrderChecker): number {
  const data: unknown = JSON.parse(json);
  checker.assertOrder(data);
  let total = 0;
  for (const item of data.items) {
    total += item.quantity;
  }
  return total;
}
