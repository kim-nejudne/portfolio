import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Key } from 'lucide-react';

interface NavigationProps {
  staffAuthenticated: boolean;
}

/** One source of truth for the header links, in printed-index order. */
const NAV_LINKS = [
  { to: '/', label: 'Overview', short: 'Home' },
  { to: '/menu', label: 'The Menu', short: 'Menu' },
  { to: '/story', label: 'The Craft', short: 'Story' },
  { to: '/visit', label: 'Location & Hours', short: 'Visit' },
] as const;

export const Navigation: React.FC<NavigationProps> = ({ staffAuthenticated }) => {
  const currentPath = useLocation().pathname;

  return (
    <header className="sticky top-0 z-40 bg-[#F7F4EE]/95 backdrop-blur-sm hairline-bottom transition-all duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">

        {/* Brand Mark */}
        <Link to="/" className="group flex flex-col text-left">
          <span className="font-display text-2xl sm:text-3xl tracking-wider text-[#1A1715] group-hover:text-[#7A2322] transition-colors">
            TALLOW
          </span>
          <span className="text-[10px] tracking-[0.25em] uppercase font-mono-data text-[#6B635A]">
            Dry-Aged · Live-Fire
          </span>
        </Link>

        {/* Only one of the two navs below is ever in the accessibility tree —
            the other is display:none at that breakpoint — so they can share a
            label without a screen reader hearing the links twice. */}
        <nav aria-label="Main" className="hidden md:flex items-center space-x-8 text-xs font-sans-ui tracking-wider uppercase">
          {NAV_LINKS.map(({ to, label }) => {
            const isCurrent = currentPath === to;
            return (
              <Link
                key={to}
                to={to}
                aria-current={isCurrent ? 'page' : undefined}
                className={`pb-1 transition-colors relative ${
                  isCurrent
                    ? 'text-[#1A1715] font-semibold border-b border-[#7A2322]'
                    : 'text-[#6B635A] hover:text-[#1A1715]'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Link
            to="/reserve"
            aria-current={currentPath === '/reserve' ? 'page' : undefined}
            className={`px-4 py-2 text-xs uppercase tracking-widest transition-all ${
              currentPath === '/reserve'
                ? 'bg-[#1A1715] text-[#F7F4EE]'
                : 'bg-[#7A2322] text-[#F7F4EE] hover:bg-[#581413]'
            }`}
          >
            Reserve Table
          </Link>

          <Link
            to="/staff"
            aria-current={currentPath.startsWith('/staff') ? 'page' : undefined}
            className={`p-2 transition-colors border ${
              currentPath.startsWith('/staff')
                ? 'border-[#7A2322] text-[#7A2322] bg-[#7A2322]/5'
                : 'border-[#DDD6C8] text-[#6B635A] hover:text-[#1A1715] hover:border-[#1A1715]'
            }`}
          >
            {/* The key glyph is the entire control, so the name has to be text:
                a title attribute alone is not reliably announced. */}
            <Key className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="sr-only">
              Staff control portal{staffAuthenticated ? ' (signed in)' : ''}
            </span>
          </Link>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <nav
        aria-label="Main"
        className="md:hidden flex items-center justify-around border-t border-[#DDD6C8] py-2 px-2 bg-[#F7F4EE] text-[11px] uppercase tracking-wider text-[#6B635A]"
      >
        {NAV_LINKS.map(({ to, short }) => {
          const isCurrent = currentPath === to;
          return (
            <Link
              key={to}
              to={to}
              aria-current={isCurrent ? 'page' : undefined}
              className={`px-2 py-1 ${isCurrent ? 'text-[#7A2322] font-medium' : ''}`}
            >
              {short}
            </Link>
          );
        })}
      </nav>
    </header>
  );
};
