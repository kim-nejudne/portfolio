import { useRef } from 'react';
import { gsap, useGSAP, MM_CONDITIONS } from '../gsapSetup';
import { TONNAGE_KG, INTENSITY_1RM, CURVE_STATEMENTS } from '../data';

const PLOT_W = 1000;
const PLOT_H = 420;

const xAt = (i: number) => (i / 15) * PLOT_W;

/**
 * Both axes are derived from the data they plot. The scaffold hard-coded the
 * domains (11000–27000 kg, 65–92.5%), so editing a figure silently moved the
 * lines against a scale that no longer fitted them.
 */
const scale = (values: number[]) => {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return {
    norm: (v: number) => (v - lo) / (hi - lo),
    y: (v: number) => PLOT_H - ((v - lo) / (hi - lo)) * PLOT_H,
  };
};

const TONNAGE = scale(TONNAGE_KG);
const INTENSITY = scale(INTENSITY_1RM);

const toPath = (ys: number[]) =>
  ys
    .map((y, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${y.toFixed(1)}`)
    .join('');

const TONNAGE_D = toPath(TONNAGE_KG.map(TONNAGE.y));
const INTENSITY_D = toPath(INTENSITY_1RM.map(INTENSITY.y));
const BLOCK_DIVIDERS = [3.5, 7.5, 11.5].map(xAt);

/**
 * Where the two lines actually meet, found by walking the segments rather than
 * asserted. The scaffold drew its marker at a hard-coded week 11 while the
 * lines crossed at week 12 — the annotation and the picture disagreed, on the
 * page whose entire pitch is measurement.
 */
function crossoverIndex(): number {
  const gap = (i: number) => TONNAGE.norm(TONNAGE_KG[i]) - INTENSITY.norm(INTENSITY_1RM[i]);
  for (let i = 0; i < TONNAGE_KG.length - 1; i += 1) {
    const a = gap(i);
    const b = gap(i + 1);
    if (a > 0 && b <= 0) return i + a / (a - b);
  }
  return NaN;
}

const CROSSOVER_X = xAt(crossoverIndex());

export default function LoadCurve() {
  const sectionRef = useRef<HTMLElement>(null);
  const tonnageRef = useRef<SVGPathElement>(null);
  const intensityRef = useRef<SVGPathElement>(null);
  const noteRef = useRef<SVGGElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MM_CONDITIONS, (ctx) => {
        if (ctx.conditions?.reduceMotion) {
          gsap.set(noteRef.current, { opacity: 1 });
          return;
        }

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 65%',
            end: 'center 35%',
            scrub: 1,
          },
        });
        tl.fromTo(
          tonnageRef.current,
          { drawSVG: '0%' },
          { drawSVG: '100%', duration: 2, ease: 'none' },
        );
        tl.fromTo(
          intensityRef.current,
          { drawSVG: '0%' },
          { drawSVG: '100%', duration: 2, ease: 'none' },
        );
        tl.fromTo(noteRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 });

        gsap.from('.curve-statement', {
          y: 32,
          opacity: 0,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.curve-statements',
            start: 'top 80%',
            once: true,
          },
        });
      });
      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section
      id="curve"
      ref={sectionRef}
      aria-labelledby="curve-heading"
      className="relative z-10 bg-bone px-4 py-24 md:px-10 md:py-32"
    >
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted tabular-nums">
        05 — The load curve
      </p>
      <h2
        id="curve-heading"
        className="mt-6 font-display text-[clamp(2rem,5vw,4.5rem)] font-black uppercase leading-[0.9] tracking-[-0.02em]"
      >
        Sixteen weeks, plotted.
      </h2>

      <div className="mt-14 grid gap-14 md:grid-cols-12">
        <div className="md:col-span-8">
          <svg
            viewBox="-60 -46 1120 510"
            className="w-full"
            role="img"
            aria-label="Line chart of weekly tonnage against average intensity across sixteen weeks. Tonnage peaks at 28,000 kg in week three and steps down block by block; intensity climbs to 90% of one-rep max in week eleven. The two cross once, at the start of REALISE in week nine."
            data-testid="load-curve-svg"
          >
            {BLOCK_DIVIDERS.map((x) => (
              <path
                key={x}
                d={`M${x},0 L${x},${PLOT_H}`}
                stroke="#101010"
                strokeWidth="1"
                strokeDasharray="2 6"
                opacity="0.18"
              />
            ))}
            <path
              d={`M0,${PLOT_H} L${PLOT_W},${PLOT_H}`}
              stroke="#101010"
              strokeWidth="1"
            />
            {TONNAGE_KG.map((_, i) => (
              <text
                key={i}
                x={xAt(i)}
                y={PLOT_H + 26}
                textAnchor="middle"
                fontSize="12"
                fill="#5F5A52"
                className="font-mono tabular-nums"
              >
                {String(i + 1).padStart(2, '0')}
              </text>
            ))}
            {/* The only literal copy of the blue in the app: `stroke` takes no
                Tailwind colour utility, so this cannot read `--color-blue` the
                way every other use does. Moved from #1F2BFF with the token on
                2026-08-07 and has to be kept in step by hand. The legend swatch
                below is `bg-blue`, so a drift shows up as a curve that does not
                match its own key. */}
            <path
              ref={tonnageRef}
              d={TONNAGE_D}
              fill="none"
              stroke="#3540FF"
              strokeWidth="3.5"
            />
            <path
              ref={intensityRef}
              d={INTENSITY_D}
              fill="none"
              stroke="#FF3B14"
              strokeWidth="3.5"
            />
            <g ref={noteRef}>
              <path
                d={`M${CROSSOVER_X},-6 L${CROSSOVER_X},${PLOT_H}`}
                stroke="#101010"
                strokeWidth="1"
                strokeDasharray="2 4"
              />
              <text
                x={CROSSOVER_X}
                y={-20}
                textAnchor="middle"
                fontSize="14"
                fill="#101010"
                className="font-mono tabular-nums"
              >
                CROSSOVER · REALISE BEGINS · WK 09
              </text>
            </g>
          </svg>
          <div className="mt-4 flex flex-wrap gap-8 font-mono text-[10px] uppercase tracking-[0.2em] text-muted md:text-xs">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-6 bg-blue" aria-hidden="true" />
              Tonnage (kg / week)
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-6 bg-vermilion" aria-hidden="true" />
              Avg intensity (% 1RM)
            </span>
          </div>
        </div>

        <div className="curve-statements space-y-8 md:col-span-4">
          {CURVE_STATEMENTS.map((s) => (
            <p
              key={s}
              className="curve-statement border-t border-ink pt-4 font-display text-xl font-bold leading-snug md:text-2xl"
            >
              {s}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
