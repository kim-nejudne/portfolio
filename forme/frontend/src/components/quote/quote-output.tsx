import Link from 'next/link';
import { ColourBar } from '@/components/furniture/marks';
import { StatusMark } from '@/components/furniture/status-mark';
import { formatDate, formatWeekday } from '@forme/domain';
import { VAT_PERCENT, formatInteger, formatPeso } from '@forme/domain';
import type { QuoteInput, QuoteResult } from '@forme/domain';

function Row({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 px-4 py-2 ${strong ? 'border-t-2 border-ink' : 'border-t border-rule'}`}
    >
      <span className={`label-caps ${muted ? 'text-muted' : ''}`}>{label}</span>
      <span className={`num tabular-nums ${strong ? 'text-xl' : 'text-sm'}`}>{value}</span>
    </div>
  );
}

export function QuoteOutput({
  quote,
  query,
  input,
}: {
  quote: QuoteResult;
  query: string;
  input: QuoteInput;
}) {
  return (
    <section aria-labelledby="quote-output" className="border-2 border-ink" data-testid="quote-output">
      <div className="flex items-center justify-between border-b-2 border-ink px-4 py-2">
        <h2 id="quote-output" className="label-caps">
          Estimate
        </h2>
        <StatusMark owner="system" label="Calculated" testId="quote-automated-mark" />
      </div>

      <Row label="Unit price, ex VAT" value={formatPeso(quote.unitPrice)} muted />
      <Row label="Subtotal" value={formatPeso(quote.subtotal)} />
      <Row label={`VAT ${VAT_PERCENT}%`} value={formatPeso(quote.vat)} muted />
      <Row label="Total" value={formatPeso(quote.total)} strong />

      <div className="border-t-2 border-ink px-4 py-3">
        <p className="label-caps text-muted">Press assignment</p>
        <p className="num mt-1 text-2xl">{quote.press}</p>
        <p className="mt-2 text-sm" data-testid="press-reason">
          {quote.pressReason}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-px border-t border-rule bg-rule">
        <div className="bg-paper px-4 py-2">
          <dt className="label-caps text-muted">Sheet</dt>
          <dd className="num text-sm">{quote.sheetId}</dd>
        </div>
        <div className="bg-paper px-4 py-2">
          <dt className="label-caps text-muted">
            {quote.scheme === null ? 'Up per sheet' : 'Pages per sheet'}
          </dt>
          <dd className="num text-sm">{quote.upCount}</dd>
        </div>
        <div className="bg-paper px-4 py-2">
          <dt className="label-caps text-muted">Sheets required</dt>
          <dd className="num text-sm" data-testid="quote-sheets">
            {formatInteger(quote.sheetsRequired)}
          </dd>
        </div>
        <div className="bg-paper px-4 py-2">
          <dt className="label-caps text-muted">Waste allowance</dt>
          <dd className="num text-sm">{formatInteger(quote.wasteSheets)}</dd>
        </div>
      </dl>

      <div className="border-t border-rule px-4 py-3">
        <p className="label-caps text-muted">Despatch</p>
        <p className="num mt-1 text-lg" data-testid="quote-despatch">
          {formatWeekday(quote.despatchAt)} {formatDate(quote.despatchAt)}
        </p>
        <p className="mt-1 text-xs text-muted">
          From proof approval, not from upload. Sundays are skipped.
        </p>
      </div>

      <ul className="space-y-1 border-t border-rule px-4 py-3 text-xs text-muted">
        {quote.notes.map((note) => (
          <li key={note} className="flex gap-2">
            <span aria-hidden="true" className="num">
              —
            </span>
            <span>{note}</span>
          </li>
        ))}
      </ul>

      <div className="border-t-2 border-ink px-4 py-3">
        <ColourBar height={8} />
        <Link
          href={`/app/new?${query}`}
          data-testid="quote-to-intake"
          className="mt-3 block border border-ink px-4 py-2 text-center label-caps transition-colors duration-100 hover:bg-ink hover:text-paper"
        >
          Submit this job
        </Link>
        <p className="mt-2 text-xs text-muted">
          {formatInteger(input.quantity)} × {input.size}, {input.colours},{' '}
          {input.turnaround}. Carried through to the intake form.
        </p>
      </div>
    </section>
  );
}
