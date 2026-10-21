export type Currency = 'EUR' | 'USD' | 'SEK';

/** The amount with two decimals and the currency, such as '3.50 SEK'. */
export function formatPrice(
  amount: number | string,
  currency: Currency,
): string {
  return `${Number(amount).toFixed(2)} ${currency}`;
}

export let defaultCurrency: Currency = 'EUR';

export const sample = formatPrice(5, defaultCurrency);
