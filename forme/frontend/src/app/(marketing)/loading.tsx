import { PanelSkeleton, SkeletonBar } from '@/components/furniture/skeletons';

export default function ShopLoading() {
  return (
    <main id="main" className="mx-auto max-w-[72rem] px-4 py-12">
      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-4">
          <SkeletonBar width="14rem" height={12} />
          <SkeletonBar width="100%" height={56} />
          <SkeletonBar width="80%" height={56} />
          <SkeletonBar width="90%" height={10} />
          <SkeletonBar width="86%" height={10} />
        </div>
        <div className="border border-rule-strong p-4">
          <SkeletonBar width="100%" height={420} />
        </div>
      </div>
      <div className="mt-12 grid gap-px border border-rule-strong bg-rule-strong lg:grid-cols-3">
        <div className="bg-paper">
          <PanelSkeleton title="XL75" lines={5} />
        </div>
        <div className="bg-paper">
          <PanelSkeleton title="G40" lines={5} />
        </div>
        <div className="bg-paper">
          <PanelSkeleton title="INDIGO" lines={5} />
        </div>
      </div>
    </main>
  );
}
