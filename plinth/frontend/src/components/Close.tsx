import { useRef } from 'react';
import { gsap, useGSAP, MM_CONDITIONS } from '../gsapSetup';

export default function Close() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MM_CONDITIONS, (ctx) => {
        if (ctx.conditions?.reduceMotion) return;
        gsap.from('.close-reveal', {
          y: 40,
          opacity: 0,
          duration: 0.9,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
            once: true,
          },
        });

        if (ctx.conditions?.isDesktop) {
          const cleanups: (() => void)[] = [];
          gsap.utils.toArray<HTMLElement>('.cta-magnetic').forEach((btn) => {
            const xTo = gsap.quickTo(btn, 'x', {
              duration: 0.4,
              ease: 'power3.out',
            });
            const yTo = gsap.quickTo(btn, 'y', {
              duration: 0.4,
              ease: 'power3.out',
            });
            const onMove = (e: PointerEvent) => {
              const r = btn.getBoundingClientRect();
              xTo((e.clientX - r.left - r.width / 2) * 0.25);
              yTo((e.clientY - r.top - r.height / 2) * 0.35);
            };
            const onLeave = () => {
              xTo(0);
              yTo(0);
            };
            btn.addEventListener('pointermove', onMove);
            btn.addEventListener('pointerleave', onLeave);
            cleanups.push(() => {
              btn.removeEventListener('pointermove', onMove);
              btn.removeEventListener('pointerleave', onLeave);
            });
          });
          return () => cleanups.forEach((fn) => fn());
        }
      });
      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section
      id="close"
      ref={sectionRef}
      aria-labelledby="close-heading"
      className="relative z-10 bg-bone px-4 pb-10 pt-24 md:px-10 md:pt-32"
    >
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted tabular-nums">
        09 — The price
      </p>
      <h2
        id="close-heading"
        className="close-reveal mt-6 font-display text-[clamp(2.5rem,7vw,7rem)] font-black uppercase leading-[0.9] tracking-[-0.03em]"
      >
        Week one is free.
      </h2>

      <div className="close-reveal mt-14 grid border border-ink md:grid-cols-2">
        <div className="border-b border-ink p-8 md:border-b-0 md:border-r md:p-12">
          <p
            className="font-display text-[clamp(4rem,10vw,9rem)] font-black leading-none tracking-[-0.03em] tabular-nums"
            data-testid="price-monthly"
          >
            £29
          </p>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Per month · cancel at the end of any block
          </p>
        </div>
        <div className="p-8 md:p-12">
          <p
            className="font-display text-[clamp(4rem,10vw,9rem)] font-black leading-none tracking-[-0.03em] tabular-nums"
            data-testid="price-cycle"
          >
            £96
          </p>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Per cycle · 16 weeks · prepaid
          </p>
        </div>
      </div>

      <div className="close-reveal mt-10 flex flex-col gap-4 sm:flex-row">
        <button
          type="button"
          data-testid="cta-start"
          className="cta-magnetic bg-blue px-10 py-5 font-mono text-sm uppercase tracking-[0.25em] text-bone"
        >
          Start block one
        </button>
        <button
          type="button"
          data-testid="cta-week-one"
          className="cta-magnetic border border-ink px-10 py-5 font-mono text-sm uppercase tracking-[0.25em]"
        >
          See week one free
        </button>
      </div>

      <footer className="mt-24 flex flex-col justify-between gap-4 border-t border-ink pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted md:flex-row">
        <span className="font-bold text-ink">Block</span>
        <span>Accumulate · Intensify · Realise · Restore</span>
        <span>Set in Archivo &amp; Space Mono · No photographs · MMXXVI</span>
      </footer>
    </section>
  );
}
