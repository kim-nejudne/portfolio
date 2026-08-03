/**
 * The quote lives in the URL, so a quote is a link somebody can send. This is
 * the only place that reads or writes that query string.
 *
 * Coercion is deliberately forgiving — an unknown or missing parameter falls
 * back to the default rather than erroring, because these values arrive from
 * hand-edited URLs and stale bookmarks. Validation of the *coerced* result is
 * a separate step, and it lives in @forme/domain so the API applies the same
 * rules to a POST body that never went near a URL.
 */
import {
  COLOURS,
  DEFAULT_BOOKLET_PAGES,
  DEFAULT_QUOTE_INPUT,
  FINISHES,
  PRODUCTS,
  QUANTITIES,
  SIZES,
  STOCKS,
  TURNAROUNDS,
  validateQuoteInput,
} from '@forme/domain';
import type { QuoteFieldError, QuoteInput } from '@forme/domain';

type Query = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseQuoteInput(query: Query): {
  input: QuoteInput;
  errors: readonly QuoteFieldError[];
} {
  const product = PRODUCTS.find((id) => id === one(query.product)) ?? DEFAULT_QUOTE_INPUT.product;
  const size = SIZES.find((id) => id === one(query.size)) ?? DEFAULT_QUOTE_INPUT.size;
  const stock = STOCKS.find((id) => id === one(query.stock)) ?? DEFAULT_QUOTE_INPUT.stock;
  const colours = COLOURS.find((id) => id === one(query.colours)) ?? DEFAULT_QUOTE_INPUT.colours;
  const turnaround =
    TURNAROUNDS.find((id) => id === one(query.turnaround)) ?? DEFAULT_QUOTE_INPUT.turnaround;

  const rawQuantity = Number.parseInt(one(query.quantity) ?? '', 10);
  const quantity = QUANTITIES.includes(rawQuantity) ? rawQuantity : DEFAULT_QUOTE_INPUT.quantity;

  const finishingParam = query.finishing;
  const rawFinishing = Array.isArray(finishingParam)
    ? finishingParam
    : (finishingParam ?? 'trim').split(',').filter(Boolean);
  const finishing = FINISHES.filter((id) => rawFinishing.includes(id));

  // Page count is only meaningful for booklets, and an unparseable one becomes
  // the default so the form still renders; validateQuoteInput reports the rest.
  let pageCount: number | null = null;
  if (product === 'booklets') {
    const parsed = Number.parseInt(one(query.pages) ?? '', 10);
    pageCount = Number.isFinite(parsed) ? parsed : DEFAULT_BOOKLET_PAGES;
  }

  const input: QuoteInput = {
    product,
    size,
    pageCount,
    stock,
    colours,
    quantity,
    finishing: finishing.length > 0 ? finishing : ['trim'],
    turnaround,
  };

  return { input, errors: validateQuoteInput(input) };
}

export function quoteToQuery(input: QuoteInput): string {
  const params = new URLSearchParams({
    product: input.product,
    size: input.size,
    stock: input.stock,
    colours: input.colours,
    quantity: input.quantity.toString(),
    finishing: input.finishing.join(','),
    turnaround: input.turnaround,
  });
  if (input.pageCount !== null) params.set('pages', input.pageCount.toString());
  return params.toString();
}
