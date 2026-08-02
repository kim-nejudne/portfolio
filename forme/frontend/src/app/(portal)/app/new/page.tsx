import type { Metadata } from 'next';
import { IntakePanel } from '@/components/intake/intake-panel';
import { QuoteForm } from '@/components/quote/quote-form';
import { getPriceMatrix } from '@/lib/api/pricing';
import { getQuote, parseQuoteInput } from '@/lib/api/quotes';
import { formatDate } from '@/lib/dates';
import { VAT_PERCENT, formatInteger, formatPeso } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Submit a job',
  robots: { index: false, follow: false },
};

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const { input, errors } = parseQuoteInput(query);
  const [matrix, quote] = await Promise.all([getPriceMatrix(), getQuote(input)]);
  const description = typeof query.description === 'string' ? query.description : '';

  const summary: readonly { label: string; value: string }[] = [
    { label: 'Press', value: quote.press },
    { label: 'Sheet', value: quote.sheetId },
    { label: 'Sheets', value: formatInteger(quote.sheetsRequired) },
    { label: 'Subtotal', value: formatPeso(quote.subtotal) },
    { label: `VAT ${VAT_PERCENT}%`, value: formatPeso(quote.vat) },
    { label: 'Total', value: formatPeso(quote.total) },
    { label: 'Despatch', value: formatDate(quote.despatchAt) },
  ];

  return (
    <main id="main" className="mx-auto max-w-[90rem] px-4 py-6">
      <div className="border-b-2 border-rule-strong pb-3">
        <p className="label-caps text-muted">Intake · Nine Dots Studio</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Submit a job</h1>
        <p className="mt-2 max-w-[70ch] text-sm text-muted">
          Confirm the specification, then drop the artwork. Preflight runs on arrival and the
          twelve checks land one at a time. You can submit with failures outstanding — they stop the
          job at proofing, not at intake.
        </p>
      </div>

      <dl
        className="mt-4 grid gap-px border border-rule-strong bg-rule-strong sm:grid-cols-4 lg:grid-cols-7"
        data-testid="intake-estimate"
      >
        {summary.map((item) => (
          <div key={item.label} className="bg-paper px-3 py-2">
            <dt className="label-caps text-muted">{item.label}</dt>
            <dd className="num text-sm">{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">{quote.pressReason}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
        <QuoteForm
          input={input}
          matrix={matrix}
          errors={errors}
          action="/app/new"
          submitLabel="Update estimate"
        />
        <IntakePanel input={input} description={description} />
      </div>
    </main>
  );
}
