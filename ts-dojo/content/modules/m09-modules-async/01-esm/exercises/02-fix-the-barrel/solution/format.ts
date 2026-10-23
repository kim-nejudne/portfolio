// Formatting amounts for display. This file is right as it is: leave it alone.
import type { Currency, Money } from './money';

export interface FormatOptions {
  /** Write the currency's symbol (€12.50) instead of its code (12.50 EUR). */
  symbol: boolean;
}

const SYMBOLS: Record<Currency, string> = { EUR: '€', USD: '$' };

export function format(amount: Money, options: FormatOptions): string {
  const sign = amount.cents < 0 ? '-' : '';
  const digits = (Math.abs(amount.cents) / 100).toFixed(2);
  return options.symbol
    ? `${sign}${SYMBOLS[amount.currency]}${digits}`
    : `${sign}${digits} ${amount.currency}`;
}
