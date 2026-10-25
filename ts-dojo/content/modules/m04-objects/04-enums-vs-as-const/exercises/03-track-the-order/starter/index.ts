// The statuses an order goes through.
export const OrderStatus = {
  Pending: 'pending',
  Paid: 'paid',
  Shipped: 'shipped',
  Cancelled: 'cancelled',
} as const;

// Should be the union of the values above.
export type OrderStatus = string;

// What the customer sees for each status. One is missing, and the type didn't notice.
export const labels: Record<string, string> = {
  pending: 'Waiting for payment',
  paid: 'Paid, packing soon',
  shipped: 'On its way',
};

/** The status an order moves on to, or undefined when it goes no further. */
export function next(status: OrderStatus): OrderStatus | undefined {
  throw new Error(`not implemented for ${status}`);
}

/** The status whose value is `text`, or undefined when there is none. */
export function parseStatus(text: string): OrderStatus | undefined {
  throw new Error(`not implemented for ${text}`);
}
