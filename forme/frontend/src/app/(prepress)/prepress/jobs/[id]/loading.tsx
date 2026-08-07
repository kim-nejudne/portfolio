import { PanelSkeleton, SkeletonBar } from '@/components/furniture/skeletons';

export default function PrepressJobLoading() {
  return (
    <main id="main" className="mx-auto max-w-[100rem] px-4 py-5">
      <div className="space-y-3 border-b-2 border-rule-strong pb-3">
        <SkeletonBar width="22rem" height={10} />
        <SkeletonBar width="11rem" height={26} />
      </div>
      <div className="mt-5 grid gap-6 xl:grid-cols-2">
        <PanelSkeleton title="Preflight report" lines={14} />
        <PanelSkeleton title="Imposition planner" lines={14} />
      </div>
    </main>
  );
}
