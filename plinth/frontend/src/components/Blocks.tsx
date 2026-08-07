import { useRef } from 'react';
import { gsap, useGSAP, MM_CONDITIONS } from '../gsapSetup';
import { BLOCKS } from '../data';

export default function Blocks() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MM_CONDITIONS, (ctx) => {
        const c = ctx.conditions;
        if (c?.reduceMotion) return;

        if (c?.isDesktop) {
          gsap.to(trackRef.current, {
            xPercent: -300,
            ease: 'none',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top top',
              end: '+=400%',
              scrub: 1,
              pin: true,
              anticipatePin: 1,
            },
          });
        }

        if (c?.isMobile) {
          gsap.utils.toArray<HTMLElement>('.block-panel').forEach((panel) => {
            gsap.from(panel.querySelectorAll('.block-reveal'), {
              y: 48,
              opacity: 0,
              duration: 0.9,
              stagger: 0.1,
              ease: 'power3.out',
              scrollTrigger: { trigger: panel, start: 'top 75%', once: true },
            });
            gsap.from(panel.querySelectorAll('.block-bar'), {
              scaleX: 0,
              duration: 1.1,
              stagger: 0.12,
              ease: 'expo.out',
              scrollTrigger: { trigger: panel, start: 'top 70%', once: true },
            });
          });
        }
      });
      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  // `overflow-x-clip` on the section: the track is four viewport-wide panels
  // side by side, so it stands 300vw proud of this section before ScrollTrigger
  // ever pins it — which put a 4320px horizontal scrollbar on the document at
  // 1440. `clip` rather than `hidden` because `hidden` forces overflow-y to
  // `auto`, making this a scroll container and breaking the pin.
  return (
    <section
      id="blocks"
      ref={sectionRef}
      aria-labelledby="blocks-heading"
      className="relative z-10 overflow-x-clip bg-ink"
    >
      <h2 id="blocks-heading" className="sr-only">
        The four blocks
      </h2>
      <div
        ref={trackRef}
        data-testid="blocks-track"
        className="flex flex-col md:motion-safe:h-[100dvh] md:motion-safe:w-screen md:motion-safe:flex-row"
      >
        {BLOCKS.map((b, i) => {
          const onBlue = i % 2 === 1;
          return (
            <article
              key={b.n}
              className={`block-panel flex min-h-[85dvh] w-full flex-col justify-between px-6 py-14 md:motion-safe:h-full md:motion-safe:min-h-0 md:motion-safe:w-screen md:motion-safe:shrink-0 md:px-14 md:py-20 ${
                onBlue ? 'bg-blue text-bone' : 'bg-ink text-bone'
              }`}
            >
              <div className="flex items-start justify-between gap-6">
                <span
                  className={`block-reveal stretch-narrow font-display text-[clamp(7rem,22vw,17rem)] font-black leading-[0.8] tracking-[-0.03em] tabular-nums ${
                    onBlue ? 'text-bone' : 'text-blue'
                  }`}
                >
                  {b.n}
                </span>
                <span
                  className={`block-reveal pt-4 font-mono text-xs uppercase tracking-[0.25em] tabular-nums ${
                    onBlue ? 'opacity-85' : 'opacity-70'
                  }`}
                >
                  {b.weeks}
                </span>
              </div>

              <div>
                <h3 className="block-reveal font-display text-[clamp(2.5rem,6vw,5.5rem)] font-black uppercase leading-[0.9] tracking-[-0.02em]">
                  {b.name}
                </h3>
                <p className="block-reveal mt-5 max-w-md font-mono text-sm leading-relaxed">
                  {b.line1}
                </p>
                <p
                  className={`block-reveal max-w-md font-mono text-sm leading-relaxed ${
                    onBlue ? 'opacity-85' : 'opacity-70'
                  }`}
                >
                  {b.line2}
                </p>

                <div className="mt-10 max-w-xl space-y-4">
                  <div>
                    <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] opacity-85">
                      <span>Volume · mean / week</span>
                      <span className="tabular-nums">
                        {b.tonnage.toLocaleString('en-GB')} kg
                      </span>
                    </div>
                    <div
                      className={`block-bar mt-1 h-5 origin-left ${
                        onBlue ? 'bg-bone' : 'bg-blue'
                      }`}
                      style={{ width: `${b.volumeBar}%` }}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] opacity-85">
                      <span>Intensity · mean</span>
                      <span className="tabular-nums">{b.intensity}% 1RM</span>
                    </div>
                    <div
                      className="block-bar mt-1 h-5 origin-left bg-vermilion"
                      style={{ width: `${b.intensityBar}%` }}
                    />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
