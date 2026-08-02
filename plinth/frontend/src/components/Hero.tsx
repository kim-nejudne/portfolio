import { useRef } from 'react';
import { gsap, useGSAP, MM_CONDITIONS } from '../gsapSetup';

const LINES = ['SIXTEEN', 'WEEKS.', 'THEN YOU DO', 'IT AGAIN,', 'HEAVIER.'];

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MM_CONDITIONS, (ctx) => {
        if (ctx.conditions?.reduceMotion) return;
        gsap.to(headlineRef.current, {
          yPercent: -16,
          opacity: 0.35,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 1,
          },
        });

        if (ctx.conditions?.isDesktop) {
          const headline = headlineRef.current;
          if (!headline) return;
          gsap.set(headline, { transformPerspective: 1200 });
          const rotY = gsap.quickTo(headline, 'rotationY', {
            duration: 0.7,
            ease: 'power3.out',
          });
          const rotX = gsap.quickTo(headline, 'rotationX', {
            duration: 0.7,
            ease: 'power3.out',
          });
          const onMove = (e: PointerEvent) => {
            rotY((e.clientX / window.innerWidth - 0.5) * 4);
            rotX((e.clientY / window.innerHeight - 0.5) * -3);
          };
          window.addEventListener('pointermove', onMove);
          return () => window.removeEventListener('pointermove', onMove);
        }
      });
      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section
      id="top"
      ref={sectionRef}
      aria-labelledby="hero-heading"
      className="sticky top-0 z-0 flex h-[100dvh] flex-col justify-between bg-bone px-4 pb-8 pt-[calc(var(--nav-height)+1.5rem)] md:px-10"
    >
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-muted md:text-xs">
        <span>Block — periodised strength</span>
        <span className="tabular-nums">01 / 09</span>
      </div>

      <h1
        id="hero-heading"
        ref={headlineRef}
        data-testid="hero-headline"
        className="-ml-1 font-display text-[clamp(2.75rem,8.4vw,8.5rem)] font-black uppercase leading-[0.86] tracking-[-0.03em]"
      >
        {LINES.map((line, i) => (
          <span key={line} className="hero-mask">
            <span
              className={`hero-line hero-line-${i + 1} ${
                i === LINES.length - 1 ? 'text-vermilion stretch-wide' : ''
              } ${i % 2 === 1 ? 'pl-[6vw]' : ''}`}
            >
              {line}
            </span>
          </span>
        ))}
      </h1>

      <div>
        <div className="mb-6 h-[3px] w-24 bg-vermilion" aria-hidden="true" />
        <p
          data-testid="hero-facts"
          className="border-t border-ink pt-4 font-mono text-xs uppercase tracking-[0.2em] tabular-nums md:text-sm"
        >
          16 weeks · 4 blocks · 3 sessions / week · week 1 free
        </p>
        <p className="scroll-cue mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
          Scroll ↓
        </p>
      </div>
    </section>
  );
}
