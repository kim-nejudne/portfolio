import { PanelSkeleton, SkeletonBar } from '@/components/furniture/skeletons';

export default function JobDetailLoading() {
  return (
    <main id="main" className="mx-auto max-w-[90rem] px-4 py-6">
      <div className="space-y-3 border-b-2 border-rule-strong pb-4">
        <SkeletonBar width="18rem" height={10} />
        <SkeletonBar width="11rem" height={26} />
        <SkeletonBar width="26rem" height={12} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[17rem_minmax(0,1fr)_19rem]">
        <PanelSkeleton title="State" lines={10} />
        <div className="space-y-6">
          <PanelSkeleton title="Proof sheet" lines={12} />
          <PanelSkeleton title="Preflight report" lines={12} />
        </div>
        <div className="space-y-6">
          <PanelSkeleton title="Specification" lines={13} />
          <PanelSkeleton title="Files" lines={3} />
        </div>
      </div>
    </main>
  );
}
