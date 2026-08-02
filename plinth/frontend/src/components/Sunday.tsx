import { useRef } from 'react';
import { gsap, useGSAP, SplitText, MM_CONDITIONS } from '../gsapSetup';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export default function Sunday() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MM_CONDITIONS, (ctx) => {
        if (ctx.conditions?.reduceMotion) {
          gsap.set(markerRef.current, { xPercent: 600 });
          return;
        }

        const split = new SplitText(headingRef.current, { type: 'lines' });
        split.lines.forEach((line) => {
          const mask = document.createElement('div');
          mask.style.overflow = 'hidden';
          line.parentNode?.insertBefore(mask, line);
          mask.appendChild(line);
        });
        gsap.from(split.lines, {
          yPercent: 110,
          duration: 1,
          stagger: 0.12,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: headingRef.current,
            start: 'top 80%',
            once: true,
          },
        });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: stripRef.current,
            start: 'top 85%',
            end: 'top 30%',
            scrub: 1,
          },
        });
        tl.fromTo(stripRef.current, { xPercent: 10 }, { xPercent: 0, ease: 'none' }, 0);
        tl.fromTo(
          markerRef.current,
          { xPercent: 0 },
          { xPercent: 600, ease: 'steps(6)' },
          0,
        );

        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section
      id="sunday"
      ref={sectionRef}
      aria-labelledby="sunday-heading"
      className="relative z-10 bg-blue px-4 py-28 text-bone md:px-10 md:py-40"
    >
      <p className="font-mono text-xs uppercase tracking-[0.25em] tabular-nums opacity-70">
        07 — The cadence
      </p>
      <h2
        id="sunday-heading"
        ref={headingRef}
        data-testid="sunday-heading"
        className="mt-8 max-w-[14ch] font-display text-[clamp(2.8rem,9vw,9rem)] font-black uppercase leading-[0.9] tracking-[-0.03em]"
      >
        The plan changes on Sundays.
      </h2>

      <div className="mt-20 grid items-end gap-16 md:mt-28 md:grid-cols-12">
        <div className="md:col-span-7">
          <div ref={stripRef} className="relative border-y border-bone/40">
            <div className="grid grid-cols-7">
              {DAYS.map((d) => (
                <div
                  key={d}
                  className="py-5 text-center font-mono text-xs uppercase tracking-[0.2em] md:text-sm"
                >
                  {d}
                </div>
              ))}
            </div>
            <div
              ref={markerRef}
              aria-hidden="true"
              className="absolute left-0 top-0 h-full w-[calc(100%/7)] border-2 border-bone"
            >
              <span className="absolute -bottom-9 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.2em] tabular-nums">
                18:00
              </span>
            </div>
          </div>
          <p className="mt-16 font-mono text-xs uppercase tracking-[0.2em] opacity-70">
            Next week arrives Sunday 18:00 · never mid-week
          </p>
        </div>
        <div className="md:col-span-5">
          <p className="max-w-md font-mono text-sm leading-relaxed">
            Every Sunday at 18:00 the next week arrives. Never mid-week. Never
            in reaction to a single session. Reacting to every session is how
            people end up training in circles. The discipline is in the
            cadence.
          </p>
        </div>
      </div>
    </section>
  );
}
