import { SkeletonBar } from '@/components/furniture/skeletons';

export default function SpecsLoading() {
  return (
    <main id="main" className="mx-auto max-w-[72rem] px-4 py-10">
      <SkeletonBar width="18rem" height={12} />
      <div className="mt-4">
        <SkeletonBar width="26rem" height={44} />
      </div>
      <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_1fr]">
        <div className="space-y-3">
          {Array.from({ length: 9 }, (_, index) => (
            <SkeletonBar key={index} width="85%" />
          ))}
        </div>
        <div className="max-w-[76ch] space-y-8">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="space-y-3">
              <SkeletonBar width="40%" height={16} />
              <SkeletonBar width="96%" />
              <SkeletonBar width="92%" />
              <SkeletonBar width="70%" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
