import { SkeletonBar } from '@/components/furniture/skeletons';

export default function SignInLoading() {
  return (
    <main id="main" className="mx-auto max-w-[34rem] px-4 py-14">
      <SkeletonBar width="10rem" height={10} />
      <div className="mt-4">
        <SkeletonBar width="7rem" height={28} />
      </div>
      <div className="mt-8 space-y-4 border border-rule-strong p-4">
        <SkeletonBar width="100%" height={36} />
        <SkeletonBar width="100%" height={36} />
        <SkeletonBar width="100%" height={36} />
      </div>
      <div className="mt-10 space-y-3 border-2 border-ink p-4">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonBar key={index} width="100%" height={28} />
        ))}
      </div>
    </main>
  );
}
