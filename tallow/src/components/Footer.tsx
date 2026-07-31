import React from 'react';

interface FooterProps {
  onNavigate: (tab: 'home' | 'menu' | 'story' | 'visit' | 'reserve' | 'staff') => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#1A1715] text-[#F7F4EE] border-t-4 border-[#7A2322] pt-12 pb-16 px-4 sm:px-8 mt-20">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 text-xs font-mono-data">
        
        {/* Brand Colophon */}
        <div className="md:col-span-5 space-y-3">
          <h3 className="font-display text-3xl tracking-widest text-[#F7F4EE]">TALLOW</h3>
          <p className="text-[#8C6E43] uppercase tracking-[0.2em] text-[10px]">
            Dry-Aged · Live-Fire Steakhouse · London Soho
          </p>
          <p className="font-serif-body text-sm text-[#DDD6C8]/80 leading-relaxed max-w-sm">
            Whole primals aged 45 to 60 days in our Himalayan salt room. Seared over red oak embers, served simply with tallow and sea salt.
          </p>
        </div>

        {/* Operating Sittings */}
        <div className="md:col-span-4 space-y-2 text-[#DDD6C8]/90">
          <span className="text-[#8C6E43] uppercase tracking-wider block font-bold mb-2">
            Service Hours
          </span>
          <p>Wednesday – Friday: 17:00 – 23:00</p>
          <p>Saturday: 12:00 – 15:30 · 17:00 – 23:30</p>
          <p>Sunday: 12:00 – 21:00 (Hearth Feast)</p>
          <p className="text-[#7A2322] font-bold pt-1">Monday & Tuesday: Closed for Butchery</p>
        </div>

        {/* Quick Navigation */}
        <div className="md:col-span-3 space-y-2 uppercase tracking-wider text-[11px]">
          <span className="text-[#8C6E43] uppercase tracking-wider block font-bold mb-2">
            Index
          </span>
          <ul className="space-y-1.5 text-[#DDD6C8]">
            <li>
              <button onClick={() => onNavigate('menu')} className="hover:text-[#7A2322] transition-colors">
                The Printed Menu
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('reserve')} className="hover:text-[#7A2322] transition-colors">
                Reserve Sittings
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('story')} className="hover:text-[#7A2322] transition-colors">
                Ageing & Live Hearth Craft
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('visit')} className="hover:text-[#7A2322] transition-colors">
                Location & Private Dining
              </button>
            </li>
            <li className="pt-2">
              <button onClick={() => onNavigate('staff')} className="text-[#8C6E43] hover:text-[#F7F4EE] underline">
                Staff Control Portal (86 Board)
              </button>
            </li>
          </ul>
        </div>

      </div>

      <div className="max-w-6xl mx-auto border-t border-[#38322D] mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center text-[10px] font-mono-data text-[#8A827A] gap-2">
        <p>© {new Date().getFullYear()} TALLOW RESTAURANTS LTD. 14 BEAK STREET, LONDON W1F 9RD.</p>
        <p className="uppercase tracking-widest">NO THEATRE · REAL BASELINE GRID · PRINT DISCIPLINE</p>
      </div>
    </footer>
  );
};
