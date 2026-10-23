/** A pricing plan: the price of a seat per month in euros, the seats it allows, its invoice line. */
export type Plan = {
  pricePerSeat: number;
  maxSeats: number | 'unlimited';
  invoiceLine: (seats: number) => string;
};

// The one list of plans. Check it against Plan without losing its names and values.
export const plans: Record<string, Plan> = {
  free: {
    pricePerSeat: 0,
    maxSeats: 3,
    invoiceLine: (seats) => `Free plan, ${seats} seats`,
  },
  team: {
    pricePerSeat: 8,
    maxSeats: 50,
    invoiceLine: (seats) => `Team plan, ${seats} seats at 8 EUR`,
  },
  business: {
    pricePerSeat: 15,
    maxSeats: 'unlimited',
    invoiceLine: (seats) => `Business plan, ${seats} seats at 15 EUR`,
  },
};

/** The name of a plan, taken from the list. */
export type PlanName = keyof typeof plans;

export type Subscription = { plan: PlanName; seats: number };

export type Change =
  | { type: 'switch-plan'; plan: PlanName }
  | { type: 'add-seats'; count: number }
  | { type: 'remove-seats'; count: number };

/** Throws for a value that no case handled. */
export function assertNever(value: never): never {
  throw new Error('not implemented');
}

/** What the subscription costs per month, in euros. */
export function monthlyCost(subscription: Subscription): number {
  throw new Error(`not implemented for ${subscription.plan}`);
}

/** The subscription after the change. Throws a RangeError when the seats don't fit. */
export function apply(
  subscription: Subscription,
  change: Change,
): Subscription {
  throw new Error(`not implemented for ${change.type}`);
}
