import { useEffect, useRef, useState } from 'react';
import { gsap, useGSAP, MM_CONDITIONS } from '../gsapSetup';

const LINKS = [
  { href: '#planner', label: 'Plan' },
  { href: '#blocks', label: 'Blocks' },
  { href: '#curve', label: 'Curve' },
  { href: '#session', label: 'Session' },
  { href: '#close', label: 'Price' },
];

export default function Nav() {
  const headerRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MM_CONDITIONS, (ctx) => {
        if (ctx.conditions?.reduceMotion) return;
        gsap.to(progressRef.current, {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { start: 0, end: 'max', scrub: 0.5 },
        });
      });
      return () => mm.revert();
    },
    { scope: headerRef },
  );

  // Escape closes and hands focus back to the control that opened it, so a
  // keyboard user is never left with focus inside a panel that has gone away.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <header
      ref={headerRef}
      className="fixed inset-x-0 top-0 z-40 border-b border-ink bg-bone"
    >
      <nav
        aria-label="Primary"
        className="flex h-[var(--nav-height)] items-center justify-between px-4 md:px-10"
      >
        <a
          href="#top"
          data-testid="nav-wordmark"
          className="font-display text-xl font-black uppercase tracking-[-0.02em]"
        >
          Plinth
        </a>
        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                data-testid={`nav-link-${link.label.toLowerCase()}`}
                className="nav-link font-mono text-xs uppercase tracking-[0.2em] hover:text-blue"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <span className="hidden font-mono text-xs uppercase tracking-[0.2em] text-muted tabular-nums md:inline">
          16 weeks
        </span>

        {/* Below `md` the section links were simply `hidden`, so there was no
            way to reach any section from a phone. Square and hairline like the
            rest of the furniture — an index, not a hamburger. */}
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="nav-sections"
          data-testid="nav-toggle"
          className="border border-ink px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] md:hidden"
        >
          {open ? 'Close' : 'Index'}
        </button>
      </nav>

      <ul
        id="nav-sections"
        hidden={!open}
        data-testid="nav-mobile-panel"
        className="border-t border-ink bg-bone md:hidden"
      >
        {LINKS.map((link) => (
          <li key={link.href} className="border-b border-ink/15 last:border-b-0">
            <a
              href={link.href}
              onClick={() => setOpen(false)}
              data-testid={`nav-mobile-link-${link.label.toLowerCase()}`}
              className="block px-4 py-4 font-mono text-xs uppercase tracking-[0.25em]"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>

      <div
        ref={progressRef}
        aria-hidden="true"
        className="absolute bottom-[-1px] left-0 h-[2px] w-full origin-left scale-x-0 bg-blue"
      />
    </header>
  );
}
