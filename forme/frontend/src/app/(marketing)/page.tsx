import type { Metadata } from 'next';
import Link from 'next/link';
import { HeroSheet } from '@/components/marketing/hero-sheet';
import {
  PressList,
  ProductList,
  SheetTable,
  StandardsBlock,
  TurnaroundTable,
} from '@/components/marketing/reference';
import { TickRule } from '@/components/furniture/marks';
import { getPresses } from '@/lib/api/presses';
import { getPriceMatrix } from '@/lib/api/pricing';

export const metadata: Metadata = {
  title: 'FORME — trade litho and digital printing, Manila',
  description:
    'FORME is a trade printer in Manila. Heidelberg Speedmaster XL 75, Komori Lithrone G40 and HP Indigo 12000. Five working days from proof approval, three on express, 24 hours on rush.',
  alternates: { canonical: '/' },
};

export default async function ShopPage() {
  const [presses, matrix] = await Promise.all([getPresses(), getPriceMatrix()]);

  return (
    <main id="main" className="mx-auto max-w-[72rem] px-4">
      <section className="grid gap-10 border-b-2 border-rule-strong py-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div>
          <p className="label-caps text-muted">Trade printer · Manila · Established 2009</p>
          <h1 className="mt-4 text-[clamp(2.5rem,6vw,4rem)] font-semibold leading-[0.95] tracking-[-0.02em]">
            A forme is the moment<br />a job stops changing.
          </h1>
          <p className="mt-6 max-w-[46ch] text-md">
            We print for design studios, publishers and agencies. Litho on two presses, digital on
            one, and a preflight report on every file before it goes anywhere near a plate. You
            supply PDF/X-4 with 3mm bleed. We supply the sheet, the imposition and the date.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/quote"
              data-testid="cta-quote"
              className="border border-ink px-5 py-3 label-caps transition-colors duration-100 hover:bg-ink hover:text-paper"
            >
              Price a job now
            </Link>
            <Link
              href="/specs"
              data-testid="cta-specs"
              className="border border-rule-strong px-5 py-3 label-caps text-muted transition-colors duration-100 hover:border-ink hover:text-ink"
            >
              Artwork specification
            </Link>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-px border border-rule-strong bg-rule-strong sm:grid-cols-4">
            {[
              { label: 'Presses', value: '3' },
              { label: 'Largest sheet', value: 'B1' },
              { label: 'Standard', value: '5 days' },
              { label: 'Rush', value: '24 hours' },
            ].map((item) => (
              <div key={item.label} className="bg-paper px-3 py-3">
                <dt className="label-caps text-muted">{item.label}</dt>
                <dd className="num text-xl">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <HeroSheet />
      </section>

      <section aria-labelledby="presses" className="border-b-2 border-rule-strong py-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="presses" className="text-xl font-semibold tracking-tight">
            The presses
          </h2>
          <p className="num text-xs text-muted">Two shifts · 07:00–19:00 · six days</p>
        </div>
        <p className="mt-3 max-w-[70ch] text-muted">
          The press is chosen by quantity, not by preference. Under 500 sheets a litho make-ready
          costs more than the run, so the job goes digital. At 500 sheets and over, litho is
          cheaper per sheet and stays cheaper. The quote tells you which press and why.
        </p>
        <div className="mt-6">
          <PressList presses={presses} />
        </div>
      </section>

      <section aria-labelledby="sheets" className="grid gap-10 border-b-2 border-rule-strong py-12 lg:grid-cols-2">
        <div>
          <h2 id="sheets" className="text-xl font-semibold tracking-tight">
            Sheet sizes
          </h2>
          <p className="mt-3 text-muted">
            Three sheet sizes cover everything we run. The imposition planner picks the smallest
            sheet that gives the fewest sheets for the quantity.
          </p>
          <div className="mt-6">
            <SheetTable />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Turnaround</h2>
          <p className="mt-3 text-muted">
            Every lead time runs from proof approval, not from the day you send the file. The shop
            is closed on Sundays and working days skip it.
          </p>
          <div className="mt-6">
            <TurnaroundTable turnarounds={matrix.turnarounds} />
          </div>
        </div>
      </section>

      <section aria-labelledby="work" className="grid gap-10 border-b-2 border-rule-strong py-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 id="work" className="text-xl font-semibold tracking-tight">
            What we print
          </h2>
          <p className="mt-3 text-muted">
            Trade work only. No retail, no design service, no stock artwork. If it is not on this
            list, send the specification and we will quote it by hand.
          </p>
          <div className="mt-6">
            <ProductList products={matrix.products} />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Standards</h2>
          <p className="mt-3 text-muted">
            Twelve automated checks run on every file within a minute of upload. Any failure stops
            the job at preflight until prepress overrides it with a written reason.
          </p>
          <div className="mt-6">
            <StandardsBlock />
          </div>
          <div className="mt-6">
            <TickRule ticks={40} />
          </div>
          <p className="mt-4 text-xs text-muted">
            The full specification, with the export settings for InDesign and Illustrator, is on{' '}
            <Link className="border-b border-ink pb-0.5 text-ink" href="/specs">
              the artwork specification page
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
