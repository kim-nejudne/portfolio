import { TableSkeleton } from '@/components/furniture/skeletons';

const COLUMNS = [
  { label: 'Reference', width: '10%' },
  { label: 'Customer', width: '13%' },
  { label: 'Product', width: '10%' },
  { label: 'Qty', width: '6%', align: 'right' as const },
  { label: 'Stock', width: '12%' },
  { label: 'Sheet', width: '5%' },
  { label: 'Sheets', width: '6%', align: 'right' as const },
  { label: 'State', width: '13%' },
  { label: 'In queue', width: '8%', align: 'right' as const },
  { label: 'Due', width: '14%' },
];

export default function QueueLoading() {
  return (
    <main id="main" className="mx-auto max-w-[100rem] px-4 py-5">
      <div className="border-b-2 border-rule-strong pb-3">
        <p className="label-caps text-muted">All customers</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Queue</h1>
      </div>
      <p className="num py-3 text-2xs text-muted">READING QUEUE</p>
      <TableSkeleton columns={COLUMNS} rows={9} caption="Loading the prepress queue" />
    </main>
  );
}
