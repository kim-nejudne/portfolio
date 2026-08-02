/**
 * One place that knows how money is written.
 *
 * Prices are stored as whole pesos (`menu_items.price` is an INTEGER), so there
 * are no minor units to render and `maximumFractionDigits: 0` keeps the menu
 * free of a trailing `.00` that would only add noise to a typeset price.
 *
 * The grouping separator is the reason this helper exists at all. At the old
 * GBP magnitudes a bare `£{price}` was fine; at peso magnitudes a four- and
 * five-figure price is unreadable without it — `₱10150` versus `₱10,150`.
 */

export const CURRENCY = 'PHP';
export const CURRENCY_SYMBOL = '₱';

const formatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

/**
 * Render a whole-peso amount for display, e.g. `10150` → `₱10,150`.
 *
 * Non-finite values render as an em dash rather than `₱NaN`: the staff menu
 * editor binds a partially-typed price field straight to this, and a dash is a
 * calmer thing to show mid-keystroke than a broken number.
 */
export function formatPrice(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return '—';
  return formatter.format(price);
}
