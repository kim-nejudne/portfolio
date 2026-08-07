import { useRef } from 'react';
import { gsap, useGSAP, MM_CONDITIONS } from '../gsapSetup';

const WEEKS = Array.from({ length: 16 }, (_, i) => i + 1);
const DAYS = ['SQ', 'PR', 'DL'];
const BLOCK_NAMES = ['ACCUMULATE', 'INTENSIFY', 'REALISE', 'RESTORE'];

// Four treatments, not four hues. Blocks 3 and 4 carry a hairline as well:
// without one the stipple ran continuously across weeks 09–12 and read as a
// single dotted rectangle, and the hollow block had no grid at all — both
// directly under a caption saying "one cell per session".
function cellTreatment(week: number): string {
  const block = Math.ceil(week / 4);
  if (block === 1) return 'bg-blue text-bone';
  if (block === 2) return 'border border-blue bg-transparent text-blue';
  if (block === 3) return 'stipple border border-blue/45 text-blue';
  return 'border border-ink/25 bg-transparent text-muted';
}

export default function Planner() {
  const sectionRef = useRef<HTMLElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MM_CONDITIONS, (ctx) => {
        const cells = (b: number) =>
          gsap.utils.toArray<HTMLElement>(`.planner-cell[data-block="${b}"]`);

        if (ctx.conditions?.reduceMotion) {
          gsap.set('.planner-cell', { opacity: 1, scale: 1 });
          gsap.set(cardRef.current, { opacity: 0 });
          return;
        }

        // The second zoom stage scales a 48-cell subtree — stipple backgrounds
        // included — by 8. That is cheap enough on a desktop GPU and not on a
        // mid-range phone, so mobile gets the assembly and the first zoom only,
        // over a shorter pin.
        const deep = !ctx.conditions?.isMobile;

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: deep ? '+=300%' : '+=180%',
            scrub: 1,
            pin: true,
            anticipatePin: 1,
          },
        });

        [1, 2, 3, 4].forEach((b, i) => {
          tl.fromTo(
            cells(b),
            { opacity: 0, scale: 0.55 },
            {
              opacity: 1,
              scale: 1,
              duration: 0.9,
              stagger: 0.04,
              ease: 'power3.out',
            },
            i * 0.9,
          );
        });

        tl.to({}, { duration: 0.6 });
        tl.to(
          zoomRef.current,
          { scale: deep ? 3.4 : 2.2, duration: 2, ease: 'power2.in' },
          'zoom',
        );
        tl.to('.planner-chrome', { opacity: 0, duration: 0.4 }, 'zoom');
        if (deep) {
          tl.to(zoomRef.current, { scale: 8, duration: 1.6, ease: 'power2.in' });
        }
        tl.to(zoomRef.current, { opacity: 0, duration: 0.5 }, '-=0.4');
        tl.fromTo(
          cardRef.current,
          { opacity: 0, scale: 0.92 },
          { opacity: 1, scale: 1, duration: 0.8, ease: 'expo.out' },
        );
        tl.to({}, { duration: 0.5 });
      });
      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section
      id="planner"
      ref={sectionRef}
      aria-labelledby="planner-heading"
      className="relative z-10 bg-bone"
    >
      <h2 id="planner-heading" className="sr-only">
        The sixteen-week wall planner
      </h2>
      <div className="flex h-[100dvh] flex-col justify-center overflow-hidden px-3 pb-8 pt-[calc(var(--nav-height)+2rem)] md:px-8">
        <div className="planner-chrome mb-4 flex items-baseline justify-between gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted tabular-nums">
            03 — The wall planner
          </p>
          <p className="hidden font-mono text-xs uppercase tracking-[0.25em] text-muted md:block">
            One column per week · one cell per session
          </p>
        </div>

        <div
          ref={zoomRef}
          data-testid="planner-grid"
          className="origin-[65.6%_50%]"
        >
          <div className="planner-chrome mb-2 grid grid-cols-16 gap-[3px]">
            {WEEKS.map((w) => (
              <span
                key={w}
                className="text-center font-mono text-[9px] text-muted tabular-nums md:text-[10px]"
              >
                {String(w).padStart(2, '0')}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-16 gap-[3px]">
            {WEEKS.map((w) => (
              <div key={w} className="flex flex-col gap-[3px]">
                {DAYS.map((d) => (
                  <div
                    key={d}
                    data-block={Math.ceil(w / 4)}
                    className={`planner-cell flex aspect-[3/4] items-center justify-center font-mono text-[8px] tabular-nums md:text-[10px] ${cellTreatment(w)}`}
                  >
                    {d}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="planner-chrome mt-2 grid grid-cols-4 gap-[3px]">
            {BLOCK_NAMES.map((name) => (
              <span
                key={name}
                className="text-center font-mono text-[9px] uppercase tracking-[0.2em] text-muted md:text-[10px]"
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        <div
          ref={cardRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0"
        >
          <div className="border border-ink bg-bone px-8 py-8 md:px-14 md:py-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted tabular-nums md:text-xs">
              WK 11 · BLOCK 03 · REALISE
            </p>
            <p className="mt-4 font-display text-3xl font-black uppercase leading-[0.9] tracking-[-0.02em] md:text-6xl">
              Day 2 — Press
            </p>
            <p className="mt-4 border-t border-ink pt-4 font-mono text-xs tabular-nums md:text-sm">
              OVERHEAD PRESS · 5 × 3 @ 80% 1RM
            </p>
            <p className="mt-1 font-mono text-xs text-muted tabular-nums md:text-sm">
              RPE 8 · REST 3:00
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
