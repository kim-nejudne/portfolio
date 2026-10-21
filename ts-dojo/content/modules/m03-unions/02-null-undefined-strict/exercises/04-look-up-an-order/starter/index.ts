export type Order = {
  id: string;
  customer: { name: string; email?: string };
  coupon: string | null; // null when the order was placed without a coupon
};

// The order with this id, or undefined when there is none.
export function findOrder(
  orders: readonly Order[],
  id: string,
): Order | undefined {
  throw new Error('not implemented');
}

// The customer's email, else their name; 'nobody' when there is no such order.
export function contactFor(orders: readonly Order[], id: string): string {
  throw new Error('not implemented');
}

// The coupon in upper case; `fallback` when there is no order or no coupon.
export function couponCode(
  order: Order | undefined,
  fallback = 'NONE',
): string {
  throw new Error('not implemented');
}
