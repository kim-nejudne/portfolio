import React from 'react';

export const StoryView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-8 space-y-16">
      
      {/* Title Header */}
      <div className="text-center border-b-2 border-[#1A1715] pb-8">
        <span className="font-mono-data text-[10px] uppercase tracking-[0.3em] text-[#8C6E43] block mb-2">
          Method & Philosophy
        </span>
        <h1 className="font-display text-4xl sm:text-6xl text-[#1A1715] tracking-tight">
          THE CRAFT AT TALLOW
        </h1>
        <p className="font-serif-body text-base text-[#6B635A] max-w-xl mx-auto mt-2 italic">
          No theatre. No smoke machines. Only beef, wood, salt and time.
        </p>
      </div>

      {/* Section 1: Sourcing */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center border-b border-[#DDD6C8] pb-12">
        <div className="md:col-span-6 space-y-4">
          <div className="font-mono-data text-xs text-[#8C6E43] uppercase tracking-widest">
            01 / SOURCING & BREED
          </div>
          <h2 className="font-display text-3xl text-[#1A1715]">
            Grass-Fed, Grain-Finished Heritage Cattle
          </h2>
          <p className="font-serif-body text-base text-[#1A1715] leading-relaxed">
            We source exclusively from third-generation family farms in Aberdeenshire and Yorkshire. Native Hereford and Aberdeen Angus primals selected for deep intramuscular marbling and thick fat caps. No growth hormones. No feedlot forcing.
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs font-mono-data bg-[#1A1715]/5 p-3 border border-[#38322D]/10">
            <div>
              <span className="block text-[9px] uppercase text-[#6B635A]">Breed</span>
              <span className="font-bold text-[#1A1715]">Aberdeen Angus & Hereford</span>
            </div>
            <div>
              <span className="block text-[9px] uppercase text-[#6B635A]">Farm Provenance</span>
              <span className="font-bold text-[#1A1715]">Aberdeenshire, UK</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-6">
          <div className="aspect-[4/3] bg-[#EFE6D5] border border-[#DDD6C8] overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80"
              alt="Pasture provenance"
              className="w-full h-full object-cover grayscale contrast-110"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>

      {/* Section 2: Dry Ageing Room */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center border-b border-[#DDD6C8] pb-12">
        <div className="md:col-span-6 md:order-2 space-y-4">
          <div className="font-mono-data text-xs text-[#8C6E43] uppercase tracking-widest">
            02 / THE AGEING ROOM
          </div>
          <h2 className="font-display text-3xl text-[#1A1715]">
            45 to 60 Days Himalayan Salt Conditioning
          </h2>
          <p className="font-serif-body text-base text-[#1A1715] leading-relaxed">
            Whole short-loins and ribs hang in our glass-walled temperature-controlled room kept at precisely 1.5°C and 78% relative humidity. Lined with 400 hand-cut blocks of pink Himalayan salt that draw moisture, concentrating natural enzymes to develop a distinct nutty, mineral aroma.
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs font-mono-data bg-[#1A1715]/5 p-3 border border-[#38322D]/10 text-center">
            <div>
              <span className="block text-[9px] uppercase text-[#6B635A]">Temp</span>
              <span className="font-bold text-[#1A1715]">1.5°C</span>
            </div>
            <div>
              <span className="block text-[9px] uppercase text-[#6B635A]">Humidity</span>
              <span className="font-bold text-[#1A1715]">78% RH</span>
            </div>
            <div>
              <span className="block text-[9px] uppercase text-[#6B635A]">Salt Wall</span>
              <span className="font-bold text-[#1A1715]">400 Bricks</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-6 md:order-1">
          <div className="aspect-[4/3] bg-[#EFE6D5] border border-[#DDD6C8] overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=800&q=80"
              alt="Dry ageing room hanging primals"
              className="w-full h-full object-cover grayscale contrast-110"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>

      {/* Section 3: Live Fire Hearth */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center pb-8">
        <div className="md:col-span-6 space-y-4">
          <div className="font-mono-data text-xs text-[#8C6E43] uppercase tracking-widest">
            03 / THE LIVE HEARTH
          </div>
          <h2 className="font-display text-3xl text-[#1A1715]">
            Sussex Red Oak & White Birch Embers
          </h2>
          <p className="font-serif-body text-base text-[#1A1715] leading-relaxed">
            We burn no gas or charcoal. All cooking occurs over a custom open fire hearth stoked daily with seasoned Sussex Red Oak. Cuts are seared at 450°C to form a mahogany crust, then moved to elevated iron grates to rest over soft embers while basted in rendered beef tallow.
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs font-mono-data bg-[#1A1715]/5 p-3 border border-[#38322D]/10">
            <div>
              <span className="block text-[9px] uppercase text-[#6B635A]">Fuel</span>
              <span className="font-bold text-[#1A1715]">Red Oak & White Birch</span>
            </div>
            <div>
              <span className="block text-[9px] uppercase text-[#6B635A]">Sear Heat</span>
              <span className="font-bold text-[#1A1715]">450°C Direct Grate</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-6">
          <div className="aspect-[4/3] bg-[#EFE6D5] border border-[#DDD6C8] overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80"
              alt="Live hearth embers"
              className="w-full h-full object-cover grayscale contrast-110"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>

    </div>
  );
};
