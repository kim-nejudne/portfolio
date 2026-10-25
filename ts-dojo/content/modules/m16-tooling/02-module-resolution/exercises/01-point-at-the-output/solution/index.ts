import { applyDiscount } from './lib/discount.js';
import { formatPrice } from './lib/format.js';

export function priceLine(
  name: string,
  cents: number,
  percent: number,
): string {
  return `${name}: ${formatPrice(applyDiscount(cents, percent))}`;
}
