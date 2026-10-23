// ---- From the shop's client library. Treat this part as code you can't change. ----

export async function fetchOrder(id: string): Promise<{
  id: string;
  status: 'cart' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  lines: { sku: string; qty: number; unitCents: number }[];
  coupon: { code: string; percentOff: number } | null;
}> {
  return {
    id,
    status: 'paid',
    lines: [{ sku: 'TEA-01', qty: 2, unitCents: 450 }],
    coupon: null,
  };
}

export function formatCents(
  cents: number,
  options: { currency: 'EUR' | 'USD' | 'GBP'; withCode?: boolean },
): string {
  const symbols = { EUR: '€', USD: '$', GBP: '£' };
  const amount = `${symbols[options.currency]}${(cents / 100).toFixed(2)}`;
  return options.withCode ? `${amount} ${options.currency}` : amount;
}

// ---- Your code. Read every type below from the library above. ----

// A first guess, written by hand and too loose. Derive each type from the library instead.
/** What fetchOrder resolves to. */
export type Order = {
  id: string;
  status: string;
  lines: unknown[];
  coupon: unknown;
};
/** Every status an order can have. */
export type Status = string;
/** The statuses an order can still move on from: every status but delivered and cancelled. */
export type OpenStatus = string;
/** An order's coupon, never null. */
export type Coupon = unknown;
/** The options formatCents takes. */
export type MoneyOptions = { currency: string; withCode?: boolean };

/** The sum of qty * unitCents over the lines, less the coupon's percentage, rounded to a cent. */
export function total(order: Order): number {
  throw new Error(`not implemented for ${typeof order}`);
}

/** The status after this one: cart to paid, paid to shipped, shipped to delivered. */
export function nextStatus(status: OpenStatus): Status {
  throw new Error(`not implemented for ${typeof status}`);
}

/** A copy of the order with this coupon; the order passed in is left alone. */
export function applyCoupon(order: Order, coupon: Coupon): Order {
  throw new Error(`not implemented for ${typeof order} and ${typeof coupon}`);
}

/** The order's id, a colon, a space and its total formatted with formatCents. */
export function receipt(order: Order, options: MoneyOptions): string {
  throw new Error(`not implemented for ${typeof order} and ${typeof options}`);
}
