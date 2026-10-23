import { applyDiscount } from './lib/discount.ts';
import { formatPrice } from './lib/format.ts';

export function priceLine(
  name: string,
  cents: number,
  percent: number,
): string {
  return `${name}: ${formatPrice(applyDiscount(cents, percent))}`;
}
