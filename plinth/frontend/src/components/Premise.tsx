import { useRef } from 'react';
import { gsap, useGSAP, SplitText, MM_CONDITIONS } from '../gsapSetup';
import { MARQUEE_TEXT } from '../data';

export default function Premise() {
  const sectionRef = useRef<HTMLElement>(null);
  const statementRef = useRef<HTMLHeadingElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MM_CONDITIONS, (ctx) => {
        if (ctx.conditions?.reduceMotion) return;

        const split = new SplitText(statementRef.current, { type: 'lines' });
        split.lines.forEach((line) => {
          const mask = document.createElement('div');
          mask.style.overflow = 'hidden';
          line.parentNode?.insertBefore(mask, line);
          mask.appendChild(line);
        });
        gsap.from(split.lines, {
          yPercent: 110,
          duration: 1,
          stagger: 0.14,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: statementRef.current,
            start: 'top 78%',
            once: true,
          },
        });

        gsap.to(marqueeRef.current, {
          xPercent: -50,
          repeat: -1,
          ease: 'none',
          duration: 22,
        });

        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="premise-heading"
      className="relative z-10 bg-ink text-bone"
    >
      <div className="flex min-h-[80dvh] flex-col justify-center px-4 py-24 md:px-10">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-ink tabular-nums">
          02 — The premise
        </p>
        <h2
          id="premise-heading"
          ref={statementRef}
          data-testid="premise-statement"
          className="mt-10 max-w-[13ch] font-display text-[clamp(2.5rem,7.5vw,7rem)] font-black uppercase leading-[0.92] tracking-[-0.03em]"
        >
          We are not an app. We are the plan.
        </h2>
      </div>
      {/* Inverted from blue-on-ink to bone-on-blue. The scaffold prompt asked
          for blue on ink, but that measures 2.58:1 — under even the 3:1 large-
          text floor. Blue still carries "the plan"; it now carries it as the
          plate rather than as the type, which is also how the rest of the page
          uses a full-bleed colour. */}
      <div className="overflow-hidden bg-blue py-5">
        <div
          ref={marqueeRef}
          data-testid="block-marquee"
          className="flex w-max whitespace-nowrap font-mono text-2xl uppercase tracking-[0.1em] text-bone md:text-4xl"
        >
          <span className="pr-2">{MARQUEE_TEXT.repeat(3)}</span>
          <span className="pr-2" aria-hidden="true">
            {MARQUEE_TEXT.repeat(3)}
          </span>
        </div>
      </div>
    </section>
  );
}
