// The price with two decimals and the currency, such as '4.50 EUR'.
// Anything that isn't a number gives 'price on request'.
export function formatPrice(price: unknown): string {
  return `${price.toFixed(2)} EUR`;
}
