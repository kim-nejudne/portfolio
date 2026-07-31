import React, { useEffect, useState } from 'react';
import { MenuItem } from '../types';
import { DishOfTheDayInsert } from './DishOfTheDayInsert';
import { ArrowDown } from 'lucide-react';

interface HeroSectionProps {
  dishOfDay: MenuItem | null;
  onReserveClick: () => void;
  onMenuClick: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  dishOfDay,
  onReserveClick,
  onMenuClick,
}) => {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // Single masked reveal gesture (~900ms) on load then stays still
    const timer = setTimeout(() => {
      setRevealed(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative overflow-hidden pt-8 pb-16 px-4 sm:px-8 border-b border-[#DDD6C8]">
      
      {/* Background Image: Resolves quiet and static behind typography */}
      <div className="absolute inset-0 z-0 opacity-15 pointer-events-none transition-opacity duration-1000 ease-out">
        <img
          src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1920&q=80"
          alt="Live fire embers"
          className="w-full h-full object-cover grayscale mix-blend-multiply"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        
        {/* Subtle Top Colophon Header */}
        <div className="mb-6 flex items-center justify-center space-x-3 text-xs font-mono-data tracking-[0.25em] text-[#6B635A] uppercase">
          <span>London · Soho</span>
          <span>—</span>
          <span>Open Wood Hearth</span>
          <span>—</span>
          <span>Est. 2024</span>
        </div>

        {/* Type-Led Title: Line-by-Line Masked Reveal */}
        <div className="space-y-1 mb-8">
          <div className="masked-text-line">
            <h1
              className={`masked-text-inner font-display text-5xl sm:text-7xl md:text-8xl tracking-tight text-[#1A1715] ${
                revealed ? 'revealed' : ''
              }`}
            >
              DRY-AGED. LIVE-FIRE.
            </h1>
          </div>
          <br />
          <div className="masked-text-line">
            <h1
              className={`masked-text-inner font-display text-5xl sm:text-7xl md:text-8xl tracking-tight text-[#7A2322] italic ${
                revealed ? 'revealed' : ''
              }`}
            >
              NO THEATRE.
            </h1>
          </div>
        </div>

        {/* Concise Terse Subtitle */}
        <div className="max-w-2xl mx-auto mb-10">
          <p className="font-serif-body text-lg sm:text-xl text-[#1A1715] leading-relaxed">
            Whole primals aged 45 to 60 days in our Himalayan salt room. Cut to weight, seared over red oak embers, served simply with tallow and sea salt.
          </p>
        </div>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <button
            onClick={onReserveClick}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#1A1715] text-[#F7F4EE] hover:bg-[#7A2322] text-xs uppercase tracking-[0.2em] font-sans-ui transition-colors shadow-sm"
          >
            Reserve Sittings
          </button>
          
          <button
            onClick={onMenuClick}
            className="w-full sm:w-auto px-8 py-3.5 border border-[#38322D] text-[#1A1715] hover:border-[#7A2322] hover:text-[#7A2322] text-xs uppercase tracking-[0.2em] font-sans-ui transition-colors"
          >
            Read Printed Menu
          </button>
        </div>

        {/* Tipped-In Editorial Insert Card: Dish of the Day */}
        {dishOfDay && (
          <div className="mt-8">
            <DishOfTheDayInsert dish={dishOfDay} onReserveClick={onReserveClick} />
          </div>
        )}

      </div>
    </section>
  );
};
