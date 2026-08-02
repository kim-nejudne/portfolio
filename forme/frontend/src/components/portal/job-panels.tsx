import { ColourBar } from '@/components/furniture/marks';
import { formatDateTime } from '@/lib/dates';
import { VAT_PERCENT, formatInteger, formatPeso } from '@/lib/money';
import type { Job, PriceMatrix } from '@/lib/types';

function labelFor<T extends { id: string; label: string }>(
  rows: readonly T[],
  id: string,
): string {
  return rows.find((row) => row.id === id)?.label ?? id;
}

export function JobSpecPanel({ job, matrix }: { job: Job; matrix: PriceMatrix }) {
  const spec = job.spec;
  const rows: readonly { label: string; value: string }[] = [
    { label: 'Product', value: labelFor(matrix.products, spec.product) },
    { label: 'Finished size', value: labelFor(matrix.sizes, spec.size) },
    { label: 'Extent', value: spec.pageCount === null ? 'Single sheet' : `${spec.pageCount}pp` },
    { label: 'Stock', value: labelFor(matrix.stocks, spec.stock) },
    { label: 'Colours', value: spec.colours },
    { label: 'Quantity', value: formatInteger(spec.quantity) },
    {
      label: 'Finishing',
      value: spec.finishing.map((id) => labelFor(matrix.finishing, id)).join(', '),
    },
    { label: 'Turnaround', value: labelFor(matrix.turnarounds, spec.turnaround) },
    { label: 'Press', value: job.quote.press },
    { label: 'Sheet', value: job.quote.sheetId },
    {
      label: job.quote.scheme === null ? 'Up per sheet' : 'Pages per sheet',
      value: job.quote.upCount.toString(),
    },
    { label: 'Sheets required', value: formatInteger(job.quote.sheetsRequired) },
    { label: 'Waste allowance', value: formatInteger(job.quote.wasteSheets) },
  ];

  return (
    <section aria-labelledby="spec" className="border border-rule-strong">
      <h2 id="spec" className="label-caps border-b-2 border-rule-strong px-3 py-2">
        Specification
      </h2>
      <dl className="num grid grid-cols-[8.5rem_1fr] gap-y-1 px-3 py-3 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="label-caps text-muted">{row.label}</dt>
            <dd className="break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-rule px-3 py-3">
        <dl className="num text-xs">
          <div className="flex justify-between">
            <dt className="label-caps text-muted">Subtotal</dt>
            <dd>{formatPeso(job.quote.subtotal)}</dd>
          </div>
          <div className="mt-1 flex justify-between">
            <dt className="label-caps text-muted">VAT {VAT_PERCENT}%</dt>
            <dd>{formatPeso(job.quote.vat)}</dd>
          </div>
          <div className="mt-2 flex justify-between border-t-2 border-ink pt-2">
            <dt className="label-caps">Total</dt>
            <dd className="text-md">{formatPeso(job.quote.total)}</dd>
          </div>
        </dl>
      </div>
      <div className="border-t border-rule px-3 py-2">
        <ColourBar height={6} />
      </div>
    </section>
  );
}

function sizeLabel(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `${Math.round(bytes / 100_000) / 10} MB`;
}

export function FileListPanel({ job }: { job: Job }) {
  return (
    <section aria-labelledby="files" className="border border-rule-strong">
      <h2 id="files" className="label-caps border-b-2 border-rule-strong px-3 py-2">
        Files
      </h2>
      {job.files.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted" data-testid="empty-state">
          No artwork yet. Upload PDF/X-4 from the job submission screen and preflight runs on
          arrival.
        </p>
      ) : (
        <table className="w-full table-fixed text-xs">
          <caption className="sr-only">Files held against this job</caption>
          <thead>
            <tr className="border-b border-rule">
              <th scope="col" className="px-3 py-1.5 text-left label-caps">
                Name
              </th>
              <th scope="col" className="w-[4rem] px-3 py-1.5 text-left label-caps">
                Kind
              </th>
              <th scope="col" className="w-[5.5rem] px-3 py-1.5 text-right label-caps">
                Size
              </th>
            </tr>
          </thead>
          <tbody>
            {job.files.map((file) => (
              <tr key={file.name} className="border-b border-rule last:border-b-0">
                <td className="truncate px-3 py-1.5 num" title={file.name}>
                  {file.name}
                </td>
                <td className="px-3 py-1.5 num text-muted">{file.kind}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right num">
                  {sizeLabel(file.bytes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {job.files.length > 0 ? (
        <p className="num border-t border-rule px-3 py-1.5 text-2xs text-muted">
          Last arrival {formatDateTime(job.files[job.files.length - 1].at)}
        </p>
      ) : null}
    </section>
  );
}
