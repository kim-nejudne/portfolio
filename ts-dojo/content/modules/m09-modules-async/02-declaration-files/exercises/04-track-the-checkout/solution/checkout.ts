import type { Tracker } from 'analytics-lite';

declare global {
  var tracker: Tracker;
}

declare module 'analytics-lite' {
  interface EventMap {
    purchase: { sku: string; total: number };
  }
}

export interface CartLine {
  sku: string;
  cents: number;
  qty: number;
}

/** Sends a purchase per line, then a pageview of '/receipt'; returns the total in cents. */
export function checkout(lines: readonly CartLine[]): number {
  let sum = 0;
  for (const line of lines) {
    const total = line.cents * line.qty;
    tracker.send('purchase', { sku: line.sku, total });
    sum += total;
  }
  tracker.send('pageview', { path: '/receipt' });
  return sum;
}
