import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    // on-dark switches the focus ring to paper: oxblood on near-black does not
    // clear contrast, and this is the one dark surface in the app.
    <footer className="on-dark bg-[#1A1715] text-[#F7F4EE] border-t-4 border-[#7A2322] pt-12 pb-16 px-4 sm:px-8 mt-20">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 text-xs font-mono-data">
        
        {/* Brand Colophon */}
        <div className="md:col-span-5 space-y-3">
          <h2 className="font-display text-3xl tracking-widest text-[#F7F4EE]">TALLOW</h2>
          <p className="text-[#755C38] uppercase tracking-[0.2em] text-[10px]">
            Dry-Aged · Live-Fire Steakhouse · London Soho
          </p>
          <p className="font-serif-body text-sm text-[#DDD6C8]/80 leading-relaxed max-w-sm">
            Whole primals aged 45 to 60 days in our Himalayan salt room. Seared over red oak embers, served simply with tallow and sea salt.
          </p>
        </div>

        {/* Operating Sittings */}
        <div className="md:col-span-4 space-y-2 text-[#DDD6C8]/90">
          <h2 className="text-[#755C38] uppercase tracking-wider block font-bold mb-2">
            Service Hours
          </h2>
          <p>Wednesday – Friday: 17:00 – 23:00</p>
          <p>Saturday: 12:00 – 15:30 · 17:00 – 23:30</p>
          <p>Sunday: 12:00 – 21:00 (Hearth Feast)</p>
          <p className="text-[#7A2322] font-bold pt-1">Monday & Tuesday: Closed for Butchery</p>
        </div>

        {/* Quick Navigation */}
        <nav aria-label="Footer" className="md:col-span-3 space-y-2 uppercase tracking-wider text-[11px]">
          <h2 className="text-[#755C38] uppercase tracking-wider block font-bold mb-2">
            Index
          </h2>
          <ul className="space-y-1.5 text-[#DDD6C8]">
            <li>
              <Link to="/menu" className="hover:text-[#7A2322] transition-colors inline-block">
                The Printed Menu
              </Link>
            </li>
            <li>
              <Link to="/reserve" className="hover:text-[#7A2322] transition-colors inline-block">
                Reserve Sittings
              </Link>
            </li>
            <li>
              <Link to="/story" className="hover:text-[#7A2322] transition-colors inline-block">
                Ageing & Live Hearth Craft
              </Link>
            </li>
            <li>
              <Link to="/visit" className="hover:text-[#7A2322] transition-colors inline-block">
                Location & Private Dining
              </Link>
            </li>
            <li className="pt-2">
              <Link to="/staff" className="text-[#755C38] hover:text-[#F7F4EE] underline inline-block">
                Staff Control Portal (86 Board)
              </Link>
            </li>
          </ul>
        </nav>

      </div>

      <div className="max-w-6xl mx-auto border-t border-[#38322D] mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center text-[10px] font-mono-data text-[#8A827A] gap-2">
        <p>© {new Date().getFullYear()} TALLOW RESTAURANTS LTD. 14 BEAK STREET, LONDON W1F 9RD.</p>

        {/*
          The way back to the portfolio, and the only place on the site that
          says out loud what this is.

          TALLOW presents as a real Soho restaurant down to a street address and
          a registered company, which is the right register for the work and the
          wrong thing to leave un-labelled — somebody arriving on this domain
          cold from a shared link had nothing telling them otherwise and no
          route to the other four spokes or the write-up. The hub links out to
          every spoke; until now nothing linked back, so a spoke URL was a dead
          end rather than a door.
        */}
        <p className="uppercase tracking-widest flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span>Demo · a portfolio piece</span>
          <span aria-hidden="true">·</span>
          <a
            href="https://kimnejudne.dev/work/tallow/"
            className="text-[#755C38] underline hover:text-[#F7F4EE] transition-colors"
          >
            Case study
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="https://kimnejudne.dev/"
            className="text-[#755C38] underline hover:text-[#F7F4EE] transition-colors"
          >
            More work
          </a>
        </p>
      </div>
    </footer>
  );
};
