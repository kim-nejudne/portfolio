import { PanelSkeleton, SkeletonBar } from '@/components/furniture/skeletons';

export default function NewJobLoading() {
  return (
    <main id="main" className="mx-auto max-w-[90rem] px-4 py-6">
      <div className="space-y-3 border-b-2 border-rule-strong pb-3">
        <SkeletonBar width="14rem" height={10} />
        <SkeletonBar width="12rem" height={26} />
      </div>
      <div className="mt-4 grid gap-px border border-rule-strong bg-rule-strong lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="bg-paper px-3 py-2">
            <SkeletonBar width="70%" height={8} />
            <div className="mt-2">
              <SkeletonBar width="90%" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <PanelSkeleton title="Specification" lines={12} />
        <PanelSkeleton title="Artwork" lines={12} />
      </div>
    </main>
  );
}
