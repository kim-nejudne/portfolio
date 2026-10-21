// The statuses an order goes through.
export const OrderStatus = {
  Pending: 'pending',
  Paid: 'paid',
  Shipped: 'shipped',
  Cancelled: 'cancelled',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

// What the customer sees for each status.
export const labels: Record<OrderStatus, string> = {
  pending: 'Waiting for payment',
  paid: 'Paid, packing soon',
  shipped: 'On its way',
  cancelled: 'Cancelled',
};

/** The status an order moves on to, or undefined when it goes no further. */
export function next(status: OrderStatus): OrderStatus | undefined {
  switch (status) {
    case OrderStatus.Pending:
      return OrderStatus.Paid;
    case OrderStatus.Paid:
      return OrderStatus.Shipped;
    case OrderStatus.Shipped:
    case OrderStatus.Cancelled:
      return undefined;
    default: {
      const unreachable: never = status;
      throw new Error(`unknown status: ${JSON.stringify(unreachable)}`);
    }
  }
}

/** The status whose value is `text`, or undefined when there is none. */
export function parseStatus(text: string): OrderStatus | undefined {
  for (const status of Object.values(OrderStatus)) {
    if (status === text) {
      return status;
    }
  }
  return undefined;
}
