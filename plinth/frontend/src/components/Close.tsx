import { useRef, useState } from 'react';
import { gsap, useGSAP, MM_CONDITIONS } from '../gsapSetup';
import EnrolDialog from './EnrolDialog';
import WeekOneDialog from './WeekOneDialog';

type DialogName = 'enrol' | 'week-one' | null;

export default function Close() {
  const sectionRef = useRef<HTMLElement>(null);
  const [dialog, setDialog] = useState<DialogName>(null);

  // The magnetic offset never gets a pointerleave once the dialog takes the
  // top layer, so release it on the click that opened it.
  const openDialog = (
    name: Exclude<DialogName, null>,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    gsap.to(e.currentTarget, { x: 0, y: 0, duration: 0.4, ease: 'power3.out' });
    setDialog(name);
  };

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
            ₱2,150
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
            ₱7,100
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
          onClick={(e) => openDialog('enrol', e)}
          className="cta-magnetic bg-blue px-10 py-5 font-mono text-sm uppercase tracking-[0.25em] text-bone"
        >
          Start block one
        </button>
        <button
          type="button"
          data-testid="cta-week-one"
          onClick={(e) => openDialog('week-one', e)}
          className="cta-magnetic border border-ink px-10 py-5 font-mono text-sm uppercase tracking-[0.25em]"
        >
          See week one free
        </button>
      </div>

      <EnrolDialog open={dialog === 'enrol'} onClose={() => setDialog(null)} />
      <WeekOneDialog
        open={dialog === 'week-one'}
        onClose={() => setDialog(null)}
      />


      <footer className="mt-24 border-t border-ink pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <div className="flex flex-col justify-between gap-4 md:flex-row">
          <span className="font-bold text-ink">Plinth</span>
          <span>Accumulate · Intensify · Realise · Restore</span>
          <span>Set in Archivo &amp; Space Mono · No photographs · MMXXVI</span>
        </div>

        {/*
          The way back to the portfolio. The hub links out to every spoke; until
          2026-08-06 nothing linked back, so anyone arriving on this domain from
          a shared link had no route to the write-up or the other four.

          Underlined rather than coloured: blue is "the plan" and vermilion is
          "the effort" on this page, and neither of them means "link". Borrowing
          one here would break the semantic the whole art direction rests on.
        */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/20 pt-5">
          <span>Demo · a portfolio piece</span>
          <a className="underline underline-offset-4 hover:text-ink" href="https://kimnejudne.dev/work/plinth/">
            Case study
          </a>
          <a className="underline underline-offset-4 hover:text-ink" href="https://kimnejudne.dev/">
            More work by Kim Nejudne
          </a>
        </div>
      </footer>
    </section>
  );
}
