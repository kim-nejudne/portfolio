import type { Metadata } from 'next';
import { PricingMatrix } from '@/components/admin/pricing-matrix';
import { getPriceMatrix } from '@/lib/api/pricing';

export const metadata: Metadata = {
  title: 'Price matrix',
  robots: { index: false, follow: false },
};

export default async function PricingPage() {
  const matrix = await getPriceMatrix();

  return (
    <main id="main" className="mx-auto max-w-[100rem] px-4 py-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-rule-strong pb-3">
        <div>
          <p className="label-caps text-muted">Admin · drives every quote</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Price matrix</h1>
        </div>
        <p className="max-w-[52ch] text-xs text-muted">
          Money is whole pesos. Multipliers are per-mille integers, so 1060 reads as 1.060× and a
          rush at 1800 reads as 1.800×. Edits save on blur and take effect on the next quote.
          Arrow keys move between cells, Enter commits.
        </p>
      </div>

      <div className="mt-6">
        <PricingMatrix matrix={matrix} />
      </div>

      <p className="mt-8 border-t border-rule pt-3 text-xs text-muted">
        VAT is 12% and is applied to the subtotal at quote time. It is never folded into a unit
        price and it is not editable here.
      </p>
    </main>
  );
}
