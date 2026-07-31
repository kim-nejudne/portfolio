import React, { useEffect, useState } from 'react';
import { MenuItem } from '../types';
import { DishOfTheDayInsert } from './DishOfTheDayInsert';

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
    // Single masked reveal gesture (~900ms) on load then stays still.
    // Under prefers-reduced-motion the CSS holds the lines in place, so this
    // still runs and simply has nothing to animate.
    const timer = setTimeout(() => setRevealed(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative overflow-hidden pt-8 pb-16 px-4 sm:px-8 border-b border-[#DDD6C8]">

      {/* Background embers: decorative at 15% opacity behind the type, so it is
          hidden from assistive tech and asked for at a size that suits a
          washed-out grayscale backdrop rather than a hero photograph. */}
      <div className="absolute inset-0 z-0 opacity-15 pointer-events-none" aria-hidden="true">
        <img
          src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1400&q=60"
          alt=""
          decoding="async"
          className="w-full h-full object-cover grayscale mix-blend-multiply"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto text-center">

        {/* Subtle Top Colophon Header */}
        <div className="mb-6 flex items-center justify-center space-x-3 text-xs font-mono-data tracking-[0.25em] text-[#6B635A] uppercase">
          <span>London · Soho</span>
          <span aria-hidden="true">—</span>
          <span>Open Wood Hearth</span>
          <span aria-hidden="true">—</span>
          <span>Est. 2024</span>
        </div>

        {/* Type-Led Title: Line-by-Line Masked Reveal.
            Both lines belong to one <h1> — they are one sentence set in two
            registers, not two competing page titles. */}
        <h1 className="space-y-1 mb-8">
          <span className="masked-text-line block">
            <span
              className={`masked-text-inner font-display text-5xl sm:text-7xl md:text-8xl tracking-tight text-[#1A1715] ${
                revealed ? 'revealed' : ''
              }`}
            >
              DRY-AGED. LIVE-FIRE.
            </span>
          </span>

          {/* Printed leading between the two lines. */}
          <span aria-hidden="true" className="block h-6" />

          <span className="masked-text-line block">
            <span
              className={`masked-text-inner font-display text-5xl sm:text-7xl md:text-8xl tracking-tight text-[#7A2322] italic ${
                revealed ? 'revealed' : ''
              }`}
            >
              NO THEATRE.
            </span>
          </span>
        </h1>

        {/* Concise Terse Subtitle */}
        <div className="max-w-2xl mx-auto mb-10">
          <p className="font-serif-body text-lg sm:text-xl text-[#1A1715] leading-relaxed">
            Whole primals aged 45 to 60 days in our Himalayan salt room. Cut to weight, seared over red oak embers, served simply with tallow and sea salt.
          </p>
        </div>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <button
            type="button"
            onClick={onReserveClick}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#1A1715] text-[#F7F4EE] hover:bg-[#7A2322] text-xs uppercase tracking-[0.2em] font-sans-ui transition-colors shadow-sm"
          >
            Reserve Sittings
          </button>

          <button
            type="button"
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
