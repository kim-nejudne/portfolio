import React from 'react';
import { Sparkles, Key, Calendar, BookOpen, MapPin, Menu as MenuIcon } from 'lucide-react';

interface NavigationProps {
  activeTab: 'home' | 'menu' | 'story' | 'visit' | 'reserve' | 'staff' | 'confirmation';
  setActiveTab: (tab: 'home' | 'menu' | 'story' | 'visit' | 'reserve' | 'staff' | 'confirmation') => void;
  staffAuthenticated: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  staffAuthenticated,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#F7F4EE]/95 backdrop-blur-sm hairline-bottom transition-all duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
        
        {/* Brand Mark */}
        <button
          onClick={() => setActiveTab('home')}
          className="group flex flex-col text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7A2322]"
        >
          <span className="font-display text-2xl sm:text-3xl tracking-wider text-[#1A1715] group-hover:text-[#7A2322] transition-colors">
            TALLOW
          </span>
          <span className="text-[10px] tracking-[0.25em] uppercase font-mono-data text-[#6B635A]">
            Dry-Aged · Live-Fire
          </span>
        </button>

        {/* Navigation Links */}
        <nav aria-label="Main Navigation" className="hidden md:flex items-center space-x-8 text-xs font-sans-ui tracking-wider uppercase">
          <button
            onClick={() => setActiveTab('home')}
            className={`pb-1 transition-colors relative ${
              activeTab === 'home'
                ? 'text-[#1A1715] font-semibold border-b border-[#7A2322]'
                : 'text-[#6B635A] hover:text-[#1A1715]'
            }`}
          >
            Overview
          </button>

          <button
            onClick={() => setActiveTab('menu')}
            className={`pb-1 transition-colors relative ${
              activeTab === 'menu'
                ? 'text-[#1A1715] font-semibold border-b border-[#7A2322]'
                : 'text-[#6B635A] hover:text-[#1A1715]'
            }`}
          >
            The Menu
          </button>

          <button
            onClick={() => setActiveTab('story')}
            className={`pb-1 transition-colors relative ${
              activeTab === 'story'
                ? 'text-[#1A1715] font-semibold border-b border-[#7A2322]'
                : 'text-[#6B635A] hover:text-[#1A1715]'
            }`}
          >
            The Craft
          </button>

          <button
            onClick={() => setActiveTab('visit')}
            className={`pb-1 transition-colors relative ${
              activeTab === 'visit'
                ? 'text-[#1A1715] font-semibold border-b border-[#7A2322]'
                : 'text-[#6B635A] hover:text-[#1A1715]'
            }`}
          >
            Location & Hours
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={() => setActiveTab('reserve')}
            className={`px-4 py-2 text-xs uppercase tracking-widest transition-all ${
              activeTab === 'reserve'
                ? 'bg-[#1A1715] text-[#F7F4EE]'
                : 'bg-[#7A2322] text-[#F7F4EE] hover:bg-[#581413]'
            }`}
          >
            Reserve Table
          </button>

          <button
            onClick={() => setActiveTab('staff')}
            title="Staff Control Portal"
            className={`p-2 transition-colors border ${
              activeTab === 'staff'
                ? 'border-[#7A2322] text-[#7A2322] bg-[#7A2322]/5'
                : 'border-[#DDD6C8] text-[#6B635A] hover:text-[#1A1715] hover:border-[#1A1715]'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-[#DDD6C8] py-2 px-2 bg-[#F7F4EE] text-[11px] uppercase tracking-wider text-[#6B635A]">
        <button
          onClick={() => setActiveTab('home')}
          className={`px-2 py-1 ${activeTab === 'home' ? 'text-[#7A2322] font-medium' : ''}`}
        >
          Home
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`px-2 py-1 ${activeTab === 'menu' ? 'text-[#7A2322] font-medium' : ''}`}
        >
          Menu
        </button>
        <button
          onClick={() => setActiveTab('story')}
          className={`px-2 py-1 ${activeTab === 'story' ? 'text-[#7A2322] font-medium' : ''}`}
        >
          Story
        </button>
        <button
          onClick={() => setActiveTab('visit')}
          className={`px-2 py-1 ${activeTab === 'visit' ? 'text-[#7A2322] font-medium' : ''}`}
        >
          Visit
        </button>
      </div>
    </header>
  );
};
