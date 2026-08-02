import type { Metadata } from 'next';
import Link from 'next/link';
import { BleedDiagram } from '@/components/marketing/bleed-diagram';
import { getPreflightReport } from '@/lib/api/preflight';

export const metadata: Metadata = {
  title: 'Artwork specification — bleed, resolution, ink limit and PDF/X-4',
  description:
    'FORME artwork specification: 3mm bleed, 4mm safety margin, 300ppi effective resolution, CMYK only, 300% ink limit on coated and 260% on uncoated, all fonts embedded, PDF/X-4. Includes InDesign and Illustrator export settings.',
  alternates: { canonical: '/specs' },
  keywords: [
    'artwork specification',
    'PDF/X-4 export',
    'bleed and safety margin',
    'total area coverage',
    'trade printer Manila',
  ],
};

const SECTIONS = [
  { id: 'trim', label: 'Trim, bleed and safety' },
  { id: 'resolution', label: 'Resolution' },
  { id: 'colour', label: 'Colour and ink limit' },
  { id: 'fonts', label: 'Fonts' },
  { id: 'pages', label: 'Page count' },
  { id: 'naming', label: 'File naming' },
  { id: 'pdfx4', label: 'PDF/X-4 export' },
  { id: 'checks', label: 'The twelve checks' },
  { id: 'summary', label: 'Specification summary' },
];

