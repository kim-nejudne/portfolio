import { useRef, useState } from 'react';
import { gsap, useGSAP, MM_CONDITIONS } from '../gsapSetup';
import { SESSIONS } from '../data';

export default function Session() {
  const sectionRef = useRef<HTMLElement>(null);
  const panelsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [day, setDay] = useState(0);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MM_CONDITIONS, (ctx) => {
        panelsRef.current.forEach((panel, i) => {
          if (panel) gsap.set(panel, { opacity: i === day ? 1 : 0 });
        });
        if (ctx.conditions?.reduceMotion) return;
        const active = panelsRef.current[day];
        if (active) {
          gsap.fromTo(
            active,
            { opacity: 0 },
            { opacity: 1, duration: 0.45, ease: 'power3.out' },
          );
        }
      });
      return () => mm.revert();
    },
    { scope: sectionRef, dependencies: [day] },
  );

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MM_CONDITIONS, (ctx) => {
        if (ctx.conditions?.reduceMotion) return;
        gsap.from('.session-row', {
          y: 24,
          opacity: 0,
          duration: 0.7,
          stagger: 0.07,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 65%',
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
      id="session"
      ref={sectionRef}
      aria-labelledby="session-heading"
      className="relative z-10 bg-ink px-4 py-24 text-bone md:px-10 md:py-32"
    >
      <div className="print:hidden">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-ink tabular-nums">
          06 — One session, in full
        </p>
        <h2
          id="session-heading"
          className="mt-6 font-display text-[clamp(2rem,5vw,4.5rem)] font-black uppercase leading-[0.9] tracking-[-0.02em]"
        >
          Week eleven, day by day.
        </h2>

        <fieldset className="mt-12">
        <legend className="sr-only">Select training day</legend>
        <div className="flex border border-bone/40" role="presentation">
          {SESSIONS.map((s, i) => (
            <label
              key={s.id}
              className={`flex-1 cursor-pointer px-2 py-4 text-center font-mono text-xs uppercase tracking-[0.2em] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-bone md:text-sm ${
                day === i ? 'bg-bone text-ink' : 'text-bone'
              }`}
            >
              <input
                type="radio"
                name="session-day"
                value={s.id}
                checked={day === i}
                onChange={() => setDay(i)}
                className="sr-only"
                data-testid={`session-radio-${s.id}`}
              />
              {s.day}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-12 grid" data-testid="session-panels">
        {SESSIONS.map((s, i) => (
          <div
            key={s.id}
            ref={(el) => {
              panelsRef.current[i] = el;
            }}
            aria-hidden={day !== i}
            className={`[grid-area:1/1] ${day !== i ? 'pointer-events-none' : ''}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-bone/40 pb-4">
              <h3 className="font-display text-4xl font-black uppercase tracking-[-0.02em] md:text-6xl">
                {s.title}
              </h3>
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-ink tabular-nums">
                WK 11 · BLOCK 03 · REALISE
              </span>
            </div>
            <dl>
              {s.rows.map((r) => (
                <div
                  key={r.label}
                  className="session-row grid grid-cols-1 gap-1 border-b border-bone/15 py-4 md:grid-cols-[240px_1fr] md:gap-8"
                >
                  <dt className="font-mono text-sm uppercase tracking-[0.15em]">
                    {r.label}
                  </dt>
                  <dd className="font-mono text-sm text-muted-ink tabular-nums">
                    {r.detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <p className="mt-10 font-mono text-xs uppercase tracking-[0.2em] text-muted-ink">
        Barbell · rack · plates. Nothing else.
      </p>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          data-testid="print-session-button"
          onClick={() => window.print()}
          className="border border-bone/40 px-6 py-3 font-mono text-xs uppercase tracking-[0.25em] text-bone hover:bg-bone hover:text-ink"
        >
          Print this session
        </button>
      </div>
      </div>

      <div aria-hidden="true" className="print-card hidden text-ink print:block">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-2xl font-black uppercase tracking-[-0.02em]">
            Plinth
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] tabular-nums">
            WK 11 · Block 03 · Realise
          </span>
        </div>
        <div className="mt-4 border-t-2 border-ink pt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-blue">
            {SESSIONS[day].day}
          </p>
          <p className="mt-1 font-display text-6xl font-black uppercase leading-[0.9] tracking-[-0.02em]">
            {SESSIONS[day].title}
          </p>
        </div>
        <dl className="mt-8 border-b border-ink">
          {SESSIONS[day].rows.map((r) => (
            <div
              key={r.label}
              className="grid grid-cols-[180px_1fr] gap-6 border-t border-ink py-3"
            >
              <dt className="font-mono text-xs uppercase tracking-[0.15em]">
                {r.label}
              </dt>
              <dd className="font-mono text-xs tabular-nums">{r.detail}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex justify-between font-mono text-[9px] uppercase tracking-[0.2em]">
          <span>Barbell · rack · plates. Nothing else.</span>
          <span>The plan changes on Sundays · 18:00</span>
        </div>
      </div>
    </section>
  );
}
