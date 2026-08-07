import { TableSkeleton } from '@/components/furniture/skeletons';

const COLUMNS = [
  { label: 'Reference', width: '12%' },
  { label: 'Description', width: '28%' },
  { label: 'Quantity', width: '8%', align: 'right' as const },
  { label: 'Stock', width: '15%' },
  { label: 'State', width: '15%' },
  { label: 'Due', width: '12%' },
  { label: 'Progress', width: '10%' },
];

export default function JobListLoading() {
  return (
    <main id="main" className="mx-auto max-w-[90rem] px-4 py-6">
      <div className="border-b-2 border-rule-strong pb-3">
        <p className="label-caps text-muted">Nine Dots Studio · account ND-063</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Jobs</h1>
      </div>
      <p className="num py-3 text-2xs text-muted">READING JOB LIST</p>
      <TableSkeleton columns={COLUMNS} rows={10} caption="Loading the job list" />
    </main>
  );
}
