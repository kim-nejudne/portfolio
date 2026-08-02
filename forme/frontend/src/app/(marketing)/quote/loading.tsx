import { PanelSkeleton, SkeletonBar } from '@/components/furniture/skeletons';

export default function QuoteLoading() {
  return (
    <main id="main" className="mx-auto max-w-[72rem] px-4 py-10">
      <SkeletonBar width="22rem" height={12} />
      <div className="mt-4">
        <SkeletonBar width="12rem" height={36} />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div className="border border-rule-strong">
          <div className="border-b-2 border-rule-strong px-4 py-2">
            <SkeletonBar width="8rem" />
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="space-y-2">
                <SkeletonBar width="6rem" height={8} />
                <SkeletonBar width="100%" height={32} />
              </div>
            ))}
          </div>
        </div>
        <PanelSkeleton title="Estimate" lines={10} />
      </div>
    </main>
  );
}
