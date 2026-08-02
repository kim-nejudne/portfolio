import { useRef } from 'react';
import { gsap, useGSAP, MM_CONDITIONS } from '../gsapSetup';
import { EVIDENCE, type EvidenceDef } from '../data';

function format(value: number, kind: EvidenceDef['kind']): string {
  if (kind === 'int') return Math.round(value).toLocaleString('en-GB');
  if (kind === 'm') return `${value.toFixed(1)}M`;
  if (kind === 'plus') return `+${Math.round(value)}%`;
  return `${Math.round(value)}%`;
}

export default function Evidence() {
  const sectionRef = useRef<HTMLElement>(null);
  const countersRef = useRef<(HTMLSpanElement | null)[]>([]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MM_CONDITIONS, (ctx) => {
        if (ctx.conditions?.reduceMotion) {
          countersRef.current.forEach((el, i) => {
            if (el) el.textContent = EVIDENCE[i].realText;
          });
          return;
        }

        ScrollTriggerCreate();
        function ScrollTriggerCreate() {
          const objects = EVIDENCE.map(() => ({ value: 0 }));
          gsap.to(objects, {
            value: (i: number) => EVIDENCE[i].target,
            duration: 2.2,
            ease: 'power3.out',
            snap: { value: 0.1 },
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 70%',
              once: true,
            },
            onUpdate: () => {
              objects.forEach((obj, i) => {
                const el = countersRef.current[i];
                if (el) el.textContent = format(obj.value, EVIDENCE[i].kind);
              });
            },
          });
        }
      });
      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section
      id="evidence"
      ref={sectionRef}
      aria-labelledby="evidence-heading"
      className="relative z-10 bg-vermilion px-4 py-20 text-ink md:px-10 md:py-24"
    >
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-xs uppercase tracking-[0.25em] tabular-nums">
          08 — The evidence
        </p>
        <h2 id="evidence-heading" className="sr-only">
          The evidence
        </h2>
      </div>

      <dl
        className="mt-10 grid grid-cols-2 gap-px border border-ink bg-ink/40 md:grid-cols-4"
        data-testid="evidence-grid"
      >
        {EVIDENCE.map((e, i) => (
          <div key={e.caption} className="bg-vermilion p-5 md:p-8">
            <dd className="font-display text-[clamp(2.4rem,6.5vw,5.5rem)] font-black leading-none tracking-[-0.02em]">
              <span
                aria-hidden="true"
                ref={(el) => {
                  countersRef.current[i] = el;
                }}
                data-testid={`evidence-counter-${i}`}
                className="tabular-nums"
              >
                0
              </span>
              <span className="sr-only">{e.realText}</span>
            </dd>
            <dt className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] md:text-xs">
              {e.caption}
            </dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
