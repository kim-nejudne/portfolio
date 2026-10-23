// formatPrice has a namespace of the same name: callers write the options type as
// formatPrice.Options and read the defaults as formatPrice.defaults.

/** '4.50 EUR' for 450 cents with the defaults. */
export function formatPrice(
  cents: number,
  options: formatPrice.Options = formatPrice.defaults,
): string {
  return `${(cents / 100).toFixed(options.decimals)} ${options.currency}`;
}

// The namespace comes after the function it merges with, and exports what callers use.
export namespace formatPrice {
  export interface Options {
    currency: string;
    decimals: number;
  }

  export const defaults: Options = { currency: 'EUR', decimals: 2 };
}

const sek: formatPrice.Options = { currency: 'SEK', decimals: 0 };
console.log(formatPrice(450));
console.log(formatPrice(129900, sek));
