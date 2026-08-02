import { SkeletonBar, TableSkeleton } from '@/components/furniture/skeletons';

const COLUMNS = [
  { label: 'Product', width: '30%' },
  { label: 'Setup', width: '18%', align: 'right' as const },
  { label: 'Per 1,000', width: '18%', align: 'right' as const },
  { label: 'Note', width: '34%' },
];

export default function PricingLoading() {
  return (
    <main id="main" className="mx-auto max-w-[100rem] px-4 py-5">
      <div className="border-b-2 border-rule-strong pb-3">
        <p className="label-caps text-muted">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Price matrix</h1>
      </div>
      <div className="mt-6 space-y-8">
        <div>
          <SkeletonBar width="12rem" height={10} />
          <div className="mt-2">
            <TableSkeleton columns={COLUMNS} rows={5} caption="Loading base rates" />
          </div>
        </div>
        <div>
          <SkeletonBar width="12rem" height={10} />
          <div className="mt-2">
            <TableSkeleton columns={COLUMNS} rows={6} caption="Loading stock multipliers" />
          </div>
        </div>
      </div>
    </main>
  );
}
