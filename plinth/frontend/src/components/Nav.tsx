import { useRef } from 'react';
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

  return (
    <header
      ref={headerRef}
      className="fixed inset-x-0 top-0 z-40 border-b border-ink bg-bone"
    >      <nav
        aria-label="Primary"
        className="flex h-[var(--nav-height)] items-center justify-between px-4 md:px-10"
      >
        <a
          href="#top"
          data-testid="nav-wordmark"
          className="font-display text-xl font-black uppercase tracking-[-0.02em]"
        >
          Block
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
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted tabular-nums">
          16 weeks
        </span>
      </nav>
      <div
        ref={progressRef}
        aria-hidden="true"
        className="absolute bottom-[-1px] left-0 h-[2px] w-full origin-left scale-x-0 bg-blue"
      />
    </header>
  );
}
