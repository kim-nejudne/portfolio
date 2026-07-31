import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, Key, Calendar, BookOpen, MapPin, Menu as MenuIcon } from 'lucide-react';

interface NavigationProps {
  staffAuthenticated: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  staffAuthenticated,
}) => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <header className="sticky top-0 z-40 bg-[#F7F4EE]/95 backdrop-blur-sm hairline-bottom transition-all duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
        
        {/* Brand Mark */}
        <Link
          to="/"
          className="group flex flex-col text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7A2322]"
        >
          <span className="font-display text-2xl sm:text-3xl tracking-wider text-[#1A1715] group-hover:text-[#7A2322] transition-colors">
            TALLOW
          </span>
          <span className="text-[10px] tracking-[0.25em] uppercase font-mono-data text-[#6B635A]">
            Dry-Aged · Live-Fire
          </span>
        </Link>

        {/* Navigation Links */}
        <nav aria-label="Main Navigation" className="hidden md:flex items-center space-x-8 text-xs font-sans-ui tracking-wider uppercase">
          <Link
            to="/"
            className={`pb-1 transition-colors relative ${
              currentPath === '/'
                ? 'text-[#1A1715] font-semibold border-b border-[#7A2322]'
                : 'text-[#6B635A] hover:text-[#1A1715]'
            }`}
          >
            Overview
          </Link>

          <Link
            to="/menu"
            className={`pb-1 transition-colors relative ${
              currentPath === '/menu'
                ? 'text-[#1A1715] font-semibold border-b border-[#7A2322]'
                : 'text-[#6B635A] hover:text-[#1A1715]'
            }`}
          >
            The Menu
          </Link>

          <Link
            to="/story"
            className={`pb-1 transition-colors relative ${
              currentPath === '/story'
                ? 'text-[#1A1715] font-semibold border-b border-[#7A2322]'
                : 'text-[#6B635A] hover:text-[#1A1715]'
            }`}
          >
            The Craft
          </Link>

          <Link
            to="/visit"
            className={`pb-1 transition-colors relative ${
              currentPath === '/visit'
                ? 'text-[#1A1715] font-semibold border-b border-[#7A2322]'
                : 'text-[#6B635A] hover:text-[#1A1715]'
            }`}
          >
            Location & Hours
          </Link>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Link
            to="/reserve"
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
            title="Staff Control Portal"
            className={`p-2 transition-colors border ${
              currentPath === '/staff'
                ? 'border-[#7A2322] text-[#7A2322] bg-[#7A2322]/5'
                : 'border-[#DDD6C8] text-[#6B635A] hover:text-[#1A1715] hover:border-[#1A1715]'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-[#DDD6C8] py-2 px-2 bg-[#F7F4EE] text-[11px] uppercase tracking-wider text-[#6B635A]">
        <Link
          to="/"
          className={`px-2 py-1 ${currentPath === '/' ? 'text-[#7A2322] font-medium' : ''}`}
        >
          Home
        </Link>
        <Link
          to="/menu"
          className={`px-2 py-1 ${currentPath === '/menu' ? 'text-[#7A2322] font-medium' : ''}`}
        >
          Menu
        </Link>
        <Link
          to="/story"
          className={`px-2 py-1 ${currentPath === '/story' ? 'text-[#7A2322] font-medium' : ''}`}
        >
          Story
        </Link>
        <Link
          to="/visit"
          className={`px-2 py-1 ${currentPath === '/visit' ? 'text-[#7A2322] font-medium' : ''}`}
        >
          Visit
        </Link>
      </div>
    </header>
  );
};
