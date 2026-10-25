import type { Tracker } from 'analytics-lite';

// 1. Declare the global tracker, so that globalThis.tracker is a Tracker.
// 2. Add the purchase event to analytics-lite's EventMap.

export interface CartLine {
  sku: string;
  cents: number;
  qty: number;
}

/** Sends a purchase per line, then a pageview of '/receipt'; returns the total in cents. */
export function checkout(lines: readonly CartLine[]): number {
  throw new Error(`not implemented for ${lines.length} lines`);
}
