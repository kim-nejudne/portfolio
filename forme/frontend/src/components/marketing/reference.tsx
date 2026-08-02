import { formatInteger, formatMultiplier } from '@/lib/money';
import type { Press, TurnaroundRate } from '@/lib/types';

export function PressList({ presses }: { presses: readonly Press[] }) {
  return (
    <ul className="grid gap-px border border-rule-strong bg-rule-strong lg:grid-cols-3">
      {presses.map((press) => (
        <li key={press.id} className="bg-paper p-4">
          <p className="num text-xl font-semibold tracking-tight">{press.id}</p>
          <h3 className="mt-1 text-md font-semibold tracking-tight">{press.name}</h3>
          <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-y-1 text-xs">
            <dt className="label-caps text-muted">Process</dt>
            <dd className="num">{press.kind === 'litho' ? 'Offset litho' : 'Digital'}</dd>
            <dt className="label-caps text-muted">Units</dt>
            <dd className="num">{press.units}</dd>
            <dt className="label-caps text-muted">Max sheet</dt>
            <dd className="num">{press.maxSheetMm}</dd>
            <dt className="label-caps text-muted">Largest stock</dt>
            <dd className="num">{press.maxSheet}</dd>
            <dt className="label-caps text-muted">Rate</dt>
            <dd className="num">{formatInteger(press.sheetsPerHour)} sph</dd>
          </dl>
          <p className="mt-3 border-t border-rule pt-2 text-xs text-muted">{press.notes}</p>
        </li>
      ))}
    </ul>
  );
}

export function SheetTable() {
  const rows = [
    { sheet: 'SRA3', size: '320 × 450mm', presses: 'INDIGO', up: '21 up business cards, 4 up A5' },
    { sheet: 'B2', size: '500 × 707mm', presses: 'XL75, G40, INDIGO', up: '9 up A5, 4 up A4, 2 up A3' },
    { sheet: 'B1', size: '707 × 1000mm', presses: 'G40', up: '16pp A5 signatures, 8 up A4' },
  ];
  return (
    <table className="w-full border border-rule-strong text-sm">
      <caption className="sr-only">Sheet sizes, the presses that take them and typical up-counts</caption>
      <thead>
        <tr className="border-b-2 border-rule-strong">
          <th scope="col" className="px-3 py-2 text-left label-caps">Sheet</th>
          <th scope="col" className="px-3 py-2 text-left label-caps">Size</th>
          <th scope="col" className="px-3 py-2 text-left label-caps">Presses</th>
          <th scope="col" className="px-3 py-2 text-left label-caps">Typical up-count</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.sheet} className="border-b border-rule last:border-b-0">
            <th scope="row" className="px-3 py-2 text-left num font-semibold">{row.sheet}</th>
            <td className="px-3 py-2 num">{row.size}</td>
            <td className="px-3 py-2 num text-muted">{row.presses}</td>
            <td className="px-3 py-2 text-muted">{row.up}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TurnaroundTable({ turnarounds }: { turnarounds: readonly TurnaroundRate[] }) {
  const detail: Record<string, string> = {
    standard: '5 working days from proof approval',
    express: '3 working days from proof approval',
    rush: '24 hours from proof approval',
  };
  return (
    <table className="w-full border border-rule-strong text-sm">
      <caption className="sr-only">Turnaround options, lead time and price multiplier</caption>
      <thead>
        <tr className="border-b-2 border-rule-strong">
          <th scope="col" className="px-3 py-2 text-left label-caps">Turnaround</th>
          <th scope="col" className="px-3 py-2 text-left label-caps">Lead time</th>
          <th scope="col" className="px-3 py-2 text-right label-caps">Multiplier</th>
        </tr>
      </thead>
      <tbody>
        {turnarounds.map((turnaround) => (
          <tr key={turnaround.id} className="border-b border-rule last:border-b-0">
            <th scope="row" className="px-3 py-2 text-left font-semibold">{turnaround.label}</th>
            <td className="px-3 py-2 num text-muted">{detail[turnaround.id]}</td>
            <td className="px-3 py-2 text-right num">{formatMultiplier(turnaround.multiplier)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StandardsBlock() {
  const rows = [
    { label: 'Bleed', value: '3mm all round' },
    { label: 'Safety margin', value: '4mm from trim' },
    { label: 'Resolution', value: '300ppi effective' },
    { label: 'Colour', value: 'CMYK only' },
    { label: 'Ink limit', value: '300% coated, 260% uncoated' },
    { label: 'Fonts', value: 'All embedded' },
    { label: 'Format', value: 'PDF/X-4' },
  ];
  return (
    <dl className="grid gap-px border border-rule-strong bg-rule-strong sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className="bg-paper px-3 py-2">
          <dt className="label-caps text-muted">{row.label}</dt>
          <dd className="num text-sm">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProductList({ products }: { products: readonly { id: string; label: string; note: string }[] }) {
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {products.map((product) => (
        <li key={product.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
          <span className="text-md">{product.label}</span>
          <span className="num text-xs text-muted">{product.note}</span>
        </li>
      ))}
    </ul>
  );
}
