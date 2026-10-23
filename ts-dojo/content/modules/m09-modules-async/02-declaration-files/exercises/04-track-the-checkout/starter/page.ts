// Stands in for the page: analytics-lite's script defines tracker before checkout.ts runs.
// Here it only logs what it is sent. This file is right as it is: leave it alone.
import type { Tracker } from 'analytics-lite';
import { checkout } from './checkout';

const logger: Tracker = {
  send: (name, data) => console.log('send', name, data),
};
Object.assign(globalThis, { tracker: logger });

const total = checkout([
  { sku: 'TEA-1', cents: 450, qty: 2 },
  { sku: 'MUG-2', cents: 1200, qty: 1 },
]);
console.log('total', total);
