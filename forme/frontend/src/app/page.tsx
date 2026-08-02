import { formatDate, formatDateTime } from '@/lib/dates';
import { formatInteger, formatPeso } from '@/lib/money';
import { getNow } from '@/lib/api/clock';
import { buildPlan } from '@/lib/api/imposition';
import { getJobs } from '@/lib/api/jobs';
import { quoteFor } from '@/lib/api/quotes';
import type { QuoteInput } from '@/lib/types';

const CASES: readonly QuoteInput[] = [
  { product: 'flyers', size: 'A5', pageCount: null, stock: 'gloss-130', colours: '4/4', quantity: 2500, finishing: ['trim'], turnaround: 'standard' },
  { product: 'business-cards', size: '85x55', pageCount: null, stock: 'uncoated-board-350', colours: '4/4', quantity: 500, finishing: ['trim'], turnaround: 'standard' },
  { product: 'booklets', size: 'A5', pageCount: 48, stock: 'silk-150', colours: '4/4', quantity: 1000, finishing: ['saddle-stitch', 'matt-lam'], turnaround: 'standard' },
  { product: 'posters', size: 'A3', pageCount: null, stock: 'gloss-130', colours: '4/0', quantity: 250, finishing: ['trim'], turnaround: 'rush' },
  { product: 'booklets', size: 'A4', pageCount: 96, stock: 'uncoated-170', colours: '1/1', quantity: 500, finishing: ['perfect-bound'], turnaround: 'standard' },
];

export default async function ArithmeticCheck() {
  const jobs = await getJobs();
  const plan = buildPlan(
    { sheetId: 'B1', sizeId: 'A5', scheme: '16pp', binding: 'saddle-stitch', workStyle: 'sheetwise', gripperMm: 10, creepMm: 0.6, pageCount: 48, quantity: 1000 },
    148,
    210,
  );
  const flat = buildPlan(
    { sheetId: 'SRA3', sizeId: '85x55', scheme: '4pp', binding: 'none', workStyle: 'sheetwise', gripperMm: 10, creepMm: 0, pageCount: 1, quantity: 500 },
    85,
    55,
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 num text-sm">
      <h1 className="text-lg">ARITHMETIC CHECK — {formatDateTime(getNow())}</h1>
      <ul className="mt-4 space-y-2">
        {CASES.map((input) => {
          const quote = quoteFor(input, getNow());
          return (
            <li key={`${input.product}-${input.quantity}-${input.pageCount ?? 0}`} className="border-b border-rule pb-2">
              {input.product} {input.size} {input.pageCount ?? '-'}pp q{input.quantity} {input.colours} {input.turnaround} | unit {formatPeso(quote.unitPrice)} sub {formatPeso(quote.subtotal)} vat {formatPeso(quote.vat)} total {formatPeso(quote.total)} | {quote.press} {quote.sheetId} up {quote.upCount} sheets {formatInteger(quote.sheetsRequired)} waste {quote.wasteSheets} | despatch {formatDate(quote.despatchAt)}
              <div className="text-muted">{quote.pressReason}</div>
            </li>
          );
        })}
      </ul>
      <h2 className="mt-8">IMPOSITION 16pp A5 on B1</h2>
      <p>
        fits={String(plan.fits)} up={plan.upCount} cols={plan.cols} rows={plan.rows} sigs={plan.signatures} sheets={formatInteger(plan.sheetsRequired)} waste={plan.wasteSheets}
      </p>
      <p className="text-muted">{plan.fitNote}</p>
      <p>front: {plan.forms[0].pages.map((p) => p.label).join(' ')}</p>
      <p>back: {plan.forms[1] ? plan.forms[1].pages.map((p) => p.label).join(' ') : '-'}</p>
      <p>folds: {plan.foldSequence.join(' / ')}</p>
      <h2 className="mt-8">STEP AND REPEAT 85 × 55 on SRA3</h2>
      <p>
        fits={String(flat.fits)} up={flat.upCount} cols={flat.cols} rows={flat.rows} sheets={flat.sheetsRequired} waste={flat.wasteSheets}
      </p>
      <h2 className="mt-8">JOBS {jobs.length}</h2>
      <ul>
        {jobs.map((job) => (
          <li key={job.reference}>
            {job.reference} {job.state} {job.owner} p{job.progress} due {formatDate(job.dueAt)} {formatPeso(job.quote.total)} {job.quote.press} {job.customer.shortName}
          </li>
        ))}
      </ul>
    </main>
  );
}
