import { quoteToQuery } from '@/lib/quote-url';
import type { QuoteInput, QuoteResult } from '@forme/domain';
import { apiFetch } from './client';

/**
 * The API is the authority on price. The web app could compute this locally
 * from @forme/domain — and the imposition planner does exactly that for its
 * live SVG — but a quote is a number a customer acts on, so it comes from the
 * same place the charge would.
 */
export async function getQuote(input: QuoteInput): Promise<QuoteResult | null> {
  const { quote } = await apiFetch<{ quote: QuoteResult | null }>(
    `/quotes?${quoteToQuery(input)}`,
    { authenticated: false },
  );
  return quote;
}