export default async function SpecsPage() {
  const report = await getPreflightReport('PF-CLEAN');
  const checks = report ? report.checks : [];

  return (
    <main id="main" className="mx-auto max-w-[72rem] px-4 py-10">
      <p className="label-caps text-muted">Specification · revision 6 · issued 01 Jul 2026</p>
      <h1 className="mt-3 max-w-[30ch] text-[clamp(2rem,4.5vw,3rem)] font-semibold leading-[1] tracking-[-0.02em]">
        Artwork specification
      </h1>
      <p className="mt-5 max-w-[70ch] text-md">
        Supply PDF/X-4. One file per job, pages in reading order, single pages rather than spreads.
        Every number on this page is a tolerance the preflight report measures against, so a file
        that meets it will pass without a phone call.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_1fr] lg:gap-14">
        <nav aria-label="Specification sections" className="lg:sticky lg:top-6 lg:self-start">
          <p className="label-caps border-b-2 border-rule-strong pb-2 text-muted">On this page</p>
          <ol className="mt-3 space-y-2">
            {SECTIONS.map((section, index) => (
              <li key={section.id} className="flex gap-3">
                <span className="num text-2xs text-muted">{(index + 1).toString().padStart(2, '0')}</span>
                <a href={`#${section.id}`} className="text-sm hover:border-b hover:border-ink">
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="max-w-[76ch] space-y-12">
          <section id="trim" className="scroll-mt-6">
            <h2 className="border-b-2 border-rule-strong pb-2 text-xl font-semibold tracking-tight">
              Trim, bleed and safety
            </h2>
            <div className="mt-5 grid gap-6 md:grid-cols-[1fr_16rem]">
              <div className="space-y-4">
                <p>
                  The trim box is the finished size. Bleed is <span className="num">3mm</span>{' '}
                  outside it on all four edges, so an A5 page is supplied at{' '}
                  <span className="num">154 × 216mm</span> with the trim box set to{' '}
                  <span className="num">148 × 210mm</span>. Any image or panel of colour that
                  reaches the edge of the page must run the full 3mm out.
                </p>
                <p>
                  The safety margin is <span className="num">4mm</span> inside the trim. Folios,
                  captions, rules and anything else that must not be cut sit inside it. A guillotine
                  holds to <span className="num">±0.5mm</span> on a good lift and{' '}
                  <span className="num">±1mm</span> across a full run, and a saddle-stitched
                  section moves more than a flat sheet.
                </p>
                <p>
                  Do not supply crop marks inside the bleed box. We add marks at imposition.
                </p>
              </div>
              <BleedDiagram />
            </div>
          </section>

          <section id="resolution" className="scroll-mt-6">
            <h2 className="border-b-2 border-rule-strong pb-2 text-xl font-semibold tracking-tight">
              Resolution
            </h2>
            <p className="mt-5">
              <span className="num">300ppi</span> effective at final placed size. Effective, not
              native: a <span className="num">300ppi</span> image scaled to{' '}
              <span className="num">200%</span> is <span className="num">150ppi</span> on the
              sheet and will show. Line art and scanned type want{' '}
              <span className="num">1200ppi</span> bitmap. Anything under{' '}
              <span className="num">300ppi</span> is a warning, not a failure — it prints, it just
              prints soft, and the warning goes on the proof so nobody is surprised.
            </p>
          </section>

          <section id="colour" className="scroll-mt-6">
            <h2 className="border-b-2 border-rule-strong pb-2 text-xl font-semibold tracking-tight">
              Colour and ink limit
            </h2>
            <div className="mt-5 space-y-4">
              <p>
                CMYK only. RGB and Lab objects are a failure, not a conversion request — we will
                not guess at an intent for you. Convert with{' '}
                <span className="num">ISO Coated v2 (ECI)</span> for coated stock and{' '}
                <span className="num">PSO Uncoated v3 (FOGRA52)</span> for uncoated.
              </p>
              <p>
                Total area coverage is capped at <span className="num">300%</span> on coated stock
                and <span className="num">260%</span> on uncoated. A four-colour black built at{' '}
                <span className="num">60/50/50/100</span> comes to{' '}
                <span className="num">260%</span> and holds everywhere. Small black type is{' '}
                <span className="num">100% K</span> only.
              </p>
              <p>
                Name your spots. An unnamed separation called “Colour 1” is a warning because we
                cannot tell whether it is a fifth ink or a mistake.
              </p>
            </div>
          </section>

          <section id="fonts" className="scroll-mt-6">
            <h2 className="border-b-2 border-rule-strong pb-2 text-xl font-semibold tracking-tight">
              Fonts
            </h2>
            <p className="mt-5">
              Every font embedded, subset or full. Unembedded fonts are a failure: the RIP
              substitutes and the line breaks move. Outlining type is acceptable but not
              preferred — it costs us the ability to fix a typo without a resupply, and hairline
              strokes below <span className="num">0.25pt</span> will not hold once outlined.
            </p>
          </section>

          <section id="pages" className="scroll-mt-6">
            <h2 className="border-b-2 border-rule-strong pb-2 text-xl font-semibold tracking-tight">
              Page count
            </h2>
            <p className="mt-5">
              Booklet page counts are multiples of four because a signature is folded from a sheet
              printed both sides. <span className="num">24pp</span> is three{' '}
              <span className="num">8pp</span> sections or one <span className="num">16pp</span>{' '}
              plus one <span className="num">8pp</span>. Supply blank pages as blank pages; do not
              leave them out and expect us to count.
            </p>
          </section>

          <section id="naming" className="scroll-mt-6">
            <h2 className="border-b-2 border-rule-strong pb-2 text-xl font-semibold tracking-tight">
              File naming
            </h2>
            <p className="mt-5">
              <span className="num">studio_job_size_version.pdf</span>, lower case, underscores,
              no spaces and no accents. Put the version in the name and increment it —{' '}
              <span className="num">nine-dots_catalogue_48pp_v4.pdf</span> is a filename we can
              act on, <span className="num">final_FINAL.pdf</span> is not.
            </p>
          </section>

          <section id="pdfx4" className="scroll-mt-6">
            <h2 className="border-b-2 border-rule-strong pb-2 text-xl font-semibold tracking-tight">
              PDF/X-4 export
            </h2>
            <p className="mt-5">
              PDF/X-4 is PDF 1.6 with live transparency, ICC-managed colour and a declared output
              intent. It is the only format we accept because it is the only one that tells us what
              you meant by “black”.
            </p>
            <div className="mt-5 grid gap-6 md:grid-cols-2">
              <div className="border border-rule-strong p-4">
                <p className="label-caps">InDesign</p>
                <ol className="mt-3 space-y-2 text-sm">
                  <li>
                    <span className="num text-muted">01</span> File › Export › Adobe PDF (Print).
                  </li>
                  <li>
                    <span className="num text-muted">02</span> Standard{' '}
                    <span className="num">PDF/X-4:2010</span>, Compatibility{' '}
                    <span className="num">Acrobat 7 (PDF 1.6)</span>.
                  </li>
                  <li>
                    <span className="num text-muted">03</span> Marks and Bleeds: no marks, Use
                    Document Bleed Settings, bleed <span className="num">3mm</span> all round.
                  </li>
                  <li>
                    <span className="num text-muted">04</span> Output: Colour Conversion{' '}
                    <span className="num">Convert to Destination (Preserve Numbers)</span>,
                    Destination the stock profile, Output Intent the same.
                  </li>
                  <li>
                    <span className="num text-muted">05</span> Pages, not spreads.
                  </li>
                </ol>
              </div>
              <div className="border border-rule-strong p-4">
                <p className="label-caps">Illustrator</p>
                <ol className="mt-3 space-y-2 text-sm">
                  <li>
                    <span className="num text-muted">01</span> Set the document to the finished
                    size, artboard on the trim.
                  </li>
                  <li>
                    <span className="num text-muted">02</span> File › Save As › Adobe PDF.
                  </li>
                  <li>
                    <span className="num text-muted">03</span> Preset{' '}
                    <span className="num">[PDF/X-4:2008]</span>, Preserve Illustrator Editing
                    Capabilities off.
                  </li>
                  <li>
                    <span className="num text-muted">04</span> Marks and Bleeds: bleed{' '}
                    <span className="num">3mm</span> all round, no trim marks.
                  </li>
                  <li>
                    <span className="num text-muted">05</span> Check Document Colour Mode is CMYK
                    before you export, not after.
                  </li>
                </ol>
              </div>
            </div>
          </section>

          <section id="checks" className="scroll-mt-6">
            <h2 className="border-b-2 border-rule-strong pb-2 text-xl font-semibold tracking-tight">
              The twelve checks
            </h2>
            <p className="mt-5">
              Every upload is measured against these twelve tolerances. Failures stop the job at
              preflight until prepress overrides them with a written reason. Warnings do not stop
              anything, but they are printed on the proof sheet.
            </p>
            <table className="mt-5 w-full border border-rule-strong text-sm">
              <caption className="sr-only">The twelve preflight checks and their tolerances</caption>
              <thead>
                <tr className="border-b-2 border-rule-strong">
                  <th scope="col" className="px-3 py-2 text-left label-caps">
                    Check
                  </th>
                  <th scope="col" className="px-3 py-2 text-left label-caps">
                    Tolerance
                  </th>
                </tr>
              </thead>
              <tbody>
                {checks.map((check) => (
                  <tr key={check.id} className="border-b border-rule last:border-b-0">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      {check.label}
                    </th>
                    <td className="px-3 py-2 num text-muted">{check.tolerance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section id="summary" className="scroll-mt-6">
            <h2 className="border-b-2 border-rule-strong pb-2 text-xl font-semibold tracking-tight">
              Specification summary
            </h2>
            <p className="mt-5">
              Keep this beside the export dialog. It is the whole specification in nine lines.
            </p>
            <div className="mt-5 border-2 border-ink">
              <div className="flex items-baseline justify-between border-b border-ink px-4 py-2">
                <span className="num text-sm font-semibold tracking-[0.18em]">
                  FORME ARTWORK SPEC
                </span>
                <span className="num text-2xs text-muted">REV 6 · 01 JUL 2026</span>
              </div>
              <dl className="num grid grid-cols-[10rem_1fr] gap-y-1 px-4 py-4 text-sm">
                <dt className="text-muted">FORMAT</dt>
                <dd>PDF/X-4, single pages, reading order</dd>
                <dt className="text-muted">BLEED</dt>
                <dd>3mm all round</dd>
                <dt className="text-muted">SAFETY</dt>
                <dd>4mm inside trim</dd>
                <dt className="text-muted">RESOLUTION</dt>
                <dd>300ppi effective, 1200ppi bitmap</dd>
                <dt className="text-muted">COLOUR</dt>
                <dd>CMYK only, spots named</dd>
                <dt className="text-muted">INK LIMIT</dt>
                <dd>300% coated, 260% uncoated</dd>
                <dt className="text-muted">RICH BLACK</dt>
                <dd>60/50/50/100, small type 100K</dd>
                <dt className="text-muted">FONTS</dt>
                <dd>All embedded, no stroke under 0.25pt</dd>
                <dt className="text-muted">PAGES</dt>
                <dd>Booklets in multiples of 4</dd>
              </dl>
              <p className="border-t border-ink px-4 py-2 text-xs text-muted">
                Print at 100% on A4. Questions on a specific file go to prepress with the job
                reference.
              </p>
            </div>
            <p className="mt-6 text-sm">
              Ready to price something?{' '}
              <Link className="border-b border-ink pb-0.5" href="/quote">
                The instant quote
              </Link>{' '}
              gives the press, the sheet count and the despatch date.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
