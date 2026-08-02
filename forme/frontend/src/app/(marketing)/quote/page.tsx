import type { Metadata } from 'next';
import { QuoteForm } from '@/components/quote/quote-form';
import { QuoteOutput } from '@/components/quote/quote-output';
import { getPriceMatrix } from '@/lib/api/pricing';
import { getQuote, parseQuoteInput, quoteToQuery } from '@/lib/api/quotes';

export const metadata: Metadata = {
  title: 'Instant quote — litho and digital, priced in whole pesos',
  description:
    'Price a print job in whole pesos: product, size, stock, colours, quantity, finishing and turnaround. The quote states the press, the sheet count and the despatch date, and the whole quote lives in the URL.',
  alternates: { canonical: '/quote' },
};

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const { input, errors } = parseQuoteInput(query);
  const [matrix, quote] = await Promise.all([getPriceMatrix(), getQuote(input)]);
  const canonical = quoteToQuery(input);

  return (
    <main id="main" className="mx-auto max-w-[72rem] px-4 py-10">
      <p className="label-caps text-muted">Instant quote · whole pesos · VAT shown separately</p>
      <h1 className="mt-3 text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
        Price a job
      </h1>
      <p className="mt-4 max-w-[70ch] text-md">
        Every figure below is calculated from the same price matrix the shop runs on. The press is
        assigned by sheet count and the reason is written out. Change anything and the address bar
        changes with it, so a quote is a link you can send to whoever signs it off.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <QuoteForm input={input} matrix={matrix} errors={errors} />
        <div className="lg:sticky lg:top-6">
          <QuoteOutput quote={quote} query={canonical} input={input} />
          <p className="mt-3 break-all border border-rule px-3 py-2 num text-2xs text-muted">
            /quote?{canonical}
          </p>
        </div>
      </div>
    </main>
  );
}
