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

/** What fetchOrder resolves to. */
export type Order = Awaited<ReturnType<typeof fetchOrder>>;
/** Every status an order can have. */
export type Status = Order['status'];
/** The statuses an order can still move on from: every status but delivered and cancelled. */
export type OpenStatus = Exclude<Status, 'delivered' | 'cancelled'>;
/** An order's coupon, never null. */
export type Coupon = NonNullable<Order['coupon']>;
/** The options formatCents takes. */
export type MoneyOptions = Parameters<typeof formatCents>[1];

/** The sum of qty * unitCents over the lines, less the coupon's percentage, rounded to a cent. */
export function total(order: Order): number {
  let sum = 0;
  for (const line of order.lines) {
    sum += line.qty * line.unitCents;
  }
  if (order.coupon === null) {
    return sum;
  }
  return sum - Math.round((sum * order.coupon.percentOff) / 100);
}

/** The status after this one: cart to paid, paid to shipped, shipped to delivered. */
export function nextStatus(status: OpenStatus): Status {
  switch (status) {
    case 'cart':
      return 'paid';
    case 'paid':
      return 'shipped';
    case 'shipped':
      return 'delivered';
    default: {
      const unreachable: never = status;
      throw new Error(`no next status for ${String(unreachable)}`);
    }
  }
}

/** A copy of the order with this coupon; the order passed in is left alone. */
export function applyCoupon(order: Order, coupon: Coupon): Order {
  return { ...order, coupon };
}

/** The order's id, a colon, a space and its total formatted with formatCents. */
export function receipt(order: Order, options: MoneyOptions): string {
  return `${order.id}: ${formatCents(total(order), options)}`;
}
